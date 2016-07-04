var net = require('net');

module.exports = function(RED) {

	function FritzboxCallmonitor(n) {
		RED.nodes.createNode(this,n);
		var node = this;
    node.topic = n.topic;
		node.config = RED.nodes.getNode(n.device);

    var client = new net.Socket();
    var connections = {};

    node.status({fill:"yellow",shape:"ring",text:"Initialization"});

    client.on('connect', function() {
      node.status({fill:"green",shape:"dot",text:"Connected"});
    });

    client.on('close', function(hadError) {
      if(hadError) {
        node.status({fill:"red",shape:"ring",text:"Disconnected with Error"});
      } else {
        node.status({fill:"red",shape:"ring",text:"Disconnected"});
      }
    });

    client.on('data', function(data) {
      var raw = data.toString();
      var array = raw.split(";");
      var type = array[1];
      var id = array[2];
      var timestamp = array[0];
      var message;

      switch(type) {
        case "CALL":
          message = {
            type: "OUTBOUND",
            id: id,
            timestamp: timestamp,
            caller: array[4],
            callee: array[5],
            extension: array[3]
          };
          connections[id] = message;
          break;
        case "RING":
          message = {
            type: "INBOUND",
            id: id,
            timestamp: timestamp,
            caller: array[3],
            callee: array[4]
          };
          connections[id] = message;
          break;
        case "CONNECT":
          message = connections[id];
          message.type = "CONNECT";
          message.extension = array[3];
          connections[id] = message;
          break;
        case "DISCONNECT":
          message = connections[id];
          delete connections[id];
          switch(message.type) {
            case "INBOUND":
              message.type = "MISSED";
              break;
            case "CONNECT":
              message.type = "DISCONNECT";
              break;
            case "OUTBOUND":
              message.type = "UNREACHED";
          }
          break;
      }
      node.send({
        topic: node.topic ? node.topic : "",
        payload: message
      });
    });

    client.connect({
      port: 1012,
      host: node.config.host,
    });

    node.on('close', function() {
      client.removeAllListeners();
      client.end();
    });


	}
	RED.nodes.registerType("fritzbox-callmonitor", FritzboxCallmonitor);

};
