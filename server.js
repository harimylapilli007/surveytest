const express = require('express');
const OpenAI = require('openai');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname))); // Serve static files from root directory

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Scoring questions for the wellness quiz
const scoringQuestions = [
  {
    question: "How often do you experience persistent muscle tension or stiffness?",
    options: ["Rarely", "Occasionally", "Frequently", "Constantly"]
  },
  {
    question: "At the end of a busy day, how cluttered is your mind with stress or worries?",
    options: ["Barely", "A bit", "Quite a lot", "Overwhelmingly"]
  },
  {
    question: "How balanced do you feel across your physical, mental, and emotional well-being?",
    options: ["Very balanced", "Somewhat balanced", "Slightly imbalanced", "Very imbalanced"]
  },
  {
    question: "Which outcome are you craving most from a wellness session?",
    options: ["Relaxed muscles", "A calm mind", "An uplifted mood", "Better sleep"]
  },
  {
    question: "How often would you ideally schedule a wellness session to maintain overall balance?",
    options: ["Only when I feel run-down", "Quarterly", "Monthly", "Weekly"]
  },
  {
    question: "When stress peaks, which quick reset helps you most?",
    options: [
      "Taking a short walk",
      "Spending time in a quiet space",
      "Listening to soothing sounds",
      "Practicing deep breathing"
    ]
  },
  {
    question: "How would you rate your flexibility and joint mobility?",
    options: ["Very limited", "Below average", "Above average", "Excellent"]
  },
  {
    question: "Which supportive practice best complements your fitness routine?",
    options: [
      "Foot or hand exercises",
      "Applying gentle warmth (heat pad)",
      "Listening to energizing music",
      "Assisted or partner-led stretching"
    ]
  },
  {
    question: "How long does it usually take you to fall asleep?",
    options: ["Over 60 minutes", "30–60 minutes", "15–30 minutes", "Under 15 minutes"]
  },
  {
    question: "How often do you wake up feeling refreshed?",
    options: ["Rarely", "Sometimes", "Often", "Almost always"]
  },
  {
    question: "Over the past week, how steady has your mood been?",
    options: ["Very erratic", "Somewhat erratic", "Mostly steady", "Very steady"]
  },
  {
    question: "Which environment helps you recenter best?",
    options: [
      "A quiet indoor space",
      "A softly lit room",
      "An outdoor/nature setting",
      "A bright, colorful area"
    ]
  },
  {
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

    // Map responses to scores and convert letters to text
    Object.entries(surveyResponses).forEach(([questionKey, answer]) => {
      const questionIndex = parseInt(questionKey.replace('q', '')) - 1;
      if (questionIndex >= 0 && questionIndex < scoringQuestions.length) {
        const questionData = scoringQuestions[questionIndex];
        let answerIndex = optionMap[answer];
        if (answerIndex !== undefined && answerIndex < questionData.options.length) {
          totalScore += (answerIndex + 1);
          // Replace the letter with the actual answer text for the prompt
          surveyResponses[questionKey] = questionData.options[answerIndex];
        }
      }
    });

    const wellnessScore = Math.round((totalScore / maxScore) * 100);

    // Create a prompt for OpenAI
    const prompt = `You are a wellness coach. Given the following user details and quiz responses, provide a concise summary with the user's wellness score (${wellnessScore}/100) and a personalized recommendation for spa or wellness services. Also include a greeting to user in the beginning of the response and add Ode Spa as the wellness expert in regards section.

User info: age=${personalInformation.age}, email=${personalInformation.email}, phone=${personalInformation.phone}.

Responses:
${Object.entries(surveyResponses).map(([questionKey, answer]) => {
  const questionIndex = parseInt(questionKey.replace('q', '')) - 1;
  return `${scoringQuestions[questionIndex].question}\nAnswer: ${answer}`;
}).join('\n\n')}

Please provide a comprehensive analysis in HTML format with the following sections:
1. Overall Wellness Assessment (including the score interpretation)
2. Key Strengths and Areas for Improvement
3. Personalized Recommendations for:
Personal Information:
- Name: ${personalInformation.name}
- Gender: ${personalInformation.gender}
- Email: ${personalInformation.email}
- Phone: ${personalInformation.phone}

Wellness Score: ${wellnessScore}/100

Survey Responses:
${Object.entries(surveyResponses).map(([questionKey, answer]) => {
  const questionIndex = parseInt(questionKey.replace('q', '')) - 1;
  return `${scoringQuestions[questionIndex].question}\nAnswer: ${answer}`;
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
      model: "gpt-4",
      messages: [
        { role: "system", content: "You are a helpful wellness expert." },
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