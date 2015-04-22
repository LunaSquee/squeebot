#!/usr/bin/env node
'use strict';
// IRC bot by LunaSquee (Originally djazz, best poni :3)

// Modules
var net = require('net');
var http = require('http');
var https = require('https');
var irc = require('irc');
var colors = require('colors');
var util = require('util');
var readline = require('readline');
var youtube = require('youtube-feeds');
var gamedig = require('gamedig');
var fs = require('fs');
var events = require("events");
var emitter = new events.EventEmitter();
var settings = require(__dirname+"/settings.json");

// Config
var SERVER = settings.server;       // The server we want to connect to
var PORT = settings.port || 6667;   // The connection port which is usually 6667
var NICK = settings.username;       // The bot's nickname
var IDENT = settings.password;      // Password of the bot. Set to null to not use password login.
var REALNAME = 'LunaSquee\'s bot';  // Real name of the bot
var CHANNEL = settings.channel;     // The default channel for the bot
var PREFIX = settings.prefix;       // The prefix of commands
// Episode countdown (!nextep)
var airDate = Date.UTC(2015, 4-1, 4, 15, 30, 0); // Year, month-1, day, hour, minute, second (UTC)
var week = 7*24*60*60*1000;

// rules/infoc: Rules and information for individual channels.
// botops: Bot operators (soon to be implementing)
var p_vars = {
    rules:{"#bronytalk":["No spam of any kind.", "No IRC bots (unless said otherwise by ops)", "No insulting others."],
            "#parasprite":["No spam of any kind.", "No IRC bots (unless said otherwise by ops)", "No insulting others."]},
    infoc:{"#bronytalk":"This IRC channel was created by LunaSquee and djazz. It is the main IRC channel for mlp-episodes site and Parasprite Radio",
            "#parasprite":"This IRC channel was created by LunaSquee and djazz. It is the main IRC channel for mlp-episodes site and Parasprite Radio"},
    botops:{}
}
// This is the list of all your commands.
// "command":{"action":YOUR FUNCTION HERE, "description":COMMAND USAGE(IF NOT PRESENT, WONT SHOW UP IN !commands)}
var commands = {
    "commands":{"action":(function(simplified, nick, chan, message, target) {
        listCommands(nick);
    }), "description":"- All Commands"},
    
    "command":{"action":(function(simplified, nick, chan, message, target) {
        if(simplified[1]) {
            var cmdName = (simplified[1].indexOf(PREFIX) === 0 ? simplified[1].substring(1) : simplified[1]);
            if(cmdName in commands) {
                var cmdDesc = commands[cmdName].description;
                if(cmdDesc) {
                    sendPM(target, nick+": \u0002"+PREFIX+cmdName+"\u000f "+cmdDesc);
                } else {
                    sendPM(target, nick+": \u0002"+PREFIX+cmdName+"\u000f - Undefined command!");
                }
            } else {
                sendPM(target, nick+": That is not a known command!");
            }
        } else {
            sendPM(target, nick+": Usage: \u0002"+PREFIX+"command\u000f <command>");
        }
    }), "description":"<command> - Show command description"},
    
    "infoc":{"action":(function(simplified, nick, chan, message, target, mentioned, pm) {
        if(pm) {
            sendPM(target, "This command can only be executed in a channel.");
        } else {
            var channel = chan.toLowerCase();
            if("infoc" in p_vars) {
                if(channel in p_vars.infoc) {
                    sendPM(target, nick+": "+p_vars.infoc[channel]);
                    return
                }
            }
            sendPM(target, "No information to display for "+chan);
        }
    }), "description":"- Channel Information"},
   
    "rules":{"action":(function(simplified, nick, chan, message, target, mentioned, pm) {
        if(pm) {
            sendPM(target, "This command can only be executed in a channel.");
        } else {
            var channel = chan.toLowerCase();
            if("rules" in p_vars) {
                if(channel in p_vars.rules) {
                    sendPM(channel, "Channel Rules of "+chan+": ");
                    var rls = p_vars.rules[channel];
                    rls.forEach(function(e) {
                        sendPM(channel, "["+(rls.indexOf(e)+1)+"] "+e);
                    });
                    return;
                }
            }
            sendPM(target, "No rules to display for "+chan);
        }
    }), "description":"- Channel Rules"},

    "np":{"action":(function(simplified, nick, chan, message, target) {
        getCurrentSong(function(d, e, i) { 
            if(i) { 
                sendPM(target, "\u000303Now playing: \u000312"+d+" \u000303Listeners: \u000312"+e+" \u000303Click here to tune in: \u000312http://radio.djazz.se/");
            } else { 
                sendPM(target, d);
            }
        })
    }), "description":"- Currently playing song on Parasprite Radio"},
    
    "radio":{"action":(function(simplified, nick, chan, message, target) {
        getCurrentSong(function(d, e, i) { 
            if(i) { 
                sendPM(target, "\u000303Now playing: \u000312"+d+" \u000303Listeners: \u000312"+e+" \u000303Click here to tune in: \u000312http://radio.djazz.se/");
            } else { 
                sendPM(target, d);
            }
        })
    }), "description":"- Tune in to Parasprite Radio"},
    
    "yay":{"action":(function(simplified, nick, chan, message, target) {
        sendPM(target, nick+": http://flutteryay.com");
    })},
    
    "squee":{"action":(function(simplified, nick, chan, message, target) {
        sendPM(target, nick+": https://www.youtube.com/watch?v=O1adNgZl_3Q");
    })},
    
    "hug":{"action":(function(simplified, nick, chan, message, target) {
        sendPM(target, "*Hugs "+nick+"*");
    })},
    
    "viewers":{"action":(function(simplified, nick, chan, message, target) {
        livestreamViewerCount((function(r) { 
            sendPM(target, r+" \u000303Livestream: \u000312http://djazz.se/live/")
        }))
    }),"description":"- Number of people watching djazz'es livestream"},
    
    "nextep":{"action":(function(simplified, nick, chan, message, target) {
        var counter = 0;
        var now = Date.now();
        do {
            var timeLeft = Math.max(((airDate+week*(counter++)) - now)/1000, 0);
        } while (timeLeft === 0 && counter < 26);
        if (counter === 26) {
            sendPM(target, "Season 5 is over :(");
        } else {
            sendPM(target, (counter===1?"First":"Next")+" Season 5 episode airs in %s", readableTime(timeLeft, true));
        }
    }),"description":"- Time left until next pony episode."},
    
    "episodes":{"action":(function(simplified, nick, chan, message, target) {
        sendPM(target, nick+": List of all MLP:FiM Episodes: http://mlp-episodes.tk/");
    }),"description":"- List of pony episodes"},
    
    "minecraft":{"action":(function(simplified, nick, chan, message, target) {
        var reqplayers = false;
        
        if(simplified[1] === "players") {
            reqplayers = true;
        }
        
        getGameInfo("minecraft", "minecraft.djazz.se", function(err, msg) {
            if(err) { 
                sendPM(target, err); 
                return;
            }
            sendPM(target, msg); 
        }, reqplayers);
    }),"description":"[players] - Information about our Minecraft Server"},
    
    "mc":{"action":(function(simplified, nick, chan, message, target) {
        var reqplayers = false;

        if(simplified[1] === "players") {
            reqplayers = true;
        }

        getGameInfo("minecraft", "minecraft.djazz.se", function(err, msg) {
            if(err) { 
                sendPM(target, err);
                return;
            }
            sendPM(target, msg);
        }, reqplayers);
    })},

    "mumble":{"action":(function(simplified, nick, chan, message, target) {
        var requsers = false;

        if(simplified[1] === "users") {
            requsers = true;
        }
        
        if(simplified[1] === "download") {
            sendPM(target, "\u000310[Mumble] \u000303Download Mumble here: \u000312http://wiki.mumble.info/wiki/Main_Page#Download_Mumble");
            return;
        }
        
        getGameInfo("mumble", "mumble.djazz.se", function(err, msg) {
            if(err) {
                sendPM(target, err);
                return;
            }
            sendPM(target, msg);
        }, requsers);
    }), "description":"[users/download] - Information about our Mumble Server"},
    
    "episode":{"action":(function(simplified, nick, chan, message, target) {
        var param = simplified[1]; 
        if(param != null) { 
            var epis = param.match(/^s([0-9]+)e([0-9]+)$/i); 
            if(epis && epis[2]<=26 && epis[1]<=5){ 
                var link = "http://mlp-episodes.tk/#epi"+epis[2]+"s"+epis[1]; 
                sendPM(target, nick+": Watch the episode you requested here: "+link); 
            } else { 
                sendPM(target, irc.colors.wrap("light_red",nick+": Correct usage !ep s[season number]e[episode number]"));
            }
        } else {
            sendPM(target, irc.colors.wrap("light_red",nick+": Please provide me with episode number and season, for example: !ep s4e4"));
        }
    }),"description":"s<Season>e<Episode Number> - Open a pony episode"}
};

