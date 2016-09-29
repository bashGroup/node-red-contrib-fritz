var tr064lib = require("tr-064"),
http = require("http"),
xml2js = require("xml2js");

var client = new tr064lib.TR064();
var parser = xml2js.Parser({explicitRoot: false, explicitArray: false});

module.exports = function(RED) {

	RED.httpAdmin.get('/fritzbox/services', function(req, res, next) {
		var provider = req.query.provider;
		var url = req.query.url;
		switch(provider) {
			case "IGD":
				client.initIGDDevice(req.query.url, 49000, function (err, device) {
					if (!err) {
						var services = Object.keys(device.services);
						res.end(JSON.stringify(services));
					}
				});
				break;
			case "TR064":
				client.initTR064Device(req.query.url, 49000, function (err, device) {
					if (!err) {
						var services = Object.keys(device.services);
						res.end(JSON.stringify(services));
					}
				});
				break;
			default:
				res.end();
		}
	});

	RED.httpAdmin.get('/fritzbox/actions', function(req, res, next) {
		var url = req.query.url;
		var provider = req.query.provider;
		var service = req.query.service;

		switch(provider) {
			case "IGD":
				client.initIGDDevice(req.query.url, 49000, function (err, device) {
					if(!err && device.services[service]) {
						var actions = device.services[service].meta.actionsInfo;
						res.end(JSON.stringify(actions));
					} else {
						res.end(JSON.stringify([]));
					}
				});
				break;
			case "TR064":
				client.initTR064Device(req.query.url, 49000, function (err, device) {
					if(!err && device.services[service]) {
						var actions = device.services[service].meta.actionsInfo;
						res.end(JSON.stringify(actions));
					} else {
						res.end(JSON.stringify([]));
					}
				});
				break;
			default:
				res.end();
			}
	});

	function FritzboxConfig(n) {
		RED.nodes.createNode(this, n);
		var node = this;
		node.host = n.host;
		node.providers = {};
		node.timer = null;
		node.state = null;

		if(!node.host) return;

		function updateStatus(status) {
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
		}

		node.reinit = function() {
			if(node.state !== "init") {
				updateStatus("init");
				node.log("Initializing tr064 ...");
				client.initTR064Device(node.host, 49000, function(err, tr064) {
					if(err || !tr064) {
						node.error("Initialization of device failed. Check configuration. Error: "+err);
						updateStatus("error");
					} else {
						node.log("Successfully initialzed tr064 device.");
						node.providers.TR064 = tr064;
						node.providers.TR064.httplogin(node.credentials.username, node.credentials.password);
						client.initIGDDevice(node.host, 49000, function(err, igd) {
							if(err || !igd) {
								node.error("Initialization of device failed. Check configuration. Error: "+err);
								updateStatus("error");
							} else {
								node.log("Successfully initialzed igd device.");
								node.providers.IGD = igd;
								node.providers.IGD.httplogin(node.credentials.username, node.credentials.password);
								updateStatus("ready");
							}
						});
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
		node.provider = n.provider;
		node.service = n.service;
		node.action = n.action;
		node.config = RED.nodes.getNode(n.device);

		node.config.on('statusUpdate', node.status);

		node.on('input', function(msg) {
			if(node.config.state === "ready" && node.provider) {
				var provider = msg.provider ? msg.provider : node.provider;
				var service = msg.service ? msg.service : node.service;
				var action = msg.action ? msg.action : node.action;

				node.config.providers[provider].services[service].actions[action](msg.payload, function(err, result) {
					if(err) {
						node.warn(err);
						return;
					} else {
						msg.payload = result;
						node.send(msg);
					}
				});
			} else {
				node.error("Device not ready.");
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
			if(node.config.state === "ready" && node.config.providers.TR064) {
				node.config.providers.TR064.services["urn:dslforum-org:service:X_AVM-DE_OnTel:1"].actions.GetCallList(function(err, result) {
					if(err) {
						node.warn(err);
						return;
					} else {
						if(n.max) {
							result.NewCallListURL += "&max=" + n.max;
						}
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
				node.error("Device not ready.");
				node.config.reinit();
			}
		});

		node.on('close', function() {
			node.config.removeListener('statusUpdate', node.status);
		});
	}
	RED.nodes.registerType("fritzbox-calllist", FritzboxCalllist);

};
