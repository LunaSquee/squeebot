# Squeebot

This is a [node.js](http://nodejs.org/) powered IRC bot made by [LunaSquee](https://github.com/LunaSquee) and [djazz](https://github.com/daniel-j)

### Getting started
1. Clone this repo
2. Install the dependencies `npm install`
3. See the instructions below on how to create the settings file
4. Run the bot `npm start`

### Requirements
You must create a file called `settings.json` that has your bot's nickname, password and some other settings.

Template:
```
{
    "username": "Squeebot",
    "password": "*****",
    "server": "irc.canternet.org",
    "port": 6667,
    "channel": "#BronyTalk",
    "prefix":"!",

    "enableRelay": false,
    "relayPort": 9977,
    "relayPassword": "*******"
}
```

**Leave irc password as null if no password.**

### IRC Relay Server
This bot also provides a relay that outputs the messages sent to connected channels. This feature was designed for [MC-Squeebot](https://github.com/LunaSquee/MC-Squeebot) to post irc messages into the Minecraft chat.
To enable the relay you must set `enableRelay` to true in the settings. You can see how to use it in the MC-Squeebot code.