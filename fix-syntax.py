with open('js/attendance-engine.js', 'r', encoding='utf-8') as f:
    c = f.read()

c = c.replace('*/\n   INTERNAL ASSERTIONS', '/*\n   INTERNAL ASSERTIONS')

with open('js/attendance-engine.js', 'w', encoding='utf-8') as f:
    f.write(c)

print("Fixed syntax error")
