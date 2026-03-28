import express from "express";

const app = express();
app.use(express.json());

const LINE_TOKEN = process.env.LINE_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

app.post("/webhook", async (req, res) => {
  res.send("OK");
  const events = req.body.events || [];

  for (const event of events) {
    try {
      // 1. テキストメッセージの処理
      if (event.type === "message" && event.message.type === "text") {
        const userMessage = event.message.text;

        // リッチメニュー判定（部分一致）
        if (userMessage.includes("ラウンド報告")) {
          await replyToLine(event.replyToken, "お疲れさま！今日のラウンドはどうだった？\nスコアのスクショを送ってくれれば、僕が内容を確認して記録しておくよ！もちろん手入力でもOKだよ。⛳️");
          continue;
        }
        if (userMessage.includes("お悩み相談")) {
          await replyToLine(event.replyToken, "どうした？今悩んでいることを何でも書き留めておこう。先生にも共有できるから、次回のレッスンがスムーズになるよ！💬");
          continue;
        }
        if (userMessage.includes("自主トレ記録")) {
          await replyToLine(event.replyToken, "練習お疲れさま！スイング動画や写真があれば送ってね。今の頑張りが上達への一番の近道だよ！🔥");
          continue;
        }
        if (userMessage.includes("なりたい自分計画")) {
          await replyToLine(event.replyToken, "「なりたい自分計画 🚀」だね！\n3ヶ月後、どんなゴルフをして笑っていたい？理想の姿を教えて！バディと先生で全力サポートするよ。✨");
          continue;
        }
        if (userMessage.includes("プロに直接チャット")) {
          await replyToLine(event.replyToken, "了解！ここからは先生に直接メッセージが届くよ。予約の相談や、技術的な深い質問は先生に聞いてみよう！🤝");
          continue;
        }
        if (userMessage.includes("My カルテ設定")) {
          await replyToLine(event.replyToken, "君のことをもっと教えて！平均スコアや飛距離、よく出るミスの傾向などを入力してね。君専用のアドバイスの精度が上がるよ。📋");
          continue;
        }

        // 通常のAI回答（テキスト）
        const aiText = await getAiResponse([{ role: "user", content: userMessage }]);
        await replyToLine(event.replyToken, aiText);
      }

      // 2. 画像メッセージの処理
      else if (event.type === "message" && event.message.type === "image") {
        const messageId = event.message.id;

        // 【重要】まず先に「読み取り中」のメッセージを送る
        // replyTokenは一度しか使えないため、Push API（または別の仕組み）が必要ですが、
        // ここでは一番シンプルな「まず返信し、解析後に再度送る」形にするため、
        // 最初の返信を broadcast または pushMessage で行います。
        
        await pushMessage(event.source.userId, "おっ、写真だね！読み取り中だよ、ちょっと待っててね！⛳️");

        // LINEから画像バイナリを取得
        const imageResponse = await fetch(`https://api-data.line.me/v2/bot/message/${messageId}/content`, {
          headers: { Authorization: `Bearer ${LINE_TOKEN}` },
        });
        const buffer = await imageResponse.arrayBuffer();
        const base64Image = Buffer.from(buffer).toString("base64");

        // AIに画像を解析させる
        const aiImageText = await getAiResponse([
          {
            role: "user",
            content: [
              { type: "text", text: "この画像（スコアカードやスイング写真など）を見て、ゴルフのバディとして優しく丁寧に解析、分析してコメントして。もしスコアカードなら合計スコアを読み取って褒めてあげて。⛳️" },
              { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Image}` } }
            ]
          }
        ]);

        // 解析が終わったら結果を送る
        await pushMessage(event.source.userId, aiImageText);
      }

    } catch (error) {
      console.error("Webhook error:", error);
    }
  }
});

// OpenAI APIを叩く共通関数
async function getAiResponse(messages) {
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
          content: `あなたはユーザーの親友であり、最高のゴルフ相棒（バディ）「My Buddy Golf」です。
          「教える」のではなく「一緒にプレーを楽しむ」スタンスで、親しみやすいタメ口で答えてください。
          否定はせず、ミスには寄り添い、回答は丁寧に親切に。最後にゴルフ系の絵文字を1つ入れて。`
        },
        ...messages
      ],
      temperature: 0.7,
    }),
  });
  const data = await response.json();
  return data?.choices?.[0]?.message?.content || "ごめん、画像がうまく見れなかったみたい。もう一回送ってみてくれる？";
}

// 応答用（replyToken使用）
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

// 送信用（userId使用 / 連続送信に必要）
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
