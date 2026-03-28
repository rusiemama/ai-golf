import express from "express";

const app = express();
app.use(express.json());

const LINE_TOKEN = process.env.LINE_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// ユーザー名を取得する関数を追加
async function getUserProfile(userId) {
  try {
    const response = await fetch(`https://api.line.me/v2/bot/profile/${userId}`, {
      headers: { Authorization: `Bearer ${LINE_TOKEN}` },
    });
    const data = await response.json();
    return data.displayName || "君"; // 名前が取れない場合は「君」と呼ぶ
  } catch (e) {
    return "君";
  }
}

app.post("/webhook", async (req, res) => {
  res.send("OK");
  const events = req.body.events || [];

  for (const event of events) {
    try {
      const userId = event.source.userId;
      const userName = await getUserProfile(userId); // ここで名前を取得！

      // 1. テキストメッセージの処理
      if (event.type === "message" && event.message.type === "text") {
        const userMessage = event.message.text;

        // リッチメニュー判定（名前を盛り込む）
        if (userMessage.includes("ラウンド報告")) {
          await replyToLine(event.replyToken, `${userName}、お疲れさま！今日のラウンドはどうだった？\nスコアのスクショを送ってくれれば、僕が内容を確認して記録しておくよ！⛳️`);
          continue;
        }
        if (userMessage.includes("お悩み相談")) {
          await replyToLine(event.replyToken, `${userName}、どうした？今悩んでいることを何でも書き留めておこう。先生にも共有しておくね！💬`);
          continue;
        }
        if (userMessage.includes("自主トレ記録")) {
          await replyToLine(event.replyToken, `${userName}、練習お疲れさま！スイング動画や写真があれば送ってね。🔥`);
          continue;
        }
        if (userMessage.includes("なりたい自分計画")) {
          await replyToLine(event.replyToken, `「なりたい自分計画 🚀」だね！\n${userName}は、3ヶ月後どんなゴルフをしていたい？理想を教えて！✨`);
          continue;
        }
        if (userMessage.includes("プロに直接チャット")) {
          await replyToLine(event.replyToken, `了解、${userName}！ここからは先生に直接メッセージが届くよ。🤝`);
          continue;
        }
        if (userMessage.includes("My カルテ設定")) {
          await replyToLine(event.replyToken, `${userName}のことをもっと教えて！入力してくれたら、アドバイスの精度が上がるよ。📋`);
          continue;
        }

        // 通常のAI回答（システムプロンプトに名前を渡す）
        const aiText = await getAiResponse([{ role: "user", content: userMessage }], userName);
        await replyToLine(event.replyToken, aiText);
      }

      // 2. 画像メッセージの処理
      else if (event.type === "message" && event.message.type === "image") {
        const messageId = event.message.id;
        await pushMessage(userId, `${userName}、写真だね！読み取り中だよ、ちょっと待っててね！⛳️`);

        const imageResponse = await fetch(`https://api-data.line.me/v2/bot/message/${messageId}/content`, {
          headers: { Authorization: `Bearer ${LINE_TOKEN}` },
        });
        const buffer = await imageResponse.arrayBuffer();
        const base64Image = Buffer.from(buffer).toString("base64");

        const aiImageText = await getAiResponse([
          {
            role: "user",
            content: [
              { type: "text", text: `この画像を見て、ゴルフバディとして${userName}に寄り添ったコメントをして。スコアカードなら合計スコアを読み取って褒めて。⛳️` },
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

// OpenAI APIを叩く関数（名前を考慮するように修正）
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
          ユーザーの名前は「${userName}」です。
          会話の中で適度に名前を呼んで、親しみやすいタメ口で、丁寧に親切に答えてください。
          否定はせず、最後にゴルフ系の絵文字を1つ入れて。`
        },
        ...messages
      ],
      temperature: 0.7,
    }),
  });
  const data = await response.json();
  return data?.choices?.[0]?.message?.content || "ごめん、ちょっと調子が悪いみたい。";
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
