# Squeebot

This is a [node.js](http://nodejs.org/) powered IRC bot made by [LunaSquee](https://github.com/LunaSquee) and [djazz](https://github.com/daniel-j)

### Getting started
1. Clone this repo
2. Install the dependencies `npm install`
3. Copy and edit the settings `cp settings.example.json settings.json`
4. Run the bot `npm start`

### Modules
You are able to write modules for the bot, there is an example module in the `modules` directory.
To get the module to auto-load, you can put it in the settings file's `modules` object and give it a property `"autoload":true`.
You can load modules from the console by doing `/module load myModuleName`. There are also commands reload, unload and reloadall.

### IRC Relay Server
This bot also provides a relay that outputs the messages sent to connected channels. This feature was designed for [MC-Squeebot](https://github.com/LunaSquee/MC-Squeebot) to post irc messages into the Minecraft chat.
To enable the relay you must set `enableRelay` to true in the settings. You can see how to use it in the MC-Squeebot code.
