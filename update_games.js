const fs = require('fs');

const data = JSON.parse(fs.readFileSync('games.json', 'utf8'));
const wipDirs = fs.readdirSync('apps/wip');

const wipGames = wipDirs.map(dir => {
  return {
    id: `wip-${dir}`,
    title: dir.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
    category: 'wip',
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

// Remove existing wip games if any
data.games = data.games.filter(g => g.category !== 'wip');
data.games.push(...wipGames);

if (!data.metadata.categories.includes('wip')) {
  data.metadata.categories.push('wip');
}

fs.writeFileSync('games.json', JSON.stringify(data, null, 2));
console.log('Updated games.json with ' + wipGames.length + ' WIP games.');
