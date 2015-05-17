// VideoGrab: Module that responds to dailymotion and youtube video links
// Written by LunaSquee

var Module = require("./core.js");
var myModule = new Module({"smartpm":[videorespond]});
var botobj;
var conf = {"googleapikey":null}

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

// Dailymotion video puller
function dailymotion(id, callback) {
    botobj.fetchJSON_HTTPS("https://api.dailymotion.com/video/"+id+"?fields=id,title,owner,owner.screenname,duration,views_total", function(success, content) {
        if(success) {
            callback(content);
        }
    });
}

function getYoutubeFromVideo(id, target) {
    if(conf["googleapikey"] == null) return;
    var g_api_base = "https://www.googleapis.com/youtube/v3/videos?id="+id+"&key="+conf.googleapikey+"&part=snippet,contentDetails,statistics,status&fields=items(id,snippet,statistics,contentDetails)";
    botobj.fetchJSON_HTTPS(g_api_base, function(success, content) {
        if(success==false) return;
        if("items" in content) {
            var tw = content.items[0];
            botobj.sendPM(target, "\u0002You\u000305Tube\u000f \u000312\""+tw.snippet.title+"\" \u000303Views: \u000312"+addCommas(tw.statistics.viewCount.toString())+" \u000303Duration: \u000312"+ytDuration(tw.contentDetails.duration.toString())+" \u000303By \u000312\""+tw.snippet.channelTitle+"\"");
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

// Called on module load
myModule.load = function() {
	Object.getPrototypeOf(this).load.apply(this, arguments); // IMPORTANT LINE! DO NOT REMOVE!!!!
	botobj = this.bot;
	for(var i in this.config) {
		var value = this.config[i];
		if(i in conf)
			conf[i] = value;
	}
}

// Called on module unload
myModule.unload = function() {
	Object.getPrototypeOf(this).unload.apply(this, arguments); // IMPORTANT LINE! DO NOT REMOVE!!!!
	botobj = null;
}

function videorespond(nick, chan, message, simplified, target, isMentioned, isPM) {
	if(findUrls(message).length > 0) {
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
                    botobj.sendPM(target, "\u0002\u000303Dailymotion\u000f \u000312\""+data.title+"\" \u000303Views: \u000312"+data.views_total.toString().addCommas()+" \u000303Duration: \u000312"+data.duration.toString().toHHMMSS()+" \u000303By \u000312\""+data["owner.screenname"]+"\"");
                }))
            }
        }
    }
}

module.exports = myModule;