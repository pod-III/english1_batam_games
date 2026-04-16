/**
 * INDEXED DB MANAGER
 * Handles persistence of Presets (contains images, state, etc.)
 * Migrates from V1 MysteryBoxDB to V2 KlassKitRevealDB
 */
const DB = {
    dbName: 'KlassKitRevealDB',
    dbVersion: 1,
    db: null,

    init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('Presets')) {
                    const store = db.createObjectStore('Presets', { keyPath: 'id' });
                    store.createIndex('lastAccessed', 'lastAccessed', { unique: false });
                }
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve(this.db);
            };

            request.onerror = (event) => {
                console.error("IDB Error:", event.target.error);
                reject(event.target.error);
            };
        });
    },

    async getAllPresets() {
        if (!this.db) await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['Presets'], 'readonly');
            const store = transaction.objectStore('Presets');
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    async savePreset(preset) {
        if (!this.db) await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['Presets'], 'readwrite');
            const store = transaction.objectStore('Presets');
            const request = store.put(preset);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    },

    async deletePreset(id) {
        if (!this.db) await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['Presets'], 'readwrite');
            const store = transaction.objectStore('Presets');
            const request = store.delete(id);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    },

    // Legacy Migration Helper
    migrateLegacyDB() {
        return new Promise((resolve) => {
            const request = indexedDB.open('MysteryBoxDB', 1);

            request.onsuccess = (event) => {
                const legacyDb = event.target.result;
                if (!legacyDb.objectStoreNames.contains('images')) {
                    legacyDb.close();
                    resolve(null);
                    return;
                }

                const transaction = legacyDb.transaction(['images'], 'readonly');
                const store = transaction.objectStore('images');
                const getAllRequest = store.getAll();

                getAllRequest.onsuccess = () => {
                    const results = getAllRequest.result;
                    legacyDb.close();
                    if (results && results.length > 0) {
                        resolve(results.map(item => item.data));
                    } else {
                        resolve(null);
                    }
                };

                getAllRequest.onerror = () => {
                    legacyDb.close();
                    resolve(null);
                };
            };

            request.onerror = () => resolve(null);

            // If it doesn't exist, it will trigger upgradeneeded, meaning no legacy data
            request.onupgradeneeded = (event) => {
                event.target.transaction.abort();
                resolve(null);
            }
        });
    }
};

/**
 * APP STATE & PRESET MANAGER
 */
