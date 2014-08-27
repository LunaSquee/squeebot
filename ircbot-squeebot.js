#!/usr/bin/env node
'use strict';
// IRC bot by djazz
// djazz is best <3 - LunaSquee

// Modules
//var http = require('http');
var irc = require('irc');
var colors = require('colors');
var util = require('util');
var readline = require('readline');
var youtube = require('youtube-feeds')
var request = require('request')
var loginDetails = require(__dirname+"/login-details.json");

// Config
var SERVER = 'irc.canternet.org';	// The server we want to connect to
var PORT = 6667;			// The connection port which is usually 6667
var NICK = loginDetails.username;	// The bot's nickname 
var IDENT = loginDetails.password;	// Password of the bot. Set to null to not use password login.
var REALNAME = 'LunaSquee\'s bot';	// Real name of the bot
var CHANNEL = '#BronyTalk';			// The default channel for the bot 

var airDate = Date.UTC(2013, 11-1, 23, 14, 0, 0); // Year, month-1, day, hour, minute, second (UTC)
var week = 7*24*60*60*1000;

function getCurrentSongData(callback) {
	request({
		url: "http://radio.djazz.se/icecast.php",
		json: true
	}, function (error, response, body) {
		if (!error && response.statusCode === 200) {
			if(body.title != null) {
				var theTitle = new Buffer(body.title, "utf8").toString("utf8");
				var splitUp = theTitle.replace(/\&amp;/g, "&").split(" - ");
				if(splitUp.length===2) {
					theTitle=splitUp[1]+(splitUp[0]?" by "+splitUp[0]:"");
				}
				callback(theTitle, body.listeners, true);
			} else {
				callback("Parasprite Radio is offline!", "", false);
			}
		} else {
			callback("Parasprite Radio is offline!", "", false);
		}
	});
}

function dailymotion(id, callback) {
	request({
		url: "https://api.dailymotion.com/video/"+id+"?fields=id,title,owner,owner.screenname",
		json: true
	}, function (error, response, body) {
		if (!error && response.statusCode === 200) {
			callback(body);
		} 
	});
}

function livestreamViewerCount(callback) {
	request({
		url: "http://djazz.se/live/info.php",
		json: true
	}, function (error, response, body) {
		if (!error && response.statusCode === 200) {
			var view = body.viewcount;
			if(view!=-1) {
				callback("Viewers: "+view);
			} else {
				callback("The livestream is offline.");
			}
		} 
	});
}

