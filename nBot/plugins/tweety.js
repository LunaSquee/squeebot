/*jshint node: true*/
/*jshint evil: true*/

// This is a plugin for nBot (https://git.mindcraft.si.eu.org/?p=nBot.git)
// Before using: npm install node-twitter-api html-entities
// Have fun!
// ~ LunaSquee

"use strict";
// reserved nBot variables
var bot;
var pluginId;
var settings;
var pluginSettings;
var ircChannelUsers;

// requires
const twitterAPI = require('node-twitter-api'),
	  HTMLEntities = require('html-entities').AllHtmlEntities,
	  entities = new HTMLEntities();

// Twitter data
let twitter,
	twitterData = {},
	twitStreams = {},
	twitClient,
	twitClientSec;

// Plugin state
let pluginDisabled = false;

// Squeebot functions
let sendPM = null,
	log = null;

//settings constructor
var SettingsConstructor = function (modified) {
	var settings, attrname;
	if (this!==SettingsConstructor) {
		settings = {
			enableTweetTrack: false,
			tweetTrack: {"userid": ["#channel"]},
			authinfo: {
				app: null,
				app_secret: null,
				client: null,
				client_secret: null
			}
		};
		for (attrname in modified) {settings[attrname]=modified[attrname];}
		return settings;
	}
};

function addCommas(nStr) {
	nStr += '';
	let x = nStr.split('.');
	let x1 = x[0];
	let x2 = x.length > 1 ? '.' + x[1] : '';
	let rgx = /(\d+)(\d{3})/;
	while (rgx.test(x1)) {
		x1 = x1.replace(rgx, '$1' + ',' + '$2');
	}
	return x1 + x2;
}

var TwitterTracker = function(userid, channels) {
	this.stream = null;
	this.live = false;
	this.closeRequested = false;
	this.reconnTries = 0;
	this.channels = channels;
	this.userid = userid;
	this.user_handle = null;
	this.recvData = (error, data) => {
		this.reconnTries = 0;
		if(error) {
			log('\x1b[1;35m --\x1b[0m Twitter stream of ['+userid+'] errored!');
			console.log(error);
		} else {
			if("id_str" in data) {
				if(this.user_handle == null)
					this.user_handle = data.user.screen_name;
				if(data.in_reply_to_status_id === null && data.in_reply_to_user_id === null) {
					if(data.text.indexOf("RT") === 0 && data.user.screen_name != this.user_handle)
						return;
					channels.forEach((u) => {
						pluginObj.sendTweetResponse(data.id_str, u, 1);
					});
				}
			}
		}
	};
	this.recvFail = (e) => {
		log('\x1b[1;35m --\x1b[0m Twitter stream of ['+userid+'] ended!');
		this.stream = null;
		this.live = false;
		if (this.closeRequested === false && pluginDisabled === false) {
			if(this.reconnTries >= 3) {
				log("\x1b[1;35m --\x1b[0m Max reconnect tries reached! Gave up.");
				self.closeRequested = true;
				return;
			}
			this.reconnTries += 1;
			log("\x1b[1;35m --\x1b[0m Twitter stream reconnecting in 5s");
			setTimeout(() => {
				this.init();
			}, 5000);
		}
	};
	this.init = () => {
		log('\x1b[1;35m --\x1b[0m Twitter stream for '+userid+' starting, reporting on '+channels.length+' channels');
		this.live = true;
		
		twitter.users('show', {user_id: this.userid}, twitClient, twitClientSec, (error, data, response) => {
			if(error) {
				this.user_handle = null;
			} else {
				this.user_handle = data.screen_name;
			}
		});

		this.stream = twitter.getStream('filter', {follow: userid}, twitClient, twitClientSec, (e, d) => {
			this.recvData(e, d);
		}, (e) => {
			this.recvFail(e);
		});
	};

	this.kill = () => {
		this.closeRequested = true;
		if(this.stream) {
			this.stream.end();
			this.stream.destroy();
		}
	};
};

