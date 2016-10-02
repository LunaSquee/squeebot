/*jshint node: true*/
/*jshint evil: true*/

// This is a plugin for nBot (https://git.mindcraft.si.eu.org/?p=nBot.git)
// Before using: npm install node-twitter-api html-entities
// Have fun!
// ~ LunaSquee

"use strict";
//reserved nBot variables
var botObj;
var pluginId;
var botF;
var botV;
var settings;
var pluginSettings;
var ircChannelUsers;

//variables
var http = require('http');
var net = require('net');
var fs = require('fs');
var util = require('util');
var events = require('events');
var exec = require('child_process').exec;
var path = require('path');
var Entities = require('html-entities').AllHtmlEntities;

var entities = new Entities();

var twitterAPI = require('node-twitter-api');
var twitter;
var twitterData = {};

var twitClient;
var twitClientSec;

var twitStreams = {}

var pluginDisabled = false;

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
	var x = nStr.split('.');
	var x1 = x[0];
	var x2 = x.length > 1 ? '.' + x[1] : '';
	var rgx = /(\d+)(\d{3})/;
	while (rgx.test(x1)) {
	    x1 = x1.replace(rgx, '$1' + ',' + '$2');
	}
	return x1 + x2;
}

var TwitterTracker = function(userid, channels) {
	this.stream = null
	this.live = false
	this.closeRequested = false
	this.reconnTries = 0
	this.channels = channels
	this.userid = userid
	this.user_handle = null
	this.recvData = function(error, data) {
		this.reconnTries = 0
		if(error) {
			console.log('\x1b[1;35m --\x1b[0m Twitter stream of ['+userid+'] errored!')
			console.log(error)
		} else {
			if("id_str" in data) {
				if(this.user_handle == null)
					this.user_handle = data.user.screen_name
				if(data.in_reply_to_status_id === null && data.in_reply_to_user_id === null) {
					if(data.text.indexOf("RT") === 0 && data.user.screen_name != this.user_handle)
						return
					channels.forEach(function(u) {
						pluginObj.sendTweetResponse(data.id_str, u, 1)
					})
				}
			}
		}
	}
	this.recvFail = function(e) {
		var self = this
		console.log('\x1b[1;35m --\x1b[0m Twitter stream of ['+userid+'] ended!')
		self.stream = null
		self.live = false
		if (self.closeRequested == false && pluginDisabled == false) {
			if(self.reconnTries >= 3) {
				console.log("\x1b[1;35m --\x1b[0m Max reconnect tries reached! Gave up.")
				self.closeRequested = true
				return
			}
			self.reconnTries += 1
			console.log("\x1b[1;35m --\x1b[0m Twitter stream reconnecting in 5s")
			setTimeout(function() {
				self.init()
			}, 5000)
		}
	}
	this.init = function() {
		console.log('\x1b[1;35m --\x1b[0m Twitter stream for '+userid+' starting, reporting on '+channels.length+' channels')
		var self = this
		this.live = true
		
		twitter.users('show', {user_id: self.userid}, twitClient, twitClientSec, function(error, data, response) {
			if(error) {
				self.user_handle = null
			} else {
				self.user_handle = data.screen_name
			}
		})

		this.stream = twitter.getStream('filter', {follow: userid}, twitClient, twitClientSec, function(e, d) {
			self.recvData(e, d)
		}, function(e) {
			self.recvFail(e)
		})
	}

	this.kill = function() {
		this.closeRequested = true
		if(this.stream) {
			this.stream.end()
			this.stream.destroy()
		}
	}
}

