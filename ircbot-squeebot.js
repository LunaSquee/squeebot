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
var gamedig = require('gamedig');
var fs = require('fs');
var path = require('path');
var events = require("events");
var emitter = new events.EventEmitter();
var settings = require("./settings.json");
var g_api = settings.googleapikey;
var _modules = {};

// Config
var SERVER = settings.server;       // The server we want to connect to
var PORT = settings.port || 6667;   // The connection port which is usually 6667
var NICK = settings.username;       // The bot's nickname
var IDENT = settings.password;      // Password of the bot. Set to null to not use password login.
var REALNAME = 'LunaSquee\'s bot';  // Real name of the bot
var CHANNEL = settings.channel;     // The default channel(s) for the bot
var PREFIX = settings.prefix;       // The prefix of commands
// Episode countdown (!nextep)
var airDate = Date.UTC(2015, 4-1, 4, 15, 30, 0); // Year, month-1, day, hour, minute, second (UTC)
var week = 7*24*60*60*1000;

// Handle unexpected errors.
process.on('uncaughtException', function (err) {
    console.log(err.stack);
});

// rules/infoc: Rules and information for individual channels.
// botops: Bot operators (soon to be implementing)
var p_vars = {
    rules:{"#bronytalk":["No spam of any kind.", "No IRC bots (unless said otherwise by ops)", "No insulting others."],
            "#parasprite":["No spam of any kind.", "No IRC bots (unless said otherwise by ops)", "No insulting others."]},
    infoc:{"#bronytalk":"This IRC channel was created by LunaSquee and djazz. It is the main IRC channel for mlp-episodes site and Parasprite Radio",
            "#parasprite":"This IRC channel was created by LunaSquee and djazz. It is the main IRC channel for mlp-episodes site and Parasprite Radio"},
    botops:{"icydiamond":1}
}
// The target channel of the bot's input field.
var chattarget = "";
// This is the list of all your commands.
// "command":{"action":YOUR FUNCTION HERE, "description":COMMAND USAGE(IF NOT PRESENT, WONT SHOW UP IN !commands)}
var commands = {
    "help":{"action":(function(simplified, nick, chan, message, target) {
        if(simplified[1]) {
            var cmdName = (simplified[1].indexOf(PREFIX) === 0 ? simplified[1].substring(1) : simplified[1]);
            if(cmdName in commands) {
                var cmd = commands[cmdName];
                if(cmd.description) {
                    sendPM(target, nick+": \u0002"+PREFIX+cmdName+"\u000f "+cmd.description+("oper" in cmd ? (cmd.oper === 1 ? " \u0002[BOTOP ONLY]" : " \u0002[CHANOP ONLY]") : ""));
                } else {
                    sendPM(target, nick+": \u0002"+PREFIX+cmdName+"\u000f - Undefined command!");
                }
            } else {
                sendPM(target, nick+": That is not a known command!");
            }
        } else {
            listCommands(nick, target);
        }
    }), "description":"[command] - All Commands"},

    "squeebot":{"action":(function(simplified, nick, chan, message, target) {
        sendPM(target, "Squeebot is an IRC bot written by LunaSquee and djazz.");
        if(simplified[1] && simplified[1].toLowerCase()==="source")
            sendPM(target, nick+", You can see the source here: https://github.com/LunaSquee/squeebot");
    }), "description":"[source] - Squeebot info"},
    
    "info":{"action":(function(simplified, nick, chan, message, target, mentioned, pm) {
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
    }),"description":"s<Season>e<Episode Number> - Open a pony episode"},

    "moduleload":{"action":(function(simplified, nick, chan, message, target, m, pm) {
        if(!isGlobalOp(nick)) {
            sendPM(target, nick+": You do not have permission to execute this command.");
            return;
        }
        if(simplified[1] == null) {
            sendPM(target, nick+": Please provide module name.");
            return;
        }
        loadModule(simplified[1]);
    }),"description":"<module> - Loads a bot module", "oper": 1},

    "moduleunload":{"action":(function(simplified, nick, chan, message, target, m, pm) {
        if(!isGlobalOp(nick)) {
            sendPM(target, nick+": You do not have permission to execute this command.");
            return;
        }
        if(simplified[1] == null) {
            sendPM(target, nick+": Please provide module name.");
            return;
        }
        unloadModule(simplified[1]);
    }),"description":"<module> - Unloads a bot module", "oper": 1},

    "modulereload":{"action":(function(simplified, nick, chan, message, target, m, pm) {
        if(!isGlobalOp(nick)) {
            sendPM(target, nick+": You do not have permission to execute this command.");
            return;
        }
        if(simplified[1] == null) {
            sendPM(target, nick+": Please provide module name.");
            return;
        }
        reloadModule(simplified[1]);
    }),"description":"<module> - Reloads a bot module", "oper": 1}
};

