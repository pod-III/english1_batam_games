// --- 1. STATE & DEFAULT A1 DATA ---
// --- LOCAL STORAGE ---
const STORAGE_KEY = 'english1-poster-state';

const state = {
    modules: [],
    editingId: null,
    zoom: 1,
    modalCallback: null
};

const defaultModules = [
    // { id: 1, type: 'vocab', size: 'mini', color: 'green', title: 'Fruit', data: 'Apple\nBanana\nOrange' },
    // { id: 2, type: 'vocab', size: 'mini', color: 'pink', title: 'Colors', data: 'Red\nBlue\nGreen' },
    // { id: 3, type: 'vocab', size: 'mini', color: 'orange', title: 'Days', data: 'Monday\nTuesday\nFriday' },
    // { id: 4, type: 'vocab', size: 'mini', color: 'blue', title: 'Verbs', data: 'Run\nJump\nSleep' },
    // { id: 5, type: 'grammar_structure', size: 'medium', color: 'blue', title: 'Present Continuous', data: { formula: 'Subject | + | am/is/are | + | Verb-ing', examples: '"I am eating."' } },
    // { id: 6, type: 'text', size: 'medium', color: 'orange', title: 'Greetings', data: { prompt: 'How are you?', body: 'I am fine.\nI am great.\nNot bad.' } },
];

let modules = state.modules
let editingId = state.editingId;
let zoomLevel = state.zoom;
let modalCallback = state.modalCallback;

// --- 2. RENDER FUNCTIONS ---

function renderPoster() {
    const grid = document.getElementById('poster-grid');
    grid.innerHTML = '';

    modules.forEach(mod => {
        const el = document.createElement('div');

        // NEW SIZING LOGIC FOR 24-GRID
        let colClass = 'col-span-6'; // Small (default, 1/4)
        if (mod.size === 'mini') colClass = 'col-span-3'; // 1/8
        if (mod.size === 'third') colClass = 'col-span-8'; // 1/3
        if (mod.size === 'medium') colClass = 'col-span-12'; // 1/2
        if (mod.size === 'wide') colClass = 'col-span-16'; // 2/3
        if (mod.size === 'large') colClass = 'col-span-18'; // 3/4
        if (mod.size === 'full') colClass = 'col-span-24'; // Full

        el.className = `${colClass} flex flex-col h-full animate-fade-in`;
        el.innerHTML = getModuleHTML(mod);
        grid.appendChild(el);
    });
    lucide.createIcons();
    updateEmptyState();
    updateLayerCount();
}

