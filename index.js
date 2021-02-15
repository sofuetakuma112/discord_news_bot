require('dotenv').config();
const newsModules = require('./modules/news');
const fs = require('fs');
const csv = require('csv');
const { client } = require('./plugins/discord');

// テスト環境ではここからcsvファイルを読み込む
// let loadedAllNews;
// fs.createReadStream(__dirname + '/allNews.csv').pipe(
//   csv.parse({ columns: true }, function (err, data) {
//     loadedAllNews = data;
//   })
// );

client.on('ready', async () => {
  console.log('ready');
  newsModules.fetchLatestNews()
  await newsModules.fetchAllLatestNews();
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
