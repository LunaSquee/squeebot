module.exports = function (squeebot, fname) {
	let commands = {
		"skip":{action: (function(simplified, nick, chan, message, pretty, target, mentioned, isPM) {
			if(squeebot.settings.paraspritekey == null) return;
			var url = "http://radio.djazz.se/api/skip?apikey="+squeebot.settings.paraspritekey;

			squeebot.fetchJSON(url, function(err, res) {
				if(err) {
					squeebot.sendPM(target, "Skip failed.");
				} else {
					if(!isPM) {
						squeebot.sendPM(target, "Skipped song");
					}
				}
			});
		}),description:"- Skip the current song.", "permlevel":1, categories: ["paraspriteradio", "pradmin"]},

		"announce":{action: (function(simplified, nick, chan, message, pretty, target, mentioned, isPM) {
			if(settings.paraspritekey == null) return;
			var text = "";
			if(!simplified[1]) {
				squeebot.sendPM(target, nick+": Not enough parameters!");
				return;
			}

			text = message.split(" ").slice(1).join(" ");
			var url = "http://radio.djazz.se/api/announce?apikey=" + squeebot.settings.paraspritekey + "&message=" + encodeURIComponent(text);

			squeebot.fetchJSON(url, function(err, res) {
				if(err) {
					squeebot.sendPM(target, "Announce failed.");
				} else {
					if(!isPM) {
						squeebot.sendPM(target, "Announcement sent!");
					}
				}
			});
		}),description:"[say:]<message> - Play an announcement on radio.", permlevel:1, categories: ["paraspriteradio", "pradmin"]},

		"queue":{action: (function(simplified, nick, chan, message, pretty, target, mentioned, isPM) {
			var det;
			if(squeebot.settings.paraspritekey == null) return;
			if(!simplified[1]) {
				squeebot.sendPM(target, nick+": Not enough parameters!");
				return;
			}

			var src = message.split(" ").slice(1).join(" ");

			if(src === "") {
				squeebot.sendPM(target, nick+": Error occured!");
				return;
			}

			var url = "http://radio.djazz.se/api/queue?apikey=" + squeebot.settings.paraspritekey + "&add="+encodeURIComponent(src);

			squeebot.fetchJSON(url, function(err, res) {
				if(err) {
					squeebot.sendPM(target, "Queue failed.");
				} else {
					if(!isPM) {

						if(src.indexOf("soundcloud.com") !== -1) {
							squeebot.getSoundcloudFromUrl(src, target, true);
						} else if(src.indexOf("youtu.be/") !== -1) {
							det = src.match(/youtu.be\/([^\?\&\#]+)/i)[1];
							if(det) {
								squeebot.getYoutubeFromVideo(det, target, true);
							}
						} else if(src.indexOf("youtube.com/") !== -1) {
							det = src.match("[\\?&]v=([^&#]*)");
							if(det) {
								squeebot.getYoutubeFromVideo(det[1], target, true);
							}
						} else {
							squeebot.sendPM(target, "Queued!");
						}
					}
				}
			});
		}),description:"<file/url> - Queue a song.", permlevel:1, categories: ["paraspriteradio", "pradmin"]}
	}

	squeebot.registerCommands(fname, commands)
}
