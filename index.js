require('dotenv').config();
const fetch = require('node-fetch');
const FeedParser = require('feedparser');
const scraping = require('./scraping');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const fs = require('fs');
const csv = require('csv');
const newsModules = require('./modules/news')

const { client } = require('./plugins/discord')
const { db } = require('./plugins/firebase')

let loadedAllNews;

client.on('ready', () => {
  console.log('ready');
  // newsModules.fetchLatestNews()
  // newsModules.distribututionNews(loadedAllNews)
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
const fetchAllLatestNews = async () => {
  const allNews = [];
  const rss_urls = await scraping.fetchRssURLs();
  const promises = [];
  for (const xml of rss_urls) {
    let news;
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
              news = [];
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
    csvWriter.writeRecords(allNews).then(() => {
      console.log('The CSV file was written successfully');
      fs.createReadStream(__dirname + '/allNews.csv').pipe(
        csv.parse({ columns: true }, function (err, data) {
          loadedAllNews = data;
        })
      );
      setTimeout(async () => {
        console.log('ニュースを最新情報に更新します');
        await fetchAllLatestNews();
        // 購読者へのニュース配信
      }, 1000 * 60 * 60);
    });
  });
};
// fetchAllLatestNews();

// テスト環境ではここからcsvファイルを読み込む
fs.createReadStream(__dirname + '/allNews.csv').pipe(
  csv.parse({ columns: true }, function (err, data) {
    loadedAllNews = data;
  })
);

// ここでの呼び出しはdistribututionNews()がreadyイベント発行前に実行されるので
// 初期化されていないclientに対してメソッドを実行し、エラーとなる
// newsModules.distribututionNews();

client.on('message', async (msg) => {
  const query = /^!q/; // 検索
  const subscribe = /^!s/; // 購読設定
  const destroySubscribe = /^!d/; // 購読設定解除
  if (query.test(msg.content)) {
    // 最新のニュース取得
    let filteredNews;
    const excludedQuery = msg.content.replace(query, '');
    const trimedSearchWordsArray = excludedQuery.split(/\s+/);
    // 絞り込み検索
    filteredNews = loadedAllNews.filter((oneNews) => {
      const result = [];
      for (const word of trimedSearchWordsArray) {
        const reg = new RegExp(word, 'i');
        result.push(
          reg.test(oneNews.description) ||
            reg.test(oneNews.summary) ||
            reg.test(oneNews.title)
        );
      }
      return result.every((bool) => bool);
    });
    if (filteredNews.length !== 0 && excludedQuery.length !== 0) {
      if (filteredNews.length < 30) {
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
              await msg.channel.send(chunk.join('\n'));
              chunk = [];
            }
          }
        } else msg.channel.send(arrangedNews.join('\n'));
      } else
        msg.channel.send(
          `検索結果が多すぎます。\nキーワードを追加してより詳細に検索してください。\n(ヒット件数 : ${filteredNews.length}件)`
        );
    } else msg.channel.send('一致するニュースがありません');
  } else if (subscribe.test(msg.content)) {
    const trimedSearchWordsArray = msg.content
      .replace(subscribe, '')
      .trim()
      .split(/\s+/);
    const snapshot = await db
      .collection('subscribes')
      .where('uid', '==', msg.author.id)
      .get();
    if (snapshot.empty) {
      // 一致するものはないから新規追加
      db.collection('subscribes').add({
        uid: msg.author.id,
        keywords: trimedSearchWordsArray,
      });
      msg.channel.send(
        `キーワード「${trimedSearchWordsArray.join(', ')}」で購読します`
      );
    } else {
      snapshot.forEach((doc) => {
        db.collection('subscribes').doc(doc.id).set({
          uid: msg.author.id,
          keywords: trimedSearchWordsArray,
        });
        msg.channel.send(
          `購読するキーワードを「${trimedSearchWordsArray.join(
            ', '
          )}」に更新しました`
        );
      });
    }
  } else if (destroySubscribe.test(msg.content)) {
    const snapshot = await db
      .collection('subscribes')
      .where('uid', '==', msg.author.id)
      .get();
    if (snapshot.empty) {
      // 一致するものはないから新規追加
      msg.channel.send('...何も起きなかった');
    } else {
      snapshot.forEach((doc) => {
        db.collection('subscribes').doc(doc.id).delete();
        msg.channel.send('購読設定を解除しました');
      });
    }
  }
});

client.login(process.env.DISCORD_CLIENT_TOKEN);