//main plugin object
var pluginObj = {
	sendTweetResponse: function(tweetId, target, showTwo) {
		twitter.statuses("show", {id:tweetId}, twitClient, twitClientSec, function(err, data){
			if(err) {
				botF.ircSendCommandPRIVMSG("Status fetch failed!", target);
			} else {
				botF.ircSendCommandPRIVMSG("\u000310Twitter\u0003 \u0002@"+data.user.screen_name+"\u0002: "+entities.decode(data.text).replace(/\n/g, ' ').trim(), target);
				if(showTwo == 1)
					botF.ircSendCommandPRIVMSG("\u0002Link to tweet:\u0002 https://twitter.com/"+data.user.screen_name+"/status/"+data.id_str, target);
			}
		});
	},
	twitStreamsInit: function() {
		console.log('\x1b[1;35m --\x1b[0m Twitter streams initiating')
		for(var trackUID in pluginSettings.tweetTrack) {
			var channels = pluginSettings.tweetTrack[trackUID]
			if(twitStreams[trackUID] != null)
				twitStreams[trackUID].kill()
			twitStreams[trackUID] = new TwitterTracker(trackUID, channels)
			twitStreams[trackUID].init()
		}
	},
	sendTweet: function(nick, msg, target) {
		if('tokens-'+nick.toLowerCase() in twitterData) {
			var dats = twitterData['tokens-'+nick.toLowerCase()];
			var etr = {status:msg};
			var tester;
			if((tester = msg.match(/R:(\d+[^\w\s]*)/)) != null) {
				etr.in_reply_to_status_id = tester[1];
				etr.status = etr.status.replace(tester[0], '');
			}
			twitter.statuses("update", etr, dats.acc, dats.accsec, function(err, data){
				if(err) {
					botF.ircSendCommandPRIVMSG("Status update failed!", target);
				} else {
					botF.ircSendCommandPRIVMSG("Success! https://twitter.com/"+data.user.screen_name+"/status/"+data.id_str, target);
				}
			});
		} else {
			botF.ircSendCommandPRIVMSG("You're not authenticated!", target);
		}
	},
	displayUser: function(screen_name, target) {
		twitter.users('show', {screen_name: screen_name}, twitClient, twitClientSec, function(error, data, response) {
			if(error) {
				botF.ircSendCommandPRIVMSG("No such user!", target);
			} else {
				botF.ircSendCommandPRIVMSG("\u0002@"+data["screen_name"]+"\u0002 ("+data["name"]+"): "+entities.decode(data["description"]).replace(/\n/g, ' ').trim(), target);
				botF.ircSendCommandPRIVMSG("\u00033Tweets: \u000312"+addCommas(data["statuses_count"])+" \u00033Following: \u000312"+addCommas(data["friends_count"])+" \u00033Followers: \u000312"+addCommas(data["followers_count"])+"\u000f", target);
			}
		});
	},
	initCommands: function() {
		var manePlugin = botObj.pluginData.squeebot.plugin;
		manePlugin.commandAdd(pluginId, "tw", function(simplified, nick, chan, message, pretty, target, mentioned, isPM) {
			if(simplified[1] != null) {
				var msg = message.split(' ').slice(1).join(' ');
				pluginObj.sendTweet(nick, msg, target);
			}
		});

		manePlugin.commandAdd(pluginId, "twitter", function(simplified, nick, chan, message, pretty, target, mentioned, isPM) {
			var isOp = manePlugin.permlevel(pretty.rawdata[0].split(' ')[0]) >= 2;
			if(simplified[1] === "status" && simplified[2] != null) {
				if(!isOp) {
					botF.ircSendCommandPRIVMSG(nick+": You do not have permission to execute this command!", target);
					return;
				}
				var msg = message.split(' ').slice(2).join(' ');
				twitter.statuses("update", {status:msg}, twitClient, twitClientSec, function(err, data){
					if(err) {
						botF.ircSendCommandPRIVMSG("Status update failed!", target);
					} else {
						botF.ircSendCommandPRIVMSG("Success! https://twitter.com/"+data.user.screen_name+"/status/"+data.id_str, target);
					}
				});
			} else if(simplified[1] === "tweet" && simplified[2] != null) {
				var msg = message.split(' ').slice(2).join(' ');
				pluginObj.sendTweet(nick, msg, target);
			} else if(simplified[1] === "display" && simplified[2] != null) {
				pluginObj.sendTweetResponse(simplified[2], target, 1);
			} else if(simplified[1] === "stream" && simplified[2] != null) {
				if(!isOp) {
					botF.ircSendCommandPRIVMSG(nick+": You do not have permission to execute this command!", target);
					return;
				}
				if(simplified[2] == "end") {
					if(simplified[3] == null) {
						botF.ircSendCommandPRIVMSG("Ending all twitter streams..", target);
						for(var s in twitStreams) {
							var t = twitStreams[s]
							t.kill()
							delete twitStreams[s]
						}
						return
					}
					var stream = twitStreams[simplified[3]]
					if(stream) {
						botF.ircSendCommandPRIVMSG("Ending twitter stream..", target)
						stream.kill()
						delete twitStreams[simplified[3]]
					}
				} else if(simplified[2] == "start") {
					if(simplified[3] == null) {
						botF.ircSendCommandPRIVMSG("Starting all twitter streams..", target)
						pluginObj.twitStreamsInit()
						return
					}

					var str = simplified[3]
					if(pluginSettings.tweetTrack[str]) {
						twitStreams[str] = new TwitterTracker(str, pluginSettings.tweetTrack[str])
						twitStreams[str].init()
					}
				} else if(simplified[2] == "list") {
					var list = []
					var i
					for(i in twitStreams) {
						list.push((twitStreams[i].live == false ? "\u00034 " : "\u00033 ")+i)
					}
					botF.ircSendCommandPRIVMSG("Streams currently running:"+list.join(','), target)
				} else if(simplified[2] == "listall") {
					var list = []
					var i
					for(i in pluginSettings.tweetTrack) {
						if(twitStreams[i])
							list.push((twitStreams[i].live == false ? "\u00034 " : "\u00033 ")+i)
						else
							list.push("\u00037 "+i)
					}
					botF.ircSendCommandPRIVMSG("Streams available:"+list.join(','), target)
				} else if(simplified[2] == "status") {
					if(simplified[3] == null){
						botF.ircSendCommandPRIVMSG("Invalid target", target)
						return
					}

					var str = twitStreams[simplified[3]]
					if(str == null) {
						botF.ircSendCommandPRIVMSG("Invalid target", target)
						return
					}

					botF.ircSendCommandPRIVMSG("Twitter stream ["+str.userid+"]"+(str.user_handle != null ? " (\u0002@"+str.user_handle+"\u0002)" : "")+" is "+(str.live == false ? "\u00034Offline" : "\u00033Online")+"\u000f broadcasting to: "+str.channels.join(', '), target)
				}
			} else if(simplified[1] == "admin") {
				if(!isOp) {
					botF.ircSendCommandPRIVMSG(nick+": You do not have permission to execute this command!", target);
					return;
				}
				if(nick.toLowerCase() in twitterData) {
					botF.ircSendCommandPRIVMSG(nick+": Please log out before using admin account!", target);
					return;
				}
				twitter.verifyCredentials(pluginSettings.authinfo.client, pluginSettings.authinfo.client_secret, function(error, data, response) {
					if (error) {
						botF.ircSendCommandPRIVMSG(nick+": Admin account tokens failed to verify!", target);
					} else {
						botF.ircSendCommandPRIVMSG("You are now logged in as @"+data["screen_name"]+" ("+data["name"]+")!", target);
						twitterData[nick.toLowerCase()] = data;
						twitterData['tokens-'+nick.toLowerCase()] = {acc:pluginSettings.authinfo.client, accsec:pluginSettings.authinfo.client_secret};
					}
				});
			} else if(simplified[1] == "auth") {
				if(simplified[2] != null) {
					if(simplified[2] == "cancel") {
						if('reqtokens-'+nick.toLowerCase() in twitterData) {
							delete twitterData['reqtokens-'+nick.toLowerCase()];
							botF.ircSendCommandPRIVMSG("Authentication cancelled.", target);
						} else {
							botF.ircSendCommandPRIVMSG("You're not currently in authentication process.", target);
						}
						return;
					}
					if('reqtokens-'+nick.toLowerCase() in twitterData) {
						var tokens = twitterData['reqtokens-'+nick.toLowerCase()];
						twitter.getAccessToken(tokens.req, tokens.reqsec, simplified[2], function(error, accessToken, accessTokenSecret, results) {
						    if (error) {
						        console.log(error);
						        botF.ircSendCommandPRIVMSG("An error occured while verifying.", target);
						    } else {
						        twitter.verifyCredentials(accessToken, accessTokenSecret, function(error, data, response) {
								    if (error) {
								        botF.ircSendCommandPRIVMSG("An error occured while trying to verify.", target);
								    } else {
								        botF.ircSendCommandPRIVMSG("You are now logged in as @"+data["screen_name"]+" ("+data["name"]+")!", target);
								        botF.ircSendCommandPRIVMSG("Use '!twitter tweet <tweet>' to tweet as yourself.", target);
								        twitterData['tokens-'+nick.toLowerCase()] = {acc:accessToken, accsec:accessTokenSecret};
								        twitterData[nick.toLowerCase()] = data;
								        delete twitterData['reqtokens-'+nick.toLowerCase()];
								        console.log(data["screen_name"]+" verified for "+nick);
								    }
								});
						    }
						});
					}
				} else {
					twitter.getRequestToken(function(error, requestToken, requestTokenSecret, results){
					    if (error) {
					        console.log("Error getting OAuth request token : " + error);
					        botF.ircSendCommandPRIVMSG("An error occured while trying to get you a token.", target);
					    } else {
					    	twitterData['reqtokens-'+nick.toLowerCase()] = {req: requestToken, reqsec: requestTokenSecret};
					        botF.ircSendCommandPRIVMSG("Please authenticate yourself: https://twitter.com/oauth/authenticate?oauth_token="+requestToken, target);
					        botF.ircSendCommandPRIVMSG("Enter your pin by doing !twitter auth yourPINHere", target);
					    }
					});
				}
			} else if(simplified[1] == "authed") {
				if(nick.toLowerCase() in twitterData) {
					var datr = twitterData['tokens-'+nick.toLowerCase()];
					twitter.verifyCredentials(datr.acc, datr.accsec, function(error, data, response) {
					    if (error) {
					        botF.ircSendCommandPRIVMSG("An error occured while trying to verify.", target);
					        botF.ircSendCommandPRIVMSG("If this error presists, run !twitter logout and reauthenticate.", target);
					    } else {
					        twitterData[nick.toLowerCase()] = data;
					        botF.ircSendCommandPRIVMSG("You're successfully authenticated as @"+twitterData[nick.toLowerCase()]["screen_name"]+" ("+twitterData[nick.toLowerCase()]["name"]+").", target);
					    }
					});
				} else {
					botF.ircSendCommandPRIVMSG("You're not authenticated!", target);
				}
			} else if(simplified[1] == "user") {
				if(simplified[2] == null) {
					if(nick.toLowerCase() in twitterData) {
						var datr = twitterData['tokens-'+nick.toLowerCase()];
						twitter.verifyCredentials(datr.acc, datr.accsec, function(error, data, response) {
						    if (error) {
						        botF.ircSendCommandPRIVMSG("An error occured while trying to verify.", target);
						        botF.ircSendCommandPRIVMSG("If this error presists, run !twitter logout and reauthenticate.", target);
						    } else {
						        twitterData[nick.toLowerCase()] = data;
						        var xdata = twitterData[nick.toLowerCase()];
						        botF.ircSendCommandPRIVMSG("\u0002@"+xdata["screen_name"]+"\u0002 ("+xdata["name"]+"): "+entities.decode(xdata["description"]).replace(/\n/g, ' ').trim(), target);
						        botF.ircSendCommandPRIVMSG("\u00033Tweets: \u000312"+addCommas(xdata["statuses_count"])+" \u00033Following: \u000312"+addCommas(xdata["friends_count"])+" \u00033Followers: \u000312"+addCommas(xdata["followers_count"])+"\u000f", target);
						    }
						});
					} else {
						botF.ircSendCommandPRIVMSG("You're not authenticated!", target);
					}
				} else {
					pluginObj.displayUser(simplified[2].replace(/^\@/, ''), target);
				}
			} else if(simplified[1] == "retweet") {
				if(simplified[2]!=null && simplified[2].match(/\d+/g) != null) {
					var id = simplified[2].match(/\d+/g)[0];
					if('tokens-'+nick.toLowerCase() in twitterData) {
						var datr = twitterData['tokens-'+nick.toLowerCase()];
						twitter.statuses("retweet", {id:id}, datr.acc, datr.accsec, function(err, data){
							if(err) {
								botF.ircSendCommandPRIVMSG("Failed to retweet tweet!", target);
							} else {
								botF.ircSendCommandPRIVMSG("Success! https://twitter.com/"+data.user.screen_name+"/status/"+data.id_str, target);
							}
						});
					} else {
						botF.ircSendCommandPRIVMSG("You're not authenticated!", target);
					}
				} else {
					botF.ircSendCommandPRIVMSG("Invalid ID parameter!", target);
				}
			} else if(simplified[1] == "like") {
				if(simplified[2]!=null && simplified[2].match(/\d+/g) != null) {
					var id = simplified[2].match(/\d+/g)[0];
					if('tokens-'+nick.toLowerCase() in twitterData) {
						var datr = twitterData['tokens-'+nick.toLowerCase()];
						twitter.favorites("create", {id:id}, datr.acc, datr.accsec, function(err, data){
							if(err) {
								botF.ircSendCommandPRIVMSG("Failed to like tweet!", target);
							} else {
								botF.ircSendCommandPRIVMSG("Success! https://twitter.com/"+data.user.screen_name+"/status/"+data.id_str, target);
							}
						});
					} else {
						botF.ircSendCommandPRIVMSG("You're not authenticated!", target);
					}
				} else {
					botF.ircSendCommandPRIVMSG("Invalid ID parameter!", target);
				}
			} else if(simplified[1] == "follow") {
				if(simplified[2]!=null) {
					var iud = simplified[2].replace(/^\@/, '');
					if('tokens-'+nick.toLowerCase() in twitterData) {
						var datr = twitterData['tokens-'+nick.toLowerCase()];
						twitter.friendships("create", {screen_name:iud}, datr.acc, datr.accsec, function(err, data){
							if(err) {
								botF.ircSendCommandPRIVMSG("Failed to follow user!", target);
								console.log(err);
							} else {
								botF.ircSendCommandPRIVMSG("Successfully followed @"+data.screen_name+" ("+data.name+")!", target);
							}
						});
					} else {
						botF.ircSendCommandPRIVMSG("You're not authenticated!", target);
					}
				} else {
					botF.ircSendCommandPRIVMSG("Missing screen name!", target);
				}
			} else if(simplified[1] == "unfollow") {
				if(simplified[2]!=null) {
					var iud = simplified[2].replace(/^\@/, '');
					if('tokens-'+nick.toLowerCase() in twitterData) {
						var datr = twitterData['tokens-'+nick.toLowerCase()];
						twitter.friendships("destroy", {screen_name:iud}, datr.acc, datr.accsec, function(err, data){
							if(err) {
								botF.ircSendCommandPRIVMSG("Failed to unfollowed user!", target);
								console.log(err);
							} else {
								botF.ircSendCommandPRIVMSG("Successfully unfollowed @"+data.screen_name+" ("+data.name+")!", target);
							}
						});
					} else {
						botF.ircSendCommandPRIVMSG("You're not authenticated!", target);
					}
				} else {
					botF.ircSendCommandPRIVMSG("Missing screen name!", target);
				}
			} else if(simplified[1] == "logout") {
				if(nick.toLowerCase() in twitterData) {
					botF.ircSendCommandPRIVMSG("Logging you out..", target);
					delete twitterData[nick.toLowerCase()];
					delete twitterData['tokens-'+nick.toLowerCase()];
				} else {
					botF.ircSendCommandPRIVMSG("You're not authenticated!", target);
				}
			} else if(simplified[1] == "help") {
				botF.ircSendCommandPRIVMSG("\u00033Commands: \u00037status, stream, admin, \u00033tweet, auth, authed, logout, display, like, retweet, follow, unfollow, user", target);
			} else {
				botF.ircSendCommandPRIVMSG("Invalid command!", target);
			}
		}, "<command> [<args>] - twitter integration");

		//plugin is ready
		exports.ready = true;
		botF.emitBotEvent('botPluginReadyEvent', pluginId);
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
				var a = twitStreams[str]
				a.kill()
				delete twitStreams[str]
			}
		} break;
		case 'botPluginReadyEvent': if (event.eventData == "squeebot") {
			pluginObj.initCommands();
		} break;
	}
};

