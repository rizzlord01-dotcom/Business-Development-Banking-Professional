const TOKEN_KEY = 'lba_admin_token';
let state = { content: null, certificates: [] };

const loginScreen = document.getElementById('loginScreen');
const dashboard = document.getElementById('dashboard');
const toast = document.getElementById('toast');

function getToken() { return localStorage.getItem(TOKEN_KEY); }
function setToken(t) { localStorage.setItem(TOKEN_KEY, t); }
function clearToken() { localStorage.removeItem(TOKEN_KEY); }

function showToast(msg, isError) {
  toast.textContent = msg;
  toast.hidden = false;
  toast.style.background = isError ? '#FBEFED' : '#EFE7D2';
  toast.style.color = isError ? '#8A3B32' : '#5C4A17';
  toast.style.borderColor = isError ? '#E7C9C4' : '#D8B876';
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => { toast.hidden = true; }, 3500);
}

async function api(path, options = {}) {
  const headers = options.headers || {};
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (options.json) {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(options.json);
  }
  const res = await fetch(path, { ...options, headers });
  if (res.status === 401) {
    clearToken();
    showLogin();
    throw new Error('Session expired. Please log in again.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong.');
  return data;
}

function showLogin() { loginScreen.hidden = false; dashboard.hidden = true; }
function showDashboard() { loginScreen.hidden = true; dashboard.hidden = false; }

// ---------- Login ----------

document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;
  const errorEl = document.getElementById('loginError');
  errorEl.hidden = true;
  try {
    const data = await api('/api/login', { method: 'POST', json: { username, password } });
    setToken(data.token);
    await init();
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.hidden = false;
  }
});

document.getElementById('logoutBtn').addEventListener('click', () => {
  clearToken();
  showLogin();
});

// ---------- Load content ----------

async function loadContent() {
  const data = await api('/api/content');
  state.content = data.content;
  state.certificates = data.certificates;
}

function fillProfileForm() {
  const s = state.content.sidebar;
  document.getElementById('fName').value = s.name;
  document.getElementById('fRole').value = s.role;
  document.getElementById('fFocus').value = s.focus;
  document.getElementById('fLocation').value = s.location;
  document.getElementById('fEmail').value = s.email;
  document.getElementById('fPhone').value = s.phone;
}

function fillHeroForm() {
  const h = state.content.hero;
  document.getElementById('fHeroLabel').value = h.label;
  document.getElementById('fHeroLede').value = h.lede;
  document.getElementById('fHeroClients').value = (h.clients || []).join('\n');
}

function fillContactForm() {
  const c = state.content.contact;
  document.getElementById('fContactBlurb').value = c.blurb;
  document.getElementById('fContactAddress').value = c.address;
}

function fillPhoto() {
  const img = document.getElementById('photoPreview');
  const placeholder = document.getElementById('photoPlaceholder');
  if (state.content.photo) {
    img.src = state.content.photo;
    img.hidden = false;
    placeholder.hidden = true;
  } else {
    img.hidden = true;
    placeholder.hidden = false;
  }
}

// ---------- Repeatable lists: experience ----------

function renderExperienceList() {
  const wrap = document.getElementById('experienceList');
  wrap.innerHTML = '';
  state.content.experience.forEach((item, i) => {
    const div = document.createElement('div');
    div.className = 'repeat-item';
    div.innerHTML = `
      <div class="repeat-row">
        <label>Period label<input type="text" data-f="period" value="${escAttr(item.period)}"></label>
        <label class="current-toggle" style="flex:0 0 auto; align-self:flex-end;">
          <input type="checkbox" data-f="current" ${item.current ? 'checked' : ''}> Current role
        </label>
      </div>
      <label>Role title<input type="text" data-f="role" value="${escAttr(item.role)}"></label>
      <label>Organisation<input type="text" data-f="org" value="${escAttr(item.org)}"></label>
      <label>Bullet points (one per line)<textarea rows="4" data-f="bullets">${escHtml((item.bullets || []).join('\n'))}</textarea></label>
      <button type="button" class="remove-btn" data-remove="${i}">Remove role</button>
    `;
    wrap.appendChild(div);
  });
  wrap.querySelectorAll('[data-remove]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.content.experience.splice(Number(btn.dataset.remove), 1);
      renderExperienceList();
    });
  });
}

