// Get current Parasprite Radio song
function getCurrentSong(sb, callback) {
	sb.fetchJSON("http://radio.djazz.se/api/status", function(error, content) {
		if(error === null) {
			if(content.meta != null && content.info != null && content.info.online === true) {
				var xt = content.meta;
				var theTitle = new Buffer(xt.title, "utf8").toString("utf8");
				var artist = xt.artist;
				if(artist!=null) {
					theTitle=theTitle+" by "+artist;
				}
				callback(theTitle, content.info.listeners, true);
				return;
			} else {
				 callback("\u00037Parasprite Radio\u000f is \u00034offline!", "", false);
			}
		} else {
			callback("\u00037Parasprite Radio\u000f is \u00034offline!", "", false);
		}
	});
}

// Livestream viewers
function livestreamViewerCount(sb, callback, stream, streamer) {
	if(stream === 0) {
		sb.fetchJSON("http://radio.djazz.se/api/status", function(error, content) {
			if(error===null) {
				var view = content.livestream;
				if(view.online===true) {
					callback(null, "\u00033Viewers: \u000311"+view.viewers);
				} else {
					callback("offline", "\u00034The livestream is offline");
				}
			} else {
				callback(error, "\u00034The livestream is offline");
			}
		});
	}
}

module.exports = function (squeebot, fname) {
	let commands = {
		"request":{action: (function(simplified, nick, chan, message, pretty, target) {
			if(simplified[1] && simplified[1] in bot.ircChannelUsers[chan])
				sendPM(target, simplified[1]+": To request a song, simply ask us. Provide a youtube link or just the song's title and artist!");
			else
				sendPM(target, nick+": To request a song, simply ask us. Provide a youtube link or just the song's title and artist!");
		}), categories: ["paraspriteradio", "community"]},

		"viewers":{action: (function(simplified, nick, chan, message, pretty, target) {
			livestreamViewerCount(squeebot, (function(r, a) { 
				if(r === "offline") 
					r = "\u00034The livestream is offline";
				else
					r = a;
				squeebot.sendPM(target, r+" \u00033Livestream: \u000312http://radio.djazz.se/#livestream");
			}), 0);
		}),alias: "livestream", categories: ["djazz", "community"]},

		"np":{action: (function(simplified, nick, chan, message, pretty, target) {
			getCurrentSong(squeebot, function(d, e, i) { 
				if(i) { 
					squeebot.sendPM(target, "\u00033Now playing: \u000312"+d+" \u00033Listeners: \u000312"+e+" \u00033Click here to tune in: \u000312http://radio.djazz.se/");
				} else { 
					squeebot.sendPM(target, d);
				}
			});
		}), alias: "radio", categories: ["paraspriteradio"]},

		"l":{action: (function(simplified, nick, chan, message, pretty, target) {
			getCurrentSong(squeebot, function(d, e, i) { 
				if(i) { 
					squeebot.sendPM(target, "\u00033Listeners: \u000312"+e+" \u00033Tune in: \u000312http://radio.djazz.se/");
				} else { 
					squeebot.sendPM(target, d);
				}
			});
		}), alias: "listeners", categories: ["paraspriteradio"]},

		"listeners":{action: (function() {commands.l.action.apply(null, arguments);}), description: "- Number of people listening to Parasprite Radio"},
		"radio":{action: (function() {commands.np.action.apply(null, arguments);}), description: "- Current song on Parasprite Radio"},
		"livestream":{action: (function() {commands.viewers.action.apply(null, arguments);}), description: "- Number of people watching djazz'es Livestream"},
	}

	squeebot.registerCommands(fname, commands)
}
