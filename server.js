const express = require("express");
const fileUpload = require("express-fileupload");
const fs = require("node:fs");
require("dotenv").config();

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(fileUpload());
app.use(express.static("public"));

// Import OpenAI SDK (or use fetch for API calls)
let OpenAI;
try {
  OpenAI = require("openai").default;
} catch (e) {
  // OpenAI SDK not installed. Using fetch for API calls.
  console.log("Using fetch for API calls.");
}

// Utility function to shuffle an array
function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Route to handle question generation
app.post("/generate-questions", async (req, res) => {
  const { topic, prompt, numQuestions } = req.body;

  if (!topic || !numQuestions) {
    return res
      .status(400)
      .json({ error: "Topic and number of questions are required." });
  }

  try {
    const questions = await generateQuestionsWithAI(
      topic,
      prompt,
      Number.parseInt(numQuestions),
    );
    res.json({ questions });
  } catch (error) {
    console.error("Question generation error:", error);
    res
      .status(500)
      .json({ error: "Failed to generate questions: " + error.message });
  }
});

// Route to handle JSON file upload
app.post("/upload-json", (req, res) => {
  console.log("Upload request received");
  console.log("Files received:", req.files ? Object.keys(req.files) : "none");

  if (!req.files || Object.keys(req.files).length === 0) {
    return res.status(400).json({ error: "No files were uploaded." });
  }

  const jsonFile = req.files["json-file"];
  console.log("File name:", jsonFile.name);
  console.log("File size:", jsonFile.size);

  // Read the JSON file directly from buffer
  try {
    const data = jsonFile.data.toString("utf8");
    console.log("File data length:", data.length);
    const questionsData = JSON.parse(data);
    console.log("Parsed questions count:", questionsData.length);

    // Validate the format
    if (!Array.isArray(questionsData)) {
      console.log("Error: JSON is not an array");
      return res
        .status(400)
        .json({ error: "JSON must be an array of questions." });
    }

    // Validate each question has required fields
    const validQuestions = questionsData.every((q, index) => {
      const hasQuestion = q.question !== undefined && q.question !== null;
      const hasOptions =
        q.options !== undefined &&
        q.options !== null &&
        Array.isArray(q.options);
      const hasAnswer = q.answer !== undefined && q.answer !== null;

      if (!hasQuestion || !hasOptions || !hasAnswer) {
        console.log(`Question ${index} validation failed:`, {
          hasQuestion,
          hasOptions,
          hasAnswer,
          questionText: q.question ? q.question.substring(0, 50) : "missing",
          optionsCount: q.options ? q.options.length : 0,
          answer: q.answer,
        });
      }

      return hasQuestion && hasOptions && hasAnswer;
    });

    if (!validQuestions) {
      console.log("Some questions failed validation");
      return res.status(400).json({
        error:
          "Each question must have: question, options (array), and answer fields.",
      });
    }

    console.log("All validations passed");
    const shuffledQuestions = shuffleArray(questionsData);
    res.json({ questions: shuffledQuestions });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(400).json({ error: "Invalid JSON format: " + error.message });
  }
});

async function generateQuestionsWithAI(topic, prompt, numQuestions) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY not found in environment variables. Please set it in your .env file.",
    );
  }

  const systemPrompt = `You are an expert quiz question generator. Generate ${numQuestions} multiple choice questions about "${topic}".
  
Each question must be in JSON format with these exact fields:
- "question": The question text
- "options": Array of 4 options (format: "A) option text", "B) option text", "C) option text", "D) option text")
- "answer": The correct answer letter (A, B, C, or D)
- "series": Topic category (can be "${topic}")
- "citation": A brief explanation or reference for the answer (optional)

The prompt/context for generation: ${prompt}

Return ONLY valid JSON array, no additional text. Example format:
[
  {
    "question": "What is...",
    "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
    "answer": "A",
    "series": "${topic}",
    "citation": "..."
  }
]`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: `Generate ${numQuestions} multiple choice questions about ${topic}. ${prompt}`,
          },
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        `OpenAI API error: ${errorData.error?.message || response.statusText}`,
      );
    }

    const data = await response.json();
    const content = data.choices[0].message.content;

    // Parse the JSON response
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error("Failed to extract JSON from AI response");
    }

    const questions = JSON.parse(jsonMatch[0]);

    // Validate and format the questions
    const formattedQuestions = questions.map((q, index) => ({
      id: index + 1,
      series: q.series || topic,
      question: q.question,
      options: q.options,
      answer: q.answer,
      citation: q.citation || "",
    }));

    // Shuffle the questions for randomness
    return shuffleArray(formattedQuestions);
  } catch (error) {
    console.error("AI Generation error:", error);
    throw error;
  }
}

app.listen(3000, () => {
  console.log("Server is running on port 3000");
});
