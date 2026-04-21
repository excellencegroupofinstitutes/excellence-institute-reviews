/* ── Admin Dashboard Logic ── */

const FACULTIES_KEY  = 'ei_faculties';
const REVIEWS_KEY    = 'ei_reviews';
const SESSIONS_KEY   = 'ei_sessions';
const SESSION_AUTH   = 'ei_admin_session';
const ADMIN_PASSWORD = 'Excellence@2024';  // Change to your preferred password

let modalAction = null;           // callback for confirm modal
let expandedSessions = new Set(); // track which session cards are expanded

/* ════════════════════════════════════════════
   BOOTSTRAP
════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  if (isLoggedIn()) showDashboard();

  document.getElementById('login-form').addEventListener('submit', handleLogin);
  document.getElementById('create-session-form').addEventListener('submit', createSession);
  document.getElementById('add-faculty-form').addEventListener('submit', addFaculty);

  ['filter-session', 'filter-faculty-rev', 'filter-class', 'filter-sort'].forEach(id => {
    document.getElementById(id).addEventListener('change', renderReviews);
  });
});

/* ════════════════════════════════════════════
   AUTH
════════════════════════════════════════════ */
function handleLogin(e) {
  e.preventDefault();
  const pw = document.getElementById('admin-password').value;
  if (pw === ADMIN_PASSWORD) {
    sessionStorage.setItem(SESSION_AUTH, '1');
    document.getElementById('login-error').classList.add('hidden');
    document.getElementById('admin-password').classList.remove('invalid');
    showDashboard();
  } else {
    document.getElementById('login-error').classList.remove('hidden');
    document.getElementById('admin-password').classList.add('invalid');
    document.getElementById('admin-password').value = '';
    document.getElementById('admin-password').focus();
  }
}
function isLoggedIn() { return sessionStorage.getItem(SESSION_AUTH) === '1'; }
function adminLogout() {
  sessionStorage.removeItem(SESSION_AUTH);
  document.getElementById('dashboard').classList.add('hidden');
  document.getElementById('login-overlay').classList.remove('hidden');
  document.getElementById('admin-password').value = '';
}
function showDashboard() {
  document.getElementById('login-overlay').classList.add('hidden');
  document.getElementById('dashboard').classList.remove('hidden');
  renderAll();
}

/* ════════════════════════════════════════════
   TABS
════════════════════════════════════════════ */
function switchTab(name) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
  document.getElementById(`tab-${name}`).classList.remove('hidden');
  if (name === 'reviews') renderReviews();
}

/* ════════════════════════════════════════════
   RENDER ALL
════════════════════════════════════════════ */
function renderAll() {
  renderStats();
  renderSessions();
  renderFacultyList();
  populateSessionFacultyDropdown();
  populateReviewFilters();
}

/* ════════════════════════════════════════════
   STATS
════════════════════════════════════════════ */
function renderStats() {
  const sessions  = getSessions();
  const faculties = getFaculties();
  const reviews   = getReviews();
  const active    = sessions.filter(isSessionActive).length;

  document.getElementById('stat-sessions').textContent  = sessions.length;
  document.getElementById('stat-active').textContent    = active;
  document.getElementById('stat-faculties').textContent = faculties.length;
  document.getElementById('stat-reviews').textContent   = reviews.length;

  if (reviews.length > 0) {
    const avg = ((reviews.reduce((s, r) => s + r.styleRating + r.methodsRating, 0)) / (reviews.length * 2)).toFixed(1);
    document.getElementById('stat-avg').textContent = `${avg} ★`;
  } else {
    document.getElementById('stat-avg').textContent = '—';
  }
}

