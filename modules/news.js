const { db } = require('../plugins/firebase');
const { client } = require('../plugins/discord');
const fetch = require('node-fetch');
const FeedParser = require('feedparser');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const scraping = require('../scraping');
const fs = require('fs');
const csv = require('csv');

const milisecondsPerDay = 1000 * 60 * 60 * 24;
const milisecondsPerHour = 1000 * 60 * 60;
const milisecondsPerMinute = 1000 * 60;

loadedAllNews = [];
isUpdatingCSV = false;

const distributionNews = async () => {
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

const fetchLatestNews = () => {
  const req = fetch('https://rss.itmedia.co.jp/rss/2.0/news_bursts.xml');
  const feedparser = new FeedParser();
  const news = [];
  req.then(
    function (res) {
      if (res.status !== 200) {
        throw new Error('Bad status code');
      } else {
        res.body.pipe(feedparser);
      }
    },
    function (err) {
      console.log('request err', err.message);
    }
  );
  feedparser.on('error', function (error) {
    console.log('error event', error.message);
  });
  feedparser.on('readable', function () {
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
      return a.pubDate > b.pubDate ? -1 : 1;
    });
  });
  feedparser.on('end', async () => {
    const snapshot = await db.collection('latestNewsSubscribe').get();
    if (!snapshot.empty) {
      snapshot.forEach((doc) => {
        const subscribeData = doc.data();
        const arrangedNews = [];
        let slicedNews;
        let sentURL;
        if (!subscribeData.lastSentURL) {
          slicedNews = news.slice(0, 1);
          sentURL = slicedNews[0].url;
          db.collection('latestNewsSubscribe')
            .doc(doc.id)
            .update({ lastSentURL: sentURL });
        } else {
          lastSentNews = news.find(
            (oneNews) => oneNews.url === subscribeData.lastSentURL
          );
          const lastSentNewsIndex = news.indexOf(lastSentNews);
          if (lastSentNewsIndex !== 0) {
            slicedNews = news.slice(0, lastSentNewsIndex);
            sentURL = slicedNews[0].url;
            db.collection('latestNewsSubscribe')
              .doc(doc.id)
              .update({ lastSentURL: sentURL });
          } else {
            return;
          }
        }
        for (const oneNews of slicedNews) {
          arrangedNews.push(`${oneNews.title}\n${oneNews.url}`);
        }
        // firestoreの情報からどの鯖のどのテキストチャンネルに送信するか決める
        client.guilds.cache
          .get(subscribeData.serverId)
          .channels.cache.find((ch) => ch.id === subscribeData.channelId)
          .send(arrangedNews.join('\n'));
        // console.log(`${slicedNews.length}件の新規ニュースを取得しました`);
      });
    }
  });
};

const fetchAllLatestNews = async () => {
  isUpdatingCSV = true;
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
    allNews.sort((a, b) => {
      return a.pubDate > b.pubDate ? -1 : 1;
    });
    csvWriter.writeRecords(allNews).then(() => {
      console.log('The CSV file was written successfully');
      fs.createReadStream('allNews.csv').pipe(
        csv.parse({ columns: true }, function (err, data) {
          loadedAllNews = data;
        })
      );
      isUpdatingCSV = false;
      distributionNews();
      setTimeout(() => {
        console.log('ニュースを最新情報に更新します');
        fetchAllLatestNews();
      }, milisecondsPerHour);
    });
  });
};

module.exports = {
  fetchAllLatestNews,
  distributionNews,
  fetchLatestNews,
};
