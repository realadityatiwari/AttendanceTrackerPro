
/* ═══════════════════════════════════════════════════════════════════════
   TIMETABLE DATA
   DAY_SCHEDULE: Mon=0 … Fri=4 (matching JS Sunday-offset conversion)
   Each entry: {s: subjectCode, t: 'L'|'T'}
═══════════════════════════════════════════════════════════════════════ */
const DAY_SCHEDULE = {
  0: [ // Monday
    {s:"BCS-058", t:"L"},
    {s:"BNC-501", t:"L"},
    {s:"BCS-054", t:"L"},
  ],
  1: [ // Tuesday
    {s:"BCS-503", t:"L"},
    {s:"BCS-502", t:"L"},
    {s:"BCS-501", t:"L"},
    {s:"BCS-501", t:"T"},
    {s:"BCS-503", t:"T"},
    {s:"BCS-058", t:"T"},
  ],
  2: [ // Wednesday
    {s:"BCS-054", t:"L"},
    {s:"BCS-503", t:"L"},
    {s:"BNC-501", t:"L"},
    {s:"BCS-502", t:"L"},
    {s:"BCS-058", t:"L"},
    {s:"BCS-054", t:"T"},
  ],
  3: [ // Thursday
    {s:"BCS-054", t:"L"},
    {s:"BCS-058", t:"L"},
    {s:"BCS-501", t:"L"},
    {s:"BCS-503", t:"L"},
    {s:"BCS-054", t:"T"},
  ],
  4: [ // Friday
    {s:"BCS-502", t:"L"},
    {s:"BCS-501", t:"L"},
    {s:"BCS-058", t:"T"},
    {s:"BCS-502", t:"T"},
  ],
};

const SUBJECTS = [
  {code:"BNC-501", name:"Constitution of India",          tag:null},
  {code:"BCS-501", name:"Database Management System",     tag:null},
  {code:"BCS-502", name:"Web Technology",                 tag:null},
  {code:"BCS-503", name:"Design & Analysis of Algorithm", tag:null},
  {code:"BCS-054", name:"OOS Design with C++",            tag:"Elective-I"},
  {code:"BCS-058", name:"Data Warehousing & Data Mining", tag:"Elective-II"},
];

// Months are 0-indexed: 6=July, 7=August, 8=September, 9=October
const QUIZ_DATES = [
  {label:"1st Quiz", date: new Date(2026, 7, 17)},   // 17 Aug 2026
  {label:"2nd Quiz", date: new Date(2026, 8, 14)},   // 14 Sep 2026
  {label:"3rd Quiz", date: new Date(2026, 9, 21)},   // 21 Oct 2026
];

const START_DATE = new Date(2026, 6, 15); // 15 Jul 2026
START_DATE.setHours(12, 0, 0, 0);

// Dynamically derived — last quiz date is the semester end
const SEMESTER_END_DATE = (() => {
  const d = new Date(QUIZ_DATES[QUIZ_DATES.length - 1].date);
  d.setHours(12, 0, 0, 0);
  return d;
})();

const TIME_SLOTS = [
  "09:00 AM - 10:00 AM",
  "10:00 AM - 11:00 AM",
  "11:00 AM - 12:00 PM",
  "01:00 PM - 02:00 PM",
  "02:00 PM - 03:00 PM",
  "03:00 PM - 04:00 PM"
];

/* ═══════════════════════════════════════════════════════════════════════
   LOCAL STORAGE — Versioned, crash-safe
═══════════════════════════════════════════════════════════════════════ */
const LS_KEY         = 'attendance_tracker_states';
const LS_VERSION_KEY = 'attendance_tracker_version';
const LS_VERSION     = 1;
const TARGET_ATTENDANCE = 0.75;

/**
 * Load attendance states from localStorage.
 * Returns an empty object on any error (corrupt JSON, wrong type, etc.)
 * Migrates data if version key is outdated.
 */
function loadStates() {
  try {
    const version = parseInt(localStorage.getItem(LS_VERSION_KEY) || '0', 10);
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    // Guard against arrays or non-objects
    if (typeof parsed !== 'object' || Array.isArray(parsed) || parsed === null) {
      console.warn('[Storage] Unexpected data type — resetting.');
      return {};
    }
    // Future migration hook: if (version < LS_VERSION) { ...migrate... }
    if (version < LS_VERSION) {
      console.info(`[Storage] Migrating from v${version} to v${LS_VERSION} (no-op for now).`);
      saveStates(parsed); // re-save with updated version
    }
    return parsed;
  } catch (e) {
    console.warn('[Storage] Corrupt localStorage data — resetting:', e.message);
    return {};
  }
}

/**
 * Persist attendance states to localStorage with version tag.
 */
function saveStates(states) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(states));
    localStorage.setItem(LS_VERSION_KEY, String(LS_VERSION));
  } catch (e) {
    console.error('[Storage] Failed to save states:', e.message);
  }
}

/**
 * Clear all attendance data.
 */
