import os

with open('js/legacy.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Extract from buildHeroCard (703 in zero-indexed) to updateThemeBtn (1210 max or so)
# Let's search the list for the start and end string
start_idx = -1
for i, line in enumerate(lines):
    if line.startswith('function buildHeroCard'):
        start_idx = i
        break

end_idx = len(lines)
for i, line in enumerate(lines):
    if line.startswith('function runTests'):
        end_idx = i
        break

ui_lines = lines[start_idx:end_idx]

header = """import { saveStates, loadStates, clearStates } from './storage.js';
import { getTimetable, formatTodayHeader, getLocalDateString, getTodayString, isScheduledClass, formatHistoryDate, getActiveDate, updateSimulationBadge, isSimulationMode } from './utils.js';
import { computeSubjectStats, calcForecastImpact, getAttendanceData, getSubjectStatus, pctColor, barColor, dimColor, getRemainingRequirementText, getProgressRowHTML, makeSkipBudgetVisual, makePctCell } from './attendance-engine.js';

export let currentQuiz = 0;

"""

new_lines = []
for line in ui_lines:
    if line.startswith('function '):
        new_lines.append('export ' + line)
    elif line.startswith('let currentQuiz'):
        continue # we export it above
    else:
        # replace ALL_DATA and SUBJECTS and TIME_SLOTS with getters
        line = line.replace('ALL_DATA[', 'getTimetable().quiz_dates[')
        line = line.replace('SUBJECTS', 'getTimetable().subjects')
        line = line.replace('TIME_SLOTS', 'getTimetable().time_slots')
        line = line.replace('DAY_SCHEDULE', 'getTimetable().day_schedule')
        new_lines.append(line)

with open('js/ui.js', 'w', encoding='utf-8') as f:
    f.write(header + "".join(new_lines))

print("ui.js extracted.")
