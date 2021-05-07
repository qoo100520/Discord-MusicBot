const { Util, MessageEmbed } = require('discord.js');
const { play } = require('../util/playing');
const YouTube = require('youtube-sr');
const sendError = require('../util/error');
module.exports = {
  info: {
    name: 'search',
    description: 'To search songs :D',
    usage: '<song_name>',
    aliases: ['sc']
  },

  run: async function (client, message, args) {
    let channel = message.member.voice.channel;
    if (!channel)
      return sendError(
        "I'm sorry but you need to be in a voice channel to play music!",
        message.channel
      );

    const permissions = channel.permissionsFor(message.client.user);
    if (!permissions.has('CONNECT'))
      return sendError(
        'I cannot connect to your voice channel, make sure I have the proper permissions!',
        message.channel
      );
    if (!permissions.has('SPEAK'))
      return sendError(
        'I cannot speak in this voice channel, make sure I have the proper permissions!',
        message.channel
      );

    var searchString = args.join(' ');
    if (!searchString) return sendError("You didn't provide what to search", message.channel);

    var serverQueue = message.client.queue.get(message.guild.id);
    try {
      var searched = await YouTube.search(searchString, { limit: 10 });
      if (searched[0] == undefined)
        return sendError('Looks like i was unable to find the song on YouTube', message.channel);
      let index = 0;
      let embedPlay = new MessageEmbed()
        .setColor('BLUE')
        .setAuthor(`Results for "${args.join(' ')}"`, message.author.displayAvatarURL())
        .setDescription(
          `${searched
            .map(
              (video2) =>
                `**\`${++index}\`  |** [\`${video2.title}\`](${video2.url}) - \`${
                  video2.durationFormatted
                }\``
            )
            .join('\n')}`
        )
        .setFooter('Type the number of the song to add it to the playlist');
      // eslint-disable-next-line max-depth
      message.channel.send(embedPlay).then((m) =>
        m.delete({
          timeout: 15000
        })
      );
      try {
        var response = await message.channel.awaitMessages(
          (message2) => message2.content > 0 && message2.content < 11,
          {
            max: 1,
            time: 20000,
            errors: ['time']
          }
        );
      } catch (err) {
        console.error(err);
        return message.channel.send({
          embed: {
            color: 'RED',
            description:
              'Nothing has been selected within 20 seconds, the request has been canceled.'
          }
        });
      }
      const videoIndex = parseInt(response.first().content);
      var video = await searched[videoIndex - 1];
    } catch (err) {
      console.error(err);
      return message.channel.send({
        embed: {
          color: 'RED',
          description: '🆘  **|**  I could not obtain any search results'
        }
      });
    }

    response.delete();
    var songInfo = video;

    const song = {
      id: songInfo.id,
      title: Util.escapeMarkdown(songInfo.title),
      views: String(songInfo.views).padStart(10, ' ').trim(),
      ago: songInfo.uploadedAt,
      duration: songInfo.durationFormatted,
      url: `https://www.youtube.com/watch?v=${songInfo.id}`,
      img: songInfo.thumbnail.url,
      req: message.author
    };

    if (serverQueue) {
      serverQueue.songs.push(song);
      let thing = new MessageEmbed()
        .setAuthor(
          'Song has been added to queue',
          'https://raw.githubusercontent.com/SudhanPlayz/Discord-MusicBot/master/assets/Music.gif'
        )
        .setThumbnail(song.img)
        .setColor('YELLOW')
        .addField('Name', song.title, true)
        .addField('Duration', song.duration, true)
        .addField('Requested by', song.req.tag, true)
        .setFooter(`Views: ${song.views} | ${song.ago}`);
      return message.channel.send(thing);
    }

    const queueConstruct = {
      textChannel: message.channel,
      voiceChannel: channel,
      connection: null,
      songs: [],
      volume: 80,
      playing: true,
      loop: false
    };
    message.client.queue.set(message.guild.id, queueConstruct);
    queueConstruct.songs.push(song);

    try {
      const connection = await channel.join();
      queueConstruct.connection = connection;
      play(queueConstruct.songs[0], message, client);
    } catch (error) {
      console.error(`I could not join the voice channel: ${error}`);
      message.client.queue.delete(message.guild.id);
      await channel.leave();
      return sendError(`I could not join the voice channel: ${error}`, message.channel);
    }
  }
};
