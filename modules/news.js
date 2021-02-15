const { db } = require('../plugins/firebase');
const { client } = require('../plugins/discord');
const fetch = require('node-fetch');
const FeedParser = require('feedparser');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const scraping = require('../scraping');
const fs = require('fs');
const csv = require('csv');
const { messageEventCallback } = require('./discord');

const ChannelID = '809472448155746304';
const milisecondsPerDay = 1000 * 60 * 60 * 24;
const milisecondsPerHour = 1000 * 60 * 60;
const milisecondsPerMinute = 1000 * 60;

let loadedAllNews;

const distributionNews = async () => {
  console.log('called!');
  // console.log(loadedAllNews.length);
  const subscribes = db.collection('subscribes');
  const snapshot = await subscribes.get();
  if (snapshot.empty) {
    console.log('subscribesコレクション内にドキュメントがありません.');
    return;
  }
  snapshot.forEach((doc) => {
    const uidAndKeywords = doc.data();
    client.users
      .fetch(uidAndKeywords.uid)
      .then(async (user) => {
        if (uidAndKeywords.keywords.length !== 0) {
          const filteredNews = loadedAllNews.filter((oneNews) => {
            const result = [];
            uidAndKeywords.keywords.forEach((word) => {
              const reg = new RegExp(word, 'i');
              result.push(
                reg.test(oneNews.description) ||
                  reg.test(oneNews.summary) ||
                  reg.test(oneNews.title)
              );
            });
            return result.some((bool) => bool);
          });
          if (filteredNews.length !== 0) {
            const arrangedNews = [];
            for (const oneNews of filteredNews) {
              arrangedNews.push(`${oneNews.title}\n${oneNews.url}`);
            }
            if (arrangedNews.join('\n').length > 2000) {
              let chunk = [];
              for (const newsText of arrangedNews) {
                if ((chunk.join('\n') + newsText).length < 2000) {
                  chunk.push(newsText);
                } else {
                  user.send(chunk.join('\n'));
                  chunk = [];
                }
              }
            } else {
              user.send(arrangedNews.join('\n'));
            }
          } // else user.send('一致するニュースがありません');
        }
      })
      .catch((err) => console.log('distributionNews() Error', err.message));
  });
};

const fetchLatestNews = (lastSentURL = null) => {
  const req = fetch('https://rss.itmedia.co.jp/rss/2.0/news_bursts.xml');
  const feedparser = new FeedParser();
  const news = [];
  const channel = client.channels.cache.find((ch) => ch.id === ChannelID);
  req.then(
    function (res) {
      if (res.status !== 200) {
        throw new Error('Bad status code');
      } else {
        // res.bodyはストリームなのでpipeメソッドで連結できる
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
    let sentURL;
    if (!lastSentURL) {
      // 一回目の実行
      slicedNews = news.slice(0, 1);
      sentURL = slicedNews[0].url;
    } else {
      // 2回目以降の配信
      lastSentNews = news.find((oneNews) => oneNews.url === lastSentURL);
      const lastSentNewsIndex = news.indexOf(lastSentNews);
      // インデックスが0 => 前回送信したニュースから新規ニュースが追加されていない
      if (lastSentNewsIndex !== 0) {
        slicedNews = news.slice(0, lastSentNewsIndex);
        sentURL = slicedNews[0].url;
      } else {
        console.log('新規ニュースが無いです');
        setTimeout(() => {
          fetchLatestNews(lastSentURL);
        }, milisecondsPerMinute);
        return;
      }
    }
    // slicedNewsに初期化データ or 最新ニュースを入れている
    for (const oneNews of slicedNews) {
      arrangedNews.push(`${oneNews.title}\n${oneNews.url}`);
    }
    channel.send(arrangedNews.join('\n'));
    console.log(`${slicedNews.length}件の新規ニュースを取得しました`);
    setTimeout(() => {
      fetchLatestNews(sentURL);
    }, milisecondsPerMinute);
  });
};

const fetchAllLatestNews = async () => {
  // messageイベントリスナーの削除
  client.removeListener('message', () => console.log('message listener detached'))
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
  const promises = [];
  const rss_urls = await scraping.fetchRssURLs();
  for (const xml of rss_urls) {
    let news = [];
    promises.push(
      new Promise(function (resolve, reject) {
        const req = fetch(xml.url);
        const feedparser = new FeedParser();
        req.then(
          function (res) {
            if (res.status !== 200) {
              throw new Error('Bad status code');
            } else {
              // res.bodyはストリームなのでpipeメソッドで連結できる
              res.body.pipe(feedparser);
            }
          },
          function (err) {
            console.log('request err', err.message);
          }
        );
        feedparser.on('error', function (error) {
          console.log('error event', error.message, xml);
        });
        feedparser.on('readable', function () {
          // feedparserはストリーム？
          const stream = this; // thisはfeedpaeserを指し、ストリームである
          let item;
          while ((item = stream.read())) {
            news.push({
              title: item.title,
              description: item.description,
              summary: item.summary ? item.summary : '',
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
            // allNewsに追加済みのニュースURLと一致していなければ追加
            const result = allNews.every((alreadyAddedOneNews) => {
              return alreadyAddedOneNews.url !== oneNews.url;
            });
            if (result) allNews.push(oneNews);
          }
          resolve();
        });
      })
    );
  }
  Promise.all(promises).then(() => {
    console.log('beforeWrite');
    csvWriter.writeRecords(allNews).then(() => {
      console.log('The CSV file was written successfully');
      fs.createReadStream('allNews.csv').pipe(
        csv.parse({ columns: true }, function (err, data) {
          loadedAllNews = data;
        })
      );
      // messageイベントリスナの設定
      client.on('message', (msg) => messageEventCallback(msg, loadedAllNews));
      distributionNews();
      setTimeout(() => {
        console.log('ニュースを最新情報に更新します');
        fetchAllLatestNews();
      }, milisecondsPerHour);
    });
  });
};

exports.fetchLatestNews = fetchLatestNews;
exports.fetchAllLatestNews = fetchAllLatestNews;
exports.distributionNews = distributionNews;
