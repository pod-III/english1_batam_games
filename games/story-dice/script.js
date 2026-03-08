// --- CONFIG & STATE ---
let soundEnabled = true;
let showLabels = true;
let diceCount = 3;
let isRolling = false;
let rollHistory = [];

// --- DATA ---
const DATA = {
    character: [
        // People & Roles
        { icon: 'user', label: 'Person' }, { icon: 'users', label: 'Friends' }, 
        { icon: 'crown', label: 'King' }, { icon: 'crown', label: 'Queen' }, 
        { icon: 'baby', label: 'Baby' }, { icon: 'skull', label: 'Pirate' },
        { icon: 'stethoscope', label: 'Doctor' }, { icon: 'hard-hat', label: 'Builder' },
        { icon: 'graduation-cap', label: 'Student' }, { icon: 'shield', label: 'Police' },
        { icon: 'utensils', label: 'Chef' }, { icon: 'plane', label: 'Pilot' },
        { icon: 'palette', label: 'Artist' }, { icon: 'music', label: 'Singer' },
        { icon: 'tractor', label: 'Farmer' }, { icon: 'rocket', label: 'Astronaut' },
        // Fantasy & Sci-Fi
        { icon: 'ghost', label: 'Ghost' }, { icon: 'bot', label: 'Robot' },
        { icon: 'sparkles', label: 'Wizard' }, { icon: 'zap', label: 'Hero' },
        { icon: 'swords', label: 'Ninja' }, { icon: 'flame', label: 'Dragon' },
        // Animals
        { icon: 'cat', label: 'Cat' }, { icon: 'dog', label: 'Dog' },
        { icon: 'fish', label: 'Fish' }, { icon: 'bug', label: 'Monster' },
        { icon: 'bird', label: 'Bird' }, { icon: 'rabbit', label: 'Rabbit' },
        { icon: 'turtle', label: 'Turtle' }, { icon: 'snail', label: 'Snail' }
    ],
    
    setting: [
        // Nature
        { icon: 'trees', label: 'Forest' }, { icon: 'mountain', label: 'Mountain' },
        { icon: 'sun', label: 'Beach' }, { icon: 'moon', label: 'Night' },
        { icon: 'cloud-rain', label: 'Storm' }, { icon: 'waves', label: 'Ocean' },
        { icon: 'snowflake', label: 'Snow' }, { icon: 'flame', label: 'Volcano' },
        { icon: 'cloud', label: 'Sky' }, { icon: 'compass', label: 'Island' },
        // Buildings & Places
        { icon: 'home', label: 'House' }, { icon: 'building', label: 'City' }, 
        { icon: 'castle', label: 'Castle' }, { icon: 'tent', label: 'Camp' }, 
        { icon: 'school', label: 'School' }, { icon: 'store', label: 'Shop' }, 
        { icon: 'hospital', label: 'Hospital' }, { icon: 'coffee', label: 'Cafe' },
        { icon: 'briefcase', label: 'Office' }, { icon: 'ferris-wheel', label: 'Park' },
        // Vehicles & Travel
        { icon: 'rocket', label: 'Space' }, { icon: 'ship', label: 'Ship' },
        { icon: 'train', label: 'Station' }, { icon: 'plane', label: 'Airport' },
        { icon: 'bus', label: 'Bus Stop' }, { icon: 'car', label: 'Highway' }
    ],
    
    object: [
        // Everyday Items
        { icon: 'apple', label: 'Apple' }, { icon: 'pizza', label: 'Pizza' },
        { icon: 'cake', label: 'Cake' }, { icon: 'smartphone', label: 'Phone' }, 
        { icon: 'watch', label: 'Clock' }, { icon: 'laptop', label: 'Computer' }, 
        { icon: 'camera', label: 'Camera' }, { icon: 'lightbulb', label: 'Idea' }, 
        { icon: 'book', label: 'Book' }, { icon: 'key', label: 'Key' },
        { icon: 'glasses', label: 'Glasses' }, { icon: 'umbrella', label: 'Umbrella' },
        { icon: 'scissors', label: 'Scissors' }, { icon: 'pen-tool', label: 'Pen' },
        // Special Items
        { icon: 'gift', label: 'Gift' }, { icon: 'map', label: 'Map' },
        { icon: 'gem', label: 'Treasure' }, { icon: 'sword', label: 'Sword' },
        { icon: 'coins', label: 'Money' }, { icon: 'trophy', label: 'Trophy' }, 
        { icon: 'ticket', label: 'Ticket' }, { icon: 'anchor', label: 'Anchor' }, 
        { icon: 'bell', label: 'Bell' }, { icon: 'bone', label: 'Bone' }, 
        { icon: 'magnet', label: 'Magnet' }, { icon: 'flower', label: 'Flower' },
        { icon: 'crown', label: 'Crown' }, { icon: 'puzzle', label: 'Puzzle' },
        // Vehicles & Tech
        { icon: 'car', label: 'Car' }, { icon: 'bike', label: 'Bike' },
        { icon: 'mic', label: 'Microphone' }, { icon: 'headphones', label: 'Headphones' }, 
        { icon: 'radio', label: 'Radio' }, { icon: 'shopping-cart', label: 'Cart' }
    ],
    
    action: [
        // Movement
        { icon: 'footprints', label: 'Walk' }, { icon: 'zap', label: 'Run' },
        { icon: 'plane', label: 'Fly' }, { icon: 'car', label: 'Drive' },
        { icon: 'waves', label: 'Swim' }, { icon: 'arrow-up', label: 'Jump' },
        { icon: 'unlock', label: 'Escape' },
        // Communication & Feelings
        { icon: 'message-circle', label: 'Talk' }, { icon: 'heart', label: 'Love' }, 
        { icon: 'thumbs-up', label: 'Like' }, { icon: 'smile', label: 'Laugh' }, 
        { icon: 'frown', label: 'Cry' },
        // Doing Things
        { icon: 'search', label: 'Find' }, { icon: 'gift', label: 'Give' }, 
        { icon: 'utensils', label: 'Eat' }, { icon: 'droplet', label: 'Drink' },
        { icon: 'moon', label: 'Sleep' }, { icon: 'gamepad-2', label: 'Play' }, 
        { icon: 'hammer', label: 'Build' }, { icon: 'music', label: 'Sing' }, 
        { icon: 'pen-tool', label: 'Write' }, { icon: 'book-open', label: 'Read' },
        { icon: 'scissors', label: 'Cut' }, { icon: 'brush', label: 'Paint' },
        { icon: 'eye', label: 'Look' }, { icon: 'ear', label: 'Listen' },
        { icon: 'shopping-bag', label: 'Buy' }, { icon: 'trash', label: 'Throw' }
    ]
};

