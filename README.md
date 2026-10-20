# Sarrawy Academy

Online academy website with an admin panel. Node.js + Express, server-rendered pages, SQLite (built into Node — no database server needed).

## Pages

| Page | Path |
|---|---|
| Home | `/` |
| About | `/about` |
| Course: The AI Master (curriculum + application form) | `/course` |
| Free sources | `/resources` |
| Contact (email, form, chat assistant) | `/contact` |
| Admin panel | `/admin` (configurable with `ADMIN_PATH`) |

A chat assistant is available on every page. Without an API key it answers from a built-in FAQ; with `ANTHROPIC_API_KEY` set it uses Claude, grounded in the course details you edit in the admin panel.

## Admin panel

- **Dashboard** — unread messages, new applications, chat activity
- **Messages** — contact-form inbox (read / unread / delete, reply by email)
- **Enrollments** — course applications with status tracking and CSV export
- **Course** — edit title, tagline, duration, price, open/close enrollment, add/edit/reorder modules
- **Free sources** — add, edit, hide, reorder and delete resources
- **Chat assistant** — what visitors are asking (kept 90 days)
- **Security** — active sessions and a full activity/audit log
- **Account** — change password (signs out other sessions)

## Getting started

Requires Node.js 22.5 or newer.

```bash
npm install
npm run create-admin     # prompts for email, name and password
npm run dev              # http://localhost:3000
npm test                 # 42 automated tests
```

## Security

- Passwords hashed with scrypt; strong-password policy; constant-time checks that don't reveal which emails exist
- Account lockout after 5 failed logins (15 min) plus IP rate limiting on the login form
- Server-side sessions: random 256-bit tokens, stored only as SHA-256 hashes, `HttpOnly` + `SameSite=Strict` (+ `Secure` and `__Host-` prefix in production), 30-minute idle and 8-hour absolute expiry, rotated on login
- CSRF protection on every form and on the chat API (HMAC-signed tokens)
- Strict Content-Security-Policy (no inline scripts), HSTS in production, clickjacking protection, `nosniff`, Permissions-Policy, no `X-Powered-By`
- Parameterised SQL everywhere; all output HTML-escaped; only `http(s)` links accepted
- Spam protection: honeypot field, signed "time to fill" check, per-IP rate limits on forms and chat
- Request size limits and slow-request timeouts
- CSV export protected against formula injection
- Admin pages are `noindex`, `no-store`, and every admin action is written to an audit log

## Deploying

1. Copy `.env.example` and set at least `NODE_ENV=production` and a long random `SESSION_SECRET`.
2. Run behind HTTPS (the app sets `Secure` cookies and HSTS in production). Set `TRUST_PROXY=1` behind a reverse proxy.
3. Keep `DATA_DIR` on persistent storage and back up `academy.db`.
4. `npm ci --omit=dev && npm run create-admin && npm start`