const app = {
    presets: [],
    activePresetId: null,

    async init() {
        try {
            await DB.init();
            let storedPresets = await DB.getAllPresets();

            if (!storedPresets || storedPresets.length === 0) {
                // Attempt Legacy Migration
                const legacyImages = await DB.migrateLegacyDB();
                let defaultImages = [];
                let title = "Default Game";

                if (legacyImages && legacyImages.length > 0) {
                    defaultImages = legacyImages;
                    title = "Migrated Offline DB";
                    UI.showToast("Migrated legacy images!", "info");
                }

                const defaultPreset = {
                    id: 'preset_' + Date.now(),
                    title: title,
                    images: defaultImages,
                    currentIndex: 0,
                    gridSize: 4,
                    lastAccessed: Date.now()
                };

                await DB.savePreset(defaultPreset);
                storedPresets = [defaultPreset];
            }

            // Sort by last accessed
            this.presets = storedPresets.sort((a, b) => b.lastAccessed - a.lastAccessed);

            // Recover last active if exists
            const savedActiveId = localStorage.getItem('mb_active_preset_id');
            let targetPreset = this.presets.find(p => p.id === savedActiveId);

            if (!targetPreset) targetPreset = this.presets[0];

            this.activePresetId = targetPreset.id;

            this.renderPresetDropdown();
            this.loadPresetData(targetPreset);

        } catch (e) {
            console.error("App Init Error:", e);
            UI.showToast("Failed to initialize database", "error");
        }
    },

    renderPresetDropdown() {
        const selector = document.getElementById('preset-selector');
        selector.innerHTML = this.presets.map(p =>
            `<option value="${p.id}" ${p.id === this.activePresetId ? 'selected' : ''}>${p.title}</option>`
        ).join('');
    },

    loadPresetData(preset) {
        this.activePresetId = preset.id;
        document.getElementById('preset-title').value = preset.title;

        // Update timestamp
        preset.lastAccessed = Date.now();
        DB.savePreset(preset);

        localStorage.setItem('mb_active_preset_id', preset.id);

        // Load Game State
        Game.gridSize = preset.gridSize || 4;
        document.getElementById('grid-slider').value = Game.gridSize;
        document.getElementById('grid-val').textContent = `${Game.gridSize} x ${Game.gridSize}`;

        Game.images = preset.images || [];
        Game.currentIndex = preset.currentIndex || 0;

        if (Game.images.length > 0) {
            // Bounds check
            if (Game.currentIndex >= Game.images.length) Game.currentIndex = 0;
            document.getElementById('empty-state').style.display = 'none';
            Game.loadLevel();
        } else {
            document.getElementById('empty-state').style.display = 'flex';
            document.getElementById('target-image').src = "";
            document.getElementById('tile-grid').innerHTML = '';
            document.getElementById('round-display').textContent = "0 / 0";
            document.getElementById('next-round-btn').disabled = true;
            UI.updateCount(0);
        }
    },

    async saveCurrentState() {
        if (!this.activePresetId) return;
        const presetIndex = this.presets.findIndex(p => p.id === this.activePresetId);
        if (presetIndex === -1) return;

        const preset = this.presets[presetIndex];
        preset.images = Game.images;
        preset.currentIndex = Game.currentIndex;
        preset.gridSize = Game.gridSize;
        preset.lastAccessed = Date.now();

        await DB.savePreset(preset);
    },

    async switchPreset(id) {
        const preset = this.presets.find(p => p.id === id);
        if (preset) {
            this.loadPresetData(preset);
        }
    },

    async createNewPreset() {
        const newPreset = {
            id: 'preset_' + Date.now(),
            title: `New Session ${this.presets.length + 1}`,
            images: [],
            currentIndex: 0,
            gridSize: 4,
            lastAccessed: Date.now()
        };

        this.presets.unshift(newPreset); // Add to top
        await DB.savePreset(newPreset);

        this.renderPresetDropdown();
        document.getElementById('preset-selector').value = newPreset.id;
        this.loadPresetData(newPreset);
        UI.showToast("New preset created!", "success");
    },

    async updatePresetTitle(newTitle) {
        if (!newTitle.trim() || !this.activePresetId) return;

        const presetIndex = this.presets.findIndex(p => p.id === this.activePresetId);
        if (presetIndex !== -1 && this.presets[presetIndex].title !== newTitle) {
            this.presets[presetIndex].title = newTitle;
            await this.saveCurrentState();
            this.renderPresetDropdown();
            UI.showToast("Title saved", "success");
        }
    },

    // --- DELETION LOGIC ---
    presetToDelete: null,
    deleteCurrentPreset() {
        if (this.presets.length <= 1) {
            UI.showToast("Cannot delete the last remaining preset.", "error");
            return;
        }
        const preset = this.presets.find(p => p.id === this.activePresetId);
        if (!preset) return;

        this.presetToDelete = preset;
        document.getElementById('delete-preset-name').textContent = preset.title;
        const modal = document.getElementById('delete-modal');
        const content = document.getElementById('delete-modal-content');

        modal.classList.remove('hidden');
        modal.classList.add('flex');

        requestAnimationFrame(() => {
            content.classList.remove('scale-95', 'opacity-0');
            content.classList.add('scale-100', 'opacity-100');
        });
    },

    closeDeleteModal() {
        this.presetToDelete = null;
        const modal = document.getElementById('delete-modal');
        const content = document.getElementById('delete-modal-content');

        content.classList.remove('scale-100', 'opacity-100');
        content.classList.add('scale-95', 'opacity-0');

        setTimeout(() => {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }, 200);
    },

    async confirmDeletePreset() {
        if (!this.presetToDelete) return;

        const idToDelete = this.presetToDelete.id;
        await DB.deletePreset(idToDelete);

        this.presets = this.presets.filter(p => p.id !== idToDelete);

        this.closeDeleteModal();
        UI.showToast("Preset deleted", "success");

        // Load the first available
        this.loadPresetData(this.presets[0]);
        this.renderPresetDropdown();
    },

    openImageManager() {
        const modal = document.getElementById('image-manager-modal');
        const content = document.getElementById('image-manager-content');

        this.renderImageManagerList();

        modal.classList.remove('hidden');
        modal.classList.add('flex');

        requestAnimationFrame(() => {
            content.classList.remove('scale-95', 'opacity-0');
            content.classList.add('scale-100', 'opacity-100');
        });
    },

    closeImageManager() {
        const modal = document.getElementById('image-manager-modal');
        const content = document.getElementById('image-manager-content');

        content.classList.remove('scale-100', 'opacity-100');
        content.classList.add('scale-95', 'opacity-0');

        setTimeout(() => {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }, 200);
    },

    renderImageManagerList() {
        const list = document.getElementById('image-manager-list');
        document.getElementById('image-manager-count').textContent = `${Game.images.length} Image${Game.images.length === 1 ? '' : 's'}`;

        if (Game.images.length === 0) {
            list.innerHTML = `<div class="col-span-full h-32 flex flex-col items-center justify-center text-slate-400 font-bold font-body"><i data-lucide="image-minus" class="w-8 h-8 mb-3 opacity-50"></i>No images in this preset.</div>`;
            lucide.createIcons();
            return;
        }

        list.innerHTML = Game.images.map((imgSrc, index) => `
            <div class="relative group aspect-square rounded-xl overflow-hidden border-2 border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 shadow-sm">
                <img src="${imgSrc}" class="w-full h-full object-cover">
                <div class="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                    <button onclick="app.deleteImage(${index})" class="p-3 bg-red-500 text-white rounded-xl hover:scale-110 hover:bg-red-600 transition-all shadow-hard-sm active:scale-95 active:shadow-none translate-y-2 group-hover:translate-y-0" title="Delete Image">
                        <i data-lucide="trash-2" class="w-5 h-5"></i>
                    </button>
                </div>
                <div class="absolute top-2 left-2 bg-slate-900/70 text-white text-[10px] font-bold px-2 py-1 rounded backdrop-blur-md border-[1px] border-white/20">
                    #${index + 1}
                </div>
            </div>
        `).join('');
        lucide.createIcons();
    },

    async deleteImage(index) {
        if (index < 0 || index >= Game.images.length) return;

        Game.images.splice(index, 1);

        // Keep current index bounded
        if (Game.currentIndex >= Game.images.length) {
            Game.currentIndex = Math.max(0, Game.images.length - 1);
        }

        await this.saveCurrentState();
        this.renderImageManagerList();

        // Update game view
        this.loadPresetData(this.presets.find(p => p.id === this.activePresetId));
        UI.showToast("Image removed", "success");
    },

    async clearActiveImages() {
        if (!confirm("Are you sure you want to remove ALL images from this preset?")) return;
        Game.images = [];
        Game.currentIndex = 0;
        await this.saveCurrentState();
        this.renderImageManagerList();
        this.loadPresetData(this.presets.find(p => p.id === this.activePresetId));
        this.closeImageManager();
        UI.showToast("All images cleared", "success");
    }
};