// True 3D Face Rotations required to face the camera
const FACE_TRANSFORMS = [
    { name: 'front', x: 0, y: 0 },
    { name: 'right', x: 0, y: -90 },
    { name: 'back', x: 0, y: -180 },
    { name: 'left', x: 0, y: 90 },
    { name: 'top', x: -90, y: 0 },
    { name: 'bottom', x: 90, y: 0 }
];

// --- AUDIO ENGINE ---
const Audio = {
    ctx: null,
    init: () => {
        if(!Audio.ctx) {
            Audio.ctx = new (window.AudioContext || window.webkitAudioContext)();
            Tone.start();
        }
    },
    playRoll: () => {
        if(!soundEnabled) return;
        Audio.init();
        const noise = new Tone.Noise("pink").toDestination();
        const filter = new Tone.AutoFilter({ frequency: "10n", baseFrequency: 200, octaves: 4 }).toDestination().start();
        noise.connect(filter);
        noise.start();
        noise.volume.rampTo(-5, 0.1);
        setTimeout(() => noise.stop(), 300);
    },
    playLand: (delay = 0) => {
        if(!soundEnabled) return;
        Audio.init();
        setTimeout(() => {
            const synth = new Tone.MembraneSynth().toDestination();
            synth.volume.value = -8;
            synth.triggerAttackRelease("C2", "32n");
        }, delay * 1000);
    }
};

