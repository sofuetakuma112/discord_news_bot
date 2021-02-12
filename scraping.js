const fetch = require('node-fetch');
const jsdom = require('jsdom');

const { JSDOM } = jsdom;

(async () => {
  const res = await fetch('https://rss.itmedia.co.jp/rss/2.0/news_bursts.xml');
  const html = await res.text();
  const dom = new JSDOM(html);
  const document = dom.window.document;
  const nodes = document.querySelectorAll('item');
  const news = [];
  const elements = document.querySelector('item')
  const HTMLLinkElement = elements.children
  console.log(String(HTMLLinkElement[3].childNodes.length))
  // for (const el of Array.from(HTMLLinkElement)) {
  //   // url以外はこれでテキスト取れる
  //   console.log(el.textContent)
  // }
  // Array.from(nodes).map((item) => {
  //   news.push({
  //     title: item.children[0].textContent.trim(),
  //     url: item.children[1].tagName,
  //     description: item.children[2].textContent,
  //     pubDate: item.getElementsByTagName('pubDate').item(0).textContent.trim(),
  //   });
  // });
  // console.log(news);
})();
