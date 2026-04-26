// --- 1. CONFIGURATION ---
tailwind.config = {
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                pink: '#FF6B95',
                orange: '#FF8C42',
                green: '#00E676',
                blue: '#2979FF',
                dark: '#1e293b',
                surface: '#F8FAFC',
            },
            fontFamily: {
                heading: ['Fredoka', 'sans-serif'],
                body: ['Nunito', 'sans-serif'],
                mono: ['JetBrains Mono', 'monospace'],
            },
            boxShadow: {
                'hard': '4px 4px 0px 0px #1e293b',
                'hard-lg': '8px 8px 0px 0px #1e293b',
                'hard-sm': '2px 2px 0px 0px #1e293b',
            },
            animation: {
                'pop': 'pop 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards',
                'slide-up': 'slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards',
                'fade-in': 'fadeIn 0.5s ease-out forwards',
                'bounce-slight': 'bounceSlight 2s infinite',
            },
            keyframes: {
                pop: {
                    '0%': { transform: 'scale(0.95)', opacity: '0' },
                    '100%': { transform: 'scale(1)', opacity: '1' }
                },
                slideUp: {
                    '0%': { transform: 'translateY(20px)', opacity: '0' },
                    '100%': { transform: 'translateY(0)', opacity: '1' }
                },
                fadeIn: {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' }
                },
                bounceSlight: {
                    '0%, 100%': { transform: 'translateY(0)' },
                    '50%': { transform: 'translateY(-5px)' }
                }
            }
        }
    }
}

// --- 2. AUDIO ENGINE ---
const AudioEngine = {
    ctx: null,
    init: function () {
        if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    },
    playTone: function (freq, type, duration, vol = 0.1) {
        if (!this.ctx) this.init();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    },
    playFlip: function () { this.playTone(400, 'sine', 0.1, 0.05); },
    playMatch: function () {
        this.playTone(600, 'triangle', 0.1, 0.1);
        setTimeout(() => this.playTone(800, 'triangle', 0.2, 0.1), 100);
    },
    playWin: function () {
        const notes = [523.25, 659.25, 783.99, 1046.50];
        notes.forEach((n, i) => setTimeout(() => this.playTone(n, 'square', 0.3, 0.1), i * 150));
    },
};

// --- 3. DATABASE (Multi-Preset) ---
const DB_NAME = 'KlassKitMemoryDB_V3'; // Bump version for multi-preset, V2 was a single array
const STORE_NAME = 'Presets';

const dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: 'id' });
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = () => resolve(null);
});

async function getAllPresets() {
    const db = await dbPromise;
    if (!db) return [];
    return new Promise(resolve => {
        const req = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
    });
}

async function savePresetToDB(preset) {
    const db = await dbPromise;
    if (!db) return;
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(preset);
}

async function deletePresetFromDB(id) {
    const db = await dbPromise;
    if (!db) return;
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
}

// --- CLOUD SYNC HELPERS ---
let cloudSyncTimeout = null;
async function syncToCloud() {
    if (cloudSyncTimeout) clearTimeout(cloudSyncTimeout);
    cloudSyncTimeout = setTimeout(async () => {
        const presets = await getAllPresets();
        // Strip DataURLs from cloud sync to save space, but keep Supabase URLs
        const syncPresets = presets.map(p => ({
            ...p,
            pairs: (p.pairs || []).map(pair => ({
                ...pair,
                item1: { ...pair.item1, content: pair.item1.content.startsWith('http') ? pair.item1.content : (pair.item1.type === 'image' ? "" : pair.item1.content) },
                item2: { ...pair.item2, content: pair.item2.content.startsWith('http') ? pair.item2.content : (pair.item2.type === 'image' ? "" : pair.item2.content) }
            }))
        }));
        await saveProgress('card-match', { presets: syncPresets });
    }, 1000);
}