// --- LOGIC ---
function getDieConfig(index, total) {
    if (total === 1) return { type: 'random', colorClass: 'text-slate-500', bgClass: 'bg-slate-100', title: 'Random' };
    if (total === 3) {
        if (index === 0) return { type: 'character', colorClass: 'text-pink', bgClass: 'bg-pink/10', title: 'Character' };
        if (index === 1) return { type: 'setting', colorClass: 'text-green', bgClass: 'bg-green/10', title: 'Setting' };
        return { type: 'object', colorClass: 'text-blue', bgClass: 'bg-blue/10', title: 'Object' };
    }
    if (total === 5) {
        if (index === 0) return { type: 'character', colorClass: 'text-pink', bgClass: 'bg-pink/10', title: 'Who' };
        if (index === 1) return { type: 'action', colorClass: 'text-orange', bgClass: 'bg-orange/10', title: 'Action' };
        if (index === 2) return { type: 'setting', colorClass: 'text-green', bgClass: 'bg-green/10', title: 'Where' };
        if (index === 3) return { type: 'object', colorClass: 'text-blue', bgClass: 'bg-blue/10', title: 'What' };
        return { type: 'character', colorClass: 'text-pink', bgClass: 'bg-pink/10', title: 'Who' };
    }
}

function getRandomItem(type) {
    let pool = type === 'random' ? [...DATA.character, ...DATA.setting, ...DATA.object, ...DATA.action] : DATA[type];
    return pool[Math.floor(Math.random() * pool.length)];
}

function createFaceHTML(item, config, faceName) {
    return `
        <div class="cube__face cube__face--${faceName} ${config.colorClass}">
            <div class="bg-slate-50 w-full h-full rounded-2xl flex flex-col items-center justify-center border-2 border-slate-100">
                <i data-lucide="${item.icon}" class="w-12 h-12 md:w-16 md:h-16 mb-2 stroke-[2.5px]"></i>
                <span class="text-sm md:text-xl font-heading font-bold uppercase tracking-wide ${showLabels ? '' : 'hidden'} label-text text-dark">${item.label}</span>
            </div>
        </div>
    `;
}

function initBoard() {
    const container = document.getElementById('dice-container');
    container.innerHTML = '';
    
    for(let i=0; i<diceCount; i++) {
        const config = getDieConfig(i, diceCount);
        let facesHTML = '';
        
        // Populate all 6 faces for true 3D
        FACE_TRANSFORMS.forEach(face => {
            const item = getRandomItem(config.type);
            facesHTML += createFaceHTML(item, config, face.name);
        });

        container.innerHTML += `
            <div class="scene">
                <div class="cube" id="cube-${i}" data-x="0" data-y="0">
                    ${facesHTML}
                </div>
            </div>
        `;
    }
    lucide.createIcons();
    updateLegend();
}

function updateLegend() {
    const legend = document.getElementById('legend');
    let html = '';
    const pill = (color, text) => `<div class="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border-2 border-dark shadow-hard-sm"><div class="w-3 h-3 rounded-full ${color} border border-dark"></div> ${text}</div>`;

    if(diceCount === 1) html = pill('bg-slate-400', 'Random');
    else if (diceCount === 3) { html += pill('bg-pink', 'Character') + pill('bg-green', 'Setting') + pill('bg-blue', 'Object'); } 
    else { html += pill('bg-pink', 'Who') + pill('bg-orange', 'Action') + pill('bg-green', 'Where') + pill('bg-blue', 'What') + pill('bg-pink', 'Who'); }
    legend.innerHTML = html;
}

function rollAll() {
    if(isRolling) return;
    isRolling = true;
    Audio.playRoll();
    
    let currentRollResults = [];

    for(let i=0; i<diceCount; i++) {
        const cube = document.getElementById(`cube-${i}`);
        const config = getDieConfig(i, diceCount);
        
        // Pick a random face to land on
        const targetFaceIndex = Math.floor(Math.random() * 6);
        const targetFace = FACE_TRANSFORMS[targetFaceIndex];
        
        // Assign a new random item to that specific face so it's always fresh
        const finalItem = getRandomItem(config.type);
        currentRollResults.push({ ...finalItem, category: config.title, color: config.colorClass });
        
        const faceElement = cube.querySelector(`.cube__face--${targetFace.name}`);
        faceElement.outerHTML = createFaceHTML(finalItem, config, targetFace.name);

        // Calculate rotations (Current + Base Target + Extra Spins)
        let currentX = parseInt(cube.getAttribute('data-x'));
        let currentY = parseInt(cube.getAttribute('data-y'));
        
        // Add wild spins (multiples of 360)
        let newX = currentX + (360 * 3) + targetFace.x - (currentX % 360);
        let newY = currentY + (360 * 3) + targetFace.y - (currentY % 360);

        cube.setAttribute('data-x', newX);
        cube.setAttribute('data-y', newY);

        const delay = i * 150; 
        
        setTimeout(() => {
            cube.style.transform = `rotateX(${newX}deg) rotateY(${newY}deg)`;
            setTimeout(() => { Audio.playLand(); }, 1500); 
        }, delay);
    }
    
    lucide.createIcons();
    
    // Save to history
    setTimeout(() => {
        saveToHistory(currentRollResults);
        isRolling = false;
    }, 1500 + (diceCount * 150));
}

