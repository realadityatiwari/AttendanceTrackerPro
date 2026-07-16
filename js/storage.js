import { auth, db } from './firebase.js';

export const AppState = {
  profile: {},
  attendance: {},
  history: [],
  settings: {
    theme: 'dark',
    simulationMode: false
  }
};

let cloudSyncTimeout = null;

export function loadStates() {
  return AppState.attendance;
}

export function saveStates(states) {
  AppState.attendance = states;
  triggerCloudSync();
}

export function clearStates() {
  AppState.attendance = {};
  triggerCloudSync();
}

export function triggerCloudSync() {
  if (!auth.currentUser) return;
  
  if (cloudSyncTimeout) clearTimeout(cloudSyncTimeout);
  
  cloudSyncTimeout = setTimeout(() => {
    const uid = auth.currentUser.uid;
    db.collection('students').doc(uid).set({
      attendance: AppState.attendance,
      settings: AppState.settings,
      profile: AppState.profile
    }, { merge: true })
    .catch(err => console.error("Cloud sync failed", err));
  }, 1000);
}

export async function fetchCloudStates() {
  if (!auth.currentUser) return;
  const uid = auth.currentUser.uid;
  try {
    const doc = await db.collection('students').doc(uid).get();
    if (doc.exists) {
      const data = doc.data();
      if (data.attendance) AppState.attendance = data.attendance;
      if (data.settings) AppState.settings = { ...AppState.settings, ...data.settings };
      if (data.profile) AppState.profile = { ...AppState.profile, ...data.profile };
    }
  } catch (err) {
    console.error("Failed to fetch cloud states", err);
  }
}

export function getLocalAttendance() {
  try {
    const raw = localStorage.getItem('attendance_tracker_states');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Object.keys(parsed).length > 0) return parsed;
    }
  } catch (e) {
    return null;
  }
  return null;
}

export function clearLocalAttendance() {
  localStorage.removeItem('attendance_tracker_states');
  localStorage.removeItem('attendance_tracker_version');
}
