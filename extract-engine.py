import os

with open('js/legacy.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# We want lines 222 to 606 (inclusive). So indices 221 to 606.
# Wait, getImpactTooltipHTML is at 607, getRemainingRequirementText at 624.
# These might contain UI code but they return HTML, which is borderline UI.
# Let's extract up to the end of calcForecastImpact (line 606).
# Actually, the user says "preserve every existing calculation", so I'll just extract everything up to line 623.

engine_lines = lines[221:606] 
# Add imports to the top
header = "import { loadStates } from './storage.js';\nimport { getTimetable, parseDateString, isScheduledClass } from './utils.js';\n\n"

# Add "export " to all function definitions
new_lines = []
for line in engine_lines:
    if line.startswith('function '):
        new_lines.append('export ' + line)
    else:
        new_lines.append(line)
        
# Fix references to ALL_DATA, QUIZ_DATES, START_DATE, etc inside getAttendanceData
# Wait! getAttendanceData relies on ALL_DATA, which I haven't defined yet! 
# Let's write this python script to just do the extraction, and I'll manually tweak the engine file next.
with open('js/attendance-engine.js', 'w', encoding='utf-8') as f:
    f.write(header + "".join(new_lines))

print("Engine extracted.")
