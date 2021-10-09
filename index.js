const Discord = require('discord.js');
const ytdl = require('ytdl-core');
const client = new Discord.Client();
const token = require('./token');
const prefix = '&'

const queue = new Map();

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
    client.user.setPresence({
        activity: {
            name: "beats."
        },
        status: "online"
    });
});

client.on('message', msg => {
    if (!msg.content.startsWith(prefix) || msg.author.bot) return;
    const args = msg.content.slice(prefix.length).trim().split(' ');
    const command = args.shift().toLowerCase();
    const serverQueue = queue.get(msg.guild.id);
    if (command === 'help') {
        msg.channel.send(`\`${prefix}play\` followed by a YT link. Figure out the rest yourself you monke`);
    }
    else if (command === 'play') {
        execute(msg, serverQueue);
        return;
    } else if (command === 'skip') {
        skip(msg, serverQueue);
        return;
    } else if (command === 'stop') {
        stop(msg, serverQueue);
        return;
    }
    else if (command === 'queue') {
        getQueue(msg, serverQueue);
        return;
    }
    else if (command === 'np') {
        getNp(msg, serverQueue);
        return;
    }
    else {
        msg.channel.send('Invalid command');
    }
});

client.login(token.token);

async function execute(message, serverQueue) {
    const args = message.content.split(" ");

    const voiceChannel = message.member.voice.channel;
    if (!voiceChannel)
        return message.channel.send(
            "You need to be in a voice channel to play music!"
        );
    const permissions = voiceChannel.permissionsFor(message.client.user);
    if (!permissions.has("CONNECT") || !permissions.has("SPEAK")) {
        return message.channel.send(
            "I need the permissions to join and speak in your voice channel!"
        );
    }
    let link = args[1].replace("youtu.be/", "www.youtube.com/watch?v=");
    let found = link.match(/\/watch\?v=[0-9a-zA-Z_-]{11}/);
    let vidid = "";
    if (!found || !found[0]) {
        return message.channel.send('Invalid youtube link');
    }
    else {
        vidid = found[0].slice(9);
    }
    const songInfo = await ytdl.getInfo(`https://www.youtube.com/watch?v=${vidid}`).catch(err => {
        message.channel.send('Error occurred fetching video. Is it available/is the link correct?');
        return;
    })
    const song = {
        title: songInfo.videoDetails.title,
        length: songInfo.videoDetails.lengthSeconds,
        requestedby: message.author.tag,
        url: songInfo.videoDetails.video_url,
        time: Date.now()
    };
    if (!serverQueue) {
        const queueContruct = {
            textChannel: message.channel,
            voiceChannel: voiceChannel,
            connection: null,
            songs: [],
            volume: 5,
            playing: true,
        };
        queue.set(message.guild.id, queueContruct);
        queueContruct.songs.push(song);
        try {
            var connection = await voiceChannel.join();
            queueContruct.connection = connection;
            play(message.guild, queueContruct.songs[0]);
        } catch (err) {
            console.log(err);
            queue.delete(message.guild.id);
            return message.channel.send(err);
        }
    } else {
        serverQueue.songs.push(song);
        return message.channel.send(`${song.title} has been added to the queue!`);
    }
}

function play(guild, song) {
    const serverQueue = queue.get(guild.id);
    if (!song) {
        serverQueue.voiceChannel.leave();
        queue.delete(guild.id);
        return;
    }
    const dispatcher = serverQueue.connection
        .play(ytdl(song.url))
        .on("finish", () => {
            serverQueue.songs.shift();
            serverQueue.textChannel.send(`Finished playing: **${song.title}**`);
            play(guild, serverQueue.songs[0]);
        })
        .on("error", error => console.error(error));
    dispatcher.setVolumeLogarithmic(serverQueue.volume / 5);
    serverQueue.textChannel.send(`Start playing: **${song.title}**. Requested by ${song.requestedby}`);
}

function skip(message, serverQueue) {
    if (!message.member.voice.channel)
        return message.channel.send(
            "You have to be in a voice channel to stop the music!"
        );
    if (!serverQueue)
        return message.channel.send("There is no song that I could skip!");
    serverQueue.connection.dispatcher.end();
}

function stop(message, serverQueue) {
    if (!message.member.voice.channel)
        return message.channel.send(
            "You have to be in a voice channel to stop the music!"
        );
    serverQueue.songs = [];
    serverQueue.connection.dispatcher.end();
}

function getQueue(message, serverQueue) {
    const args = message.content.split(" ");
    if (!serverQueue || serverQueue.songs.length == 0) {
        message.channel.send("Nothing is playing right now");
    }
    else {
        const embed = new Discord.MessageEmbed();
        embed.setTitle(`Queue for ${message.guild.name}`)
        for (var i = 0; i < Math.min(serverQueue.songs.length, 25); i++) {
            var song = serverQueue.songs[i];
            embed.addField(`${i + 1}. ${song.title}`, `Length: ${lengthFormatter(song.length)}. Requested by ${song.requestedby}`);
        }
        message.channel.send(embed);
    }
}

function getNp(message, serverQueue) {
    const args = message.content.split(" ");
    if (!serverQueue || serverQueue.songs.length == 0) {
        message.channel.send("Nothing is playing right now");
    }
    else {
        const embed = new Discord.MessageEmbed();
        embed.setTitle(`Now Playing`)
        var song = serverQueue.songs[0];
        embed.addField(`${song.title}`, `Played ${lengthFormatter(Math.round((Date.now() - song.time) / 1000))} of ${lengthFormatter(song.length)}`);
        message.channel.send(embed);
    }
}

function lengthFormatter(seconds) {
    return new Date(seconds * 1000).toISOString().substr(11, 8);
}
