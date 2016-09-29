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

## Contributing
1. Fork it!
2. Create your feature branch: `git checkout -b my-new-feature`
3. Commit your changes: `git commit -am 'Add some feature'`
4. Push to the branch: `git push origin my-new-feature`
5. Submit a pull request :D

## Credits
Jochen Scheib

## License
MIT
