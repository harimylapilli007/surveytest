const express = require('express');
const OpenAI = require('openai');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'))); // Serve static files from public directory

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Scoring questions for the wellness quiz
const scoringQuestions = [
  {
    id: "q1",
    question: "How often do you experience persistent muscle tension or stiffness?",
    options: ["Rarely", "Occasionally", "Frequently", "Constantly"]
  },
  {
    id: "q2",
    question: "At the end of a busy day, how cluttered is your mind with stress or worries?",
    options: ["Barely", "A bit", "Quite a lot", "Overwhelmingly"]
  },
  {
    id: "q3",
    question: "How balanced do you feel across your physical, mental, and emotional well-being?",
    options: ["Very balanced", "Somewhat balanced", "Slightly imbalanced", "Very imbalanced"]
  },
  {
    id: "q4",
    question: "Which outcome are you craving most from a wellness session?",
    options: ["Relaxed muscles", "A calm mind", "An uplifted mood", "Better sleep"]
  },
  {
    id: "q5",
    question: "How often would you ideally schedule a wellness session to maintain overall balance?",
    options: ["Only when I feel run-down", "Quarterly", "Monthly", "Weekly"]
  },
  {
    id: "q6",
    question: "When stress peaks, which quick reset helps you most?",
    options: [
      "Taking a short walk",
      "Spending time in a quiet space",
      "Listening to soothing sounds",
      "Practicing deep breathing"
    ]
  },
  {
    id: "q7",
    question: "How would you rate your flexibility and joint mobility?",
    options: ["Very limited", "Below average", "Above average", "Excellent"]
  },
  {
    id: "q8",
    question: "Which supportive practice best complements your fitness routine?",
    options: [
      "Foot or hand exercises",
      "Applying gentle warmth (heat pad)",
      "Listening to energizing music",
      "Assisted or partner-led stretching"
    ]
  },
  {
    id: "q9",
    question: "How long does it usually take you to fall asleep?",
    options: ["Over 60 minutes", "30–60 minutes", "15–30 minutes", "Under 15 minutes"]
  },
  {
    id: "q10",
    question: "How often do you wake up feeling refreshed?",
    options: ["Rarely", "Sometimes", "Often", "Almost always"]
  },
  {
    id: "q11",
    question: "Over the past week, how steady has your mood been?",
    options: ["Very erratic", "Somewhat erratic", "Mostly steady", "Very steady"]
  },
  {
    id: "q12",
    question: "Which environment helps you recenter best?",
    options: [
      "A quiet indoor space",
      "A softly lit room",
      "An outdoor/nature setting",
      "A bright, colorful area"
    ]
  },
  {
    id: "q13",
    question: "How often do you intentionally pause to check in with your feelings?",
    options: ["Never", "Once a day", "Several times a day", "Continuously as needed"]
  }
];

// Welcome message route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'survey.html'));
});

app.post('/api/analyze-survey', async (req, res) => {
  try {
    const { personalInformation, surveyResponses } = req.body;

    // Validate email and phone
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    const phoneRegex = /^[0-9]{10}$/;

    if (!emailRegex.test(personalInformation.email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    if (!phoneRegex.test(personalInformation.phone)) {
      return res.status(400).json({ error: 'Invalid phone number format' });
    }

    // Calculate wellness score
    let totalScore = 0;
    const maxScore = Object.keys(surveyResponses).length * 4;
    
    // Map option letters to their index
    const optionMap = { a: 0, b: 1, c: 2, d: 3 };

    // Create a map of questions by ID for easier lookup
    const questionsById = scoringQuestions.reduce((acc, q) => {
      acc[q.id] = q;
      return acc;
    }, {});

    // Map responses to scores and convert letters to text
    Object.entries(surveyResponses).forEach(([questionId, answer]) => {
      const questionData = questionsById[questionId];
      if (questionData) {
        let answerIndex = optionMap[answer];
        if (answerIndex !== undefined && answerIndex < questionData.options.length) {
          totalScore += (answerIndex + 1);
          // Replace the letter with the actual answer text for the prompt
          surveyResponses[questionId] = questionData.options[answerIndex];
        }
      }
    });

    const wellnessScore = Math.round((totalScore / maxScore) * 100);

    // Create a prompt for OpenAI
    const prompt = `You are a wellness coach. Given the following user details and quiz responses, provide a concise summary with the user's wellness score (${wellnessScore}/100) and a personalized recommendation for spa or wellness services. Start your response with a warm greeting using the user's name (${personalInformation.name}). Also include Ode Spa as the wellness expert in regards section.

IMPORTANT: Do not include any contact information, email addresses, or phone numbers in your response.

User info: Name=${personalInformation.name}, age=${personalInformation.age}, email=${personalInformation.email}, phone=${personalInformation.phone}.

Responses:
${Object.entries(surveyResponses)
  .filter(([questionId, answer]) => questionsById[questionId])
  .map(([questionId, answer]) => {
    return `${questionsById[questionId].question}\nAnswer: ${answer}`;
  }).join('\n\n')}

Please provide a comprehensive analysis in HTML format with the following sections:
1. Overall Wellness Assessment (including the score interpretation)
2. Key Strengths and Areas for Improvement
3. Personalized Recommendations for:
   - Physical Wellness
   - Mental Wellness
   - Sleep Quality
   - Stress Management
4. Suggested Wellness Practices and Activities
5. Next Steps and Action Plan

Format the response with appropriate HTML headings, paragraphs, and bullet points for better readability.`;

    // Generate content using OpenAI
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a helpful wellness expert. Do not include any contact information, email addresses, or phone numbers in your responses." },
        { role: "user", content: prompt }
      ],
      max_tokens: 1000,
      temperature: 0.7
    });

    const analysis = response.choices[0].message.content;

    res.json({ 
      analysis,
      wellnessScore,
      maxScore,
      totalScore
    });
  } catch (error) {
    console.error('Error analyzing survey:', error);
    res.status(500).json({ error: 'Failed to analyze survey' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Visit http://localhost:${PORT} to view the services page`);
}); 