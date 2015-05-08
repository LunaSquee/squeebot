// Load module core
var Module = require("./core.js");

// Create a new module instance. Binds bot event "join" to function "respond"
var myModule = new Module({"join":[respond]});

// The bot
var botobj;

// Default configs
var conf = {}

// Called on module load
myModule.load = function() {
	Object.getPrototypeOf(this).load.apply(this, arguments); // IMPORTANT LINE! DO NOT REMOVE!!!!
	// Store the bot object just in case.
	botobj = this.bot;
	// Apply config options
	console.log(this.config);
	for(var i in this.config) {
		var value = this.config[i];
		if(i in conf)
			conf[i] = value;
	}
	// Add a command
	botobj.commands['random'] = {"action":(function(simplified, nick, chan, message, target) {
        botobj.sendPM(target, nick+": Random: "+Math.floor(Math.random() * 180) + 1);
    }),"description":"- Randomstuffs or something lol"}
}

// Called on module unload
myModule.unload = function() {
	Object.getPrototypeOf(this).unload.apply(this, arguments); // IMPORTANT LINE! DO NOT REMOVE!!!!
	// Delete the command we added.
	delete botobj.commands['random'];
	// Unlink bot object
	botobj = null;
}

// Bot event handler
function respond(channel, nick, message) {
	if(nick !== botobj.nick)
		botobj.sendPM(channel, "Welcome, "+nick+", to "+channel+"!");
}

module.exports = myModule;