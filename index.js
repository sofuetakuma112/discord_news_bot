require('dotenv').config();
const newsModules = require('./modules/news');

const { client } = require('./plugins/discord');
const { messageEventCallback } = require('./modules/discord')

// 開発環境用
const fs = require('fs');
const csv = require('csv');

// テスト環境ではここからcsvファイルを読み込む
fs.createReadStream(__dirname + '/allNews.csv').pipe(
  csv.parse({ columns: true }, function (err, data) {
    globalThis.loadedAllNews = data;
  })
);

// messageイベントのコールバック関数はイベントが発行されるたびに呼び出される
client.on('message', (msg) => messageEventCallback(msg, globalThis.loadedAllNews));

client.on('ready', async () => {
  console.log('ready');
  // setInterval(newsModules.fetchLatestNews, 1000 * 60 * 10)
  // await newsModules.fetchAllLatestNews();
  // newsModules.distributionNews(); // テスト環境で購読配信の動作確認用
});

client.on('guildCreate', (guild) => {
  guild.client.channels.cache
    .find((ch) => ch.id === guild.systemChannelID)
    .send(
      'こんにちは！\nこのBOTは「ITmedia」の最新ニュースを自動で発言します。\nその他にも検索、購読機能もあるので是非使ってみてください！\n!helpで各コマンドについての解説を見ることが出来ます。'
    );
});

client.login(process.env.DISCORD_CLIENT_TOKEN);
