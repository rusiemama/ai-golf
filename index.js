app.post("/webhook", async (req, res) => {
  res.send("OK"); // 

  const events = req.body.events || [];

  for (const event of events) {
    if (event.type === "message" && event.message.type === "text") {
      const userMessage = event.message.text;

      const aiResponse = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4.1-mini",
          input: `あなたは初心者向けゴルフAIキャディです。短く、やさしく、実用的に答えてください。ユーザーの質問: ${userMessage}`,
        }),
      });

      const data = await aiResponse.json();
      const replyText =
        data?.output?.[0]?.content?.[0]?.text || "うまく応答できませんでした。";

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
    }
  }
});
