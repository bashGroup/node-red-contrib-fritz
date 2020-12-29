var net = require('net');

module.exports = function(RED) {

	function FritzboxCallmonitor(n) {
		RED.nodes.createNode(this,n);
		var node = this;
    node.topic = n.topic;
		node.config = RED.nodes.getNode(n.device);

    var client = new net.Socket();
    client.setKeepAlive(true, 118000);
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
      const raw = data.toString();
      const array = raw.split(";");
      const type = array[1];
      const id = array[2];
      const timestamp = array[0];
      let message;

      if (connections[id] !== undefined) {
        message = connections[id]
      } else {
        message = {}
      }

      switch(type) {
        case "CALL":
          message.type = "OUTBOUND";
          message.id = id;
          message.timestamp = timestamp;
          message.caller = array[4];
          message.callee = array[5];
          message.extension = array[3];
          connections[id] = message;
          break;
        case "RING":
          message.type = "INBOUND";
          message.id = id;
          message.timestamp = timestamp;
          message.caller = array[3];
          message.callee = array[4];
          connections[id] = message;
          break;
        case "CONNECT":
          message.type = "CONNECT";
          message.id = id;
          message.timestamp = timestamp;
          message.extension = array[3];
          connections[id] = message;
          break;
        case "DISCONNECT":
          switch(message.type) {
            case "INBOUND":
              message.type = "MISSED";
              break;
            case "CONNECT":
              message.type = "DISCONNECT";
              break;
            case "OUTBOUND":
              message.type = "UNREACHED";
              break;
          }
          message.id = id;
          message.timestamp = timestamp;
          message.duration = array[3];
          delete connections[id];
          break;
      }
      node.send({
        topic: node.topic ? node.topic : "",
        payload: message
      });
    });

    reconnect();

    node.on('close', function() {
      client.setKeepAlive(false, 118000);
      client.end(function() {
        client.removeAllListeners();
        node.log('Disconnected from fritzbox');
      });
      if(timeout) clearTimeout(timeout);
    });


	}
	RED.nodes.registerType("fritzbox-callmonitor", FritzboxCallmonitor);

};
