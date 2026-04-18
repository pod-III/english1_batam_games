import os
import re

games = [
    'games/card-match/index.html',
    'games/card-memory/index.html',
    'games/connect-four/index.html',
    'games/crossword/index.html',
    'games/emoji-game/index.html',
    'games/fill-it/index.html',
    'games/find-the-ball/index.html',
    'games/freeze-dance/index.html',
    'games/guess-who/index.html',
    'games/hangman/index.html'
]

cdn_pattern = re.compile(r'<script src="https://cdn\.tailwindcss\.com"></script>\s*')
config_pattern = re.compile(r'<script>\s*tailwind\.config\s*=\s*(\{.*?\})\s*</script>\s*', re.DOTALL)
script_pattern = re.compile(r'<script\s+(?!.*defer\b)([^>]*)src="([^"]+)"([^>]*)>', re.IGNORECASE)

def script_replacer(match):
    before = match.group(1)
    src = match.group(2)
    after = match.group(3)
    return f'<script defer {before}src="{src}"{after}>'

for filepath in games:
    if not os.path.exists(filepath):
        continue
    with open(filepath, 'r') as f:
        content = f.read()

    depth = filepath.count('/')
    css_path = '../' * depth + 'css/tailwind-output.css'

    # optional shadow rename for those using neo
    content = content.replace('shadow-neo-hover', 'shadow-hard-hover')
    content = content.replace('shadow-neo-sm', 'shadow-hard-sm')
    content = content.replace('shadow-neo-lg', 'shadow-hard-lg')
    content = content.replace('shadow-neo', 'shadow-hard')

    content = cdn_pattern.sub('', content)
    content = config_pattern.sub(f'<link rel="stylesheet" href="{css_path}" />\n', content)
    content = script_pattern.sub(script_replacer, content)

    with open(filepath, 'w') as f:
        f.write(content)

