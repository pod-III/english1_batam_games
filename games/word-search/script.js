// Audio Context
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

const playTone = (freq, type, duration) => {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
};

const Sound = {
    tap: () => playTone(600, 'sine', 0.1),
    success: () => {
        playTone(500, 'triangle', 0.1);
        setTimeout(() => playTone(1000, 'triangle', 0.2), 100);
    },
    error: () => playTone(150, 'sawtooth', 0.2),
    win: () => [400, 500, 600, 800].forEach((f, i) => setTimeout(() => playTone(f, 'square', 0.2), i * 100))
};

// --- TOAST NOTIFICATIONS ---
function showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    const colors = {
        success: 'bg-green border-dark text-dark',
        error: 'bg-pink border-dark text-white',
        info: 'bg-blue border-dark text-white',
        warning: 'bg-orange border-dark text-white'
    };

    toast.className = `${colors[type] || colors.info} px-4 py-3 rounded-lg border-2 shadow-hard font-bold text-sm flex items-center gap-2 min-w-[200px] animate-pop`;
    toast.innerHTML = `<span>${escapeHtml(message)}</span>`;

    container.appendChild(toast);
    
    // Refresh icons for dynamically added content
    if (window.lucide) {
        lucide.createIcons();
    }

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// --- CONFIRM TOAST ---
function showConfirmToast(message, onConfirm, onCancel) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'bg-white border-2 border-dark px-4 py-3 rounded-lg shadow-hard min-w-[280px] animate-pop';
    toast.innerHTML = `
        <p class="font-bold text-dark text-sm mb-3">${escapeHtml(message)}</p>
        <div class="flex gap-2">
            <button id="confirm-yes" class="flex-1 bg-pink text-white py-2 rounded border-2 border-dark font-bold text-xs hover:brightness-110 transition">YES</button>
            <button id="confirm-no" class="flex-1 bg-gray-200 text-dark py-2 rounded border-2 border-dark font-bold text-xs hover:brightness-110 transition">NO</button>
        </div>
    `;

    container.appendChild(toast);

    toast.querySelector('#confirm-yes').onclick = () => {
        toast.remove();
        if (onConfirm) onConfirm();
    };

    toast.querySelector('#confirm-no').onclick = () => {
        toast.remove();
        if (onCancel) onCancel();
    };
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    if (typeof text !== 'string') return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Init Icons after DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
});

// --- LOCAL STORAGE KEYS ---
const LS_KEY_WORDS = 'wordSearchWords_E1';
const LS_KEY_SIZE = 'wordSearchSize_E1';

// --- INDEXEDDB ---
const DB_NAME = 'WordSearchDB';
const DB_VERSION = 2; // Bumped for saved puzzles
const STORE_PRESETS = 'presets';
const STORE_SETTINGS = 'settings';
const STORE_PUZZLES = 'savedPuzzles'; // New: store generated puzzles

let db = null;
let currentPresetId = null;
let currentSavedPuzzleId = null;

function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = (event) => {
            const database = event.target.result;
            if (!database.objectStoreNames.contains(STORE_PRESETS)) {
                const presetsStore = database.createObjectStore(STORE_PRESETS, { keyPath: 'id', autoIncrement: true });
                presetsStore.createIndex('name', 'name', { unique: false });
                presetsStore.createIndex('updatedAt', 'updatedAt', { unique: false });
            }
            if (!database.objectStoreNames.contains(STORE_SETTINGS)) {
                database.createObjectStore(STORE_SETTINGS, { keyPath: 'key' });
            }
            if (!database.objectStoreNames.contains(STORE_PUZZLES)) {
                const puzzlesStore = database.createObjectStore(STORE_PUZZLES, { keyPath: 'id', autoIncrement: true });
                puzzlesStore.createIndex('name', 'name', { unique: false });
                puzzlesStore.createIndex('updatedAt', 'updatedAt', { unique: false });
            }
        };
    });
}

