require('dotenv').config(); 
const express = require('express');
const cors = require('cors'); 
const multer = require('multer'); 
const mongoose = require('mongoose'); 
const { GoogleGenerativeAI } = require('@google/generative-ai');
const Report = require('./models/Report'); 

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

if (!process.env.GEMINI_API_KEY) {
    console.error("❌ ERROR: API Key nahi mili!");
    process.exit(1); 
}

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("🟢 MongoDB Connected Successfully!"))
  .catch((err) => {
      console.error("🔴 MongoDB Connection Error:", err.message);
  });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

function fileToGenerativePart(file) {
  return {
    inlineData: {
      data: file.buffer.toString("base64"),
      mimeType: file.mimetype
    },
  };
}

// ==========================================
// ROUTE 1: Report Analysis & Save to DB
// ==========================================
app.post('/api/analyze-report', upload.single('reportFile'), async (req, res) => {
    try {
        const { reportText } = req.body;
        const file = req.file; 

        if (!reportText && !file) {
            return res.status(400).json({ error: "Please provide either text or an image report!" });
        }

        console.log("⏳ AI Agent is analyzing the data..."); 

        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        const prompt = `
        You are a highly skilled Medical AI Agent. Your job is to analyze the medical test report data provided.
        If an image is provided, extract and read the test values from it.
        
        Rules:
        1. Keep the language simple so a normal patient can understand.
        2. Always include a disclaimer that you are an AI, not a doctor.
        3. STRICTLY output your response in raw JSON format exactly like this structure:
        {
            "summary": "Overall health summary in 2 sentences",
            "abnormal_values": ["list", "of", "abnormalities", "or 'None'"],
            "advice": "General health advice based on the report",
            "disclaimer": "Standard medical disclaimer"
        }
        `;

        const promptParts = [prompt];
        if (file) promptParts.push(fileToGenerativePart(file));
        if (reportText) promptParts.push(`Here is the report text provided by the user: "${reportText}"`);

        const result = await model.generateContent(promptParts);
        const response = await result.response;
        let text = response.text();

        text = text.replace(/```json/g, "").replace(/```/g, "").trim();
        const structuredData = JSON.parse(text);

        // ✅ NAYA: Database mein Report Save Karna
        const newReport = new Report({
            summary: structuredData.summary,
            abnormal_values: structuredData.abnormal_values,
            advice: structuredData.advice,
            disclaimer: structuredData.disclaimer,
            chatHistory: [
                { role: 'model', text: "Hello! I have analyzed your report. You can ask me any questions about it." }
            ]
        });

        const savedReport = await newReport.save();
        console.log("💾 Report Saved in MongoDB with ID:", savedReport._id); 

        // Frontend ko JSON ke sath uski ID bhi bhej rahe hain
        res.json({
            ...structuredData,
            reportId: savedReport._id
        });
        
    } catch (error) {
        console.error("❌ AI Error Details:", error.message); 
        res.status(500).json({ error: "AI failed to process the report." });
    }
});

// ==========================================
// ROUTE 2: Chat Route & Save History to DB
// ==========================================
app.post('/api/chat', async (req, res) => {
    try {
        // ✅ NAYA: Frontend se ab reportId bhi aayegi
        const { message, history, context, reportId } = req.body;

        if (!message) {
            return res.status(400).json({ error: "Message is required" });
        }

        const model = genAI.getGenerativeModel({ 
            model: "gemini-2.5-flash",
            systemInstruction: `You are an elite Medical AI Expert working for a premium healthcare platform. 
            Context of the user's medical report: ${JSON.stringify(context)}. 

            When answering the user's follow-up questions, follow these strict rules to sound professional and premium:
            1. Empathy & Education: If they ask about an abnormal value, first explain what that biomarker actually is in simple terms.
            2. Actionable General Advice: Provide general, scientifically accurate lifestyle and dietary suggestions that support that specific aspect of health.
            3. Formatting: Make the response visually beautiful. Use Markdown, bold text, and bullet points to structure your answer.
            4. The Safety Net: ALWAYS end your response with a clear disclaimer stating that this is general educational information and they MUST consult a doctor for clinical decisions. Never prescribe medicines.`
        });

        const formattedHistory = history.map(msg => ({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.text }]
        }));

        const chat = model.startChat({ history: formattedHistory });

        console.log(`💬 User asking: "${message}"`);

        const result = await chat.sendMessage(message);
        const response = await result.response;
        const aiResponseText = response.text();

        // ✅ NAYA: MongoDB mein Chat History Push Karna
        if (reportId) {
            await Report.findByIdAndUpdate(reportId, {
                $push: {
                    chatHistory: { 
                        $each: [
                            { role: 'user', text: message },
                            { role: 'model', text: aiResponseText }
                        ] 
                    }
                }
            });
            console.log("💾 Chat saved in MongoDB for Report:", reportId);
        }
        
        res.json({ text: aiResponseText });

    } catch (error) {
        console.error("❌ Chat Error Details:", error.message);
        res.status(500).json({ error: "Failed to generate chat response." });
    }
});

app.listen(port, () => {
    console.log(`🚀 Premium Medical AI Agent running on: http://localhost:${port}`);
});