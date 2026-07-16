import os
import re

# 1. Update index.html
with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Replace inline onclicks with ids
html = html.replace('onclick="appLogin()"', 'id="btnLogin"')
html = html.replace('onclick="appSignup()"', 'id="btnSignup"')
# The first toggleAuthView is for creating an account
html = re.sub(r'<a href="#"([^>]*?)onclick="toggleAuthView\(event\)">Create an account</a>',
              r'<a href="#"\1id="linkToSignup">Create an account</a>', html)
# The second is for login
html = re.sub(r'<a href="#"([^>]*?)onclick="toggleAuthView\(event\)">Login here</a>',
              r'<a href="#"\1id="linkToLogin">Login here</a>', html)
              
html = html.replace('onclick="handleMigrationDiscard()"', 'id="btnMigrationDiscard"')
html = html.replace('onclick="handleMigrationImport()"', 'id="btnMigrationImport"')
html = html.replace('onclick="appLogout()"', 'id="btnLogout"')

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)

# 2. Update ui.js
with open('js/ui.js', 'r', encoding='utf-8') as f:
    ui = f.read()

# Replace switchQuiz
ui = re.sub(r'onclick="switchQuiz\(\$\{([^}]+)\}, this\)"', r'data-action="switchQuiz" data-quiz="${\1}"', ui)

# Replace logAttendance
ui = re.sub(r'onclick="logAttendance\(\'\$\{([^}]+)\}\', \'\$\{([^}]+)\}\', \'\$\{([^}]+)\}\', \'([^\']+)\'\)"',
            r'data-action="logAttendance" data-date="${\1}" data-s="${\2}" data-t="${\3}" data-state="\4"', ui)
            
# Wait, there's another logAttendance variant:
# onclick="logAttendance('${item.dateStr}', '${item.sCode}', '${item.type}', 'Pending')"
ui = re.sub(r'onclick="logAttendance\(\'\$\{([^}]+)\}\', \'\$\{([^}]+)\}\', \'\$\{([^}]+)\}\', \'([^\']+)\'\)"',
            r'data-action="logAttendance" data-date="${\1}" data-s="${\2}" data-t="${\3}" data-state="\4"', ui)

with open('js/ui.js', 'w', encoding='utf-8') as f:
    f.write(ui)

print("HTML and UI replaced.")
