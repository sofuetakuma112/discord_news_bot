const Discord = require('discord.js');
const NewsAPI = require('newsapi');
require('dotenv').config();
const client = new Discord.Client();
const newsapi = new NewsAPI(process.env.NEWS_API_KEY);

// Dateオブジェクトを渡すとYYYY-MM-DD
function getStringFromDate(date) {
  const year_str = date.getFullYear();
  //月だけ+1すること
  let month_str = 1 + date.getMonth();
  let day_str = date.getDate();

  month_str = ('0' + month_str).slice(-2);
  day_str = ('0' + day_str).slice(-2);

  format_str = 'YYYY-MM-DD';
  format_str = format_str.replace(/YYYY/g, year_str);
  format_str = format_str.replace(/MM/g, month_str);
  format_str = format_str.replace(/DD/g, day_str);

  return format_str;
}

// console.log(getStringFromDate(new Date(new Date().getTime() - 1000 * 60 * 60 * 24)))

client.on('ready', () => {
  console.log(`${client.user.username} でログインしています。`);
});

client.on('message', async (msg) => {
  const news = /^!news/;
  const query = /^!q/;
  if (news.test(msg.content)) {
    // 最新のニュース取得
    newsapi.v2
      .topHeadlines({
        category: 'technology',
        language: 'ja',
        country: 'jp',
        pageSize: 3,
      })
      .then((res) => {
        const news = [];
        for (article of res.articles) {
          news.push(`${article.title}\n${article.url}`);
        }
        msg.channel.send(news.join('\n'));
      });
  } else if (query.test(msg.content)) {
    const queryWords = msg.content.replace('!q ', '');
    const milisecondsPerDay = 1000 * 60 * 60 * 24;
    const fetchArticleNum = 3;
    let count = 0;
    let dayCount = 0
    let to = new Date(); // 初期値は現在時刻
    const news = []
    while (count < fetchArticleNum || dayCount > 29) {
      await newsapi.v2
        .topHeadlines({
          q: queryWords,
          category: 'technology',
          language: 'ja',
          country: 'jp',
          from: getStringFromDate(new Date(to.getTime() - milisecondsPerDay)), // toから1日前
          to: getStringFromDate(to),
          pageSize: 20,
          page: 5,
        })
        .then((res) => {
          console.log(res);
          for (article of res.articles) {
            news.push(`${article.title}\n${article.url}`);
            count += 1;
            if (count > fetchArticleNum) break;
          }
          // toを1日前に遡る
          to = new Date(to.getTime() - milisecondsPerDay);
        })
        .catch((err) => console.log(err.message));
      dayCount += 1
    }
    if (news.length !== 0) {
      msg.channel.send(news.join('\n'));
    } else {
      msg.channel.send('検索条件と十分に一致する結果が見つかりません。');
    }
  }
});

client.login(process.env.DISCORD_CLIENT_TOKEN);
