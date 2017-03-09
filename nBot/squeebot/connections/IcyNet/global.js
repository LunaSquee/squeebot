const net = require('net')

module.exports = function (squeebot, fname) {
	let commands = {
		"pque":{action: (function(simplified, nick, chan, message, pretty, target, isMentioned, isPM) {
			if (!simplified[1]) return

			let smlt = message.split(' ').slice(1).join(' ')
			let client = net.connect(1234, "192.168.8.137");

			client.on('connect', function () {
				client.write("queue.push smart:"+smlt+"\r\n");
				client.write("queue.queue\r\n");
				client.write("quit\r\n");
				client.end();
				if (!isPM) {
					squeebot.sendPM(target, "Request sent to streaming server..")
				}
			});
		}), categories: ["icedpotato"], permlevel: 10},

		"pskip":{action: (function(simplified, nick, chan, message, pretty, target, isMentioned, isPM) {
			let client = net.connect(1234, "192.168.8.137");

			client.on('connect', function () {
				client.write("skip\r\n");
				client.write("quit\r\n");
				client.end();
				if (!isPM) {
					squeebot.sendPM(target, "Skipping current song..")
				}
			});
		}), categories: ["icedpotato"], permlevel: 10}
	}

	squeebot.registerCommands(fname, commands);
}
