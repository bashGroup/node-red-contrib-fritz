[![npm version](https://badge.fury.io/js/node-red-contrib-fritz.svg)](https://badge.fury.io/js/node-red-contrib-fritz)
[![Build Status](https://travis-ci.org/bashGroup/node-red-contrib-fritz.svg?branch=master)](https://travis-ci.org/bashGroup/node-red-contrib-fritz)

[![NPM](https://nodei.co/npm/node-red-contrib-fritz.png?compact=true)](https://nodei.co/npm/node-red-contrib-fritz/)

# node-red-contrib-fritz

This node for the node-RED application provides easy access to your avm fritzbox. You can read and write the configuration of your fritzbox including the VoIP and Dect configuration.

## Installation
Just install this module in your node-RED configuration folder

```bash
cd ~/.node-red
npm install node-red-contrib-fritz
```

Or globally:

```bash
npm install -g node-red-contrib-fritz
```

## Usage
You can use the generic node to access every function provided by the development api of your fritzbox. First create a configuration including the hostname (e.g. fritz.box), username (e.g. admin) and password of your fritzbox. If this informations are provided you can use the search button to discover available services. Select the service you want to use. Select the action the same way.

The `msg.payload` of the incoming message will be used as arguments. You have to provide a json object with argument name as key and the value, e.g. `{ "NewEnable" : 1, "NewUrl" : "string" }`. Available arguments will be shown in the the hint after you selected the action.
You can override the settings if you provide `msg.provider` ("IGD" or "TR064"), `msg.service` or/and `msg.action`.

## Examples

### Presence Detection

![Presence](/examples/presence.png)

```json
[{"id":"f80158f1.d27ab8","type":"inject","z":"5517edea.ed19e4","name":"20:82:C0:26:86:FE","topic":"","payload":"{\"NewMACAddress\": \"20:82:C0:26:86:FE\" }","payloadType":"json","repeat":"","crontab":"","once":false,"x":350,"y":140,"wires":[["7b27936b.08bc8c"]]},{"id":"7b27936b.08bc8c","type":"fritzbox-in","z":"5517edea.ed19e4","device":"28b24ff3.2b8f1","name":"","service":"urn:dslforum-org:service:Hosts:1","action":"GetSpecificHostEntry","arguments":"{\"NewMACAddress\":\"value\"}","x":530,"y":140,"wires":[["12274598.0e46da"]]},{"id":"12274598.0e46da","type":"debug","z":"5517edea.ed19e4","name":"","active":true,"console":"false","complete":"false","x":690,"y":140,"wires":[]},{"id":"28b24ff3.2b8f1","type":"fritzbox-config","z":"","name":"","host":"192.168.80.1","port":"49000","ssl":false}]
```

### Callmonitor

![Callmonitor](/examples/callmonitor.png)

```json
[{"id":"49ea9337.0f9fdc","type":"fritzbox-callmonitor","z":"8d4a73b4.140f","device":"28b24ff3.2b8f1","name":"","topic":"","x":240,"y":100,"wires":[["635c2f29.f18ad"]]},{"id":"635c2f29.f18ad","type":"fritzbox-contact","z":"8d4a73b4.140f","device":"28b24ff3.2b8f1","name":"","topic":"","phonebook":"0","ccode":"DE","x":450,"y":100,"wires":[["6a4a06bc.f70b48"]]},{"id":"6a4a06bc.f70b48","type":"debug","z":"8d4a73b4.140f","name":"","active":true,"console":"false","complete":"false","x":630,"y":100,"wires":[]},{"id":"28b24ff3.2b8f1","type":"fritzbox-config","z":"","name":"","host":"192.168.80.1","port":"49000","ssl":false}]
```

## Contributing
1. Fork it!
2. Create your feature branch: `git checkout -b my-new-feature`
3. Commit your changes: `git commit -am 'Add some feature'`
4. Push to the branch: `git push origin my-new-feature`
5. Submit a pull request :D

[![NPM](https://mapero.github.io/paypal.png)](https://www.paypal.me/JochenScheib/2)

## Credits
Jochen Scheib

## License
MIT