//main plugin object
var pluginObj = {
	sendTweetResponse: function(tweetId, target, showTwo) {
		twitter.statuses("show", {id:tweetId}, twitClient, twitClientSec, function(err, data) {
			if(err) {
				sendPM(target, "Status fetch failed!");
			} else {
				sendPM(target, "\u000310Twitter\u0003 \u00034♥ "+data.favorite_count+"\u0003 \u00033↱↲ "+data.retweet_count+"\u0003 \u0002@"+
					data.user.screen_name+"\u0002: "+entities.decode(data.text).replace(/\n/g, ' ').trim());
				if(showTwo == 1)
					sendPM(target, "\u0002Link to tweet:\u0002 https://twitter.com/"+data.user.screen_name+"/status/"+data.id_str);
			}
		});
	},
	twitStreamsInit: function() {
		log('\x1b[1;35m --\x1b[0m Twitter streams initiating');
		for(let trackUID in pluginSettings.tweetTrack) {
			let channels = pluginSettings.tweetTrack[trackUID];
			if(twitStreams[trackUID] != null)
				twitStreams[trackUID].kill();
			twitStreams[trackUID] = new TwitterTracker(trackUID, channels);
			twitStreams[trackUID].init();
		}
	},
	sendTweet: function(nick, msg, target) {
		if('tokens-'+nick.toLowerCase() in twitterData) {
			let dats = twitterData['tokens-'+nick.toLowerCase()];
			let etr = {status:msg};
			let tester;
			if((tester = msg.match(/R:(\d+[^\w\s]*)/)) != null) {
				etr.in_reply_to_status_id = tester[1];
				etr.status = etr.status.replace(tester[0], '');
			}
			twitter.statuses("update", etr, dats.acc, dats.accsec, function(err, data){
				if(err) {
					sendPM(target, "Status update failed!");
				} else {
					sendPM(target, "Success! https://twitter.com/"+data.user.screen_name+"/status/"+data.id_str);
				}
			});
		} else {
			sendPM(target, "You're not authenticated!");
		}
	},
	displayUser: function(screen_name, target) {
		twitter.users('show', {screen_name: screen_name}, twitClient, twitClientSec, function(error, data, response) {
			if(error) {
				sendPM(target, "No such user!");
			} else {
				sendPM(target, "\u0002@"+data.screen_name+"\u0002 ("+data.name+"): "+entities.decode(data.description).replace(/\n/g, ' ').trim());
				sendPM(target, "\u00033Tweets: \u000312"+addCommas(data.statuses_count)+" \u00033Following: \u000312"+
					addCommas(data.friends_count)+" \u00033Followers: \u000312"+addCommas(data.followers_count)+"\u000f");
			}
		});
	},
	initCommands: function() {
		var manePlugin = bot.plugins.squeebot.plugin;
		sendPM = manePlugin.sendPM;
		log = manePlugin.mylog;

		manePlugin.commandAdd(pluginId, "twitter", function(simplified, nick, chan, message, pretty, target, mentioned, isPM) {
			sendPM(target, nick+": Please specify a sub-command!");
		}, "- Twitter integration");

		manePlugin.commandAddSubcommand(pluginId, "twitter", "tweet", function(simplified, nick, chan, message, pretty, target, mentioned, isPM) {
			let msg = message.split(' ').slice(2).join(' ');
			pluginObj.sendTweet(nick, msg, target);
		}, "<tweet> - Post a tweet");

		manePlugin.commandAddSubcommand(pluginId, "twitter", "display", function(simplified, nick, chan, message, pretty, target, mentioned, isPM) {
			pluginObj.sendTweetResponse(simplified[1], target, 1);
		}, "<tweetid> - Display a tweet");

		manePlugin.commandAddSubcommand(pluginId, "twitter", "auth", function(simplified, nick, chan, message, pretty, target, mentioned, isPM) {
			if(simplified[1] != null) {
				if(simplified[1].toLowerCase() == "cancel") {
					if('reqtokens-'+nick.toLowerCase() in twitterData) {
						delete twitterData['reqtokens-'+nick.toLowerCase()];
						sendPM(target, "Authentication cancelled.");
					} else {
						sendPM(target, "You're not currently in authentication process.");
					}
					return;
				}
				if('reqtokens-'+nick.toLowerCase() in twitterData) {
					let tokens = twitterData['reqtokens-'+nick.toLowerCase()];
					twitter.getAccessToken(tokens.req, tokens.reqsec, simplified[1], function(error, accessToken, accessTokenSecret, results) {
						if (error) {
							console.log(error);
							sendPM(target, "An error occured while verifying.");
						} else {
							twitter.verifyCredentials(accessToken, accessTokenSecret, function(error, data, response) {
								if (error) {
									sendPM(target, "An error occured while trying to verify.");
								} else {
									sendPM(target, "You are now logged in as @"+data.screen_name+" ("+data.name+")!");
									sendPM(target, "Use '!twitter tweet <tweet>' to tweet as yourself.");
									twitterData['tokens-'+nick.toLowerCase()] = {acc:accessToken, accsec:accessTokenSecret};
									twitterData[nick.toLowerCase()] = data;
									delete twitterData['reqtokens-'+nick.toLowerCase()];
									log(data.screen_name+" verified for "+nick);
								}
							});
						}
					});
				}
			} else {
				twitter.getRequestToken(function(error, requestToken, requestTokenSecret, results){
					if (error) {
						console.log("Error getting OAuth request token : " + error);
						sendPM(target, "An error occured while trying to get you a token.");
					} else {
						twitterData['reqtokens-'+nick.toLowerCase()] = {req: requestToken, reqsec: requestTokenSecret};
						sendPM(target, "Please authenticate yourself: https://twitter.com/oauth/authenticate?oauth_token="+requestToken);
						sendPM(target, "Enter your pin by doing !twitter auth yourPINHere");
					}
				});
			}
		}, "[pin] - Authenticate yourself with Twitter");

		manePlugin.commandAddSubcommand(pluginId, "twitter", "authed", function(simplified, nick, chan, message, pretty, target, mentioned, isPM) {
			if(nick.toLowerCase() in twitterData) {
				let datr = twitterData['tokens-'+nick.toLowerCase()];
				twitter.verifyCredentials(datr.acc, datr.accsec, function(error, data, response) {
					if (error) {
						sendPM(target, "An error occured while trying to verify.");
						sendPM(target, "If this error persists, run !twitter logout and reauthenticate.");
					} else {
						twitterData[nick.toLowerCase()] = data;
						sendPM(target, "You're successfully authenticated as @"+twitterData[nick.toLowerCase()].screen_name+" ("+twitterData[nick.toLowerCase()].name+").");
					}
				});
			} else {
				sendPM(target, "You're not authenticated!");
			}
		}, "- Check your login status");

		manePlugin.commandAddSubcommand(pluginId, "twitter", "user", function(simplified, nick, chan, message, pretty, target, mentioned, isPM) {
			if(simplified[1] == null) {
				if(nick.toLowerCase() in twitterData) {
					let datr = twitterData['tokens-'+nick.toLowerCase()];
					twitter.verifyCredentials(datr.acc, datr.accsec, function(error, data, response) {
						if (error) {
							sendPM(target, "An error occured while trying to verify.");
							sendPM(target, "If this error presists, run !twitter logout and reauthenticate.");
						} else {
							twitterData[nick.toLowerCase()] = data;
							let xdata = twitterData[nick.toLowerCase()];
							sendPM(target, "\u0002@"+xdata.screen_name+"\u0002 ("+xdata.name+"): "+
								entities.decode(xdata.description).replace(/\n/g, ' ').trim());
							sendPM(target, "\u00033Tweets: \u000312"+addCommas(xdata.statuses_count)+" \u00033Following: \u000312"+
								addCommas(xdata.friends_count)+" \u00033Followers: \u000312"+addCommas(xdata.followers_count)+"\u000f");
						}
					});
				} else {
					sendPM(target, "You're not authenticated!");
				}
			} else {
				pluginObj.displayUser(simplified[1].replace(/^\@/, ''), target);
			}
		}, "[handle] - Display a Twitter profile");

		manePlugin.commandAddSubcommand(pluginId, "twitter", "retweet", function(simplified, nick, chan, message, pretty, target, mentioned, isPM) {
			if(simplified[1] != null && simplified[1].match(/\d+/g) != null) {
				let id = simplified[1].match(/\d+/g)[0];
				if('tokens-'+nick.toLowerCase() in twitterData) {
					let datr = twitterData['tokens-'+nick.toLowerCase()];
					twitter.statuses("retweet", {id:id}, datr.acc, datr.accsec, function(err, data){
						if(err) {
							sendPM(target, "Failed to retweet tweet!");
						} else {
							sendPM(target, "Success! https://twitter.com/"+data.user.screen_name+"/status/"+data.id_str);
						}
					});
				} else {
					sendPM(target, "You're not authenticated!");
				}
			} else {
				sendPM(target, "Invalid ID parameter!");
			}
		}, "<tweetid> - Retweet a tweet");

		manePlugin.commandAddSubcommand(pluginId, "twitter", "like", function(simplified, nick, chan, message, pretty, target, mentioned, isPM) {
			if(simplified[1] != null && simplified[1].match(/\d+/g) != null) {
				let id = simplified[1].match(/\d+/g)[0];
				if('tokens-'+nick.toLowerCase() in twitterData) {
					let datr = twitterData['tokens-'+nick.toLowerCase()];
					twitter.favorites("create", {id:id}, datr.acc, datr.accsec, function(err, data){
						if(err) {
							sendPM(target, "Failed to like tweet!");
						} else {
							sendPM(target, "Success! https://twitter.com/"+data.user.screen_name+"/status/"+data.id_str);
						}
					});
				} else {
					sendPM(target, "You're not authenticated!");
				}
			} else {
				sendPM(target, "Invalid ID parameter!");
			}
		}, "<tweetid> - Like a tweet");

		manePlugin.commandAddSubcommand(pluginId, "twitter", "follow", function(simplified, nick, chan, message, pretty, target, mentioned, isPM) {
			if(simplified[1] != null) {
				let iud = simplified[1].replace(/^\@/, '');
				if('tokens-'+nick.toLowerCase() in twitterData) {
					let datr = twitterData['tokens-'+nick.toLowerCase()];
					twitter.friendships("create", {screen_name:iud}, datr.acc, datr.accsec, function(err, data){
						if(err) {
							sendPM(target, "Failed to follow user!");
							console.log(err);
						} else {
							sendPM(target, "Successfully followed @"+data.screen_name+" ("+data.name+")!");
						}
					});
				} else {
					sendPM(target, "You're not authenticated!");
				}
			} else {
				sendPM(target, "Missing screen name!");
			}
		}, "<handle> - Follow a user");

		manePlugin.commandAddSubcommand(pluginId, "twitter", "unfollow", function(simplified, nick, chan, message, pretty, target, mentioned, isPM) {
			if(simplified[1] != null) {
				let iud = simplified[1].replace(/^\@/, '');
				if('tokens-'+nick.toLowerCase() in twitterData) {
					let datr = twitterData['tokens-'+nick.toLowerCase()];
					twitter.friendships("destroy", {screen_name:iud}, datr.acc, datr.accsec, function(err, data){
						if(err) {
							sendPM(target, "Failed to unfollowed user!");
							console.log(err);
						} else {
							sendPM(target, "Successfully unfollowed @"+data.screen_name+" ("+data.name+")!");
						}
					});
				} else {
					sendPM(target, "You're not authenticated!");
				}
			} else {
				sendPM(target, "Missing screen name!");
			}
		}, "<handle> - Unfollow a user");

		manePlugin.commandAddSubcommand(pluginId, "twitter", "logout", function(simplified, nick, chan, message, pretty, target, mentioned, isPM) {
			if(nick.toLowerCase() in twitterData) {
				delete twitterData[nick.toLowerCase()];
				delete twitterData['tokens-'+nick.toLowerCase()];
				sendPM(target, "You're now logged out.");
			} else {
				sendPM(target, "You're not authenticated!");
			}
		}, "- Log out");

		manePlugin.commandAddSubcommand(pluginId, "twitter", "stream", function(simplified, nick, chan, message, pretty, target, mentioned, isPM) {
			let i;
			let str;
			let list = [];

			switch(simplified[1].toLowerCase()) {
				case "end":
					sendPM(target, "Ending all twitter streams..");
					for(i in twitStreams) {
						let t = twitStreams[i];
						t.kill();
						delete twitStreams[i];
					}
					break;
				case "start":
					if(simplified[2] == null) {
						sendPM(target, "Starting all twitter streams..");
						pluginObj.twitStreamsInit();
						return;
					}

					str = simplified[2];
					if(pluginSettings.tweetTrack[str]) {
						twitStreams[str] = new TwitterTracker(str, pluginSettings.tweetTrack[str]);
						twitStreams[str].init();
					}
					break;
				case "list":
					for(i in twitStreams) {
						list.push((twitStreams[i].live === false ? "\u00034 " : "\u00033 ")+i);
					}
					sendPM(target, "Streams currently running:"+list.join(','));
					break;
				case "listall":
					for(i in pluginSettings.tweetTrack) {
						if(twitStreams[i])
							list.push((twitStreams[i].live === false ? "\u00034 " : "\u00033 ")+i);
						else
							list.push("\u00037 "+i);
					}
					sendPM(target, "Streams available:"+list.join(','));
					break;
				case "status":
					if(simplified[2] == null){
						sendPM(target, "Invalid target");
						return;
					}

					str = twitStreams[simplified[2]];
					if(str == null) {
						sendPM(target, "Invalid target");
						return;
					}

					sendPM(target, "Twitter stream ["+str.userid+"]"+(str.user_handle != null ? " (\u0002@"+str.user_handle+"\u0002)" : "")+
						" is "+(str.live === false ? "\u00034Offline" : "\u00033Online")+"\u000f broadcasting to: "+str.channels.join(', '));
					break;
			}
		}, "[end|start|list|listall|status] [<streamid>] - Stream management", 3);

		manePlugin.commandAddSubcommand(pluginId, "twitter", "admin", function(simplified, nick, chan, message, pretty, target, mentioned, isPM) {
			if(nick.toLowerCase() in twitterData) {
				bot.ircSendCommandPRIVMSG(nick+": Please log out before using admin account!", target);
				return;
			}
			twitter.verifyCredentials(pluginSettings.authinfo.client, pluginSettings.authinfo.client_secret, function(error, data, response) {
				if (error) {
					bot.ircSendCommandPRIVMSG(nick+": Admin account tokens failed to verify!", target);
				} else {
					bot.ircSendCommandPRIVMSG("You are now logged in as @"+data.screen_name+" ("+data.name+")!", target);
					twitterData[nick.toLowerCase()] = data;
					twitterData['tokens-'+nick.toLowerCase()] = {acc:pluginSettings.authinfo.client, accsec:pluginSettings.authinfo.client_secret};
				}
			});
		}, "- Login as admin", 3);

		//plugin is ready
		exports.ready = true;
		bot.emitBotEvent('botPluginReadyEvent', pluginId);
	}
};

