// Copyright (C) 2015  nnnn20430 (nnnn20430@mindcraft.si.eu.org)
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
var bot;
var pluginId;
var settings;
var pluginSettings;
var ircChannelUsers;

//variables
var http = require('http');
var net = require('net');
var util = require('util');
var events = require('events');
var exec = require('child_process').exec;
var path = require('path');

var manePlugin;

var pluginDisabled = false;

//settings constructor
var SettingsConstructor = function (modified) {
	var settings, attrname;
	if (this!==SettingsConstructor) {
		settings = {
			api: {
				client: null,
				client_secret: null
			},
			trackStreamer: "paraspriteradio"
		};
		for (attrname in modified) {settings[attrname]=modified[attrname];}
		return settings;
	}
};

//main plugin object
var pluginObj = {
	twitchStreamer: function(streamer, target, url) {
		manePlugin.fetchJSON("https://api.twitch.tv/kraken/streams/"+streamer, function(error, content) {
			if(error===null) {
				if(content.stream != null) {
					manePlugin.sendPM(target, "\u00036Twitch\u000312 \""+content.stream.channel.status+"\" \u000312"+content.stream.channel.display_name+" "+(content.stream.game != null ? "\u00033Playing \u000312"+content.stream.game : "\u00033Playing nothing")+" \u00033Viewers: \u000311"+content.stream.viewers+
						(url ? " \u00033Livestream: \u000312http://www.twitch.tv/"+streamer : ""));
				} else {
					if(content.status === 404)
						manePlugin.sendPM(target, "\u00034"+content.message);
					else
						manePlugin.sendPM(target, "\u00034The livestream is offline"+
							(url ? " \u00033Livestream: \u000312http://www.twitch.tv/"+streamer : ""));
				}
			} else {
				manePlugin.sendPM(target, "\u00034An error occured with the request to Twitch API");
			}
		}, {"Client-ID": pluginSettings.api.client});
	},
	twitchVideo: function(id, target, url) {
		manePlugin.fetchJSON("https://api.twitch.tv/kraken/videos/" + id, function(error, content) {
			console.log(content)
			if(error===null) {
				if(content.title != null) {
					manePlugin.sendPM(target, "\u00036Twitch Video\u000312 \"" + content.title + "\" \u000312"+content.channel.display_name+" "+
						(content.game != null ? "\u00033Playing \u000312" + content.game : "\u00033Playing nothing")+" \u00033Views: \u000311"+
						content.views + (url ? " \u00033Livestream: \u000312http://www.twitch.tv/videos/" + id : ""));
				} else {
					manePlugin.sendPM(target, "\u00034Failed to fetch video.")
				}
			} else {
				manePlugin.sendPM(target, "\u00034An error occured with the request to Twitch API");
			}
		}, {"Client-ID": pluginSettings.api.client});
	},
	initCommands: function() {
		manePlugin = bot.plugins.squeebot.plugin;
		manePlugin.commandAdd(pluginId, "twitch", function(simplified, nick, chan, message, pretty, target, mentioned, isPM) {
			var streamer = pluginSettings.trackStreamer;
			if(simplified[1] != null) {
				if(simplified[1].toLowerCase === "update") {
					pluginObj.updateProfile(nick, target, simplified.slice(2));
					return;
				} else {
					streamer = simplified[1];
				}
			}
			pluginObj.twitchStreamer(streamer, target, true);
		}, "[<channel>] [args] - Twitch.tv handle");

		//plugin is ready
		exports.ready = true;
		bot.emitBotEvent('botPluginReadyEvent', pluginId);
	}
};

//exports
module.exports.plugin = pluginObj;
module.exports.ready = false;

//reserved functions

//reserved functions: handle "botEvent" from bot (botEvent is used for irc related activity)
module.exports.botEvent = function (event) {
	//event is a object with properties "eventName" and "eventData"
	switch (event.eventName) {
		case 'botPluginDisableEvent': if (event.eventData == pluginId) {pluginDisabled = true;} break;
		case 'botPluginReadyEvent': if (event.eventData == "squeebot") {
			pluginObj.initCommands();
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
		pluginObj.initCommands();
};