/**
 * AUDIO CONTROLLER
 */
const Audio = {
    enabled: true,
    init: async () => { await Tone.start(); },

    toggle: () => {
        Audio.enabled = !Audio.enabled;
        const btn = document.getElementById('sound-toggle');
        const icon = Audio.enabled ? 'volume-2' : 'volume-x';
        btn.innerHTML = `<i data-lucide="${icon}" class="w-4 h-4"></i>`;
        if (!Audio.enabled) btn.classList.add('text-pink');
        else btn.classList.remove('text-pink');
        lucide.createIcons();
        localStorage.setItem('mb_audio', Audio.enabled);
    },

    playPop: () => {
        if (!Audio.enabled) return;
        const notes = ["C3", "E3", "G3", "A3"];
        const note = notes[Math.floor(Math.random() * notes.length)];
        const synth = new Tone.MembraneSynth({
            pitchDecay: 0.05,
            octaves: 2,
            oscillator: { type: "sine" },
            envelope: { attack: 0.001, decay: 0.2, sustain: 0.01, release: 0.4 }
        }).toDestination();
        synth.triggerAttackRelease(note, "32n");
    },

    playWin: () => {
        if (!Audio.enabled) return;
        const synth = new Tone.PolySynth(Tone.Synth).toDestination();
        const now = Tone.now();
        synth.triggerAttackRelease(["C4", "E4", "G4"], "8n", now);
        synth.triggerAttackRelease(["E4", "G4", "C5"], "8n", now + 0.1);
        synth.triggerAttackRelease(["G4", "C5", "E5"], "4n", now + 0.2);
    }
};

