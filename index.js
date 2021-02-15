require('dotenv').config();
const newsModules = require('./modules/news');

const { client } = require('./plugins/discord');
const { db, fieldValue } = require('./plugins/firebase');

// テスト環境ではここからcsvファイルを読み込む
// let loadedAllNews;
// fs.createReadStream(__dirname + '/allNews.csv').pipe(
//   csv.parse({ columns: true }, function (err, data) {
//     loadedAllNews = data;
//   })
// );

client.on('ready', async () => {
  console.log('ready');
  // newsModules.fetchLatestNews()
  // await newsModules.fetchAllLatestNews();
  // newsModules.distributionNews(); // テスト環境で購読配信の動作確認用
});

client.on('message', async (msg) => {
  const query = /^!q/; // 検索
  const subscribe = /^!s/; // 購読設定
  const destroySubscribe = /^!d$/; // 購読設定解除
  const currentSettings = /^!sk$/; // 現在の購読キーワードの確認
  const addKeywords = /^!a/;
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
  } else if (currentSettings.test(msg.content)) {
    const snapshot = await db
      .collection('subscribes')
      .where('uid', '==', msg.author.id)
      .get();
    if (snapshot.empty) {
      msg.channel.send(
        '購読設定が有効になっていません。\n購読するキーワードの登録は !s キーワード で行うことができます'
      );
    } else {
      snapshot.forEach((doc) => {
        msg.channel.send(
          `現在購読しているキーワードは「${doc
            .data()
            .keywords.join(', ')}」です`
        );
      });
    }
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
  } else if (addKeywords.test(msg.content)) {
    const keyword = msg.content.replace(addKeywords, '').trim();
    if (keyword) {
      const keywordArray = keyword.split(/\s+/);
      // console.log(keywordArray);
      const snapshot = await db
        .collection('subscribes')
        .where('uid', '==', msg.author.id)
        .get();
      if (snapshot.empty) {
        db.collection('subscribes').add({
          uid: msg.author.id,
          keywords: keywordArray,
        });
        msg.channel.send(
          `購読するキーワードを「${keywordArray.join(', ')}」に設定しました`
        );
      } else {
        snapshot.forEach(async (doc) => {
          await db
            .collection('subscribes')
            .doc(doc.id)
            .update({
              keywords: fieldValue.arrayUnion(...keywordArray),
            });
          const updatedDocument = await db
            .collection('subscribes')
            .doc(doc.id)
            .get();
          msg.channel.send(
            `キーワードを追加しました。\n現在購読しているキーワードは「${updatedDocument
              .data()
              .keywords.join(', ')}」です。`
          );
        });
      }
    } else msg.channel.send('キーワードを入力してください');
  }
});

client.login(process.env.DISCORD_CLIENT_TOKEN);
