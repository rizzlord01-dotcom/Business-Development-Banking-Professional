const path = require('path');
const bcrypt = require('bcryptjs');
const { DatabaseSync } = require('node:sqlite');

const DB_PATH = path.join(__dirname, 'data.sqlite');
const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS site_content (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    json TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS certificates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    issuer TEXT,
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS admin_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL
  );
`);

const DEFAULT_CONTENT = {
  sidebar: {
    name: 'Lady-Bisola Akinola',
    role: 'Business Development & Banking Professional',
    focus: 'Trade Finance · Relationship Management · Sales',
    location: 'Lekki Scheme 2, Lagos',
    email: 'akinolabisola081@gmail.com',
    phone: '+234 816 169 1552'
  },
  photo: null,
  hero: {
    label: 'Profile',
    lede: "Eight years across international trade operations and grassroots development work, I turn complex transactions and messy data alike into decisions people can act on. My background spans letters of credit for some of Nigeria's largest corporates to monitoring frameworks for community-level programmes — different worlds, the same discipline: get the numbers right, get the relationships right, and get the report on someone's desk before they ask for it.",
    clients: ['Dangote Group', 'BUA Group', 'PZ Cussons', 'Unilever']
  },
  experience: [
    {
      period: '2024 — Present',
      current: true,
      role: 'Senior Monitoring and Evaluation Officer',
      org: 'Finlite Grassroots Initiative, Ojodu Berger, Lagos',
      bullets: [
        'Led M&E activities, tracking project performance, outputs, outcomes, and key indicators',
        'Collected, validated, and analysed programme data to support evidence-based decisions',
        'Built monitoring tools, reporting templates, and performance-tracking systems',
        'Delivered periodic reports and dashboards with actionable insight for management and stakeholders'
      ]
    },
    {
      period: 'UBA',
      current: false,
      role: 'Team Lead, International Trade Operations',
      org: 'United Bank for Africa, Lagos',
      bullets: [
        'Managed end-to-end international trade transactions and Letters of Credit for corporate clients including Dangote Group, BUA Group, PZ Cussons, and Unilever',
        'Coordinated with finance, procurement, and treasury stakeholders to ensure seamless import/export payments',
        'Processed high-value Letters of Credit, shipping documents, loans, and trade finance facilities within strict compliance timelines',
        'Built trusted relationships with key decision-makers, improving client satisfaction and repeat business'
      ]
    },
    {
      period: 'UBA',
      current: false,
      role: 'Retail Sales',
      org: 'United Bank for Africa, Lagos',
      bullets: [
        'Drove customer acquisition by promoting banking products to new and existing clients',
        'Developed and executed marketing strategies to grow brand visibility and market share',
        'Conducted market research and competitive analysis to identify growth opportunities',
        'Maintained strong customer relationships to support retention and upselling'
      ]
    }
  ],
  competencies: [
    { name: 'B2B Sales', category: 'Sales' },
    { name: 'Contract Negotiation', category: 'Sales' },
    { name: 'Trade Finance Knowledge', category: 'Technical' },
    { name: 'Tender / Procurement Understanding', category: 'Technical' },
    { name: 'Microsoft Office & Data Management', category: 'Technical' },
    { name: 'Data Analysis & Performance Monitoring', category: 'Analytical' },
    { name: 'Client Relationship Management', category: 'Relationship' },
    { name: 'Stakeholder Engagement', category: 'Relationship' },
    { name: 'Effective Communication', category: 'Relationship' },
    { name: 'Project & Programme Coordination', category: 'Operations' },
    { name: 'Process Improvement & Operational Excellence', category: 'Operations' },
    { name: 'Team Leadership & Collaboration', category: 'Leadership' }
  ],
  education: [
    { year: '2026 – 2027', name: 'Master of Business Administration (MBA), in view — Miva Open University' },
    { year: '2025 – 2026', name: 'mMBA / Mini Masters in Business Administration & Diploma in Business Administration — International Business Management Institute, Berlin' },
    { year: '2022', name: 'Postgraduate Diploma, Business Administration and Management — Ajayi Crowther University, Oyo' },
    { year: '2010 – 2016', name: 'OND & HND, Business Administration and Management — Federal Polytechnic, Ado Ekiti' }
  ],
  contact: {
    blurb: 'Open to conversations on trade finance, business development, and monitoring & evaluation partnerships.',
    address: 'Audu Angulu Street, Lekki Scheme 2, Lagos'
  }
};

function ensureSeed() {
  const existing = db.prepare('SELECT id FROM site_content WHERE id = 1').get();
  if (!existing) {
    db.prepare('INSERT INTO site_content (id, json) VALUES (1, ?)').run(JSON.stringify(DEFAULT_CONTENT));
    console.log('Seeded default site content.');
  }

  const userCount = db.prepare('SELECT COUNT(*) AS n FROM admin_users').get().n;
  if (userCount === 0) {
    const username = process.env.ADMIN_USERNAME || 'admin';
    const password = process.env.ADMIN_PASSWORD || 'change-this-password';
    const hash = bcrypt.hashSync(password, 10);
    db.prepare('INSERT INTO admin_users (username, password_hash) VALUES (?, ?)').run(username, hash);
    console.log(`Seeded admin user "${username}". Log in and consider this the first thing to change.`);
  }
}

ensureSeed();

module.exports = db;
