/* ── Student Portal Logic ── */

const STAR_LABELS = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'];
const MIN_TIME_ON_PAGE_MS = 3000;
const SUBMIT_COOLDOWN_MS  = 60_000;
const COOLDOWN_KEY        = 'eg_last_review_submitted_at';
const pageLoadedAt        = Date.now();
let ratings = { style: 0, methods: 0 };
let activeSessionId    = null;
let dedicatedFacultyId = null;
let state = { sessions: [], faculties: [] };

/* ── Bootstrap ── */
document.addEventListener('DOMContentLoaded', () => {
  initFirestoreListeners();

  document.getElementById('review-form').addEventListener('submit', submitReview);
  document.getElementById('review-comment').addEventListener('input', function () {
    document.getElementById('char-count').textContent = `${this.value.length} / 1000`;
  });
  document.getElementById('institute-improvement').addEventListener('input', function () {
    document.getElementById('improvement-char-count').textContent = `${this.value.length} / 1000`;
  });
  document.getElementById('session-select').addEventListener('change', onSessionChange);

  initStars('style-stars',   'style-label',   'style');
  initStars('methods-stars', 'methods-label', 'methods');
});

/* ── Firestore Listeners ── */
function initFirestoreListeners() {
  db.collection('sessions').onSnapshot(snap => {
    state.sessions = snap.docs.map(d => d.data());
    updateStudentUI();
  });
  db.collection('faculties').onSnapshot(snap => {
    state.faculties = snap.docs.map(d => d.data()).sort((a, b) => a.name.localeCompare(b.name));
    populateFacultyDropdown();
  });
}

function updateStudentUI() {
  const activeSessions = getActiveSessions();

  if (activeSessions.length === 0) {
    showSection('no-session-section');
    document.getElementById('start-btn').disabled = true;
    document.getElementById('start-btn').textContent = 'No Active Sessions';
    return;
  }

  document.getElementById('start-btn').disabled = false;
  document.getElementById('start-btn').textContent = 'Write a Review';
  populateSessionDropdown(activeSessions);
}

/* ── Session Helpers ── */
function getSessions()  { return state.sessions; }
function getFaculties() { return state.faculties; }

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

function getActiveSessions() {
  return getSessions().filter(isSessionActive);
}

/* ── Populate Dropdowns ── */
function populateSessionDropdown(sessions) {
  const sel = document.getElementById('session-select');
  sel.innerHTML = sessions.length === 1
    ? ''
    : '<option value="">— Select a session —</option>';

  sessions.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = s.name;
    sel.appendChild(opt);
  });

  const group = document.getElementById('session-group');
  if (sessions.length === 1) {
    sel.value = sessions[0].id;
    group.classList.add('hidden');
    onSessionChange();
  }
}

function populateFacultyDropdown(preselectedId) {
  const faculties = getFaculties();
  const sel = document.getElementById('faculty-select');
  sel.innerHTML = '<option value="">— Choose a faculty member —</option>';
  faculties.forEach(f => {
    const opt = document.createElement('option');
    opt.value = f.id;
    opt.textContent = `${f.name} — ${f.department}`;
    sel.appendChild(opt);
  });
  if (preselectedId) sel.value = preselectedId;
}

/* ── Session Change ── */
function onSessionChange() {
  const sel     = document.getElementById('session-select');
  const sid     = sel.value;
  const session = getSessions().find(s => s.id === sid);

  activeSessionId    = sid || null;
  dedicatedFacultyId = null;

  const banner     = document.getElementById('session-banner');
  const facultyGrp = document.getElementById('faculty-group');

  if (!session) {
    banner.classList.add('hidden');
    facultyGrp.classList.remove('hidden');
    return;
  }

  if (session.facultyId) {
    dedicatedFacultyId = session.facultyId;
    const faculty = getFaculties().find(f => f.id === session.facultyId);
    const facultyName = faculty ? `${faculty.name} — ${faculty.department}` : 'Unknown Faculty';

    document.getElementById('session-banner-name').textContent    = session.name;
    document.getElementById('session-banner-faculty').textContent = facultyName;
    banner.classList.remove('hidden');
    facultyGrp.classList.add('hidden');
  } else {
    banner.classList.add('hidden');
    facultyGrp.classList.remove('hidden');
    populateFacultyDropdown();
  }
}

/* ── Stars ── */
function initStars(groupId, labelId, field) {
  const group = document.getElementById(groupId);
  const stars = group.querySelectorAll('.star');

  stars.forEach(star => {
    star.addEventListener('mouseenter', () => highlightStars(stars, +star.dataset.value));
    star.addEventListener('mouseleave', () => highlightStars(stars, ratings[field]));
    star.addEventListener('click', () => {
      ratings[field] = +star.dataset.value;
      highlightStars(stars, ratings[field]);
      document.getElementById(labelId).textContent = STAR_LABELS[ratings[field]];
      document.getElementById(`${field}-error`).classList.add('hidden');
    });
  });
}

