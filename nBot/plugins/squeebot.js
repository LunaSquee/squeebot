#!/usr/bin/env node
'use strict';
// IRC bot by LunaSquee (Originally djazz, best poni :3)

// This is a plugin for nBot (https://git.mindcraft.si.eu.org/?p=nBot.git)
// Before using: npm install gamedig qs
// Have fun!

// Modules
const net = require('net');
const url = require('url');
const util = require('util');
const readline = require('readline');
const gamedig = require('gamedig');
const fs = require('fs');
const events = require("events");
const emitter = new events.EventEmitter();
const cprog = require("child_process");
const qs = require('qs');
const path = require('path');
const HTMLEntities = require('html-entities').AllHtmlEntities,
	  entities = new HTMLEntities();

const squeeDir = __dirname+'/../squeebot/';
const alpaca = require(squeeDir+'alpaca.json');
const timezones = require(squeeDir+'tz.json');

var responses = 'generic.json';
var responselist = [];

// useful variables
var NICK;					// The bot's nickname
var PREFIX;					// The prefix of commands
var relayserver;			// Relay server
var relayConnections = {};	// Relay connections
var calSyncInterval = false;

// nBot variables
var bot;
var pluginId;
var botInstanceSettings;
var settings;
var ircChannelUsers;

// Episode countdown (!nextep)
const week = 7*24*60*60*1000;
var airDate;

