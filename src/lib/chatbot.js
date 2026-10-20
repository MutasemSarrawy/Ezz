'use strict';

const Anthropic = require('@anthropic-ai/sdk');

// ---------- Built-in FAQ assistant (works with no API key) ----------

function intents(course, contactEmail) {
  return [
    {
      keys: ['price', 'cost', 'fee', 'pay', 'payment', 'how much', 'expensive', 'discount'],
      answer: /contact|request/i.test(course.price_label)
        ? `We share pricing for ${course.title} on request. Send us a message on the Contact page or email ${contactEmail} and we will reply with the current options.`
        : `${course.title} costs ${course.price_label}. For payment options, email ${contactEmail} or use the Contact page.`,
    },
    {
      keys: ['enroll', 'enrol', 'register', 'sign up', 'signup', 'join', 'apply', 'start'],
      answer: course.enrollment_open
        ? `Enrollment for ${course.title} is open. Open the Course page and fill in the short application form — we reply within two working days.`
        : `Enrollment for ${course.title} is currently closed. Leave your details on the Contact page and we will tell you when the next intake opens.`,
    },
    {
      keys: ['how long', 'duration', 'weeks', 'length', 'schedule', 'time', 'hours'],
      answer: `${course.title} runs for ${course.duration} (${course.format}). You can follow it alongside work or study.`,
    },
    {
      keys: ['beginner', 'level', 'experience', 'prerequisite', 'requirement', 'background', 'coding', 'programming', 'math'],
      answer: `The course is designed for ${course.level.toLowerCase()} learners. No prior AI experience is needed; curiosity and a laptop are enough. Coding is introduced gently in the later modules.`,
    },
    {
      keys: ['module', 'curriculum', 'syllabus', 'learn', 'topics', 'content', 'cover', 'what will'],
      answer: `${course.title} covers AI foundations, prompting, AI for everyday work, building with AI APIs, automation and agents, responsible AI, and a capstone project. The full module list is on the Course page.`,
    },
    {
      keys: ['certificate', 'certification', 'certified', 'diploma'],
      answer: 'Students who complete the capstone project receive a Sarrawy Academy certificate of completion.',
    },
    {
      keys: ['free', 'resource', 'material', 'reading', 'video', 'tutorial'],
      answer: 'Our Free Sources page lists hand-picked courses, videos and guides you can start with today — no account needed.',
    },
    {
      keys: ['contact', 'email', 'talk', 'human', 'support', 'help', 'phone', 'reach'],
      answer: `You can email us at ${contactEmail} or use the form on the Contact page. A real person reads every message.`,
    },
    {
      keys: ['who', 'about', 'academy', 'sarrawy', 'mission', 'founder'],
      answer: 'Sarrawy Academy teaches practical, honest AI skills. Read more about our approach on the About page.',
    },
    {
      keys: ['online', 'live', 'recorded', 'where', 'location', 'in person', 'zoom'],
      answer: `The course is delivered ${course.format.toLowerCase()}. You can learn from anywhere with an internet connection.`,
    },
    {
      keys: ['hello', 'hi', 'hey', 'salam', 'good morning', 'good evening'],
      answer: `Hello! I can answer questions about ${course.title}, pricing, enrollment and our free resources. What would you like to know?`,
    },
  ];
}

function faqAnswer(message, course, contactEmail) {
  const text = ` ${message.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ')} `;
  let best = null;
  let bestScore = 0;
  for (const intent of intents(course, contactEmail)) {
    let score = 0;
    for (const key of intent.keys) {
      if (text.includes(` ${key}`)) score += key.includes(' ') ? 2 : 1;
    }
    if (score > bestScore) {
      best = intent;
      bestScore = score;
    }
  }
  if (best) return best.answer;
  return `I’m not sure about that one. You can ask me about ${course.title}, pricing, enrollment or free resources — or email ${contactEmail} and the team will help.`;
}

// ---------- Claude-powered assistant (used when ANTHROPIC_API_KEY is set) ----------

function systemPrompt(course, modules, contactEmail) {
  const moduleList = modules.map((m) => `${m.position}. ${m.title} — ${m.description}`).join('\n');
  return `You are the website assistant for Sarrawy Academy, an online academy teaching practical AI skills.
Answer visitors' questions about the academy and its course in a friendly, concise way (at most 4 short sentences, plain text, no markdown).
Only state facts given below. If you don't know something (for example a date or a discount), say so and point the visitor to ${contactEmail} or the Contact page.
Never make promises about prices, refunds, or jobs. Politely decline requests unrelated to the academy or learning AI.
Reply in the same language the visitor writes in.

Course: ${course.title} — ${course.tagline}
Summary: ${course.summary}
Duration: ${course.duration}. Format: ${course.format}. Level: ${course.level}. Price: ${course.price_label}.
Enrollment: ${course.enrollment_open ? 'open — apply via the form on the Course page' : 'currently closed'}.
Modules:
${moduleList}
Site pages: Home, About, Course, Free Sources, Contact. Contact email: ${contactEmail}.`;
}

function createChatbot(config) {
  const client = config.anthropicApiKey
    ? new Anthropic({ apiKey: config.anthropicApiKey, timeout: 20_000, maxRetries: 1 })
    : null;

  async function reply({ message, history, course, modules }) {
    if (client) {
      try {
        const response = await client.beta.messages.create({
          model: config.chatbotModel,
          max_tokens: 1024,
          output_config: { effort: 'low' },
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default',
          system: systemPrompt(course, modules, config.contactEmail),
          messages: [...history, { role: 'user', content: message }],
        });
        if (response.stop_reason !== 'refusal') {
          const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
          if (text) return { answer: text.slice(0, 2000), source: 'claude' };
        }
      } catch (err) {
        if (err instanceof Anthropic.APIError) {
          console.error(`Chatbot API error ${err.status}: ${err.message}`);
        } else {
          console.error('Chatbot error:', err.message);
        }
      }
    }
    return { answer: faqAnswer(message, course, config.contactEmail), source: 'faq' };
  }

  return { reply, usesClaude: Boolean(client) };
}

module.exports = { createChatbot, faqAnswer };