/*
    =============
    MODULE SYSTEM
    =============
*/

// Load a single module
function loadModule(mod) {
    // Check if its already loaded
    if(mod in _modules) {
        console.log("This module is already loaded!");
        return;
    }

    // Get absolute path for the module
    var ppath = path.resolve("./modules/"+mod+".js");
    // Base config object
    var config = {};

    // Check if the file exists
    if (!fs.existsSync(ppath)) {
        console.log("That module doesn't exist!");
        return;
    }

    //  Being loading
    try{
        // Loads module
        var module = require(ppath);
        // Deletes module script from cache (We don't want it to cache modules!)
        if(require.cache && require.cache[ppath])
            delete require.cache[ppath];

        // If the require fails, cancel
        if(!module) {
            console.log("Loading module "+mod+" failed!");
            return;
        }
        // If the module script exists (Double check!)
        if(module === _modules[mod])
            return;
        // If the module has defined confugration for it in settings, load that in.
        if(mod in settings.modules)
            config = settings.modules[mod];
        // Initiate loading and save it
        module.load(mod, bot, config);
        module.starttime = Date();
        _modules[mod] = module;
    } catch(err) {
        mylog("An error occured while trying to load "+mod+"!");
        console.log(err);
        mylog("Please try reloading it.");
    }
}

// Unload a module
function unloadModule(mod) {
    if(!mod in _modules) {
        console.log("That module doesn't exist!");
        return;
    }

    _modules[mod].unload(bot);
    delete _modules[mod];
}

// Reload a module
function reloadModule(mod, bot) {
    if(!mod in _modules) {
        console.log("That module doesn't exist!");
        return;
    }

    if(mod in _modules)
        unloadModule(mod);
    setTimeout(function() {loadModule(mod)}, 500);
}

// Load a set of modules
function loadModules(list) {
    info("Loading modules..");
    if(!list) {
        var list = [];
        for(var i in settings.modules) {
            var modl = settings.modules[i];
            if("autorun" in modl && modl.autorun === true)
                list.push(i);
        }
    }

    if(!Array.isArray(list))
        list = [list];

    for(var i = 0; i < list.length; i++)
        loadModule(list[i]);
}

function reloadAllModules() {
    if(!list) {
        var list = [];
        for(var i in settings.modules) {
            var modl = settings.modules[i];
            if("autorun" in modl && modl.autorun === true)
                list.push(i);
        }
    }

    if(!Array.isArray(list))
        list = [list];

    for(var i = 0; i < list.length; i++)
        reloadModule(list[i]);
}

/*
    ===================
    NICKNAME UTILITIES!
    ===================
*/
var iconvert = {};

function getModeOfNick(username, onChannel) {
    var channel = onChannel.toLowerCase();
    var chans = bot.chans;
    if(channel in chans && "users" in chans[channel]) {
        if(username in chans[channel]["users"]) {
            return chans[channel]["users"][username];
        }
    }
}

function isOpOnChannel(username, channel) {
    var mode = getModeOfNick(username, channel.toLowerCase());
    if(mode != null) {
        if(mode == "@" || mode == "&" || mode == "~")
            return true;
    }
    return false;
}