// URL checking
const urlRegex = /(((ftp|https?):\/\/)[\-\w@:%_\+.~#?,&\/\/=]+)/g;

// Execute
var exec = cprog.exec;

// Notes:
// Get hostname from sender: data.rawdata[0].split(' ')[0][1];

var administration = {
	data: null,
	file: "channel_administration.json",
	nickserv_cache: {},
	logins: {}
};

// Events
var sEvents = [];

// Squeebot splash
var splash ="\x1b[1;36m ____                        _           _   \n"+
"/ ___|  __ _ _   _  ___  ___| |__   ___ | |_ \n"+
"\\___ \\ / _` | | | |/ _ \\/ _ \\ \'_ \\ / _ \\| __|\n"+
" ___) | (_| | |_| |  __/  __/ |_) | (_) | |_ \n"+
"|____/ \\__, |\\__,_|\\___|\\___|_.__/ \\___/ \\__|\n"+
"          |_|                                \x1b[0m";

// This is the list of all your commands.
// "command":{"action":YOUR FUNCTION HERE, description:COMMAND USAGE(IF NOT PRESENT, WONT SHOW UP IN !commands)}
// Action arguments are the following: simplified, nick, chan, message, pretty, target, isMentioned, isPM
var commands = {
	"help":{action: (function(simplified, nick, chan, message, pretty, target) {
		if(simplified[1]) {
			if(simplified[1] === "-a") {
				listCommands(nick, target, 1, chan);
				return;
			}
			let cmdName = (simplified[1].indexOf(PREFIX) === 0 ? simplified[1].substring(1) : simplified[1]).toLowerCase();

			commandHelp(cmdName, simplified, target, nick, null, chan);
		} else {
			listCommands(nick, target, null, chan);
		}
	}), description:"[command] - All Commands", categories: ["help"]},

	"cmdsource":{action: (function(simplified, nick, chan, message, pretty, target) {
		if(simplified[1]) {
			let cmdName = (simplified[1].indexOf(PREFIX) === 0 ? simplified[1].substring(1) : simplified[1]).toLowerCase();
			if(cmdName in commands) {
				let cmd = commands[cmdName];
				if("source" in cmd) {
					sendPM(target, "Command \u00033"+cmdName+"\u000f is from plugin \u00037"+cmd.source);
				} else {
					sendPM(target, "Command \u00033"+cmdName+"\u000f is from plugin \u00037"+pluginId);
				}
			} else {
				sendPM(target, nick+": That is not a known command!");
			}
		} else {
			listCommands(nick, target, null, chan);
		}
	}), description:"[command] - Source plugin of this command", permlevel: 1, categories: ["help"]},

	"squeebot":{action: (function(simplified, nick, chan, message, pretty, target) {
		sendPM(target, "Squeebot is a plugin for nBot (by nnnn20430) written by LunaSquee.");
		if(simplified[1] && simplified[1].toLowerCase()==="source")
			sendPM(target, nick+", You can see the source here: https://github.com/LunaSquee/squeebot/tree/master/nBot");
	}), description:"[source] - Squeebot info"},
	
	"info":{action: (function(simplified, nick, chan, message, pretty, target, mentioned, pm) {
		if(pm) {
			sendPM(target, "This command can only be executed in a channel.");
		} else {
			let channel = chan.toLowerCase();
			let thisConnection = administration.data.connections[botInstanceSettings.connectionName];
			if(thisConnection[channel]) {
				if(thisConnection[channel].info)
					return sendPM(target, nick+": "+thisConnection[channel].info);
			}

			sendPM(target, "No information to display for "+chan);
		}
	}), description:"- Channel Information", categories: ["help"]},

	"events":{action: (function(simplified, nick, chan, message, pretty, target, mentioned, pm) {
		if(simplified[1] && simplified[1].toLowerCase() == "refresh")
			return synccalendar(11);

		let eventsChannelFiltered = [];

		for (let i in sEvents) {
			if (sEvents[i].channels === 'all' || sEvents[i].channels.indexOf(chan) !== -1) {
				eventsChannelFiltered.push(sEvents[i]);
			}
		}

		if (eventsChannelFiltered.length === 0)
			return sendPM(target, "\u0002Events: \u0002\u00034No events");

		var eEvents = [];
		eventsChannelFiltered.forEach(function(t) {
			var isRunning = currentRunCheck(t.eventStartTime, t.eventEndTime || 0);
			if(isRunning === 0)
				eEvents.push("\u00037"+t.eventName+"\u0003");
			else if(isRunning === 1)
				eEvents.push("\u00033"+t.eventName+"\u0003");
			else
				eEvents.push("\u00034"+t.eventName+"\u0003");
		});
		sendPM(target, "\u0002Events: \u000f"+eEvents.join(", "));
	}), description:"- List events", categories: ["community"]},

	"event":{action: (function(simplified, nick, chan, message, pretty, target, mentioned, pm) {
		let eventsChannelFiltered = [];

		for (let i in sEvents) {
			if (sEvents[i].channels === 'all' || sEvents[i].channels.indexOf(chan) !== -1) {
				eventsChannelFiltered.push(sEvents[i]);
			}
		}

		if(simplified[1] != null) {
			var specify = 1;
			if(simplified[1] == '-d')
				specify = 2;
			if(parseInt(simplified[specify])) {
				var valid = eventsChannelFiltered[parseInt(simplified[specify]) - 1];
				if(valid) {
					tellEvent(valid, target, specify === 1);
				} else {
					sendPM(target, nick+": No event with that id found!");
				}
			} else if(typeof simplified[specify] == "string") {
				var amount = 0;
				eventsChannelFiltered.forEach(function(t) {
					if(t.eventName.toLowerCase().indexOf(message.split(' ').slice(specify).join(' ').toLowerCase()) === 0) {
						if(amount > 0) return;
						tellEvent(t, target, specify === 1);
						amount += 1;
					}
				});
				if(amount === 0) {
					sendPM(target, nick+": No such event found!");
				}
			}
		} else {
			sendPM(target, nick+": Not enough arguments! Usage: \u0002!event\u0002 <index/name>");
		}
	}), description:"[-d] <index/name> - Event information", categories: ["community"]},
   
	"rules":{action: (function(simplified, nick, chan, message, pretty, target, mentioned, pm) {
		if(pm) {
			sendPM(target, "This command can only be executed in a channel.");
		} else {
			let channel = chan.toLowerCase();
			let thisConnection = administration.data.connections[botInstanceSettings.connectionName];
			let t = nick;
			
			if(simplified[1] && simplified[1] in bot.ircChannelUsers[chan])
				t = simplified[1];

			if(thisConnection[channel]) {
				if(thisConnection[channel].rules) {
					sendPM(channel, t+": Channel Rules of "+chan+": ");
					let rls = thisConnection[channel].rules;
					if(typeof rls == "object") {
						rls.forEach(function(e) {
							sendPM(channel, "["+(rls.indexOf(e)+1)+"] "+e);
						});
					} else {
						sendPM(channel, rls);
					}
					return;
				}
			}
			sendPM(target, "No rules to display for "+chan);
		}
	}), description:"- Channel Rules", categories: ["help", "community"]},
	
	"yay":{action: (function(simplified, nick, chan, message, pretty, target) {
		if(simplified[1] && simplified[1] in bot.ircChannelUsers[chan])
			sendPM(target, simplified[1]+": http://flutteryay.com");
		else
			sendPM(target, nick+": http://flutteryay.com");
	}), categories: ["fun"]},
	
	"date":{action: (function(simplified, nick, chan, message, pretty, target) {
		var date = ''; 
		switch (simplified[1] ? simplified[1].toUpperCase() : null) {
			case 'UTC': 
				date = new Date().toUTCString(); 
				break; 
			case 'UNIX': 
				date = Math.round(new Date().getTime() / 1000); 
				break; 
			default: 
				date = new Date().toString();
		} 
		sendPM(target, date);
	}), categories: ["util"]},

	"squee":{action: (function(simplified, nick, chan, message, pretty, target) {
		if(simplified[1] && simplified[1] in bot.ircChannelUsers[chan])
			sendPM(target, simplified[1]+": https://www.youtube.com/watch?v=O1adNgZl_3Q");
		else
			sendPM(target, nick+": https://www.youtube.com/watch?v=O1adNgZl_3Q");
	}), categories: ["fun"]},

	"timetostop":{action: (function(simplified, nick, chan, message, pretty, target) {
		if(simplified[1] && simplified[1] in bot.ircChannelUsers[chan])
			sendPM(target, simplified[1]+": https://www.youtube.com/watch?v=2k0SmqbBIpQ");
		else
			sendPM(target, nick+": https://www.youtube.com/watch?v=2k0SmqbBIpQ");
	}), categories: ["fun"]},
	
	"banned":{action: (function(simplified, nick, chan, message, pretty, target) {
		if(simplified[1] && simplified[1] in bot.ircChannelUsers[chan])
			sendPM(target, simplified[1]+": https://derpibooru.org/795478");
		else
			sendPM(target, nick+": https://derpibooru.org/795478");
	}), categories: ["fun"]},

	"hug":{action: (function(simplified, nick, chan, message, pretty, target) {
		sendPMact(target, "hugs "+nick);
	}), categories: ["fun"]},

	"randomhash":{action: (function(simplified, nick, chan, message, pretty, target) {
		let nump = simplified[1] || 16;
		
		if(typeof(nump) != "number") {
			nump = parseInt(nump);

			if(isNaN(nump))
				return sendPM(target, nick+": I am not aware of '"+simplified[1]+"' being an integer, sorry.");
		}

		if(nump > 126)
			return sendPM(target, nick+": Requested hash is too long.");

		sendPM(target, uid(nump, true));
	}), categories: ["util"]},
	
	"episodes":{action: (function(simplified, nick, chan, message, pretty, target) {
		if(simplified[1] && simplified[1] in bot.ircChannelUsers[chan])
			sendPM(target, simplified[1]+": List of all MLP:FiM Episodes: http://mlp-episodes.tk/");
		else
			sendPM(target, nick+": List of all MLP:FiM Episodes: http://mlp-episodes.tk/");
	}),description:"- List of pony episodes", categories: ["mlp-episodes"]},
	
	"mc":{action: (function(simplified, nick, chan, message, pretty, target) {
		//return sendPM(target, "\u000310[Minecraft] \u00034No servers.");

		var reqplayers = false;

		if(simplified[1] === "players") {
			reqplayers = true;
		}

		getGameInfo("minecraftping", "192.168.8.137", function(err, msg) {
			if(err) { 
				sendPM(target, err);
				return;
			}
			sendPM(target, msg);
		}, reqplayers);
	}), alias:"minecraft", categories: ["community", "server"]},
	
	"mumble":{action: (function(simplified, nick, chan, message, pretty, target) {
		var requsers = false;

		if(simplified[1] === "users") {
			requsers = true;
		}
		
		if(simplified[1] === "download") {
			sendPM(target, "\u000310[Mumble] \u00033Download Mumble here: \u000312http://wiki.mumble.info/wiki/Main_Page#Download_Mumble");
			return;
		}
		
		getGameInfo("mumbleping", "mumble.djazz.se", function(err, msg) {
			if(err) {
				sendPM(target, err);
				return;
			}
			sendPM(target, msg);
		}, requsers);
	}), description:"[users/download] - Information about our Mumble Server", categories: ["community", "server"]},
		
	"episode":{action: (function(simplified, nick, chan, message, pretty, target) {
		var param = simplified[1]; 
		if(param != null) { 
			var epis = param.match(/^s([0-9]+)e([0-9]+)$/i); 
			if(epis && epis[2]<=26 && epis[1]<=6){ 
				var link = "http://mlp-episodes.tk/#epi"+epis[2]+"s"+epis[1]; 
				sendPM(target, nick+": Watch the episode you requested here: "+link); 
			} else { 
				sendPM(target, nick+": Correct usage !ep s[season number]e[episode number]");
			}
		} else {
			sendPM(target, nick+": Please provide me with episode number and season, for example: !ep s4e4");
		}
	}),description:"s<Season>e<Episode Number> - Open a pony episode", categories: ["mlp-episodes"]},

	"ping":{action: (function(simplified, nick, chan, message, pretty, target) {
		simplified = message.split(' ');
		if (!simplified[1] || !simplified[2])
			return sendPM(target, "pong");

		const host = simplified[1];
		const port = parseInt(simplified[2]);

		if (isNaN(port))
			return sendPM(target, nick+": Port needs to be an integer value.");

		pingTcpServer(simplified[1], simplified[2], function(status, info) {
			var statusString = "\u00034closed\u000f";
			
			if (status)
				statusString = "\u00033open\u000f";

			sendPM(target, "Port "+simplified[2]+" on "+simplified[1]+" is "+statusString+" ("+
				(bot.isNumeric(info) ? info + "ms" : info) + ")");
		})
	}),description:"<host> <port> - Check if port is open on host", categories: ["utils"]},

	"nextep":{action: (function(simplified, nick, chan, message, pretty, target) {
		var counter = 0;
		var now = Date.now();
		var timeLeft;
		do {
			timeLeft = Math.max(((airDate+week*(counter++)) - now)/1000, 0);
		} while (timeLeft === 0 && counter < settings.nextepisode.countTimes);
		if (counter === settings.nextepisode.countTimes) {
			sendPM(target, "Season "+settings.nextepisode.inSeason+" is over :(");
		} else {
			sendPM(target, /*(counter == 1 ? "First" : "Next") + */"Next Season "+settings.nextepisode.inSeason+" episode airs in %s", readableTime(timeLeft, true));
		}
		//commands["event"].action(["event", "episode"], nick, chan, message, pretty, target);
	}), description:"- Time left until next pony episode.", categories: ["mlp-episodes"]},

	"nothing":{description:"- Does absolutely nothing.", categories: ["fun"]},
	
	"me":{action:(function(simplified, nick, chan, message, pretty, target) {
		sendPM(target, nick+": I am me, you are "+nick+".");
	}), description:"- How do I help you?", categories: ["fun"]},

	"alpaca":{action: function(simplified, nick, chan, message, pretty, target) {
		if(simplified[1] && simplified[1] in bot.ircChannelUsers[chan])
			nick = simplified[1];

		var rand = Math.floor(Math.random() * alpaca.length);
		sendPM(target, nick+": http://jocketf.se/c/"+alpaca[rand]);
	}, alias: 'alpacas', categories: ["fun"]},

	"plugin":{action: (function(simplified, nick, chan, message, pretty, target, isMentioned, isPM) {
		if(simplified[1] == "load") {
			bot.pluginLoad(simplified[2], botInstanceSettings.pluginDir+'/'+simplified[2]+'.js');
			botInstanceSettings.plugins.add(simplified[2]);
		} else if(simplified[1] == "reload") {
			if (bot.plugins[simplified[2]]) {
				pluginReload(simplified[2]);
			}
		} else if(simplified[1] == "reloadall") {
			pluginReload(pluginId); 
			for (var plugin in bot.plugins) {
				if (plugin != pluginId && plugin != 'simpleMsg') {
					pluginReload(plugin);
				}
			}
		} else if(simplified[1] == "unload" || simplified[1] == "remove") {
			bot.pluginDisable(simplified[2]);
			botInstanceSettings.plugins.remove(simplified[2]);
		}
	}), description:"<load/reload/reloadall/unload> [plugin] - Plugin management", permlevel:3, categories: ["admin"]},

	"binary":{action: (function(simplified, nick, chan, message, data, target, isMentioned, isPM) {
		var response = '', strArr, i, msg = message.split(' ').slice(2).join(' ');

		try {
			switch (simplified[1] ? simplified[1].toUpperCase() : null) {
				case 'ENCODE': 
					strArr = msg.split('');
					
					for (i in strArr) {
						response += ' '+('0000000'+parseInt(new Buffer(strArr[i].toString(), 'utf8').toString('hex'), 16).toString(2)).slice(-8);
					}
					
					response = response.substr(1);
					
					break;
				case 'DECODE': 
					msg = msg.split(' ').join('');
					i = 0;
					
					while (8*(i+1) <= msg.length) {
						response += new Buffer(parseInt(msg.substr(8*i, 8), 2).toString(16), 'hex').toString('utf8'); i++;
					}
					
					response = "Decoded: "+response;
			}
		} catch(e) {
			return sendPM(target, "Operation failed.");
		}
		sendPM(target, response);
	}), description: "<ENCODE/DECODE> <message> - Encode/decode binary (ASCII only)", categories: ["util"]},

	"hexstr":{action: (function(simplified, nick, chan, message, data, target, isMentioned, isPM) {
		var response = '', i, msg = message.split(' ').slice(2).join(' ');

		try{
			switch(simplified[1] ? simplified[1].toUpperCase() : null) {
				case "DECODE":
					msg = msg.replace(/\s/g, '');

					for (i = 0; i < msg.length; i += 2) 
						response += String.fromCharCode(parseInt(msg.substr(i, 2), 16));

					response = "Decoded: "+response;
					break;
				case "ENCODE":
					for (i = 0; i < msg.length; i++)
						response += msg.charCodeAt(i).toString(16)+" ";
					break;
			}
		} catch(e) {
			return sendPM(target, "Operation failed.");
		}
		
		sendPM(target, response);
	}), description: "<ENCODE/DECODE> <string> - Encode/decode hexadecimal (ASCII only)", categories: ["util"]},

	"base64":{action: (function(simplified, nick, chan, message, data, target, isMentioned, isPM) {
		var response = '', i, msg = message.split(' ').slice(2).join(' ');

		try{
			switch(simplified[1] ? simplified[1].toUpperCase() : null) {
				case "DECODE":
					response = "Decoded: "+(new Buffer(msg, 'base64').toString('ascii'));
					break;
				case "ENCODE":
					response = new Buffer(msg).toString('base64');
					break;
			}
		} catch(e) {
			return sendPM(target, "Operation failed.");
		}
		
		sendPM(target, response);
	}), description: "<ENCODE/DECODE> <string> - Encode/decode base64 (ASCII only)", categories: ["util"]},

	"googl":{action: (function(simplified, nick, chan, message, pretty, target, isMentioned, isPM) {
		if (settings.googleapikey == null) return;
		let url = null;
		let msg = message.split(' ').slice(1).join(' ');

		if(!simplified[1])
			return sendPM(target, nick+": Please provide an URL!");

		if(!msg.match(urlRegex))
			return sendPM(target, nick+": Please provide a valid URL!");
		else
			url = msg;

		HTTPPost("https://www.googleapis.com/urlshortener/v1/url?key="+settings.googleapikey, {longUrl: url}, (err, dat) => {
			if(err || dat.error) return sendPM(target, nick+": An error occured!");
			sendPM(target, nick+": "+dat.id);
		}, {"Content-Type": "application/json"}, true);
	}), description:"<url> - Shorten URLs. (goo.gl)", categories: ["util", "url"]},

	"isgd":{action: (function(simplified, nick, chan, message, pretty, target, isMentioned, isPM) {
		let url = null;
		let msg = message.split(' ').slice(1).join(' ');

		if(!simplified[1])
			return sendPM(target, nick+": Please provide an URL!");

		if(!msg.match(urlRegex))
			return sendPM(target, nick+": Please provide a valid URL!");
		else
			url = encodeURIComponent(msg);

		fetchJSON("https://is.gd/create.php?format=json&url="+url, (err, dat) => {
			if(err) return sendPM(target, nick+": An error occured!");
			if(dat.errormessage) return sendPM(target, nick+": "+dat.errormessage);

			sendPM(target, nick+": "+dat.shorturl);
		});
	}), description:"<url> - Shorten URLs. (is.gd)", categories: ["util", "url"]},

	"evaljs":{action: (function(simplified, nick, chan, message, pretty, target, isMentioned, isPM) {
		eval("(function () {"+message.split(" ").slice(1).join(" ")+"})")();
	}), description:"<code> - Run javascript code.", "permlevel":10, categories: ["admin"]},

	"echo":{action: (function(simplified, nick, chan, message, pretty, target, isMentioned, isPM) {
		sendPM(target, bot.strReplaceEscapeSequences(pretty.messageARGS[1]));
	}), description:"<msg> - Echo back.", "permlevel":2, categories: ["admin"]},

	"convertseconds":{action: (function(simplified, nick, chan, message, pretty, target, isMentioned, isPM) {
		if(parseInt(simplified[1]))
			sendPM(target, readableTime(parseInt(simplified[1]), true));
		else
			sendPM(target, "Invalid number");
	}), description:"<seconds> - Convert seconds to years days hours minutes seconds.", categories: ["util"]},

	"converttime":{action: (function(simplified, nick, chan, message, pretty, target, isMentioned, isPM) {
		if(simplified[1] != null)
			sendPM(target, parseTimeToSeconds(message.substring(PREFIX.length+11-(isPM ? 0 : 1))) + " seconds");
		else
			sendPM(target, "Invalid string");
	}), description:"<years>y <weeks>w <days>d <hours>h <minutes>m <seconds>s - Convert ywdhms to seconds.", categories: ["util"]},

	"reconverttime":{action: (function(simplified, nick, chan, message, pretty, target, isMentioned, isPM) {
		if(simplified[1] != null) {
			let seconds = parseTimeToSeconds(message.substring(PREFIX.length+11-(isPM ? 0 : 1)))
			if (!seconds) return;
			sendPM(target,  readableTime(seconds, true));
		} else {
			sendPM(target, "Invalid string");
		}
	}), categories: ["util"]},

	"say":{action: (function(simplified, nick, chan, message, pretty, target, isMentioned, isPM) {
		var channel = pretty.messageARGS[1];
		if(channel != null)
			sendPM(channel, bot.strReplaceEscapeSequences(message.split(" ").slice(2).join(" ")));
	}), description:"<channel> <msg> - Say in channel as bot.", "permlevel":2, categories: ["admin"]},

	"act":{action: (function(simplified, nick, chan, message, pretty, target, isMentioned, isPM) {
		var channel = pretty.messageARGS[1];
		if(channel != null)
			sendPMact(channel, bot.strReplaceEscapeSequences(message.split(" ").slice(2).join(" ")));
	}), description:"<channel> <msg> - Act in channel as bot.", "permlevel":2, categories: ["admin"]},

	"permlevel":{action: (function(simplified, nick, chan, message, pretty, target, isMentioned, isPM) {
		let targ = simplified[1] != null ? simplified[1] : nick;

		administration.fetchPermission(chan, targ).then(function(p) {
			sendPM(target, nick+": "+targ+" is a "+permstring(p.level));
		}, function() {
			if(targ == nick)
				sendPM(target, nick+": You have no special privilege in this channel.");
			else
				sendPM(target, nick+": "+targ+" has no special privilege in this channel.");
		});
	}), categories: ["help"]},

	"sh":{action: (function(simplified, nick, chan, message, pretty, target, isMentioned, isPM) {
		if(settings.allowShell === false) {
			sendPM(target, "Using shell is disabled.");
			return;
		}
		if(!simplified[1]) return;

		var extpos = isPM ? 3 : PREFIX.length+3;
		var stripnl = true;

		if(simplified[1] == '-n') {
			extpos += 3;
			stripnl = false;
		}

		var command = message.substring(extpos);
		exec(command, {shell: '/bin/bash'}, function(error, stdout, stderr) {
			if(stdout) {
				if(stripnl)
					stdout = stdout.replace(/\n/g, " ;; ");
				sendPM(target, stdout);
			} else {
				mylog(error);
			}
		});

	}), description:"<command> - icypi shell command.", "permlevel":10, categories: ["admin"]},

	"icypi":{action: (function(simplified, nick, chan, message, pretty, target, isMentioned, isPM) {
		if(settings.allowShell === false) {
			sendPM(target, "Using shell is disabled.");
			return;
		}
		exec("cat /sys/class/thermal/thermal_zone0/temp", {shell: '/bin/bash'}, function(error1, stdout1, stderr1) {
			if(stdout1) {
				exec("uptime", {shell: '/bin/bash'}, function(error, stdout, stderr) {
					if(stdout) {
						var loadavg = stdout.match(/load average: (\d\.\d+), (\d\.\d+), (\d\.\d+)/).slice(1);
						var t = stdout.match(/up (.+),? \d+ users?/).slice(1);
						var uptime = t[t.length-1].substring(0, t[t.length-1].length-2);
						loadavg = loadstat(loadavg);
						sendPM(target, "\u000310[icypi]\u000f \u00033uptime:\u000312 "+uptime+" \u000f\u00033load avg:\u000f"+loadavg+" \u00033temp:\u000312 "+(parseInt(stdout1)/1000)+"°C");
					} else {
						mylog(error);
					}
				});
			} else {
				mylog(error1);
			}
		});
	}), description:"- icypi status report.", categories: ["help"]},

	"randomsentence":{action: (function(simplified, nick, chan, message, pretty, target, isMentioned, isPM) {
		HTTPPost("http://watchout4snakes.com/wo4snakes/Random/NewRandomSentence", {}, 
			function(e, c, p) { 
				sendPM(target, c);
			});
	}), description:"- Generate a random sentence.", categories: ["fun"]},

	"randomword":{action: (function(simplified, nick, chan, message, pretty, target, isMentioned, isPM) {
		HTTPPost("http://watchout4snakes.com/wo4snakes/Random/RandomWord", {}, 
			function(e, c, p) { 
				sendPM(target, c);
			});
	}), description:"- Get a random word.", categories: ["fun"]},

	"aliases": {action: (function(simplified, nick, chan, message, pretty, target, isMentioned, isPM) {
		if(!simplified[1]) {
			sendPM(target, nick+": Please specify command.");
			return;
		}

		let command = null;
		let tester = commandBasedOnChannel(simplified[1], chan);
		if (tester) {
			command = tester.command;
		}

		if(!command) {
			sendPM(target, nick+": That is not a valid command!");
			return;
		}

		var aliases = [];
		for(var c in commands) {
			var cmd = commands[c];
			if(cmd.alias && cmd.alias == command.toLowerCase()) {
				aliases.push("\u00033"+c.replace(/\#[\w\d_\-\[\]]+$/i, '')+"\u0003");
			}
			if(c == command.toLowerCase() && "alias" in cmd) {
				aliases.push("\u00033"+cmd.alias.replace(/\#[\w\d_\-\[\]]+$/i, '')+"\u0003");
			}
		}

		if(aliases.length === 0) {
			sendPM(target, nick+": That command has no aliases.");
			return;
		}

		sendPM(target, "Aliases for \u00033"+simplified[1].toLowerCase()+"\u0003: "+aliases.join(", "));
	}), description:"<command> - Find aliases for this command.", categories: ["help"]},

	"responselist": {action:(function(simplified, nick, chan, message, pretty, target, isMentioned, isPM) {
		if(simplified[1] == null)
			return sendPM(target, "Currently using response list "+responses+" with "+responselist.length+" instances.");
		if(simplified[1] == 'load')
			return response_list_load(simplified[2]);
		if(simplified[1] == 'save')
			return response_list_save();
	}), permlevel: 3, categories: ["admin"]},

	"youtube": {action:(function(simplified, nick, chan, message, pretty, target, isMentioned, isPM) {
		let betr = message.split(' ');
		let vid = betr[1];
		if(!vid)
			return sendPM(target, nick+": Please provide a video url or ID!");
		if(vid.indexOf("youtube.com/") != -1)
			vid = vid.match("[\\?&]v=([^&#]*)");
		else if(vid.indexOf("youtu.be/") != -1)
			vid = vid.match(/youtu.be\/([^\?\&\#]+)/i)[1];
		if(!vid)
			return sendPM(target, nick+": Please provide a valid video url or ID!");
		
		getYoutubeFromVideo(vid, target);
	}),  description:"<link/id> - YouTube video information.", categories: ["help"]},

	"admin": {action:(function(simplified, nick, chan, message, pretty, target, isMentioned, isPM) {
		if(!simplified[1]) return;
		switch(simplified[1].toLowerCase()) {
			case "load":
				administration.loadFile(target);
				break;
			case "save":
				administration.saveFile(target);
				break;
		}
	}), permlevel: 3, categories: ["admin"]},

	"tz": {action:(function(simplified, nick, chan, message, pretty, target, isMentioned, isPM) {
		if(!simplified[1]) 
			return sendPM(target, nick+": Specify time zone");
		
		let tzn = simplified[1].toUpperCase();

		if (!timezones[tzn])
			return sendPM(target, nick+": That time zone abbreviation is not in our list.");

		sendPM(target, offsetTZStr(timezones[tzn], tzn));
	}), description: "<abbrv> - Datetime in certain time zone (abbreviations only)", categories: ["util"]},

	"minecraft":{action: (function() {commands.mc.action.apply(null, arguments);}), description: "[players] - Information about our Minecraft Server"},
	"ep":{action: (function() {commands.episode.action.apply(null, arguments);}), alias: "episode"},
	"yt":{action: (function() {commands.youtube.action.apply(null, arguments);}), alias: "youtube"},
	"alpacas":{action: (function() {commands.alpaca.action.apply(null, arguments);})}
};

// List of all urls that will be handled.
let urls = {
	"youtube.com/": {action: (function(link, simplified, nick, chan, message, pretty, target) {
		let det = link.match("[\\?&]v=([^&#]*)");
		if(det) {
			getYoutubeFromVideo(det[1], target);
			return true;
		}
		return false;
	})},
	"youtu.be/": {action: (function(link, simplified, nick, chan, message, pretty, target) {
		let det = link.match(/youtu.be\/([^\?\&\#]+)/i)[1];
		if(det) {
			getYoutubeFromVideo(det, target);
			return true;
		}
		return false;
	})},
	"soundcloud.com/": {action: (function(link, simplified, nick, chan, message, pretty, target) {
		getSoundcloudFromUrl(link, target);
		return true;
	})},
	"dailymotion.com/video/": {action: (function(link, simplified, nick, chan, message, pretty, target) {
		let det = link.match("/video/([^&#]*)")[1];
		if(det) {
			dailymotion(det, target);
			return true;
		}
		return false;
	})},
	"derpiboo": {action: (function(link, simplified, nick, chan, message, pretty, target) {
		let det = link.match(/derpiboo\.?ru(\.org)?\/(images\/)?(\d+[^#?&])/i);
		if(det && det[3] != null) {
			let numbere = parseInt(det[3]);
			if(numbere) {
				derpibooru_handle(numbere, target, nick);
				return true;
			}
		}
		return false;
	})},
	"derpicdn": {action: (function(link, simplified, nick, chan, message, pretty, target) {
		let det = link.match(/derpicdn\.net\/img\/?(view)?\/\d+\/\d+\/\d+\/(\d[^_\/?#]+)/i);
		if(det && det[2] != null) {
			let numbere = parseInt(det[2]);
			if(numbere) {
				derpibooru_handle(numbere, target, nick);
				return true;
			}
		}
		return false;
	})},
	"twitter.com/": {action: (function(link, simplified, nick, chan, message, pretty, target) {
		let det = link.match(/twitter.com\/\w+\/status\/(\d+[^&#?\s\/])/i);
		if(det) {
			if("tweety" in bot.plugins) {
				bot.plugins.tweety.plugin.sendTweetResponse(det[1], target, 0);
				return true;
			}
		}
		return false;
	})},
	"twitch.tv/": {action: (function(link, simplified, nick, chan, message, pretty, target) {
		let det = link.match(/twitch\.tv\/([\w_-]+)\/?(\d+)?/i);
		if(det && det[1]) {
			if("twitch" in bot.plugins) {
				let at = det[1]
				if (at === 'videos' && det[2]) {
					bot.plugins.twitch.plugin.twitchVideo(det[2], target, false);
				} else {
					bot.plugins.twitch.plugin.twitchStreamer(at, target, false);
				}
				return true;
			}
		}
		return false;
	})},
	"spotify.com/track/": {action: (function(link, simplified, nick, chan, message, pretty, target) {
		let det = link.match("/track/([^&#]*)")[1];
		if(det) {
			getSpotifySongFromID(det, target);
			return true;
		}
		return false;
	})},
	"vid.me/": {action: (function(link, simplified, nick, chan, message, pretty, target) {
		let det = link.match(/vid\.me\/([\w]+)/i);
		if(det && det[1]) {
			getVidMeFromURL(link, target);
			return true;
		}
		return false;
	})},
	"default": {action: (function(link, simplified, nick, chan, message, pretty, target) {
		// If no other url matches, this will be run
		getTitleOfPage(link, function(title) {
			if(!title) return;
			if(title == link) return;

			if(title.length > 120)
				title = title.substring(0, 120)+"...";

			sendPM(target, "\u00036[\u0003 "+title+" \u00036]\u0003");
		});
	})}
};

// PRIVMSG functions such as CTCP handling
let privmsgFunc = {
	ctcpRespond:function(data) {
		let timestamp;
		if (new RegExp('\x01VERSION\x01', 'g').exec(data.message) !== null) {
			bot.ircSendCommandNOTICE("\x01VERSION I'm a plugin for nBot written by LunaSquee.\x01", data.nick);
		} else if (new RegExp('\x01CLIENTINFO\x01', 'g').exec(data.message) !== null) {
			bot.ircSendCommandNOTICE("\x01CLIENTINFO VERSION TIME LOCATION PING CLIENTINFO USERINFO SOURCE\x01", data.nick);
		} else if (new RegExp('\x01USERINFO\x01', 'g').exec(data.message) !== null) {
			bot.ircSendCommandNOTICE("\x01USERINFO Squeebot\x01", data.nick);
		} else if (new RegExp('\x01SOURCE\x01', 'g').exec(data.message) !== null) {
			bot.ircSendCommandNOTICE("\x01SOURCE http://gist.github.com/LunaSquee/95e849c9d44a4874501f\x01", data.nick);
		} else if (new RegExp('\x01TIME\x01', 'g').exec(data.message) !== null) {
			bot.ircSendCommandNOTICE("\x01TIME "+new Date()+"\x01", data.nick);
		} else if (new RegExp('\x01LOCATION\x01', 'g').exec(data.message) !== null) {
			bot.ircSendCommandNOTICE("\x01LOCATION [Intra532] <wEMUlator worlds/*> Equestria\x01", data.nick);
		} else if ((timestamp = new RegExp('\x01PING ([^\x01]*)\x01', 'g').exec(data.message)) !== null) {
			bot.ircSendCommandNOTICE("\x01PING "+timestamp[1]+"\x01", data.nick);
		}
	},
};

// Fetch a google calendar
function fetchCalendar(calendar) {
	if (settings.googleapikey == null) return;
	if (calendar == null)
		return mylog("Calendar not found.");

	const customDescription = calendar.forceEventDescription;
	const timeFrame = calendar.timeframe;
	const c_url = calendar.url;
	const channels = calendar.channels;

	let now = Date.now();
	let url = "https://www.googleapis.com/calendar/v3/calendars/"+encodeURIComponent(c_url)+"/events?key="+settings.googleapikey+
			  "&timeMin="+new Date(now-10*60*1000).toISOString()+
			  "&timeMax="+new Date(now+timeFrame).toISOString()+"&singleEvents=true";

	fetchJSON(url, function(err, def) {
		if(err) {
			mylog("Calendar events failed to fetch:");
			console.log(err);
			return;
		}
		now = Date.now();
		for (let i = 0; i < def.items.length; i++) {
			let item = prettifyEvent(def.items[i]);
			if(customDescription != null) {
				item.description = customDescription;
			}

			if(now < item.end.getTime()) {
				sEvents.push(
				{
					calendar: calendar.name,
					eventName: item.title, 
					eventStartTime: new Date(item.start)/1000, 
					eventEndTime: new Date(item.end)/1000, 
					description: item.description || "",
					channels: channels
				});
			}
		}
		sEvents.sort(sortStartTime);
	});
}

// Sync calendars
function synccalendar(no) {
	if((calSyncInterval === false && no == null) || settings.calendars === undefined)
		return;

	sEvents = [];
	for(let e in settings.calendars) {
		let calendar = settings.calendars[e];

		fetchCalendar(calendar);
	}

	if(no == null)
		setTimeout(synccalendar, 300000);
}

// Kill all relay connections and close the server
function destroyIrcRelay() {
	if(relayserver == null) return;
	for(var con in relayConnections) {
		var t = relayConnections[con];
		t.end();
		t.destroy();
	}
	relayserver.close();
}

/*
	===============
	Misc. Utilities
	===============
*/
// Check if nick is op on channel
function isOpOnChannel(user, channel) {
	var isUserChanOp = false;
	var ircChannelUsers = bot.ircChannelUsers;
	if (ircChannelUsers[channel] && ircChannelUsers[channel][user] && ircChannelUsers[channel][user].mode) {
		if (ircChannelUsers[channel][user].mode.replace(/^(o|q|h|a)$/, "isOp").indexOf("isOp") != -1 ) { isUserChanOp = true; }
	}
	return isUserChanOp;
}

function commandBasedOnChannel(string, chan) {
	let cmdin = null
	let command = ''

	if (commands[string] != null) {
		cmdin = commands[string]
		command = string
	} else if (commands[string + chan] != null) {
		cmdin = commands[string + chan]
		command = string + chan
	}

	if (!cmdin) return null;

	return {
		obj: cmdin,
		command: command,
		prettyPrint: command.replace(/\#[\w\d_\-\[\]]+$/i, '')
	}
}

// String representation of a permission level
function permstring(level, color) {
	var str = "";
	switch(level) {
		case 1:
			str = "Helper";
			break;
		case 2:
			str = "Moderator";
			break;
		case 3:
			str = "Admin";
			break;
		case 10:
			str = "SuperUser";
			break;
		default:
			str = "User";
			break;
	}
	return str;
}

// Calculate someones age based on birthdate
function calculateAge(birthday) {
	var ageDifMs = Date.now() - birthday.getTime();
	var ageDate = new Date(ageDifMs); // miliseconds from epoch
	return Math.abs(ageDate.getUTCFullYear() - 1970);
}

// Generate a random int betweem two ints
function getRandomInt(min, max) {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Generate random string of characters
function uid(len, full) {
	var buf = [],
		chars = (full == null ? 'abcdefghijklmnopqrstuvwxyz' : 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'),
		charlen = chars.length;

	for (var i = 0; i < len; ++i) {
		buf.push(chars[getRandomInt(0, charlen - 1)]);
	}

	return buf.join('');
}

// Reload a plugin
function pluginReload(plugin) {
	bot.pluginDisable(plugin);
	bot.pluginLoad(plugin, botInstanceSettings.pluginDir+'/'+plugin+'.js');
} 

// Sort events by start time
function sortStartTime(a, b) {
	return a.eventStartTime - b.eventEndTime;
}

// Prettify an event object and keep out the unnecessary data
function prettifyEvent(item) {
	var ev = {
		id: item.id,
		htmlLink: item.htmlLink,
		created: new Date(item.created),
		updated: new Date(item.updated),

		title: item.summary,
		location: item.location,
		description: item.description,

		start: new Date(item.start.dateTime || item.start.date),
		end: new Date(item.end.dateTime || item.end.date),
		sequence: item.sequence
	};
	ev.length = (ev.end.getTime()-ev.start.getTime())/1000;
	return ev;
}

// Color load averages from uptime shell command
function loadstat(loads) {
	var result = [];
	for(var i = 0; i<loads.length;i++) {
		var load = loads[i];
		if(parseFloat(load) < 0.75)
			result.push("\u000312 "+load+"\u000f");
		else if(parseFloat(load) < 1)
			result.push("\u00037 "+load+"\u000f");
		else if(parseFloat(load) >= 1)
			result.push("\u00035 "+load+"\u000f");
	}
	return result.join(',');
}

function parseForMinecraft(message) {
	message = message.replace(/\x0310/g, '§3').replace(/\x0311/g, '§b').replace(/\x0312/g, '§9').replace(/\x0313/g, '§d').replace(/\x0314/g, '§8').replace(/\x0315/g, '§7')
	.replace(/\x030/g, '§f').replace(/\x031/g, '§0').replace(/\x032/g, '§1').replace(/\x033/g, '§2').replace(/\x034/g, '§c').replace(/\x035/g, '§4').replace(/\x036/g, '§5')
	.replace(/\x037/g, '§6').replace(/\x031/g, '§e').replace(/\x039/g, '§a').replace(/\x02/g, '§l').replace(/\x0f/g, '§r').replace(/\x1F/g, '§n');
	return message.replace(/\x03/g, '§r');
}

function parseMinecraftForIRC(message) {
	return message.replace(/\§./g, '');
}

// Strip IRC color codes from string
function stripColors(str) {
	return str.replace(/(\x03\d{0,2}(,\d{0,2})?)/g, '');
}

// Strip IRC style codes from string
function stripStyle(str) {
	return str.replace(/[\x0F\x02\x16\x1F]/g, '');
}

// Strip IRC formatting from string
function stripColorsAndStyle(str) {
	return stripColors(stripStyle(str));
}

// Seconds into HH:MM:SS
function toHHMMSS(numbr) {
	var sec_num = parseInt(numbr, 10); // don't forget the second param
	var hours   = Math.floor(sec_num / 3600);
	var minutes = Math.floor((sec_num - (hours * 3600)) / 60);
	var seconds = sec_num - (hours * 3600) - (minutes * 60);

	if (hours   < 10) {hours   = "0"+hours;}
	if (minutes < 10) {minutes = "0"+minutes;}
	if (seconds < 10) {seconds = "0"+seconds;}
	var time = '';
	if(parseInt(hours) > 0)
		time = hours+':'+minutes+':'+seconds;
	else
		time = minutes+':'+seconds;
	return time;
}

// HH:MM:SS from timestamp
function timestamp(unixTimestamp) {
	var dt = new Date(unixTimestamp * 1000);

	var hours = dt.getHours();
	var minutes = dt.getMinutes();
	var seconds = dt.getSeconds();

	// the above dt.get...() functions return a single digit
	// so I prepend the zero here when needed
	if (hours < 10) 
	 hours = '0' + hours;

	if (minutes < 10) 
	 minutes = '0' + minutes;

	if (seconds < 10) 
	 seconds = '0' + seconds;

	return hours + ":" + minutes + ":" + seconds;
}

// Add commas to numbers (e.g. 1,234,567; 2,456)
function addCommas(nStr) {
	nStr += '';
	var x = nStr.split('.');
	var x1 = x[0];
	var x2 = x.length > 1 ? '.' + x[1] : '';
	var rgx = /(\d+)(\d{3})/;
	while (rgx.test(x1)) {
		x1 = x1.replace(rgx, '$1' + ',' + '$2');
	}
	return x1 + x2;
}

// http://stackoverflow.com/a/22149575
function ytDuration(duration) {
	var a = duration.match(/\d+/g);

	if (duration.indexOf('M') >= 0 && duration.indexOf('H') == -1 && duration.indexOf('S') == -1) {
		a = [0, a[0], 0];
	}

	if (duration.indexOf('H') >= 0 && duration.indexOf('M') == -1) {
		a = [a[0], 0, a[1]];
	}
	if (duration.indexOf('H') >= 0 && duration.indexOf('M') == -1 && duration.indexOf('S') == -1) {
		a = [a[0], 0, 0];
	}

	duration = 0;

	if (a.length == 3) {
		duration = duration + parseInt(a[0]) * 3600;
		duration = duration + parseInt(a[1]) * 60;
		duration = duration + parseInt(a[2]);
	}

	if (a.length == 2) {
		duration = duration + parseInt(a[0]) * 60;
		duration = duration + parseInt(a[1]);
	}

	if (a.length == 1) {
		duration = duration + parseInt(a[0]);
	}
	return toHHMMSS(duration.toString());
}

// Add a zero in front of single-digit numbers
function zf(v) {
	if (v > 9) {
		return ""+v;
	} else {
		return "0"+v;
	}
}

// Convert seconds into years days hours minutes seconds(.milliseconds)
function readableTime(timems, ignoreMs) {
	var time = timems|0;
	var ms = ignoreMs?'':"."+zf((timems*100)%100|0);
	if (time < 60) return zf(time)+ms+"s";
	else if (time < 3600) return zf(time / 60|0)+"m "+zf(time % 60)+ms+"s";
	else if (time < 86400) return zf(time / 3600|0)+"h "+zf((time % 3600)/60|0)+"m "+zf((time % 3600)%60)+ms+"s";
	else if (time < 31536000) return (time / 86400|0)+"d "+zf((time % 86400)/3600|0)+"h "+zf((time % 3600)/60|0)+"m "+zf((time % 3600)%60)+"s";
	else return (time / 31536000|0)+"y "+zf((time % 31536000) / 86400|0)+"d "+zf((time % 86400)/3600|0)+"h "+zf((time % 3600)/60|0)+"m "+zf((time % 3600)%60)+"s";
}

// Convert a time string to seconds (e.g. "1h" -> 3600) written by nnnn20430
function parseTimeToSeconds(string) {
	var seconds = 0;
	var match;
	var secMinute = 1 * 60;
	var secHour = secMinute * 60;
	var secDay = secHour * 24;
	var secWeek = secDay * 7;
	var secYear = secDay * 365;
	
	if((match = string.match('([0-9]+)y')) !== null) {
		seconds += +match[1]*secYear;
	}
	if((match = string.match('([0-9]+)w')) !== null) {
		seconds += +match[1]*secWeek;
	}
	if((match = string.match('([0-9]+)d')) !== null) {
		seconds += +match[1]*secDay;
	}
	if((match = string.match('([0-9]+)h')) !== null) {
		seconds += +match[1]*secHour;
	}
	if((match = string.match('([0-9]+)m')) !== null) {
		seconds += +match[1]*secMinute;
	}
	if((match = string.match('([0-9]+)s')) !== null) {
		seconds += +match[1];
	}
	
	return seconds;
}
/*
	End of Misc. Utils.
*/

// List all commands that have a description set
function listCommands(nick, target, all, chan) {
	let comms = [];
	let listofem = [];
	comms.push("All "+NICK+" commands start with a "+PREFIX+" prefix.");
	comms.push("Type "+PREFIX+"help <command> for more information on that command.");
	for(let command in commands) {
		let obj = commands[command];

		if(obj.channel && (obj.channel !== chan && obj.channel !== 'global')) continue;

		command = command.replace(/\#[\w\d_\-\[\]]+$/i, '');

		if(all === 1) {
			listofem.push("\u0002\u0003"+("permlevel" in obj ? "7" : "3")+command+"\u000f");
		} else {
			if("description" in obj && !("permlevel" in obj)) {
				listofem.push("\u0002\u00033"+command+"\u000f");
			}
		}
	}
	listofem.sort()
	comms.push(listofem.join(", "));
	sendWithDelay(comms, target, 1000);
}

// Create a command response for !help [command]
function commandHelp(commandName, simplified, target, nick, aliased, chan) {
	let commandObj = null
	let tester = commandBasedOnChannel(commandName, chan)
	if (!tester) return sendPM(target, nick+": That is not a known command!");

	commandObj = tester.obj
	commandName = tester.prettyPrint

	let appendAliasCmd = null;

	if(commandObj.channel && (commandObj.channel !== chan && commandObj.channel !== 'global')) {
		return sendPM(target, nick+": That is not a known command!");
	}

	if(simplified[2] && commandObj.subcommands) {
		if(commandObj.subcommands[simplified[2].toLowerCase()]) {
			appendAliasCmd = simplified[2].toLowerCase();
			commandObj = commandObj.subcommands[appendAliasCmd];
		}
	}

	if(aliased != null) commandName = aliased;
	let stringstream = nick+": \u0002"+PREFIX+commandName+"\u000f ";

	if(appendAliasCmd)
		stringstream += "\u0002"+appendAliasCmd+"\u000f ";

	if(commandObj.subcommands)
		stringstream += "["+joinObjectKeys(commandObj.subcommands, '|')+"] ";

	if(commandObj.description)
		stringstream += commandObj.description;
	else if(!commandObj.description && commandObj.alias)
		return commandHelp(commandObj.alias, simplified, target, nick, commandName, chan);
	else
		stringstream += "- No description :(";

	if(commandObj.permlevel)
		stringstream += " \u0002["+permstring(commandObj.permlevel).toUpperCase()+"]\u000f";

	if(commandObj.alias)
		stringstream += " \u0002\u00037[ALIAS FOR \u00033"+commandObj.alias+"\u00037]\u000f";


	sendPM(target, stringstream);
}

// Send an array of messages with a delay
function sendWithDelay(messages, target, time) {
	function sendMessageDelayed(c, arri, timeout) {
		sendPM(target, arri[c]);
		c++;
		if(arri[c] != null)
			setTimeout(function() {sendMessageDelayed(c, arri, timeout);}, timeout);
	}
	sendMessageDelayed(0, messages, time || 1000);
}

// Scrape for title
function getTitleOfPage(weburl, callback) {
	fetchJSON(weburl, function(err, data, nojson) {
		if(err && !nojson) return callback(null);
		if(!data) return callback(null);
		let match = data.match(/<title>(.*)<\/title>/i);

		if(match === null || !match[1])
			return callback(null);

		callback(entities.decode(match[1]));
	});
}

// Grab JSON from an url 
function fetchJSON(link, callback, extendedHeaders, lback) {
	if(lback && lback >= 4) return callback("infinite loop!", null); // Prevent infinite loop requests
	var parsed = url.parse(link);
	var opts = {
		host: parsed.host,
		port: parsed.port,
		path: parsed.path,
		"headers":{
			"User-Agent": "Squeebot/nBot",
			"Accept": "*/*",
			"Accept-Language": "en-GB,en;q=0.5"
		}
	};

	if(extendedHeaders != null) {
		for(var ext in extendedHeaders) {
			var header = extendedHeaders[ext];
			opts.headers[ext] = header;
		}
	}
	
	var httpModule = parsed.protocol === 'https:' ? require('https') : require('http');
	httpModule.get(opts, function (res) {
		if (res.statusCode === 302 || res.statusCode === 301) {
			if(!lback)
				lback = 1;
			else
				lback += 1;

			fetchJSON.call(this, res.headers.location, callback, extendedHeaders, lback);
			return;
		}
		var data = '';
		var obj;

		res.on('data', function (chunk) {
			data += chunk;
		});

		res.on('end', function () {
			try {
				obj = JSON.parse(data);
			}
			catch (err) {
				callback(err, data, true);
				return;
			}
			callback(null, obj);
		});

	}).on('error', function (e) {
		callback(e.message);
	});
}
var getJSON = fetchJSON; // Just for the sake of making sense

// POST data to an url, expects a JSON response ("http://host:port/data", {heads: null}, function(error, data, res) {  }, {\"x-toast\": true})
function HTTPPost(link, postdata, callback, headers, jsonData) {
	var parsed = url.parse(link);
	var post_data = qs.stringify(postdata);
	
	if(jsonData)
		post_data = JSON.stringify(postdata);

	var post_options = {
		host: parsed.host,
		port: parsed.port,
		path: parsed.path,
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
			'Content-Length': Buffer.byteLength(post_data),
			'User-Agent': 'Squeebot/nBot'
		}
	};

	if(headers != null) {
		for(var ext in headers) {
			var header = headers[ext];
			post_options.headers[ext] = header;
		}
	}
	
	var httpModule = parsed.protocol === 'https:' ? require('https') : require('http');
	var post_req = httpModule.request(post_options, function(res) {
		res.setEncoding('utf8');
		var data = "";
		var obj;

		res.on('data', function (chunk) {
			data += chunk;
		});
		
		res.on('end', function() {
			try{
				obj = JSON.parse(data);
			} catch (err) {
				callback("no-json", data, res);
				return;
			}
			callback(null, obj, res);
		});
	}).on("error", function(e) {
		callback(e.message, null, e);
	});

	post_req.write(post_data);
	post_req.end();
}

// Gameserver info (This function makes me puke)
function getGameInfo(game, host, callback, additional, port) {
	let d = {
		type: game,
		host: host
	};
	if(port)
		d.port = port;
	gamedig.query(d,
		function(state) {
			switch(game) {
				case "tf2":
					if(state.error) return callback("\u000310[Team Fortress 2] \u00034Server is offline!", null);
					if(additional) {
						callback(null, "\u000310[Team Fortress 2]\u000f " + (typeof(additional) === "object" ? state[additional[0]][additional[1]] : state[additional]));
					} else {
						callback(null, "\u000310[Team Fortress 2] \u00033IP: \u000312"+host+" \u00033MOTD: \u000312\""+state.name+"\" \u00033Players: \u000312"+state.raw.numplayers+"/"+state.maxplayers);
					}
					break;
				case "minecraftping":
					if(state.error) return callback("\u000310[Minecraft] \u00034Server is offline!", null);
					if(additional!=null && additional === true) {
						if(state.players.length > 0) {
							var players = [];
							state.players.forEach(function(t) {
								players.push(t.name);
							});
							callback(null, "\u000310[Minecraft] \u00033Players:\u000f "+players.join(", "));
						} else {
							callback(null, "\u000310[Minecraft] \u00034No players");
						}
					} else {
						callback(null, "\u000310[Minecraft] \u00033IP:\u000312 lunasqu.ee \u00033MOTD: \u000312\""+parseMinecraftForIRC(state.raw.description)+"\u000f\u000312\" \u00033Players: \u000312"+state.players.length+"/"+state.maxplayers+" \u00033Version: \u000312"+state.raw.version);
					}
					break;
				case "mumbleping":
					if(state.error) return callback("\u000310[Mumble] \u00034Server is offline!", null);
					/*if(additional!=null && additional === true) {
						if(state.players.length > 0) {
							var players = [];
							// Sort, show most active first
							state.players.sort(function (u1, u2) {
								return u1.idlesecs - u2.idlesecs;
							});
							state.players.forEach(function(t) {
								var isMuted = t.mute || t.selfMute;
								var isDeaf = t.deaf || t.selfDeaf;
								var o = t.name;
								if (isMuted && isDeaf) {
									o = "\u00035"+o+"\u000f";
								} else if (isMuted) {
									o = "\u00037"+o+"\u000f";
								} else if (isDeaf) {
									o = "\u000312"+o+"\u000f";
								} else {
									o = "\u00039"+o+"\u000f";
								}
								players.push(o);
							});
							callback(null, "\u000310[Mumble] Users:\u0003 "+players.join(" "));
						} else {
							callback(null, "\u000310[Mumble] \u00034No users ");
						}
					} else {*/
						callback(null, "\u000310[Mumble] \u00033Address: \u000312"+host+" \u00033Users online: \u000312"+state.players.length);
					//}
					break;
			}
		}
	);
}

// Dailymotion information from id
function dailymotion(id, target) {
	fetchJSON("https://api.dailymotion.com/video/"+id+"?fields=id,title,owner,owner.screenname,duration,views_total", function(error, data) {
		if(error === null) {
			sendPM(target, "\u0002\u00033Dailymotion\u000f \u000312\""+data.title+"\" \u00033Views: \u000312"+addCommas(data.views_total.toString())+" \u00033Duration: \u000312"+toHHMMSS(data.duration.toString())+" \u00033By \u000312\""+data["owner.screenname"]+"\"");
		}
	});
}

// Youtube information from id
function getYoutubeFromVideo(id, target, isQueue) {
	if(settings.googleapikey == null) return;
	let g_api_base = "https://www.googleapis.com/youtube/v3/videos?id="+id+"&key="+settings.googleapikey+"&part=snippet,contentDetails,statistics,status&fields=items(id,snippet,statistics,contentDetails)";
	fetchJSON(g_api_base, function(error, content) {
		if(error != null) {
			console.log(error);
			return sendPM(target, "Unexpected error occured.");
		}

		if("items" in content) {
			if(content.items.length <= 0)
				return sendPM(target, "Video does not exist or is private.");

			let prefix = "";
			let tw = content.items[0];
			let live = false;
			let ratings = "";
			
			if(tw.statistics.likeCount)
				ratings = " \u00039▲ "+addCommas(tw.statistics.likeCount.toString())+" \u00034▼ "+addCommas(tw.statistics.dislikeCount.toString());
			
			if(isQueue)
				prefix += "\u000310\u0002[QUEUED] \u0002\u0003";

			if(tw.snippet.liveBroadcastContent == 'live') {
				live = true;
				prefix += "\u00035\u0002[LIVE] \u0002\u0003";
			}

			sendPM(target, prefix+"\u0002You\u00035Tube\u0003\u0002 \u000312\""+tw.snippet.title+"\" \u00033Views: \u000312"+
				addCommas(tw.statistics.viewCount.toString())+
				(live === true ? "" : " \u00033Duration: \u000312"+ytDuration(tw.contentDetails.duration.toString()))+
				ratings+" \u00033By \u000312\""+tw.snippet.channelTitle+"\"");
		}
	});
}

function getVidMeFromURL(urlOf, target) {
	fetchJSON("https://api.vid.me/videoByUrl/"+encodeURIComponent(urlOf), function(error, content) {
		if(error != null) {
			console.log(error);
			return sendPM(target, "Unexpected error occured.");
		}

		if (!content || content.status !== true || !content.video) {
			return sendPM(target, "Video not found.");
		}

		let prefix = "";
		let tw = content.video;

		sendPM(target, prefix+"\u00034VidMe\u0003\u0002 \u000312\""+tw.title+"\" \u00033Views: \u000312"+
				addCommas(tw.view_count.toString())+" \u00033Duration: \u000312"+toHHMMSS(tw.duration)+
				" \u00037★ "+addCommas(tw.score.toString())+"\u0003 \u00033By \u000312\""+tw.user.username+"\""+
				(tw.nsfw ? " \u00034[NSFW]" : ""));
	});
}

var DBCategoryTag = ["suggestive", "questionable", "explicit", "safe", "grimdark", "semi-grimdark", "grotesque"];

function DBTagSort(a, b) {
	let tag = a;
	if(DBCategoryTag.indexOf(tag) !== -1)
		return -1;
	tag = b;
	if(DBCategoryTag.indexOf(tag) !== -1)
		return 1;
}

function DBTagConstruct(taglist) {
	taglist = taglist.sort(DBTagSort);
	let res = [];
	let color = "\u00039";
	let t = 0;

	for(let tagindex in taglist) {
		let tag = taglist[tagindex];
		if(tag.indexOf("oc") === 0) {
			color = "\u000313";
		} else if(DBCategoryTag.indexOf(tag) !== -1) {
			color = "\u000312";
		} else if(tag == "edit" || tag.indexOf("artist:") === 0) {
			color = "\u00032";
		} else if(tag.indexOf("spoiler:") === 0) {
			color = "\u00037";
		} else {
			color = "\u00039";
		}
		res.push(color+" "+tag+"\u0003");
	}

	if(res.length > 12) {
		t = res.length - 12;
		res = res.slice(0, 12);
		res.push(" \u0002"+t+" more..");
	}

	return "\u00036[\u0003"+res.join(",")+" \u00036]\u0003";
}

// Kick on NSFW derpibooru links
function derpibooru_handle(id, target, nick) {
	let derpibooRoot = "https://derpibooru.org/";
	fetchJSON(derpibooRoot+id+".json", function(error, content) {
		if(error == null) {
			if("tags" in content) {
				let taglist = content.tags.split(", ");
				sendPM(target, "\u000312Derpibooru\u00039 >>"+id+" \u00037★ "+addCommas(content.faves.toString())+" \u00039▲ "+addCommas(content.upvotes.toString())+" \u00034▼ "+addCommas(content.downvotes.toString())+" "+DBTagConstruct(taglist));
			}
		}
	});
}

// Fetch soundscloud data
function getSoundcloudFromUrl(url, target, isQueue) {
	if(settings.soundcloudkey == null) return;
	let apibase = "https://api.soundcloud.com";
	url = apibase+"/resolve?url="+encodeURIComponent(url)+"&client_id="+settings.soundcloudkey

	fetchJSON(url, function(error, response) {
		if(error) {
			info("SoundCloud fetch Failed");
			console.log(error);
		} else {
			if(response.kind === "track") {
				sendPM(target, (isQueue ? "\u000310\u0002[QUEUED] \u0002\u0003" : "")+"\u00037SoundCloud\u000f \u000312\""+response.title+"\" \u00033▶ \u000312"+addCommas(response.playback_count.toString())+" \u00037♥ "+addCommas(response.favoritings_count.toString())+" \u00033Duration: \u000312"+toHHMMSS(Math.floor(response.duration/1000).toString())+" \u00033By \u000312\""+response.user.username+"\"");
			} else if(response.kind === "playlist") {
				sendPM(target, "\u00037SoundCloud\u000f \u000312Playlist \""+response.title+"\" \u00033Tracks: \u000312"+addCommas(response.track_count.toString())+" \u00033Duration: \u000312"+toHHMMSS(Math.floor(response.duration/1000).toString())+" \u00033By \u000312\""+response.user.username+"\"");
			}
		}
	});
}

// Separate array objects "name" by commas
function spotifyArtists(array) {
	let d = [];
	array.forEach(function(e) {
		d.push(e.name);
	});
	return d.join(", ");
}

// Fetch spotify song data
function getSpotifySongFromID(id, target) {
	if(id == null) return;
	fetchJSON("https://api.spotify.com/v1/tracks/"+id, function(error, response) {
		if(error) {
			info("Spotify fetch Failed");
			console.log(error);
		} else {
			sendPM(target, "\u00033Spotify\u000f \u000312\""+response.name+"\" \u00033Artists: \u000312"+spotifyArtists(response.artists)+" \u00033Duration: \u000312"+toHHMMSS(Math.floor(response.duration_ms/1000).toString())+(response.album != null ? " \u00033Album: \u000312\""+response.album.name+"\"" : ""));
		}
	});
}

// See if event is currently running (UTC timestamps)
// 0: not started yet, 1: running, 2: over
function currentRunCheck(startstamp, endstamp) {
	let date = new Date();
	let currentStamp = Math.floor(new Date(date.toUTCString()).getTime() / 1000);
	if(endstamp === 0) {
		if(currentStamp >= startstamp) {
			return 1;
		} else {
			return 0;
		}
	} else {
		if(currentStamp >= startstamp && currentStamp < endstamp) {
			return 1; 
		} else if (currentStamp > endstamp) {
			return 2;
		} else {
			return 0;
		}
	}
}

// eventData: {eventName: "name", eventStartTime: unix seconds (UTC), eventEndTime: unix seconds (UTC) or 0}
function tellEvent(eventData, target, countdown) {
	if(eventData != null) {
		let isRunning = currentRunCheck(eventData.eventStartTime, eventData.eventEndTime || 0);
		let timeLeft = 0;
		let date = new Date();
		let timeNow = Math.floor(new Date(date.toUTCString()).getTime() / 1000); // short dance to get current UTC timestamp
		if(isRunning === 0) {
			let timeLeftStamp = countdown ? "in "+readableTime(eventData.eventStartTime - timeNow, true) : new Date(eventData.eventStartTime*1000);
			sendPM(target, "\u0002Event: \u000f\u00037"+eventData.eventName+"\u000f\u0002 starts "+timeLeftStamp+". \u000f"+eventData.description || "");
		} else if(isRunning === 1) {
			let timeLeftStamp = countdown ? "in "+readableTime(eventData.eventEndTime - timeNow, true) : new Date(eventData.eventEndTime*1000);
			sendPM(target, "\u0002Event: \u000f\u00033"+eventData.eventName+"\u000f\u0002 ends "+timeLeftStamp+". \u000f"+eventData.description || "");
		} else {
			sendPM(target, "\u0002Event: \u000f\u00034"+eventData.eventName+"\u000f\u0002 is over :(");
		}
	}
}

// Offset timezone from UTC
function offsetTZ(offset) {
	let utc = new Date(new Date().toUTCString()).getTime();
	return utc + 3600000 * offset;
}

// Offset timezone from UTC (readable string)
function offsetTZStr(offset, tzn) {
	offset = offset >= 0 ? "+"+offset : offset;
	return new Date(offsetTZ(offset)).toUTCString()+offset+(tzn?" ("+tzn+")":"");
}

// Finds urls in string
function findUrls(text) {
	var source = (text || '').toString();
	var urlArray = [];
	var url;
	var matchArray;

	while((matchArray = urlRegex.exec(source))!== null) {
		urlArray.push(matchArray[0]);
	}
	return urlArray;
}


// Ping the server by connecting and quickly closing
function pingTcpServer(host, port, callback) {
	var isFinished = false;
	var timeA, timeB = new Date().getTime();

	function returnResults(status, info) {
		if (!isFinished) {
			callback(status, info); 
			isFinished = true;
		}
	}

	if (port > 0 && port < 65536) {
		var pingHost = net.connect({port: port, host: host}, function () {
			timeA = new Date().getTime();
			returnResults(true, timeA-timeB);
			pingHost.end();
			pingHost.destroy();
		});
		pingHost.setTimeout(5*1000);
		pingHost.on('timeout', function () {
			pingHost.end();
			pingHost.destroy();
			returnResults(false, 'timeout');
		});
		pingHost.on('error', function (e) {
			pingHost.end();
			pingHost.destroy();
			returnResults(false, e);
		});
		pingHost.on('close', function () {
			returnResults(false, 'closed');
		});
	} else {
		returnResults(false, 'error: port out of range');
	}
};

// Join the keys of an object
function joinObjectKeys(object, joinWith, prefix, suffix) {
	if(!prefix) prefix = "";
	if(!suffix) suffix = "";
	if(!joinWith) joinWith = ", ";
	let keyList = [];
	for(let key in object)
		keyList.push(prefix+key+suffix);
	return keyList.join(joinWith);
}

// Command handling of the next level.
// Yes, its a recursive subcommand handler as well, wow.
function commandDance(command, target, nick, chan, message, pretty, simplified, isMentioned, isPM) {
	if(!command) return;

	if(command.channel && (command.channel !== chan && command.channel !== 'global')) return;

	if(command.permlevel) {
		administration.fetchPermission(chan, nick).then(function(pl) {
			if(pl.level < command.permlevel)
				return sendPM(target, nick+": You do not have permission to execute this command!");

			if(command.subcommands && simplified[1]) {
				if(command.subcommands[simplified[1].toLowerCase()])
					commandDance(command.subcommands[simplified[1].toLowerCase()], target, nick, chan, message, 
						pretty, simplified.slice(1), isMentioned, isPM);

			} else if(command.action) {
				try {
					command.action(simplified, nick, chan, message, pretty, target, isMentioned, isPM);
				} catch(e) {
					mylog(e.stack);
				}
			}
		}, function(res) {
			mylog(nick+" was denied permission ("+res+")");
			sendPM(target, nick+": You do not have permission to execute this command!");
		});
	} else {
		if(command.subcommands && simplified[1]) {
			if(command.subcommands[simplified[1].toLowerCase()])
				commandDance(command.subcommands[simplified[1].toLowerCase()], target, nick, chan, message, 
					pretty, simplified.slice(1), isMentioned, isPM);

		} else if(command.action) {
			try {
				command.action(simplified, nick, chan, message, pretty, target, isMentioned, isPM);
			} catch(e) {
				mylog(e.stack);
			}
		}
		
	}
}

// Handles messages
function handleMessage(nick, chan, message, pretty, simplified, isMentioned, isPM) {
	let target = isPM ? nick : chan;
	let hirex = new RegExp("(hi|hey|hai|hello|hiya),? "+NICK, 'gim');
	let hugrex = new RegExp("\x01ACTION hugs "+NICK, 'gim');
	let spotrex = null;
	let command = (simplified[0] != null ? simplified[0] : "").toLowerCase();

	let matched = null

	if ((command.indexOf(PREFIX) == 0) || isPM) {
		let basemnd = (isPM ? (command.indexOf(PREFIX) == 0 ? command.substring(PREFIX.length) : command) : command.substring(PREFIX.length))
		let tester = commandBasedOnChannel(basemnd, chan)

		if (!tester) { 
			matched = null;
		} else {
			matched = tester.command
		}
	}

	if(matched) {
		command = commands[matched]

		if(typeof(command) != 'object') return;

		commandDance(command, target, nick, chan, message, pretty, simplified, isMentioned, isPM);
	} else if(hirex.exec(message) != null) {
		sendPMSD(target, "Hey "+nick+"!!");
	} else if(hugrex.exec(message) != null) {
		sendPMSD(target, "\x01ACTION hugs "+nick+"\x01");
	} else if((spotrex = message.match(/spotify:track:([\S]+)/i)) != null) {
		getSpotifySongFromID(spotrex[1], target);
	} else if(findUrls(message).length > 0) {
		let link = findUrls(message)[0]; // Only handle the first link provided
		let matched = false;

		for(let handle in urls) {
			if(link.indexOf(handle) != -1) {
				let handler = urls[handle]

				if (handler.channel && (handler.channel !== chan && handler.channel !== 'global')) {
					continue;
				}

				matched = handler.action(link, simplified, nick, chan, message, pretty, target, isMentioned, isPM);
				break;
			}
		}

		if(!matched && urls.default) 
			urls.default.action(link, simplified, nick, chan, message, pretty, target, isMentioned, isPM);
	} else {
		let mesgmatcher = message.toLowerCase().replace(/\:|\,|\'|\!|\?|\./g, ' ').trim().split(' ');
		for(let i in responselist) {
			let resline = responselist[i];
			let match = true;
			for(let ti in resline.tags) {
				let tag = resline.tags[ti];
				if(mesgmatcher.indexOf(tag) == -1 && match === true) {
					match = false;
					continue;
				}
			}
			let response = '';
			if(match) {
				if(resline.responses.length === 0 && resline.execCommand != null) {
					let commandargs = [resline.execCommand.c];
					for(let t in resline.execCommand.args)
						commandargs.push(resline.execCommand.args[t].replace(/\@sender/g, nick));
					commands[resline.execCommand.c].action(commandargs, nick, chan, message, pretty, target, isMentioned, isPM);
					break;
				} else if(resline.responses.length !== 0) {
					let randnum = getRandomInt(0, resline.responses.length-1);
					response = resline.responses[randnum].replace(/\@sender/g, nick);
				} else {
					continue;
				}
			} else {
				continue;
			}
			if(response !== '')
				sendPMSD(target, response);
			break;
		}
	}
}

// Relays irc messages to connected clients
function ircRelayMessageHandle(c) {
	emitter.once('newIrcMessage', function (from, to, message, type) {
		if (c.writable) {
			c.write(type+">"+from+':'+to+':'+parseForMinecraft(message)+'\r\n');
			ircRelayMessageHandle(c);
		}
	});
}

// Creates a new relay server
function ircRelayServer() {
	if (!settings.relay.enableRelay) return;

	relayserver = net.createServer(function (c) { //'connection' listener
		var pingWait = null, pingTimeout = null;

		function ping() {
			clearTimeout(pingWait);
			pingWait = setTimeout(function () {
				c.write('ping\r\n');
				pingTimeout = setTimeout(function () {
					c.destroy();
					info('\x1b[1;36mRELAY\x1b[0m: Connection timed out');
					if(c.remoteAddress in relayConnections)
						delete relayConnections[c.remoteAddress];
				}, 15*1000);
			}, 15*1000);
		}
		function pong() {
			clearTimeout(pingTimeout);
			ping();
		}
		let addr = c.remoteAddress;
		let firstData = true;
		info('\x1b[1;36mRELAY\x1b[0m: Client %s is connecting...', c.remoteAddress);
		c.setEncoding('utf8');
		c.once('end', function() {
			clearTimeout(timeout);
			info('\x1b[1;36mRELAY\x1b[0m: Client '+addr+' disconnected');
			if(addr in relayConnections)
				delete relayConnections[addr];
		});
		c.once('error', function (err) {
			clearTimeout(timeout);
			info('\x1b[1;36mRELAY\x1b[0m: Client '+addr+' errored: '+err);
			c.destroy();
			if(addr in relayConnections)
				delete relayConnections[addr];
		});
		c.once('close', function() {
			clearTimeout(timeout);
			clearTimeout(pingWait);
			clearTimeout(pingTimeout);
			info('\x1b[1;36mRELAY\x1b[0m: Client '+addr+' socket closed');
			if(addr in relayConnections)
				delete relayConnections[addr];
		});
		c.on('data', function (data) {
			if (firstData) {
				firstData = false;
				data = data.trim();
				clearTimeout(timeout);

				if (data === settings.relay.relayPassword) {
					info('\x1b[1;36mRELAY\x1b[0m: Client '+addr+' logged in');
					c.write('Password accepted\r\n');
					ircRelayMessageHandle(c);
					relayConnections[addr] = c;
					ping();
				} else {
					info('\x1b[1;36mRELAY\x1b[0m: Client '+addr+' supplied wrong password: %s', data);
					c.end("Wrong password\r\n");
				}
			} else {
				if (data.trim() === 'pong') {
					pong();
				} else if (data.trim().indexOf("msg:") === 0) {
					let da = data.trim();
					let dz = da.split(":");
					if(dz[0] === "msg" && dz.length > 2) {
						sendPM(dz[1], parseMinecraftForIRC(da.substring(dz[0].length + dz[1].length + 2)));
					} else {
						info("Malformed message from %s: ", addr);
						mylog(data.trim());
					}
				}
			}
		});
		let timeout = setTimeout(function () {
			c.end("You were too slow :I\r\n");
			info('\x1b[1;36mRELAY\x1b[0m: Client '+c.remoteAddress+' was too slow (timeout during handshake)');
		}, 10*1000);

	});
	relayserver.listen(settings.relay.relayPort, function () {
		info('\x1b[1;36mRELAY\x1b[0m: Server listening on port %d', settings.relay.relayPort);
	});
}

/* 
 * Administration system 
**/

administration.loadFile = function(channel, callback) {
	fs.readFile(squeeDir + administration.file, 'utf8', function (err, data) {
		if (err) {
			info("Administration data failed to load. Initialized a blank one.");

			administration.data = {connections: {}};
			administration.data.connections[botInstanceSettings.connectionName] = {};
			
			if(err.code === 'ENOENT')
				administration.saveFile();

			return;
		}
		
		administration.data = JSON.parse(data);
		if(!administration.data.connections[botInstanceSettings.connectionName]) {
			administration.data.connections[botInstanceSettings.connectionName] = {};
			administration.saveFile();
		}

		if (channel)
			sendPM(channel, "Administration data loaded!");
		else
			info('Administration data loaded.');
	});
};

administration.saveFile = function(channel, callback) {
	if(typeof(channel) == 'function') {
		callback = channel;
		channel = null;
	}

	fs.writeFile(squeeDir + administration.file, JSON.stringify(administration.data, null, '\t'), function (err) {
		if (err) throw err;
		
		if (channel)
			sendPM(channel, "Administration data saved!");

		if (callback !== undefined) {
			callback();
		}
	});
};

// Check if user is logged in via NickServ
administration.nickservCheck = function(nickname) {
	let thisConnection = administration.data.connections[botInstanceSettings.connectionName];
	let nscomm = thisConnection.nickserv_command || "STATUS";
	let apromise = new Promise((fulfill, reject) => {
		if(administration.nickserv_cache[nickname] != null) {
			return fulfill(nickname);
		}

		sendPM("NickServ", nscomm+" "+nickname);
		bot.ircResponseListenerAdd(pluginId, 'NOTICE', function(data) {
			if(data[0].indexOf(nscomm.toUpperCase()) != -1 && data[1][0].toUpperCase() == "NICKSERV")
				return true;
			else
				reject(nickname);
		}, function(data) {
			if (data[3][3] == '3') {
				fulfill(nickname);
				administration.nickserv_cache[nickname] = true;
			} else {
				reject(nickname);
			}
		}, 10);
	});

	return apromise;
};

administration.fetchPermission = function(channel, nickname) {
	if(!administration.data)
		return new Promise((fulfill, reject) => { reject("confused"); });

	let thisConnection = administration.data.connections[botInstanceSettings.connectionName];
	let apromise = new Promise((fulfill, reject) => {
		let checkChan = true;
		let nickMatch = null;

		// Check if nickname is superuser.
		if(thisConnection.superuser && thisConnection.superuser.nickname == nickname) {
			nickMatch = thisConnection.superuser;
			checkChan = false;
		}

		// Check if connection has a global list
		if(thisConnection.global) {
			for(let i in thisConnection.global) {
				let perm = thisConnection.global[i];
				if(perm.nickname == nickname)
					nickMatch = perm;
			}

			if(nickMatch)
				checkChan = false;
		}

		// If we're told to check channel, do that
		if(checkChan) {
			if(!thisConnection[channel])
				return reject("nochannel");

			let chan = thisConnection[channel];

			for(let i in chan.permissions) {
				let perm = chan.permissions[i];
				if(perm.nickname == nickname)
					nickMatch = perm;
			}
		}

		// If there is no nick selected, reject
		if(!nickMatch)
			return reject("nonick");

		// If we're told to check NickServ login, do that
		if(nickMatch.nickserv) {
			administration.nickservCheck(nickname).then(function() {
				fulfill(nickMatch);
			}, function() {
				reject("not authed");
			});
			return;
		}
	});

	return apromise;
};

// Save response list
function response_list_save() {
	let json_en = JSON.stringify(responselist, null, '\t');
	if(json_en) {
		fs.writeFile(squeeDir+'responselist/'+responses, json_en, function (err) {
			if (err) return;
		});
	}
}

// Load response list
function response_list_load(reslist) {
	let rtype = reslist || responses;
	let json_en = JSON.stringify(responselist, null, '\t');
	if(json_en) {
		fs.readFile(squeeDir+'responselist/'+rtype, 'utf8', function (err, data) {
			if (err) return;
			responselist = JSON.parse(data);
			responses = rtype;
			info('Loaded response list "'+responses+'" with '+responselist.length+' instances.');
		});
	}
}

// Log to console
function mylog(msg) {
	bot.log(msg);
}

// Log to console #2
function info() {
	arguments[0] = "\x1b[1;35m -*-\x1b[0m "+arguments[0];
	mylog(util.format.apply(null, arguments));
}

// Send a PM with a human-like delay
function sendPMSD(target) {
	let message = util.format.apply(null, Array.prototype.slice.call(arguments, 1));
	setTimeout((function() {sendPM(target, message);}), (Math.floor(Math.random() * 3) + 2  ) * 1000);
}

// Send a PRIVMSG
function sendPM(target) {
	let message = util.format.apply(null, Array.prototype.slice.call(arguments, 1));
	if(settings.stripColors === true)
		message = stripColorsAndStyle(message);
	if(target.indexOf("#") === 0 && emitter)
		emitter.emit('newIrcMessage', NICK, target, message, "PRIVMSG");
	bot.ircSendCommandPRIVMSG(message, target);
}

// Send a NOTICE
function sendNOTICE(target) {
	let message = util.format.apply(null, Array.prototype.slice.call(arguments, 1));
	if(settings.stripColors === true)
		message = stripColorsAndStyle(message);
	bot.ircSendCommandNOTICE(message, target);
}

// Send a PRIVMSG \x01ACTION
function sendPMact(target) {
	let message = '\u0001ACTION '+util.format.apply(null, Array.prototype.slice.call(arguments, 1))+'\u0001';
	if(settings.stripColors === true)
		message = stripColorsAndStyle(message);
	bot.ircSendCommandPRIVMSG(message, target);
}

var SettingsConstructor = function (modified) {
	var settings, attrname;
	if (this!==SettingsConstructor) {
		settings = {
			prefix: '!',
			googleapikey: null,
			soundcloudkey: null,
			stripColors: false,
			allowShell: false,
			nBotLoggerOverride: true,
			calendars: [],
			nextepisode: {
				date: [2016, 2, 26, 16, 0, 0],
				countTimes: 26,
				inSeason: 6
			},
			relay: {
				enableRelay: false,
				relayPort: 1234,
				relayPassword: ""
			}
		};
		for (attrname in modified) {settings[attrname]=modified[attrname];}
		return settings;
	}
};

// Reserved functions

// Add listeners to simpleMsg plugin
function utilizeSimpleMsg() {
	var simpleMsg = bot.plugins.simpleMsg.plugin;

	/* Unused listeners
	simpleMsg.msgListenerAdd(pluginId, 'TOPIC', function (data) {});
	simpleMsg.msgListenerAdd(pluginId, 'RPL_NAMREPLY', function (data) {});
	simpleMsg.msgListenerAdd(pluginId, 'NOTICE', function (data) {});
	simpleMsg.msgListenerAdd(pluginId, '+MODE', function (data) {});
	simpleMsg.msgListenerAdd(pluginId, '-MODE', function (data) {});
	*/

	simpleMsg.msgListenerAdd(pluginId, 'PRIVMSG', function (data) {
		for(var bft in privmsgFunc)
			privmsgFunc[bft](data);
		var simplified = data.message.replace(/\:/g, ' ').replace(/\,/g, ' ').replace(/\./g, ' ').replace(/\?/g, ' ').trim().split(' ');
		var isMentioned = simplified.indexOf(NICK) !== -1;
		if(data.to.indexOf("#") === 0) {
			handleMessage(data.nick, data.to, data.message, data, simplified, isMentioned, false);
			if(new RegExp('\x01ACTION ', 'g').exec(data.message) !== null)
				emitter.emit('newIrcMessage', data.nick, data.to, data.message.replace('\x01ACTION ', '').replace('\x01', ''), "ACTION");
			else
				emitter.emit('newIrcMessage', data.nick, data.to, data.message, "PRIVMSG");
		} else {
			handleMessage(data.nick, "", data.message, data, simplified, isMentioned, true);
		}
	});
	
	simpleMsg.msgListenerAdd(pluginId, 'NICK', function (data) {
		emitter.emit('newIrcMessage', data.nick, "", " is now known as "+data.newnick, "NICK");
		bot.log("\x1b[1;36m["+timestamp(new Date().getTime()/1000)+"]\x1b[1;35m --\x1b[0m "+data.nick+" is now known as "+data.newnick);

		if(administration.nickserv_cache[data.nick])
			delete administration.nickserv_cache[data.nick];
	});

	simpleMsg.msgListenerAdd(pluginId, 'JOIN', function (data) {
		emitter.emit('newIrcMessage', data.nick, data.channel, " has joined ", "JOIN");
		bot.log("\x1b[1;36m["+timestamp(new Date().getTime()/1000)+"]\x1b[1;32m -->\x1b[0m "+data.nick+" has joined "+data.channel);
	});
	
	simpleMsg.msgListenerAdd(pluginId, 'KICK', function (data) {
		emitter.emit('newIrcMessage', data.nick, data.channel, " was kicked by "+data.by+" ("+data.reason+")", "KICK");
		bot.log("\x1b[1;36m["+timestamp(new Date().getTime()/1000)+"]\x1b[1;31m <--\x1b[0m "+data.nick+" was kicked by "+data.by+" from "+data.channel+" ("+data.reason+")");
		
		if(administration.nickserv_cache[data.nick])
			delete administration.nickserv_cache[data.nick];
	});
	
	simpleMsg.msgListenerAdd(pluginId, 'PART', function (data) {
		emitter.emit('newIrcMessage', data.nick, data.channel, " has left ", "PART");
		bot.log("\x1b[1;36m["+timestamp(new Date().getTime()/1000)+"]\x1b[1;31m <--\x1b[0m "+data.nick+" has left "+data.channel+" "+(data.reason == null ? data.reason : ""));
		
		if(administration.nickserv_cache[data.nick])
			delete administration.nickserv_cache[data.nick];
	});
	
	simpleMsg.msgListenerAdd(pluginId, 'QUIT', function (data) {
		emitter.emit('newIrcMessage', data.nick, "", " has quit ("+data.reason+")", "QUIT");
		bot.log("\x1b[1;36m["+timestamp(new Date().getTime()/1000)+"]\x1b[1;31m <--\x1b[0m "+data.nick+" has quit ("+data.reason+")");

		if(administration.nickserv_cache[data.nick])
			delete administration.nickserv_cache[data.nick];
	});
	
	simpleMsg.msgListenerAdd(pluginId, 'RAW', function (data) {
		var nick = data[1][0];
		var args = data[3];
		if (data[2] === 'PRIVMSG' && args[1] && args[1].indexOf("\u0001ACTION ") === 0) {
			var action = args[1].substr(8);
			action = action.substring(0, action.length-1);
			emitter.emit('newIrcMessage', nick, args[0], action, "ACTION");
		}
	});

	//plugin is ready
	exports.ready = true;
	bot.emitBotEvent('botPluginReadyEvent', pluginId);
}

// Handle "botEvent" from bot (botEvent is used for irc related activity)
module.exports.botEvent = function (event) {
	if(event.eventName == "botPluginDisableEvent") {
		if(event.eventData == pluginId) {
			destroyIrcRelay(); 
			calSyncInterval = false;
		} else {
			for(var t in commands) {
				var command = commands[t];
				if("source" in command) {
					if(command.source == event.eventData) {
						mylog("\x1b[1;35m -!-\x1b[0m "+event.eventData+" Unloaded, command \""+t+"\" removed from "+pluginId+".");
						delete commands[t];
					}
				}
			}
		}
	} else if(event.eventName == "botReceivedNum005") {
		bot.ircWriteData("MODE "+botInstanceSettings.botName+" +IB");
	} else if(event.eventName == "botPluginReadyEvent") {
		if (event.eventData == 'simpleMsg') {
			utilizeSimpleMsg();
		}
	}
};

// Functions available from outside the plugin
let botCont = module.exports.plugin = {
	commandAdd: function(plugin, commandName, action, description, perlevel) {
		if(commandName in commands)
			return null;
		commands[commandName] = {source: plugin, action: action};
		if(perlevel != null)
			commands[commandName].permlevel = perlevel;
		if(description != null)
			commands[commandName].description = description;
		mylog("\x1b[1;35m -!-\x1b[0m "+plugin+" Added command \""+commandName+"\" to "+pluginId+".");
		return commands[commandName];
	},
	commandAddSubcommand: function(plugin, commandName, subCommandName, action, description, perlevel) {
		let commandStruct = commands[commandName];
		if(!commandStruct)
			return null;

		if(!commands[commandName].subcommands)
			commands[commandName].subcommands = {};

		let subCommandStruct = commands[commandName].subcommands[subCommandName] = {source: plugin, action: action};

		if(perlevel != null)
			subCommandStruct.permlevel = perlevel;
		if(description != null)
			subCommandStruct.description = description;
		return subCommandStruct;
	},
	registerCommands: function(channel, obj) {
		mylog("\x1b[1;35m -!-\x1b[0m Added "+ Object.keys(obj).length +" commands to \""+channel+"\"");

		for (let i in obj) {
			let postfix = (channel !== "global" ? channel : '')
			let cmd = obj[i];

			cmd.channel = channel;
			commands[i + postfix] = cmd;

			if (cmd.alias) cmd.alias = cmd.alias + postfix;
		}
	},
	registerURLHandles: function(channel, obj) {
		mylog("\x1b[1;35m -!-\x1b[0m Added "+ Object.keys(obj).length +" URL handles to \""+channel+"\"");

		for (let i in obj) {
			let purl = obj[i];
			purl.channel = channel;
			urls[i] = purl;
		}
	},
	mylog: mylog,
	administration: administration,
	isOpOnChannel: isOpOnChannel,
	sendPM: sendPM,
	sendPMSD: sendPMSD,
	sendNOTICE: sendNOTICE,
	fetchJSON: fetchJSON,
	HTTPPost: HTTPPost,
	readableTime: readableTime,
	parseTimeToSeconds: parseTimeToSeconds,
	getSoundcloudFromUrl: getSoundcloudFromUrl,
	getYoutubeFromVideo: getYoutubeFromVideo
};

function registerConnectionCommands() {
	botCont.settings = settings;
	let server = botInstanceSettings.connectionName
	let connectionDir = squeeDir + 'connections/'+server;
	const fs = require('fs');

	if (!fs.existsSync(connectionDir))
	    return;

	fs.readdir(connectionDir, (err, files) => {
		files.forEach(file => {
			if (!file.indexOf('.js'))
				return;

			const cmpath = path.resolve(connectionDir+'/'+file);
			const cmname = file.replace(".js", '');

			try {
				let cmdFile = require(cmpath);
				cmdFile(botCont, cmname);

				if (require.cache && require.cache[cmpath]) {
					delete require.cache[cmpath];
				}
			} catch(e) {}
		});
	})
}

module.exports.ready = false;

//main function called when plugin is loaded
module.exports.main = function (i, b) {
	// Update variables
	bot = b;
	pluginId = i;
	botInstanceSettings = bot.options;
	settings = botInstanceSettings.pluginsSettings[pluginId];
	ircChannelUsers = bot.ircChannelUsers;

	// If plugin settings are not defined, define them
	if (settings === undefined) {
		settings = new SettingsConstructor();
		botInstanceSettings.pluginsSettings[pluginId] = settings;
		bot.im.settingsSave();
	}

	NICK = botInstanceSettings.botName;
	PREFIX = settings.prefix;

	// Set up episode countdown
	let tr = settings.nextepisode;
	airDate = Date.UTC(tr.date[0], tr.date[1], tr.date[2], tr.date[3], tr.date[4], tr.date[5]); 

	// Load bot variables
	administration.loadFile();

	// Load response lists
	response_list_load(responses);

	// Create IRC Relay server
	ircRelayServer();

	calSyncInterval = true;
	synccalendar();

	bot.im.log(splash);

	// Plugin is ready
	bot.emitBotEvent('botPluginReadyEvent', pluginId);

	if(settings.nBotLoggerOverride) {
		bot.im.botLogMessageHandle = function(iId, data) {
			var connectionName = bot.im.iOpts[iId].connectionName||iId;
			bot.im.log('\x1b[1;32m['+connectionName+']\x1b[1;36m['+timestamp(new Date().getTime()/1000)+']\x1b[0m'+data);
		};

		bot.im.botEventHandle_botReceivedPRIVMSG = function(iId, data) {
			var nick = data[1][0], 
				to = data[4][0], 
				message = data[5]||data[4][1];
			var connectionName = bot.im.iOpts[iId].connectionName||iId;
			if(message.indexOf("\x01ACTION") === 0)
				bot.im.log('\x1b[1;32m['+connectionName+']\x1b[1;36m['+timestamp(new Date().getTime()/1000)+']\x1b[1;34m['+to+']\x1b[0m \x1b[1;92m* \x1b[0m'+nick+'\x1b[0m '+message.substring(8));
			else
				bot.im.log('\x1b[1;32m['+connectionName+']\x1b[1;36m['+timestamp(new Date().getTime()/1000)+']\x1b[1;34m['+to+']\x1b[0m \x1b[1;92m<\x1b[0m'+nick+'\x1b[1;92m>\x1b[0m '+message);
		};

		bot.im.botEventHandle_botReceivedNOTICE = function(iId, data) {
			var nick = data[1][0], 
				to = data[4][0], 
				message = data[5]||data[4][1];
			var connectionName = bot.im.iOpts[iId].connectionName||iId;
			bot.im.log('\x1b[1;32m['+connectionName+']\x1b[1;36m['+timestamp(new Date().getTime()/1000)+']\x1b[1;33m[NOTICE('+to+')]\x1b[0m \x1b[1;92m<\x1b[0m'+nick+'\x1b[1;32m>\x1b[0m '+message);
		};
	}
	//check and utilize dependencies
	if (bot.plugins.simpleMsg && bot.plugins.simpleMsg.ready)
		utilizeSimpleMsg();

	// Load channel-based commands
	registerConnectionCommands();
};

/**
 * Utility functions
 */
String.prototype.containsKeywordIn = function(array) {
	let found = false;
	for(let i in array) {
		let instance = array[i];
		if (this.toString().indexOf(instance) != -1) {
			found = true;
			break;
		}
	}
	return found;
};
