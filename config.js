var Fritzbox = require("fritzbox")
var parseStringPromise = require('xml2js').parseStringPromise;

module.exports = function(RED) {

	RED.httpAdmin.get('/fritzbox/services', function(req, res, next) {
		var config = {
			host: req.query.url
		};

		var fritzbox = new Fritzbox.Fritzbox(config);

		Promise.all([fritzbox.initIGDDevice(), fritzbox.initTR064Device()].map(p => p.catch(error => null)))
			.then(function() {
				var services = Object.keys(fritzbox.services);
				res.end(JSON.stringify(services));
			}).catch(function(error) {
				res.status(500);
				res.end(error.message);
			});
	});

	RED.httpAdmin.get('/fritzbox/actions', function(req, res, next) {
		var service = req.query.service;

		var config = {
			host: req.query.url
		};

		var fritzbox = new Fritzbox.Fritzbox(config);

		Promise.all([fritzbox.initIGDDevice(), fritzbox.initTR064Device()].map(p => p.catch(error => null)))
			.then(function() {
				var actions = fritzbox.services[service].actionsInfo;
				res.end(JSON.stringify(actions));
			}).catch(function(error) {
				res.status(500);
				res.end(error.message);
			});
	});

	RED.httpAdmin.get('/fritzbox/users', function(req, res, next) {
		var host = req.query.url;

		var config = {
			host: host
		};

		var fritzbox = new Fritzbox.Fritzbox(config);

		fritzbox.initTR064Device().then(function() {
			return fritzbox.services["urn:dslforum-org:service:LANConfigSecurity:1"].actions["X_AVM-DE_GetUserList"]()
		}).then(function(result) {
			return parseStringPromise(result['NewX_AVM-DE_UserList'], {explicitRoot: false, explicitArray: false, ignoreAttrs: true});
		}).then(function(json) {
			res.end(JSON.stringify(json));
		}).catch(function(error) {
			res.status(500);
			res.end(error.message);
		});
	});



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

		// Initialize fritzbox configuration by gathering services and actions		
		node.reinit = async function() {
			await Promise.all([node.fritzbox.initIGDDevice(), node.fritzbox.initTR064Device()])
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