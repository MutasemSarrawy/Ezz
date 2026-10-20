'use strict';

(function () {
  document.documentElement.classList.add('js');

  // ---------- Mobile navigation ----------
  const toggle = document.querySelector('.nav-toggle');
  const nav = document.getElementById('site-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', () => {
      const open = toggle.getAttribute('aria-expanded') !== 'true';
      toggle.setAttribute('aria-expanded', String(open));
      nav.classList.toggle('open', open);
    });
  }

  // ---------- Scroll reveal ----------
  const items = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px' });
    items.forEach((el, i) => {
      el.style.transitionDelay = `${Math.min(i % 4, 3) * 70}ms`;
      io.observe(el);
    });
  } else {
    items.forEach((el) => el.classList.add('in'));
  }

  // ---------- Free sources filter ----------
  const filters = document.querySelector('[data-filters]');
  if (filters) {
    filters.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-filter]');
      if (!btn) return;
      const value = btn.dataset.filter;
      filters.querySelectorAll('[data-filter]').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
      document.querySelectorAll('.resource-card').forEach((card) => {
        card.hidden = value !== 'all' && card.dataset.category !== value;
        if (!card.hidden) card.classList.add('in');
      });
    });
  }

  // ---------- Chat assistant ----------
  const chat = document.querySelector('[data-chat]');
  if (!chat) return;
  const panel = chat.querySelector('.chat-panel');
  const launcher = chat.querySelector('.chat-launcher');
  const log = chat.querySelector('[data-chat-log]');
  const form = chat.querySelector('[data-chat-form]');
  const input = form.querySelector('input');
  const suggest = chat.querySelector('[data-chat-suggest]');
  const csrf = document.querySelector('meta[name="csrf-token"]').content;
  const history = [];
  let busy = false;

  function setOpen(open) {
    panel.hidden = !open;
    launcher.setAttribute('aria-expanded', String(open));
    if (open) input.focus();
    else launcher.focus();
  }
  chat.querySelectorAll('[data-chat-toggle]').forEach((el) => el.addEventListener('click', () => setOpen(panel.hidden)));
  document.querySelectorAll('[data-chat-open]').forEach((el) => el.addEventListener('click', () => setOpen(true)));
  panel.addEventListener('keydown', (e) => { if (e.key === 'Escape') setOpen(false); });

  function addMessage(text, who) {
    const div = document.createElement('div');
    div.className = `chat-msg ${who}`;
    div.textContent = text; // textContent, never innerHTML: replies are treated as plain text
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
    return div;
  }

  async function send(text) {
    if (busy || !text) return;
    busy = true;
    if (suggest) suggest.remove();
    addMessage(text, 'user');
    input.value = '';
    const typing = addMessage('Typing…', 'bot typing');
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
        body: JSON.stringify({ message: text, history: history.slice(-8) }),
      });
      const data = await res.json().catch(() => ({}));
      const answer = data.answer || data.error || 'Sorry, something went wrong. Please try again.';
      typing.remove();
      addMessage(answer, 'bot');
      if (data.answer) history.push({ role: 'user', content: text }, { role: 'assistant', content: data.answer });
    } catch {
      typing.remove();
      addMessage('Connection problem. Please try again in a moment.', 'bot');
    } finally {
      busy = false;
      input.focus();
    }
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    send(input.value.trim().slice(0, 500));
  });
  if (suggest) {
    suggest.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (btn) send(btn.textContent.trim());
    });
  }
})();
