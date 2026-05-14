const fs = require('fs');
const path = require('path');

const gamesFile = 'games.json';
let data = JSON.parse(fs.readFileSync(gamesFile, 'utf8'));

// Filter out old wip games
data.games = data.games.filter(g => g.category !== 'wip' && g.category !== 'under-construction');

const wipDirs = fs.readdirSync('apps/wip');

const wipGames = wipDirs.map(dir => {
  const indexPath = path.join('apps/wip', dir, 'index.html');
  let title = dir.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  
  if (fs.existsSync(indexPath)) {
    const html = fs.readFileSync(indexPath, 'utf8');
    const titleMatch = html.match(/<title>(.*?)<\/title>/i);
    if (titleMatch && titleMatch[1]) {
      title = titleMatch[1].replace('KlassKit - ', '').replace('KlassKit | ', '').trim();
    }
  }

  return {
    id: `wip-${dir}`,
    title: title,
    category: 'under-construction',
    path: `./apps/wip/${dir}/index.html`,
    icon: 'construction',
    color: 'text-orange',
    description: 'Work in progress tool/game',
    tags: ['wip'],
    difficulty: 'medium',
    ageRange: 'All',
    featured: false,
    active: true,
    adminOnly: true,
    guide: {
      short: 'This is a work in progress.',
      steps: ['Testing and development phase.']
    }
  };
});

// Add new under-construction category
if (data.metadata.categories.includes('wip')) {
  data.metadata.categories = data.metadata.categories.filter(c => c !== 'wip');
}
if (!data.metadata.categories.includes('under-construction')) {
  data.metadata.categories.push('under-construction');
}

data.games.push(...wipGames);

fs.writeFileSync(gamesFile, JSON.stringify(data, null, 2));
console.log('Fixed games.json with ' + wipGames.length + ' under-construction games.');