/*
    ===================
    NICKNAME UTILITIES!
    ===================    
*/
var nicks = {};
var iconvert = {};

function getModeOfNick(nickname, onChannel) {
    var channel = onChannel.toLowerCase();
    if(channel in nicks) {
        if(nickname in nicks[channel]) {
            return nicks[channel][nickname];
        }
    }
}

function setChannelNicks(onChannel, namesObj) {
    var channel = onChannel.toLowerCase();
    var initial = {}
    for(var key in namesObj) {
        var prefix = iconvert.prefixToMode(namesObj[key]);
        initial[key] = prefix;
    }
    nicks[channel] = initial;
}

function handleChannelJoin(nickname, onChannel) {
    var channel = onChannel.toLowerCase();
    if(channel in nicks) {
        nicks[channel][nickname] = "";
    }
}

function handleChannelPart(nickname, onChannel) {
    var channel = onChannel.toLowerCase();
    if(channel in nicks) {
        if(nickname in nicks[channel]) {
            delete nicks[channel][nickname];
        }
    }
}

function handleUserQuit(nickname) {
    for(var key in nicks) {
        var obj = nicks[key];
        if(nickname in obj) {
            delete nicks[key][nickname];
        }
    }
}

// +mode
function handleUserModeP(nickname, mode, onChannel) {
    if(mode!="q" && mode!="a" && mode!="o" && mode!="h" && mode!="v") return;
    var channel = onChannel.toLowerCase();
    if(channel in nicks) {
        var chan = nicks[channel];
        if(nickname in chan) {
            var oldmode = chan[nickname];
            if(oldmode == "q" && mode == "o") return;
            if(oldmode == "a" && mode == "o") return;
            nicks[channel][nickname] = mode;
        }
    }
}