//exports
module.exports.plugin = pluginObj;
module.exports.ready = false;

//reserved functions

//reserved functions: handle "botEvent" from bot (botEvent is used for irc related activity)
module.exports.botEvent = function (event) {
	//event is a object with properties "eventName" and "eventData"
	switch (event.eventName) {
		case 'botPluginDisableEvent': if (event.eventData == pluginId) {
			pluginDisabled = true;
			twitterData = {};
			for(var str in twitStreams) {
				var a = twitStreams[str];
				a.kill();
				delete twitStreams[str];
			}
		} break;
		case 'botPluginReadyEvent': if (event.eventData == "squeebot") {
			pluginObj.initCommands();
		} break;
	}
};

//reserved functions: main function called when plugin is loaded
module.exports.main = function (i, b) {
	//update variables
	bot = b;
	pluginId = i;
	settings = bot.options;
	pluginSettings = settings.pluginsSettings[pluginId];
	ircChannelUsers =  bot.ircChannelUsers;
	
	//if plugin settings are not defined, define them
	if (pluginSettings === undefined) {
		pluginSettings = new SettingsConstructor();
		settings.pluginsSettings[pluginId] = pluginSettings;
		bot.im.settingsSave();
	}

	twitter = new twitterAPI({
		consumerKey: pluginSettings.authinfo.app,
		consumerSecret: pluginSettings.authinfo.app_secret,
		callback: 'oob'
	});

	twitter.verifyCredentials(pluginSettings.authinfo.client, pluginSettings.authinfo.client_secret, function(error, data, response) {
		if (error) {
			log("\x1b[1;35m -*-\x1b[0m Twitter credentials are invalid!");
		} else {
			log("\x1b[1;35m -*-\x1b[0m Twitter credentials are valid! Twitter module ready");
			twitClient = pluginSettings.authinfo.client;
			twitClientSec = pluginSettings.authinfo.client_secret;
			twitterData[settings.botName] = data;
			if(pluginSettings.enableTweetTrack) {
				pluginObj.twitStreamsInit();
			}
		}
	});

	if (bot.plugins.squeebot && bot.plugins.squeebot.ready)
		pluginObj.initCommands();
};