/**
 * AUTO REVEAL CONTROLLER
 */
const AutoReveal = {
    intervalId: null,
    speed: 1500,
    isPlaying: false,

    init() {
        const slider = document.getElementById('speed-slider');
        const label = document.getElementById('speed-label');

        slider.addEventListener('input', (e) => {
            AutoReveal.speed = parseInt(e.target.value);
            label.innerText = (AutoReveal.speed / 1000).toFixed(1) + 's';

            if (AutoReveal.isPlaying) {
                AutoReveal.stop();
                AutoReveal.start();
            }
        });
    },

    toggle() {
        if (this.isPlaying) this.stop();
        else this.start();
    },

    start() {
        if (Game.tilesRemaining <= 0) return;

        this.isPlaying = true;
        const btn = document.getElementById('auto-reveal-btn');

        btn.innerHTML = `<i data-lucide="pause" class="w-4 h-4 md:w-5 md:h-5 fill-current"></i> <span class="hidden md:inline">PAUSE</span>`;
        btn.classList.replace('bg-blue', 'bg-white');
        btn.classList.replace('text-white', 'text-blue');
        btn.classList.add('border-blue');
        lucide.createIcons();

        this.intervalId = setInterval(() => {
            const tiles = Array.from(document.querySelectorAll('.tile:not(.revealed)'));
            if (tiles.length === 0) {
                this.stop();
                return;
            }
            const randomTile = tiles[Math.floor(Math.random() * tiles.length)];
            Game.revealTile(randomTile);
        }, this.speed);
    },

    stop() {
        this.isPlaying = false;
        clearInterval(this.intervalId);

        const btn = document.getElementById('auto-reveal-btn');

        btn.innerHTML = `<i data-lucide="play" class="w-4 h-4 md:w-5 md:h-5 fill-current"></i> <span class="hidden md:inline">AUTO</span>`;
        btn.classList.replace('bg-white', 'bg-blue');
        btn.classList.replace('text-blue', 'text-white');
        btn.classList.remove('border-blue');
        lucide.createIcons();
    }
};

/**
 * CORE GAME ENGINE
 */
