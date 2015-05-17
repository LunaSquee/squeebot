// djazz: A module adding commands to djazz'es services (Parasprite Radio, his Livestream etc)
// Written by LunaSquee
var Module = require("./core.js");
var myModule = new Module({});
var botobj;
var conf = {}

// Livestream viewers
function livestreamViewerCount(callback) {
    botobj.fetchJSON("http://djazz.se/live/info.php", function(success, content) {
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

// Get current Parasprite Radio song
function getCurrentSong(callback) {
    botobj.fetchJSON("http://radio.djazz.se/icecast.php", function(success, content) {
        if(success) {
            if(content.listeners != null) {
                botobj.fetchJSON("http://radiodev.djazz.se/api/now/json", function(xe, xt) {
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

myModule.load = function() {
	Object.getPrototypeOf(this).load.apply(this, arguments); // IMPORTANT LINE! DO NOT REMOVE!!!!
	botobj = this.bot;
	for(var i in this.config) {
		var value = this.config[i];
		if(i in conf)
			conf[i] = value;
	}

	var link = {
		"viewers":{"action":(function(simplified, nick, chan, message, target) {
	        livestreamViewerCount((function(r) { 
	            botobj.sendPM(target, r+" \u000303Livestream: \u000312http://djazz.se/live/")
	        }))
	    }),"description":"- Number of people watching djazz'es livestream"},

	    "radio":{"action":(function(simplified, nick, chan, message, target) {
	        getCurrentSong(function(d, e, i) { 
	            if(i) { 
	                botobj.sendPM(target, "\u000303Now playing: \u000312"+d+" \u000303Listeners: \u000312"+e+" \u000303Click here to tune in: \u000312http://radio.djazz.se/");
	            } else { 
	                botobj.sendPM(target, d);
	            }
	        })
	    }), "description":"- Tune in to Parasprite Radio"},

	    "np":{"action":(function(simplified, nick, chan, message, target) {
	        getCurrentSong(function(d, e, i) { 
	            if(i) { 
	                botobj.sendPM(target, "\u000303Now playing: \u000312"+d+" \u000303Listeners: \u000312"+e+" \u000303Click here to tune in: \u000312http://radio.djazz.se/");
	            } else { 
	                botobj.sendPM(target, d);
	            }
	        })
	    }), "description":"- Currently playing song on Parasprite Radio"}
	}

	botobj.linkCommands(link, "djazz");
}

myModule.unload = function() {
	Object.getPrototypeOf(this).unload.apply(this, arguments); // IMPORTANT LINE! DO NOT REMOVE!!!!
	botobj.unlinkCommands("djazz");
	botobj = null;
}


module.exports = myModule;