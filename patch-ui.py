import os

with open('js/legacy.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

start_idx = -1
end_idx = -1
for i, line in enumerate(lines):
    if line.startswith('function getImpactTooltipHTML'):
        start_idx = i
    if line.startswith('function buildHeroCard'):
        end_idx = i

if start_idx != -1 and end_idx != -1:
    missing_lines = lines[start_idx:end_idx]
    
    new_missing = []
    for line in missing_lines:
        if line.startswith('function '):
            new_missing.append('export ' + line)
        else:
            new_missing.append(line)
            
    with open('js/ui.js', 'r', encoding='utf-8') as f:
        ui_lines = f.readlines()
        
    for i, line in enumerate(ui_lines):
        if line.startswith('import { computeSubjectStats'):
            ui_lines[i] = "import { computeSubjectStats, calcForecastImpact, getAttendanceData, getSubjectStatus, pctColor, barColor, dimColor } from './attendance-engine.js';\n"
            break
            
    insert_idx = -1
    for i, line in enumerate(ui_lines):
        if line.startswith('export let currentQuiz = 0;'):
            insert_idx = i + 1
            break
            
    if insert_idx != -1:
        final_ui = ui_lines[:insert_idx] + ["\n"] + new_missing + ui_lines[insert_idx:]
        with open('js/ui.js', 'w', encoding='utf-8') as f:
            f.write("".join(final_ui))
        print("Successfully patched ui.js")
    else:
        print("Could not find insert index in ui.js")
else:
    print("Could not find start or end index in legacy.js")