//reserved functions: main function called when plugin is loaded
module.exports.main = function (passedData) {
	//update variables
	botObj = passedData.botObj;
	pluginId = passedData.id;
	botF = botObj.publicData.botFunctions;
	botV = botObj.publicData.botVariables;
	settings = botObj.publicData.options;
	pluginSettings = settings.pluginsSettings[pluginId];
	ircChannelUsers =  botV.ircChannelUsers;
	
	//if plugin settings are not defined, define them
	if (pluginSettings === undefined) {
		pluginSettings = new SettingsConstructor();
		settings.pluginsSettings[pluginId] = pluginSettings;
		botF.botSettingsSave();
	}

	twitter = new twitterAPI({
	    consumerKey: pluginSettings.authinfo.app,
	    consumerSecret: pluginSettings.authinfo.app_secret,
	    callback: 'oob'
	})

	twitter.verifyCredentials(pluginSettings.authinfo.client, pluginSettings.authinfo.client_secret, function(error, data, response) {
		if (error) {
			console.log("\x1b[1;35m -*-\x1b[0m Twitter credentials are invalid!")
		} else {
			console.log("\x1b[1;35m -*-\x1b[0m Twitter credentials are valid! Twitter module ready")
			twitClient = pluginSettings.authinfo.client
			twitClientSec = pluginSettings.authinfo.client_secret
			twitterData[settings.botName] = data
			if(pluginSettings.enableTweetTrack) {
				pluginObj.twitStreamsInit()
			}
		}
	})

	botF.emitBotEvent('botPluginReadyEvent', pluginId);

	if (botObj.pluginData.squeebot && botObj.pluginData.squeebot.ready)
		pluginObj.initCommands()
};
