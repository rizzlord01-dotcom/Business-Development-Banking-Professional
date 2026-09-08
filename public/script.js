// ---------- Splash intro (plays on every load, ~5s, skippable) ----------

(function initSplash() {
  const splash = document.getElementById('splash');
  const skipBtn = document.getElementById('splashSkip');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const duration = reduceMotion ? 800 : 5000;
  const timer = setTimeout(() => splash.classList.add('hide'), duration);

  function skip() {
    clearTimeout(timer);
    splash.classList.add('hide');
  }

  skipBtn.addEventListener('click', skip);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') skip(); }, { once: true });
})();

// ---------- Mobile nav ----------

(function initNav() {
  const toggle = document.getElementById('navToggle');
  const sidebar = document.getElementById('sidebar');

  toggle.addEventListener('click', () => sidebar.classList.toggle('open'));
  sidebar.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => sidebar.classList.remove('open'));
  });
  document.addEventListener('click', (e) => {
    if (sidebar.classList.contains('open') && !sidebar.contains(e.target) && e.target !== toggle) {
      sidebar.classList.remove('open');
    }
  });
})();

// ---------- Content rendering ----------

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

function renderSidebar(sidebar) {
  document.getElementById('sidebarName').innerHTML = escapeHtml(sidebar.name).replace(/ /, '<br>');
  document.getElementById('sidebarRole').textContent = sidebar.role;
  document.getElementById('sidebarFocus').textContent = sidebar.focus;
  document.getElementById('sidebarLocation').textContent = sidebar.location;

  const email = document.getElementById('sidebarEmail');
  email.textContent = sidebar.email;
  email.href = `mailto:${sidebar.email}`;

  const phone = document.getElementById('sidebarPhone');
  phone.textContent = sidebar.phone;
  phone.href = `tel:${sidebar.phone.replace(/[^+\d]/g, '')}`;

  document.getElementById('sealMono').textContent = (sidebar.name || 'LBA')
    .split(' ').map(w => w[0]).join('').slice(0, 3).toUpperCase();
}

function renderPhoto(photoUrl) {
  const frame = document.getElementById('sealFrame');
  const img = document.getElementById('portraitImg');
  if (photoUrl) {
    img.src = photoUrl;
    img.hidden = false;
    frame.classList.add('has-photo');
  } else {
    img.hidden = true;
    frame.classList.remove('has-photo');
  }
}

function renderHero(hero) {
  document.getElementById('heroLabel').textContent = hero.label;
  const lede = document.getElementById('heroLede');
  const text = hero.lede || '';
  lede.innerHTML = `<span class="dropcap">${escapeHtml(text[0] || '')}</span>${escapeHtml(text.slice(1))}`;

  const statsRow = document.getElementById('statsRow');
  const stats = [
    { value: '8+', label: 'Years of impact' },
    { value: '4', label: 'Key sectors' },
    { value: '100%', label: 'Relationship-led' }
  ];
  statsRow.innerHTML = stats.map(stat => `
    <div class="stat-card">
      <span class="stat-value">${escapeHtml(stat.value)}</span>
      <span class="stat-label">${escapeHtml(stat.label)}</span>
    </div>
  `).join('');

  const clientsList = document.getElementById('clientsList');
  clientsList.innerHTML = (hero.clients || []).map(c => `<li>${escapeHtml(c)}</li>`).join('');
}

function renderExperience(experience) {
  const el = document.getElementById('timelineList');
  el.innerHTML = (experience || []).map(item => `
    <article class="entry ${item.current ? 'is-current' : ''}">
      <div class="entry-year"><span class="dot"></span>${escapeHtml(item.period)}</div>
      <div class="entry-body">
        <h3>${escapeHtml(item.role)}</h3>
        <p class="entry-org">${escapeHtml(item.org)}</p>
        <ul>${(item.bullets || []).map(b => `<li>${escapeHtml(b)}</li>`).join('')}</ul>
      </div>
    </article>
  `).join('');
}

function renderCompetencies(list) {
  const el = document.getElementById('ledgerList');
  el.innerHTML = (list || []).map(c => `
    <div class="ledger-item">
      <span class="ledger-name">${escapeHtml(c.name)}</span>
      <span class="ledger-tag">${escapeHtml(c.category)}</span>
    </div>
  `).join('');
}

function renderEducation(list) {
  const el = document.getElementById('eduList');
  el.innerHTML = (list || []).map(e => `
    <div class="edu-row">
      <span class="edu-year">${escapeHtml(e.year)}</span>
      <span class="edu-name">${escapeHtml(e.name)}</span>
    </div>
  `).join('');
}

function renderCertificates(certs) {
  const grid = document.getElementById('certGrid');
  const empty = document.getElementById('certEmpty');
  if (!certs || certs.length === 0) {
    grid.innerHTML = '';
    empty.hidden = false;
    return;
  }
  empty.hidden = true;
  grid.innerHTML = certs.map(c => `
    <a class="cert-card" href="/uploads/certificates/${encodeURIComponent(c.filename)}" target="_blank" rel="noopener">
      <span class="cert-icon">PDF</span>
      <span class="cert-title">${escapeHtml(c.title)}</span>
      <span class="cert-issuer">${escapeHtml(c.issuer || '')}</span>
    </a>
  `).join('');
}

function renderContact(sidebar, contact) {
  document.getElementById('contactBlurb').textContent = contact.blurb;
  const email = document.getElementById('contactEmail');
  email.textContent = sidebar.email;
  email.href = `mailto:${sidebar.email}`;
  const phone = document.getElementById('contactPhone');
  phone.textContent = sidebar.phone;
  phone.href = `tel:${sidebar.phone.replace(/[^+\d]/g, '')}`;
  document.getElementById('contactAddress').textContent = contact.address;
}

async function loadSite() {
  try {
    const res = await fetch('/api/content');
    const { content, certificates } = await res.json();
    renderSidebar(content.sidebar);
    renderPhoto(content.photo);
    renderHero(content.hero);
    renderExperience(content.experience);
    renderCompetencies(content.competencies);
    renderEducation(content.education);
    renderCertificates(certificates);
    renderContact(content.sidebar, content.contact);
  } catch (err) {
    console.error('Could not load site content:', err);
  }
}

loadSite();
