
function getCurrentSong(sb, callback) {
	sb.fetchJSON("https://europa.shoutca.st/rpc/smtv33/streaminfo.get", function(error, content) {
		if (error) return callback("\u00037[smowtv] radio\u000f is \u00034offline!", "", false);
		if (!content.data) return callback("\u00037[smowtv] radio\u000f is \u00034offline!", "", false);

		let radio = content.data[0]

		if(radio.song != null && radio.sourcestate === true) {
			return callback(radio.song, radio.listeners, true);
		}

		callback("\u00037[smowtv] radio\u000f is \u00034offline!", "", false);
	});
}

module.exports = function (squeebot, fname) {
	let commands = {
		"np":{action: (function(simplified, nick, chan, message, pretty, target) {
			getCurrentSong(squeebot, function(d, e, i) { 
				if(i) { 
					squeebot.sendPM(target, "\u00033Now playing:\u0003 \u000312" + d + " \u00033Listeners:\u0003 \u000312" + e +
						"\u0003 \u00033Click here to tune in:\u0003 \u000312http://smowtv.pw/player/");
				} else { 
					squeebot.sendPM(target, d);
				}
			});
		}), alias: "radio", categories: ["smowtvradio"]},

		"radio":{action: (function() {commands.np.action.apply(null, arguments);}), description: "- Current song on [smowtv]"},
		"station":{action: (function() {commands.np.action.apply(null, arguments);}), alias: "radio"},
	}

	squeebot.registerCommands(fname, commands)
}