/* ════════════════════════════════════════════
   SESSIONS
════════════════════════════════════════════ */
function createSession(e) {
  e.preventDefault();
  let valid = true;

  const name      = document.getElementById('session-name').value.trim();
  const facultyId = document.getElementById('session-faculty-select').value || null;
  const startDate = document.getElementById('session-start').value || null;
  const endDate   = document.getElementById('session-end').value || null;

  if (!name) { showFErr('session-name', 'sname-error'); valid = false; }
  else         clearFErr('session-name', 'sname-error');

  if (startDate && endDate && endDate < startDate) {
    document.getElementById('sdate-error').classList.remove('hidden'); valid = false;
  } else {
    document.getElementById('sdate-error').classList.add('hidden');
  }

  if (!valid) return;

  const session = {
    id:          crypto.randomUUID(),
    name,
    facultyId,
    startDate,
    endDate,
    status:      'active',
    createdDate: new Date().toISOString(),
    actualEndDate: null,
  };

  const sessions = getSessions();
  sessions.push(session);
  saveSessions(sessions);

  document.getElementById('create-session-form').reset();
  renderAll();
}

function endSession(id) {
  openModal(
    'End Session',
    'Are you sure you want to end this session? Students will no longer be able to submit reviews for it.',
    () => {
      const sessions = getSessions().map(s =>
        s.id === id ? { ...s, status: 'ended', actualEndDate: new Date().toISOString() } : s
      );
      saveSessions(sessions);
      renderAll();
    },
    'End Session',
    'btn-end'
  );
}

function deleteSession(id, name) {
  openModal(
    'Delete Session',
    `Delete session "<strong>${escHtml(name)}</strong>"? All reviews in this session will also be permanently removed.`,
    () => {
      saveSessions(getSessions().filter(s => s.id !== id));
      saveReviews(getReviews().filter(r => r.sessionId !== id));
      expandedSessions.delete(id);
      renderAll();
    },
    'Delete Permanently',
    'btn-danger'
  );
}

function toggleSessionReviews(id) {
  if (expandedSessions.has(id)) {
    expandedSessions.delete(id);
  } else {
    expandedSessions.add(id);
  }
  renderSessions();
}

function renderSessions() {
  const sessions  = getSessions();
  const faculties = getFaculties();
  const reviews   = getReviews();
  const facMap    = Object.fromEntries(faculties.map(f => [f.id, f]));

  const active = sessions.filter(isSessionActive);
  const ended  = sessions.filter(s => !isSessionActive(s)).reverse();

  renderSessionList('active-sessions-list', active, facMap, reviews, true);
  renderSessionList('ended-sessions-list',  ended,  facMap, reviews, false);
}

function renderSessionList(containerId, sessions, facMap, allReviews, isActive) {
  const container = document.getElementById(containerId);

  if (sessions.length === 0) {
    container.innerHTML = `<p class="empty-msg">No ${isActive ? 'active' : 'ended'} sessions.</p>`;
    return;
  }

  container.innerHTML = sessions.map(s => {
    const faculty      = s.facultyId ? facMap[s.facultyId] : null;
    const reviews      = allReviews.filter(r => r.sessionId === s.id);
    const isExpanded   = expandedSessions.has(s.id);
    const createdStr   = fmtDate(s.createdDate);
    const endedStr     = s.actualEndDate ? fmtDate(s.actualEndDate) : null;
    const avgRating    = reviews.length
      ? ((reviews.reduce((sum, r) => sum + r.styleRating + r.methodsRating, 0)) / (reviews.length * 2)).toFixed(1)
      : null;

    const metaParts = [];
    if (faculty) metaParts.push(`<span>👩‍🏫 ${escHtml(faculty.name)}</span>`);
    if (s.startDate || s.endDate) {
      const range = [s.startDate && fmtDateStr(s.startDate), s.endDate && fmtDateStr(s.endDate)].filter(Boolean).join(' → ');
      metaParts.push(`<span>📅 ${range}</span>`);
    }
    metaParts.push(`<span>📝 ${reviews.length} review${reviews.length !== 1 ? 's' : ''}</span>`);
    if (avgRating) metaParts.push(`<span>⭐ ${avgRating} avg</span>`);
    if (endedStr) metaParts.push(`<span>Ended ${endedStr}</span>`);
    else          metaParts.push(`<span>Created ${createdStr}</span>`);

    const reviewsHtml = isExpanded ? buildReviewsMini(reviews, facMap) : '';

    return `
      <div class="session-card ${isActive ? 'is-active' : 'is-ended'}">
        <div class="session-card-header">
          <span class="session-card-name">${escHtml(s.name)}</span>
          <span class="status-badge ${isActive ? 'badge-active' : 'badge-ended'}">${isActive ? 'Active' : 'Ended'}</span>
        </div>
        <div class="session-meta">${metaParts.join('')}</div>
        <div class="session-actions">
          ${isActive ? `<button class="btn btn-end" onclick="endSession('${s.id}')">⏹ End Session</button>` : ''}
          <button class="btn btn-ghost" onclick="toggleSessionReviews('${s.id}')">
            ${isExpanded ? '▲ Hide Reviews' : `▼ Show Reviews (${reviews.length})`}
          </button>
          <button class="delete-btn" title="Delete session" onclick="deleteSession('${s.id}', '${escHtml(s.name).replace(/'/g, "\\'")}')">🗑</button>
        </div>
        ${isExpanded ? `<div class="session-reviews-wrap">${reviewsHtml}</div>` : ''}
      </div>
    `;
  }).join('');
}