// -mode
function handleUserModeM(nickname, mode, onChannel) {
    if(mode!="q" && mode!="a" && mode!="o" && mode!="h" && mode!="v") return;
    var channel = onChannel.toLowerCase();
    if(channel in nicks) {
        var chan = nicks[channel];
        if(nickname in chan) {
            nicks[channel][nickname] = "";
        }
    }
}

function handleUserNickChange(oldNick, newNick) {
    emitter.emit('newIrcMessage', oldNick, "", " is now known as "+newNick, "NICK");
    for(var key in nicks) {
        var obj = nicks[key];
        if(oldNick in obj) {
            var backupMode = obj[oldNick];
            delete nicks[key][oldNick];
            nicks[key][newNick] = backupMode;
        }
    }
}

function handleBotLeft(channel) {
    if(channel.toLowerCase() in nicks) {
        delete nicks[channel.toLowerCase()];
    }
}

function isOpOnChannel(username, channel) {
    if(channel in nicks) {
        var chanobj = nicks[channel];
        if(username in chanobj) {
            if(chanobj[username] === "q" || chanobj[username] === "a" || chanobj[username] === "o") {
                return true;
            }
            return false;
        }
    }
}

iconvert.prefixToMode = (function(prefix) {
    var mode = "";
    switch (prefix) {
        case "~":
            mode = "q";
            break;
        case "&":
            mode = "a";
            break;
        case "@":
            mode = "o";
            break;
        case "%":
            mode = "h";
            break;
        case "+":
            mode = "v";
            break;
        default:
            mode = "";
            break;
    }
    return mode;
});

iconvert.modeToPrefix = (function(mode) {
    var prefix = "";
    switch (mode) {
        case "q":
            prefix = "~";
            break;
        case "a":
            prefix = "&";
            break;
        case "o":
            prefix = "@";
            break;
        case "h":
            prefix = "%";
            break;
        case "v":
            prefix = "+";
            break;
        default:
            prefix = "";
            break;
    }
    return prefix;
});

iconvert.modeToText = (function(mode) {
    var prefix = "";
    switch (mode) {
        case "q":
            prefix = "Owner";
            break;
        case "a":
            prefix = "Admin";
            break;
        case "o":
            prefix = "Op";
            break;
        case "h":
            prefix = "Halfop";
            break;
        case "v":
            prefix = "Voice";
            break;
        default:
            prefix = "Normal";
            break;
    }
    return prefix;
});
/*
    End of nick utils.
    Misc. Utilities
*/