async function initDB() {
    try {
        db = await openDB();
        await migrateFromLocalStorage();
    } catch (e) {
        console.error('Failed to initialize IndexedDB:', e);
        showToast('Storage unavailable. Some features may not work.', 'warning');
    }
}

async function migrateFromLocalStorage() {
    const savedWords = localStorage.getItem(LS_KEY_WORDS);
    const savedSize = localStorage.getItem(LS_KEY_SIZE);
    if (savedWords || savedSize) {
        const data = { words: savedWords || '', size: savedSize || '10' };
        await savePreset('Default', data);
        localStorage.removeItem(LS_KEY_WORDS);
        localStorage.removeItem(LS_KEY_SIZE);
    }
}

async function savePreset(name, data, id = null) {
    if (!db) throw new Error('Database not initialized');
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_PRESETS, 'readwrite');
        tx.onerror = () => reject(tx.error);
        const store = tx.objectStore(STORE_PRESETS);
        const preset = { name, data: JSON.parse(JSON.stringify(data)), updatedAt: Date.now() };
        if (id) preset.id = id;
        const request = id ? store.put(preset) : store.add(preset);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function getAllPresets() {
    if (!db) return [];
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_PRESETS, 'readonly');
        const store = tx.objectStore(STORE_PRESETS);
        const index = store.index('updatedAt');
        const request = index.getAll();
        request.onsuccess = () => resolve(request.result.reverse());
        request.onerror = () => reject(request.error);
    });
}

async function getPreset(id) {
    if (!db) return null;
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_PRESETS, 'readonly');
        const store = tx.objectStore(STORE_PRESETS);
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function deletePreset(id) {
    if (!db) throw new Error('Database not initialized');
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_PRESETS, 'readwrite');
        tx.onerror = () => reject(tx.error);
        const store = tx.objectStore(STORE_PRESETS);
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

async function saveCurrentPresetId(id) {
    if (!db) throw new Error('Database not initialized');
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_SETTINGS, 'readwrite');
        tx.onerror = () => reject(tx.error);
        const store = tx.objectStore(STORE_SETTINGS);
        const request = store.put({ key: 'currentPresetId', value: id });
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

async function getCurrentPresetId() {
    if (!db) return null;
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_SETTINGS, 'readonly');
        const store = tx.objectStore(STORE_SETTINGS);
        const request = store.get('currentPresetId');
        request.onsuccess = () => resolve(request.result?.value || null);
        request.onerror = () => reject(request.error);
    });
}

async function renderPresetSelector() {
    const presets = await getAllPresets();
    const select = document.getElementById('userPresetSelect');
    if (!select) return;
    select.innerHTML = '<option value="">-- Select a Preset --</option>';
    presets.forEach(p => {
        const option = document.createElement('option');
        option.value = p.id;
        option.textContent = p.name;
        if (p.id === currentPresetId) option.selected = true;
        select.appendChild(option);
    });
}

async function onUserPresetSelect() {
    const select = document.getElementById('userPresetSelect');
    const id = parseInt(select.value);
    if (!id && id !== 0) return;
    const preset = await getPreset(id);
    if (preset) {
        currentPresetId = id;
        DOM.input.value = preset.data.words || '';
        DOM.slider.value = preset.data.size || '10';
        DOM.sizeDisp.innerText = `${DOM.slider.value}x${DOM.slider.value}`;
        document.getElementById('userPresetNameInput').value = preset.name;
        await saveCurrentPresetId(id);
        await renderPresetSelector();
    }
}

async function saveCurrentUserPreset() {
    try {
        const name = document.getElementById('userPresetNameInput').value.trim() || 'Untitled';
        const data = { words: DOM.input.value, size: DOM.slider.value };
        const id = await savePreset(name, data, currentPresetId);
        currentPresetId = id;
        await saveCurrentPresetId(id);
        await renderPresetSelector();
        showToast('Preset saved!', 'success');
    } catch (e) {
        showToast('Failed to save preset', 'error');
    }
}