function isGlobalOp(username) {
    if("botops" in p_vars) {
        if(username.toLowerCase() in p_vars.botops) {
            return true;
        }
    }
    return false;
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

// POLYFILLS!

Object.size = function(obj) {
    var size = 0, key;
    for (key in obj) {
        if (obj.hasOwnProperty(key)) size++;
    }
    return size;
};

/*
    End of Misc. Utils.
*/

/* APIs */
function getYoutubeFromVideo(id, target) {
    if(g_api == null) return;
    var g_api_base = "https://www.googleapis.com/youtube/v3/videos?id="+id+"&key="+g_api+"&part=snippet,contentDetails,statistics,status&fields=items(id,snippet,statistics,contentDetails)";
    fetchJSON_HTTPS(g_api_base, function(success, content) {
        if(success==false) return;
        if("items" in content) {
            var tw = content.items[0];
            sendPM(target, "\u0002You\u000305Tube\u000f \u000312\""+tw.snippet.title+"\" \u000303Views: \u000312"+addCommas(tw.statistics.viewCount.toString())+" \u000303Duration: \u000312"+ytDuration(tw.contentDetails.duration.toString())+" \u000303By \u000312\""+tw.snippet.channelTitle+"\"");
        }
    });
}
/* END */

// List all commands that have a description set
function listCommands(nick, target) {
    var comms = [];
    var listofem = [];
    var variab = false;
    comms.push("All "+NICK+" commands start with a "+PREFIX+" prefix.");
    comms.push("Type "+PREFIX+"help <command> for more information on that command.");
    for(var command in bot.commands) {
        var obj = bot.commands[command];
        if("description" in obj && !("oper" in obj)) {
            variab = !variab;
            listofem.push("\u0002"+irc.colors.wrap((variab?"dark_green":"light_green"), command));
        }
    }
    comms.push(listofem.join(" "));
    sendWithDelay(comms, target, 1000);
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
                        var theTitle = new Buffer(content.title, "utf8").toString("utf8");
                        var splitUp = theTitle.replace(/\&amp;/g, "&").split(" - ");
                        if(splitUp.length===2) {
                            theTitle=splitUp[1]+(splitUp[0]?" by "+splitUp[0]:"");
                        }
                        callback(theTitle, content.listeners, true);
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
        var command = bot.commands[simplified[0].toLowerCase().substring(1)];
        if("action" in command)
            command.action(simplified, nick, chan, message, target, isMentioned, isPM);
    }else if(isPM && simplified[0].toLowerCase() in commands) {
        var command = bot.commands[simplified[0].toLowerCase()];
        if("action" in command)
            command.action(simplified, nick, chan, message, target, isMentioned, isPM);
    }else if(findUrls(message).length > 0) {
        var link = findUrls(message)[0];
        if(link.indexOf("youtu.be") !== -1) {
        var det = link.substring(link.indexOf('.be/')+4);
            if(det) {
                getYoutubeFromVideo(det, target);
            }
        } else if(link.indexOf("youtube.com") !== -1) {
        var det = link.match("[\\?&]v=([^&#]*)")[1];
            if(det) {
                getYoutubeFromVideo(det, target);
            }
        } else if(link.indexOf("dailymotion.com/video/") !== -1) {
            var det = link.match("/video/([^&#]*)")[1];
            if(det) {
                dailymotion(det, (function(data) {
                    sendPM(target, "\u0002\u000303Dailymotion\u000f \u000312\""+data.title+"\" \u000303Views: \u000312"+data.views_total.toString().addCommas()+" \u000303Duration: \u000312"+data.duration.toString().toHHMMSS()+" \u000303By \u000312\""+data["owner.screenname"]+"\"");
                }))
            }
        }
    }
}

// Relays irc messages to connected clients
function ircRelayMessageHandle(c) {
    emitter.once('newIrcMessage', function (from, to, message, type) {
        if (c.writable) {
            c.write(type+">"+from+':'+to+':'+message+'\r\n');
            ircRelayMessageHandle(c);
        }
    });
}

// Creates a new relay server
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
function p_vars_load(olog) {
    fs.readFile('savedvars.json', 'utf8', function (err, data) {
      if (err) return;
      p_vars = JSON.parse(data);
      if(olog)
        mylog('Variables object loaded.');
    });
}

