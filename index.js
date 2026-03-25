import express from "express";

const app = express();
app.use(express.json());

app.post("/webhook", async (req, res) => {
  res.send("OK");
});

app.listen(3000, () => console.log("Server running"));