String.prototype.toHHMMSS = function () {
    var sec_num = parseInt(this, 10); // don't forget the second param
    var hours   = Math.floor(sec_num / 3600);
    var minutes = Math.floor((sec_num - (hours * 3600)) / 60);
    var seconds = sec_num - (hours * 3600) - (minutes * 60);

    if (hours   < 10) {hours   = "0"+hours;}
    if (minutes < 10) {minutes = "0"+minutes;}
    if (seconds < 10) {seconds = "0"+seconds;}
    var time = '';
    if(hours > 0)
        time = hours+':'+minutes+':'+seconds;
    else
        time = minutes+':'+seconds;
    return time;
}

String.prototype.addCommas = function() {
    var nStr = this;
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

/*
    End of Misc. Utils.
*/

// List all commands that have a description set
function listCommands(nick) {
    var comms = [];
    var listofem = [];
    var variab = false;
    comms.push("*** "+NICK.toUpperCase()+" COMMANDS ***");
    comms.push("All "+NICK+" commands start with a "+PREFIX+" prefix.");
    comms.push("Type  "+PREFIX+"command <command> for more information on that command.");
    for(var command in commands) {
        var obj = commands[command];
        if("description" in obj) {
            variab = !variab;
            listofem.push("\u0002"+irc.colors.wrap((variab?"dark_green":"light_green"), command));
        }
    }
    comms.push(listofem.join(" "));
    comms.push("***** End of "+PREFIX+"commands *****");
    sendWithDelay(comms, nick, 1000);
}

function sendWithDelay(messages, target, time) {
    function sendMessageDelayed(c, arri, timeout) {
        sendPM(target, arri[c]);
        c++;
        if(arri[c] != null)
            setTimeout(function() {sendMessageDelayed(c, arri, timeout)}, timeout);
    }
    sendMessageDelayed(0, messages, time || 1000);
}

// Grab JSON from an url 
function fetchJSON(url, callback) {
    http.get(url, function(res){
        var data = '';

        res.on('data', function (chunk){
            data += chunk;
        });

        res.on('end',function(){
        	try{
	            var obj = JSON.parse(data);
	            callback(true, obj);
        	}catch(err) {
        		callback(false, "Parse Failed.");
        	}
        })

    }).on('error', function(e) {
        callback(false, e.message);
    });
}

// Grab JSON from an url (HTTPS)
function fetchJSON_HTTPS(url, callback) {
    https.get(url, function(res){
        var data = '';

        res.on('data', function (chunk){
            data += chunk;
        });

        res.on('end',function(){
            try{
	            var obj = JSON.parse(data);
	            callback(true, obj);
        	}catch(err) {
        		callback(false, "Parse Failed.");
        	}
        })

    }).on('error', function(e) {
        callback(false, e.message);
    });
}

// Experimental Function!
function formatmesg(message) {
    var pass1 = message.match(/#c/g) ? message.replace(/#c/g, '\u0003').replace(/#f/g, "\u000f") + '\u000f' : message;
    var pass2 = pass1.match(/#b/g) ? pass1.replace(/#b/g, '\u0002') : pass1;
    var pass3 = pass2.match(/#u/g) ? pass2.replace(/#u/g, '\u001F') : pass2;
    return pass3.match(/#i/g) ? pass3.replace(/#i/g, '\u001D') : pass3;
}

// Get current Parasprite Radio song
function getCurrentSong(callback) {
    fetchJSON("http://radio.djazz.se/icecast.php", function(success, content) {
        if(success) {
            if(content.listeners != null) {
	            fetchJSON("http://radiodev.djazz.se/api/now/json", function(xe, xt) {
	            	if(xt.title != null && xe) {
		                var theTitle = new Buffer(xt.title, "utf8").toString("utf8");
		                var artist = xt.artist;
		                if(artist!=null) {
		                    theTitle=theTitle+" by "+artist;
		                }
		                callback(theTitle, content.listeners, true);
		                return;
	            	} else {
	            		callback("\u000307Parasprite Radio\u000f is \u000304offline!", "", false);
	            	}
	            });
            } else {
            	callback("\u000307Parasprite Radio\u000f is \u000304offline!", "", false);
            }
        } else {
        	callback("\u000307Parasprite Radio\u000f is \u000304offline!", "", false);
        }
    });
}

// Gameserver info (This function makes me puke)
function getGameInfo(game, host, callback, additional) {
    gamedig.query(
    {
        type: game,
        host: host
    },
        function(state) {
            if(state.error) callback("\u000304Server is offline!", null);
            else {
                switch(game) {
                    case "tf2":
                        if(additional) {
                            callback(null, "\u000310[Team Fortress 2]\u000f " + (typeof(additional) === "object" ? state[additional[0]][additional[1]] : state[additional]));
                        } else {
                            callback(null, "\u000310[Team Fortress 2] \u000303IP: \u000312"+host+" \u000303MOTD: \u000312\""+state.name+"\" \u000303Players: \u000312"+state.raw.numplayers+"/"+state.maxplayers);
                        }
                        break;
                    case "minecraft":
                        if(additional!=null && additional === true) {
                            if(state.players.length > 0) {
                                var players = [];
                                state.players.forEach(function(t) {
                                    players.push(t.name);
                                });
                                callback(null, "\u000310[Minecraft] \u000303Players:\u000f "+players.join(", "));
                            } else {
                                callback(null, "\u000310[Minecraft] \u000304No players");
                            }
                        } else {
                            callback(null, "\u000310[Minecraft] \u000303IP: \u000312"+host+" \u000303MOTD: \u000312\""+state.name+"\" \u000303Players: \u000312"+state.raw.numplayers+"/"+state.raw.maxplayers);
                        }
                        break;
                    case "mumble":
                        if(additional!=null && additional === true) {
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
                                        o = irc.colors.wrap("dark_red", o);
                                    } else if (isMuted) {
                                        o = irc.colors.wrap("orange", o);
                                    } else if (isDeaf) {
                                        o = irc.colors.wrap("light_blue", o);
                                    } else {
                                        o = irc.colors.wrap("light_green", o);
                                    }
                                    players.push(o);
                                });
                                callback(null, "\u000310[Mumble] Users:\u000f "+players.join(", "));
                            } else {
                                callback(null, "\u000310[Mumble] \u000304No users ");
                            }
                        } else {
                            callback(null, "\u000310[Mumble] \u000303Address: \u000312"+host+" \u000303Users online: \u000312"+state.players.length);
                        }
                        break;
                };
            }
        }
    );
}

// Dailymotion video puller
function dailymotion(id, callback) {
    fetchJSON_HTTPS("https://api.dailymotion.com/video/"+id+"?fields=id,title,owner,owner.screenname,duration,views_total", function(success, content) {
        if(success) {
            callback(content);
        }
    });
}

// Livestream viewers
function livestreamViewerCount(callback) {
    fetchJSON("http://djazz.se/live/info.php", function(success, content) {
        if(success) {
            var view = content.viewcount;
            if(view!=-1) {
                callback("\u000303Viewers: \u000311"+view);
            } else {
                callback("\u000304The livestream is offline");
            }
        } else {
            callback("\u000304The livestream is offline");
        }
    });
}

// Finds urls in string
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

// Handles messages
function handleMessage(nick, chan, message, simplified, isMentioned, isPM) {
    var target = isPM ? nick : chan;
    if(simplified[0].indexOf(PREFIX) === 0 && simplified[0].toLowerCase().substring(1) in commands) {
        var command = commands[simplified[0].toLowerCase().substring(1)];
        if("action" in command)
            command.action(simplified, nick, chan, message, target, isMentioned, isPM);
    }else if(isPM && simplified[0].toLowerCase() in commands) {
        var command = commands[simplified[0].toLowerCase()];
        if("action" in command)
            command.action(simplified, nick, chan, message, target, isMentioned, isPM);
    }else if(findUrls(message).length > 0) {
        var link = findUrls(message)[0];
        if(link.indexOf("youtu.be") !== -1) {
        var det = link.substring(link.indexOf('.be/')+4);
            if(det) {
                youtube.video(det).details(function(ne, tw) { 
                    if( ne instanceof Error ) { 
                        mylog("Error in getting youtube url!"); 
                    } else { 
                        sendPM(target, "\u0002You\u000305Tube\u000f \u000312\""+tw.title+"\" \u000303Views: \u000312"+tw.viewCount.toString().addCommas()+" \u000303Duration: \u000312"+tw.duration.toString().toHHMMSS()+" \u000303By \u000312\""+tw.uploader+"\"");
                    }
                });
            }
        } else if(link.indexOf("youtube.com") !== -1) {
        var det = link.match("[\\?&]v=([^&#]*)")[1];
            if(det) {
                youtube.video(det).details(function(ne, tw) { 
                    if( ne instanceof Error ) { 
                        mylog("Error in getting youtube url!"); 
                    } else { 
                        sendPM(target, "\u0002You\u000305Tube\u000f \u000312\""+tw.title+"\" \u000303Views: \u000312"+tw.viewCount.toString().addCommas()+" \u000303Duration: \u000312"+tw.duration.toString().toHHMMSS()+" \u000303By \u000312\""+tw.uploader+"\"");
                    }
                });
            }
        } else if(link.indexOf("dailymotion.com/video/") !== -1) {
            var det = link.match("/video/([^&#]*)")[1];
            if(det) {
                dailymotion(det, (function(data) {
                    sendPM(target, "\u0002\u000303Dailymotion\u000f \u000312\""+data.title+"\" \u000303Views: \u000312"+data.views_total.toString().addCommas()+" \u000303Duration: \u000312"+data.duration.toString().toHHMMSS()+" \u000303By \u000312\""+data["owner.screenname"]+"\"");
                }))
            }
        }
    }else if(isMentioned) {
        sendPM(target, nick+": Hello there!");
    }
}

// Relays irc messages to clients

function ircRelayMessageHandle(c) {
    emitter.once('newIrcMessage', function (from, to, message, type) {
        if (c.writable) {
            c.write(type+">"+from+':'+to+':'+message+'\r\n');
            ircRelayMessageHandle(c);
        }
    });
}

function ircRelayServer() {
    if (!settings.enableRelay) return;

    var server = net.createServer(function (c) { //'connection' listener
        var pingWait = null, pingTimeout = null;

        function ping() {
            clearTimeout(pingWait);
            pingWait = setTimeout(function () {
                c.write('ping');
                //info('RELAY: Send ping');
                pingTimeout = setTimeout(function () {
                    c.destroy();
                    info('RELAY: Connection timed out');
                }, 15*1000);
            }, 15*1000);
        }
        function pong() {
            //info('RELAY: Got pong');
            clearTimeout(pingTimeout);
            ping();
        }

        var firstData = true;
        info('RELAY: Client %s is connecting...', c.remoteAddress);
        c.setEncoding('utf8');
        c.once('end', function() {
            clearTimeout(timeout);
            info('RELAY: Client disconnected');
        });
        c.once('error', function (err) {
            clearTimeout(timeout);
            info('RELAY: Client error: '+err);
            c.destroy();
        });
        c.once('close', function() {
            clearTimeout(timeout);
            clearTimeout(pingWait);
            clearTimeout(pingTimeout);
            info('RELAY: Client socket closed');
        });
        c.on('data', function (data) {
            if (firstData) {
                firstData = false;
                data = data.trim();
                clearTimeout(timeout);

                if (data === settings.relayPassword) {
                    info('RELAY: Client logged in');
                    c.write('Password accepted');
                    ircRelayMessageHandle(c);
                    ping();
                } else {
                    info('RELAY: Client supplied wrong password: %s', data);
                    c.end("Wrong password");
                }
            } else {
                if (data === 'pong') {
                    pong();
                }
            }
        });
        var timeout = setTimeout(function () {
            c.end("You were too slow :I");
            info('RELAY: Client was too slow (timeout during handshake)');
        }, 10*1000);

    });
    server.listen(settings.relayPort, function () {
        info('RELAY: Relay server listening on port %d', settings.relayPort);
    });
}

// Save variables of p_vars
function p_vars_save() {
    var json_en = JSON.stringify(p_vars);
    if(json_en) {
        fs.writeFile('savedvars.json', json_en, function (err) {
          if (err) {
            console.log(err);
            return;
          }
          mylog('Variables object saved.');
        });
    }
}

// Load variables of p_vars
function p_vars_load() {
    fs.readFile('savedvars.json', 'utf8', function (err, data) {
      if (err) return;
      p_vars = JSON.parse(data);
      mylog('Variables object loaded.');
    });
}

//*******************************************************************************************************
// This is where the magic happens
//*******************************************************************************************************

var bot = new irc.Client(SERVER, NICK, {
    channels: [CHANNEL],
    password: IDENT,
    realName: REALNAME,
    port: PORT,
    //secure: true,
    //certExpired: true,
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
	if(to.indexOf("#") === 0) { // 'pm' handles if this is false.. god damn you irc module, you derp.
    	var simplified = message.replace(/\:/g, ' ').replace(/\,/g, ' ').replace(/\./g, ' ').replace(/\?/g, ' ').trim().split(' ');
    	var isMentioned = simplified.indexOf(NICK) !== -1;
    	logChat(from, to, message, isMentioned);
    	handleMessage(from, to, message, simplified, isMentioned, false);
	}
});
bot.on('join', function (channel, nick) {
    if (nick === NICK) {
        mylog((" --> ".green.bold)+"You joined channel "+channel.bold);
        rl.setPrompt(util.format("> ".bold.magenta), 2);
        rl.prompt(true);
    } else {
        mylog((" --> ".green.bold)+'%s has joined %s', nick.bold, channel.bold);
        emitter.emit('newIrcMessage', nick, channel, " has joined ", "JOIN");
        handleChannelJoin(nick, channel);
    }
});
bot.on('kick', function (channel, nick, by, reason, message) {
    if (nick === NICK) {
        mylog((" <-- ".red.bold)+"You was kicked from %s by %s: %s", channel.bold, message.nick, reason);
        info("Rejoining "+channel.bold+" in 5 seconds...");
        handleBotLeft(channel);
        setTimeout(function () {
            bot.join(channel);
        }, 5*1000);
    } else {
        mylog((" <-- ".red.bold)+nick+" was kicked from %s by %s: %s", channel.bold, message.nick, reason);
        emitter.emit('newIrcMessage', nick, channel, " was kicked by "+message.nick+" ("+reason+")", "KICK");
        handleChannelPart(nick, channel);
    }
});
bot.on('part', function (channel, nick, reason) {
    if (nick !== NICK) {
        mylog((" <-- ".red.bold)+'%s has left %s', nick.bold, channel.bold);
        emitter.emit('newIrcMessage', nick, channel, " has left ", "PART");
        handleChannelPart(nick, channel);
    } else {
        mylog((" <-- ".red.bold)+'You have left %s', channel.bold);
        handleBotLeft(channel);
    }
});
bot.on('quit', function (nick, reason, channels) {
    mylog((" <-- ".red.bold)+'%s has quit (%s)', nick.bold, reason);
    emitter.emit('newIrcMessage', nick, "", " has quit ("+reason+")", "QUIT");
    handleUserQuit(nick);
});
bot.on('names', function(channel, nicks) {
    setChannelNicks(channel, nicks);
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
    if (message.command === 'PRIVMSG' && message.args[1] && message.args[1].indexOf("\u0001ACTION ") === 0) {
        var action = message.args[1].substr(8);
        action = action.substring(0, action.length-1);
        emitter.emit('newIrcMessage', message.nick, message.args[0], action, "ACTION");
        mylog("* %s".bold+" %s", message.nick, action);
    }
});
bot.on('+mode', function(channel, by, mode, argument, message) {
    handleUserModeP(argument, mode, channel);
});
bot.on('-mode', function(channel, by, mode, argument, message) {
    handleUserModeM(argument, mode, channel);
});
bot.on('nick', handleUserNickChange);

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
        var msg = line.substring(6) || "Quitting...";
        info("Quitting...");
        rl.setPrompt("");
        bot.disconnect(msg, function () {
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
    } else if (line.indexOf('/vars ') === 0) {
        var c = line.substr(6);
        if(c!=null && c!="") {
            if(c=="save"){
                p_vars_save();
            }else if(c=="load"){
                p_vars_load();
            }
        }
    } else if (line.indexOf('/part ') === 0) {
        var chan = line.substr(6);
        bot.part(chan, NICK+" goes bye bye from this channel.");
    } else if (line.indexOf('/me ') === 0) {
        var msg = line.substr(4);
        bot.action(CHANNEL, msg);
    } else if (line === '/topic') {
        logTopic(CHANNEL, lasttopic, lasttopicnick);
    } else if (line.indexOf("/") === 0) {
        info(("Unknown command "+line.substr(1).bold).red);
    } else {
        sendChat(formatmesg(line));
    }
    rl.prompt(true);
});

info('Connecting...');
ircRelayServer();

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
    emitter.emit('newIrcMessage', nick, chan, message, "PRIVMSG");
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
