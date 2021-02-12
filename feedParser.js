const FeedParser = require('feedparser');
const fetch = require('node-fetch');
const req = fetch('https://rss.itmedia.co.jp/rss/2.0/news_bursts.xml');
const feedparser = new FeedParser();

exports.fetchLatestNews = () => {
  const news = [];

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
    }
  );

  feedparser.on('error', function (error) {
    console.log(error.message);
  });

  feedparser.on('readable', function () {
    // feedparserはストリーム？
    const stream = this; // thisはfeedpaeserを指し、ストリームである
    const meta = this.meta; // **NOTE** the "meta" is always available in the context of the feedparser instance
    let item;

    while ((item = stream.read())) {
      news.push(item);
    }
  });

  feedparser.on('end', () => {
    return news
  });
};