// Migration from V2 (if any)
async function migrateLegacyV2() {
    try {
        // Peek at V2
        const req = indexedDB.open('KlassKitMemoryDB_V2', 1);
        req.onsuccess = async (e) => {
            const db = e.target.result;
            if (db.objectStoreNames.contains('Configs')) {
                const tx = db.transaction('Configs', 'readonly');
                const getReq = tx.objectStore('Configs').get('pairs_v2');
                getReq.onsuccess = async () => {
                    if (getReq.result && Array.isArray(getReq.result) && getReq.result.length > 0) {
                        const legacyPreset = {
                            id: 'preset_legacy_' + Date.now(),
                            title: 'Migrated Pairs',
                            pairs: getReq.result,
                            lastAccessed: Date.now()
                        };
                        await savePresetToDB(legacyPreset);
                        // Delete legacy v2 to prevent remigrating
                        indexedDB.deleteDatabase('KlassKitMemoryDB_V2');
                        location.reload(); // Reload to pick up migrated data
                    }
                };
            }
        };
    } catch (e) { }
}

// --- 4. APP LOGIC ---
const app = {
    pairs: [],
    presetsList: [],
    activePresetId: null,
    presetToDeleteCallback: null,
    gameState: {
        active: false,
        flipped: [],
        matched: [],
        moves: 0,
        startTime: null,
        timerInterval: null
    },

    init: async function () {
        // 0. Auth Guard
        await requireAuth();

        lucide.createIcons();

        // 1. Try migration
        await migrateLegacyV2();

        // 2. Cloud Sync Load
        const cloudData = await loadProgress('card-match');
        if (cloudData && cloudData.presets) {
            // Merge/Overwrite local with cloud
            for (const p of cloudData.presets) {
                await savePresetToDB(p);
            }
        }

        // 3. Load presets from DB
        this.presetsList = await getAllPresets();

        if (this.presetsList.length === 0) {
            const defaultId = 'preset_' + Date.now();
            const defaultPreset = {
                id: defaultId,
                title: "Default Match",
                pairs: [],
                lastAccessed: Date.now()
            };
            await savePresetToDB(defaultPreset);
            this.presetsList.push(defaultPreset);
            await syncToCloud();
        }

        // Sort by last accessed descending
        this.presetsList.sort((a, b) => b.lastAccessed - a.lastAccessed);

        await this.loadPresetData(this.presetsList[0].id);
        this.renderPresetDropdown();

        this.setupEventListeners();
        this.toggleInputMode(); // Initialize helper text

        this.showModeSelection();
    },

    showModeSelection: function () {
        document.getElementById('mode-selection').classList.remove('hidden');
        document.getElementById('teacher-console').classList.add('hidden');
        document.getElementById('game-screen').classList.add('hidden');
        document.getElementById('win-modal').classList.add('hidden');
        document.getElementById('teacher-mode-btn').classList.add('invisible');
    },

    showConsole: function () {
        // Stop any running game
        if (this.gameState.timerInterval) clearInterval(this.gameState.timerInterval);
        this.gameState.active = false;

        document.getElementById('mode-selection').classList.add('hidden');
        document.getElementById('teacher-console').classList.remove('hidden');
        document.getElementById('game-screen').classList.add('hidden');
        document.getElementById('win-modal').classList.add('hidden');
        document.getElementById('teacher-mode-btn').classList.remove('invisible');
        
        lucide.createIcons();
    },

    selectMode: function (mode) {
        document.getElementById('mode-selection').classList.add('hidden');
        document.getElementById('teacher-console').classList.remove('hidden');
        document.getElementById('teacher-mode-btn').classList.remove('invisible');

        // Reset UI before switching
        const sameWordToggle = document.getElementById('single-word-mode');

        if (mode === 'text-definition') {
            this.switchTab('text');
            if (sameWordToggle) sameWordToggle.checked = false;
        } else if (mode === 'text-text') {
            this.switchTab('text');
            if (sameWordToggle) sameWordToggle.checked = true;
        } else if (mode === 'text-img') {
            this.switchTab('mixed');
        } else if (mode === 'img-img') {
            this.switchTab('image');
        }
        this.toggleInputMode();
    },

    setupEventListeners: function () {
        // Preset Dropdown
        const select = document.getElementById('presetSelect');
        if (select) {
            select.addEventListener('change', (e) => {
                this.loadPresetData(e.target.value);
            });
        }

        // Drag & Drop / File Select Wiring
        this.setupDropZone('mixed-drop', 'mixed-file');
        this.setupDropZone('img1-drop', 'img1-file');
        this.setupDropZone('img2-drop', 'img2-file');

        // Buttons
        const startBtn = document.getElementById('start-game-btn');
        if (startBtn) startBtn.onclick = () => this.startGame();
        
        const teacherBtn = document.getElementById('teacher-mode-btn');
        if (teacherBtn) teacherBtn.onclick = () => this.showConsole();
        
        const restartBtn = document.getElementById('restart-btn');
        if (restartBtn) restartBtn.onclick = () => this.restartGame();
    },

    setupDropZone: function (dropId, fileId) {
        const drop = document.getElementById(dropId);
        const file = document.getElementById(fileId);
        if (!drop || !file) return;

        file.addEventListener('change', () => {
            if (file.files && file.files[0]) {
                const name = file.files[0].name;
                const p = drop.querySelector('p');
                if (p) p.innerText = name;
                drop.classList.add('bg-blue/5', 'border-blue');
                const icon = drop.querySelector('i');
                if (icon) icon.setAttribute('data-lucide', 'check-circle');
                lucide.createIcons();
            }
        });

        drop.onclick = () => file.click();
        drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('border-blue', 'scale-[0.98]', 'bg-blue/5'); });
        drop.addEventListener('dragleave', () => {
            if (!file.files || !file.files[0]) {
                drop.classList.remove('border-blue', 'scale-[0.98]', 'bg-blue/5');
            }
        });
        drop.addEventListener('drop', (e) => {
            e.preventDefault();
            drop.classList.remove('scale-[0.98]');
            if (e.dataTransfer && e.dataTransfer.files.length > 0) {
                file.files = e.dataTransfer.files;
                file.dispatchEvent(new Event('change'));
            }
        });
    },

    resetDropZone: function (dropId, originalText, originalIcon) {
        const drop = document.getElementById(dropId);
        if (!drop) return;
        const p = drop.querySelector('p');
        if (p) p.innerText = originalText;
        const icon = drop.querySelector('i');
        if (icon) icon.setAttribute('data-lucide', originalIcon);
        drop.classList.remove('bg-blue/5', 'border-blue');
        lucide.createIcons();
    },

    switchTab: function (tabName) {
        // UI Toggles
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.add('hidden'));

        // Activate
        // Find the specific button that triggered this change
        const targetButton = document.querySelector(`.tab-btn[onclick*="app.switchTab('${tabName}')"]`);
        if (targetButton) {
            targetButton.classList.add('active');
        }
        document.getElementById(`tab-${tabName}`).classList.remove('hidden');
    },

    // --- DATA MANAGEMENT ---

    toggleInputMode: function () {
        const isSingle = document.getElementById('single-word-mode').checked;
        const input = document.getElementById('simple-input');
        const helper = document.getElementById('text-input-helper');

        if (isSingle) {
            helper.innerHTML = 'Format: One word per line (Auto-pairs with itself)';
            input.placeholder = 'Dog\nCat\nElephant';
        } else {
            helper.innerHTML = 'Format: <code>Word, Translation</code> or <code>Term, Definition</code>';
            input.placeholder = 'Dog, Anjing\nHappy, Feeling or showing pleasure';
        }
    },

    // Mode 1: Text-Text (or Text-Definition)
    addTextPairs: function () {
        const input = document.getElementById('simple-input');
        const isSingleMode = document.getElementById('single-word-mode').checked;
        const lines = input.value.split('\n').filter(l => l.trim());

        if (lines.length === 0) return;

        let addedCount = 0;
        lines.forEach(line => {
            if (this.pairs.length >= 12) return;

            let val1, val2;

            if (isSingleMode) {
                // Same Word Mode: Treat the whole line as one word
                val1 = line.trim();
                val2 = val1;
            } else {
                // Standard Pair Mode: Split by comma
                const parts = line.split(',');
                val1 = parts[0].trim();
                // If no comma, default to self (failsafe), but user intends definition
                val2 = parts[1] ? parts[1].trim() : val1;
            }

            this.pairs.push({
                id: Date.now() + Math.random(),
                type: 'text-text',
                item1: { type: 'text', content: val1 },
                item2: { type: 'text', content: val2 }
            });
            addedCount++;
        });

        if (addedCount > 0) {
            input.value = '';
            this.saveAndRender();
            this.toast(`Added ${addedCount} text pairs!`);
        } else {
            this.toast("Limit reached or empty.");
        }
    },

    // Mode 2: Text-Image
    addMixedPair: async function () {
        if (this.pairs.length >= 12) return this.toast("Max 12 pairs allowed!");

        const btn = document.querySelector('#tab-mixed button[onclick="app.addMixedPair()"]');
        const txtInput = document.getElementById('mixed-text');
        const imgInput = document.getElementById('mixed-file');
        const textVal = txtInput.value.trim();
        const file = imgInput.files[0];

        if (!textVal || !file) return this.toast("Please provide both text and image.");

        const originalHTML = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i data-lucide="loader-2" class="w-5 h-5 animate-spin"></i> UPLOADING...';
        lucide.createIcons();

        try {
            let imgSource;
            const { data: { user } } = await db.auth.getUser();
            if (!isSandbox() && user) {
                imgSource = await uploadMedia(file, 'card_match', this.activePresetId);
            } else {
                imgSource = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = (e) => resolve(e.target.result);
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                });
            }

            this.pairs.push({
                id: Date.now() + Math.random(),
                type: 'text-image',
                item1: { type: 'text', content: textVal },
                item2: { type: 'image', content: imgSource }
            });

            // Reset
            txtInput.value = '';
            imgInput.value = '';
            this.resetDropZone('mixed-drop', 'Click or drag image here', 'upload-cloud');
            this.saveAndRender();
            this.toast("Mixed pair added!");
        } catch (err) {
            console.error("Mixed Pair Add Failed:", err);
            this.toast(`Upload failed: ${err.message || 'Unknown error'}`, "error");
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalHTML;
            lucide.createIcons();
        }
    },

    // Mode 3: Image-Image
    addImagePair: async function () {
        if (this.pairs.length >= 12) return this.toast("Max 12 pairs allowed!");

        const btn = document.querySelector('#tab-image button[onclick="app.addImagePair()"]');
        const f1 = document.getElementById('img1-file').files[0];
        const f2 = document.getElementById('img2-file').files[0];

        if (!f1 || !f2) return this.toast("Please upload both images.");

        const originalHTML = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i data-lucide="loader-2" class="w-5 h-5 animate-spin"></i> UPLOADING...';
        lucide.createIcons();

        try {
            const { data: { user } } = await db.auth.getUser();
            const canUpload = !isSandbox() && user;

            const processFile = async (file) => {
                if (canUpload) return await uploadMedia(file, 'card_match', this.activePresetId);
                return await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = (e) => resolve(e.target.result);
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                });
            };

            const src1 = await processFile(f1);
            const src2 = await processFile(f2);

            this.pairs.push({
                id: Date.now() + Math.random(),
                type: 'image-image',
                item1: { type: 'image', content: src1 },
                item2: { type: 'image', content: src2 }
            });

            // Reset
            document.getElementById('img1-file').value = '';
            document.getElementById('img2-file').value = '';
            this.resetDropZone('img1-drop', 'Card 1', 'image');
            this.resetDropZone('img2-drop', 'Card 2', 'image');
            this.saveAndRender();
            this.toast("Image pair added!");
        } catch (err) {
            console.error("Image Pair Add Failed:", err);
            this.toast(`Upload failed: ${err.message || 'Unknown error'}`, "error");
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalHTML;
            lucide.createIcons();
        }
    },

    clearPairs: function () {
        this.pairs = [];
        this.saveAndRender();
        this.toast("All pairs have been cleared!", "success");
    },

    // --- PRESET MANAGEMENT ---

    renderPresetDropdown: function () {
        const select = document.getElementById('presetSelect');
        if (!select) return;
        select.innerHTML = '';
        this.presetsList.forEach(preset => {
            const opt = document.createElement('option');
            opt.value = preset.id;
            opt.textContent = preset.title;
            if (preset.id === this.activePresetId) {
                opt.selected = true;
            }
            select.appendChild(opt);
        });
    },

    loadPresetData: async function (id) {
        const preset = this.presetsList.find(p => p.id === id);
        if (!preset) return;

        this.activePresetId = id;
        this.pairs = preset.pairs || [];

        const titleInput = document.getElementById('presetTitleInput');
        if (titleInput) titleInput.value = preset.title;

        preset.lastAccessed = Date.now();
        await savePresetToDB(preset);
        await syncToCloud();

        this.renderPresetDropdown();
        this.renderPairList();
        const startBtn = document.getElementById('start-game-btn');
        if (startBtn) startBtn.disabled = this.pairs.length < 2;
    },

    saveCurrentDeck: async function () {
        const btn = document.getElementById('save-deck-btn');
        const icon = btn.querySelector('i');
        const text = btn.querySelector('span') || btn;

        try {
            await this.updatePresetTitle();
            await savePresetToDB(this.presetsList.find(p => p.id === this.activePresetId));
            await syncToCloud();

            // Success State
            btn.classList.replace('bg-blue', 'bg-green');
            const originalHTML = btn.innerHTML;
            btn.innerHTML = '<i data-lucide="check" class="w-4 h-4"></i> Saved!';
            lucide.createIcons();

            setTimeout(() => {
                btn.classList.replace('bg-green', 'bg-blue');
                btn.innerHTML = originalHTML;
                lucide.createIcons();
            }, 2000);

            this.toast("Deck saved successfully!", "success");
        } catch (err) {
            this.toast("Failed to save deck", "error");
        }
    },

    updatePresetTitle: async function () {
        const titleInput = document.getElementById('presetTitleInput');
        if (!titleInput) return;
        const newTitle = titleInput.value.trim() || 'Untitled Session';

        const preset = this.presetsList.find(p => p.id === this.activePresetId);
        if (preset && preset.title !== newTitle) {
            preset.title = newTitle;
            await savePresetToDB(preset);
            await syncToCloud();
            this.renderPresetDropdown();
            this.toast("Title saved", "success");
        }
    },

    createNewPreset: async function () {
        const id = 'preset_' + Date.now();
        const newPreset = {
            id: id,
            title: "New Session " + (this.presetsList.length + 1),
            pairs: [],
            lastAccessed: Date.now()
        };
        await savePresetToDB(newPreset);
        await syncToCloud();
        this.presetsList.push(newPreset);
        await this.loadPresetData(id);
        this.toast("New preset created!", "success");
    },

    // Confirm Modal Logic
    showConfirmModal: function (callback) {
        this.presetToDeleteCallback = callback;
        const modal = document.getElementById('confirmModal');
        const content = document.getElementById('confirmModalContent');
        if (!modal || !content) return;
        modal.classList.remove('hidden');
        requestAnimationFrame(() => {
            modal.classList.remove('opacity-0');
            content.classList.add('scale-100');
            content.classList.remove('scale-95');
        });
    },

    closeConfirmModal: function (confirmed) {
        const modal = document.getElementById('confirmModal');
        const content = document.getElementById('confirmModalContent');
        if (!modal || !content) return;
        modal.classList.add('opacity-0');
        content.classList.remove('scale-100');
        content.classList.add('scale-95');
        setTimeout(() => {
            modal.classList.add('hidden');
        }, 300);

        if (confirmed && this.presetToDeleteCallback) {
            this.presetToDeleteCallback();
        }
        this.presetToDeleteCallback = null;
    },

    executeDeletePreset: async function () {
        // Cloud Cleanup
        const { data: { user } } = await db.auth.getUser();
        if (!isSandbox() && user) {
            deleteFolder(`${user.id}/card_match/${this.activePresetId}`).catch(e => console.warn("Cloud folder delete failed", e));
        }

        await deletePresetFromDB(this.activePresetId);
        await syncToCloud();
        this.presetsList = this.presetsList.filter(p => p.id !== this.activePresetId);
        await this.loadPresetData(this.presetsList[0].id);
        this.toast("Preset deleted", "success");
    },

    deleteCurrentPreset: async function () {
        if (this.presetsList.length <= 1) {
            this.toast("Cannot delete the only preset.", "error");
            return;
        }
        this.showConfirmModal(() => this.executeDeletePreset());
    },

    saveAndRender: async function () {
        const preset = this.presetsList.find(p => p.id === this.activePresetId);
        if (preset) {
            preset.pairs = this.pairs;
            preset.lastAccessed = Date.now();
            await savePresetToDB(preset);
            await syncToCloud();
        }

        this.renderPairList();
        const startBtn = document.getElementById('start-game-btn');
        if (startBtn) startBtn.disabled = this.pairs.length < 2;
    },

    renderPairList: function () {
        const container = document.getElementById('pairs-list');
        const countBadge = document.getElementById('pair-count');
        if (!container || !countBadge) return;
        container.innerHTML = '';
        countBadge.innerText = this.pairs.length;

        if (this.pairs.length === 0) {
            container.innerHTML = `
                <div class="flex flex-col items-center justify-center py-20 text-slate-300">
                    <i data-lucide="layers-2" class="w-12 h-12 mb-4 opacity-20"></i>
                    <p class="font-bold uppercase tracking-widest text-xs">Deck is empty</p>
                </div>
            `;
            lucide.createIcons();
            return;
        }

        this.pairs.forEach((pair, idx) => {
            const div = document.createElement('div');
            div.className = 'flex items-center justify-between bg-white p-3 rounded-xl border-2 border-dark mb-3 animate-pop shadow-hard-sm';

            // Helper to render preview
            const renderItem = (item) => {
                if (item.type === 'text') return `<span class="px-2 py-1 bg-slate-50 border border-slate-100 rounded-md text-xs font-bold text-dark truncate max-w-[100px]">${item.content}</span>`;
                return `<div class="w-10 h-10 rounded-lg border border-dark overflow-hidden shadow-sm"><img src="${item.content}" class="w-full h-full object-cover"></div>`;
            };

            const icon = pair.type === 'text-text' ? 'type' : pair.type === 'image-image' ? 'copy' : 'image-plus';
            const colorClass = pair.type === 'text-text' ? 'bg-pink' : pair.type === 'image-image' ? 'bg-green' : 'bg-blue';

            div.innerHTML = `
                <div class="flex items-center gap-3">
                    <div class="${colorClass} text-white p-1.5 rounded-lg border-2 border-dark">
                        <i data-lucide="${icon}" class="w-3.5 h-3.5"></i>
                    </div>
                    <div class="flex items-center gap-2">
                        ${renderItem(pair.item1)}
                        <i data-lucide="arrow-right-left" class="w-3 h-3 text-slate-200"></i>
                        ${renderItem(pair.item2)}
                    </div>
                </div>
                <button onclick="app.removePair(${idx})" class="p-1.5 text-slate-300 hover:text-pink transition-colors">
                    <i data-lucide="x-circle" class="w-5 h-5"></i>
                </button>
            `;
            container.appendChild(div);
        });
        this.hydrateThumbnails();
        lucide.createIcons();
    },

    async hydrateThumbnails() {
        const thumbs = document.querySelectorAll('.card-preview img, #game-grid img');
        for (const img of thumbs) {
            if (img.src && img.src.includes('klasskit-media')) {
                img.src = await resolveMediaUrl(img.src);
            }
        }
    },

    removePair: function (idx) {
        const pair = this.pairs[idx];
        if (pair) {
            if (pair.item1.type === 'image' && pair.item1.content.includes('klasskit-media')) {
                deleteMediaFromUrl(pair.item1.content).catch(e => console.error("Cloud delete failed (item1)", e));
            }
            if (pair.item2.type === 'image' && pair.item2.content.includes('klasskit-media')) {
                deleteMediaFromUrl(pair.item2.content).catch(e => console.error("Cloud delete failed (item2)", e));
            }
        }
        this.pairs.splice(idx, 1);
        this.saveAndRender();
    },

    // --- GAME LOGIC ---

    startGame: async function () {
        if (this.pairs.length < 2) return this.toast("Need at least 2 pairs!");

        // Switch Screens
        document.getElementById('teacher-console').classList.add('hidden');
        document.getElementById('game-screen').classList.remove('hidden');
        document.getElementById('teacher-mode-btn').classList.add('invisible');

        // Generate Cards
        let cards = [];
        this.pairs.forEach(pair => {
            // Card A
            cards.push({
                id: pair.id + '_1',
                matchId: pair.id,
                type: pair.item1.type,
                content: pair.item1.content
            });
            // Card B
            cards.push({
                id: pair.id + '_2',
                matchId: pair.id,
                type: pair.item2.type,
                content: pair.item2.content
            });
        });

        // Resolve all images
        for (let card of cards) {
            if (card.type === 'image') card.content = await resolveMediaUrl(card.content);
        }

        // Shuffle
        cards.sort(() => Math.random() - 0.5);

        // Render Grid
        // Dynamic Grid Columns based on card count
        const grid = document.getElementById('game-grid');
        if (!grid) return;
        grid.innerHTML = '';
        grid.className = 'grid gap-3 sm:gap-6 mx-auto perspective-1000';
        
        const count = cards.length;
        if (count <= 8) {
            grid.classList.add('grid-cols-2', 'sm:grid-cols-4', 'max-w-4xl');
        } else if (count <= 12) {
            grid.classList.add('grid-cols-3', 'sm:grid-cols-4', 'max-w-5xl');
        } else if (count <= 16) {
            grid.classList.add('grid-cols-4', 'sm:grid-cols-4', 'max-w-6xl');
        } else {
            grid.classList.add('grid-cols-4', 'sm:grid-cols-6', 'max-w-full');
        }

        cards.forEach((card, index) => {
            const el = document.createElement('div');
            el.className = 'game-card';
            el.dataset.index = index;
            el.dataset.matchId = card.matchId;

            const len = card.content.length;
            // Bumped sizes significantly for better visibility
            const sizeClass = len > 60 ? 'text-xs sm:text-sm' : len > 30 ? 'text-sm sm:text-lg' : len > 12 ? 'text-xl sm:text-2xl' : 'text-3xl sm:text-4xl';
            const weightClass = 'font-black'; // Always heavy for Brutalist look
            
            if (card.type === 'image') {
                innerContent = `<div class="w-full h-full p-2"><img src="${card.content}" class="w-full h-full object-contain rounded-lg"></div>`;
            } else {
                innerContent = `<div class="w-full h-full flex items-center justify-center p-4 text-center leading-[1] overflow-hidden">
                    <span class="${sizeClass} ${weightClass} text-dark break-words uppercase font-heading tracking-tight w-full">${card.content}</span>
                </div>`;
            }

            el.innerHTML = `
                <div class="card-inner">
                    <div class="card-front">
                        <i data-lucide="sparkle" class="text-white/40 w-10 h-10 animate-pulse"></i>
                    </div>
                    <div class="card-back border-4 border-dark bg-white overflow-hidden rounded-xl shadow-inner">
                        ${innerContent}
                    </div>
                </div>
            `;

            el.onclick = () => this.handleCardClick(index);
            grid.appendChild(el);
        });

        lucide.createIcons();

        // Reset Stats
        this.gameState = {
            active: true,
            flipped: [],
            matched: [],
            moves: 0,
            startTime: Date.now(),
            timerInterval: setInterval(() => this.updateTimer(), 1000)
        };
        this.updateUI();

        // Init Audio
        AudioEngine.init();
    },

    handleCardClick: function (index) {
        const { flipped, matched, active } = this.gameState;
        const cardEl = document.querySelector(`.game-card[data-index="${index}"]`);

        if (!active) return;
        if (flipped.includes(index)) return;
        if (cardEl.classList.contains('matched')) return;
        if (flipped.length >= 2) return;

        // Flip it
        AudioEngine.playFlip();
        cardEl.classList.add('flipped');
        flipped.push(index);

        if (flipped.length === 2) {
            this.gameState.moves++;
            this.updateUI();
            this.checkMatch();
        }
    },

    checkMatch: function () {
        const [idx1, idx2] = this.gameState.flipped;
        const card1 = document.querySelector(`.game-card[data-index="${idx1}"]`);
        const card2 = document.querySelector(`.game-card[data-index="${idx2}"]`);

        const match1 = card1.dataset.matchId;
        const match2 = card2.dataset.matchId;

        if (match1 === match2) {
            AudioEngine.playMatch();
            card1.classList.add('matched');
            card2.classList.add('matched');
            this.gameState.matched.push(match1);
            this.gameState.flipped = [];

            if (this.gameState.matched.length === this.pairs.length) {
                this.handleWin();
            }
        } else {
            setTimeout(() => {
                card1.classList.remove('flipped');
                card2.classList.remove('flipped');
                this.gameState.flipped = [];
                AudioEngine.playFlip();
            }, 1000);
        }
    },

    handleWin: function () {
        clearInterval(this.gameState.timerInterval);
        AudioEngine.playWin();

        const finalTimeStr = document.getElementById('timer').innerText;
        document.getElementById('final-time').innerText = finalTimeStr;
        document.getElementById('final-moves').innerText = this.gameState.moves;

        confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, colors: ['#FF6B95', '#FF8C42', '#00E676', '#2979FF'] });

        setTimeout(() => {
            document.getElementById('win-modal').classList.remove('hidden');
        }, 500);
    },

    updateTimer: function () {
        const diff = Math.floor((Date.now() - this.gameState.startTime) / 1000);
        const m = Math.floor(diff / 60).toString().padStart(2, '0');
        const s = (diff % 60).toString().padStart(2, '0');
        const timerEl = document.getElementById('timer');
        if (timerEl) timerEl.innerText = `${m}:${s}`;
    },

    updateUI: function () {
        const movesEl = document.getElementById('moves');
        if (movesEl) movesEl.innerText = this.gameState.moves;
    },

    restartGame: function () {
        document.getElementById('win-modal').classList.add('hidden');
        clearInterval(this.gameState.timerInterval);
        this.startGame();
    },

    showConsole: function () {
        document.getElementById('win-modal').classList.add('hidden');
        document.getElementById('game-screen').classList.add('hidden');
        document.getElementById('teacher-console').classList.remove('hidden');
        document.getElementById('teacher-mode-btn').classList.remove('invisible');
        clearInterval(this.gameState.timerInterval);
    },

    toast: function (msg, type = 'info') {
        const el = document.getElementById('toast');
        const txt = document.getElementById('toast-msg');
        if (!el || !txt) return;
        const container = el.querySelector('.flex.items-center.gap-3');

        // Remove existing icon (i or svg replaced by Lucide)
        const oldIcon = container.querySelector('i, svg');
        if (oldIcon && oldIcon !== txt) oldIcon.remove();

        // Create new i tag for Lucide
        const icon = document.createElement('i');
        txt.innerText = msg;

        if (type === 'success') {
            icon.setAttribute('data-lucide', 'check-circle');
            icon.className = 'w-5 h-5 text-green';
        } else if (type === 'error') {
            icon.setAttribute('data-lucide', 'alert-circle');
            icon.className = 'w-5 h-5 text-pink';
        } else {
            icon.setAttribute('data-lucide', 'info');
            icon.className = 'w-5 h-5 text-blue';
        }

        container.prepend(icon);
        lucide.createIcons();

        el.classList.remove('opacity-0', 'translate-y-24');
        setTimeout(() => el.classList.add('opacity-0', 'translate-y-24'), 3000);
    }
};

window.addEventListener('load', () => app.init());
