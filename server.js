const express = require("express");
const cors = require("cors");
const { OpenAI } = require("openai");
require("dotenv").config();

const app = express();
// Use OpenAI API key from environment variables
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Use DeepSeek API key from environment variables
// const openai = new OpenAI({
//   apiKey: process.env.DEEPAI_API_KEY,
//   baseURL: "https://api.deepseek.com",
// });

app.use(cors());
app.use(express.json());

app.post("/generate-quiz", async (req, res) => {
  const { topics } = req.body;

  const prompt = `
You are an expert in AWS and cloud computing. Your task is to generate a quiz for AWS certification preparation.
Use Tutorialsdojo.com practice exam format.
Create 10 multiple-choice AWS quiz questions based on these topics: ${topics.join(
    ", "
  )}.
Each question could be scenario-based or theoretical.
Each question should have:
- A question string
- 4 answer options
- An integer index (0-3) of the correct answer
- A brief explanation


Format the output as:
[
  {
    "question": "...",
    "options": ["...", "...", "...", "..."],
    "correct": 2,
    "explanation": "..."
  },
  ...
]
`;

  try {
    const chatResponse = await openai.chat.completions.create({
      model: "gpt-4",
      //   model: "deepseek-chat",
      messages: [{ role: "user", content: prompt }],
    });

    const quizData = JSON.parse(chatResponse.choices[0].message.content);
    res.json({ questions: quizData });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Failed to generate quiz.",
    });
  }
});
// Serve static files from public directory
app.use(express.static("public"));

// Add route for root path
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/public/index.html");
});

app.listen(4000, () => console.log("Server running on http://localhost:4000"));