async function createNewUserPreset() {
    document.getElementById('userPresetNameInput').value = 'New Preset';
    DOM.input.value = '';
    DOM.slider.value = '10';
    DOM.sizeDisp.innerText = '10x10';
    currentPresetId = null;
    await saveCurrentPresetId(null);
    await renderPresetSelector();
    document.getElementById('userPresetSelect').value = '';
}

async function deleteCurrentUserPreset() {
    if (!currentPresetId) {
        showToast('No preset selected to delete.', 'error');
        return;
    }
    showConfirmToast('Delete this preset?', async () => {
        await deletePreset(currentPresetId);
        currentPresetId = null;
        document.getElementById('userPresetNameInput').value = '';
        await saveCurrentPresetId(null);
        await renderPresetSelector();
        document.getElementById('userPresetSelect').value = '';
        showToast('Preset deleted!', 'success');
    });
}

// --- SAVED PUZZLES (Generated Grids) ---
async function getAllSavedPuzzles() {
    if (!db) return [];
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_PUZZLES, 'readonly');
        const store = tx.objectStore(STORE_PUZZLES);
        const index = store.index('updatedAt');
        const request = index.getAll();
        request.onsuccess = () => resolve(request.result.reverse());
        request.onerror = () => reject(request.error);
    });
}

async function saveGeneratedPuzzle(name, puzzleData, id = null) {
    if (!db) throw new Error('Database not initialized');
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_PUZZLES, 'readwrite');
        tx.onerror = () => reject(tx.error);
        const store = tx.objectStore(STORE_PUZZLES);
        const puzzle = { name, data: JSON.parse(JSON.stringify(puzzleData)), updatedAt: Date.now() };
        if (id) puzzle.id = id;
        const request = id ? store.put(puzzle) : store.add(puzzle);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function getSavedPuzzle(id) {
    if (!db) return null;
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_PUZZLES, 'readonly');
        const store = tx.objectStore(STORE_PUZZLES);
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function deleteSavedPuzzle(id) {
    if (!db) throw new Error('Database not initialized');
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_PUZZLES, 'readwrite');
        tx.onerror = () => reject(tx.error);
        const store = tx.objectStore(STORE_PUZZLES);
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

async function renderSavedPuzzleSelector() {
    const puzzles = await getAllSavedPuzzles();
    const selects = document.querySelectorAll('#savedPuzzleSelect, #savedPuzzleSelectEmpty, #savedPuzzleSelectModal');
    selects.forEach(select => {
        if (!select) return;
        select.innerHTML = '<option value="">-- Select a Saved Puzzle --</option>';
        puzzles.forEach(p => {
            const option = document.createElement('option');
            option.value = p.id;
            option.textContent = p.name;
            if (p.id === currentSavedPuzzleId) option.selected = true;
            select.appendChild(option);
        });
    });
}

async function loadSelectedPuzzle(selectId) {
    const select = document.getElementById(selectId);
    const id = parseInt(select.value);
    if (!id && id !== 0) {
        showToast('Please select a puzzle first!', 'warning');
        return;
    }
    const puzzle = await getSavedPuzzle(id);
    if (puzzle) {
        currentSavedPuzzleId = id;
        loadSavedPuzzle(puzzle.data);
        const nameInput = document.getElementById('savedPuzzleNameInput');
        if (nameInput) nameInput.value = puzzle.name;
        await renderSavedPuzzleSelector();
        showToast('Puzzle loaded!', 'success');
    }
}

function toggleSavedPuzzleControls() {
    const controls = document.getElementById('saved-puzzle-controls');
    const icon = document.getElementById('saved-puzzle-toggle-icon');
    if (controls && icon) {
        controls.classList.toggle('collapsed');
        icon.classList.toggle('rotated');
    }
}

