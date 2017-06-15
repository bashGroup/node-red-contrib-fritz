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

    node.on('input', function(msg) {
      var inNumber;
      try {
        inNumber = phoneUtil.parse(msg.payload, 'DE');
      } catch(e) {
        node.warn(e);
      }

      if(node.config.state === "ready" && node.config.fritzbox && phoneUtil.isValidNumber(inNumber)) {
        node.config.fritzbox.services["urn:dslforum-org:service:X_AVM-DE_OnTel:1"].actions.GetPhonebook({'NewPhonebookID':node.phonebook})
          .then(function(url) {
            return Promise.promisify(request, {multiArgs: true})({uri: url.NewPhonebookURL, rejectUnauthorized: false});
          }).then(function(result) {
            var body = result[1];
						return Promise.promisify(parser.parseString)(body);
          }).then(function(result) {
            msg.payload = [];
            result.phonebook.contact.forEach(function(contact) {
              var matchNumber = function(number) {
                try {
                  var numberDE = phoneUtil.parse(number._, node.ccode);
                  if(phoneUtil.isValidNumber(numberDE) && phoneUtil.isNumberMatch(inNumber, numberDE) === PNU.MatchType.EXACT_MATCH) {
                    msg.payload.push(contact);
                  }
                } catch (e) {
                }
              };

              if(Array.isArray(contact.telephony.number)) {
                contact.telephony.number.forEach(matchNumber);
              } else {
                matchNumber(contact.telephony.number);
              }
            });
            node.send(msg);
          }).catch(function(error) {
            node.error(error);
          });
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
