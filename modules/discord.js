const { db, fieldValue } = require('../plugins/firebase');

const messageEventCallback = async (msg, loadedAllNews) => {
  const query = /^!q/; // 検索
  const subscribe = /^!s/; // 購読設定
  const destroySubscribe = /^!d$/; // 購読設定解除
  const currentSettings = /^!sk$/; // 現在の購読キーワードの確認
  const addKeywords = /^!a/;
  const help = /^!help$/;
  const here = /^!here$/;
  const stopFetchLatestNews = /^!stop$/;
  if (globalThis.isUpdatingCSV) {
    msg.channel.send(
      '現在ニュースデータの更新作業をしているので暫くしてから再度コマンドを実行してください'
    );
    return;
  }
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
  } else if (stopFetchLatestNews.test(msg.content)) {
    const serverId = msg.guild.id;
    const snapshot = await db
      .collection('latestNewsSubscribe')
      .where('serverId', '==', serverId)
      .get();
    if (!snapshot.empty) {
      snapshot.forEach((doc) => {
        db.collection('latestNewsSubscribe').doc(doc.id).delete();
      });
      msg.channel.send('最新ニュース情報の配信を停止しました');
    } else {
      msg.channel.send('最新ニュース情報の配信機能が有効になっていません');
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
  } else if (help.test(msg.content)) {
    msg.channel.send(
      '**!q キーワード** => キーワードと合致したニュースを取得します\n**!s キーワード** => キーワードと関連したニュースを定期的にDMで通知します\n**!sk** => 現在購読しているキーワードを確認します\n**!a キーワード** => 購読しているキーワードに追加します\n**!d** => 購読設定を解除します（設定しているキーワードもリセットされます）'
    );
  } else if (here.test(msg.content)) {
    const channelId = msg.channel.id;
    const serverId = msg.guild.id;
    const snapshot = await db
      .collection('latestNewsSubscribe')
      .where('serverId', '==', serverId)
      .get();
    if (!snapshot.empty) {
      // 二回目以降の実行なので更新
      snapshot.forEach(async (doc) => {
        await db.collection('latestNewsSubscribe').doc(doc.id).update({
          channelId,
        });
      });
      // テキストチャンネルの更新を通知
      msg.channel.send('最新ニュース配信のテキストチャンネルを更新しました');
    } else {
      // 初回
      db.collection('latestNewsSubscribe').add({
        serverId,
        channelId,
        lastSentURL: '',
      });
      msg.channel.send(
        'このテキストチャンネルで最新ニュースの情報を配信します'
      );
    }
  } else if (subscribe.test(msg.content)) {
    const trimedSearchWordsArray = msg.content
      .replace(subscribe, '')
      .trim()
      .split(/\s+/);
    if (!trimedSearchWordsArray[0]) {
      msg.channel.send('キーワードを入力してください');
      return;
    }
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
  }
};

exports.messageEventCallback = messageEventCallback;
