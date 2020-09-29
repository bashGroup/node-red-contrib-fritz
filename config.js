var Fritzbox = require("fritzbox")

module.exports = function(RED) {
    function FritzboxConfig(n) {
		RED.nodes.createNode(this, n);
		var node = this;
		node.host = n.host;
		node.timer = null;
		node.state = null;

		if(!node.host) return;

		var config = {
			host: n.host,
			user: node.credentials.username,
			password: node.credentials.password,
			port: n.port,
			ssl: n.ssl
		};

		node.fritzbox = new Fritzbox.Fritzbox(config);

		node.reinit = function() {
			Promise.all([node.fritzbox.initIGDDevice(), node.fritzbox.initTR064Device()].map(p => p.catch(error => null)))
			.then(function() {
					updateStatus("ready");
				}).catch(function(error) {
					node.error(`Initialization of device failed ${error}. Check configuration.`);
					updateStatus("error");
				});
		};

		var updateStatus = function(status) {
			node.state = status;
			switch(status) {
				case "init":
					node.emit("statusUpdate", {fill:"yellow",shape:"ring",text:"Initializing device ..."});
					break;
				case "ready":
					node.emit("statusUpdate", {fill:"green",shape:"dot",text:"Ready"});
					break;
				case "error":
					node.emit("statusUpdate", {fill:"red",shape:"ring",text:"Error"});
					break;
			}
		};
		node.reinit();
	}
	RED.nodes.registerType("fritzbox-config", FritzboxConfig, {
		credentials: {
			username: {type: "text"},
			password: {type: "password"}
		}
	});
}