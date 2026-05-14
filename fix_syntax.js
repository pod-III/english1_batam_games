const fs = require('fs');
let text = fs.readFileSync('apps/games/quiz/index.html', 'utf8');
text = text.replace(/\\\${/g, '${');
text = text.replace(/\\`/g, '`');
fs.writeFileSync('apps/games/quiz/index.html', text);
