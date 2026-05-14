const fs = require('fs');

const oldQuizHtml = fs.readFileSync('apps/games/quiz/index.html', 'utf8');
const wipIndexHtml = fs.readFileSync('apps/wip/quiz/index.html', 'utf8');
const wipEditorHtml = fs.readFileSync('apps/wip/quiz/editor.html', 'utf8');

// I'll manually construct the merged HTML file here in the next step,
// but first let's see if there are any specific assets.
console.log('Read all files');
