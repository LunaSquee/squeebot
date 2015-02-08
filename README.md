# Squeebot

This is a [node.js](http://nodejs.org/) powered IRC bot made by LunaSquee and djazz

### Getting started
1. Clone this repo
2. Install the dependencies `npm install`
3. See the instructions below on how to create the settings file
4. Run the bot `npm start`

### Requirements
You must make a file called "settings.json" that has your bot's username and password and some other settings.

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