var supportedEvents = ["join", "part", "quit", "topic", "message", "pm", "notice", "+mode", "-mode", "nick", "whois", "raw", "smartpm"];
var util = require("util");
var Module = function(listeners) {
	var self = this;
	supportedEvents.forEach(function(ev) {
		if(listeners[ev]) {
			for(var i = 0; i < listeners[ev].length; ++i) {
				listeners[ev][i] = listeners[ev][i].bind(self);
			}
		}
	});
	this.listeners = listeners;
}

Module.prototype = {
	load: function(module, bot, conf) {
		this.name = module;
		this.bot = bot;
		this.config = conf;

		var self = this;
		supportedEvents.forEach(function(ev) {
			if(util.isArray(self.listeners[ev])) {
				self.listeners[ev].forEach(function(listener) {
					bot.addListener(ev, listener);
				});
			}
		});

		console.log("Loaded module "+module);
	},
	unload: function(bot) {
		var self = this;
		supportedEvents.forEach(function(ev) {
			if(util.isArray(self.listeners[ev])) {
				self.listeners[ev].forEach(function(listener) {
					bot.removeListener(ev, listener);
				});
			}
		});
		console.log("Unloaded module "+this.name);
		delete this.name;
		delete this.bot;
		delete this.config;
	}
}

module.exports = Module;