function findUrls(text) {
    var source = (text || '').toString();
    var urlArray = [];
    var url;
    var matchArray;
    var regexToken = /(((ftp|https?):\/\/)[\-\w@:%_\+.~#?,&\/\/=]+)|((mailto:)?[_.\w-]+@([\w][\w\-]+\.)+[a-zA-Z]{2,3})/g;

    while((matchArray = regexToken.exec(source))!== null) {
        var token = matchArray[0];
		if(token.indexOf("youtube.com/watch?v=") !== -1) {
			urlArray.push(token);
		} else if(token.indexOf("youtu.be/") !== -1) {
			urlArray.push(token);
		} else if(token.indexOf("dailymotion.com/video/") !== -1) {
			urlArray.push(token);
		}
    }
    return urlArray;
}

function handleMessage(nick, chan, message, simplified, isMentioned, isPM) {
	var target = isPM ? nick : chan;

	if (isMentioned) {
		sendPM(target, nick+": Hello there!");
	} 
	else if (simplified[0] === "!commands") {
		sendPM(target, nick+": !infoc - Information, !rules - Channel rules, !commands - All commands");
		sendPM(target, nick+": !nextep - Time until next episode, !ep s[season]e[episode] - Open an episode, !episodes - A website for all episodes, !stream [djazz/music]- Link to a livestream, !np - Currently playing song, !radio - Parasprite Radio, !viewers - Number of viewers on the livestream");
	} 
	else if (simplified[0] === "!rules") {
		sendPM(target, nick+": [1] - No spam \n [2] - No bots (Squeebot is the only bot for now!) \n [3] - No insulting others");
	} 
	else if(simplified[0] === "!infoc") {
		sendPM(target, nick+": This IRC channel was created by LunaSquee and djazz. It is the main IRC channel for mlp-episodes site and Parasprite Radio");
	}
	else if(simplified[0] === "!episodes") {
		sendPM(target, nick+": List of all MLP:FiM Episodes: http://mlp-episodes.tk/");
	} 
	else if(simplified[0] === "!yay") {
		sendPM(target, nick+": http://flutteryay.com");
	} 
	else if(simplified[0] === "!squee") {
		sendPM(target, nick+": https://www.youtube.com/watch?v=O1adNgZl_3Q");
	} 
	else if(simplified[0] === "!stream") {
		if(simplified[1] === "djazz") {
			livestreamViewerCount((function(r) { sendPM(target, nick+": Watch djazz's livestream: http://djazz.se/live/ | "+r); }));
		} else if(simplified[1] === "music") {
			getCurrentSongData(function(d, e, i) { if(i) { sendPM(target, nick+": Listen to the Parasprite Radio: http://radio.djazz.se/ | Now playing: "+d);} else { sendPM(target, d)}});
		} else {
			sendPM(target, nick+": Watch djazz's livestream: http://djazz.se/live/");
		}
	} 
	else if(simplified[0] === "!radio") {
		getCurrentSongData(function(d, e, i) { if(i) { sendPM(target, nick+": Listen to the Parasprite Radio: http://radio.djazz.se/ | Now playing: "+d);} else { sendPM(target, d)}});
	} 
	else if(simplified[0] === "!hug") {
		sendPM(target, "*Hugs "+nick+"*");
	} 
	else if(simplified[0] === "!ep") {
		var param = simplified[1];
		mylog(param);
		if(param != null) {
			var epis = param.match(/^s([0-9]+)e([0-9]+)$/i);
			if(epis){
			var link = "http://mlp-episodes.tk/#epi"+epis[2]+"s"+epis[1];
			sendPM(target, nick+": Watch the episode you requested here: "+link);
			} else {
				sendPM(target, irc.colors.wrap("dark_red",nick+": Correct usage !ep s[season number]e[episode number]"));
			}
		} else {
			sendPM(target, irc.colors.wrap("dark_red",nick+": Please provide me with episode number and season, for example: !ep s4e4"));
		}
	}
	else if(simplified[0] === "!nextep") {
		var counter = 0;
		var now = Date.now();
		do {
			var timeLeft = Math.max(((airDate+week*(counter++)) - now)/1000, 0);
		} while (timeLeft === 0 && counter < 26);
		if (counter === 26) {
			sendPM(target, "Season 4 is over :(");
		} else {
			sendPM(target, "Next Season 4 episode airs in %s", readableTime(timeLeft, true));
		}
	}
	else if(simplified[0] === "!np") {
		getCurrentSongData(function(d, e, i) { if(i) { sendPM(target, "Now playing: "+d+" | Listeners: "+e+" | Click here to tune in: http://radio.djazz.se/");} else { sendPM(target, d)}});
	}
	else if(simplified[0] === "!viewers") {
		livestreamViewerCount((function(r) { sendPM(target, r+" | Livestream: http://djazz.se/live/");}));
	}
	if(findUrls(message).length > 0) {
		var link = findUrls(message)[0];
		if(link.indexOf("youtu.be") !== -1) {
		var det = link.substring(link.indexOf('.be/')+4);
			if(det) {
				youtube.video(det).details(function(ne, tw) { if( ne instanceof Error ) { mylog("Error in getting youtube url!") } else { sendPM(target, "YouTube video \""+tw.title+"\" Uploaded by \""+tw.uploader+"\" Views: "+tw.viewCount);}});
			}
		} else if(link.indexOf("youtube.com") !== -1) {
		var det = link.match("[\\?&]v=([^&#]*)")[1];
			if(det) {
			youtube.video(det).details(function(ne, tw) { if( ne instanceof Error ) { mylog("Error in getting youtube url!") } else { sendPM(target, "YouTube video \""+tw.title+"\" Uploaded by \""+tw.uploader+"\" Views: "+tw.viewCount);}}); 
			}
		} else if(link.indexOf("dailymotion.com/video/") !== -1) {
			var det = link.match("/video/([^&#]*)")[1];
			if(det) {
				dailymotion(det, (function(data) {
					sendPM(target, "Dailymotion video \""+data.title+"\" Uploaded by \""+data["owner.screenname"]+"\"");
				}))
			}
		}
	}
}

var bot = new irc.Client(SERVER, NICK, {
	channels: [CHANNEL],
	password: IDENT,
	realName: REALNAME,
	port: PORT,
	stripColors: true
});
var lasttopic = "";
var lasttopicnick = "";

bot.on('error', function (message) {
	info('ERROR: %s: %s', message.command, message.args.join(' '));
});
bot.on('topic', function (channel, topic, nick) {
	lasttopic = topic;
	lasttopicnick = nick;
	logTopic(channel, topic, nick);
});
bot.on('message', function (from, to, message) {
	var simplified = message.replace(/\:/g, ' ').replace(/\,/g, ' ').replace(/\./g, ' ').replace(/\?/g, ' ').trim().split(' ');
	var isMentioned = simplified.indexOf(NICK) !== -1;
	logChat(from, to, message, isMentioned);
	handleMessage(from, to, message, simplified, isMentioned, false);
});
bot.on('join', function (channel, nick) {
	if (nick === NICK) {
		info("You joined channel "+channel.bold);
		rl.setPrompt(util.format("> ".bold.magenta), 2);
		rl.prompt(true);
	} else {
		mylog((" --> ".green.bold)+'%s has joined %s', nick.bold, channel.bold);
	}
});
bot.on('part', function (channel, nick, reason) {
	if (nick !== NICK) {
		mylog((" <-- ".red.bold)+'%s has left %s', nick.bold, channel.bold);
	} else {
		mylog((" <-- ".red.bold)+'You have left %s', channel.bold);
	}
});
bot.on('quit', function (nick, reason, channels) {
	mylog((" <-- ".red.bold)+'%s has quit (%s)', nick.bold, reason);
});
bot.on('pm', function (nick, message) {
	logPM(nick, message);
	var simplified = message.replace(/\:/g, ' ').replace(/\,/g, ' ').replace(/\./g, ' ').replace(/\?/g, ' ').trim().split(' ');
	var isMentioned = simplified.indexOf(NICK) !== -1;
	handleMessage(nick, "", message, simplified, isMentioned, true);
});
bot.on('notice', function (nick, to, text) {
	//mylog(nick, to, text);
});
bot.on('raw', function (message) {
	if (message.command === 'PRIVMSG' && message.args[0] === CHANNEL && message.args[1].indexOf("\u0001ACTION ") === 0) {
		var action = message.args[1].substr(8);
		action = action.substring(0, action.length-1);
		mylog("* %s".bold+" %s", message.nick, action);
	}
});

var rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout
});
rl.setPrompt("");

