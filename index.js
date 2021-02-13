const Discord = require('discord.js');
require('dotenv').config();
const fetch = require('node-fetch');
const FeedParser = require('feedparser');
const scraping = require('./scraping');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const fs = require('fs');
const csv = require('csv');

const client = new Discord.Client();

const ChannelID = '809472448155746304';
const milisecondsPerHour = 1000 * 60 * 60;

let loadedAllNews;

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

const csvWriter = createCsvWriter({
  path: 'allNews.csv',
  header: [
    { id: 'title', title: 'title' },
    { id: 'description', title: 'description' },
    { id: 'summary', title: 'summary' },
    { id: 'pubDate', title: 'pubDate' },
    { id: 'url', title: 'url' },
  ],
});
const allNews = [];
const fetchAllLatestNews = async () => {
  const rss_urls = await scraping.fetchRssURLs();
  const promises = [];
  for (const xml of rss_urls) {
    promises.push(
      new Promise(function (resolve, reject) {
        // ループ完了後に実行したい処理
        const req = fetch(xml.url);
        const feedparser = new FeedParser();
        let news;
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
          console.log('pushed!');
          // 新規追加するニュースに対してループを回す
          for (const oneNews of news) {
            // 追加済みのallNewsのニュースURLと一致していなければ追加
            const result = allNews.every((alreadyAddedOneNews) => {
              return alreadyAddedOneNews.url !== oneNews.url;
            });
            if (result) {
              allNews.push(oneNews);
            }
          }
          resolve();
        });
      })
    );
  }
  Promise.all(promises).then(() => {
    console.log('beforeWrite');
    csvWriter
      .writeRecords(allNews)
      .then(() => console.log('The CSV file was written successfully'));
  });
};
// fetchAllLatestNews();

fs.createReadStream(__dirname + '/allNews.csv').pipe(
  csv.parse({ columns: true }, function (err, data) {
    loadedAllNews = data;
  })
);

client.on('message', async (msg) => {
  const query = /^!q/;
  if (query.test(msg.content)) {
    // 最新のニュース取得
    const channel = client.channels.cache.find((ch) => ch.id === ChannelID);
    let filteredNews;
    const trimedSearchWordsArray = msg.content
      .replace(query, '')
      .trim()
      .split(/\s+/);
    // 広範囲検索
    // filteredNews = loadedAllNews.filter((oneNews) => {
    //   const result = [];
    //   trimedSearchWordsArray.forEach((word) => {
    //     const reg = new RegExp(word, 'i');
    //     result.push(
    //       reg.test(oneNews.description) ||
    //         reg.test(oneNews.summary) ||
    //         reg.test(oneNews.title)
    //     );
    //   });
    //   return result.some((bool) => bool);
    // });
    // 絞り込み検索
    filteredNews = loadedAllNews.filter((oneNews) => {
      const result = [];
      trimedSearchWordsArray.forEach((word) => {
        const reg = new RegExp(word, 'i');
        result.push(
          reg.test(oneNews.description) ||
            reg.test(oneNews.summary) ||
            reg.test(oneNews.title)
        );
      });
      return result.every((bool) => bool);
    });
    if (filteredNews.length !== 0) {
      const arrangedNews = [];
      for (const oneNews of filteredNews) {
        const nextAddNews = `${oneNews.title}\n${oneNews.url}`;
        arrangedNews.push(nextAddNews);
      }
      if (arrangedNews.join('\n').length > 2000) {
        // 2000文字オーバーの場合、分割して送る
        let chunk = [];
        for (const newsText of arrangedNews) {
          if ((chunk.join('\n') + newsText).length < 2000) {
            // 次のテキストを追加してもchunkの文字列が2000文字未満の場合
            chunk.push(newsText);
          } else {
            // 次のテキストを追加するとchunkの文字数が2000文字を超える場合
            channel.send(chunk.join('\n'));
            chunk = [];
          }
        }
      } else channel.send(arrangedNews.join('\n'));
    } else {
      channel.send('一致するニュースがありません');
    }
  }
});

client.login(process.env.DISCORD_CLIENT_TOKEN);