function getModuleHTML(mod) {
    const colors = {
        pink: 'bg-brand-pink border-brand-dark dark:border-white',
        orange: 'bg-brand-orange border-brand-dark dark:border-white',
        green: 'bg-brand-green border-brand-dark dark:border-white',
        blue: 'bg-brand-blue border-brand-dark dark:border-white',
        dark: 'bg-brand-dark border-brand-dark dark:border-white',
    };
    const textColors = {
        pink: 'text-brand-pink', orange: 'text-brand-orange',
        green: 'text-brand-green', blue: 'text-brand-blue', dark: 'text-brand-dark'
    };

    const isMini = mod.size === 'mini';
    const paddingClass = isMini ? 'p-3' : 'p-6';
    const headerPadding = isMini ? 'p-1.5 mx-2 text-xs' : 'p-2 mx-4 text-center';
    const wrapperClass = `bg-white dark:bg-slate-800 border-4 border-brand-dark dark:border-white rounded-xl shadow-neo relative flex-1 flex flex-col overflow-hidden transition-colors h-full`;
    const headerClass = `${colors[mod.color]} ${headerPadding} mb-2 border-b-4 border-brand-dark dark:border-slate-900 rounded-t-lg shadow-sm truncate`;
    const pinClass = `corkboard-pin bg-brand-dark border-2 border-white dark:border-slate-300`;

    // 1. VOCABULARY
    if (mod.type === 'vocab') {
        const items = mod.data.split('\n').filter(i => i.trim()).map(i =>
            `<li class="flex items-center gap-2"><div class="${isMini ? 'w-2 h-2' : 'w-2.5 h-2.5'} rounded-full shrink-0 border border-brand-dark/20 ${colors[mod.color]}"></div><span class="truncate">${i}</span></li>`
        ).join('');

        return `
                    <section class="${wrapperClass} ${isMini ? 'pt-4' : 'pt-6'}">
                        <div class="${pinClass}" style="${isMini ? 'top: 8px;' : 'top: 12px;'}"></div>
                        <div class="${headerClass}">
                            <h2 class="font-heading ${isMini ? 'text-sm' : 'text-lg'} font-bold text-white uppercase tracking-wide truncate">${mod.title}</h2>
                        </div>
                        <div class="${paddingClass} flex-1 overflow-y-auto">
                            <ul class="space-y-2 ${isMini ? 'text-xs' : 'text-sm'} font-bold text-slate-700 dark:text-slate-200">${items}</ul>
                        </div>
                    </section>`;
    }

    // 2. GRAMMAR STRUCTURE
    if (mod.type === 'grammar_structure') {
        const parts = mod.data.formula.split('|').map(p =>
            `<div class="bg-brand-chalk border-2 border-brand-dark dark:border-slate-400 rounded-lg px-2 py-2 font-bold text-slate-700 text-sm shadow-sm text-center min-w-[40px] flex-1 whitespace-nowrap">${p.trim()}</div>`
        ).join('');

        return `
                    <section class="${colors[mod.color]} border-4 border-brand-dark dark:border-white rounded-xl shadow-neo p-0 relative overflow-hidden flex-1 flex flex-col transition-all h-full">
                         <div class="bg-brand-dark ${isMini ? 'p-2' : 'p-3'} flex justify-between items-center relative z-10 border-b-2 border-white/20">
                            <h2 class="font-heading ${isMini ? 'text-sm' : 'text-lg'} font-bold text-white uppercase flex items-center gap-2 truncate">
                                <i data-lucide="blocks" class="${isMini ? 'w-4 h-4' : 'w-5 h-5'} text-white"></i> <span class="truncate">${mod.title}</span>
                            </h2>
                        </div>
                        <div class="${paddingClass} flex-1 flex flex-col justify-center relative z-10 gap-3">
                            <div class="bg-white p-3 rounded-xl border-2 border-brand-dark shadow-sm flex flex-wrap gap-2 items-center justify-center">
                                ${parts}
                            </div>
                            ${!isMini ? `<div class="bg-white/10 p-3 rounded-xl border-2 border-white/20 backdrop-blur-sm text-center">
                                <p class="text-white font-bold text-[10px] mb-1 opacity-80 uppercase tracking-widest">Example</p>
                                <p class="text-white font-bold text-lg italic leading-tight truncate">${mod.data.examples}</p>
                            </div>` : ''}
                        </div>
                    </section>`;
    }

    // 3. GRAMMAR LOGIC
    if (mod.type === 'grammar_logic') {
        return `
                    <section class="${colors[mod.color]} border-4 border-brand-dark dark:border-white rounded-xl shadow-neo p-0 relative overflow-hidden flex-1 flex flex-col transition-all h-full">
                         <div class="bg-brand-dark ${isMini ? 'p-2' : 'p-3'} flex justify-between items-center relative z-10 border-b-2 border-white/20">
                            <h2 class="font-heading ${isMini ? 'text-sm' : 'text-lg'} font-bold text-white uppercase flex items-center gap-2 truncate">
                                <i data-lucide="zap" class="${isMini ? 'w-4 h-4' : 'w-5 h-5'} text-white"></i> <span class="truncate">${mod.title}</span>
                            </h2>
                        </div>
                        <div class="${paddingClass} flex-1 flex flex-col justify-center relative z-10 space-y-3">
                            <div class="bg-white/10 p-3 rounded-xl border-2 border-white/20 backdrop-blur-sm">
                                <p class="text-white text-center font-heading ${isMini ? 'text-sm' : 'text-xl'} font-bold leading-tight">${mod.data.concept}</p>
                            </div>
                            <div class="bg-white border-2 border-brand-dark rounded-lg p-3 shadow-neo-sm transform -rotate-1">
                                <p class="text-slate-500 text-[10px] font-bold uppercase mb-1 tracking-widest">Example</p>
                                <p class="font-bold ${isMini ? 'text-sm' : 'text-lg'} text-slate-800 leading-tight">${mod.data.ex}</p>
                            </div>
                        </div>
                    </section>`;
    }

    // 4. HANDWRITTEN LIST
    if (mod.type === 'grammar_list') {
        const items = mod.data.split('\n').filter(i => i.trim()).map(i => `<p class="leading-snug truncate">"${i.replace(/"/g, '')}"</p>`).join('');
        return `
                     <section class="${colors[mod.color]} border-4 border-brand-dark dark:border-white rounded-xl shadow-neo p-0 flex-1 flex flex-col overflow-hidden transition-all h-full">
                        <div class="bg-brand-dark ${isMini ? 'p-2' : 'p-3'} flex justify-between items-center border-b-2 border-white/20">
                            <h2 class="font-heading ${isMini ? 'text-sm' : 'text-lg'} font-bold text-white uppercase flex items-center gap-2 truncate">
                                <i data-lucide="pen-tool" class="${isMini ? 'w-4 h-4' : 'w-5 h-5'} text-white"></i> <span class="truncate">${mod.title}</span>
                            </h2>
                        </div>
                        <div class="${paddingClass} flex-1 relative bg-[#fff7d1] m-3 rounded-lg border-2 border-brand-dark shadow-sm rotate-1 flex flex-col justify-center">
                            ${!isMini ? '<div class="tape-strip"></div>' : ''}
                            <div class="space-y-3 font-hand ${isMini ? 'text-sm' : 'text-xl'} text-slate-800 text-center leading-relaxed">${items}</div>
                        </div>
                    </section>`;
    }

    // 5. TEXT CHAT
    if (mod.type === 'text') {
        const items = mod.data.body.split('\n').filter(i => i.trim()).map(i =>
            `<li class="flex items-center gap-2"><i data-lucide="message-circle" class="${isMini ? 'w-3 h-3' : 'w-4 h-4'} ${textColors[mod.color]} shrink-0"></i><span class="truncate">${i}</span></li>`
        ).join('');

        return `
                    <section class="${colors[mod.color]} border-4 border-brand-dark dark:border-white rounded-xl shadow-neo flex-1 flex flex-col relative overflow-hidden transition-all h-full">
                        <div class="bg-brand-dark ${isMini ? 'p-2' : 'p-3'} text-center border-b-2 border-white/20">
                            <h2 class="font-heading ${isMini ? 'text-sm' : 'text-lg'} font-bold text-white uppercase truncate">${mod.title}</h2>
                        </div>
                        <div class="${paddingClass} flex flex-col gap-3 flex-1 overflow-y-auto">
                            <div class="bg-white p-3 rounded-tl-xl rounded-tr-xl rounded-br-xl border-2 border-brand-dark shadow-neo-sm">
                                <p class="text-[10px] font-bold text-slate-400 uppercase mb-1 tracking-widest">Prompt</p>
                                <p class="font-bold text-brand-dark leading-tight ${isMini ? 'text-sm' : 'text-lg'} truncate">${mod.data.prompt}</p>
                            </div>
                            <div class="bg-brand-chalk border-2 border-brand-dark rounded-xl shadow-sm border-dashed flex-1 p-3">
                                <ul class="${isMini ? 'text-xs' : 'text-sm'} font-bold text-slate-700 space-y-2">${items}</ul>
                            </div>
                        </div>
                    </section>`;
    }
    return '';
}