document.getElementById('addExperienceBtn').addEventListener('click', () => {
  state.content.experience.push({ period: '', current: false, role: '', org: '', bullets: [] });
  renderExperienceList();
});

function collectExperience() {
  const items = [...document.querySelectorAll('#experienceList .repeat-item')];
  return items.map(el => ({
    period: el.querySelector('[data-f="period"]').value.trim(),
    current: el.querySelector('[data-f="current"]').checked,
    role: el.querySelector('[data-f="role"]').value.trim(),
    org: el.querySelector('[data-f="org"]').value.trim(),
    bullets: el.querySelector('[data-f="bullets"]').value.split('\n').map(s => s.trim()).filter(Boolean)
  }));
}

// ---------- Repeatable lists: competencies ----------

function renderCompetencyList() {
  const wrap = document.getElementById('competencyList');
  wrap.innerHTML = '';
  state.content.competencies.forEach((item, i) => {
    const div = document.createElement('div');
    div.className = 'repeat-item';
    div.innerHTML = `
      <div class="repeat-row">
        <label>Name<input type="text" data-f="name" value="${escAttr(item.name)}"></label>
        <label>Category<input type="text" data-f="category" value="${escAttr(item.category)}"></label>
      </div>
      <button type="button" class="remove-btn" data-remove="${i}">Remove</button>
    `;
    wrap.appendChild(div);
  });
  wrap.querySelectorAll('[data-remove]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.content.competencies.splice(Number(btn.dataset.remove), 1);
      renderCompetencyList();
    });
  });
}

document.getElementById('addCompetencyBtn').addEventListener('click', () => {
  state.content.competencies.push({ name: '', category: '' });
  renderCompetencyList();
});

function collectCompetencies() {
  const items = [...document.querySelectorAll('#competencyList .repeat-item')];
  return items.map(el => ({
    name: el.querySelector('[data-f="name"]').value.trim(),
    category: el.querySelector('[data-f="category"]').value.trim()
  })).filter(c => c.name);
}

// ---------- Repeatable lists: education ----------

function renderEducationList() {
  const wrap = document.getElementById('educationList');
  wrap.innerHTML = '';
  state.content.education.forEach((item, i) => {
    const div = document.createElement('div');
    div.className = 'repeat-item';
    div.innerHTML = `
      <label>Year(s)<input type="text" data-f="year" value="${escAttr(item.year)}"></label>
      <label>Qualification &amp; institution<input type="text" data-f="name" value="${escAttr(item.name)}"></label>
      <button type="button" class="remove-btn" data-remove="${i}">Remove</button>
    `;
    wrap.appendChild(div);
  });
  wrap.querySelectorAll('[data-remove]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.content.education.splice(Number(btn.dataset.remove), 1);
      renderEducationList();
    });
  });
}

document.getElementById('addEducationBtn').addEventListener('click', () => {
  state.content.education.push({ year: '', name: '' });
  renderEducationList();
});

function collectEducation() {
  const items = [...document.querySelectorAll('#educationList .repeat-item')];
  return items.map(el => ({
    year: el.querySelector('[data-f="year"]').value.trim(),
    name: el.querySelector('[data-f="name"]').value.trim()
  })).filter(e => e.name);
}

// ---------- Certificates ----------

function renderCertList() {
  const wrap = document.getElementById('certList');
  if (state.certificates.length === 0) {
    wrap.innerHTML = '<p class="hint">No certificates uploaded yet.</p>';
    return;
  }
  wrap.innerHTML = state.certificates.map(c => `
    <div class="cert-admin-item">
      <a href="/uploads/certificates/${encodeURIComponent(c.filename)}" target="_blank" rel="noopener">${escHtml(c.title)}</a>
      <button type="button" class="remove-btn" data-cert-remove="${c.id}">Delete</button>
    </div>
  `).join('');
  wrap.querySelectorAll('[data-cert-remove]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this certificate?')) return;
      try {
        await api(`/api/certificates/${btn.dataset.certRemove}`, { method: 'DELETE' });
        state.certificates = state.certificates.filter(c => String(c.id) !== btn.dataset.certRemove);
        renderCertList();
        showToast('Certificate deleted.');
      } catch (err) {
        showToast(err.message, true);
      }
    });
  });
}

