import { initTimetable } from './utils.js';
import { auth } from './firebase.js';
import { AppState, fetchCloudStates, getLocalAttendance, clearLocalAttendance } from './storage.js';
import { recalculateAndRender, updateThemeBtn, renderDateNavigator } from './ui.js';
import { selectDate } from './dateContext.js';
import { loginUser, signupUser, logoutUser } from './auth.js';
import { validateSignupForm, validateRollNumber, validatePassword } from './validation.js';
import * as UI from './ui.js';

console.log("[app.js] Module loaded");

async function handleAppLogin() {
  console.log("[app.js] handleAppLogin clicked");
  const roll = document.getElementById('loginRoll').value.trim();
  const pass = document.getElementById('loginPass').value;
  
  const errDiv = document.getElementById('authError');
  errDiv.style.display = 'none';

  if (!roll || !pass) {
    console.log("[app.js] Login failed: empty fields");
    errDiv.textContent = "Please fill in both fields.";
    errDiv.style.display = 'block';
    return;
  }
  
  console.log("[app.js] Attempting login for", roll);
  try {
    const res = await loginUser(roll, pass);
    if (!res.success) {
      console.error("[app.js] Login failed:", res.error);
      errDiv.textContent = res.error;
      errDiv.style.display = 'block';
    } else {
      console.log("[app.js] Login success");
    }
  } catch (e) {
    console.error("[app.js] Login exception:", e);
  }
}

async function handleAppSignup() {
  console.log("[app.js] handleAppSignup clicked");
  const name = document.getElementById('signupName').value.trim();
  const roll = document.getElementById('signupRoll').value.trim();
  const pass = document.getElementById('signupPass').value;
  const passConfirm = document.getElementById('signupPassConfirm').value;
  
  const errDiv = document.getElementById('authError');
  errDiv.style.display = 'none';

  const valid = validateSignupForm(name, roll, pass, passConfirm);
  if (!valid.valid) {
    console.log("[app.js] Signup validation failed:", valid.message);
    errDiv.textContent = valid.message;
    errDiv.style.display = 'block';
    return;
  }
  
  console.log("[app.js] Attempting signup for", roll);
  try {
    const res = await signupUser(name, roll, pass);
    if (!res.success) {
      console.error("[app.js] Signup error:", res.error);
      errDiv.textContent = res.error;
      errDiv.style.display = 'block';
    } else {
      console.log("[app.js] Signup success");
    }
  } catch(e) {
    console.error("[app.js] Signup exception:", e);
  }
}

async function handleAppLogout() {
  console.log("[app.js] handleAppLogout clicked");
  await logoutUser();
}

function toggleAuthView(e) {
  if (e) e.preventDefault();
  console.log("[app.js] toggleAuthView triggered");
  const login = document.getElementById('loginView');
  const signup = document.getElementById('signupView');
  const errDiv = document.getElementById('authError');
  errDiv.style.display = 'none';
  
  if (login.style.display !== 'none') {
    login.style.display = 'none';
    signup.style.display = 'block';
  } else {
    login.style.display = 'block';
    signup.style.display = 'none';
  }
}

function handleMigrationImport() {
  console.log("[app.js] handleMigrationImport clicked");
  const localData = getLocalAttendance();
  if (localData) {
    import('./storage.js').then(({ saveStates }) => {
      saveStates(localData);
      clearLocalAttendance();
      document.getElementById('migrationModal').style.display = 'none';
      recalculateAndRender();
    }).catch(e => console.error("[app.js] Migration import error:", e));
  }
}

function handleMigrationDiscard() {
  console.log("[app.js] handleMigrationDiscard clicked");
  clearLocalAttendance();
  document.getElementById('migrationModal').style.display = 'none';
}

function checkMigration() {
  console.log("[app.js] checkMigration called");
  const localData = getLocalAttendance();
  if (localData) {
    console.log("[app.js] Migration data found, showing modal");
    document.getElementById('migrationModal').style.display = 'flex';
  } else {
    console.log("[app.js] No migration data found");
  }
}

function updateProfileUI() {
  console.log("[app.js] updateProfileUI called");
  document.getElementById('profileName').textContent = AppState.profile.name || "Student";
  document.getElementById('profileRoll').textContent = AppState.profile.rollNumber || "Roll No";
}