async function saveCurrentPuzzle() {
    if (!State.grid.length) {
        showToast('No puzzle to save. Generate a puzzle first!', 'error');
        return;
    }
    try {
        const name = document.getElementById('savedPuzzleNameInput').value.trim() || `Puzzle ${new Date().toLocaleDateString()}`;
        const puzzleData = {
            grid: State.grid.map(row => [...row]), // Deep copy grid
            solutions: Array.from(State.solutions),
            validWords: Array.from(State.validWords),
            totalWords: State.totalWords,
            size: State.grid.length
        };
        const id = await saveGeneratedPuzzle(name, puzzleData, currentSavedPuzzleId);
        currentSavedPuzzleId = id;
        await renderSavedPuzzleSelector();
        showToast('Puzzle saved!', 'success');
    } catch (e) {
        showToast('Failed to save puzzle', 'error');
    }
}

async function createNewSavedPuzzle() {
    const nameInput = document.getElementById('savedPuzzleNameInput');
    if (nameInput) {
        nameInput.value = `Puzzle ${new Date().toLocaleDateString()}`;
    }
    currentSavedPuzzleId = null;
    const selects = document.querySelectorAll('#savedPuzzleSelect, #savedPuzzleSelectEmpty');
    selects.forEach(s => { if (s) s.value = ''; });
    // Clear current game
    State.grid = [];
    State.solutions.clear();
    State.validWords.clear();
    State.foundWords.clear();
    DOM.grid.innerHTML = '';
    DOM.bank.innerHTML = '';
    DOM.emptyStateCta.classList.remove('hidden');
    DOM.controls.classList.add('hidden');
}

async function deleteCurrentSavedPuzzle() {
    if (!currentSavedPuzzleId) {
        showToast('No saved puzzle selected to delete.', 'error');
        return;
    }
    showConfirmToast('Delete this saved puzzle?', async () => {
        await deleteSavedPuzzle(currentSavedPuzzleId);
        currentSavedPuzzleId = null;
        const nameInput = document.getElementById('savedPuzzleNameInput');
        if (nameInput) nameInput.value = '';
        await renderSavedPuzzleSelector();
        const selects = document.querySelectorAll('#savedPuzzleSelect, #savedPuzzleSelectEmpty');
        selects.forEach(s => { if (s) s.value = ''; });
        showToast('Saved puzzle deleted!', 'success');
    });
}

function loadSavedPuzzle(data) {
    State.grid = data.grid;
    State.solutions = new Set(data.solutions);
    State.validWords = new Set(data.validWords);
    State.foundWords.clear();
    State.isActive = true;
    State.selectionStart = null;
    State.totalWords = data.totalWords;

    DOM.emptyStateCta.classList.add('hidden');
    DOM.controls.classList.remove('hidden');

    renderGrid(data.size);
    renderWordBank(Array.from(State.validWords));
    updateHUD();
    DOM.statusBar.innerText = "Tap First Letter ➔ Tap Last Letter";
    DOM.statusBar.className = "text-center text-sm font-bold text-blue bg-blue/10 border-2 border-blue px-3 py-2 rounded-lg";
    DOM.playAgain.classList.add('hidden');
}
// --- END SAVED PUZZLES ---

// State Management
const State = {
    grid: [],
    solutions: new Set(),
    validWords: new Set(),
    foundWords: new Set(),
    selectionStart: null,
    isActive: false,
    totalWords: 0
};

// DOM Elements
const DOM = {
    grid: document.getElementById('word-grid'),
    bank: document.getElementById('word-bank'),
    input: document.getElementById('word-input'),
    slider: document.getElementById('size-slider'),
    sizeDisp: document.getElementById('size-display'),
    foundCount: document.getElementById('found-count'),
    totalCount: document.getElementById('total-count'),
    statusBar: document.getElementById('status-bar'),
    playAgain: document.getElementById('play-again-btn'),
    modals: {
        setup: document.getElementById('setup-modal'),
        confirm: document.getElementById('confirm-modal')
    },
    controls: document.getElementById('play-controls'),
    emptyStateCta: document.getElementById('empty-state-cta'),
    emptyBankMsg: document.getElementById('empty-bank-msg')
};

