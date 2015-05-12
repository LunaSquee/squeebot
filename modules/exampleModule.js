/*
	Squeebot Module System. Written by LunaSquee. Documentation
	
	Predefined events:
		Most of the events here(http://node-irc.readthedocs.org/en/latest/API.html#events) are supported.
		Do not leave "new Module()" without arguments, give it an empty object if you don't want any event handlers.
		We have also added an event "smartpm" which you can use to write custom message handlers.
			"smartpm" emits the following parameters: nick, chan, message, simplified, target, isMentioned, isPM

	Adding commands:
		You could create a custom command handler with the "smartpm" event, but you can also add or modify the current commands!
		The commands are in botobj.commands. Example:

		botobj.commands['random'] = {"action":(function(simplified, nick, chan, message, target, mentioned, isPM) {
	        botobj.sendPM(target, nick+": Random: "+Math.floor(Math.random() * 180) + 1);
	    }),"description":"- Random command"}

		Adding "oper":0 indicates that you check if the sender is an operator on chan (botobj.isOpOnChannel(nick, chan))
		Adding "oper":1 indicates that you check if the sender is an operator of the bot (botobj.isGlobalOp(nick))

		!!!!!Make sure to delete the command from the commands object on unload!!!!!

	Functions of botobj:
		botobj.fetchJSON("http://url.json", callback) - Grab JSON object from an url (callback returns "success":boolean and "response":object)
		botobj.fetchJSON_HTTPS("https://url.json", callback) - Grab JSON object from an url (HTTPS)
		botobj.sendPM(target, "message") - Sends an IRC message to the target
		botobj.consolePrint("message") - Print a message to the console
		botobj.isOpOnChannel("nick", "#channel") - Check if the nick is an operator on a channel
		botobj.isGlobalOp("nick") - Check if the user is a global bot operator (See /ops command in console)

	Objects included:
		botobj.commands - Contains all the commands of the bot that can be run from the main message handler
		botobj.settings - Contains the object of settings.json file

	Basic example of a working bot module (this can be loaded by doing /module load exampleModule): 
*/

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