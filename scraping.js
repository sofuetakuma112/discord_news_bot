const fetch = require('node-fetch');
const jsdom = require('jsdom');

const { JSDOM } = jsdom;

exports.fetchRssURLs = (async () => {
  const RSS_LIST_URL = 'https://corp.itmedia.co.jp/media/rss_list/'
  const res = await fetch(RSS_LIST_URL);
  const html = await res.text();
  const dom = new JSDOM(html);
  const document = dom.window.document;
  const nodes = document.querySelectorAll('.tablebordernone table > tbody > tr > td > a');
  const rss_urls = [];
  Array.from(nodes).map((item) => {
    if (item.href.trim().slice(-3) === 'xml')
    rss_urls.push({
      name: item.textContent.trim(),
      url: item.href.trim()
    });
  });
  return rss_urls
});
