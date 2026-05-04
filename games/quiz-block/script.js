// --- Tailwind Configuration ---
tailwind.config = {
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                brand: {
                    pink: '#FF6B95',
                    orange: '#FF8C42',
                    green: '#00E676',
                    blue: '#2979FF',
                    dark: '#1e293b',
                    chalk: '#f8fafc',
                }
            },
            fontFamily: {
                sans: ['Nunito', 'sans-serif'],
                heading: ['Fredoka', 'sans-serif'],
            },
            boxShadow: {
                'neo': '4px 4px 0px 0px rgba(30, 41, 59, 1)',
                'neo-sm': '2px 2px 0px 0px rgba(30, 41, 59, 1)',
                'neo-lg': '8px 8px 0px 0px rgba(30, 41, 59, 1)',
            }
        }
    }
}

// --- Quiz Block Game Logic ---
const Jeopardy = (function() {
    
    // --- Config & State ---
    const DEFAULT_STATE = {
        categories: ["Grammar", "Vocab", "Spelling", "Mystery", "Speaking"],
        teams: ["Team 1", "Team 2", "Team 3", "Team 4"],
        questions: Array(5).fill().map(() => Array(5).fill({ q: "Edit Me", a: "Answer" })),
        visited: Array(5).fill().map(() => Array(5).fill(false)),
        scores: [0, 0, 0, 0]
    };

    let state = JSON.parse(localStorage.getItem('eng1_jeopardy_v3')) || JSON.parse(JSON.stringify(DEFAULT_STATE));
    let isEditMode = false;
    let currentEdit = { row: 0, col: 0 };
    
    let presetsData = [];
    let customGamesData = JSON.parse(localStorage.getItem('quiz_block_custom_games')) || [];
    
    
    // --- DOM Elements ---
    const els = {
        grid: document.getElementById('game-board'),
        cats: document.getElementById('category-row'),
        scores: document.getElementById('scoreboard-container'),
        status: document.getElementById('status-indicator'),
        landing: {
            page: document.getElementById('landing-page'),
            presetsList: document.getElementById('presets-list'),
            savedGamesList: document.getElementById('saved-games-list')
        },
        gameWrappers: [
            document.getElementById('game-header'),
            document.getElementById('game-main'),
            document.getElementById('game-footer')
        ],
        modals: {
            play: document.getElementById('modal-play'),
            edit: document.getElementById('modal-edit'),
            data: document.getElementById('modal-data'),
            system: document.getElementById('modal-system')
        },
        play: {
            q: document.getElementById('view-question'),
            a: document.getElementById('view-answer'),
            text: document.getElementById('play-text'),
            answer: document.getElementById('play-answer'),
            cat: document.getElementById('play-cat'),
            points: document.getElementById('play-points'),
            timerBar: document.getElementById('timer-bar')
        },
        inputs: {
            q: document.getElementById('edit-q'),
            a: document.getElementById('edit-a')
        },
        sys: {
            title: document.getElementById('sys-title'),
            msg: document.getElementById('sys-msg'),
            input: document.getElementById('sys-input'),
            actions: document.getElementById('sys-actions'),
            header: document.getElementById('sys-header')
        }
    };

    // --- Core Functions ---

    async function init() {
        try {
            await requireAuth();
            await loadFromCloud();
        } catch (e) {
            console.warn("Cloud auth/load failed or bypassed in Sandbox mode.", e);
        }
        
        if(!state.teams) state.teams = ["Team 1", "Team 2", "Team 3", "Team 4"];
        lucide.createIcons();
        
        await fetchPresets();
        renderLandingPage();
        showLandingPage();
    }

    async function fetchPresets() {
        try {
            const response = await fetch('presets.json');
            if (response.ok) {
                presetsData = await response.json();
            } else {
                console.warn('Failed to load presets.json');
            }
        } catch (error) {
            console.error('Error fetching presets:', error);
        }
    }

    // --- Landing Page Logic ---

    function showLandingPage() {
        renderLandingPage();
        els.landing.page.classList.remove('hidden');
        els.gameWrappers.forEach(el => el.classList.add('hidden'));
        els.gameWrappers[1].classList.remove('flex'); // game-main uses flex-col, but hidden overrides it. just to be safe.
    }

    function hideLandingPage() {
        els.landing.page.classList.add('hidden');
        els.gameWrappers[0].classList.replace('hidden', 'flex'); // header
        els.gameWrappers[1].classList.replace('hidden', 'flex'); // main
        els.gameWrappers[2].classList.remove('hidden'); // footer
        
        renderBoard();
        renderScoreboard();
        updateEditUI();
        lucide.createIcons();
    }

    function renderLandingPage() {
        // Render Presets
        els.landing.presetsList.innerHTML = '';
        if (presetsData.length === 0) {
            els.landing.presetsList.innerHTML = '<div class="text-center text-sm font-bold text-slate-400 p-4">No presets found.</div>';
        } else {
            presetsData.forEach(preset => {
                const btn = document.createElement('button');
                btn.className = "btn-chunky text-left w-full p-2.5 bg-brand-chalk dark:bg-slate-700 rounded-xl border-2 border-brand-dark hover:bg-brand-blue hover:text-white transition-all group relative overflow-hidden";
                btn.innerHTML = `
                    <div class="flex items-center gap-3">
                        <div class="p-2 bg-brand-blue/10 rounded-lg group-hover:bg-white/20">
                            <i data-lucide="layout" class="w-4 h-4 text-brand-blue group-hover:text-white"></i>
                        </div>
                        <div class="min-w-0">
                            <h4 class="font-heading font-bold text-sm text-brand-dark dark:text-brand-chalk group-hover:text-white truncate">${preset.name}</h4>
                            <p class="text-[10px] opacity-60 group-hover:opacity-100 truncate">${preset.description || 'Pre-made quiz.'}</p>
                        </div>
                    </div>
                `;
                btn.onclick = () => loadPreset(preset.id);
                els.landing.presetsList.appendChild(btn);
            });
        }

        // Render Custom Saved Games
        els.landing.savedGamesList.innerHTML = '';
        if (customGamesData.length === 0) {
            els.landing.savedGamesList.innerHTML = '<div class="text-center text-sm font-bold text-slate-400 p-4">No saved games found.</div>';
        } else {
            customGamesData.forEach(game => {
                const wrapper = document.createElement('div');
                wrapper.className = "flex gap-2 w-full";
                
                const btn = document.createElement('button');
                btn.className = "btn-chunky flex-grow text-left p-2.5 bg-brand-chalk dark:bg-slate-700 rounded-xl border-2 border-brand-dark hover:bg-brand-green hover:text-white transition-all group relative overflow-hidden";
                btn.innerHTML = `
                    <div class="flex items-center gap-3">
                        <div class="p-2 bg-brand-green/10 rounded-lg group-hover:bg-white/20">
                            <i data-lucide="play-circle" class="w-4 h-4 text-brand-green group-hover:text-white"></i>
                        </div>
                        <div class="min-w-0">
                            <h4 class="font-heading font-bold text-sm text-brand-dark dark:text-brand-chalk group-hover:text-white truncate">${game.name}</h4>
                            <p class="text-[10px] opacity-60 group-hover:opacity-100 truncate">${new Date(game.timestamp).toLocaleDateString()}</p>
                        </div>
                    </div>
                `;
                btn.onclick = () => loadCustomGame(game.id);

                const delBtn = document.createElement('button');
                delBtn.className = "btn-chunky p-2.5 bg-brand-pink text-white rounded-xl border-2 border-brand-dark hover:bg-red-500 transition-colors flex items-center justify-center";
                delBtn.innerHTML = `<i data-lucide="trash-2" class="w-4 h-4"></i>`;
                delBtn.onclick = () => deleteCustomGame(game.id);

                wrapper.appendChild(btn);
                wrapper.appendChild(delBtn);
                els.landing.savedGamesList.appendChild(wrapper);
            });
        }
        lucide.createIcons();
    }

    function startNewBlankGame() {
        showSystemModal({
            type: 'prompt',
            title: 'New Game Setup',
            message: 'How many categories (columns) do you want? (2-6):',
            defaultValue: '5',
            onConfirm: (val) => {
                const cols = parseInt(val);
                if (isNaN(cols) || cols < 2 || cols > 6) {
                    showSystemModal({ type: 'alert', title: 'Invalid Input', message: 'Please enter a number between 2 and 6.' });
                    return;
                }

                // Initialize state with custom columns
                state = {
                    categories: Array(cols).fill().map((_, i) => `Category ${i + 1}`),
                    teams: ["Team 1", "Team 2", "Team 3", "Team 4"],
                    questions: Array(5).fill().map(() => Array(cols).fill({ q: "Edit Me", a: "Answer" })),
                    visited: Array(5).fill().map(() => Array(cols).fill(false)),
                    scores: [0, 0, 0, 0]
                };

                save();
                hideLandingPage();
            }
        });
    }

    function loadPreset(id) {
        const preset = presetsData.find(p => p.id === id);
        if (preset) {
            state = JSON.parse(JSON.stringify(preset.state));
            save();
            hideLandingPage();
        }
    }

    function loadCustomGame(id) {
        const game = customGamesData.find(g => g.id === id);
        if (game) {
            state = JSON.parse(JSON.stringify(game.state));
            save();
            hideLandingPage();
        }
    }

    function saveToCustomGames() {
        showSystemModal({
            type: 'prompt',
            title: 'Save Custom Game',
            message: 'Enter a name for your saved game:',
            defaultValue: 'My Quiz Block',
            onConfirm: (val) => {
                if (val) {
                    const newGame = {
                        id: 'custom-' + Date.now(),
                        name: val,
                        timestamp: Date.now(),
                        state: JSON.parse(JSON.stringify(state))
                    };
                    customGamesData.push(newGame);
                    localStorage.setItem('quiz_block_custom_games', JSON.stringify(customGamesData));
                    showSystemModal({ type: 'alert', title: 'Success', message: 'Game saved successfully to My Saved Games!' });
                }
            }
        });
    }

    function deleteCustomGame(id) {
        showSystemModal({
            type: 'confirm',
            title: 'Delete Saved Game?',
            message: 'Are you sure you want to delete this game? This cannot be undone.',
            onConfirm: () => {
                customGamesData = customGamesData.filter(g => g.id !== id);
                localStorage.setItem('quiz_block_custom_games', JSON.stringify(customGamesData));
                renderLandingPage();
            }
        });
    }

    // --- The "System Modal" (Replaces Alert/Confirm/Prompt) ---
    function showSystemModal(options) {
        const { type, title, message, defaultValue, onConfirm } = options;
        
        // Reset
        els.sys.title.textContent = title || "Notification";
        els.sys.msg.textContent = message || "";
        els.sys.input.value = defaultValue || "";
        els.sys.input.classList.add('hidden');
        els.sys.actions.innerHTML = '';
        
        // Color coding
        const colors = { alert: 'bg-brand-blue', confirm: 'bg-brand-orange', prompt: 'bg-brand-pink' };
        els.sys.header.className = `p-4 border-b-4 border-brand-dark ${colors[type] || 'bg-brand-dark'}`;

        // Setup based on type
        if (type === 'prompt') {
            els.sys.input.classList.remove('hidden');
            setTimeout(() => els.sys.input.focus(), 100);
        }

        // Buttons
        const btnCancel = document.createElement('button');
        btnCancel.className = "btn-neo px-6 py-2 rounded-xl font-bold border-2 border-brand-dark bg-slate-200 text-brand-dark";
        btnCancel.textContent = type === 'alert' ? "Close" : "Cancel";
        btnCancel.onclick = () => els.modals.system.classList.add('hidden');

        const btnConfirm = document.createElement('button');
        btnConfirm.className = "btn-neo px-6 py-2 rounded-xl font-bold border-2 border-brand-dark bg-brand-green text-white";
        btnConfirm.textContent = "Confirm";
        btnConfirm.onclick = () => {
            const val = els.sys.input.value;
            els.modals.system.classList.add('hidden');
            if (onConfirm) onConfirm(type === 'prompt' ? val : true);
        };

        if (type !== 'alert') els.sys.actions.appendChild(btnCancel);
        els.sys.actions.appendChild(btnConfirm);

        els.modals.system.classList.remove('hidden');
    }

    // --- Render Logic ---

    function renderBoard() {
        els.cats.innerHTML = '';
        els.grid.innerHTML = '';

        const cols = state.categories.length;
        const rows = state.questions.length;

        // Apply dynamic grid columns
        const gridStyle = `grid-template-columns: repeat(${cols}, minmax(0, 1fr));`;
        els.cats.style = gridStyle;
        els.grid.style = gridStyle + ` grid-template-rows: repeat(${rows}, minmax(0, 1fr));`;

        // Categories
        const catColors = ['bg-brand-pink', 'bg-brand-orange', 'bg-brand-green', 'bg-brand-blue'];
        state.categories.forEach((cat, idx) => {
            const div = document.createElement('div');
            div.className = `${catColors[idx % catColors.length]} text-white border-4 border-brand-dark rounded-xl min-h-[50px] sm:min-h-[60px] p-2 flex items-center justify-center shadow-neo relative cursor-pointer select-none transition-transform hover:scale-[1.02] active:scale-95`;
            div.innerHTML = `<span class="font-heading font-bold uppercase text-center leading-[1.1] drop-shadow-md tracking-wide line-clamp-2" style="font-size: clamp(0.875rem, 2vw, 1.25rem);">${cat}</span>`;
            
            if(isEditMode) {
                div.innerHTML += `<div class="absolute -top-2 -right-2 bg-white text-brand-dark border-2 border-brand-dark rounded-full p-1"><i data-lucide="edit-2" class="w-3 h-3"></i></div>`;
                div.onclick = () => {
                    showSystemModal({
                        type: 'prompt',
                        title: 'Rename Category',
                        message: `Enter new name for "${cat}":`,
                        defaultValue: cat,
                        onConfirm: (val) => {
                            if(val) { state.categories[idx] = val; save(); renderBoard(); }
                        }
                    });
                };
            }
            els.cats.appendChild(div);
        });

        // Grid
        for(let r=0; r<rows; r++) {
            for(let c=0; c<cols; c++) {
                const cell = state.questions[r][c];
                const visited = state.visited[r][c];
                const points = (r+1)*100;

                const btn = document.createElement('button');
                let cls = "tile-card w-full h-full min-h-[50px] rounded-xl border-4 border-brand-dark flex items-center justify-center font-heading font-bold shadow-neo btn-chunky transition-all relative overflow-hidden ";
                
                if(visited && !isEditMode) {
                    cls += "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none border-slate-300 opacity-60";
                    btn.disabled = true;
                } else {
                    cls += "bg-gradient-to-br from-white to-brand-chalk text-brand-blue hover:z-10 dark:from-slate-800 dark:to-slate-900 dark:text-brand-blue";
                }
                
                if(isEditMode && cell.q === "Edit Me") {
                    cls += " bg-red-50 text-red-300 border-dashed border-red-300";
                }

                btn.className = cls;
                btn.innerHTML = `<span class="relative z-10" style="font-size: clamp(1.5rem, 4vw, 3.5rem);">$${points}</span>`;
                
                // Decorative pattern on tiles
                if(!visited) {
                     btn.innerHTML += `<div class="absolute -bottom-4 -right-4 w-12 h-12 bg-slate-100 dark:bg-slate-700 rounded-full z-0"></div>`;
                }

                btn.onclick = () => handleTileClick(r, c);
                els.grid.appendChild(btn);
            }
        }
        lucide.createIcons();
    }

    function renderScoreboard() {
        els.scores.innerHTML = '';
        const colors = ['pink', 'orange', 'blue', 'green'];

        state.scores.forEach((score, idx) => {
            const color = colors[idx % 4];
            const teamName = state.teams[idx];
            
            const div = document.createElement('div');
            div.className = "bg-white dark:bg-slate-800 border-[3px] border-brand-dark shadow-neo-sm rounded-lg p-2 flex flex-col items-center relative overflow-hidden transition-all group";
            
            div.innerHTML = `
                <div class="absolute top-0 left-0 w-full h-1.5 bg-brand-${color} border-b-2 border-brand-dark"></div>
                
                <button onclick="Jeopardy.renameTeam(${idx})" class="font-heading font-bold text-xs sm:text-sm mt-1 dark:text-white hover:text-brand-${color} hover:underline decoration-2 underline-offset-2 truncate max-w-full z-10 opacity-80">
                    ${teamName}
                </button>
                
                <div class="flex items-center justify-between w-full mt-1 z-10 px-1">
                    <button onclick="Jeopardy.modScore(${idx}, -100)" class="btn-chunky w-6 h-6 sm:w-8 sm:h-8 shrink-0 rounded-md bg-brand-pink text-white border-2 border-brand-dark font-bold text-sm shadow-sm flex items-center justify-center hover:bg-pink-400 leading-none">-</button>
                    
                    <button onclick="Jeopardy.editScore(${idx})" class="text-xl sm:text-2xl font-black font-sans text-brand-dark dark:text-brand-chalk hover:scale-110 transition-transform cursor-pointer leading-none" title="Click to edit manually">
                        ${score}
                    </button>
                    
                    <button onclick="Jeopardy.modScore(${idx}, 100)" class="btn-chunky w-6 h-6 sm:w-8 sm:h-8 shrink-0 rounded-md bg-brand-green text-white border-2 border-brand-dark font-bold text-sm shadow-sm flex items-center justify-center hover:bg-green-400 leading-none">+</button>
                </div>
            `;
            els.scores.appendChild(div);
        });
    }

    // --- Actions ---

    function handleTileClick(r, c) {
        if(isEditMode) {
            currentEdit = { r, c };
            els.inputs.q.value = state.questions[r][c].q;
            els.inputs.a.value = state.questions[r][c].a;
            els.modals.edit.classList.remove('hidden');
        } else {
            state.visited[r][c] = true;
            save();
            renderBoard();
            openPlayModal(state.questions[r][c], state.categories[c], (r+1)*100);
        }
    }

    function renameTeam(idx) {
        showSystemModal({
            type: 'prompt',
            title: 'Rename Team',
            message: `Enter name for Team ${idx + 1}:`,
            defaultValue: state.teams[idx],
            onConfirm: (val) => {
                if(val) {
                    state.teams[idx] = val;
                    save();
                    renderScoreboard();
                }
            }
        });
    }

    function editScore(idx) {
        showSystemModal({
            type: 'prompt',
            title: 'Adjust Score',
            message: `Manually set score for ${state.teams[idx]}:`,
            defaultValue: state.scores[idx],
            onConfirm: (val) => {
                if(val !== null && !isNaN(val)) {
                    state.scores[idx] = parseInt(val);
                    save();
                    renderScoreboard();
                }
            }
        });
    }

    function modScore(idx, val) {
        state.scores[idx] += val;
        save();
        renderScoreboard();
    }

    // --- Play Mode ---

    function openPlayModal(data, cat, points) {
        els.play.q.classList.remove('hidden');
        els.play.a.classList.add('hidden');
        
        els.play.cat.textContent = cat;
        els.play.points.textContent = `$${points}`;
        els.play.text.textContent = data.q;
        els.play.answer.textContent = data.a;

        stopTimer();
        els.play.timerBar.style.width = '100%';
        
        els.modals.play.classList.remove('hidden');
    }

    function startTimer() {
        const duration = 15; 
        // Reset
        els.play.timerBar.style.transition = 'none';
        els.play.timerBar.style.width = '100%';
        void els.play.timerBar.offsetWidth; 

        // Animate
        els.play.timerBar.style.transition = `width ${duration}s linear`;
        els.play.timerBar.style.width = '0%';
    }

    function stopTimer() {
        els.play.timerBar.style.transition = 'none';
        els.play.timerBar.style.width = '100%';
    }

    function revealAnswer() {
        els.play.q.classList.add('hidden');
        els.play.a.classList.remove('hidden');
        els.play.a.classList.add('flex');
    }

    function closePlayModal() {
        els.modals.play.classList.add('hidden');
    }

    // --- Edit Logic ---

    function saveEdit() {
        const { r, c } = currentEdit;
        state.questions[r][c].q = els.inputs.q.value;
        state.questions[r][c].a = els.inputs.a.value;
        save();
        renderBoard();
        closeEditModal();
    }

    function closeEditModal() {
        els.modals.edit.classList.add('hidden');
    }

    function toggleEditMode() {
        isEditMode = !isEditMode;
        updateEditUI();
        renderBoard();
    }

    function updateEditUI() {
        const track = document.getElementById('toggle-track');
        const dot = document.getElementById('toggle-dot');
        const btn = document.getElementById('btn-edit-toggle');
        
        if(isEditMode) {
            document.body.classList.add('edit-active');
            track.classList.replace('bg-slate-300', 'bg-brand-green');
            dot.style.transform = 'translateX(100%)';
            els.status.textContent = "DESIGN MODE ACTIVE";
            els.status.className = "text-xs font-bold text-brand-pink uppercase tracking-widest animate-pulse";
            btn.classList.add('bg-slate-100');
        } else {
            document.body.classList.remove('edit-active');
            track.classList.replace('bg-brand-green', 'bg-slate-300');
            dot.style.transform = 'translateX(0)';
            els.status.textContent = "Ready to Play";
            els.status.className = "text-xs font-bold text-brand-green uppercase tracking-widest";
            btn.classList.remove('bg-slate-100');
        }
    }

    // --- Persistence ---
    let syncTimeout = null;
    async function syncToCloud() {
        if (syncTimeout) clearTimeout(syncTimeout);
        syncTimeout = setTimeout(async () => {
            await saveProgress('quiz_block', state);
        }, 1500);
    }

    async function loadFromCloud() {
        const cloudData = await loadProgress('quiz_block');
        if (cloudData) {
            state = cloudData;
            save(); // Sync back to local
        }
    }

    function save() {
        localStorage.setItem('eng1_jeopardy_v3', JSON.stringify(state));
        syncToCloud();
    }

    function exportData() {
        document.getElementById('data-json').value = JSON.stringify(state, null, 2);
        els.modals.data.classList.remove('hidden');
    }

    function importData() {
        try {
            const raw = JSON.parse(document.getElementById('data-json').value);
            if(raw.questions && raw.categories) {
                state = raw;
                save();
                init();
                closeDataModal();
                showSystemModal({ type: 'alert', title: 'Success', message: 'Game Loaded Successfully!' });
            } else throw new Error();
        } catch(e) {
            showSystemModal({ type: 'alert', title: 'Error', message: 'Invalid Data JSON' });
        }
    }

    function closeDataModal() {
        els.modals.data.classList.add('hidden');
    }

    function resetBoardState() {
        showSystemModal({
            type: 'confirm',
            title: 'Reset Board?',
            message: "This will mark all tiles as 'unplayed'. Scores will remain.",
            onConfirm: () => {
                state.visited = state.visited.map(row => row.map(() => false));
                save();
                renderBoard();
            }
        });
    }

    function toggleTheme() {
        document.documentElement.classList.toggle('dark');
    }

    return {
        init, toggleEditMode, handleTileClick,
        renameTeam, editScore, modScore,
        saveEdit, closeEditModal,
        openPlayModal, closePlayModal, revealAnswer, startTimer,
        exportData, importData, closeDataModal,
        resetBoardState, toggleTheme,
        showLandingPage, startNewBlankGame, saveToCustomGames
    };
})();

// Initialize Game
Jeopardy.init();