const Game = {
    images: [], // Array of strings (DataURLs)
    currentIndex: 0,
    gridSize: 4,
    tilesRemaining: 0,

    async init() {
        // Restore Theme
        const savedTheme = localStorage.getItem('klasskit_theme');
        if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }

        const savedAudio = localStorage.getItem('mb_audio');
        if (savedAudio === 'false') Audio.toggle();

        // Init modules
        AutoReveal.init();
    },

    start(fileList, restoring = false) {
        if (!fileList || fileList.length === 0) return;

        // Merge new files into existing if not restoring
        if (!restoring) {
            this.images = [...this.images, ...fileList];
        } else {
            this.images = fileList;
        }

        document.getElementById('empty-state').style.display = 'none';

        // If not restoring, jump to the first new image (or stay if just appending)
        if (!restoring && this.images.length === fileList.length) {
            this.currentIndex = 0;
        }

        this.loadLevel();

        if (window.innerWidth < 768) UI.togglePanel(true);
    },

    loadLevel() {
        // Bounds check
        if (this.currentIndex >= this.images.length) this.currentIndex = 0;

        // Update Image
        document.getElementById('target-image').src = this.images[this.currentIndex];
        document.getElementById('round-display').textContent = `${this.currentIndex + 1} / ${this.images.length}`;

        // Save Persistence
        app.saveCurrentState();

        // Reset State
        document.getElementById('next-round-btn').disabled = true;
        AutoReveal.stop();
        this.buildGrid();
    },

    buildGrid() {
        const grid = document.getElementById('tile-grid');
        grid.innerHTML = '';
        grid.style.gridTemplateColumns = `repeat(${this.gridSize}, 1fr)`;

        this.tilesRemaining = this.gridSize * this.gridSize;
        UI.updateCount(this.tilesRemaining);

        for (let i = 0; i < this.tilesRemaining; i++) {
            const tile = document.createElement('div');
            tile.className = 'tile';
            const numColor = (i % 2 === 0) ? 'text-slate-200' : 'text-slate-300';
            tile.innerHTML = `<span class="text-3xl font-heading ${numColor} pointer-events-none select-none">${i + 1}</span>`;

            tile.onmousedown = () => this.revealTile(tile);
            grid.appendChild(tile);
        }
    },

    revealTile(tile) {
        if (tile.classList.contains('revealed')) return;
        if (Tone.context.state !== 'running') Tone.start();

        tile.classList.add('revealed');
        this.tilesRemaining--;
        UI.updateCount(this.tilesRemaining);
        Audio.playPop();

        if (this.tilesRemaining <= 0) this.win();
    },

    revealAll() {
        if (this.tilesRemaining === 0) return;

        AutoReveal.stop();
        const tiles = document.querySelectorAll('.tile:not(.revealed)');

        tiles.forEach((t, i) => {
            setTimeout(() => {
                t.classList.add('revealed');
                if (i % 3 === 0) Audio.playPop();
            }, i * 30);
        });

        setTimeout(() => {
            this.tilesRemaining = 0;
            UI.updateCount(0);
            this.win();
        }, tiles.length * 30 + 100);
    },

    win() {
        Audio.playWin();
        UI.fireConfetti();
        AutoReveal.stop();

        const btn = document.getElementById('next-round-btn');
        btn.disabled = false;
        btn.classList.add('animate-bounce');
        setTimeout(() => btn.classList.remove('animate-bounce'), 1000);
    },

    resetLevel() {
        this.buildGrid();
        AutoReveal.stop();
    },

    nextLevel() {
        this.currentIndex++;
        if (this.currentIndex >= this.images.length) this.currentIndex = 0;
        this.loadLevel();
    },

    updateGridSize(val) {
        this.gridSize = parseInt(val);
        document.getElementById('grid-val').textContent = `${val} x ${val}`;
        if (this.images.length > 0) this.buildGrid();
        app.saveCurrentState();
    }
};

/**
 * UI MANAGER
 */
