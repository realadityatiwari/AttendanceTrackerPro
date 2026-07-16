// js/firebase.js
// Single source of truth for Firebase initialization.
// Uses the compat SDK (global firebase.*) to match the CDN scripts in index.html.

const firebaseConfig = {
  apiKey: "AIzaSyCJDrMWnuts-6aJdL6CjQ8kuSRNt7lDbXg",
  authDomain: "attendancedashpro.firebaseapp.com",
  projectId: "attendancedashpro",
  storageBucket: "attendancedashpro.firebasestorage.app",
  messagingSenderId: "778073750850",
  appId: "1:778073750850:web:8b1e712516fc0bc3acdcdb",
  measurementId: "G-1VZ77ZTCM2"
};

// Guard: only initialize once (safe for hot-reload environments)
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
  console.log("[firebase.js] firebase.initializeApp() called — project:", firebaseConfig.projectId);
} else {
  console.log("[firebase.js] Firebase already initialized — skipping. Project:", firebase.app().options.projectId);
}

// Log SDK version and active config on every load
console.log("[firebase.js] Firebase SDK version:", firebase.SDK_VERSION);
console.log("[firebase.js] Active config apiKey prefix:", firebaseConfig.apiKey.slice(0, 8) + "...");

const auth = firebase.auth();
const db   = firebase.firestore();

// Ensure session persists across page reloads
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
  .then(() => console.log("[firebase.js] Auth persistence set to LOCAL"))
  .catch(err => console.error("[firebase.js] setPersistence failed:", err));

export { auth, db };
