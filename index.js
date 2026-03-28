import express from "express";

const app = express();
app.use(express.json());

const LINE_TOKEN = process.env.LINE_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// ユーザー名を取得する関数
async function getUserProfile(userId) {
  try {
    const response = await fetch(`https://api.line.me/v2/bot/profile/${userId}`, {
      headers: { Authorization: `Bearer ${LINE_TOKEN}` },
    });
    const data = await response.json();
    return data.displayName || "あなた"; 
  } catch (e) {
    return "あなた";
  }
}

app.post("/webhook", async (req, res) => {
  res.send("OK");
  const events = req.body.events || [];

  for (const event of events) {
    try {
      const userId = event.source.userId;
      const userName = await getUserProfile(userId);

      // 1. テキストメッセージの処理
      if (event.type === "message" && event.message.type === "text") {
        const userMessage = event.message.text;

        // --- リッチメニュー判定（シンプルかつ親切な応答） ---
        if (userMessage.includes("ラウンド報告")) {
          await replyToLine(event.replyToken, `${userName}さん、お疲れさまです！⛳️\nスコアのスクショを送っていただければ、内容を読み取って記録します！手入力も大歓迎ですよ。`);
          continue;
        }
        if (userMessage.includes("お悩み相談")) {
          await replyToLine(event.replyToken, `${userName}さん、どうしましたか？💬\n今悩んでいることを教えてください。一緒に解決していきましょう！`);
          continue;
        }
        if (userMessage.includes("自主トレ記録")) {
          await replyToLine(event.replyToken, `${userName}さん、練習お疲れさまです！🔥\nスイング動画や写真があれば送ってくださいね。`);
          continue;
        }
        if (userMessage.includes("なりたい自分計画")) {
          await replyToLine(event.replyToken, `「なりたい自分計画 🚀」ですね！\n${userName}さんの理想のゴルフについて教えてください。目標や期限など、具体的だと嬉しいです！`);
          continue;
        }
        if (userMessage.includes("プロに直接チャット")) {
          await replyToLine(event.replyToken, `了解しました、${userName}さん！🤝\nここからは先生に直接届きます。大切な相談は先生に聞いてみてくださいね！`);
          continue;
        }
        if (userMessage.includes("My カルテ設定")) {
          await replyToLine(event.replyToken, `${userName}さんの情報を教えてください！📋\n入力していただくと、アドバイスの精度がさらに上がりますよ。`);
          continue;
        }

        // 通常のAI回答
        const aiText = await getAiResponse([{ role: "user", content: userMessage }], userName);
        await replyToLine(event.replyToken, aiText);
      }

      // 2. 画像メッセージの処理
      else if (event.type === "message" && event.message.type === "image") {
        const messageId = event.message.id;
        
        // 【修正箇所】短く、わかりやすく変更
        await pushMessage(userId,`画像解析中... `);

        const imageResponse = await fetch(`https://api-data.line.me/v2/bot/message/${messageId}/content`, {
          headers: { Authorization: `Bearer ${LINE_TOKEN}` },
        });
        const buffer = await imageResponse.arrayBuffer();
        const base64Image = Buffer.from(buffer).toString("base64");

        const aiImageText = await getAiResponse([
          {
            role: "user",
            content: [
              { type: "text", text: `この画像を見て、ゴルフバディとして${userName}さんに寄り添ったコメントを丁寧語でして。スコアカードなら合計スコアを読み取って褒めて。スイング写真なら良い点を見つけて励まして。⛳️` },
              { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Image}` } }
            ]
          }
        ], userName);

        await pushMessage(userId, aiImageText);
      }

    } catch (error) {
      console.error("Webhook error:", error);
    }
  }
});

// OpenAI APIを叩く関数
async function getAiResponse(messages, userName) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `あなたはユーザーの最高のゴルフ相棒（バディ）「My Buddy Golf」です。
          ユーザーの名前は「${userName}」さんです。

          【ガイドライン】
          1. 基本は丁寧語（〜です、〜ます）。語尾に「〜ですね！」「〜ですよ！」を混ぜて親しみやすく。
          2. ユーザーを適度に名前で呼び、親密な相棒として振る舞う。
          3. 目標や悩みには「具体的には？」等、優しく1つ深掘り質問をする。
          4. 常にポジティブに励ます。最後にゴルフ系の絵文字を1つ入れる。`
        },
        ...messages
      ],
      temperature: 0.7,
    }),
  });
  const data = await response.json();
  return data?.choices?.[0]?.message?.content || "ごめんなさい🙇 調子が悪いみたいです。もう一度試していただけますか？";
}

// 応答用（replyToken）
async function replyToLine(replyToken, text) {
  await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${LINE_TOKEN}`,
    },
    body: JSON.stringify({
      replyToken: replyToken,
      messages: [{ type: "text", text: text }],
    }),
  });
}

// 送信用（userId）
async function pushMessage(userId, text) {
  await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${LINE_TOKEN}`,
    },
    body: JSON.stringify({
      to: userId,
      messages: [{ type: "text", text: text }],
    }),
  });
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});