// --- PERSISTENCE ---
async function saveInputs() {
    if (!currentPresetId) return;
    const data = { words: DOM.input.value, size: DOM.slider.value };
    await savePreset(document.getElementById('userPresetNameInput').value.trim() || 'Untitled', data, currentPresetId);
}

async function loadInputs() {
    await initDB();
    const savedId = await getCurrentPresetId();
    const presets = await getAllPresets();
    if (savedId && presets.find(p => p.id === savedId)) {
        currentPresetId = savedId;
        const preset = await getPreset(savedId);
        if (preset) {
            DOM.input.value = preset.data.words || '';
            DOM.slider.value = preset.data.size || '10';
            DOM.sizeDisp.innerText = `${DOM.slider.value}x${DOM.slider.value}`;
            document.getElementById('userPresetNameInput').value = preset.name;
        }
    } else if (presets.length > 0) {
        currentPresetId = presets[0].id;
        DOM.input.value = presets[0].data.words || '';
        DOM.slider.value = presets[0].data.size || '10';
        DOM.sizeDisp.innerText = `${DOM.slider.value}x${DOM.slider.value}`;
        document.getElementById('userPresetNameInput').value = presets[0].name;
        await saveCurrentPresetId(currentPresetId);
    }
}

// --- SETUP HANDLERS ---
document.getElementById('setup-btn').onclick = () => DOM.modals.setup.classList.remove('hidden');
document.getElementById('close-setup').onclick = () => DOM.modals.setup.classList.add('hidden');

DOM.slider.oninput = (e) => {
    const val = e.target.value;
    DOM.sizeDisp.innerText = `${val}x${val}`;
    saveInputs();
};

DOM.input.oninput = () => saveInputs();

document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.onclick = (e) => {
        DOM.input.value = e.target.dataset.words;
        saveInputs();
    };
});

document.getElementById('generate-btn').onclick = () => {
    const raw = DOM.input.value;
    const size = parseInt(DOM.slider.value);
    saveCurrentUserPreset();

    const words = raw.split(',')
        .map(w => w.trim().toUpperCase())
        .filter(w => w.length > 0 && w.length <= size);

    const uniqueWords = [...new Set(words)];

    if (uniqueWords.length < 1) {
        showToast('Please enter valid words that fit in the grid.', 'error');
        return;
    }

    initGame(size, uniqueWords);
    DOM.modals.setup.classList.add('hidden');
};

// --- GAME CORE ---
function initGame(size, words) {
    State.grid = Array(size).fill(null).map(() => Array(size).fill(''));
    State.solutions.clear();
    State.validWords = new Set();
    State.foundWords.clear();
    State.isActive = true;
    State.selectionStart = null;
    State.totalWords = 0;

    words.sort((a, b) => b.length - a.length);

    const placedWords = [];
    words.forEach(word => {
        if (placeWordInGrid(word, size)) {
            placedWords.push(word);
            State.validWords.add(word);
        }
    });
    State.totalWords = placedWords.length;

    DOM.emptyStateCta.classList.add('hidden');
    DOM.controls.classList.remove('hidden');

    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
            if (State.grid[r][c] === '') {
                State.grid[r][c] = alphabet[Math.floor(Math.random() * alphabet.length)];
            }
        }
    }

    renderGrid(size);
    renderWordBank(placedWords);
    updateHUD();

    Sound.success(); // Using success sound as start sound
    confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 }, colors: ['#2979FF', '#FF6B95', '#FF8C42'] });
}

