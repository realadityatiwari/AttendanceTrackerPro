import re

with open('js/attendance-engine.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
skip = False
for line in lines:
    if "const ALL_DATA = QUIZ_DATES.map" in line:
        skip = True
    if skip and "INTERNAL ASSERTIONS" in line:
        skip = False
    if not skip:
        new_lines.append(line)

content = "".join(new_lines)
with open('js/attendance-engine.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("Removed ALL_DATA successfully")
