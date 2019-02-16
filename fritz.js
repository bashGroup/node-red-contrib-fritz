var Fritzbox = require("fritzbox"),
http = require("http"),
xml2js = require("xml2js");

var Promise = require("bluebird");
var request = require("request");

var parser = xml2js.Parser({explicitRoot: false, explicitArray: false});

module.exports = function(RED) {

	RED.httpAdmin.get('/fritzbox/services', function(req, res, next) {
		var url = req.query.url;
		var config = {
			host: req.query.url
		};

		var fritzbox = new Fritzbox.Fritzbox(config);

		Promise.all([fritzbox.initIGDDevice(), fritzbox.initTR064Device()])
			.then(function() {
				var services = Object.keys(fritzbox.services);
				res.end(JSON.stringify(services));
			}).catch(function(error) {
				res.end();
			});
	});

	RED.httpAdmin.get('/fritzbox/actions', function(req, res, next) {
		var service = req.query.service;

		var config = {
			host: req.query.url
		};

		var fritzbox = new Fritzbox.Fritzbox(config);

		Promise.all([fritzbox.initIGDDevice(), fritzbox.initTR064Device()])
			.then(function() {
				var actions = fritzbox.services[service].actionsInfo;
				res.end(JSON.stringify(actions));
			}).catch(function(error) {
				res.end();
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

		node.reinit = function() {
			Promise.all([node.fritzbox.initIGDDevice(), node.fritzbox.initTR064Device()])
				.then(function() {
					updateStatus("ready");
				}).catch(function(error) {
					node.error(`Initialization of device failed ${error}. Check configuration.`, msg);
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

	function FritzboxCalllist(n) {
		RED.nodes.createNode(this,n);
		var node = this;
		node.max = n.max;
		node.config = RED.nodes.getNode(n.device);

		node.config.on('statusUpdate', node.status);

		node.on('input', function(msg) {
			if(node.config.state === "ready" && node.config.fritzbox) {
				node.config.fritzbox.services["urn:dslforum-org:service:X_AVM-DE_OnTel:1"].actions.GetCallList()
					.then(function(url) {
						if(n.max) {
							url.NewCallListURL += "&max=" + n.max;
						}
						return Promise.promisify(request, {multiArgs: true})({uri: url.NewCallListURL, rejectUnauthorized: false});
					}).then(function(result) {
						var body = result[1];
						return Promise.promisify(parser.parseString)(body);
					}).then(function(result) {
						msg.payload = result;
						node.send(msg);
					}).catch(function(error) {
						node.error(`Receiving callist failed. Error: ${error}`, msg);
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
	RED.nodes.registerType("fritzbox-calllist", FritzboxCalllist);

};
