var tr064lib = require("tr-064"),
http = require("http"),
xml2js = require("xml2js");

var client = new tr064lib.TR064();
var parser = xml2js.Parser({explicitRoot: false, explicitArray: false});

module.exports = function(RED) {

	RED.httpAdmin.get('/fritzbox/services', function(req, res, next) {
		var url = req.query.url;
		client.initTR064Device(req.query.url, 49000, function (err, device) {
			if (!err) {
				var services = Object.keys(device.services);
				res.end(JSON.stringify(services));
			}
		});
	});

	RED.httpAdmin.get('/fritzbox/actions', function(req, res, next) {
		var url = req.query.url;
		var service = req.query.service;
		client.initTR064Device(req.query.url, 49000, function (err, device) {
			if(!err && device.services[service]) {
				var actions = device.services[service].meta.actionsInfo;
				res.end(JSON.stringify(actions));
			} else {
				res.end(JSON.stringify([]));
			}
		});
	});

	function FritzboxConfig(n) {
		RED.nodes.createNode(this, n);
		var node = this;
		node.host = n.host;
		node.device = null;
		node.timer = null;

		if(!node.host) return;

		node.reinit = function() {
			if(!node.device) {
				client.initTR064Device(node.host, 49000, function(err, device) {
					if(err) {
						node.error("Initialization of device failed. Check configuration.");
					} else {
						node.device = device;
						node.device.login(node.credentials.username, node.credentials.password);
					}
				});
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

		node.on('input', function(msg) {
			if(node.config.device) {
				var service = msg.service ? msg.service : node.service;
				var action = msg.action ? msg.action : node.action;
				node.config.device.services[service].actions[action](msg.payload, function(err, result) {
					if(err) {
						node.warn(err);
						return;
					} else {
						msg.payload = result;
						node.send(msg);
					}
				});
			} else {
				node.error("Device information invalid. Reinit device...");
				node.config.reinit();
			}
		});
	}
	RED.nodes.registerType("fritzbox-in", FritzboxIn);

	function FritzboxCalllist(n) {
		RED.nodes.createNode(this,n);
		var node = this;
		node.config = RED.nodes.getNode(n.device);

		node.on('input', function(msg) {
			if(node.config.device) {
				node.config.device.services["urn:dslforum-org:service:X_AVM-DE_OnTel:1"].actions.GetCallList(function(err, result) {
					if(err) {
						node.warn(err);
						return;
					} else {
						http.get(result.NewCallListURL, function(result) {
							var data = "";
							result.on('data', function(chunk) {
								data += chunk;
							});
							result.on('end', function() {
								parser.parseString(data, function(err, result) {
									if(err) {
										node.error(err);
										return;
									} else {
										msg.payload = result;
										node.send(msg);
									}
								});
							});
						});
					}
				});
			} else {
				node.error("Device information invalid. Reinit device...");
				node.config.reinit();
			}
		});
	}
	RED.nodes.registerType("fritzbox-calllist", FritzboxCalllist);

};
