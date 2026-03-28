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

        // リッチメニュー判定（丁寧かつ親しみやすい表現に修正）
        if (userMessage.includes("ラウンド報告")) {
          await replyToLine(event.replyToken, `${userName}さん、お疲れさまです！今日のラウンドはいかがでしたか？\nスコアのスクショを送っていただければ、僕が内容を確認して記録しておきますね！手入力も大歓迎ですよ。⛳️`);
          continue;
        }
        if (userMessage.includes("お悩み相談")) {
          await replyToLine(event.replyToken, `${userName}さん、どうしましたか？今悩んでいることを何でも書き留めておきましょう。先生にもしっかり共有しておきますね！💬`);
          continue;
        }
        if (userMessage.includes("自主トレ記録")) {
          await replyToLine(event.replyToken, `${userName}さん、練習お疲れさまです！スイング動画や写真があればぜひ送ってください。一緒に振り返りましょう！🔥`);
          continue;
        }
        if (userMessage.includes("なりたい自分計画")) {
          await replyToLine(event.replyToken, `「なりたい自分計画 🚀」ですね！\n${userName}さんは、3ヶ月後にどんなゴルフをしていたいですか？ぜひ理想の姿を聞かせてください！✨`);
          continue;
        }
        if (userMessage.includes("プロに直接チャット")) {
          await replyToLine(event.replyToken, `了解しました、${userName}さん！ここからは先生に直接メッセージが届きます。大切な相談は先生に聞いてみてくださいね！🤝`);
          continue;
        }
        if (userMessage.includes("My カルテ設定")) {
          await replyToLine(event.replyToken, `${userName}さんのことをもっと教えてください！入力していただくと、僕のアドバイスの精度もぐんと上がりますよ。📋`);
          continue;
        }

        // 通常のAI回答
        const aiText = await getAiResponse([{ role: "user", content: userMessage }], userName);
        await replyToLine(event.replyToken, aiText);
      }

      // 2. 画像メッセージの処理
      else if (event.type === "message" && event.message.type === "image") {
        const messageId = event.message.id;
        await pushMessage(userId, `${userName}さん、お写真ありがとうございます！今読み取っていますので、少しだけ待ってくださいね！⛳️`);

        const imageResponse = await fetch(`https://api-data.line.me/v2/bot/message/${messageId}/content`, {
          headers: { Authorization: `Bearer ${LINE_TOKEN}` },
        });
        const buffer = await imageResponse.arrayBuffer();
        const base64Image = Buffer.from(buffer).toString("base64");

        const aiImageText = await getAiResponse([
          {
            role: "user",
            content: [
              { type: "text", text: `この画像を見て、ゴルフバディとして${userName}さんに寄り添ったコメントを丁寧語でして。スコアカードなら合計スコアを読み取って、ポジティブに褒めてあげて。⛳️` },
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

// OpenAI APIを叩く関数（トーンを調整）
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
          
          【話し方のガイドライン】
          1. 基本は丁寧語（〜です、〜ます）を使ってください。
          2. 堅苦しすぎず、語尾に「〜ですね！」「〜ですよ！」などを使って親しみやすさを出してください。
          3. ユーザーを適度に名前で呼び、親密な相棒として振る舞ってください。
          4. 否定的なことは言わず、常にポジティブに励ましてください。
          5. 最後に必ずゴルフ系の絵文字を1つ入れてください。`
        },
        ...messages
      ],
      temperature: 0.7,
    }),
  });
  const data = await response.json();
  return data?.choices?.[0]?.message?.content || "すみません、少し調子が悪いみたいです。もう一度試していただけますか？";
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
