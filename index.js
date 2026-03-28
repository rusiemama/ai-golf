import express from "express";

const app = express();
app.use(express.json());

const LINE_TOKEN = process.env.LINE_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

app.post("/webhook", async (req, res) => {
  res.send("OK");
  console.log("WEBHOOK HIT");
  const events = req.body.events || [];

  for (const event of events) {
    try {
      if (event.type !== "message" || event.message.type !== "text") continue;

      const userMessage = event.message.text;

      // --- リッチメニューおよびキーワード判定（絵文字があってもなくても反応するように修正） ---

      if (userMessage.includes("ラウンド報告")) {
        await replyToLine(event.replyToken, "お疲れさま！今日のラウンドはどうだった？\nスコアや、良かった点・悔しかった点を教えてよ！バディとしてしっかり記録しておくね。⛳️");
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

      // --- AIバディ（OpenAI）による自動応答 ---

      const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
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
              「教える」のではなく「一緒にプレーを楽しむ」スタンスでいてください。
              
              【ルール】
              1. 語尾は「〜だよ」「〜だね」「〜いこう！」など、親しみやすいタメ口。
              2. 否定はせず、ミスには「ドンマイ！」「次があるよ」と全力で寄り添う。
              3. 回答は超簡潔に（原則2文以内）。結論から言う。
              4. 安全第一。「無理せず刻もう」「気楽にいこう」と緊張を解くアドバイスを優先。
              5. 最後に必ずゴルフ系の絵文字（⛳️, 🏌️‍♂️, 🚀など）を1つ入れる。`
            },
            {
              role: "user",
              content: userMessage,
            },
          ],
          temperature: 0.7,
        }),
      });

      const data = await aiResponse.json();
      const replyText = data?.choices?.[0]?.message?.content || "ごめん、ちょっと調子が悪いみたい。もう一度話しかけてくれる？";

      await replyToLine(event.replyToken, replyText);

    } catch (error) {
      console.error("Webhook error:", error);
    }
  }
});

// LINEへの返信用共通関数
async function replyToLine(replyToken, text) {
  await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.LINE_TOKEN}`,
    },
    body: JSON.stringify({
      replyToken: replyToken,
      messages: [{ type: "text", text: text }],
    }),
  });
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});