const UI = {
    toggleTheme() {
        const isDark = document.documentElement.classList.toggle('dark');
        localStorage.setItem('klasskit_theme', isDark ? 'dark' : 'light');
    },

    togglePanel(forceHide) {
        const panel = document.getElementById('controls');
        const isHidden = window.innerWidth >= 768
            ? panel.classList.contains('hidden-panel-desktop')
            : panel.classList.contains('hidden-panel-mobile');

        if (forceHide || !isHidden) {
            panel.classList.add('hidden-panel-mobile', 'hidden-panel-desktop');
        } else {
            panel.classList.remove('hidden-panel-mobile', 'hidden-panel-desktop');
        }
        setTimeout(() => window.dispatchEvent(new Event('resize')), 300);
    },

    updateCount(num) {
        document.getElementById('tiles-count').innerText = num;
    },

    fireConfetti() {
        const end = Date.now() + 1000;
        const colors = ['#FF6B95', '#FF8C42', '#00E676', '#2979FF'];

        (function frame() {
            confetti({ particleCount: 4, angle: 60, spread: 55, origin: { x: 0 }, colors });
            confetti({ particleCount: 4, angle: 120, spread: 55, origin: { x: 1 }, colors });
            if (Date.now() < end) requestAnimationFrame(frame);
        }());
    },

    showToast(msg, type = 'info') {
        const t = document.getElementById('toast');
        const tMsg = document.getElementById('toast-msg');
        const tIcon = document.getElementById('toast-icon');

        t.classList.remove('border-green-500', 'border-red-500', 'border-blue-500');

        if (type === 'success') {
            t.classList.add('border-green-500');
            tIcon.outerHTML = `<i id="toast-icon" data-lucide="check-circle" class="w-5 h-5 text-green-500"></i>`;
        } else if (type === 'error') {
            t.classList.add('border-red-500');
            tIcon.outerHTML = `<i id="toast-icon" data-lucide="alert-circle" class="w-5 h-5 text-red-500"></i>`;
        } else {
            t.classList.add('border-blue-500');
            tIcon.outerHTML = `<i id="toast-icon" data-lucide="info" class="w-5 h-5 text-blue-500"></i>`;
        }

        lucide.createIcons();
        tMsg.innerText = msg;

        t.classList.remove('opacity-0', 'translate-y-20');
        setTimeout(() => t.classList.add('opacity-0', 'translate-y-20'), 3000);
    },

    toggleLoader(show) {
        const l = document.getElementById('db-loader');
        if (show) l.classList.remove('hidden');
        else l.classList.add('hidden');
    }
};

// --- EVENT BINDINGS ---

document.getElementById('grid-slider').addEventListener('input', (e) => Game.updateGridSize(e.target.value));
document.getElementById('sound-toggle').addEventListener('click', Audio.toggle);

// 2. File Loading & Persistence
const handleFiles = (files) => {
    const list = [];
    let loaded = 0;

    // Show loader immediately
    UI.toggleLoader(true);

    Array.from(files).forEach(f => {
        const reader = new FileReader();
        reader.onload = (e) => {
            list.push(e.target.result);
            loaded++;
            if (loaded === files.length) {
                // SAVE TO APP STATE INSTEAD OF DB DIRECTLY
                Game.start(list);
                app.saveCurrentState();
                UI.toggleLoader(false);
                UI.showToast(`Saved ${files.length} Images to Preset!`, "success");
            }
        };
        reader.readAsDataURL(f);
    });
};

document.getElementById('file-input').addEventListener('change', (e) => handleFiles(e.target.files));

// 3. Drag & Drop
window.addEventListener('dragover', (e) => {
    e.preventDefault();
    document.body.classList.add('dragging');
});
window.addEventListener('dragleave', (e) => {
    if (e.clientX === 0 && e.clientY === 0) document.body.classList.remove('dragging');
});
window.addEventListener('drop', (e) => {
    e.preventDefault();
    document.body.classList.remove('dragging');
    if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files);
});

// 4. Keyboard Shortcuts
document.addEventListener('keydown', (e) => {
    if (Game.images.length === 0) return;
    switch (e.code) {
        case 'Space':
            e.preventDefault();
            AutoReveal.toggle();
            break;
        case 'KeyR': Game.resetLevel(); break;
        case 'KeyN': if (Game.tilesRemaining <= 0) Game.nextLevel(); break;
    }
});

window.addEventListener('resize', () => {
    const panel = document.getElementById('controls');
    if (window.innerWidth >= 768) panel.classList.remove('hidden-panel-mobile');
    else panel.classList.remove('hidden-panel-desktop');
});

// Init
window.onload = async () => {
    await Game.init();
    await app.init();
    lucide.createIcons();
    if (window.innerWidth < 768) UI.togglePanel(true);
};
