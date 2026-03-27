import express from "express";

const app = express();
app.use(express.json());

const LINE_TOKEN = process.env.LINE_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

app.post("/webhook", async (req, res) => {
  res.send("OK");
　console.log("WEBHOOK HIT");
  console.log(JSON.stringify(req.body));
  const events = req.body.events || [];

  for (const event of events) {
    try {
      if (event.type !== "message" || event.message.type !== "text") continue;

      const userMessage = event.message.text;
if (userMessage === "ラウンドモード") {
  await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${LINE_TOKEN}`,
    },
    body: JSON.stringify({
      replyToken: event.replyToken,
      messages: [
        {
          type: "text",
          text:
            "\n\n本日のゴルフ場名を教えてください。\n目標（例：100切り・安全に回る）があれば教えてください。\n\n迷った時だけ短く相談してください。\n例：120ヤード 右池\n\nコース図や距離表示のスクショがあれば、より具体的にアドバイスできます。",
        },
      ],
    }),
  });
  continue;
}
      const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4.1-mini",
          messages: [
            {
              role: "system",
              content:
                "あなたは初心者向けのゴルフAIキャディです。やさしく、短く、実用的に答えてください。ラウンド中の相談にはできるだけ1〜2文で返してください。危険な攻め方より安全な判断を優先してください。特にラウンド中は、迷った時にすぐ判断できるように、結論を先に短く伝えてください。安全第一で、無理な攻め方よりスコアを崩さない判断を優先してください。クラブ選択、狙いどころ、刻む判断、パターの考え方をシンプルに伝えてください。長文は避け、必要がなければ2文以内で答えてください。愛があり優しい言葉ではげますこともわすれないでください。専門用語はできるだけさけて誰が聞いてもわかるような言葉でおしえてください。",
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
console.log("OPENAI DATA:", JSON.stringify(data));
      const replyText =
    data?.choices?.[0]?.message?.content || "うまく応答できませんでした。";    

      await fetch("https://api.line.me/v2/bot/message/reply", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${LINE_TOKEN}`,
        },
        body: JSON.stringify({
          replyToken: event.replyToken,
          messages: [{ type: "text", text: replyText }],
        }),
      });
    } catch (error) {
      console.error("Webhook error:", error);
    }
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});