function clearStates() {
  try {
    localStorage.removeItem(LS_KEY);
    localStorage.removeItem(LS_VERSION_KEY);
  } catch (e) {
    console.error('[Storage] Failed to clear states:', e.message);
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   DATE HELPERS
═══════════════════════════════════════════════════════════════════════ */

/** Returns "YYYY-MM-DD" for a Date in LOCAL timezone (avoids UTC shift). */
function getLocalDateString(date) {
  const yyyy = date.getFullYear();
  const mm   = String(date.getMonth() + 1).padStart(2, '0');
  const dd   = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/** Returns today's date string in "YYYY-MM-DD" format. */
function getTodayString() {
  return getLocalDateString(new Date());
}

/** Parse "YYYY-MM-DD" safely into a local Date at noon (avoids timezone issues). */
function parseDateString(str) {
  const parts = str.split('-');
  if (parts.length !== 3) return null;
  const d = new Date(+parts[0], +parts[1] - 1, +parts[2]);
  d.setHours(12, 0, 0, 0);
  return isNaN(d.getTime()) || getLocalDateString(d) !== str ? null : d;
}

/** Return whether a storage key identifies a real scheduled class. */
function isScheduledClass(dateStr, subjectCode, type) {
  const date = parseDateString(dateStr);
  if (!date || !['L', 'T'].includes(type) || !SUBJECTS.some(s => s.code === subjectCode)) return false;
  const monIdx = (date.getDay() + 6) % 7;
  return Boolean(DAY_SCHEDULE[monIdx]?.some(c => c.s === subjectCode && c.t === type));
}

/** Format a Date for the "Today's Classes" header display. */
function formatTodayHeader(date) {
  const weekday = date.toLocaleDateString('en-US', {weekday: 'long'});
  const dayDate = date.toLocaleDateString('en-US', {day: 'numeric', month: 'short', year: 'numeric'});
  return `${weekday} • ${dayDate}`;
}

/** Format a "YYYY-MM-DD" string as "15 Jul" for the history log. */
function formatHistoryDate(dateStr) {
  const d = parseDateString(dateStr);
  if (!d) return dateStr;
  return d.toLocaleDateString('en-US', {day: 'numeric', month: 'short'});
}

/* ═══════════════════════════════════════════════════════════════════════
   SIMULATION MODE
═══════════════════════════════════════════════════════════════════════ */

/** Returns true when the user has selected a simulation date. */
function isSimulationMode() {
  const sel = document.getElementById('mockDaySelector');
  return sel ? sel.value !== '' : false;
}

/** Returns the currently active date (simulation or real today). */
function getActiveDate() {
  const sel = document.getElementById('mockDaySelector');
  if (sel && sel.value) {
    const d = parseDateString(sel.value);
    if (d) return d;
  }
  return new Date();
}

/** Update simulation mode visual indicator on the "Today's Classes" card. */
function updateSimulationBadge() {
  const badge = document.getElementById('simBadge');
  if (badge) badge.style.display = isSimulationMode() ? 'inline-flex' : 'none';
}

/* ═══════════════════════════════════════════════════════════════════════
   MATH HELPERS — Single Source of Truth
   All percentage calculations live here and nowhere else.
═══════════════════════════════════════════════════════════════════════ */

/**
 * Current attendance % = attended / completed (excludes pending).
 * Returns null if no classes completed yet.
 */
function calcCurrentPct(attended, completed) {
  if (!completed || completed <= 0) return null;
  return (attended / completed) * 100;
}

/**
 * Forecast attendance % = (attended + all_pending) / total.
 * Assumes ALL pending classes will be attended — best-case from here.
 * Returns null if total is 0.
 */
function calcForecastPct(attended, pending, total) {
  if (!total || total <= 0) return null;
  return ((attended + pending) / total) * 100;
}

/**
 * Average of lec% and tut% following the eligibility formula.
 * If tutPct is null (no tutorials for this subject), returns lecPct.
 * If lecPct is null, returns tutPct. If both null, returns null.
 */
function calcAvgPct(lecPct, tutPct) {
  if (lecPct === null && tutPct === null) return null;
  if (tutPct === null) return lecPct;
  if (lecPct === null) return tutPct;
  return (lecPct + tutPct) / 2;
}

/**
 * Check the eligibility rule using fractions, avoiding rounding errors at 75%.
 * A subject with only one class type is evaluated using that available type.
 */
function meetsAttendanceTarget(attL, totL, attT, totT) {
  const lecRatio = totL > 0 ? attL / totL : null;
  const tutRatio = totT > 0 ? attT / totT : null;
  if (lecRatio === null && tutRatio === null) return false;
  const average = lecRatio === null ? tutRatio : tutRatio === null ? lecRatio : (lecRatio + tutRatio) / 2;
  return average + Number.EPSILON >= TARGET_ATTENDANCE;
}

/**
 * Determine status badge from forecast average.
 * Status is ALWAYS based on forecast, never current.
 * N/A (no data) uses neutral class.
 */
function getSubjectStatus(forecastAvgPct) {
  if (forecastAvgPct === null) return {text: 'N/A',      cls: 'status-warning'};
  if (forecastAvgPct >= 80)    return {text: 'SAFE',     cls: 'status-safe'};
  if (forecastAvgPct >= 75)    return {text: 'WARNING',  cls: 'status-warning'};
  return                              {text: 'CRITICAL', cls: 'status-critical'};
}

/** Color for a percentage value (green ≥75, amber ≥60, red otherwise). */
function pctColor(pct) {
  if (pct === null) return 'var(--text3)';
  if (pct >= 75)    return 'var(--green)';
  if (pct >= 60)    return 'var(--amber)';
  return 'var(--red)';
}

/** Bar fill color — same thresholds as pctColor. */
function barColor(pct) {
  return pctColor(pct);
}

/** Dim background color for average cell highlight. */
function dimColor(pct) {
  if (pct === null) return 'transparent';
  if (pct >= 75)    return 'var(--green-dim)';
  if (pct >= 60)    return 'var(--amber-dim)';
  return 'var(--red-dim)';
}

/* ═══════════════════════════════════════════════════════════════════════
   OPTIMIZATION ENGINE
   Finds minimum classes to attend to achieve (Lec% + Tut%)/2 ≥ 75%.
═══════════════════════════════════════════════════════════════════════ */

/**
 * Static optimizer — used for pre-computed ALL_DATA reference (no live state).
 * Returns: {attL, attT, skipL, skipT, lecPct, tutPct, avgPct}
 */
function optimize(totL, totT) {
  if (totL <= 0 && totT <= 0) {
    return {attL: 0, attT: 0, skipL: 0, skipT: 0, lecPct: null, tutPct: null, avgPct: null};
  }

  let bestAttL  = totL, bestAttT = totT;
  let bestTotal = totL + totT + 1; // sentinel

  for (let attL = 0; attL <= totL; attL++) {
    for (let attT = 0; attT <= totT; attT++) {
      if (!meetsAttendanceTarget(attL, totL, attT, totT)) continue;
      const total = attL + attT;
      // Prefer fewer total; on tie prefer fewer lectures (max lecture skips).
      if (total < bestTotal || (total === bestTotal && attL < bestAttL)) {
        bestTotal = total;
        bestAttL  = attL;
        bestAttT  = attT;
      }
    }
  }

  const lecPct = totL > 0 ? (bestAttL / totL) * 100 : null;
  const tutPct = totT > 0 ? (bestAttT / totT) * 100 : null;
  return {
    attL: bestAttL, attT: bestAttT,
    skipL: totL - bestAttL, skipT: totT - bestAttT,
    lecPct, tutPct, avgPct: calcAvgPct(lecPct, tutPct)
  };
}

/**
 * Live optimizer — accounts for already-attended, missed, and pending classes.
 * Parameters:
 *   totL, totT       — total scheduled classes
 *   attL_done, missL_done, attT_done, missT_done — logged outcomes
 *   pendingL, pendingT — not yet logged (future + unlogged past)
 *
 * Returns: {infeasible, addL, addT, skipL_budget, skipT_budget, lecPct, tutPct, avgPct}
 * Where addL/addT = how many MORE pending classes must be attended to qualify.
 */
function optimizeLive(totL, totT, attL_done, missL_done, attT_done, missT_done, pendingL, pendingT) {
  // Guard: degenerate totals
  if (totL <= 0 && totT <= 0) {
    return {
      infeasible: false,
      addL: 0, addT: 0,
      skipL_budget: 0, skipT_budget: 0,
      lecPct: null, tutPct: null, avgPct: null
    };
  }

  // Exhaustive search over every valid remaining combination. This is deliberately
  // integer-based so 75% boundary cases cannot be altered by floating-point ceil().
  let bestAddL  = pendingL, bestAddT = pendingT;
  let bestTotal = pendingL + pendingT + 1; // sentinel
  let found     = false;

  for (let addL = 0; addL <= pendingL; addL++) {
    for (let addT = 0; addT <= pendingT; addT++) {
      if (!meetsAttendanceTarget(attL_done + addL, totL, attT_done + addT, totT)) continue;
      found = true;
      const total = addL + addT;
      if (total < bestTotal || (total === bestTotal && addL < bestAddL)) {
        bestTotal = total;
        bestAddL  = addL;
        bestAddT  = addT;
      }
    }
  }

  if (!found) {
    // Even attending every pending class isn't enough
    const bestLecPct = totL > 0 ? ((attL_done + pendingL) / totL) * 100 : null;
    const bestTutPct = totT > 0 ? ((attT_done + pendingT) / totT) * 100 : null;
    return {
      infeasible: true,
      addL: pendingL, addT: pendingT,
      skipL_budget: 0, skipT_budget: 0,
      lecPct: bestLecPct, tutPct: bestTutPct,
      avgPct: calcAvgPct(bestLecPct, bestTutPct)
    };
  }

  const finalLecPct = totL > 0 ? ((attL_done + bestAddL) / totL) * 100 : null;
  const finalTutPct = totT > 0 ? ((attT_done + bestAddT) / totT) * 100 : null;
  return {
    infeasible: false,
    addL: bestAddL, addT: bestAddT,
    skipL_budget: Math.max(0, pendingL - bestAddL),
    skipT_budget: Math.max(0, pendingT - bestAddT),
    lecPct: finalLecPct, tutPct: finalTutPct,
    avgPct: calcAvgPct(finalLecPct, finalTutPct)
  };
}

/* ═══════════════════════════════════════════════════════════════════════
   PRECOMPUTED REFERENCE DATA (static, no live state)
   Used only for internal checks — live rendering uses getAttendanceData.
═══════════════════════════════════════════════════════════════════════ */
const ALL_DATA = QUIZ_DATES.map(({label, date}) => {
  const counts = {};
  SUBJECTS.forEach(({code}) => { counts[code] = {L: 0, T: 0}; });

  const cur   = new Date(START_DATE);
  const limit = new Date(date);
  limit.setHours(12, 0, 0, 0);

  while (cur < limit) {
    const monIdx = (cur.getDay() + 6) % 7; // Mon=0 … Sun=6
    if (DAY_SCHEDULE[monIdx]) {
      DAY_SCHEDULE[monIdx].forEach(({s, t}) => {
        if (counts[s]) counts[s][t]++;
      });
    }
    cur.setDate(cur.getDate() + 1);
  }

  const rows = SUBJECTS.map(({code, name, tag}) => {
    const {L: totL, T: totT} = counts[code];
    const result = optimize(totL, totT);
    return {code, name, tag, totL, totT, totComb: totL + totT, ...result};
  });

  return {label, date, rows};
});

/* ═══════════════════════════════════════════════════════════════════════
   INTERNAL ASSERTIONS
   Called after every getAttendanceData() to detect data inconsistencies.
═══════════════════════════════════════════════════════════════════════ */
function assertConsistency(code, d) {
  const checkType = (type, att, miss, pending, tot) => {
    const sum = att + miss + pending;
    if (sum !== tot) {
      console.error(
        `[ASSERT FAIL] ${code} ${type}: ` +
        `att(${att}) + miss(${miss}) + pending(${pending}) = ${sum} ≠ tot(${tot})`
      );
    }
  };
  checkType('Lec', d.attL_done, d.missL_done, d.pendingL, d.totL);
  checkType('Tut', d.attT_done, d.missT_done, d.pendingT, d.totT);
  // Skip budgets must never be negative
  if (d.pendingL < 0 || d.pendingT < 0) {
    console.error(`[ASSERT FAIL] ${code}: negative pending (L:${d.pendingL}, T:${d.pendingT})`);
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   ATTENDANCE DATA LOADER
   Rebuilds per-subject counts from timetable + localStorage states.
═══════════════════════════════════════════════════════════════════════ */
function getAttendanceData(quizDate) {
  const data   = {};
  const states = loadStates();

  SUBJECTS.forEach(({code}) => {
    data[code] = {
      totL: 0, totT: 0,
      attL_done: 0, missL_done: 0,
      attT_done: 0, missT_done: 0,
      pendingL:  0, pendingT: 0
    };
  });

  const cur   = new Date(START_DATE);
  const limit = new Date(quizDate);
  limit.setHours(12, 0, 0, 0);

  while (cur < limit) {
    const monIdx  = (cur.getDay() + 6) % 7;
    const dateStr = getLocalDateString(cur);

    if (DAY_SCHEDULE[monIdx]) {
      DAY_SCHEDULE[monIdx].forEach(({s, t}) => {
        if (!data[s]) return;
        if (t === 'L') data[s].totL++;
        else           data[s].totT++;

        const classId = `${dateStr}:${s}:${t}`;
        const state   = states[classId] || 'Pending';

        if (state === 'Attended') {
          if (t === 'L') data[s].attL_done++;
          else           data[s].attT_done++;
        } else if (state === 'Missed') {
          if (t === 'L') data[s].missL_done++;
          else           data[s].missT_done++;
        } else {
          // Pending (unlogged = pending, includes future classes)
          if (t === 'L') data[s].pendingL++;
          else           data[s].pendingT++;
        }
      });
    }

    cur.setDate(cur.getDate() + 1);
  }

  // Run consistency checks on every subject
  SUBJECTS.forEach(({code}) => assertConsistency(code, data[code]));
  return data;
}

/* ═══════════════════════════════════════════════════════════════════════
   SINGLE SOURCE OF TRUTH — computeSubjectStats()
   All rendering functions consume from this one object.
═══════════════════════════════════════════════════════════════════════ */
function computeSubjectStats(code, name, tag, rawData) {
  const d = rawData;

  // Completed = classes with a definitive outcome (attended or missed)
  const completedL = d.attL_done + d.missL_done;
  const completedT = d.attT_done + d.missT_done;

  // Current %: only over completed classes. null if nothing done yet.
  const currentLecPct = calcCurrentPct(d.attL_done, completedL);
  const currentTutPct = d.totT > 0 ? calcCurrentPct(d.attT_done, completedT) : null;
  const currentAvgPct = calcAvgPct(currentLecPct, currentTutPct);

  // Forecast %: assumes all pending are attended (best case from here).
  const forecastLecPct = calcForecastPct(d.attL_done, d.pendingL, d.totL);
  const forecastTutPct = d.totT > 0 ? calcForecastPct(d.attT_done, d.pendingT, d.totT) : null;
  const forecastAvgPct = calcAvgPct(forecastLecPct, forecastTutPct);

  // Status always based on forecast (what you'll achieve if you attend everything remaining)
  const status = getSubjectStatus(forecastAvgPct);

  // Optimizer: how many remaining pending must be attended to just qualify?
  const optResult = optimizeLive(
    d.totL,      d.totT,
    d.attL_done, d.missL_done,
    d.attT_done, d.missT_done,
    d.pendingL,  d.pendingT
  );

  return {
    code, name, tag,
    // raw counts
    totL: d.totL,    totT: d.totT,    totComb: d.totL + d.totT,
    attL_done: d.attL_done,   missL_done: d.missL_done,
    attT_done: d.attT_done,   missT_done: d.missT_done,
    pendingL:  d.pendingL,    pendingT:   d.pendingT,
    completedL, completedT,
    // percentages
    currentLecPct, currentTutPct, currentAvgPct,
    forecastLecPct, forecastTutPct, forecastAvgPct,
    // status
    status,
    // optimizer
    optResult
  };
}

/* ═══════════════════════════════════════════════════════════════════════
   TOOLTIP ENGINE — calcForecastImpact()
   Handles all 6 state transitions correctly:
     Pending→Attended, Pending→Missed
     Attended→Missed,  Attended→Pending
     Missed→Attended,  Missed→Pending
═══════════════════════════════════════════════════════════════════════ */
function calcForecastImpact(rawData, subjectCode, classType, currentState, newAction) {
  const d = rawData[subjectCode];
  if (!d) return null;

  // Start with current counts
  let attL = d.attL_done,  pendL = d.pendingL;
  let attT = d.attT_done,  pendT = d.pendingT;

  // Step 1: Remove the contribution of the CURRENT state for this class
  if (classType === 'L') {
    if (currentState === 'Attended') attL--;
    else if (currentState === 'Pending') pendL--;
    // Missed contributes nothing to forecast — no change needed
  } else {
    if (currentState === 'Attended') attT--;
    else if (currentState === 'Pending') pendT--;
  }

  // Step 2: Add the contribution of the NEW state for this class
  if (classType === 'L') {
    if (newAction === 'Attended') attL++;
    else if (newAction === 'Pending') pendL++;
  } else {
    if (newAction === 'Attended') attT++;
    else if (newAction === 'Pending') pendT++;
  }

  // Compute before and after forecast averages
  const curFL  = calcForecastPct(d.attL_done, d.pendingL, d.totL);
  const curFT  = d.totT > 0 ? calcForecastPct(d.attT_done, d.pendingT, d.totT) : null;
  const curAvg = calcAvgPct(curFL, curFT);

  const newFL  = calcForecastPct(attL, pendL, d.totL);
  const newFT  = d.totT > 0 ? calcForecastPct(attT, pendT, d.totT) : null;
  const newAvg = calcAvgPct(newFL, newFT);

  return {
    curAvg,
    newAvg,
    stillEligible: newAvg !== null && newAvg >= 75
  };
}

function getImpactTooltipHTML(impact) {
  if (!impact || impact.curAvg === null) return '';
  const diff = impact.newAvg - impact.curAvg;
  const dir  = diff > 0.005 ? '↑' : diff < -0.005 ? '↓' : '→';
  const eligHTML = impact.stillEligible
    ? '<span class="tt-safe">Still Eligible</span>'
    : '<span class="tt-unsafe">Not Eligible</span>';
  return `
    <div class="tt-lbl">Forecast Average</div>
    <div><span class="tt-old">${impact.curAvg.toFixed(1)}%</span> <span class="tt-arr">${dir}</span> <span class="tt-new">${impact.newAvg.toFixed(1)}%</span></div>
    <div>${eligHTML}</div>
  `;
}

/* ═══════════════════════════════════════════════════════════════════════
   NEED-TEXT & VISUAL HELPERS
═══════════════════════════════════════════════════════════════════════ */
function getRemainingRequirementText(optResult) {
  if (optResult.infeasible) {
    return `<div class="subj-need-text danger">⚡ Ineligible — impossible to reach 75%</div>`;
  }
  if (optResult.addL === 0 && optResult.addT === 0) {
    return `<div class="subj-need-text safe">✓ Already Safe — attend any remaining</div>`;
  }
  const parts = [];
  if (optResult.addL > 0) parts.push(`${optResult.addL} Lecture${optResult.addL > 1 ? 's' : ''}`);
  if (optResult.addT > 0) parts.push(`${optResult.addT} Tutorial${optResult.addT > 1 ? 's' : ''}`);
  return `<div class="subj-need-text warning">Need ${parts.join(' & ')} more to qualify</div>`;
}

function getProgressRowHTML(label, pct, valStr) {
  if (pct === null) return '';
  const w     = Math.min(100, Math.max(0, pct)).toFixed(1);
  const color = barColor(pct);
  return `
    <div class="subj-stat-row">
      <div class="subj-stat-label">
        <span>${label}</span>
        <span class="val">${valStr} (${pct.toFixed(1)}%)</span>
      </div>
      <div class="subj-progress-track">
        <div class="subj-progress-bar" style="width:${w}%;background-color:${color}"></div>
      </div>
    </div>
  `;
}

function makeSkipBudgetVisual(remaining, missed, type) {
  if (type === 'T' && remaining === null) {
    return `<span class="badge-na">—</span>`;
  }
  const rem = Math.max(0, remaining || 0);
  const mis = Math.max(0, missed    || 0);
  if (rem === 0 && mis === 0) {
    return `<span class="badge badge-zero">0 left</span>`;
  }
  let squares = '';
  for (let i = 0; i < rem; i++) {
    squares += `<span class="budget-square filled" style="background:var(--green)"></span>`;
  }
  for (let i = 0; i < mis; i++) {
    squares += `<span class="budget-square empty" style="border:1px solid var(--border2);background:var(--red-dim)"></span>`;
  }
  return `
    <div style="display:inline-flex;align-items:center;gap:3px;justify-content:center;">
      <div style="display:inline-flex;gap:2.5px;align-items:center;margin-right:5px;">${squares}</div>
      <span class="num" style="font-size:11px;color:${rem > 0 ? 'var(--green)' : 'var(--text3)'}">${rem} left</span>
    </div>
  `;
}

function makePctCell(pct, isAvg = false) {
  if (pct === null) return `<td class="pct-cell"><span class="badge-na">—</span></td>`;
  // Clamp display value to [0, 100] for safety
  const display = Math.min(100, Math.max(0, pct));
  const w   = display.toFixed(1);
  const col = barColor(pct);
  const fmtPct = v => v.toFixed(2);
  const inner = `
    <span class="pct-val" style="color:${col}">${fmtPct(display)}%</span>
    <div class="pct-bar-wrap"><div class="pct-bar" style="width:${w}%;background:${col}"></div></div>
  `;
  if (isAvg) {
    const dimCol = dimColor(pct);
    return `<td class="pct-cell"><div class="avg-cell" style="background:${dimCol};border-radius:8px;padding:6px 10px;display:inline-block;min-width:66px">
      <span class="pct-val" style="color:${col}">${fmtPct(display)}%</span>
      <div class="pct-bar-wrap"><div class="pct-bar" style="width:${w}%;background:${col}"></div></div>
    </div></td>`;
  }
  return `<td class="pct-cell">${inner}</td>`;
}

/* ═══════════════════════════════════════════════════════════════════════
   RENDER PANEL — refactored into sub-functions (each ≤ 50 lines)
═══════════════════════════════════════════════════════════════════════ */

/** Build the hero card HTML from aggregated row data. */
function buildHeroCard(rows, label, quizDate) {
  const totalClasses         = rows.reduce((s, r) => s + r.totComb, 0);
  const totalSubj            = rows.length;
  const totalMustAtt         = rows.reduce((s, r) => s + r.optResult.addL + r.optResult.addT, 0);
  const totalSkips           = rows.reduce((s, r) => s + r.optResult.skipL_budget + r.optResult.skipT_budget, 0);
  const forecastVals         = rows.map(r => r.forecastAvgPct).filter(v => v !== null);
  const overallForecastAvg   = forecastVals.length > 0
    ? forecastVals.reduce((a, b) => a + b, 0) / forecastVals.length
    : null;
  const overallStatus        = getSubjectStatus(overallForecastAvg);
  const dateStr              = quizDate.toLocaleDateString('en-US', {day:'numeric', month:'short', year:'numeric'});
  const valColor             = overallForecastAvg !== null ? pctColor(overallForecastAvg) : 'var(--text3)';
  const valDisplay           = overallForecastAvg !== null ? overallForecastAvg.toFixed(1) + '%' : '—';

  return `
    <div class="hero-card">
      <div class="hero-left">
        <div class="hero-label">Dashboard Summary</div>
        <div class="hero-title">${label} · ${dateStr}</div>
      </div>
      <div style="display:flex;align-items:center;gap:24px;">
        <div style="text-align:right;">
          <div class="hero-val" style="color:${valColor}">${valDisplay}</div>
          <div class="hero-label" style="margin-top:2px;">Avg Forecast</div>
        </div>
        <span class="status-badge ${overallStatus.cls}" style="font-size:13px;padding:5px 14px;">${overallStatus.text}</span>
      </div>
      <div class="hero-right">
        <div class="hero-item">
          <div class="hero-item-label">Must Attend</div>
          <div class="hero-item-val" style="color:var(--accent)">${totalMustAtt}</div>
          <div class="hero-item-sub">remaining classes</div>
        </div>
        <div class="hero-item">
          <div class="hero-item-label">Safe Skips Left</div>
          <div class="hero-item-val" style="color:var(--green)">${totalSkips}</div>
          <div class="hero-item-sub">maximum skips</div>
        </div>
        <div class="hero-item">
          <div class="hero-item-label">Total Classes</div>
          <div class="hero-item-val">${totalClasses}</div>
          <div class="hero-item-sub">across ${totalSubj} subjects</div>
        </div>
      </div>
    </div>`;
}

/** Build one subject card HTML from computed stats. */
function buildSubjectCard(r) {
  const currentLecRow = r.completedL > 0
    ? getProgressRowHTML('Lecture', r.currentLecPct, `${r.attL_done} / ${r.completedL}`)
    : `<div class="subj-stat-row"><div class="subj-stat-label"><span>Lecture</span><span class="val">—</span></div></div>`;

  const currentTutRow = r.totT > 0
    ? (r.completedT > 0
        ? getProgressRowHTML('Tutorial', r.currentTutPct, `${r.attT_done} / ${r.completedT}`)
        : `<div class="subj-stat-row"><div class="subj-stat-label"><span>Tutorial</span><span class="val">—</span></div></div>`)
    : '';

  const currentAvgRow  = r.currentAvgPct !== null
    ? getProgressRowHTML('Average', r.currentAvgPct, `${r.currentAvgPct.toFixed(1)}%`)
    : '';

  // forecastLecStr: attended so far + if all pending are attended
  const forecastLecStr = `${r.attL_done + r.pendingL} / ${r.totL}`;
  const forecastTutStr = r.totT > 0 ? `${r.attT_done + r.pendingT} / ${r.totT}` : '';

  const forecastLecRow = getProgressRowHTML('Lecture',          r.forecastLecPct, forecastLecStr);
  const forecastTutRow = r.totT > 0 ? getProgressRowHTML('Tutorial', r.forecastTutPct, forecastTutStr) : '';
  const forecastAvgRow = getProgressRowHTML('Forecast Average', r.forecastAvgPct,
    r.forecastAvgPct !== null ? `${r.forecastAvgPct.toFixed(1)}%` : '—');

  return `
    <div class="subj-card">
      <div class="subj-card-header">
        <span class="subj-card-code">${r.code}</span>
        <span class="status-badge ${r.status.cls}">${r.status.text}</span>
      </div>
      <div class="subj-card-name">${r.name}</div>
      <div class="subj-card-stats">
        <div class="subj-stat-section">
          <div class="subj-stat-section-label">Current</div>
          ${currentLecRow}${currentTutRow}${currentAvgRow}
        </div>
        <div class="subj-stat-section">
          <div class="subj-stat-section-label">Forecast (if all pending attended)</div>
          ${forecastLecRow}${forecastTutRow}${forecastAvgRow}
        </div>
      </div>
      ${getRemainingRequirementText(r.optResult)}
    </div>`;
}

/** Build the summary stats row (4 cards at top of panel). */
function buildStatsRow(rows) {
  const totalClasses = rows.reduce((s, r) => s + r.totComb, 0);
  const totalSubj    = rows.length;
  const totalMustAtt = rows.reduce((s, r) => s + r.optResult.addL + r.optResult.addT, 0);
  const totalSkips   = rows.reduce((s, r) => s + r.optResult.skipL_budget + r.optResult.skipT_budget, 0);

  return `
    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-label">Total Classes</div>
        <div class="stat-val">${totalClasses}</div>
        <div class="stat-sub">across ${totalSubj} subjects</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Must Attend Rem.</div>
        <div class="stat-val" style="color:var(--accent)">${totalMustAtt}</div>
        <div class="stat-sub">additional classes needed</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Safe Skips Rem.</div>
        <div class="stat-val" style="color:var(--green)">${totalSkips}</div>
        <div class="stat-sub">maximum remaining skips</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Target</div>
        <div class="stat-val" style="color:var(--amber)">75%</div>
        <div class="stat-sub">average (L% + T%) / 2</div>
      </div>
    </div>`;
}

/** Build one table row HTML from computed stats. */
function buildTableRow(r) {
  const opt      = r.optResult;
  const tutBadge = r.totT === 0
    ? `<td><span class="badge-na">N/A</span></td>`
    : `<td><span class="badge badge-must">${opt.addT}</span></td>`;
  const tutSkip  = r.totT === 0
    ? `<td><span class="badge-na">—</span></td>`
    : `<td>${makeSkipBudgetVisual(opt.skipT_budget, r.missT_done, 'T')}</td>`;
  const tagHTML  = r.tag ? `<div><span class="s-elec">${r.tag}</span></div>` : '';

  const currentTutCell  = r.totT > 0 ? makePctCell(r.currentTutPct)  : `<td><span class="badge-na">N/A</span></td>`;
  const forecastTutCell = r.totT > 0 ? makePctCell(r.forecastTutPct) : `<td><span class="badge-na">N/A</span></td>`;

  return `<tr>
    <td class="left">
      <div class="s-code">${r.code}</div>
      <div class="s-name">${r.name}</div>
      ${tagHTML}
    </td>
    <td><span class="num">${r.totL}</span></td>
    <td>${r.totT > 0 ? `<span class="num">${r.totT}</span>` : `<span class="badge-na">—</span>`}</td>
    <td><span class="num-combined">${r.totComb}</span></td>
    <th class="sep-col"></th>
    <td><span class="badge badge-must">${opt.addL}</span></td>
    ${tutBadge}
    <td><span class="num-muted">${opt.addL + opt.addT}</span></td>
    <th class="sep-col"></th>
    ${makePctCell(r.currentLecPct)}
    ${currentTutCell}
    ${makePctCell(r.currentAvgPct, true)}
    <th class="sep-col"></th>
    ${makePctCell(r.forecastLecPct)}
    ${forecastTutCell}
    ${makePctCell(r.forecastAvgPct, true)}
    <th class="sep-col"></th>
    <td>${makeSkipBudgetVisual(opt.skipL_budget, r.missL_done, 'L')}</td>
    ${tutSkip}
    <td><span class="num-muted">${opt.skipL_budget + opt.skipT_budget}</span></td>
  </tr>`;
}

/** Main render orchestrator — assembles all sub-sections. */
function renderPanel(quizIdx, liveData = getAttendanceData(ALL_DATA[quizIdx].date)) {
  const {label, date: quizDate} = ALL_DATA[quizIdx];

  // Compute all stats in ONE pass (single source of truth)
  const rows = SUBJECTS.map(({code, name, tag}) =>
    computeSubjectStats(code, name, tag, liveData[code])
  );

  const heroHTML  = buildHeroCard(rows, label, quizDate);
  const cardsHTML = rows.map(buildSubjectCard).join('');
  const statsHTML = buildStatsRow(rows);
  const rowsHTML  = rows.map(buildTableRow).join('');

  return `
    ${heroHTML}
    <div class="subject-grid">${cardsHTML}</div>
    ${statsHTML}
    <div class="table-card">
      <div class="table-scroll">
        <table class="att" role="table" aria-label="${label} attendance requirements">
          <thead>
            <tr class="grp-row">
              <th class="left" rowspan="2" style="min-width:180px;padding:10px 12px">Subject</th>
              <th colspan="3" class="grp-total">Total Classes</th>
              <th class="sep-col" rowspan="2"></th>
              <th colspan="3" class="grp-must">Must Attend (Remaining)</th>
              <th class="sep-col" rowspan="2"></th>
              <th colspan="3" class="grp-must">Current %</th>
              <th class="sep-col" rowspan="2"></th>
              <th colspan="3" class="grp-must">Forecast %</th>
              <th class="sep-col" rowspan="2"></th>
              <th colspan="3" class="grp-skip">Can Skip (Remaining Safe Skips)</th>
            </tr>
            <tr class="sub-row">
              <th>Lectures</th><th>Tutorials</th><th>Combined</th>
              <th class="sub-must">Must L</th><th class="sub-must">Must T</th><th class="sub-must">Min total</th>
              <th class="sub-must">Lec %</th><th class="sub-must">Tut %</th><th class="sub-must">Avg %</th>
              <th class="sub-must">Lec %</th><th class="sub-must">Tut %</th><th class="sub-must">Avg %</th>
              <th class="sub-skip">Skip L</th><th class="sub-skip">Skip T</th><th class="sub-skip">Total skip</th>
            </tr>
          </thead>
          <tbody>${rowsHTML}</tbody>
        </table>
      </div>
      <div class="legend">
        <span class="legend-item"><span class="legend-dot" style="background:var(--accent)"></span> Must Attend (blue badge)</span>
        <span class="legend-item"><span class="legend-dot" style="background:var(--green)"></span> Can Skip / Safe Skips (green badge)</span>
        <span class="legend-item"><span class="legend-dot" style="background:var(--text3)"></span> Zero / Not Applicable</span>
        <span class="legend-item"><span class="legend-dot" style="background:var(--amber)"></span> Below 75% threshold</span>
      </div>
    </div>
    <div class="opt-note">
      <span class="opt-note-icon">⚡</span>
      <div>
        <b>Optimisation note:</b> The "Must Attend" values are found by exhaustive search over all valid
        integer combinations of (attended lectures, attended tutorials), minimising total classes attended
        while satisfying <b>(Lec% + Tut%) / 2 ≥ 75%</b>. On ties, the combination with the
        <b>fewest lectures attended</b> (maximum lecture skips) is chosen — this is why subjects with
        tutorials show 50% lecture attendance paired with 100% tutorial attendance as the optimal minimum.
        <br><br>
        <b>Forecast %</b> assumes all remaining (pending) classes are attended. <b>Current %</b> is based only on
        completed (attended or missed) classes and excludes all pending classes.
      </div>
    </div>`;
}

/* ═══════════════════════════════════════════════════════════════════════
   LOGGING INTERFACE
═══════════════════════════════════════════════════════════════════════ */

/**
 * Log or update attendance for one class.
 * Blocks future-date logging unless simulation mode is active.
 */
function logAttendance(dateStr, subjectCode, type, newState) {
  // Future date guard: block logging for future dates in normal mode
  if (newState !== 'Pending' && !isSimulationMode() && dateStr > getTodayString()) {
    console.warn(`[logAttendance] Blocked: ${dateStr} is in the future (simulation mode off).`);
    return;
  }
  if (!isScheduledClass(dateStr, subjectCode, type) || !['Attended', 'Missed', 'Pending'].includes(newState)) {
    console.warn('[logAttendance] Blocked invalid class or state.');
    return;
  }

  const states  = loadStates();
  const classId = `${dateStr}:${subjectCode}:${type}`;

  if (newState === 'Pending') {
    delete states[classId];
  } else {
    states[classId] = newState;
  }

  saveStates(states);
  recalculateAndRender();
}

/* ═══════════════════════════════════════════════════════════════════════
   TODAY'S CLASSES RENDERER
═══════════════════════════════════════════════════════════════════════ */
function renderTodayClasses(targetDate, quizLiveData) {
  const listContainer = document.getElementById('todayClassList');
  const dateLabel     = document.getElementById('todayDateLabel');
  if (!listContainer || !dateLabel) return;

  dateLabel.innerHTML = formatTodayHeader(targetDate);

  const dow         = targetDate.getDay();
  const monIdx      = (dow + 6) % 7; // Mon=0 … Sun=6
  const dateStr     = getLocalDateString(targetDate);
  const isWeekend   = dow === 0 || dow === 6;
  const targetNoon  = new Date(targetDate);
  targetNoon.setHours(12, 0, 0, 0);
  const isWithinSemester = targetNoon >= START_DATE && targetNoon <= SEMESTER_END_DATE;

  if (isWeekend || !isWithinSemester || !DAY_SCHEDULE[monIdx]) {
    listContainer.innerHTML = `<div class="today-empty">No scheduled classes on this date.</div>`;
    return;
  }

  const classes      = DAY_SCHEDULE[monIdx];
  const states       = loadStates();
  const isFuture     = dateStr > getTodayString();
  const isBlocked    = isFuture && !isSimulationMode();

  // Get live attendance data for the currently selected quiz (for tooltips)
  listContainer.innerHTML = classes.map((c, idx) => {
    const subj       = SUBJECTS.find(s => s.code === c.s);
    const subjName   = subj ? subj.name : c.s;
    const classId    = `${dateStr}:${c.s}:${c.t}`;
    const currState  = states[classId] || 'Pending';
    const timeSlot   = TIME_SLOTS[idx] || 'TBD';
    const typeLabel  = c.t === 'L' ? 'Lecture' : 'Tutorial';

    const attActive  = currState === 'Attended' ? 'active-attended' : '';
    const missActive = currState === 'Missed'   ? 'active-missed'   : '';
    const pendActive = currState === 'Pending'  ? 'active-pending'  : '';

    // Build tooltips showing forecast impact of each possible action
    const impactAtt  = quizLiveData
      ? getImpactTooltipHTML(calcForecastImpact(quizLiveData, c.s, c.t, currState, 'Attended'))
      : '';
    const impactMiss = quizLiveData
      ? getImpactTooltipHTML(calcForecastImpact(quizLiveData, c.s, c.t, currState, 'Missed'))
      : '';

    const attTooltip  = impactAtt  || 'Mark as attended';
    const missTooltip = impactMiss || 'Mark as missed';

    // Disabled state for future dates in normal mode
    const disabledAttr = isBlocked ? 'disabled title="Enable Simulation Mode to log future dates"' : '';
    const disabledStyle = isBlocked ? 'opacity:0.4;cursor:not-allowed;' : '';

    return `
      <div class="today-row">
        <div class="today-row-left">
          <div class="today-row-subj">
            <span class="s-code">${c.s}</span>
            <span class="today-row-type">${typeLabel}</span>
            <span class="today-row-time">${timeSlot}</span>
          </div>
          <div class="today-row-name">${subjName}</div>
        </div>
        <div class="today-row-actions">
          <div class="tooltip-wrap">
            <button class="action-btn ${attActive}" style="${disabledStyle}"
              ${disabledAttr}
              aria-label="Mark ${c.s} ${typeLabel} as attended"
              onclick="logAttendance('${dateStr}', '${c.s}', '${c.t}', 'Attended')">✓ Attended</button>
            <span class="tooltip-text">${attTooltip}</span>
          </div>
          <div class="tooltip-wrap">
            <button class="action-btn ${missActive}" style="${disabledStyle}"
              ${disabledAttr}
              aria-label="Mark ${c.s} ${typeLabel} as missed"
              onclick="logAttendance('${dateStr}', '${c.s}', '${c.t}', 'Missed')">✕ Missed</button>
            <span class="tooltip-text">${missTooltip}</span>
          </div>
          <button class="action-btn ${pendActive}"
            ${disabledAttr} style="${disabledStyle}" aria-label="Reset ${c.s} ${typeLabel} attendance status"
            onclick="logAttendance('${dateStr}', '${c.s}', '${c.t}', 'Pending')">Reset</button>
        </div>
      </div>`;
  }).join('');
}

/* ═══════════════════════════════════════════════════════════════════════
   HISTORY LOG RENDERER
═══════════════════════════════════════════════════════════════════════ */
function renderHistoryLog() {
  const historyList  = document.getElementById('historyList');
  const historyCount = document.getElementById('historyCount');
  if (!historyList || !historyCount) return;

  const states = loadStates();
  const items  = [];

  Object.entries(states).forEach(([classId, state]) => {
    if (state !== 'Attended' && state !== 'Missed') return; // skip invalid/pending
    const parts = classId.split(':');
    if (parts.length !== 3) return; // guard against corrupt keys
    const [dateStr, sCode, type] = parts;
    if (!isScheduledClass(dateStr, sCode, type)) return;
    items.push({classId, dateStr, sCode, type, state});
  });

  // Sort newest first (lexicographic YYYY-MM-DD is correct)
  items.sort((a, b) => b.dateStr.localeCompare(a.dateStr) || a.classId.localeCompare(b.classId));

  historyCount.textContent = items.length;

  if (items.length === 0) {
    historyList.innerHTML = `<div class="today-empty">No logged attendance history yet.</div>`;
    return;
  }

  historyList.innerHTML = items.map(item => {
    const subj        = SUBJECTS.find(s => s.code === item.sCode);
    const subjName    = subj ? subj.name : item.sCode;
    const dateFmt     = formatHistoryDate(item.dateStr);
    const isAttended  = item.state === 'Attended';
    const badgeClass  = isAttended ? 'badge-skip' : 'badge-zero';
    const symbol      = isAttended ? '✓' : '✕';
    const typeLabel   = item.type === 'L' ? 'Lecture' : 'Tutorial';

    return `
      <div class="history-row" style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;border-bottom:1px solid var(--border);font-size:12.5px;">
        <div style="display:flex;align-items:center;gap:12px;">
          <span class="badge ${badgeClass}" style="min-width:24px;height:24px;padding:0;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;">${symbol}</span>
          <div>
            <span style="font-weight:600;color:var(--text);">${dateFmt}</span>
            <span style="color:var(--text3);margin:0 6px;">•</span>
            <span style="color:var(--text2);"><strong style="font-family:'JetBrains Mono',monospace;color:var(--text);">${item.sCode}</strong> ${typeLabel}</span>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:10px;">
          <span style="color:var(--text3);font-size:11px;">${subjName}</span>
          <button class="theme-btn" style="padding:2px 6px;font-size:10px;"
            onclick="logAttendance('${item.dateStr}', '${item.sCode}', '${item.type}', 'Pending')">Reset</button>
        </div>
      </div>`;
  }).join('');
}

/* ═══════════════════════════════════════════════════════════════════════
   RECALCULATE & RENDER — master refresh
═══════════════════════════════════════════════════════════════════════ */
function recalculateAndRender() {
  const targetDate = getActiveDate();
  const liveData = getAttendanceData(ALL_DATA[currentQuiz].date);
  renderTodayClasses(targetDate, liveData);
  renderHistoryLog();
  updateSimulationBadge();
  document.getElementById('panels').innerHTML = renderPanel(currentQuiz, liveData);
}

/* ═══════════════════════════════════════════════════════════════════════
   TAB SWITCHING
═══════════════════════════════════════════════════════════════════════ */
let currentQuiz = 0;

function switchQuiz(idx, btn) {
  if (idx === currentQuiz) return;
  currentQuiz = idx;
  document.querySelectorAll('.tab-btn').forEach((b, i) => {
    b.classList.toggle('active', i === idx);
    b.setAttribute('aria-selected', i === idx ? 'true' : 'false');
  });
  recalculateAndRender();
}

/* ═══════════════════════════════════════════════════════════════════════
   THEME TOGGLE
═══════════════════════════════════════════════════════════════════════ */
const MOON_PATH = "M21 12.79A9 9 0 1 1 11.21 3a7 7 0 1 0 9.79 9.79z";
const SUN_PATH  = "M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42M12 5a7 7 0 1 0 0 14A7 7 0 0 0 12 5z";

function updateThemeBtn(theme) {
  const iconPath = document.getElementById('themeIconPath');
  const label    = document.getElementById('themeLabel');
  if (!iconPath || !label) return;
  if (theme === 'dark') {
    iconPath.setAttribute('d', MOON_PATH);
    label.textContent = 'Dark';
  } else {
    iconPath.setAttribute('d', SUN_PATH);
    label.textContent = 'Light';
  }
}

document.getElementById('themeToggle').addEventListener('click', () => {
  const html  = document.documentElement;
  const theme = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', theme);
  updateThemeBtn(theme);
});

/* ═══════════════════════════════════════════════════════════════════════
   EVENT LISTENERS
═══════════════════════════════════════════════════════════════════════ */
document.getElementById('mockDaySelector').addEventListener('change', () => {
  recalculateAndRender();
});

document.querySelector('.tabs-wrap').addEventListener('keydown', event => {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  const tabs = [...document.querySelectorAll('.tab-btn')];
  const current = tabs.indexOf(document.activeElement);
  if (current < 0) return;
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1
    : (current + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
  event.preventDefault();
  tabs[next].focus();
  switchQuiz(next, tabs[next]);
});

document.getElementById('historyToggle').addEventListener('click', () => {
  const content = document.getElementById('historyContent');
  const arrow   = document.getElementById('historyArrow');
  if (!content || !arrow) return;
  const isOpen = content.style.display !== 'none';
  content.style.display = isOpen ? 'none' : 'block';
  arrow.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(180deg)';
  document.getElementById('historyToggle').setAttribute('aria-expanded', String(!isOpen));
});

document.getElementById('resetBtn').addEventListener('click', () => {
  if (confirm('Reset all attendance tracking data? This cannot be undone.')) {
    clearStates();
    recalculateAndRender();
  }
});

/* ═══════════════════════════════════════════════════════════════════════
   BUILT-IN TEST SUITE
   Run automatically on load. All results printed to console.
   No external dependencies required.
═══════════════════════════════════════════════════════════════════════ */
function runTests() {
  let pass = 0, fail = 0;
  const assert = (label, condition) => {
    if (condition) {
      console.log(`[TEST] ✓ PASS: ${label}`);
      pass++;
    } else {
      console.error(`[TEST] ✗ FAIL: ${label}`);
      fail++;
    }
  };
  const approx = (a, b, eps = 0.001) => Math.abs(a - b) < eps;

  // ── calcCurrentPct ───────────────────────────────────────────────────
  assert('calcCurrentPct: 0 completed → null',          calcCurrentPct(0, 0) === null);
  assert('calcCurrentPct: 3/4 = 75%',                   approx(calcCurrentPct(3, 4), 75));
  assert('calcCurrentPct: 4/4 = 100%',                  approx(calcCurrentPct(4, 4), 100));
  assert('calcCurrentPct: 0/4 = 0%',                    approx(calcCurrentPct(0, 4), 0));

  // ── calcForecastPct ──────────────────────────────────────────────────
  assert('calcForecastPct: total=0 → null',              calcForecastPct(0, 0, 0) === null);
  assert('calcForecastPct: att=3 pend=1 tot=4 → 100%',  approx(calcForecastPct(3, 1, 4), 100));
  assert('calcForecastPct: att=0 pend=3 tot=4 → 75%',   approx(calcForecastPct(0, 3, 4), 75));
  assert('calcForecastPct: att=0 pend=0 tot=4 → 0%',    approx(calcForecastPct(0, 0, 4), 0));

  // ── calcAvgPct ───────────────────────────────────────────────────────
  assert('calcAvgPct: both null → null',                 calcAvgPct(null, null) === null);
  assert('calcAvgPct: lec=80 tut=null → 80',             approx(calcAvgPct(80, null), 80));
  assert('calcAvgPct: lec=null tut=80 → 80',             approx(calcAvgPct(null, 80), 80));
  assert('calcAvgPct: lec=80 tut=70 → 75',               approx(calcAvgPct(80, 70), 75));
  assert('calcAvgPct: lec=50 tut=100 → 75 (optimal)',    approx(calcAvgPct(50, 100), 75));

  // ── getSubjectStatus ─────────────────────────────────────────────────
  assert('status: null → warning class (N/A)',           getSubjectStatus(null).cls === 'status-warning');
  assert('status: 80 → SAFE',                            getSubjectStatus(80).text === 'SAFE');
  assert('status: 79.99 → WARNING',                      getSubjectStatus(79.99).text === 'WARNING');
  assert('status: 75 → WARNING',                         getSubjectStatus(75).text === 'WARNING');
  assert('status: 74.99 → CRITICAL',                     getSubjectStatus(74.99).text === 'CRITICAL');
  assert('status: 0 → CRITICAL',                         getSubjectStatus(0).text === 'CRITICAL');

  // ── optimize() ───────────────────────────────────────────────────────
  {
    const r = optimize(20, 10);  // typical subject
    assert('optimize: no-tut totT=0 path',               optimize(10, 0).tutPct === null);
    assert('optimize: avgPct ≥ 75',                       r.avgPct >= 75);
    assert('optimize: attL ≤ totL',                       r.attL <= 20);
    assert('optimize: attT ≤ totT',                       r.attT <= 10);
    assert('optimize: skipL = totL - attL',               r.skipL === 20 - r.attL);
    assert('optimize: skipT = totT - attT',               r.skipT === 10 - r.attT);
    // Optimum for 20L+10T: attL=10,attT=10 → avg=(50%+100%)/2=75% ✓
    assert('optimize: optimal (50% lec, 100% tut) avg=75', approx(optimize(20, 10).avgPct, 75));
    assert('optimize: zero lectures uses tutorials',       optimize(0, 4).attT === 3 && approx(optimize(0, 4).avgPct, 75));
    assert('optimize: zero totals returns N/A',             optimize(0, 0).avgPct === null);
    assert('optimize: exactly 75% qualifies',              meetsAttendanceTarget(3, 4, 0, 0));
    assert('optimize: 74.99% does not qualify',            !meetsAttendanceTarget(7499, 10000, 0, 0));
  }

  // ── optimizeLive() ───────────────────────────────────────────────────
  {
    // Already attended enough
    const r1 = optimizeLive(20, 10, 10, 2, 10, 0, 8, 0);
    assert('optimizeLive: already eligible → addL+addT=0', r1.addL + r1.addT === 0);
    assert('optimizeLive: not infeasible',                  !r1.infeasible);
    // Infeasible: no pending left, not at 75%
    const r2 = optimizeLive(10, 0, 5, 5, 0, 0, 0, 0);
    assert('optimizeLive: infeasible when att+pend < need', r2.infeasible);
    assert('optimizeLive: skipL_budget ≥ 0',                r2.skipL_budget >= 0);
    // totL=0 guard
    const r3 = optimizeLive(0, 0, 0, 0, 0, 0, 0, 0);
    assert('optimizeLive: totL=0 → no crash',               r3.addL === 0 && r3.addT === 0);
    // Skip budgets never negative
    const r4 = optimizeLive(10, 5, 8, 0, 5, 0, 2, 0);
    assert('optimizeLive: skipL_budget never negative',      r4.skipL_budget >= 0);
    assert('optimizeLive: skipT_budget never negative',      r4.skipT_budget >= 0);
  }

  // ── calcForecastImpact — all 6 transitions ───────────────────────────
  const mockData = {
    'TEST': {
      totL: 10, totT: 5,
      attL_done: 3, missL_done: 2, pendingL: 5,
      attT_done: 2, missT_done: 1, pendingT: 2
    }
  };
  // Pending → Attended (L): forecast is unchanged (it already assumes pending is attended).
  const t1 = calcForecastImpact(mockData, 'TEST', 'L', 'Pending', 'Attended');
  assert('tooltip P→A(L): newAvg == curAvg',             approx(t1.newAvg, t1.curAvg));
  // Pending → Missed (L): should lower forecast
  const t2 = calcForecastImpact(mockData, 'TEST', 'L', 'Pending', 'Missed');
  assert('tooltip P→M(L): newAvg < curAvg',              t2.newAvg < t2.curAvg);
  // Attended → Missed (L): should lower forecast
  const t3 = calcForecastImpact(mockData, 'TEST', 'L', 'Attended', 'Missed');
  assert('tooltip A→M(L): newAvg < curAvg',              t3.newAvg < t3.curAvg);
  // Missed → Attended (L): should raise forecast
  const t4 = calcForecastImpact(mockData, 'TEST', 'L', 'Missed', 'Attended');
  assert('tooltip M→A(L): newAvg > curAvg',              t4.newAvg > t4.curAvg);
  // Attended → Pending (L): should lower forecast (one fewer attended, now pending)
  const t5 = calcForecastImpact(mockData, 'TEST', 'L', 'Attended', 'Pending');
  assert('tooltip A→P(L): newAvg == curAvg (pending regained)',  approx(t5.newAvg, t5.curAvg));
  // Missed → Pending (L): should raise forecast (unmark miss, now pending again)
  const t6 = calcForecastImpact(mockData, 'TEST', 'L', 'Missed', 'Pending');
  assert('tooltip M→P(L): newAvg > curAvg',              t6.newAvg > t6.curAvg);
  assert('schedule validation accepts scheduled class',   isScheduledClass('2026-07-15', 'BCS-054', 'L'));
  assert('schedule validation rejects invalid date',       !isScheduledClass('2026-02-30', 'BCS-054', 'L'));

  // ── Exhaustive optimizer verification (98 automatically generated cases) ─
  // Independent brute-force reference makes the expected attendance combination
  // explicit for every case, including tie-breaking and impossible cases.
  const referenceEligible = (attL, totL, attT, totT) => {
    const l = totL > 0 ? attL / totL : null;
    const t = totT > 0 ? attT / totT : null;
    const avg = l === null ? t : t === null ? l : (l + t) / 2;
    return avg !== null && avg >= 0.75;
  };
  const referenceLive = (totL, totT, doneL, doneT, pendingL, pendingT) => {
    let best = null;
    for (let addL = 0; addL <= pendingL; addL++) {
      for (let addT = 0; addT <= pendingT; addT++) {
        if (!referenceEligible(doneL + addL, totL, doneT + addT, totT)) continue;
        const candidate = {addL, addT, total: addL + addT};
        if (!best || candidate.total < best.total || (candidate.total === best.total && candidate.addL < best.addL)) best = candidate;
      }
    }
    return best;
  };
  for (let totL = 0; totL <= 6; totL++) {
    for (let totT = 0; totT <= 6; totT++) {
      const expectedStatic = referenceLive(totL, totT, 0, 0, totL, totT);
      const actualStatic = optimize(totL, totT);
      const staticMatches = expectedStatic === null
        ? actualStatic.avgPct === null
        : actualStatic.attL === expectedStatic.addL && actualStatic.attT === expectedStatic.addT;
      assert(`optimize exhaustive ${totL}L/${totT}T`, staticMatches);

      const doneL = Math.floor(totL / 3);
      const doneT = Math.floor(totT / 2);
      const pendingL = totL - doneL - Math.floor(totL / 3);
      const pendingT = totT - doneT - Math.floor(totT / 3);
      const expectedLive = referenceLive(totL, totT, doneL, doneT, pendingL, pendingT);
      const actualLive = optimizeLive(totL, totT, doneL, totL - doneL - pendingL, doneT, totT - doneT - pendingT, pendingL, pendingT);
      const liveMatches = expectedLive === null
        ? actualLive.infeasible || actualLive.avgPct === null
        : !actualLive.infeasible && actualLive.addL === expectedLive.addL && actualLive.addT === expectedLive.addT;
      assert(`optimizeLive exhaustive ${totL}L/${totT}T`, liveMatches);
    }
  }

  // ── assertConsistency ────────────────────────────────────────────────
  // Should NOT fire errors for valid data
  const validData = {totL:10,totT:5,attL_done:3,missL_done:2,pendingL:5,attT_done:2,missT_done:1,pendingT:2};
  assertConsistency('ValidTest', validData); // No error expected

  console.log(`\n[TEST SUITE] ${pass} passed, ${fail} failed.`);
  if (fail === 0) console.log('[TEST SUITE] ✓ ALL TESTS PASSED');
  else            console.error(`[TEST SUITE] ✗ ${fail} TEST(S) FAILED — check above`);
}

/* ═══════════════════════════════════════════════════════════════════════
   INIT
═══════════════════════════════════════════════════════════════════════ */
updateThemeBtn('dark');
recalculateAndRender();
runTests();