function buildReviewsMini(reviews, facMap) {
  if (reviews.length === 0) return '<p class="no-reviews-mini">No reviews in this session yet.</p>';

  return reviews
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .map(r => {
      const fac = facMap[r.facultyId] || { name: 'Unknown', department: '' };
      return `
        <div class="session-review-mini">
          <div class="smini-top">
            <span class="smini-fac">${escHtml(fac.name)}</span>
            <span class="smini-class">${escHtml(r.class || '—')}</span>
            <span class="smini-date">${fmtDate(r.date)}</span>
          </div>
          <div class="smini-ratings">
            <span>Style: <span class="smini-stars">${'★'.repeat(r.styleRating)}${'☆'.repeat(5 - r.styleRating)}</span> ${r.styleRating}/5</span>
            <span>Methods: <span class="smini-stars">${'★'.repeat(r.methodsRating)}${'☆'.repeat(5 - r.methodsRating)}</span> ${r.methodsRating}/5</span>
          </div>
          <div class="smini-comment">${escHtml(r.comment)}</div>
          ${r.improvement ? `<div class="smini-improvement"><span class="improvement-label">💡 Institute:</span> ${escHtml(r.improvement)}</div>` : ''}
        </div>
      `;
    }).join('');
}

/* ════════════════════════════════════════════
   FACULTY
════════════════════════════════════════════ */
function addFaculty(e) {
  e.preventDefault();
  let valid = true;
  const name = document.getElementById('faculty-name').value.trim();
  const dept = document.getElementById('faculty-dept').value.trim();

  if (!name) { showFErr('faculty-name', 'fname-error'); valid = false; }
  else         clearFErr('faculty-name', 'fname-error');
  if (!valid) return;

  const faculties = getFaculties();
  faculties.push({ id: crypto.randomUUID(), name, department: dept, addedDate: new Date().toISOString() });
  saveFaculties(faculties);
  document.getElementById('add-faculty-form').reset();
  renderAll();
}

function renderFacultyList() {
  const faculties = getFaculties().slice().sort((a, b) => a.name.localeCompare(b.name));
  const reviews   = getReviews();
  const container = document.getElementById('faculty-list');

  if (faculties.length === 0) {
    container.innerHTML = '<p class="empty-msg">No faculty members added yet.</p>';
    return;
  }
  container.innerHTML = faculties.map(f => {
    const count = reviews.filter(r => r.facultyId === f.id).length;
    return `
      <div class="faculty-item">
        <div class="faculty-info">
          <div class="faculty-name">${escHtml(f.name)}</div>
          ${f.department ? `<div class="faculty-dept">${escHtml(f.department)}</div>` : ''}
        </div>
        <span class="review-count-badge">${count} review${count !== 1 ? 's' : ''}</span>
        <button class="delete-btn" title="Delete faculty" onclick="deleteFaculty('${f.id}', '${escHtml(f.name).replace(/'/g, "\\'")}')">🗑</button>
      </div>
    `;
  }).join('');
}