//*******************************************************************************************************
// This is where the magic happens
//*******************************************************************************************************

var bot = new irc.Client(SERVER, NICK, {
    channels: Array.isArray(CHANNEL) ? CHANNEL : [CHANNEL],
    password: IDENT,
    realName: REALNAME,
    userName: "squeebot",
    port: PORT,
    //secure: true,
    //certExpired: true,
    stripColors: true
});

var lasttopic = {};

bot.on('error', function (message) {
    info('ERROR: %s: %s', message.command, message.args.join(' '));
});
bot.on('topic', function (channel, topic, nick) {
    channel = channel.toLowerCase();
    lasttopic[channel] = {"topic":topic, "nick": nick};
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
        chattarget = channel.toLowerCase();
        rl.prompt(true);
    } else {
        mylog((" --> ".green.bold)+'%s has joined %s', nick.bold, channel.bold);
        emitter.emit('newIrcMessage', nick, channel, " has joined ", "JOIN");
//        handleChannelJoin(nick, channel);
    }
});
bot.on('kick', function (channel, nick, by, reason, message) {
    if (nick === NICK) {
        mylog((" <-- ".red.bold)+"You were kicked from %s by %s: %s", channel.bold, message.nick, reason);
        info("Rejoining "+channel.bold+" in 5 seconds...");
//        handleBotLeft(channel);
        setTimeout(function () {
            bot.join(channel);
        }, 5*1000);
    } else {
        mylog((" <-- ".red.bold)+nick+" was kicked from %s by %s: %s", channel.bold, message.nick, reason);
        emitter.emit('newIrcMessage', nick, channel, " was kicked by "+message.nick+" ("+reason+")", "KICK");
//        handleChannelPart(nick, channel);
    }
});
bot.on('part', function (channel, nick, reason) {
    if (nick !== NICK) {
        mylog((" <-- ".red.bold)+'%s has left %s', nick.bold, channel.bold);
        emitter.emit('newIrcMessage', nick, channel, " has left ", "PART");
    } else {
        mylog((" <-- ".red.bold)+'You have left %s', channel.bold);
    }
});
bot.on('quit', function (nick, reason, channels) {
    mylog((" <-- ".red.bold)+'%s has quit (%s)', nick.bold, reason);
    emitter.emit('newIrcMessage', nick, "", " has quit ("+reason+")", "QUIT");
});
bot.on('ctcp', function (from, to, text, type) {
    mylog(("-> CTCP ".magenta.bold)+'%s | %s said: %s', type.toUpperCase(), from.bold, text);
});
bot.on('ctcp-version', function (from, to) {
    mylog(("-> CTCP ".magenta.bold)+'%s asked for VERSION. Replying', from.bold);
    bot.ctcp(from, "version", "VERSION IRC Bot by LunaSquee. https://github.com/LunaSquee/squeebot");
});
bot.on('names', function(channel, nicks) {
    // Implement all you want. lol
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
    mylog("* MODE +%s %s by %s", mode, argument || channel, by || message.server);
});
bot.on('-mode', function(channel, by, mode, argument, message) {
    mylog("* MODE -%s %s by %s", mode, argument || channel, by || message.server);
});
bot.on('nick', function(oldNick, newNick, channels) {
    emitter.emit('newIrcMessage', oldNick, "", " is now known as "+newNick, "NICK");
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
        if(chan!=null)
            bot.join(chan);
        else
            mylog("Not enough arguments for JOIN.");
    } else if (line.indexOf('/vars ') === 0) {
        var c = line.substr(6);
        if(c!=null && c!="") {
            if(c=="save"){
                p_vars_save();
            }else if(c=="load"){
                p_vars_load(true);
            }
        }
    } else if (line.indexOf('/part ') === 0) {
        var chan = line.substr(6);
        bot.part(chan, NICK+" goes bye bye from this channel.");
    } else if (line.indexOf('/me ') === 0) {
        var msg = line.substr(4);
        if(msg!=null && msg=="")
            bot.action(chattarget, msg);
        else
            mylog("Not enough arguments for ACTION.");
    } else if (line === '/topic') {
        if(chattarget in lasttopic)
            logTopic(chattarget, lasttopic[chattarget].topic, lasttopic[chattarget].nick);
    } else if (line.indexOf('/t') === 0) {
        var msg = line.split(" ");
        if(msg[1]!=null) {
            if(msg[1].toLowerCase() in bot.chans) {
                chattarget = msg[1].toLowerCase();
                info("You're now talking to "+chattarget);
            } else {
                info("You're not connected to "+msg[1]);
            }
        } else {
            mylog("Not enough arguments for target. Usage: /t #channel");
        }
    } else if (line.indexOf('/module') === 0) {
        var msg = line.split(" ");
        if(msg[1] && msg[2]) {
            if(msg[1].toLowerCase() === "load") {
                info("Loading module "+msg[2]);
                loadModule(msg[2]);
            } else if(msg[1].toLowerCase() === "reload") {
                info("Reloading module "+msg[2]);
                reloadModule(msg[2]);
            } else if(msg[1].toLowerCase() === "unload") {
                info("Unloading module "+msg[2]);
                unloadModule(msg[2]);
            } else {
                mylog("Not enough arguments for module. Usage: /module <reload/load/unload> <module>");
            }
        } else if(msg[1]==="reloadall") {
            info("Reloading all modules");
            reloadAllModules();
        } else if(msg[1]==="listall") {
            if(Object.size(_modules) > 0)
                info("Currently loaded modules: ");
            else
                info("There are no modules running at this time.");

            for(var t in _modules) {
                var data = _modules[t];
                mylog("* "+t+" - "+data.starttime);
            }
        } else {
            mylog("Not enough arguments for module. Usage: /module <reload/load/unload/listall> [<module>]");
        }
    } else if (line.indexOf('/ops') === 0) {
        var msg = line.split(" ");
        if(msg[1] == "add" && msg[2]) {
            if(isGlobalOp(msg[2])) {
                info(msg[2]+" is already a bot operator!");
            } else {
                p_vars.botops[msg[2].toLowerCase()] = 6;
                info(msg[2]+" is now a bot operator!");
            }
        } else if(msg[1] == "del" && msg[2]) {
            if(isGlobalOp(msg[2].toLowerCase())) {
                info(msg[2]+" is no longer a bot operator!");
                delete p_vars.botops[msg[2]];
            } else {
                info(msg[2]+" is not a bot operator!");
            }
        } else if(msg[1] == "test" && msg[2]) {
            if(isGlobalOp(msg[2].toLowerCase())) {
                info(msg[2]+" is a bot operator!");
            } else {
                info(msg[2]+" is not a bot operator!");
            }
        } else if(msg[1] == "list") {
            var listof = []
            for(var y in p_vars.botops) listof.push(y);
            mylog("* Current bot operators are: "+listof.join(", "));
        } else {
            info("Usage: /ops <add/del/list> [nickname]".red);
        }
    } else if (line.indexOf("/") === 0) {
        info(("Unknown command "+line.substr(1).bold).red);
    } else {
        sendChat(formatmesg(line));
    }
    rl.prompt(true);
});

rl.on('SIGINT', function() {
    info("Quitting...");
    rl.setPrompt("");
    bot.disconnect("^C received. Bye!", function () {
        process.exit(0);
    });
});

bot.settings = settings;
bot.commands = commands;

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
    logChat(NICK, chattarget, message);
    bot.say(chattarget, message);
}

function sendPM(target) {
    if (target === chattarget) {
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

bot.fetchJSON = fetchJSON;
bot.fetchJSON_HTTPS = fetchJSON_HTTPS;
bot.consolePrint = mylog;
bot.consoleInfo = info;
bot.isGlobalOp = isGlobalOp;
bot.isOpOnChannel = isOpOnChannel;
bot.sendPM = sendPM;
bot.logChat = logChat;

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

// Load all modules after everything else is set.
loadModules();
// Load stored variables
p_vars_load(false);