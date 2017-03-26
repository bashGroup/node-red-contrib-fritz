var net = require('net');

module.exports = function(RED) {

	function FritzboxCallmonitor(n) {
		RED.nodes.createNode(this,n);
		var node = this;
    node.topic = n.topic;
		node.config = RED.nodes.getNode(n.device);

    var client = new net.Socket();
    var connections = {};
    var timeout;
    var options = {
      port: 1012,
      host: node.config.host,
    };

		var reconnect = function() {
			node.log('Connecting to fritzbox...');
			if(timeout) clearTimeout(timeout);
			client.connect(options);
		};

    node.status({fill:"yellow",shape:"ring",text:"Initialization"});

    client.on('connect', function() {
			node.log('Connected to fritzbox');
      node.status({fill:"green",shape:"dot",text:"Connected"});
    });

    client.on('close', function(hadError) {
      if(hadError) {
				node.error("Disconnected with Error");
        node.status({fill:"red",shape:"ring",text:"Disconnected with Error"});
      } else {
				node.warn("Disconnected");
        node.status({fill:"red",shape:"ring",text:"Disconnected"});
      }
			node.log("Reconnecting in 30sec");
      timeout = setTimeout(reconnect, 30000);
    });

		client.on('error', function(e) {
			node.error(e);
		});

		client.on('timeout', function() {
			node.error('Connection to fritzbox timed out');
			client.end();
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

    reconnect();

    node.on('close', function() {
      client.removeAllListeners();
      client.end();
      if(timeout) clearTimeout(timeout);
    });


	}
	RED.nodes.registerType("fritzbox-callmonitor", FritzboxCallmonitor);

};
