var axios = require('axios')
https = require('https')
xml2js = require("xml2js");
var parser = xml2js.Parser({explicitRoot: false, explicitArray: false});

const httpclient = axios.create({
    httpsAgent: new https.Agent({  
      rejectUnauthorized: false
    })
  });

module.exports = function(RED) {
    function FritzboxList(n) {
        RED.nodes.createNode(this,n);
        var node = this;
        node.max = n.max;
        node.maxdays = n.maxdays;
        node.action = n.action ? n.action : "GetCallList";
        node.listurl = n.listurl ? n.listurl : "NewCallListURL";
        node.phonebookId = n.id;
        node.config = RED.nodes.getNode(n.device);
    
        node.config.on('statusUpdate', node.status);
    
        node.on('input', function(msg) {
            if(node.config.state === "ready" && node.config.fritzbox) {
                var args = {};
                var action = node.action;
                var queryParams = {};
                var urlkey = node.listurl;
    
                switch (action) {
                    case "GetCallList":
                        if(n.maxdays) {
                            queryParams["days"] = n.maxdays;
                        }
                        if(n.max) {
                            queryParams["max"] = n.max;
                        }
                    break;
                    case "GetPhonebook":
                        if (typeof msg.payload === "object" && msg.payload.NewPhonebookID) {
                            args = msg.payload;
                        } else {
                            args = {
                                NewPhonebookID: node.phonebookId ? node.phonebookId : 0
                            }
                        }
                    break;
                }
                node.config.fritzbox.services["urn:dslforum-org:service:X_AVM-DE_OnTel:1"].actions[action](args)
                    .then(function(response) {
                        var url = response[urlkey];
                        return httpclient.get(url, queryParams)
                    }).then(function(result) {
                        return parser.parseStringPromise(result.data)
                    }).then(function(result) {
                        msg.payload = result;
                        node.send(msg);
                    }).catch(function(error) {
                        node.error(`Receiving Calllist / Phonebook failed. Error: ${error}`, msg);
                    });
            } else {
                node.warn("Device not ready.");
                node.config.reinit();
            }
        });
    
        node.on('close', function() {
            node.config.removeListener('statusUpdate', node.status);
        });
    }
    RED.nodes.registerType("fritzbox-calllist", FritzboxList);
    RED.nodes.registerType("fritzbox-phonebook", FritzboxList);
}