function renderEditorList() {
    const list = document.getElementById('module-list');
    list.innerHTML = '';

    modules.forEach((mod, index) => {
        const isActive = editingId === mod.id;
        const el = document.createElement('div');

        // Base class
        let baseClass = `module-item ${isActive ? `active active-${mod.color}` : ''}`;

        el.className = baseClass;
        el.onclick = () => openEditor(mod.id);

        el.innerHTML = `
                    <div class="flex justify-between items-center mb-1">
                        <div class="flex items-center gap-2">
                            <span class="w-2.5 h-2.5 rounded-full bg-brand-${mod.color} border border-brand-dark"></span>
                            <span class="font-heading font-bold text-sm text-brand-dark truncate max-w-[150px]">${mod.title || 'Untitled'}</span>
                        </div>
                        <span class="text-[9px] uppercase font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">${mod.type.replace('grammar_', '')}</span>
                    </div>
                    <div class="flex justify-between items-center pl-4">
                        <span class="text-[10px] text-slate-400 font-bold">${mod.size.charAt(0).toUpperCase() + mod.size.slice(1)}</span>
                        <div class="flex gap-1 group-hover:opacity-100 transition-opacity">
                            <button onclick="duplicateModule(${mod.id}, event)" class="p-1 hover:bg-brand-blue/10 rounded text-brand-blue" title="Duplicate"><i data-lucide="copy" class="w-3 h-3"></i></button>
                            <button onclick="moveModule(${index}, -1, event)" class="p-1 hover:bg-slate-100 rounded text-slate-500" title="Move Up"><i data-lucide="arrow-up" class="w-3 h-3"></i></button>
                            <button onclick="moveModule(${index}, 1, event)" class="p-1 hover:bg-slate-100 rounded text-slate-500" title="Move Down"><i data-lucide="arrow-down" class="w-3 h-3"></i></button>
                            <button onclick="confirmAction('Delete Block', 'Delete this block permanently?', () => performDelete(${mod.id}), 'delete')" class="p-1 hover:bg-red-50 rounded text-slate-400 hover:text-red-500" title="Delete"><i data-lucide="trash-2" class="w-3 h-3"></i></button>
                        </div>
                    </div>
                `;
        list.appendChild(el);
    });
    lucide.createIcons();
    updateEmptyState();
}

