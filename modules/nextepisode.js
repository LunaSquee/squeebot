// NextEpisode: Show the users when the next episode of MLP is on!
// Written by LunaSquee
var Module = require("./core.js");
var myModule = new Module({});
var botobj;
// Date arguments: Year, month-1, day, hour, minute, second (UTC)
var conf = {"date":[2015, 4-1, 4, 15, 30, 0], "countTimes":26, "inSeason":5}
var week = 7*24*60*60*1000;

myModule.load = function() {
	Object.getPrototypeOf(this).load.apply(this, arguments); // IMPORTANT LINE! DO NOT REMOVE!!!!
	var airDate = Date.UTC(conf.date[0], conf.date[1], conf.date[2], conf.date[3], conf.date[4], conf.date[5]); 
	botobj = this.bot;
	for(var i in this.config) {
		var value = this.config[i];
		if(i in conf)
			conf[i] = value;
	}
	
	botobj.commands["nextep"] = {"action":(function(simplified, nick, chan, message, target) {
        var counter = 0;
        var now = Date.now();
        do {
            var timeLeft = Math.max(((airDate+week*(counter++)) - now)/1000, 0);
        } while (timeLeft === 0 && counter < conf.countTimes);
        if (counter === conf.countTimes) {
            botobj.sendPM(target, "Season "+conf.inSeason+" is over :(");
        } else {
            botobj.sendPM(target, (counter===1?"First":"Next")+" Season "+conf.inSeason+" episode airs in %s", readableTime(timeLeft, true));
        }
    }),"description":"- Time left until next pony episode."}
}

myModule.unload = function() {
	Object.getPrototypeOf(this).unload.apply(this, arguments); // IMPORTANT LINE! DO NOT REMOVE!!!!
	delete botobj.commands["nextep"];
	botobj = null;
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

module.exports = myModule;