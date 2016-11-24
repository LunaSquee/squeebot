// Copyright (C) 2015, 2016  nnnn20430 (nnnn20430@mindcraft.si.eu.org)
//
// This file is part of nBot.
//
// nBot is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// nBot is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

/*jshint node: true*/
/*jshint evil: true*/

"use strict";
//reserved nBot variables
let bot;
let pluginId;
let settings;
let pluginSettings;
let ircChannelUsers;
let pluginDisabled = false;

let sendPM,
	fetchJSON,
	log;

const ddgReq = "http://api.duckduckgo.com/?format=json&pretty=1&q=";

//settings constructor
const SettingsConstructor = function (modified) {
	var settings, attrname;
	if (this!==SettingsConstructor) {
		settings = {
			templateSetting: true
		};
		for (attrname in modified) {settings[attrname]=modified[attrname];}
		return settings;
	}
};

//main plugin object
const plugin = {
	initCommands: function() {
		let manePlugin = bot.plugins.squeebot.plugin;
		sendPM = manePlugin.sendPM;
		fetchJSON = manePlugin.fetchJSON;
		log = manePlugin.mylog;

		manePlugin.commandAdd(pluginId, 'ddg', function(simplified, nick, chan, message, pretty, target, mentioned, isPM) {
			let query = encodeURIComponent(message.split(' ').slice(1).join(' ')).replace(/%20/g, '+');
			if(!query) return sendPM(target, nick+": Please specify search string!");

			fetchJSON(ddgReq+query, function(err, res) {
				if(err) return sendPM(target, nick+": Couldn't find an instant answer! https://duckduckgo.com/?q="+query);
				if(res && res.Type === "") return sendPM(target, nick+": Couldn't find an instant answer! https://duckduckgo.com/?q="+query);

				if(res.Answer !== "") return sendPM(target, nick+": "+res.Answer);
				if(res.AbstractURL !== "") return sendPM(target, nick+": "+res.AbstractURL);

				sendPM(target, nick+": Couldn't find an instant answer! https://duckduckgo.com/?q="+query);
			});
		}, "<query> - Instant answers from DuckDuckGo");

		exports.ready = true;
		bot.emitBotEvent('botPluginReadyEvent', pluginId);
	}
};

//exports
module.exports.plugin = plugin;
module.exports.ready = false;

//reserved functions

//reserved functions: handle "botEvent" from bot (botEvent is used for irc related activity)
module.exports.botEvent = function (event) {
	//event is a object with properties "eventName" and "eventData"
	switch (event.eventName) {
		case 'botPluginDisableEvent': if (event.eventData == pluginId) {pluginDisabled = true;} break;
		case 'botPluginReadyEvent': if (event.eventData == "squeebot") {
			plugin.initCommands();
		} break;
	}
};

//reserved functions: main function called when plugin is loaded
module.exports.main = function (i, b) {
	//update variables
	bot = b;
	pluginId = i;
	settings = bot.options;
	pluginSettings = settings.pluginsSettings[pluginId];
	ircChannelUsers = bot.ircChannelUsers;
	
	//if plugin settings are not defined, define them
	if (pluginSettings === undefined) {
		pluginSettings = new SettingsConstructor();
		settings.pluginsSettings[pluginId] = pluginSettings;
		bot.im.settingsSave();
	}
	
	if (bot.plugins.squeebot && bot.plugins.squeebot.ready)
		plugin.initCommands();
};
