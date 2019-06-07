var request = require("request");
var parser = require("xml2js").Parser({explicitRoot: false, explicitArray: false, mergeAttrs: true});
var Promise = require("bluebird");
var PNU = require('google-libphonenumber').PhoneNumberUtil;
var PNF = require('google-libphonenumber').PhoneNumberFormat;
var phoneUtil = PNU.getInstance();

module.exports = function(RED) {

  RED.httpAdmin.get('/fritzbox/phonebook/regioncodes', function(req, res, next) {
    res.end(JSON.stringify(phoneUtil.getSupportedRegions()));
  });

  function FritzBoxContact(n) {
    RED.nodes.createNode(this,n);
    var node = this;
    node.topic = n.topic;
    node.phonebook = n.phonebook || 0;
    node.ccode = n.ccode;
    node.config = RED.nodes.getNode(n.device);

    var statusupdate = function(status) {
      node.status = status;
    };

    node.config.on('statusUpdate', statusupdate);

    var queryphonebook = function(phonenumber) {
      return new Promise(function(resolve, reject) {
        var inNumber;
        try {
          inNumber = phoneUtil.parse(phonenumber, node.ccode);
        } catch(e) {
          node.warn(`The provided number ${phonenumber} is not valid for region ${node.ccode}: ${e}`);
          resolve([]);
        }
        if(!phoneUtil.isValidNumber(inNumber)) {
          node.warn(`The provided number ${phonenumber} is not valid for region ${node.ccode}`);
          resolve([]);
        }

        node.config.fritzbox.services["urn:dslforum-org:service:X_AVM-DE_OnTel:1"].actions.GetPhonebook({'NewPhonebookID': node.phonebook})
          .then(function(url) {
            return Promise.promisify(request, {multiArgs: true})({uri: url.NewPhonebookURL, rejectUnauthorized: false});
          }).then(function(result) {
            var body = result[1];
            return Promise.promisify(parser.parseString)(body);
          }).then(function(result) {
            var contacts = [];

            result.phonebook.contact.forEach(function(contact) {
              var matchNumber = function(number) {
                try {
                  var numberDE = phoneUtil.parse(number._, node.ccode);
                  if(phoneUtil.isValidNumber(numberDE) && phoneUtil.isNumberMatch(inNumber, numberDE) === PNU.MatchType.EXACT_MATCH) {
                    contacts.push(contact);
                  }
                } catch(e) {
                  node.warn(`The invalid phonebook number ${phonenumber} for region ${node.ccode} will be ignored: ${e}`);
                }
              };

              if(Array.isArray(contact.telephony.number)) {
                contact.telephony.number.forEach(matchNumber);
              } else {
                matchNumber(contact.telephony.number);
              }
            });
            resolve(contacts);
          }).catch(function(error) {
            reject(error);
          });
      });
    };

    node.on('input', function(msg) {
      if(node.config.state === "ready" && node.config.fritzbox) {
        if(msg.payload !== null &&
              typeof msg.payload === 'object' &&
              !Array.isArray(msg.payload) &&
              msg.payload.callee !== undefined &&
              msg.payload.caller !== undefined ) {
          var caller = queryphonebook(msg.payload.caller).then(function(contacts) {
            msg.payload.caller_contacts = contacts;
          });
          var callee = queryphonebook(msg.payload.callee).then(function(contacts) {
            msg.payload.callee_contacts = contacts;
          });
          Promise.all([caller, callee]).then(function() {
            node.send(msg);
          }).catch(function(e) {
            node.warn(e);
            node.send(msg);
          });
        } else if (msg.payload !== null && typeof msg.payload === 'string') {
          queryphonebook(msg.payload).then(function(contacts) {
            msg.payload = contacts;
            node.send(msg);
          }).catch(function(e) {
            node.warn(e);
            msg.payload = [];
            node.send(msg);
          });
        } else {
          node.warn("Invalid input");
          node.send(msg);
        }
      } else {
        node.error("Device not ready.");
        node.config.reinit();
      }
    });

    node.on('close', function() {
      node.config.removeListener('statusUpdate', statusupdate);
    });

  }
  RED.nodes.registerType("fritzbox-contact", FritzBoxContact);
};
