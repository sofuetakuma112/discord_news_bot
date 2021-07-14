const Fuse = require('fuse.js');

const books = [
  {
    title: "Old Man's War",
    author: {
      firstName: 'John',
      lastName: 'Scalzi',
    },
  },
  {
    title: 'The Lock Artist',
    author: {
      firstName: 'Steve',
      lastName: 'Hamilton',
    },
  },
];

const options = {
  // threshold: 0.3, // 検索スコアのしきい値
  includeScore: true,
  matchAllTokens: false, // 詳細検索用
  shouldSort: true, // 検索スコアに基づいてソート
  keys: ['title', 'description', 'summary'],
};

// 2. Set up the Fuse instance
const fuse = new Fuse(globalThis.loadedAllNews, options);

const search = (message) => {
  // デフォルトのあいまい検索は1割ほどゴミが混ざっている
  // ゴミの検索スコアは0.4 ~ 0.6
  return fuse.search(message);
};

exports.search = search;