function saveToHistory(rollArray) {
    rollHistory.unshift(rollArray);
    if(rollHistory.length > 10) rollHistory.pop();
    updateHistoryUI();
}

function updateHistoryUI() {
    const list = document.getElementById('history-list');
    list.innerHTML = '';
    
    rollHistory.forEach((roll, index) => {
        const rollDiv = document.createElement('div');
        rollDiv.className = 'bg-white p-4 rounded-2xl border-2 border-dark shadow-hard-sm mb-4 flex flex-wrap gap-4 items-center';
        
        const badge = `<span class="bg-dark text-white font-bold px-2 py-1 rounded-lg text-xs border border-dark">#${rollHistory.length - index}</span>`;
        
        let itemsHtml = roll.map(item => `
            <div class="flex items-center gap-2 ${item.color} bg-slate-50 px-3 py-2 rounded-xl border-2 border-slate-200">
                <i data-lucide="${item.icon}" class="w-5 h-5"></i>
                <span class="font-heading font-bold text-dark uppercase">${item.label}</span>
            </div>
        `).join('');

        rollDiv.innerHTML = `${badge} <div class="flex flex-wrap gap-2">${itemsHtml}</div>`;
        list.appendChild(rollDiv);
    });
    lucide.createIcons();
}

function toggleHistory() {
    const modal = document.getElementById('history-modal');
    const content = document.getElementById('history-content');
    
    if (modal.classList.contains('hidden')) {
        modal.classList.remove('hidden');
        // Small delay to allow display:block to apply before animating opacity
        setTimeout(() => {
            modal.classList.remove('opacity-0');
            content.classList.remove('scale-95');
        }, 10);
    } else {
        modal.classList.add('opacity-0');
        content.classList.add('scale-95');
        setTimeout(() => {
            modal.classList.add('hidden');
        }, 200);
    }
}

function setDiceCount(n) {
    diceCount = n;
    [1,3,5].forEach(num => {
        const btn = document.getElementById(`mode-${num}`);
        if (num === n) {
            btn.classList.add('bg-dark', 'text-white', 'active');
            btn.classList.remove('bg-white', 'text-dark');
        } else {
            btn.classList.remove('bg-dark', 'text-white', 'active');
            btn.classList.add('bg-white', 'text-dark');
        }
    });
    initBoard();
}

function toggleLabels() {
    showLabels = !showLabels;
    document.querySelectorAll('.label-text').forEach(el => showLabels ? el.classList.remove('hidden') : el.classList.add('hidden'));
    const btn = document.getElementById('btn-labels');
    if(showLabels) {
        btn.classList.add('bg-green', 'text-white');
        btn.classList.remove('bg-white', 'text-dark');
    } else {
        btn.classList.add('bg-white', 'text-dark');
        btn.classList.remove('bg-green', 'text-white');
    }
}

function toggleSound() {
    soundEnabled = !soundEnabled;
    const btn = document.getElementById('btn-sound');
    btn.innerHTML = soundEnabled ? '<i data-lucide="volume-2" class="w-5 h-5"></i>' : '<i data-lucide="volume-x" class="w-5 h-5"></i>';
    if(soundEnabled) btn.classList.remove('text-red-500'); else btn.classList.add('text-red-500');
    lucide.createIcons();
}

window.onload = () => {
    initBoard();
    lucide.createIcons();
};