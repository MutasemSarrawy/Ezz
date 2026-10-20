'use strict';

// Initial content, inserted only when the tables are empty.
// Everything here can be edited later from the admin panel.

const COURSE = {
  title: 'The AI Master',
  tagline: 'From curious user to confident AI builder.',
  summary:
    'A practical programme that takes you from the foundations of artificial intelligence to ' +
    'designing, prompting and shipping real AI-powered workflows. Every module ends with a ' +
    'hands-on project, so you finish with a portfolio, not just notes.',
  duration: '8 weeks',
  format: 'Online · self-paced with live sessions',
  level: 'Beginner to intermediate',
  price_label: 'Contact us for pricing',
};

const MODULES = [
  ['Foundations of AI', 'What AI, machine learning and large language models are, how they learn, and where their limits are.'],
  ['Prompting with intent', 'Write clear instructions, give context and examples, and get consistent, reliable results from AI assistants.'],
  ['AI for everyday work', 'Research, writing, analysis and planning with AI — with a repeatable process you can apply on day one.'],
  ['Building with AI APIs', 'Call language models from code, handle responses safely, and connect AI to your own data and tools.'],
  ['Automation and agents', 'Design multi-step workflows where AI uses tools, makes decisions and hands off to people at the right moments.'],
  ['Responsible AI', 'Privacy, bias, security and evaluation — how to know your AI system is doing what you think it is.'],
  ['Capstone project', 'Plan, build and present an AI solution to a real problem, with feedback from your instructor.'],
];

const RESOURCES = [
  ['Practical Deep Learning for Coders', 'A free, hands-on course that gets you training real models from the first lesson.', 'https://course.fast.ai/', 'Courses', 'Course'],
  ['Machine Learning Crash Course', 'Google’s fast-paced introduction to core machine learning concepts, with interactive exercises.', 'https://developers.google.com/machine-learning/crash-course', 'Courses', 'Course'],
  ['Neural Networks, visually', 'An intuitive, animated series explaining how neural networks and transformers work.', 'https://www.3blue1brown.com/topics/neural-networks', 'Foundations', 'Video'],
  ['Neural Networks: Zero to Hero', 'Build neural networks and a small GPT from scratch, step by step, in code.', 'https://karpathy.ai/zero-to-hero.html', 'Foundations', 'Video'],
  ['Hugging Face Learn', 'Free courses on language models, agents and open-source AI tooling.', 'https://huggingface.co/learn', 'Building', 'Course'],
  ['Kaggle Learn', 'Short, browser-based micro-courses on Python, data and machine learning.', 'https://www.kaggle.com/learn', 'Foundations', 'Course'],
];

function seed(db) {
  const t = Date.now();

  if (!db.prepare('SELECT 1 FROM course WHERE id = 1').get()) {
    db.prepare(
      `INSERT INTO course (id, title, tagline, summary, duration, format, level, price_label, enrollment_open, updated_at)
       VALUES (1, ?, ?, ?, ?, ?, ?, ?, 1, ?)`
    ).run(COURSE.title, COURSE.tagline, COURSE.summary, COURSE.duration, COURSE.format, COURSE.level, COURSE.price_label, t);
  }

  if (db.prepare('SELECT COUNT(*) AS n FROM course_modules').get().n === 0) {
    const insert = db.prepare('INSERT INTO course_modules (position, title, description) VALUES (?, ?, ?)');
    MODULES.forEach(([title, description], i) => insert.run(i + 1, title, description));
  }

  if (db.prepare('SELECT COUNT(*) AS n FROM resources').get().n === 0) {
    const insert = db.prepare(
      `INSERT INTO resources (title, description, url, category, kind, published, position, created_at)
       VALUES (?, ?, ?, ?, ?, 1, ?, ?)`
    );
    RESOURCES.forEach(([title, description, url, category, kind], i) =>
      insert.run(title, description, url, category, kind, i + 1, t)
    );
  }
}

module.exports = { seed };
