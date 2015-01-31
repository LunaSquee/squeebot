#!/usr/bin/env node
'use strict';
// IRC bot by LunaSquee (Originally djazz, best poni :3)

// Modules
var net = require('net');
var http = require('http');
var irc = require('irc');
var colors = require('colors');
var util = require('util');
var readline = require('readline');
var youtube = require('youtube-feeds');
var gamedig = require('gamedig');
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

// Episode countdown
var airDate = Date.UTC(2013, 11-1, 23, 14, 0, 0); // Year, month-1, day, hour, minute, second (UTC)
var week = 7*24*60*60*1000;

// This is the list of all your commands.
// "!command":{"action":YOUR FUNCTION HERE, "description":COMMAND USAGE(IF NOT PRESENT, WONT SHOW UP IN !commands)}
var commands = {
    "!commands":{"action":(function(simplified, nick, chan, message, target) {
        listCommands(target, nick)
    }), "description":"All Commands"},
    
    "!infoc":{"action":(function(simplified, nick, chan, message, target) {
        sendPM(target, nick+": This IRC channel was created by LunaSquee and djazz. It is the main IRC channel for mlp-episodes site and Parasprite Radio");
    }), "description":"Channel Information"},
    
    "!rules":{"action":(function(simplified, nick, chan, message, target) {
        sendPM(target, nick+": [1] - No spam \n [2] - No bots (Squeebot is the only bot for now!) \n [3] - No insulting others");
    }), "description":"Channel Rules"},
    
    "!np":{"action":(function(simplified, nick, chan, message, target) {
        getCurrentSong(function(d, e, i) { 
            if(i) { 
                sendPM(target, "Now playing: "+d+" | Listeners: "+e+" | Click here to tune in: http://radio.djazz.se/")
            } else { 
                sendPM(target, d)
            }
        })
    }), "description":"Currently playing song"},
    
    "!radio":{"action":(function(simplified, nick, chan, message, target) {
        getCurrentSong(function(d, e, i) { 
            if(i) { 
                sendPM(target, "Now playing: "+d+" | Listeners: "+e+" | Click here to tune in: http://radio.djazz.se/")
            } else { 
                sendPM(target, d)
            }
        })
    }), "description":"Parasprite Radio"},
    
    "!yay":{"action":(function(simplified, nick, chan, message, target) {
        sendPM(target, nick+": http://flutteryay.com")
    })},
    
    "!squee":{"action":(function(simplified, nick, chan, message, target) {
        sendPM(target, nick+": https://www.youtube.com/watch?v=O1adNgZl_3Q")
    })},
    
    "!hug":{"action":(function(simplified, nick, chan, message, target) {
        sendPM(target, "*Hugs "+nick+"*");
    })},
    
    "!viewers":{"action":(function(simplified, nick, chan, message, target) {
        livestreamViewerCount((function(r) { 
            sendPM(target, r+" | Livestream: http://djazz.se/live/")
        }))
    }),"description":"Number of people watching livestream"},
    
    "!nextep":{"action":(function(simplified, nick, chan, message, target) {
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
    }),"description":"Number of people watching the livestream"},
    
    "!episodes":{"action":(function(simplified, nick, chan, message, target) {
        sendPM(target, nick+": List of all MLP:FiM Episodes: http://mlp-episodes.tk/");
    }),"description":"List of pony episodes"},
    
    "!minecraft":{"action":(function(simplified, nick, chan, message, target) {
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
    }),"description":"Minecraft Server"},
    
    "!mc":{"action":(function(simplified, nick, chan, message, target) {
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

    "!mumble":{"action":(function(simplified, nick, chan, message, target) {
        var requsers = false;

        if(simplified[1] === "users") {
            requsers = true;
        }

        getGameInfo("mumble", "mumble.djazz.se", function(err, msg) {
            if(err) {
                sendPM(target, err);
                return;
            }
            sendPM(target, msg);
        }, requsers);
    })},
    
    "!episode":{"action":(function(simplified, nick, chan, message, target) {
        var param = simplified[1]; 
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
    }),"description":"Open a pony episode"}
};

// List all commands that have a description set
function listCommands(target, nick) {
    sendPM(target, nick+": --- SQUEEBOT COMMANDS ---");
    var comms = [];
    for(var command in commands) {
        var obj = commands[command];
        if("description" in obj) {
            comms.push(command+" - "+obj.description);
        }
    }
    sendPM(target, nick+": "+comms.join(", "));
    sendPM(target, nick+": --- END OF !commands ---");
}

// Grab JSON from an url 
function JSONGrabber(url, callback) {
    http.get(url, function(res){
        var data = '';

        res.on('data', function (chunk){
            data += chunk;
        });

        res.on('end',function(){
            var obj = JSON.parse(data);
            callback(true, obj);
        })

    }).on('error', function(e) {
        callback(false, e.message);
    });
}

// Get current Parasprite Radio song
function getCurrentSong(callback) {
    JSONGrabber("http://radio.djazz.se/icecast.php", function(success, content) {
        if(success) {
            if(content.title != null) {
                var theTitle = new Buffer(content.title, "utf8").toString("utf8");
                var splitUp = theTitle.replace(/\&amp;/g, "&").split(" - ");
                if(splitUp.length===2) {
                    theTitle=splitUp[1]+(splitUp[0]?" by "+splitUp[0]:"");
                }
                callback(theTitle, content.listeners, true);
            } else {
                callback("Parasprite Radio is offline!", "", false);
            }
        } else {
            callback("Parasprite Radio is offline!", "", false);
        }
    });
}

// Gameserver info (This function makes me puke)
function getGameInfo(game, host, callback, additional) {
    Gamedig.query(
    {
        type: game,
        host: host
    },
        function(state) {
            if(state.error) callback("Server is offline!", null);
            else {
                switch(game) {
                    case "tf2":
                        if(additional) {
                            callback(null, "[Team Fortress 2] " + (typeof(additional) === "object" ? state[additional[0]][additional[1]] : state[additional]));
                        } else {
                            callback(null, "[Team Fortress 2] IP: "+host+" MOTD: \""+state.name+"\" Players: "+state.raw.numplayers+"/"+state.maxplayers);
                        }
                        break;
                    case "minecraft":
                        if(additional!=null && additional === true) {
                            if(state.players.length > 0) {
                                var players = [];
                                state.players.forEach(function(t) {
                                    players.push(t.name);
                                });
                                callback(null, "[Minecraft] Players: "+players.join(", "));
                            } else {
                                callback(null, "[Minecraft] No players");
                            }
                        } else {
                            callback(null, "[Minecraft] IP: "+host+" MOTD: \""+state.name+"\" Players: "+state.raw.numplayers+"/"+state.raw.maxplayers);
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
                                callback(null, "[Mumble] Users: "+players.join(", "));
                            } else {
                                callback(null, "[Mumble] No users ");
                            }
                        } else {
                            callback(null, "[Mumble server] IP: "+host+" Users online: "+state.players.length);
                        }
                        break;
                };
            }
        }
    );
}

// Dailymotion video puller
function dailymotion(id, callback) {
    JSONGrabber("https://api.dailymotion.com/video/"+id+"?fields=id,title,owner,owner.screenname", function(success, content) {
        if(success) {
            callback(content);
        }
    });
}

// Livestream viewers
function livestreamViewerCount(callback) {
    JSONGrabber("http://djazz.se/live/info.php", function(success, content) {
        if(success) {
            var view = content.viewcount;
            if(view!=-1) {
                callback("Viewers: "+view);
            } else {
                callback("The livestream is offline.");
            }
        } else {
            callback("The livestream is offline.");
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
    if(simplified[0].toLowerCase() in commands) {
        var command = commands[simplified[0].toLowerCase()];
        if("action" in command)
            command.action(simplified, nick, chan, message, target, isMentioned, isPM);
    }else if(findUrls(message).length > 0) {
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
    }else if(isMentioned) {
        sendPM(target, nick+": Hello there!");
    } 
}

// Relays irc messages to clients

function ircRelayMessageHandle(c) {
    emitter.once('newIrcMessage', function (from, to, message) {
        if (c.writable) {
            c.write(from+':'+to+':'+message+'\r\n');
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
    var simplified = message.replace(/\:/g, ' ').replace(/\,/g, ' ').replace(/\./g, ' ').replace(/\?/g, ' ').trim().split(' ');
    var isMentioned = simplified.indexOf(NICK) !== -1;
    logChat(from, to, message, isMentioned);
    handleMessage(from, to, message, simplified, isMentioned, false);
});
bot.on('join', function (channel, nick) {
    if (nick === NICK) {
        mylog((" --> ".green.bold)+"You joined channel "+channel.bold);
        rl.setPrompt(util.format("> ".bold.magenta), 2);
        rl.prompt(true);
    } else {
        mylog((" --> ".green.bold)+'%s has joined %s', nick.bold, channel.bold);
    }
});
bot.on('kick', function (channel, nick, by, reason, message) {
    if (nick === NICK) {
        mylog((" <-- ".red.bold)+"You was kicked from %s by %s: %s", channel.bold, message.nick, reason);
        info("Rejoining "+channel.bold+" in 5 seconds...");
        setTimeout(function () {
            bot.join(channel);
        }, 5*1000);
    } else {
        mylog((" <-- ".red.bold)+nick+" was kicked from %s by %s: %s", channel.bold, message.nick, reason);
    }
})
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
        sendChat(line);
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
    emitter.emit('newIrcMessage', nick, chan, message);
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
