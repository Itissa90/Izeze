/* ============================================================
   Accès local : verrouillage de l'interface par identifiant
   ============================================================ */

const AUTH_SESSION_KEY = 'suivi-cotisations-auth-v1';
const AUTH_FINGERPRINT = '432unshjvr';

function authFingerprint(user, password) {
  const text = String(user || '').trim().toUpperCase() + '|' + String(password || '');
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

function verifyCredentials(user, password) {
  return authFingerprint(user, password) === AUTH_FINGERPRINT;
}

function authSessionOpen() {
  try {
    return sessionStorage.getItem(AUTH_SESSION_KEY) === AUTH_FINGERPRINT;
  } catch (e) {
    return false;
  }
}

function setAuthSession(open) {
  try {
    if (open) sessionStorage.setItem(AUTH_SESSION_KEY, AUTH_FINGERPRINT);
    else sessionStorage.removeItem(AUTH_SESSION_KEY);
  } catch (e) {}
}

function applyAuthState(open) {
  document.body.classList.toggle('auth-locked', !open);
  if (open) {
    setTimeout(() => {
      const view = document.getElementById('view');
      if (view) view.focus();
    }, 0);
    return;
  }
  const user = document.getElementById('auth-user');
  const pass = document.getElementById('auth-pass');
  const error = document.getElementById('auth-error');
  if (user) user.value = '';
  if (pass) { pass.value = ''; pass.type = 'password'; }
  if (error) error.textContent = '';
  const toggle = document.getElementById('auth-toggle-pass');
  if (toggle) {
    toggle.textContent = 'Afficher';
    toggle.setAttribute('aria-pressed', 'false');
  }
  setTimeout(() => { if (user) user.focus(); }, 0);
}

function initAuthScreen() {
  const form = document.getElementById('auth-form');
  if (!form) return;

  const user = document.getElementById('auth-user');
  const pass = document.getElementById('auth-pass');
  const error = document.getElementById('auth-error');
  const toggle = document.getElementById('auth-toggle-pass');

  const showError = message => {
    error.textContent = message;
  };

  form.addEventListener('submit', event => {
    event.preventDefault();
    const identifiant = user.value.trim();
    const motDePasse = pass.value;
    if (!identifiant || !motDePasse) {
      showError('Saisissez l’identifiant et le mot de passe.');
      (identifiant ? pass : user).focus();
      return;
    }
    if (!verifyCredentials(identifiant, motDePasse)) {
      showError('Identifiant ou mot de passe incorrect.');
      pass.value = '';
      pass.focus();
      return;
    }
    error.textContent = '';
    setAuthSession(true);
    applyAuthState(true);
  });

  toggle.addEventListener('click', () => {
    const visible = pass.type === 'password';
    pass.type = visible ? 'text' : 'password';
    toggle.textContent = visible ? 'Masquer' : 'Afficher';
    toggle.setAttribute('aria-pressed', String(visible));
    pass.focus();
  });

  const lockButton = document.getElementById('lock-app');
  if (lockButton) {
    lockButton.addEventListener('click', () => {
      setAuthSession(false);
      location.reload();
    });
  }

  if (authSessionOpen()) applyAuthState(true);
  else applyAuthState(false);
}

document.addEventListener('DOMContentLoaded', initAuthScreen);
