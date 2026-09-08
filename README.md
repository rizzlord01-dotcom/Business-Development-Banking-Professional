# Lady-Bisola Akinola — Portfolio + Admin Dashboard

A full-stack version of the portfolio: a public site plus a password-protected
admin dashboard that edits the live content. Built with Node.js, Express, and
SQLite — no cloud database or paid services required.

## What's inside

```
server/         Express API + SQLite database + uploaded files
public/         The public site (index.html) and the admin dashboard (admin.html)
```

- `GET /api/content` — public, returns all site content + certificate list
- `POST /api/login` — admin login, returns a session token
- `PUT /api/content` — protected, updates profile/hero/experience/competencies/education/contact
- `POST /api/certificates` / `DELETE /api/certificates/:id` — protected, manage certificate PDFs
- `POST /api/photo` / `DELETE /api/photo` — protected, manage the corporate photo

Everything the admin dashboard changes is saved to a real SQLite database file
(`server/data.sqlite`) and served back to every visitor — this is not
per-browser storage like `localStorage`; it is genuinely live for everyone.

## Running it locally

You'll need [Node.js](https://nodejs.org) 18 or newer installed.

1. Install dependencies:
   ```
   npm install
   ```
2. Copy the environment template and fill in real values:
   ```
   cp .env.example .env
   ```
   Open `.env` and set:
   - `ADMIN_USERNAME` / `ADMIN_PASSWORD` — the login used the **first time**
     the database is created. Change the password from inside the dashboard
     afterwards (Security section) — editing `.env` later has no effect once
     the database already exists.
   - `JWT_SECRET` — a long random string. Generate one with:
     ```
     node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
     ```
3. Start the server:
   ```
   npm start
   ```
4. Open:
   - Public site: http://localhost:4000/
   - Admin dashboard: http://localhost:4000/admin.html

The first time the server runs, it creates `server/data.sqlite` and seeds it
with the current content and your admin account. Delete that file if you ever
want to start over from scratch (this also deletes any edits you've made).

## Putting it on the internet

This is a real Node.js server, not a static site, so it needs a host that can
run Node — not GitHub Pages. Reasonable free/cheap options:

- **Render.com** — connect the repo, set the environment variables from
  `.env.example` in its dashboard, add a **persistent disk** mounted at
  `server/` (or at least `server/data.sqlite` and `server/uploads/`) so the
  database and uploaded files survive restarts and redeploys.
- **Railway.app** — similar setup, also supports persistent volumes.
- A basic VPS (e.g. DigitalOcean) running Node directly behind Nginx, with
  `pm2` to keep the process alive.

Whichever host you use, the important thing is a **persistent volume** for
`server/data.sqlite` and `server/uploads/` — without it, every redeploy wipes
her content and certificates back to the defaults.

## Editing content

- Day-to-day changes (bio text, roles, competencies, education, certificates,
  photo) — all done through `/admin.html`, no code required.
- If you ever want to change the *design* (colours, layout, fonts), that's in
  `public/style.css` and `public/admin.css`.
- The very first default content (used only the first time the database is
  created) lives in `server/db.js` inside `DEFAULT_CONTENT` — after that,
  the database is the source of truth, not this file.

## Certificates

Upload each certificate PDF from the admin dashboard's Certificates section —
give it a title and (optionally) an issuer, and it appears immediately in the
Certificates section of the live site with a working download link.

## Security notes

- Change the seeded admin password immediately after your first login
  (Security section in the dashboard).
- The login session token expires after 12 hours; you'll need to log back in
  after that.
- This is a single-admin setup — fine for a personal portfolio, not built for
  multiple editors or roles.