function deleteFaculty(id, name) {
  openModal(
    'Delete Faculty',
    `Remove "<strong>${escHtml(name)}</strong>"? All their reviews will also be permanently deleted.`,
    () => {
      saveFaculties(getFaculties().filter(f => f.id !== id));
      saveReviews(getReviews().filter(r => r.facultyId !== id));
      renderAll();
    }
  );
}

/* ════════════════════════════════════════════
   REVIEWS TAB
════════════════════════════════════════════ */
function populateReviewFilters() {
  const sessions  = getSessions();
  const faculties = getFaculties();
  const reviews   = getReviews();

  const selSess = document.getElementById('filter-session');
  const prevSess = selSess.value;
  selSess.innerHTML = '<option value="">All Sessions</option>';
  sessions.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = s.name;
    selSess.appendChild(opt);
  });
  if (prevSess) selSess.value = prevSess;

  const selFac = document.getElementById('filter-faculty-rev');
  const prevFac = selFac.value;
  selFac.innerHTML = '<option value="">All Faculty</option>';
  faculties.slice().sort((a, b) => a.name.localeCompare(b.name)).forEach(f => {
    const opt = document.createElement('option');
    opt.value = f.id;
    opt.textContent = f.name;
    selFac.appendChild(opt);
  });
  if (prevFac) selFac.value = prevFac;

  // Populate class filter with classes that actually appear in reviews
  const selClass = document.getElementById('filter-class');
  const prevClass = selClass.value;
  const usedClasses = [...new Set(reviews.map(r => r.class).filter(Boolean))].sort();
  selClass.innerHTML = '<option value="">All Classes</option>';
  usedClasses.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c;
    opt.textContent = c;
    selClass.appendChild(opt);
  });
  if (prevClass) selClass.value = prevClass;
}

function renderReviews() {
  const faculties   = getFaculties();
  const sessions    = getSessions();
  const facMap      = Object.fromEntries(faculties.map(f => [f.id, f]));
  const sessMap     = Object.fromEntries(sessions.map(s => [s.id, s]));
  const filterSess  = document.getElementById('filter-session').value;
  const filterFac   = document.getElementById('filter-faculty-rev').value;
  const filterClass = document.getElementById('filter-class').value;
  const sortMode    = document.getElementById('filter-sort').value;
  const container   = document.getElementById('reviews-list');

  let reviews = getReviews();
  if (filterSess)  reviews = reviews.filter(r => r.sessionId === filterSess);
  if (filterFac)   reviews = reviews.filter(r => r.facultyId === filterFac);
  if (filterClass) reviews = reviews.filter(r => r.class === filterClass);

  if (sortMode === 'newest')  reviews.sort((a, b) => b.date.localeCompare(a.date));
  if (sortMode === 'oldest')  reviews.sort((a, b) => a.date.localeCompare(b.date));
  if (sortMode === 'highest') reviews.sort((a, b) => (b.styleRating + b.methodsRating) - (a.styleRating + a.methodsRating));
  if (sortMode === 'lowest')  reviews.sort((a, b) => (a.styleRating + a.methodsRating) - (b.styleRating + b.methodsRating));

  if (reviews.length === 0) {
    container.innerHTML = '<p class="empty-msg">No reviews match the selected filters.</p>';
    return;
  }

  container.innerHTML = reviews.map(r => {
    const fac  = facMap[r.facultyId]  || { name: 'Unknown Faculty', department: '' };
    const sess = sessMap[r.sessionId] || { name: 'Unknown Session' };
    return `
      <div class="review-item">
        <div class="review-header">
          <div class="review-meta-left">
            <div class="review-faculty-name">${escHtml(fac.name)}</div>
            <div class="review-session-name">📅 ${escHtml(sess.name)}</div>
            ${fac.department ? `<div class="review-faculty-dept">${escHtml(fac.department)}</div>` : ''}
          </div>
          <div class="review-meta-right">
            <div class="review-date">${fmtDate(r.date)}</div>
            ${r.class ? `<span class="class-badge">${escHtml(r.class)}</span>` : ''}
          </div>
        </div>
        <div class="ratings-row">
          <div class="rating-badge">
            <span>Teaching Style:</span>
            <span class="rating-stars">${'★'.repeat(r.styleRating)}${'☆'.repeat(5 - r.styleRating)}</span>
            <span class="rating-num">(${r.styleRating}/5)</span>
          </div>
          <div class="rating-badge">
            <span>Teaching Methods:</span>
            <span class="rating-stars">${'★'.repeat(r.methodsRating)}${'☆'.repeat(5 - r.methodsRating)}</span>
            <span class="rating-num">(${r.methodsRating}/5)</span>
          </div>
        </div>
        <div class="review-comment">${escHtml(r.comment)}</div>
        ${r.improvement ? `<div class="review-improvement"><span class="improvement-label">💡 Institute Improvement:</span> ${escHtml(r.improvement)}</div>` : ''}
      </div>
    `;
  }).join('');
}

