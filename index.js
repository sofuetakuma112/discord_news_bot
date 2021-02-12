const Discord = require('discord.js');
// const NewsAPI = require('newsapi');
require('dotenv').config();
const fetch = require('node-fetch');
const FeedParser = require('feedparser');
// const time = require('./module.js');
// const fetchFormFeedParser = require('./feedParser');

const client = new Discord.Client();

const ChannelID = '809472448155746304';
const milisecondsPerHour = 1000 * 60 * 60;

client.on('ready', () => {
  console.log('ready');
  const channel = client.channels.cache.find((ch) => ch.id === ChannelID);
  let lastSentURL;
  let news;
  const fetchLatestNews = () => {
    const req = fetch('https://rss.itmedia.co.jp/rss/2.0/news_bursts.xml');
    const feedparser = new FeedParser();
    req.then(
      function (res) {
        if (res.status !== 200) {
          throw new Error('Bad status code');
        } else {
          // res.bodyはストリームなのでpipeメソッドで連結できる
          news = [];
          res.body.pipe(feedparser);
        }
      },
      function (err) {
        // リクエストエラーをここに書く
        console.log('request err', err.message);
      }
    );

    feedparser.on('error', function (error) {
      console.log('error event', error.message);
    });

    feedparser.on('readable', function () {
      // feedparserはストリーム？
      const stream = this; // thisはfeedpaeserを指し、ストリームである
      const meta = this.meta; // **NOTE** the "meta" is always available in the context of the feedparser instance
      let item;

      while ((item = stream.read())) {
        news.push({
          title: item.title,
          description: item.description,
          summary: item.summary,
          pubDate: item.pubDate,
          url: item.link,
        });
      }

      news.sort((a, b) => {
        if (a.pubDate > b.pubDate) {
          return -1;
        } else {
          return 1;
        }
      });
    });

    feedparser.on('end', () => {
      // デフォルトは50件取ってくる
      const arrangedNews = [];
      let slicedNews;
      if (!lastSentURL) {
        // 一回目の実行
        slicedNews = news.slice(0, 1);
        lastSentURL = slicedNews[0].url;
      } else {
        // 2回目以降の配信
        lastSentNews = news.find((oneNews) => oneNews.url === lastSentURL);
        const lastSentNewsIndex = news.indexOf(lastSentNews);
        // インデックスが0 => 前回送信したニュースから新規ニュースが追加されていない
        if (lastSentNewsIndex !== 0) {
          slicedNews = news.slice(0, lastSentNewsIndex);
          lastSentURL = slicedNews[0].url;
        } else {
          console.log('新規ニュースが無いです');
          setTimeout(() => {
            fetchLatestNews();
          }, milisecondsPerHour);
          return;
        }
      }
      for (const oneNews of slicedNews) {
        arrangedNews.push(`${oneNews.title}\n${oneNews.url}`);
      }
      channel.send(arrangedNews.join('\n'));
      setTimeout(() => {
        fetchLatestNews();
      }, milisecondsPerHour);
    });
  };
  fetchLatestNews();
});

// client.on('message', async (msg) => {
//   const news = /^!news/;
//   const query = /^!q/;
//   if (news.test(msg.content)) {
//     // 最新のニュース取得
//     newsapi.v2
//       .topHeadlines({
//         category: 'technology',
//         language: 'ja',
//         country: 'jp',
//         pageSize: 3,
//       })
//       .then((res) => {
//         const news = [];
//         for (article of res.articles) {
//           news.push(`${article.title}\n${article.url}`);
//         }
//         msg.channel.send(news.join('\n'));
//       });
//   } else if (query.test(msg.content)) {
//     const queryWords = msg.content.replace('!q ', '');
//     const milisecondsPerDay = 1000 * 60 * 60 * 24;
//     const fetchArticleNum = 3;
//     let count = 0;
//     let dayCount = 0;
//     let to = new Date(); // 初期値は現在時刻
//     const news = [];
//     while (count < fetchArticleNum || dayCount > 29) {
//       await newsapi.v2
//         .topHeadlines({
//           q: queryWords,
//           category: 'technology',
//           language: 'ja',
//           country: 'jp',
//           from: time.getStringFromDate(
//             new Date(to.getTime() - milisecondsPerDay)
//           ), // toから1日前
//           to: time.getStringFromDate(to),
//           pageSize: 20,
//           page: 5,
//         })
//         .then((res) => {
//           console.log(res);
//           for (article of res.articles) {
//             news.push(`${article.title}\n${article.url}`);
//             count += 1;
//             if (count > fetchArticleNum) break;
//           }
//           // toを1日前に遡る
//           to = new Date(to.getTime() - milisecondsPerDay);
//         })
//         .catch((err) => console.log(err.message));
//       dayCount += 1;
//     }
//     if (news.length !== 0) {
//       msg.channel.send(news.join('\n'));
//     } else {
//       msg.channel.send('検索条件と十分に一致する結果が見つかりません。');
//     }
//   }
// });

client.login(process.env.DISCORD_CLIENT_TOKEN);
