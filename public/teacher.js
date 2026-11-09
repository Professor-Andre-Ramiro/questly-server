const API = (window.QUESTLY_API || '').replace(/\/$/, '');
const TOKEN_KEY = 'teacherToken';

const loginView = document.getElementById('loginView');
const dashboardView = document.getElementById('dashboardView');
const passwordInput = document.getElementById('passwordInput');
const loginBtn = document.getElementById('loginBtn');
const loginMessage = document.getElementById('loginMessage');
const logoutBtn = document.getElementById('logoutBtn');
const questionList = document.getElementById('questionList');
const emptyState = document.getElementById('emptyState');

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

function showLogin(message) {
  loginView.style.display = '';
  dashboardView.style.display = 'none';
  if (message) {
    loginMessage.textContent = message;
    loginMessage.className = 'message show error';
  }
}

function showDashboard() {
  loginView.style.display = 'none';
  dashboardView.style.display = '';
  loadQuestions();
}

async function authedFetch(url, options = {}) {
  const token = getToken();
  const res = await fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`
    }
  });
  if (res.status === 401) {
    clearToken();
    showLogin('Your session expired. Please log in again.');
    throw new Error('Unauthenticated');
  }
  return res;
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleString();
}

function renderQuestions(questions) {
  questionList.innerHTML = '';
  emptyState.style.display = questions.length === 0 ? '' : 'none';

  for (const q of questions) {
    const card = document.createElement('div');
    card.className = `card${q.answered ? ' answered' : ''}${q.count > 1 ? ' popular' : ''}`;

    const text = document.createElement('p');
    text.className = 'card-text';
    text.textContent = q.text;

    if (q.count > 1) {
      const badge = document.createElement('span');
      badge.className = 'badge';
      badge.textContent = `Asked ${q.count} times`;
      text.appendChild(document.createTextNode(' '));
      text.appendChild(badge);
    }

    const meta = document.createElement('div');
    meta.className = 'card-meta';
    meta.textContent = `First asked ${formatDate(q.createdAt)} · Last asked ${formatDate(q.lastAskedAt)} · ${q.answered ? 'Answered' : 'Pending'}`;

    const actions = document.createElement('div');
    actions.className = 'card-actions';

    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'secondary';
    toggleBtn.textContent = q.answered ? 'Mark as pending' : 'Mark as answered';
    toggleBtn.addEventListener('click', () => toggleAnswered(q.id, !q.answered));

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'danger';
    deleteBtn.textContent = 'Delete';
    deleteBtn.addEventListener('click', () => deleteQuestion(q.id));

    actions.appendChild(toggleBtn);
    actions.appendChild(deleteBtn);

    card.appendChild(text);
    card.appendChild(meta);
    card.appendChild(actions);
    questionList.appendChild(card);
  }
}

async function loadQuestions() {
  try {
    const res = await authedFetch(API + '/api/teacher/questions');
    const data = await res.json();
    renderQuestions(data.questions);
  } catch (err) {
    // authedFetch already handled redirect to login on 401
  }
}

async function toggleAnswered(id, answered) {
  await authedFetch(`${API}/api/teacher/questions/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answered })
  });
  loadQuestions();
}

async function deleteQuestion(id) {
  if (!confirm('Delete this question?')) return;
  await authedFetch(`${API}/api/teacher/questions/${id}`, { method: 'DELETE' });
  loadQuestions();
}

loginBtn.addEventListener('click', async () => {
  const password = passwordInput.value;
  loginMessage.className = 'message';
  loginBtn.disabled = true;

  try {
    const res = await fetch(API + '/api/teacher/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    const data = await res.json();

    if (res.ok && data.token) {
      setToken(data.token);
      passwordInput.value = '';
      showDashboard();
    } else {
      loginMessage.textContent = data.error || 'Login failed.';
      loginMessage.className = 'message show error';
    }
  } catch (err) {
    loginMessage.textContent = 'Could not reach the server. Please try again.';
    loginMessage.className = 'message show error';
  } finally {
    loginBtn.disabled = false;
  }
});

passwordInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') loginBtn.click();
});

logoutBtn.addEventListener('click', () => {
  clearToken();
  showLogin();
});

// Try opening without a password (works when the server runs in test mode).
async function tryOpenWithoutPassword() {
  try {
    const res = await fetch(API + '/api/teacher/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: '' })
    });
    const data = await res.json();
    if (res.ok && data.token) {
      setToken(data.token);
      showDashboard();
      return;
    }
  } catch (err) {}
  showLogin();
}

if (getToken()) {
  showDashboard();
} else {
  tryOpenWithoutPassword();
}