function saveState() {
    const state = {
        modules,
        global: {
            badge: document.getElementById('global_badge')?.value || '',
            title: document.getElementById('global_title')?.value || '',
            subtitle: document.getElementById('global_subtitle')?.value || '',
        },
        theme: document.getElementById('poster-area').classList.contains('dark')
            ? 'dark'
            : 'light',
        zoom: zoomLevel
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadState() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;

    try {
        const state = JSON.parse(raw);

        // Modules
        if (Array.isArray(state.modules)) {
            modules = state.modules;
        }

        // Global text
        if (state.global) {
            document.getElementById('global_badge').value = state.global.badge || '';
            document.getElementById('global_title').value = state.global.title || '';
            document.getElementById('global_subtitle').value = state.global.subtitle || '';

            updateGlobal();
        }

        // Theme
        if (state.theme === 'dark') {
            document.getElementById('poster-area').classList.add('dark');
        }

        // Zoom
        if (typeof state.zoom === 'number') {
            zoomLevel = state.zoom;
            document.getElementById('poster-wrapper').style.transform = `scale(${zoomLevel})`;
            document.getElementById('zoom-level').innerText = Math.round(zoomLevel * 100) + '%';
        }

        return true;
    } catch (e) {
        console.warn('Failed to load saved state:', e);
        return false;
    }
}



// --- 3. LOGIC FUNCTIONS ---

function openEditor(id) {
    editingId = id;
    const mod = modules.find(m => m.id === id);
    if (!mod) return;

    // Switch Views
    document.getElementById('global-settings').classList.add('hidden');
    document.getElementById('block-editor').classList.remove('hidden');

    const fields = document.getElementById('editor-fields');

    // Helper to generate Size Buttons
    const sizes = ['mini', 'small', 'third', 'medium', 'wide', 'large', 'full'];
    const sizeButtons = sizes.map(s => {
        const active = mod.size === s ? 'active' : '';
        // Map size names to cleaner display text if needed
        const label = s.charAt(0).toUpperCase() + s.slice(1);
        return `<button onclick="updateModule(${id}, 'size', '${s}')" class="option-btn ${active} flex-1 min-w-[50px]">${label}</button>`;
    }).join('');

    // Helper to generate Color Buttons
    const colors = ['pink', 'orange', 'green', 'blue', 'dark'];
    const colorButtons = colors.map(c => {
        const active = mod.color === c ? 'active' : '';
        return `<button onclick="updateModule(${id}, 'color', '${c}')" class="color-radio ${active} bg-brand-${c}" title="${c}"></button>`;
    }).join('');

    // --- FORM HTML GENERATION ---
    let html = `
        <div class="bg-white p-3 rounded-xl border-2 border-slate-200 shadow-sm space-y-3">
            <div>
                <label class="editor-label">Block Title</label>
                <input type="text" class="editor-input" value="${mod.title}" 
                    oninput="updateModule(${id}, 'title', this.value)" placeholder="e.g. Vocabulary">
            </div>
            <div>
                <label class="editor-label">Color Theme</label>
                <div class="flex flex-wrap gap-2 mt-1">
                    ${colorButtons}
                </div>
            </div>
        </div>

        <div>
            <label class="editor-label">Block Width</label>
            <div class="flex flex-wrap gap-1 p-1 bg-slate-100 rounded-xl border-2 border-slate-200">
                ${sizeButtons}
            </div>
        </div>
    `;

    // --- CONTENT SPECIFIC FIELDS ---
    html += `<div class="bg-white p-3 rounded-xl border-2 border-slate-200 shadow-sm mt-4">`;

    if (mod.type === 'vocab') {
        html += `
            <label class="editor-label">Vocabulary List</label>
            <div class="relative">
                <div class="absolute top-2 right-2 p-1 bg-slate-100 rounded text-[9px] font-bold text-slate-400">One per line</div>
                <textarea rows="5" class="editor-input font-mono text-xs leading-relaxed" 
                    oninput="updateModule(${id}, 'data', this.value)">${mod.data}</textarea>
            </div>`;
    }
    else if (mod.type === 'grammar_structure') {
        html += `
            <label class="editor-label">Formula <span class="text-slate-300 font-normal lowercase">(use | to separate)</span></label>
            <input type="text" class="editor-input mb-3 font-mono text-brand-blue" 
                value='${mod.data.formula}' oninput="updateDeepData(${id}, 'formula', this.value)">
            
            <label class="editor-label">Example Sentence</label>
            <input type="text" class="editor-input" 
                value='${mod.data.examples}' oninput="updateDeepData(${id}, 'examples', this.value)">`;
    }
    else if (mod.type === 'grammar_logic') {
        html += `
            <label class="editor-label">Main Concept / Rule</label>
            <input type="text" class="editor-input mb-3 font-bold" 
                value='${mod.data.concept}' oninput="updateDeepData(${id}, 'concept', this.value)">
            
            <label class="editor-label">Application Example</label>
            <input type="text" class="editor-input" 
                value='${mod.data.ex}' oninput="updateDeepData(${id}, 'ex', this.value)">`;
    }
    else if (mod.type === 'text') {
        html += `
            <label class="editor-label">Header / Prompt</label>
            <input type="text" class="editor-input mb-3" 
                value='${mod.data.prompt}' oninput="updateDeepData(${id}, 'prompt', this.value)">
            
            <label class="editor-label">Body Text</label>
            <textarea rows="4" class="editor-input" 
                oninput="updateDeepData(${id}, 'body', this.value)">${mod.data.body}</textarea>`;
    }
    html += `</div>`; // Close Content Card

    // --- DELETE ZONE ---
    html += `
        <div class="pt-6 mt-2 border-t-2 border-dashed border-slate-200">
            <button onclick="confirmAction('Delete Block', 'Permanently remove this block?', () => performDelete(${mod.id}), 'delete')" 
                class="w-full py-3 bg-red-50 border-2 border-red-100 text-red-400 rounded-xl font-bold hover:bg-red-500 hover:text-white hover:border-brand-dark hover:shadow-neo-sm transition-all flex justify-center items-center gap-2 group">
                <i data-lucide="trash-2" class="w-4 h-4 group-hover:scale-110 transition-transform"></i> 
                <span>Delete Block</span>
            </button>
        </div>
    `;

    fields.innerHTML = html;

    // Re-initialize icons for the new HTML
    lucide.createIcons();
    renderEditorList();
}

function closeEditor() {
    editingId = null;
    // Revert to Global Settings
    document.getElementById('block-editor').classList.add('hidden');
    document.getElementById('global-settings').classList.remove('hidden');
    renderEditorList();
}

function updateGlobal() {
    document.getElementById('view_badge').innerText = document.getElementById('global_badge').value;
    document.getElementById('view_title').innerText = document.getElementById('global_title').value;
    document.getElementById('view_subtitle').innerText = document.getElementById('global_subtitle').value;
}

function updateModule(id, field, value) {
    const mod = modules.find(m => m.id === id);
    if (mod) {
        mod[field] = value;
        renderPoster();
        if (field !== 'data') {
            renderEditorList();
            if (field === 'size' || field === 'color') openEditor(id);
        }
        saveState();
    }
}


function updateDeepData(id, key, value) {
    const mod = modules.find(m => m.id === id);
    if (mod && typeof mod.data === 'object') {
        mod.data[key] = value;
        renderPoster();
        saveState();
    }
}

function addModule(type) {
    const id = Date.now();
    let newMod = { id, type, size: 'small', color: 'green', title: 'New Item', data: '' };
    if (type === 'grammar_logic') newMod = { id, type: 'grammar_logic', size: 'medium', color: 'blue', title: 'New Logic', data: { concept: 'Formula', ex: 'Example' } };
    if (type === 'grammar_structure') newMod = { id, type: 'grammar_structure', size: 'full', color: 'pink', title: 'Structure', data: { formula: 'Subject | + | Verb', examples: 'I run.' } };
    if (type === 'text') newMod = { id, type: 'text', size: 'medium', color: 'orange', title: 'Dialogue', data: { prompt: 'Q?', body: 'A.' } };
    if (type === 'vocab') newMod.data = 'Item 1\nItem 2';

    modules.push(newMod);
    renderEditorList();
    renderPoster();
    openEditor(id);

    // Auto Scroll List
    setTimeout(() => {
        const container = document.getElementById('module-list');
        container.scrollTop = container.scrollHeight;
    }, 50);
    modules.push(newMod);
    renderEditorList();
    renderPoster();
    openEditor(id);
    saveState();
}

function duplicateModule(id, e) {
    e.stopPropagation();
    const mod = modules.find(m => m.id === id);
    if (mod) {
        const newId = Date.now();
        const copy = JSON.parse(JSON.stringify(mod));
        copy.id = newId;
        copy.title += " (Copy)";
        modules.push(copy);
        renderEditorList();
        renderPoster();
    }
    saveState();

}

// --- MODAL SYSTEM ---
function confirmAction(title, msg, callback, type = 'normal') {
    document.getElementById('modal-title').innerText = title;
    document.getElementById('modal-msg').innerText = msg;
    modalCallback = callback;

    const modal = document.getElementById('custom-modal');
    const confirmBtn = document.getElementById('modal-confirm');

    // Style based on type
    if (type === 'delete') {
        confirmBtn.className = "flex-1 py-3 border-2 border-brand-dark bg-brand-pink text-white rounded-xl font-bold shadow-neo-sm hover:translate-y-0.5 hover:shadow-none transition-all flex justify-center items-center gap-2";
        confirmBtn.innerHTML = "<span>Yes, Delete</span>";
    } else if (type === 'reset') {
        confirmBtn.className = "flex-1 py-3 border-2 border-brand-dark bg-brand-orange text-white rounded-xl font-bold shadow-neo-sm hover:translate-y-0.5 hover:shadow-none transition-all flex justify-center items-center gap-2";
        confirmBtn.innerHTML = "<span>Yes, Reset</span>";
    } else {
        confirmBtn.className = "flex-1 py-3 border-2 border-brand-dark bg-brand-blue text-white rounded-xl font-bold shadow-neo-sm hover:translate-y-0.5 hover:shadow-none transition-all flex justify-center items-center gap-2";
        confirmBtn.innerHTML = "<span>Confirm</span>";
    }

    modal.classList.remove('hidden', 'opacity-0', 'pointer-events-none');
    modal.querySelector('div').classList.remove('scale-95');
    modal.querySelector('div').classList.add('scale-100');

    document.getElementById('modal-confirm').onclick = () => {
        if (modalCallback) modalCallback();
        closeModal();
    };
}

function closeModal() {
    const modal = document.getElementById('custom-modal');
    modal.classList.add('opacity-0', 'pointer-events-none');
    modal.querySelector('div').classList.remove('scale-100');
    modal.querySelector('div').classList.add('scale-95');

    setTimeout(() => {
        modal.classList.add('hidden');
    }, 200); // Wait for transition
    modalCallback = null;
}

// --- ACTION HANDLERS ---
function performDelete(id) {
    modules = modules.filter(m => m.id !== id);
    if (editingId === id) closeEditor();
    renderEditorList();
    renderPoster();
    saveState();
}

function clearAll() {
    modules = [];
    closeEditor();
    renderEditorList();
    renderPoster();
    saveState();
}


function resetTemplate() {
    // modules = JSON.parse(JSON.stringify(defaultModules));
    renderEditorList();
    renderPoster();
    saveState();
}


function moveModule(index, direction, e) {
    e.stopPropagation();
    if (index + direction < 0 || index + direction >= modules.length) return;
    const temp = modules[index];
    modules[index] = modules[index + direction];
    modules[index + direction] = temp;
    renderEditorList();
    renderPoster();
    saveState();
}

function updateEmptyState() {
    const empty = document.getElementById('empty-state');
    if (modules.length === 0) empty.classList.remove('hidden');
    else empty.classList.add('hidden');
}

function updateLayerCount() {
    document.getElementById('layer-count').innerText = `${modules.length} block${modules.length !== 1 ? 's' : ''}`;
}

// View Controls
function adjustZoom(delta) {
    zoomLevel = Math.max(0.3, Math.min(1.5, zoomLevel + delta));
    document.getElementById('poster-wrapper').style.transform = `scale(${zoomLevel})`;
    document.getElementById('zoom-level').innerText = Math.round(zoomLevel * 100) + '%';
    saveState();
}

function fitToScreen() {
    // Calculate scale based on container height vs poster height
    const container = document.getElementById('canvas-wrapper');
    const posterHeight = 900 + 48; // height + padding
    const containerHeight = container.clientHeight - 40; // padding
    const scale = Math.min(1, containerHeight / posterHeight);

    zoomLevel = scale;
    document.getElementById('poster-wrapper').style.transform = `scale(${zoomLevel})`;
    document.getElementById('zoom-level').innerText = Math.round(zoomLevel * 100) + '%';
}

function toggleTheme() {
    document.getElementById('poster-area').classList.toggle('dark');
    saveState();
}

function toggleFullScreen() {
    const editor = document.querySelector('aside');
    editor.classList.toggle('hidden');
}


function exportJSON() {
    const data = {
        version: 1,
        modules,
        global: {
            badge: document.getElementById('global_badge')?.value || '',
            title: document.getElementById('global_title')?.value || '',
            subtitle: document.getElementById('global_subtitle')?.value || ''
        },
        theme: document.getElementById('poster-area').classList.contains('dark')
            ? 'dark'
            : 'light',
        zoom: zoomLevel
    };

    const blob = new Blob(
        [JSON.stringify(data, null, 2)],
        { type: 'application/json' }
    );

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');

    a.href = url;
    a.download = `poster-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();

    URL.revokeObjectURL(url);
    a.remove();
}

function handleImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = () => {
        try {
            const data = JSON.parse(reader.result);

            if (!validateImport(data)) {
                alert('Invalid or incompatible file.');
                return;
            }
            if (!confirm('This will replace your current poster. Continue?')) return;

            applyImportedState(data);
            saveState();
            alert('Poster imported successfully!');
        } catch (err) {
            alert('Failed to import JSON file.');
            console.error(err);
        }

        event.target.value = '';
    };

    reader.readAsText(file);
}
function validateImport(data) {
    if (!data || typeof data !== 'object') return false;
    if (!Array.isArray(data.modules)) return false;
    if (!data.global || typeof data.global !== 'object') return false;
    if (typeof data.global.title !== 'string') return false;
    if (!['light', 'dark'].includes(data.theme)) return false;
    if (typeof data.zoom !== 'number') return false;

    return true;
}
function applyImportedState(data) {
    // Modules
    modules = data.modules.map(m => ({
        ...m,
        id: crypto.randomUUID() // prevent ID collisions
    }));

    // Global text
    document.getElementById('global_badge').value = data.global.badge || '';
    document.getElementById('global_title').value = data.global.title || '';
    document.getElementById('global_subtitle').value = data.global.subtitle || '';
    updateGlobal();

    // Theme
    const poster = document.getElementById('poster-area');
    poster.classList.toggle('dark', data.theme === 'dark');

    // Zoom
    zoomLevel = data.zoom;
    document.getElementById('poster-wrapper').style.transform = `scale(${zoomLevel})`;
    document.getElementById('zoom-level').innerText =
        Math.round(zoomLevel * 100) + '%';

    // Reset editor state
    editingId = null;
    closeEditor();

    renderEditorList();
    renderPoster();
}





// Init
const loaded = loadState();

if (!loaded) {
    // modules = JSON.parse(JSON.stringify(defaultModules));
    updateGlobal();
}

renderEditorList();
renderPoster();

// Auto-fit on load
window.addEventListener('load', fitToScreen);
window.addEventListener('resize', fitToScreen);