document.getElementById('certUploadBtn').addEventListener('click', async () => {
  const title = document.getElementById('certTitle').value.trim();
  const issuer = document.getElementById('certIssuer').value.trim();
  const fileInput = document.getElementById('certFile');
  const file = fileInput.files[0];
  if (!title || !file) return showToast('Title and PDF file are required.', true);

  const formData = new FormData();
  formData.append('title', title);
  formData.append('issuer', issuer);
  formData.append('file', file);

  try {
    const token = getToken();
    const res = await fetch('/api/certificates', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Upload failed.');
    state.certificates.push(data.certificate);
    renderCertList();
    document.getElementById('certTitle').value = '';
    document.getElementById('certIssuer').value = '';
    fileInput.value = '';
    showToast('Certificate uploaded.');
  } catch (err) {
    showToast(err.message, true);
  }
});

// ---------- Photo ----------

document.getElementById('photoUploadBtn').addEventListener('click', async () => {
  const fileInput = document.getElementById('photoInput');
  const file = fileInput.files[0];
  if (!file) return showToast('Choose a photo first.', true);
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    return showToast('Use a JPG, PNG, or WEBP image.', true);
  }
  if (file.size > 8 * 1024 * 1024) {
    return showToast('Photo must be 8MB or smaller.', true);
  }
  const formData = new FormData();
  formData.append('file', file);
  try {
    const token = getToken();
    const res = await fetch('/api/photo', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Upload failed.');
    state.content = data.content;
    fillPhoto();
    fileInput.value = '';
    showToast('Photo updated — live on the site now.');
  } catch (err) {
    showToast(err.message, true);
  }
});

document.getElementById('photoRemoveBtn').addEventListener('click', async () => {
  try {
    const data = await api('/api/photo', { method: 'DELETE' });
    state.content = data.content;
    fillPhoto();
    showToast('Photo removed.');
  } catch (err) {
    showToast(err.message, true);
  }
});

// ---------- Save handlers ----------

document.querySelectorAll('[data-save]').forEach(btn => {
  btn.addEventListener('click', async () => {
    const key = btn.dataset.save;
    let payload = {};
    try {
      if (key === 'sidebar') {
        payload.sidebar = {
          name: document.getElementById('fName').value.trim(),
          role: document.getElementById('fRole').value.trim(),
          focus: document.getElementById('fFocus').value.trim(),
          location: document.getElementById('fLocation').value.trim(),
          email: document.getElementById('fEmail').value.trim(),
          phone: document.getElementById('fPhone').value.trim()
        };
      } else if (key === 'hero') {
        payload.hero = {
          label: document.getElementById('fHeroLabel').value.trim(),
          lede: document.getElementById('fHeroLede').value.trim(),
          clients: document.getElementById('fHeroClients').value.split('\n').map(s => s.trim()).filter(Boolean)
        };
      } else if (key === 'experience') {
        payload.experience = collectExperience();
      } else if (key === 'competencies') {
        payload.competencies = collectCompetencies();
      } else if (key === 'education') {
        payload.education = collectEducation();
      } else if (key === 'contact') {
        payload.contact = {
          blurb: document.getElementById('fContactBlurb').value.trim(),
          address: document.getElementById('fContactAddress').value.trim()
        };
      }
      const data = await api('/api/content', { method: 'PUT', json: payload });
      state.content = data.content;
      showToast('Saved — live on the site now.');
    } catch (err) {
      showToast(err.message, true);
    }
  });
});

document.getElementById('changePwBtn').addEventListener('click', async () => {
  const currentPassword = document.getElementById('pwCurrent').value;
  const newPassword = document.getElementById('pwNew').value;
  try {
    await api('/api/change-password', { method: 'POST', json: { currentPassword, newPassword } });
    document.getElementById('pwCurrent').value = '';
    document.getElementById('pwNew').value = '';
    showToast('Password changed.');
  } catch (err) {
    showToast(err.message, true);
  }
});

// ---------- Helpers ----------

function escHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}
function escAttr(str) { return escHtml(str).replace(/"/g, '&quot;'); }

// ---------- Init ----------

async function init() {
  try {
    await loadContent();
    fillProfileForm();
    fillHeroForm();
    fillContactForm();
    fillPhoto();
    renderExperienceList();
    renderCompetencyList();
    renderEducationList();
    renderCertList();
    showDashboard();
  } catch (err) {
    showToast(err.message, true);
  }
}

if (getToken()) {
  init();
} else {
  showLogin();
}