function placeWordInGrid(word, size) {
    const directions = [
        { r: 0, c: 1 }, { r: 1, c: 0 }, { r: 1, c: 1 }, { r: -1, c: 1 },
        { r: 0, c: -1 }, { r: -1, c: 0 }, { r: -1, c: -1 }, { r: 1, c: -1 }
    ];

    for (let attempt = 0; attempt < 100; attempt++) {
        const dir = directions[Math.floor(Math.random() * directions.length)];
        const startR = Math.floor(Math.random() * size);
        const startC = Math.floor(Math.random() * size);

        const endR = startR + (dir.r * (word.length - 1));
        const endC = startC + (dir.c * (word.length - 1));
        if (endR < 0 || endR >= size || endC < 0 || endC >= size) continue;

        let collision = false;
        for (let i = 0; i < word.length; i++) {
            const r = startR + (dir.r * i);
            const c = startC + (dir.c * i);
            const cell = State.grid[r][c];
            if (cell !== '' && cell !== word[i]) {
                collision = true; break;
            }
        }

        if (!collision) {
            for (let i = 0; i < word.length; i++) {
                const r = startR + (dir.r * i);
                const c = startC + (dir.c * i);
                State.grid[r][c] = word[i];
                State.solutions.add(`${r},${c}`);
            }
            return true;
        }
    }
    return false;
}

function renderGrid(size) {
    DOM.grid.style.gridTemplateColumns = `repeat(${size}, minmax(0, 1fr))`;
    DOM.grid.innerHTML = '';

    // Font scaling based on grid density
    const baseSize = size > 12 ? 'text-sm' : (size > 8 ? 'text-lg' : 'text-xl');

    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
            const cell = document.createElement('div');
            cell.className = `grid-cell aspect-square ${baseSize}`;
            cell.innerText = State.grid[r][c];
            cell.dataset.r = r;
            cell.dataset.c = c;

            cell.onmousedown = () => handleInput(r, c, cell);
            cell.ontouchstart = (e) => { e.preventDefault(); handleInput(r, c, cell); };
            cell.ontouchmove = (e) => {
                e.preventDefault();
                const touch = e.touches[0];
                const target = document.elementFromPoint(touch.clientX, touch.clientY);
                if (target && target.classList.contains('grid-cell')) {
                    const r = parseInt(target.dataset.r);
                    const c = parseInt(target.dataset.c);
                    handleHover(r, c);
                }
            };
            cell.onmouseenter = () => handleHover(r, c);

            DOM.grid.appendChild(cell);
        }
    }
}

function renderWordBank(words) {
    DOM.bank.innerHTML = '';
    if (words.length === 0) {
        DOM.emptyBankMsg.classList.remove('hidden');
        return;
    }
    DOM.emptyBankMsg.classList.add('hidden');

    words.sort().forEach(w => {
        const tag = document.createElement('div');
        tag.className = 'word-tag px-3 py-1 bg-gray-100 border-2 border-dark rounded text-sm font-bold text-gray-500';
        tag.innerText = w;
        tag.id = `tag-${w}`;
        DOM.bank.appendChild(tag);
    });
}

function updateHUD() {
    DOM.foundCount.innerText = State.foundWords.size;
    DOM.totalCount.innerText = State.totalWords;

    if (State.foundWords.size === State.totalWords) {
        endGame(true);
    }
}

// --- INTERACTION LOGIC ---
function handleInput(r, c, el) {
    if (!State.isActive || el.classList.contains('locked')) return;

    if (!State.selectionStart) {
        State.selectionStart = { r, c, el };
        el.classList.add('active-start');
        Sound.tap();
        return;
    }

    if (State.selectionStart.r === r && State.selectionStart.c === c) {
        clearSelection();
        return;
    }
    checkMatch(State.selectionStart, { r, c, el });
}

function handleHover(r, c) {
    if (!State.selectionStart || !State.isActive) return;
    document.querySelectorAll('.preview-line').forEach(el => el.classList.remove('preview-line'));
    const path = getLineCells(State.selectionStart, { r, c });
    if (path) {
        path.forEach(pos => {
            const cell = getCell(pos.r, pos.c);
            if (cell && !cell.classList.contains('found')) {
                cell.classList.add('preview-line');
            }
        });
    }
}