rl.on('line', function (line) {
	
	if (line === '') {
		return;
	}
	if (line.indexOf('/quit') === 0) {
		info("Quitting...");
		rl.setPrompt("");
		bot.disconnect("Quitting..", function () {
			process.exit(0);
		});
		return;
	} else if (line.indexOf('/msg ') === 0) {
		var split = line.split(" ");
		var nick = split[1];
		var msg = split.slice(2).join(" ");
		sendPM(nick, msg);
	} else if (line.indexOf('/join ') === 0) {
		var chan = line.substr(6);
		bot.join(chan);
	} else if (line.indexOf('/part ') === 0) {
		var chan = line.substr(6);
		bot.part(chan, "Squeebot goes bye bye from this channel.");
	} else if (line.indexOf('/me ') === 0) {
		var msg = line.substr(4);
		bot.action(CHANNEL, msg);
	} else if (line === '/topic') {
		logTopic(CHANNEL, lasttopic, lasttopicnick);
	} else if (line.indexOf("/") === 0) {
		info(("Unknown command "+line.substr(1).bold).red);
	} else {
		sendChat(line);
	}
	rl.prompt(true);
});

info('Connecting...');

function mylog() {
	// rl.pause();
	rl.output.write('\x1b[2K\r');
	console.log.apply(console, Array.prototype.slice.call(arguments));
	// rl.resume();
	rl._refreshLine();
}

function info() {
	arguments[0] = "  -- ".magenta+arguments[0];
	mylog(util.format.apply(null, arguments));
}

function sendChat() {
	var message = util.format.apply(null, arguments);
	logChat(NICK, CHANNEL, message);
	bot.say(CHANNEL, message);
}
function sendPM(target) {
	if (target === CHANNEL) {
		sendChat.apply(null, Array.prototype.slice.call(arguments, 1));
		return;
	}
	var message = util.format.apply(null, Array.prototype.slice.call(arguments, 1));
	logPM(NICK+" -> "+target, message);
	bot.say(target, message);
}
function logChat(nick, chan, message, isMentioned) {
	if (isMentioned) {
		nick = nick.yellow;
	}
	mylog('[%s] %s: %s', chan, nick.bold, message);
}
function logPM(target, message) {
	mylog('%s: %s', target.bold.blue, message);
}
function logTopic(channel, topic, nick) {
	info('Topic for %s is "%s", set by %s', channel.bold, topic.yellow, nick.bold.cyan);
}
function zf(v) {
	if (v > 9) {
		return ""+v;
	} else {
		return "0"+v;
	}
}
function readableTime(timems, ignoreMs) {
	var time = timems|0;
	var ms = ignoreMs?'':"."+zf((timems*100)%100|0);
	if (time < 60) return zf(time)+ms+"s";
	else if (time < 3600) return zf(time / 60|0)+"m "+zf(time % 60)+ms+"s";
	else if (time < 86400) return zf(time / 3600|0)+"h "+zf((time % 3600)/60|0)+"m "+zf((time % 3600)%60)+ms+"s";
	else return (time / 86400|0)+"d "+zf((time % 86400)/3600|0)+"h "+zf((time % 3600)/60|0)+"m "+zf((time % 3600)%60)+"s";
} 