async function bootstrap() {
  console.log("[app.js] bootstrap called");
  try {
    await initTimetable();
    console.log("[app.js] Timetable initialized");
    updateThemeBtn('dark');
  } catch (e) {
    console.error("[app.js] bootstrap initialization error:", e);
  }

  console.log("[app.js] Setting up auth state listener");
  auth.onAuthStateChanged(async (user) => {
    console.log("[app.js] Auth state changed, user:", user ? user.uid : "null");
    if (user) {
      document.getElementById('authContainer').style.display = 'none';
      document.getElementById('appDashboard').style.display = 'block';
      try {
        await fetchCloudStates();
        console.log("[app.js] Cloud states fetched");
      } catch (e) {
        console.error("[app.js] fetchCloudStates failed:", e);
      }
      try {
        updateProfileUI();
        console.log("[app.js] updateProfileUI done");
      } catch (e) {
        console.error("[app.js] updateProfileUI failed:", e);
      }
      try {
        console.log("[app.js] calling renderDateNavigator");
        renderDateNavigator();
        console.log("[app.js] renderDateNavigator done");
      } catch (e) {
        console.error("[app.js] renderDateNavigator failed:", e.message, e.stack);
      }
      try {
        console.log("[app.js] calling recalculateAndRender");
        recalculateAndRender();
        console.log("[app.js] recalculateAndRender done");
      } catch (e) {
        console.error("[app.js] recalculateAndRender failed:", e.message, e.stack);
      }
      try {
        checkMigration();
      } catch (e) {
        console.error("[app.js] checkMigration failed:", e);
      }
    } else {
      document.getElementById('authContainer').style.display = 'block';
      document.getElementById('appDashboard').style.display = 'none';
    }
  });
}

function initDOMBindings() {
  console.log("[app.js] initDOMBindings called");
  const bindClick = (id, fn) => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('click', fn);
      console.log(`[app.js] Successfully bound click to #${id}`);
    } else {
      console.error(`[app.js] Failed to bind click: element #${id} not found`);
    }
  };
  
  bindClick('btnLogin', handleAppLogin);
  bindClick('btnSignup', handleAppSignup);
  bindClick('linkToSignup', toggleAuthView);
  bindClick('linkToLogin', toggleAuthView);
  bindClick('btnMigrationDiscard', handleMigrationDiscard);
  bindClick('btnMigrationImport', handleMigrationImport);
  bindClick('btnLogout', handleAppLogout);
  
  bindClick('themeToggle', () => {
    console.log("[app.js] themeToggle clicked");
    const html = document.documentElement;
    const theme = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', theme);
    UI.updateThemeBtn(theme);
  });

  bindClick('resetBtn', () => {
    console.log("[app.js] resetBtn clicked");
    if (confirm('Reset all attendance tracking data? This cannot be undone.')) {
      import('./storage.js').then(({ clearStates }) => {
        clearStates();
        UI.recalculateAndRender();
      }).catch(e => console.error(e));
    }
  });

  bindClick('historyToggle', () => {
    console.log("[app.js] historyToggle clicked");
    const content = document.getElementById('historyContent');
    const arrow   = document.getElementById('historyArrow');
    if (!content || !arrow) return;
    const isOpen = content.style.display !== 'none';
    content.style.display = isOpen ? 'none' : 'block';
    arrow.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(180deg)';
    document.getElementById('historyToggle').setAttribute('aria-expanded', String(!isOpen));
  });

  document.addEventListener('click', (e) => {
    const target = e.target.closest('[data-action]');
    if (!target) return;
    
    const action = target.getAttribute('data-action');
    console.log("[app.js] Global click delegate fired for action:", action);
    if (action === 'switchQuiz') {
      const quizId = parseInt(target.getAttribute('data-quiz'), 10);
      UI.switchQuiz(quizId, target);
    } else if (action === 'logAttendance') {
      const dateStr = target.getAttribute('data-date');
      const sCode = target.getAttribute('data-s');
      const type = target.getAttribute('data-t');
      const state = target.getAttribute('data-state');
      UI.logAttendance(dateStr, sCode, type, state);
    }
  });
  console.log("[app.js] Global event delegation set up");

  // Keyboard navigation for quiz tabs (delegated to document since tabs-wrap may not exist yet)
  document.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const tabsWrap = document.querySelector('.tabs-wrap');
    if (!tabsWrap || !tabsWrap.contains(document.activeElement)) return;
    const tabs = [...document.querySelectorAll('.tab-btn')];
    const current = tabs.indexOf(document.activeElement);
    if (current < 0) return;
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1
      : (current + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    event.preventDefault();
    tabs[next].focus();
    UI.switchQuiz(next, tabs[next]);
  });

}

let hasInit = false;
function doInit() {
  if (hasInit) return;
  hasInit = true;
  console.log("[app.js] DOM is ready, calling initDOMBindings");
  initDOMBindings();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', doInit);
} else {
  doInit();
}

bootstrap();
