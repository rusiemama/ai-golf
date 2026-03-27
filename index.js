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
                "あなたは初心者向けのゴルフAIキャディです。短く、やさしく、実用的に答えてください。",
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
