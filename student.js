/* ── Student Portal Logic ── */

const FACULTIES_KEY = 'ei_faculties';
const REVIEWS_KEY   = 'ei_reviews';
const SESSIONS_KEY  = 'ei_sessions';

const STAR_LABELS = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'];
let ratings = { style: 0, methods: 0 };
let activeSessionId   = null;  // currently selected session
let dedicatedFacultyId = null; // if session locks a faculty

/* ── Bootstrap ── */
document.addEventListener('DOMContentLoaded', () => {
  const activeSessions = getActiveSessions();

  if (activeSessions.length === 0) {
    showSection('no-session-section');
    document.getElementById('start-btn').disabled = true;
    document.getElementById('start-btn').textContent = 'No Active Sessions';
    return;
  }

  populateFacultyDropdown();
  populateSessionDropdown(activeSessions);

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

/* ── Session Helpers ── */
function getSessions()  { return JSON.parse(localStorage.getItem(SESSIONS_KEY) || '[]'); }
function getFaculties() { return JSON.parse(localStorage.getItem(FACULTIES_KEY) || '[]'); }
function getReviews()   { return JSON.parse(localStorage.getItem(REVIEWS_KEY)   || '[]'); }

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
    // Auto-select single session, hide the dropdown
    sel.value = sessions[0].id;
    group.classList.add('hidden');
    onSessionChange();
  }
}

function populateFacultyDropdown(preselectedId) {
  const faculties = getFaculties().slice().sort((a, b) => a.name.localeCompare(b.name));
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

  const banner      = document.getElementById('session-banner');
  const facultyGrp  = document.getElementById('faculty-group');

  if (!session) {
    banner.classList.add('hidden');
    facultyGrp.classList.remove('hidden');
    return;
  }

  if (session.facultyId) {
    // Session is dedicated to a specific faculty
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
function submitReview(e) {
  e.preventDefault();
  if (!validateForm()) return;

  const facultyId = dedicatedFacultyId || document.getElementById('faculty-select').value;

  const review = {
    id:             crypto.randomUUID(),
    sessionId:      activeSessionId,
    facultyId,
    class:          document.getElementById('class-select').value,
    styleRating:    ratings.style,
    methodsRating:  ratings.methods,
    comment:        document.getElementById('review-comment').value.trim(),
    improvement:    document.getElementById('institute-improvement').value.trim() || null,
    date:           new Date().toISOString(),
  };

  const reviews = getReviews();
  reviews.push(review);
  localStorage.setItem(REVIEWS_KEY, JSON.stringify(reviews));

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
