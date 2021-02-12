// setTimeout(() => {
//   console.log('test')
// }, 1000);

// else if (query.test(msg.content)) {
//   const queryWords = msg.content.replace('!q ', '');
//   const milisecondsPerDay = 1000 * 60 * 60 * 24;
//   const fetchArticleNum = 3;
//   let count = 0;
//   let dayCount = 0;
//   let to = new Date(); // 初期値は現在時刻
//   const news = [];
//   while (count < fetchArticleNum || dayCount > 29) {
//     await newsapi.v2
//       .topHeadlines({
//         q: queryWords,
//         category: 'technology',
//         language: 'ja',
//         country: 'jp',
//         from: time.getStringFromDate(
//           new Date(to.getTime() - milisecondsPerDay)
//         ), // toから1日前
//         to: time.getStringFromDate(to),
//         pageSize: 20,
//         page: 5,
//       })
//       .then((res) => {
//         console.log(res);
//         for (article of res.articles) {
//           news.push(`${article.title}\n${article.url}`);
//           count += 1;
//           if (count > fetchArticleNum) break;
//         }
//         // toを1日前に遡る
//         to = new Date(to.getTime() - milisecondsPerDay);
//       })
//       .catch((err) => console.log(err.message));
//     dayCount += 1;
//   }
//   if (news.length !== 0) {
//     msg.channel.send(news.join('\n'));
//   } else {
//     msg.channel.send('検索条件と十分に一致する結果が見つかりません。');
//   }
// }

const fs = require('fs');
const csv = require('csv');

//処理（跡でpipeに食べさせる）
const parser = csv.parse((error, data) => {
  //内容出力
  console.log('初期データ');
  console.log(data);

  //変換後の配列を格納
  let newData = [];

  //ループしながら１行ずつ処理
  data.forEach((element, index, array) => {
    let row = [];
    row.push(element[0]);
    row.push(element[1].toUpperCase()); //2カラム目を大文字へ
    row.push(element[2]);
    //新たに1行分の配列(row)を作成し、新配列(newData)に追加。
    newData.push(row);
  });

  console.log('処理データ');
  console.log(newData);

  //write
  csv.stringify(newData, (error, output) => {
    fs.writeFile('out.csv', output, (error) => {
      console.log('処理データをCSV出力しました。');
    });
  });
});

// fs.createReadStream(__dirname + '/test.csv')
//   .pipe(process.stdout);

// csv.parse()で配列に変換
// fs.createReadStream(__dirname + '/test.csv').pipe(
//   csv.parse(function (err, data) {
//     console.log(data);
//   })
// );

// オブジェクトに変換
fs.createReadStream(__dirname + '/test.csv').pipe(
  csv.parse({ columns: true }, function (err, data) {
    console.log(data);
  })
);

// 書き込むデータ準備
// const data = [
//   ['ニュース名,URL'],
//   [
//     '教育IT － TechTargetジャパン 最新記事一覧,https://techtarget.itmedia.co.jp/tt/education/',
//   ],
// ];

// 書き込み
// fs.writeFile('file1.csv', data, (err) => {
//   if (err) throw err;
//   console.log('正常に書き込みが完了しました');
// });

const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const csvWriter = createCsvWriter({
  path: 'out.csv',
  header: [
    { id: 'name', title: 'Name' },
    { id: 'surname', title: 'Surname' },
    { id: 'age', title: 'Age' },
    { id: 'gender', title: 'Gender' },
  ],
});

const data = [
  {
    name: 'ジョン',
    surname: 'Snow',
    age: 26,
    gender: 'M',
  },
  {
    name: '教育IT － TechTargetジャパン 最新記事一覧',
    surname: 'https://techtarget.itmedia.co.jp/tt/education/',
    age: 33,
    gender: 'F',
  },
  {
    name: 'Fancy',
    surname: 'Brown',
    age: 78,
    gender: 'F',
  },
];

csvWriter
  .writeRecords(data)
  .then(() => console.log('The CSV file was written successfully'));

// news.push({
//   title: item.title,
//   description: item.description,
//   summary: item.summary,
//   pubDate: item.pubDate,
//   url: item.link,
// });

//読み込みと処理を実行
// fs.createReadStream('test.csv').pipe(parser);
