var Fritzbox = require("fritzbox")


module.exports = function(RED) {

	function FritzboxIn(n) {
		RED.nodes.createNode(this,n);
		var node = this;
		node.service = n.service;
		node.action = n.action;
		node.config = RED.nodes.getNode(n.device);

		node.config.on('statusUpdate', node.status);

		node.on('input', function(msg) {
			if(node.config.state === "ready" && node.config.fritzbox) {
				var service = msg.service ? msg.service : node.service;
				var action = msg.action ? msg.action : node.action;
				if(action === ""){
					node.error("No action found. Did you select any?")
					return;
				}
				if(node.config.fritzbox.options.ssl && node.config.fritzbox.options.port == 49000){
					node.warn("SSL option selected with Standard Port 49000. Should be 49443?");
				}
				if(node.config.fritzbox.services[service] === undefined){
					node.error("No Services response received.");
					return;
				}
				node.config.fritzbox.services[service].actions[action](msg.payload)
					.then(function(result) {
						msg.payload = result;
						node.send(msg);
					}).catch(function(error) {
						node.error(`Action failed with error: ${error}`, msg);
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
	RED.nodes.registerType("fritzbox-in", FritzboxIn);
};
