import { getTimetable, parseDateString, isScheduledClass, getLocalDateString } from './utils.js';

const TARGET_ATTENDANCE = 0.75;

export function calcCurrentPct(attended, completed) {
  if (!completed || completed <= 0) return null;
  return (attended / completed) * 100;
}

/**
 * Forecast attendance % = (attended + all_pending) / total.
 * Assumes ALL pending classes will be attended — best-case from here.
 * Returns null if total is 0.
 */
export function calcForecastPct(attended, pending, total) {
  if (!total || total <= 0) return null;
  return ((attended + pending) / total) * 100;
}

/**
 * Average of lec% and tut% following the eligibility formula.
 * If tutPct is null (no tutorials for this subject), returns lecPct.
 * If lecPct is null, returns tutPct. If both null, returns null.
 */
export function calcAvgPct(lecPct, tutPct) {
  if (lecPct === null && tutPct === null) return null;
  if (tutPct === null) return lecPct;
  if (lecPct === null) return tutPct;
  return (lecPct + tutPct) / 2;
}

/**
 * Check the eligibility rule using fractions, avoiding rounding errors at 75%.
 * A subject with only one class type is evaluated using that available type.
 */
export function meetsAttendanceTarget(attL, totL, attT, totT) {
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
export function getSubjectStatus(forecastAvgPct) {
  if (forecastAvgPct === null) return {text: 'N/A',      cls: 'status-warning'};
  if (forecastAvgPct >= 80)    return {text: 'SAFE',     cls: 'status-safe'};
  if (forecastAvgPct >= 75)    return {text: 'WARNING',  cls: 'status-warning'};
  return                              {text: 'CRITICAL', cls: 'status-critical'};
}

/** Color for a percentage value (green ≥75, amber ≥60, red otherwise). */
export function pctColor(pct) {
  if (pct === null) return 'var(--text3)';
  if (pct >= 75)    return 'var(--green)';
  if (pct >= 60)    return 'var(--amber)';
  return 'var(--red)';
}

/** Bar fill color — same thresholds as pctColor. */
export function barColor(pct) {
  return pctColor(pct);
}

/** Dim background color for average cell highlight. */
export function dimColor(pct) {
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
export function optimize(totL, totT) {
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
export function optimizeLive(totL, totT, attL_done, missL_done, attT_done, missT_done, pendingL, pendingT) {
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
═══════════════════════════════════════════════════════════════════════ /*
   INTERNAL ASSERTIONS
   Called after every getAttendanceData() to detect data inconsistencies.
═══════════════════════════════════════════════════════════════════════ */
export function assertConsistency(code, d) {
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
export function getAttendanceData(quizDate, states = {}) {
  const data   = {};

  getTimetable().subjects.forEach(({code}) => {
    data[code] = {
      totL: 0, totT: 0,
      attL_done: 0, missL_done: 0,
      attT_done: 0, missT_done: 0,
      pendingL:  0, pendingT: 0
    };
  });

  const cur   = new Date(getTimetable().start_date);
  const limit = new Date(quizDate);
  limit.setHours(12, 0, 0, 0);

  while (cur < limit) {
    const monIdx  = (cur.getDay() + 6) % 7;
    const dateStr = getLocalDateString(cur);

    if (getTimetable().day_schedule[monIdx]) {
      getTimetable().day_schedule[monIdx].forEach(({s, t}) => {
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
  getTimetable().subjects.forEach(({code}) => assertConsistency(code, data[code]));
  return data;
}

/* ═══════════════════════════════════════════════════════════════════════
   SINGLE SOURCE OF TRUTH — computeSubjectStats()
   All rendering functions consume from this one object.
═══════════════════════════════════════════════════════════════════════ */
export function computeSubjectStats(code, name, tag, rawData) {
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
export function calcForecastImpact(rawData, subjectCode, classType, currentState, newAction) {
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