/* ════════════════════════════════════════════
   SESSION FACULTY DROPDOWN (create form)
════════════════════════════════════════════ */
function populateSessionFacultyDropdown() {
  const faculties = getFaculties().slice().sort((a, b) => a.name.localeCompare(b.name));
  const sel = document.getElementById('session-faculty-select');
  const prev = sel.value;
  sel.innerHTML = '<option value="">— All Faculty (no restriction) —</option>';
  faculties.forEach(f => {
    const opt = document.createElement('option');
    opt.value = f.id;
    opt.textContent = `${f.name} — ${f.department}`;
    sel.appendChild(opt);
  });
  if (prev) sel.value = prev;
}

/* ════════════════════════════════════════════
   MODAL
════════════════════════════════════════════ */
function openModal(title, msg, action, btnLabel = 'Delete', btnClass = 'btn-danger') {
  modalAction = action;
  document.getElementById('modal-title').textContent  = title;
  document.getElementById('modal-msg').innerHTML      = msg;
  const btn = document.getElementById('modal-confirm-btn');
  btn.textContent = btnLabel;
  btn.className   = `btn ${btnClass}`;
  btn.onclick     = () => { modalAction && modalAction(); closeModal(); };
  document.getElementById('action-modal').classList.remove('hidden');
}
function closeModal() {
  modalAction = null;
  document.getElementById('action-modal').classList.add('hidden');
}

/* ════════════════════════════════════════════
   HELPERS
════════════════════════════════════════════ */
function isSessionActive(s) {
  if (s.status === 'ended') return false;
  const now = new Date();
  if (s.endDate) {
    const end = new Date(s.endDate);
    end.setHours(23, 59, 59, 999);
    if (end < now) return false;
  }
  if (s.startDate) {
    const start = new Date(s.startDate);
    start.setHours(0, 0, 0, 0);
    if (start > now) return false;
  }
  return true;
}

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
function fmtDateStr(dateStr) {
  const [y, m, d] = dateStr.split('-');
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function showFErr(inputId, errId) {
  document.getElementById(inputId).classList.add('invalid');
  document.getElementById(errId).classList.remove('hidden');
}
function clearFErr(inputId, errId) {
  document.getElementById(inputId).classList.remove('invalid');
  document.getElementById(errId).classList.add('hidden');
}

/* ── Storage ── */
function getSessions()  { return JSON.parse(localStorage.getItem(SESSIONS_KEY)  || '[]'); }
function getFaculties() { return JSON.parse(localStorage.getItem(FACULTIES_KEY) || '[]'); }
function getReviews()   { return JSON.parse(localStorage.getItem(REVIEWS_KEY)   || '[]'); }
function saveSessions(d)  { localStorage.setItem(SESSIONS_KEY,  JSON.stringify(d)); }
function saveFaculties(d) { localStorage.setItem(FACULTIES_KEY, JSON.stringify(d)); }
function saveReviews(d)   { localStorage.setItem(REVIEWS_KEY,   JSON.stringify(d)); }