function highlightStars(stars, value) {
  stars.forEach(s => s.classList.toggle('active', +s.dataset.value <= value));
}

/* ── Navigation ── */
function showReviewForm() {
  const active = getActiveSessions();
  if (active.length === 0) {
    showSection('no-session-section');
    return;
  }
  showSection('review-section');
  document.getElementById('review-section').scrollIntoView({ behavior: 'smooth' });
}

function cancelReview() {
  showSection('hero-section');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showSection(id) {
  ['hero-section', 'review-section', 'success-section', 'no-session-section'].forEach(s => {
    document.getElementById(s).classList.add('hidden');
  });
  document.getElementById(id).classList.remove('hidden');
}

/* ── Submit ── */
async function submitReview(e) {
  e.preventDefault();

  // Honeypot — real users never fill this.
  if (document.getElementById('hp-website')?.value) return;

  // Time-on-page guard — bots fire submit within milliseconds.
  if (Date.now() - pageLoadedAt < MIN_TIME_ON_PAGE_MS) return;

  // Per-browser cooldown — prevents rapid repeat submissions.
  const lastAt = parseInt(localStorage.getItem(COOLDOWN_KEY) || '0', 10);
  if (lastAt && Date.now() - lastAt < SUBMIT_COOLDOWN_MS) {
    alert('You just submitted a review. Please wait a minute before submitting another.');
    return;
  }

  if (!validateForm()) return;

  const submitBtn = e.target.querySelector('[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Submitting…';

  const facultyId = dedicatedFacultyId || document.getElementById('faculty-select').value;

  const review = {
    id:            crypto.randomUUID(),
    sessionId:     activeSessionId,
    facultyId,
    class:         document.getElementById('class-select').value,
    styleRating:   ratings.style,
    methodsRating: ratings.methods,
    comment:       document.getElementById('review-comment').value.trim(),
    improvement:   document.getElementById('institute-improvement').value.trim() || null,
    date:          new Date().toISOString(),
  };

  await db.collection('reviews').doc(review.id).set(review);

  localStorage.setItem(COOLDOWN_KEY, String(Date.now()));

  showSection('success-section');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ── Validation ── */
function validateForm() {
  let valid = true;

  const sid = document.getElementById('session-select').value;
  const sessionGrpHidden = document.getElementById('session-group').classList.contains('hidden');
  if (!sessionGrpHidden && !sid) {
    showErr('session-select', 'session-error'); valid = false;
  } else {
    clearErr('session-select', 'session-error');
  }

  if (!document.getElementById('class-select').value) {
    showErr('class-select', 'class-error'); valid = false;
  } else {
    clearErr('class-select', 'class-error');
  }

  const facGrpHidden = document.getElementById('faculty-group').classList.contains('hidden');
  if (!facGrpHidden && !document.getElementById('faculty-select').value) {
    showErr('faculty-select', 'faculty-error'); valid = false;
  } else {
    clearErr('faculty-select', 'faculty-error');
  }

  if (ratings.style === 0) {
    document.getElementById('style-error').classList.remove('hidden'); valid = false;
  } else {
    document.getElementById('style-error').classList.add('hidden');
  }

  if (ratings.methods === 0) {
    document.getElementById('methods-error').classList.remove('hidden'); valid = false;
  } else {
    document.getElementById('methods-error').classList.add('hidden');
  }

  if (document.getElementById('review-comment').value.trim().length < 20) {
    showErr('review-comment', 'comment-error'); valid = false;
  } else {
    clearErr('review-comment', 'comment-error');
  }

  return valid;
}

function showErr(inputId, errId) {
  document.getElementById(inputId).classList.add('invalid');
  document.getElementById(errId).classList.remove('hidden');
}
function clearErr(inputId, errId) {
  document.getElementById(inputId).classList.remove('invalid');
  document.getElementById(errId).classList.add('hidden');
}

/* ── Reset ── */
function resetForm() {
  document.getElementById('review-form').reset();
  ratings = { style: 0, methods: 0 };
  document.querySelectorAll('.star').forEach(s => s.classList.remove('active'));
  document.getElementById('style-label').textContent = '';
  document.getElementById('methods-label').textContent = '';
  document.getElementById('char-count').textContent = '0 / 1000';
  document.getElementById('improvement-char-count').textContent = '0 / 1000';
  document.getElementById('session-banner').classList.add('hidden');
  dedicatedFacultyId = null;
  activeSessionId    = null;

  const activeSessions = getActiveSessions();
  if (activeSessions.length === 0) {
    showSection('no-session-section');
    return;
  }
  populateSessionDropdown(activeSessions);
  populateFacultyDropdown();
  showSection('review-section');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