function checkMatch(start, end) {
    const path = getLineCells(start, end);

    if (!path) {
        Sound.error();
        end.el.classList.add('error');
        setTimeout(() => end.el.classList.remove('error'), 400);
        clearSelection();
        return;
    }

    const word = path.map(p => State.grid[p.r][p.c]).join('');
    const reversed = word.split('').reverse().join('');

    let match = null;
    if (State.validWords.has(word) && !State.foundWords.has(word)) match = word;
    else if (State.validWords.has(reversed) && !State.foundWords.has(reversed)) match = reversed;

    if (match) {
        Sound.success();
        path.forEach((p, i) => {
            const cell = getCell(p.r, p.c);
            setTimeout(() => cell.classList.add('found'), i * 30);
        });

        document.getElementById(`tag-${match}`).classList.add('found');
        State.foundWords.add(match);
        updateHUD();
        clearSelection();
    } else {
        Sound.error();
        path.forEach(p => {
            const cell = getCell(p.r, p.c);
            cell.classList.add('error');
            setTimeout(() => cell.classList.remove('error'), 400);
        });
        clearSelection();
    }
}

function getLineCells(start, end) {
    const dr = end.r - start.r;
    const dc = end.c - start.c;
    if (dr !== 0 && dc !== 0 && Math.abs(dr) !== Math.abs(dc)) return null;

    const steps = Math.max(Math.abs(dr), Math.abs(dc));
    const rStep = dr === 0 ? 0 : dr / steps;
    const cStep = dc === 0 ? 0 : dc / steps;

    const path = [];
    for (let i = 0; i <= steps; i++) {
        path.push({ r: start.r + (rStep * i), c: start.c + (cStep * i) });
    }
    return path;
}

function getCell(r, c) {
    return document.querySelector(`.grid-cell[data-r="${r}"][data-c="${c}"]`);
}

function clearSelection() {
    if (State.selectionStart) {
        State.selectionStart.el.classList.remove('active-start');
        State.selectionStart = null;
    }
    document.querySelectorAll('.preview-line').forEach(el => el.classList.remove('preview-line'));
}

// --- GAME OVER ---
document.getElementById('give-up-btn').onclick = () => {
    if (!State.isActive) return;
    DOM.modals.confirm.classList.remove('hidden');
};

document.getElementById('cancel-reveal').onclick = () => DOM.modals.confirm.classList.add('hidden');

document.getElementById('confirm-reveal').onclick = () => {
    DOM.modals.confirm.classList.add('hidden');
    endGame(false);
};

document.getElementById('play-again-btn').onclick = () => document.getElementById('setup-btn').click();

function endGame(won) {
    State.isActive = false;

    if (won) {
        Sound.win();
        confetti({ particleCount: 200, spread: 100, origin: { y: 0.6 }, colors: ['#00E676', '#2979FF', '#FF6B95'] });
        DOM.statusBar.innerText = "YOU WON! AMAZING WORK!";
        DOM.statusBar.className = "text-center text-sm font-bold text-green bg-green/10 border-2 border-green px-3 py-2 rounded-lg";
    } else {
        Sound.error();
        DOM.statusBar.innerText = "GAME OVER - ANSWERS REVEALED";
        DOM.statusBar.className = "text-center text-sm font-bold text-orange bg-orange/10 border-2 border-orange px-3 py-2 rounded-lg";

        document.querySelectorAll('.grid-cell').forEach(cell => {
            const key = `${cell.dataset.r},${cell.dataset.c}`;
            if (State.solutions.has(key) && !cell.classList.contains('found')) {
                cell.classList.add('revealed');
            }
            cell.classList.add('locked');
        });
    }

    DOM.playAgain.classList.remove('hidden');
    clearSelection();
}

// --- INIT ---
window.onload = async () => {
    await loadInputs();
    await renderPresetSelector();
    await renderSavedPuzzleSelector();
    DOM.controls.classList.add('hidden');
    DOM.emptyStateCta.classList.remove('hidden');
    DOM.modals.setup.classList.remove('hidden');
};
