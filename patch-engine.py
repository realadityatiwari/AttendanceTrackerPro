import os
import re

with open('js/attendance-engine.js', 'r', encoding='utf-8') as f:
    code = f.read()

# Replace START_DATE with getTimetable().start_date
code = code.replace('START_DATE', 'getTimetable().start_date')

# Replace DAY_SCHEDULE with getTimetable().day_schedule
code = code.replace('DAY_SCHEDULE', 'getTimetable().day_schedule')

# The only issue is SEMESTER_END_DATE, which was derived dynamically in legacy.js
# Let's see if SEMESTER_END_DATE is used.
code = code.replace('SEMESTER_END_DATE', "getTimetable().quiz_dates[getTimetable().quiz_dates.length - 1].date")

# Wait, TARGET_ATTENDANCE is hardcoded to 0.75 in legacy.js but we didn't extract it. 
# It was on line 85. Let's add it to the top.
header_add = "const TARGET_ATTENDANCE = 0.75;\n\n"

# Rewrite the file
with open('js/attendance-engine.js', 'w', encoding='utf-8') as f:
    f.write(code.replace('import { getTimetable', header_add + 'import { getTimetable'))

print("attendance-engine.js patched.")
