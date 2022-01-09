const axios = require('axios');
const https = require('https');
const xml2js = require("xml2js");
const parser = xml2js.Parser({ explicitRoot: false, explicitArray: false });

const httpclient = axios.create({
    httpsAgent: new https.Agent({
        rejectUnauthorized: false
    })
});

module.exports = function (RED) {
    function FritzboxList(n) {
        RED.nodes.createNode(this, n);
        let node = this;
        node.phonebookId = n.id;
        node.config = RED.nodes.getNode(n.device);
        node.config.on('statusUpdate', node.status);

        node.on('input', async function (msg) {
            if (node.config.state === "ready" && node.config.fritzbox) {
                let args = {};
                let action = RED.util.evaluateNodeProperty(n.action, n.actiontype, node, msg);
                let queryParams = {};
                let urlkey = "";
                let httpQuery = false;

                switch (action) {
                    case "GetPhonebook":
                        urlkey = "NewPhonebookURL";
                        httpQuery = true;
                        args = {
                            NewPhonebookID: RED.util.evaluateNodeProperty(n.id, n.idtype, node, msg) || 0
                        }
                        break;
                    case "GetPhonebookList":
                        urlkey = "NewPhonebookList";
                        break;
                    case "SetPhonebookEntryUID":
                        urlkey = "SetPhonebookEntryUID";
                        const data=RED.util.evaluateNodeProperty(n.data, n.datatype, node, msg) || 0;
                        args = {
                            NewPhonebookID: RED.util.evaluateNodeProperty(n.id, n.idtype, node, msg) || 0,
                            NewPhonebookEntryData: `
                            <Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope">
                            <contact>
                                <category>${data.category ||0}</category>
                                <person>
                                    <realName>${data.person.realName}</realName>
                                </person>
                                <telephony nid="1">
                                    <number type="${data.telephony.number["$"].type}" prio="1" id="0">${data.telephony.number["_"]}</number>
                                </telephony>
                            </contact>`
                        }
                        break;
                }

                try {
                    let response = await node.config.fritzbox.services["urn:dslforum-org:service:X_AVM-DE_OnTel:1"].actions[action](args);
                    if (httpQuery) {
                        let url = response[urlkey];
                        let result = await httpclient.get(url, { params: queryParams })
                        msg.payload = await parser.parseStringPromise(result.data)
                    } else {
                        msg.payload = response;
                    }

                    node.send(msg);
                } catch (error) {
                    node.error(`${action} failed. Error: ${error}`, msg);
                }

            } else {
                node.warn("Device not ready.");
                node.config.reinit();
            }
        });

        node.on('close', function () {
            node.config.removeListener('statusUpdate', node.status);
        })
    }

    RED.nodes.registerType("fritzbox-phonebook", FritzboxList)
}

