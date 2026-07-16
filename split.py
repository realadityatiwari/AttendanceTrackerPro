import os
import json
import re

# Read original index.html
with open('index.html', 'r', encoding='utf-8') as f:
    html_content = f.read()

# Extract styles
style_match = re.search(r'<style>(.*?)</style>', html_content, re.DOTALL)
if style_match:
    styles = style_match.group(1)
    os.makedirs('css', exist_ok=True)
    with open('css/styles.css', 'w', encoding='utf-8') as f:
        f.write(styles)

# Extract scripts
script_match = re.search(r'<script>(.*?)</script>', html_content, re.DOTALL)
if script_match:
    scripts = script_match.group(1)
    os.makedirs('js', exist_ok=True)
    with open('js/legacy.js', 'w', encoding='utf-8') as f:
        f.write(scripts)
    
print("Successfully extracted CSS and JS.")
