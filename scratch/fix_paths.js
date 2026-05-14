const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) { 
            results = results.concat(walk(file));
        } else {
            if (file.endsWith('.html') || file.endsWith('.js')) {
                results.push(file);
            }
        }
    });
    return results;
}

const files = walk('./apps');
let updatedCount = 0;

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;

    // We only want to update paths that point to the root directories.
    // The root directories/files accessed from apps are:
    // css, media, js, supabase.js, components
    // We will do a generic replacement for anything matching ../../(css|media|js|supabase.js|components)
    
    // First, handle the files that are already depth 4 (they had ../../../)
    content = content.replace(/(["'])\.\.\/\.\.\/\.\.\/(css|media|js|supabase\.js|components)\b/g, '$1../../../../$2');

    // Then handle the files that are depth 3 (they had ../../)
    content = content.replace(/(["'])\.\.\/\.\.\/(css|media|js|supabase\.js|components)\b/g, '$1../../../$2');

    if (content !== original) {
        fs.writeFileSync(file, content, 'utf8');
        updatedCount++;
        console.log(`Updated paths in ${file}`);
    }
});

console.log(`Done. Updated ${updatedCount} files.`);
