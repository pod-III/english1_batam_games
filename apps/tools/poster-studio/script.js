// --- 1. CONFIGURATION & REGISTRY ---
const CONFIG = {
    colors: ['pink', 'orange', 'green', 'blue', 'purple', 'red', 'teal', 'indigo'],
    sizes: {
        vocab: { 
            xs: 'text-sm', sm: 'text-lg', md: 'text-2xl', lg: 'text-4xl', 
            xl: 'text-6xl', '2xl': 'text-7xl', '3xl': 'text-8xl' 
        },
        text: { 
            xs: 'text-sm leading-tight', sm: 'text-lg leading-snug', md: 'text-2xl leading-relaxed', 
            lg: 'text-4xl leading-tight', xl: 'text-6xl leading-none', '2xl': 'text-7xl leading-none', '3xl': 'text-8xl leading-none' 
        },
        table: { 
            xs: 'text-[10px]', sm: 'text-xs', md: 'text-base', lg: 'text-xl', 
            xl: 'text-2xl', '2xl': 'text-3xl', '3xl': 'text-4xl' 
        },
        note: { 
            xs: 'text-xl', sm: 'text-2xl', md: 'text-4xl', lg: 'text-6xl', 
            xl: 'text-8xl', '2xl': 'text-9xl', '3xl': 'text-[10rem]' 
        },
        formula: { 
            xs: 'text-lg', sm: 'text-xl', md: 'text-3xl', lg: 'text-5xl', 
            xl: 'text-7xl', '2xl': 'text-8xl', '3xl': 'text-9xl' 
        },
        title: {
            xs: 'text-lg', sm: 'text-xl', md: 'text-2xl', lg: 'text-4xl', 
            xl: 'text-5xl', '2xl': 'text-6xl', '3xl': 'text-7xl'
        }
    }
};

const ModuleRegistry = {
    vocab: {
        icon: 'list', color: 'green', label: 'Vocab',
        default: { list: 'Apple\nBanana\nCherry' },
        inputs: (id, d) => `<label class="l">Items</label><textarea class="inp-area h-32" oninput="Store.updateMod('${id}','data.list',this.value)">${d.list || ''}</textarea>`,
        render: (d, c, fs) => `<ul class="p-6 h-full flex flex-col justify-center" style="background: var(--surface-card)">${(d.list || '').split('\n').map(x => `<li class="flex items-center gap-4 mb-2"><div class="w-4 h-4 bg-brand-${c} shrink-0" style="border: 1px solid var(--border-primary); box-shadow: 1px 1px 0 0 var(--border-primary)"></div><span class="font-body font-bold ${CONFIG.sizes.vocab[fs] || CONFIG.sizes.vocab.md}" style="color: var(--text-primary)">${x}</span></li>`).join('')}</ul>`
    },
    dodont: {
        icon: 'shield-alert', color: 'red', label: "Do's/Don'ts",
        default: { wrong: 'I go to home.', correct: 'I go home.' },
        inputs: (id, d) => `
            <label class="l text-red-500">Don't Say (Wrong)</label>
            <textarea class="inp-area h-20 mb-2" style="background-color: var(--bg-brand-red-tint)" oninput="Store.updateMod('${id}','data.wrong',this.value)">${d.wrong || ''}</textarea>
            <label class="l text-green-500">Do Say (Correct)</label>
            <textarea class="inp-area h-20" style="background-color: var(--bg-brand-green-tint)" oninput="Store.updateMod('${id}','data.correct',this.value)">${d.correct || ''}</textarea>
        `,
        render: (d, c, fs) => {
            const fontClasses = {
                xs: 'text-lg', sm: 'text-xl', md: 'text-3xl', lg: 'text-5xl', xl: 'text-6xl', '2xl': 'text-7xl', '3xl': 'text-8xl'
            };
            const fCls = fontClasses[fs] || fontClasses.md;
            return `
            <div class="h-full flex flex-col">
                <div class="flex-1 p-4 flex flex-col justify-center items-center text-center relative" style="background-color: var(--bg-brand-red-tint); border-bottom: 2px solid var(--border-primary)">
                    <div class="absolute top-2 left-2 p-1 bg-red-500 text-white rounded shadow-sm"><i data-lucide="x" class="w-4 h-4"></i></div>
                    <p class="font-heading font-black text-brand-red opacity-50 text-xs uppercase tracking-widest mb-1">DON'T SAY</p>
                    <p class="font-hand ${fCls} line-through decoration-brand-red decoration-4" style="color: var(--text-primary)">${d.wrong || ''}</p>
                </div>
                <div class="flex-1 p-4 flex flex-col justify-center items-center text-center relative" style="background-color: var(--bg-brand-green-tint)">
                    <div class="absolute top-2 left-2 p-1 bg-brand-green text-brand-dark rounded shadow-sm"><i data-lucide="check" class="w-4 h-4"></i></div>
                    <p class="font-heading font-black text-brand-green opacity-50 text-xs uppercase tracking-widest mb-1">DO SAY</p>
                    <p class="font-hand ${fCls}" style="color: var(--text-primary)">${d.correct || ''}</p>
                </div>
            </div>`;
        }
    },
    comic: {
        icon: 'film', color: 'pink', label: 'Comic',
        default: { cap1: 'First...', cap2: 'Then...', cap3: 'Finally...' },
        inputs: (id, d) => {
            const mkPanel = (n) => {
                const img = Store.imgCache.get(d[`img${n}`]) || '';
                return `
                <div class="p-2 rounded-lg mb-2 border-2" style="background-color: var(--bg-tertiary); border-color: var(--border-secondary)">
                    <label class="l">Panel ${n}</label>
                    <div class="flex gap-2 mb-2 h-16">
                        <div onclick="App.openImageSelector('${id}', 'img${n}')" class="w-16 h-16 border rounded cursor-pointer flex items-center justify-center overflow-hidden hover:border-brand-dark relative group" style="background-color: var(--surface-card); border-color: var(--border-secondary)">
                            ${img ? `<img src="${img}" class="w-full h-full object-cover">` : `<i data-lucide="image-plus" class="w-4 h-4 text-slate-300"></i>`}
                            <div class="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 flex items-center justify-center"><i data-lucide="edit" class="w-4 h-4 text-white drop-shadow"></i></div>
                        </div>
                        <textarea class="inp-area h-full flex-1 text-xs" oninput="Store.updateMod('${id}','data.cap${n}',this.value)" placeholder="Caption...">${d[`cap${n}`] || ''}</textarea>
                    </div>
                </div>`;
            }
            return `<div>${mkPanel(1)}${mkPanel(2)}${mkPanel(3)}</div>`;
        },
        render: (d, c, fs) => {
            const fontClasses = {
                xs: 'text-sm', sm: 'text-lg', md: 'text-xl', lg: 'text-2xl', xl: 'text-3xl', '2xl': 'text-4xl', '3xl': 'text-5xl'
            };
            const fCls = fontClasses[fs] || fontClasses.md;
            const mkP = (n) => {
                const imgId = d[`img${n}`];
                const src = Store.imgCache.get(imgId);
                return `
                <div class="flex-1 flex flex-col gap-2 min-w-[50px]">
                    <div class="aspect-square border-4 rounded-xl overflow-hidden relative shadow-sm" style="background-color: var(--bg-slate-tint); border-color: var(--border-primary)">
                        ${imgId ? `<img data-idb-id="${imgId}" src="${src || ''}" class="w-full h-full object-cover">` : ''}
                        <div class="absolute top-2 left-2 bg-brand-dark text-white font-black text-xs w-6 h-6 flex items-center justify-center rounded-full">${n}</div>
                    </div>
                    <div class="border-2 rounded-xl p-3 shadow-neo-sm min-h-[4rem] flex items-center justify-center text-center" style="background: var(--surface-card); border-color: var(--border-primary)">
                        <p class="font-hand font-bold ${fCls} leading-tight" style="color: var(--text-primary)">${d[`cap${n}`] || ''}</p>
                    </div>
                </div>`;
            };
            return `<div class="h-full flex gap-4 p-4 items-center justify-center">${mkP(1)}${mkP(2)}${mkP(3)}</div>`;
        }
    },
    grammar_structure: {
        icon: 'layers', color: 'blue', label: 'Formula',
        default: { formula: 'S + V + O', example: 'I eat apples.' },
        inputs: (id, d) => `<label class="l">Formula</label><input class="inp font-heading font-black text-xl mb-2" value="${d.formula || ''}" oninput="Store.updateMod('${id}','data.formula',this.value)"><label class="l">Example</label><textarea class="inp-area font-hand text-xl h-24" oninput="Store.updateMod('${id}','data.example',this.value)">${d.example || ''}</textarea>`,
        render: (d, c, fs) => `<div class="p-8 text-center h-full flex flex-col justify-center" style="background: var(--surface-card)"><div class="mb-4 font-heading font-black text-brand-${c} px-6 py-4 rounded-xl border-2 border-brand-${c} border-dashed ${CONFIG.sizes.formula[fs] || CONFIG.sizes.formula.md}" style="background-color: var(--bg-brand-${c}-tint)">${d.formula || ''}</div><p class="font-hand opacity-80 ${fs === 'xs' ? 'text-lg' : (fs === 'sm' ? 'text-xl' : (fs === 'md' ? 'text-3xl' : 'text-5xl'))}" style="color: var(--text-secondary)">"${d.example || ''}"</p></div>`
    },
    text: {
        icon: 'message-square', color: 'orange', label: 'Text',
        default: { text: 'Type your content here...' },
        inputs: (id, d) => `<label class="l">Content</label><textarea class="inp-area h-40" oninput="Store.updateMod('${id}','data.text',this.value)">${d.text || ''}</textarea>`,
        render: (d, c, fs) => `<div class="p-6 font-body whitespace-pre-line h-full flex flex-col justify-center ${CONFIG.sizes.text[fs] || CONFIG.sizes.text.md}" style="background: var(--surface-card); color: var(--text-secondary)">${d.text || ''}</div>`
    },
    dialogue: {
        icon: 'message-circle', color: 'teal', label: 'Dialogue',
        default: { text: "A: Hello!\nB: Hi there!\nA: How are you?" },
        inputs: (id, d) => `<label class="l">Dialogue (Prefix with A: or B:)</label><textarea class="inp-area h-40" oninput="Store.updateMod('${id}','data.text',this.value)">${d.text || ''}</textarea>`,
        render: (d, c, fs) => {
            const lines = (d.text || '').split('\n');
            const bubbles = lines.map(line => {
                const isB = line.trim().startsWith('B:');
                const txt = line.replace(/^[AB]:\s*/, '');
                if (!txt.trim()) return '';
                return `<div class="flex w-full mb-3 ${isB ? 'justify-end' : 'justify-start'}">
                    <div class="${isB ? 'bg-brand-blue text-white rounded-br-none' : 'bg-brand-pink text-brand-dark rounded-bl-none'} px-6 py-3 rounded-3xl border-2 border-brand-dark shadow-[2px_2px_0px_0px_rgba(30,41,59,1)] max-w-[80%] font-body font-bold ${CONFIG.sizes.text[fs] || 'text-2xl'}">${txt}</div>
                </div>`;
            }).join('');
            return `<div class="p-6 h-full flex flex-col justify-center overflow-y-auto custom-scrollbar bg-graph-paper" style="background-color: var(--surface-card)">${bubbles}</div>`
        }
    },
    table: {
        icon: 'grid-3x3', color: 'purple', label: 'Table',
        default: { content: 'Head | Head\nCell | Cell' },
        inputs: (id, d) => `<label class="l">Data (use | for cols)</label><textarea class="inp-area font-mono text-xs h-32" oninput="Store.updateMod('${id}','data.content',this.value)">${d.content || ''}</textarea>`,
        render: (d, c, fs) => {
            const rows = (d.content || '').split('\n').filter(r => r.trim());
            const trs = rows.map((r, i) => {
                const cols = r.split('|');
                if (i === 0) return `<tr class="bg-brand-${c} text-white">${cols.map(x => `<td class="p-2 font-heading font-black uppercase ${fs === 'xl' || fs === '2xl' || fs === '3xl' ? 'text-2xl' : 'text-sm'}" style="border-bottom: 4px solid var(--border-primary)">${x}</td>`).join('')}</tr>`;
                return `<tr class="" style="background-color: ${i % 2 === 0 ? 'transparent' : `var(--bg-brand-${c}-tint)`}">${cols.map(x => `<td class="p-2 border font-bold border-brand-dark ${CONFIG.sizes.table[fs] || CONFIG.sizes.table.md}" style="color: var(--text-secondary); border-color: var(--border-primary)">${x}</td>`).join('')}</tr>`;
            }).join('');
            return `<div class="h-full overflow-hidden" style="background: var(--surface-card)"><table class="w-full text-left border-collapse">${trs}</table></div>`;
        }
    },
    note: {
        icon: 'sticky-note', color: 'red', label: 'Note',
        default: { text: 'Reminder!' },
        inputs: (id, d) => `<label class="l">Note Text</label><textarea class="inp-area font-hand text-xl bg-yellow-50 border-none" oninput="Store.updateMod('${id}','data.text',this.value)">${d.text || ''}</textarea>`,
        render: (d, c, fs) => `<div class="p-8 h-full flex items-center justify-center relative" style="background-color: var(--bg-brand-yellow-tint)"><div class="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-red-500 shadow-sm -mt-3 z-10" style="border: 2px solid var(--border-primary)"></div><p class="font-hand text-center leading-normal rotate-1 ${CONFIG.sizes.note[fs] || CONFIG.sizes.note.md}" style="color: var(--text-primary)">${d.text || ''}</p></div>`
    },
    image: {
        icon: 'image', color: 'teal', label: 'Image',
        default: { url: '', imageId: null },
        inputs: (id, d) => {
            const img = Store.imgCache.get(d.imageId) || d.url;
            return `
                <label class="l">Image Source</label>
                <div class="mb-2 relative w-full h-32 border-2 border-dashed rounded-xl flex flex-col items-center justify-center overflow-hidden" style="border-color: var(--border-primary); background-color: var(--bg-tertiary)">
                    ${img ? `<img src="${img}" class="absolute inset-0 w-full h-full object-cover opacity-50">` : ''}
                    <div class="relative z-10 flex flex-col items-center gap-2">
                        <button onclick="App.openImageSelector('${id}')" class="neo-btn text-xs px-3 py-2 hover:bg-brand-teal hover:text-white transition-colors" style="background-color: var(--surface-card); color: var(--text-primary)">
                            <i data-lucide="image" class="w-4 h-4 mr-1"></i> ${img ? 'Change Image' : 'Select Image'}
                        </button>
                    </div>
                </div>
                <label class="l">Or External URL</label>
                <input class="inp text-xs" value="${d.url || ''}" oninput="Store.updateMod('${id}','data.url',this.value); Store.updateMod('${id}','data.imageId',null);">
            `;
        },
        render: (d, c, fs) => {
            if (d.imageId) {
                const src = Store.imgCache.get(d.imageId) || ''; 
                return `<div class="w-full h-full flex items-center justify-center overflow-hidden" style="background-color: var(--bg-slate-tint)"><img data-idb-id="${d.imageId}" src="${src}" class="w-full h-full object-cover"></div>`;
            }
            return `<div class="w-full h-full flex items-center justify-center overflow-hidden" style="background-color: var(--bg-slate-tint)"><img src="${d.url}" class="w-full h-full object-cover" onerror="this.src='https://via.placeholder.com/400?text=Select+Image'"></div>`;
        }
    }
};

// --- 2. DATA STORE (DB & STATE) ---
const Store = {
    state: { posters: [], currentId: 'default', theme: 'light' },
    current: null,
    imgCache: new Map(),
    db: null,
    debounce: null,

    async init() {
        // IDB
        Store.db = await new Promise((res, rej) => {
            const req = indexedDB.open('PosterStudioDB', 2);
            req.onupgradeneeded = e => { if (!e.target.result.objectStoreNames.contains('imgs')) e.target.result.createObjectStore('imgs'); };
            req.onsuccess = e => res(e.target.result);
            req.onerror = rej;
        });

        // LocalStorage
        const local = localStorage.getItem('poster-studio-v2');
        if (local) Store.state = JSON.parse(local);

        // Sync from Cloud
        await Store.loadFromCloud();

        if (!Store.state.posters.length) App.createNewPoster();

        Store.loadCurrent();
    },

    loadCurrent() {
        Store.current = Store.state.posters.find(p => p.id === Store.state.currentId) || Store.state.posters[0];
    },

    save(visual = false) {
        Store.current.lastModified = Date.now();
        const idx = Store.state.posters.findIndex(p => p.id === Store.current.id);
        Store.state.posters[idx] = Store.current;
        localStorage.setItem('poster-studio-v2', JSON.stringify(Store.state));
        
        // Sync to Cloud
        Store.syncToCloud();

        if (visual) {
            const btn = document.getElementById('save-btn');
            btn.innerHTML = `<i data-lucide="check" class="w-4 h-4"></i> Saved!`;
            btn.classList.add('bg-brand-green', 'text-brand-dark'); btn.classList.remove('bg-brand-blue', 'text-white');
            setTimeout(() => {
                btn.innerHTML = `<i data-lucide="save" class="w-4 h-4"></i> Save`;
                btn.classList.remove('bg-brand-green', 'text-brand-dark'); btn.classList.add('bg-brand-blue', 'text-white');
                lucide.createIcons();
            }, 1000);
        }
    },

    async syncToCloud() {
        try {
            await saveProgress('poster_studio_data', Store.state);
            console.log("✅ Poster data synced to cloud");
        } catch (e) {
            console.error("Cloud sync failed", e);
        }
    },

    async loadFromCloud() {
        try {
            const data = await loadProgress('poster_studio_data');
            if (data) {
                // Simple merge: keep cloud data as source of truth for projects
                Store.state = data;
                console.log("✅ Poster data loaded from cloud");
            }
        } catch (e) {
            console.error("Cloud load failed", e);
        }
    },

    triggerSave() {
        clearTimeout(Store.debounce);
        Store.debounce = setTimeout(() => Store.save(false), 500);
    },

    // Updates
    updateGlobal(key, val) { Store.current.global[key] = val; Renderer.renderPoster(); }, // Removed full UI update for inputs
    updateMod(id, key, val) {
        const m = Store.current.modules.find(x => x.id === id);
        if (!m) return;
        if (key.includes('.')) { const [p, c] = key.split('.'); m[p][c] = val; }
        else { m[key] = val; }
        Renderer.renderPoster(); Store.triggerSave();
    },

    async uploadImage(input) {
        const file = input.files[0]; if (!file) return;
        
        let imgId;
        const { data: { user } } = await db.auth.getUser();
        if (!isSandbox() && user) {
            try {
                imgId = await uploadMedia(file, 'poster_studio', Store.current.id);
            } catch (err) {
                console.error("Cloud upload failed", err);
            }
        }
        
        if (!imgId) {
            imgId = crypto.randomUUID();
            const blob = new Blob([file], { type: file.type });
            Store.imgCache.set(imgId, URL.createObjectURL(blob));
            const tx = Store.db.transaction('imgs', 'readwrite');
            tx.objectStore('imgs').put(blob, imgId);
        }

        if (App.currentImageModId) {
            const key = App.currentImageKey || 'imageId';
            Store.updateMod(App.currentImageModId, `data.${key}`, imgId);
            if (key === 'imageId') Store.updateMod(App.currentImageModId, 'data.url', null);
            Editor.render(App.currentImageModId);
            App.closeImageLibrary();
        } else {
            App.refreshImageLibrary();
        }
    },
    async deleteImage(id) {
        if (id && id.includes('klasskit-media')) {
            deleteMediaFromUrl(id).catch(e => console.error("Cloud delete failed", e));
        }
        return new Promise(res => {
            const tx = Store.db.transaction('imgs', 'readwrite');
            tx.objectStore('imgs').delete(id);
            tx.oncomplete = () => { Store.imgCache.delete(id); res(); }
        });
    },
    async getAllImages() {
        const images = [];

        // 1. Local IndexedDB
        const localKeys = await new Promise(res => {
            try {
                const tx = Store.db.transaction('imgs', 'readonly');
                const req = tx.objectStore('imgs').getAllKeys();
                req.onsuccess = () => res(req.result);
                req.onerror = () => res([]);
            } catch(e) { res([]); }
        });
        for (const k of localKeys) {
            const url = await Store.getImage(k);
            images.push({ id: k, url });
        }

        // 2. Cloud Storage (if not sandbox)
        const { data: { user } } = await db.auth.getUser();
        if (!isSandbox() && user) {
            try {
                const dir = `${user.id}/poster_studio/${Store.current.id}`;
                const { data: files } = await db.storage.from(STORAGE_CONFIG.bucket).list(dir);
                if (files) {
                    for (const f of files) {
                        if (f.name === '.emptyFolderPlaceholder') continue;
                        const path = `${dir}/${f.name}`;
                        const cloudUrl = `${SUPABASE_URL}/storage/v1/object/public/${STORAGE_CONFIG.bucket}/${path}`;
                        // Check if not already in list (some might be in cache)
                        if (!images.find(x => x.id === cloudUrl)) {
                            images.push({ id: cloudUrl, url: Store.imgCache.get(cloudUrl) || '' });
                        }
                    }
                }
            } catch (e) { console.warn("Cloud image list failed", e); }
        }

        return images;
    },
    async getImage(id) {
        if (!id) return null;
        if (Store.imgCache.has(id)) return Store.imgCache.get(id);
        
        // Cloud URL Support
        if (id.includes('klasskit-media')) {
            const signed = await resolveMediaUrl(id);
            // Don't cache signed URLs long-term as they expire, but keep for session
            Store.imgCache.set(id, signed);
            return signed;
        }

        return new Promise(res => {
            try {
                const tx = Store.db.transaction('imgs', 'readonly');
                const req = tx.objectStore('imgs').get(id);
                req.onsuccess = () => {
                    if (req.result) {
                        const url = URL.createObjectURL(req.result);
                        Store.imgCache.set(id, url);
                        res(url);
                    } else res(null);
                };
                req.onerror = () => res(null);
            } catch(e) { res(null); }
        });
    },

    // Helpers
    moveMod(id, dir) {
        const idx = Store.current.modules.findIndex(m => m.id === id);
        const target = idx + dir;
        if (target >= 0 && target < Store.current.modules.length) {
            const temp = Store.current.modules[idx];
            Store.current.modules[idx] = Store.current.modules[target];
            Store.current.modules[target] = temp;
            Store.save();
            Renderer.renderPoster();
        }
    },
    // Reorder for DnD
    reorderModules(fromIdx, toIdx) {
        if (fromIdx < 0 || fromIdx >= Store.current.modules.length || toIdx < 0 || toIdx >= Store.current.modules.length) return;
        const item = Store.current.modules.splice(fromIdx, 1)[0];
        Store.current.modules.splice(toIdx, 0, item);
        Store.save();
        Renderer.renderPoster();
    }
};

// --- 3. APP CONTROLLER ---
const App = {
    confirmCallback: null,
    currentImageModId: null,
    currentImageKey: 'imageId',
    editingId: null,
    isDragging: false, // Flag to prevent click event

    async init() {
        await requireAuth();
        Store.init().then(() => {
            App.updateUI();
            Renderer.renderPoster();
            App.renderToolbox();
            App.fitToScreen();
            lucide.createIcons();
        });

        // Listeners
        ['title', 'subtitle', 'badge'].forEach(k => {
            document.getElementById(`global_${k}`).addEventListener('input', e => {
                Store.updateGlobal(k, e.target.value);
                Store.triggerSave();
            });
        });

        // Keyboard Shortcuts
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                Store.save(true);
            }
        });
    },

    renderToolbox() {
        const box = document.getElementById('module-toolbox');
        box.innerHTML = Object.entries(ModuleRegistry).map(([k, v]) => `
            <button onclick="App.addModule('${k}')" class="flex flex-col items-center justify-center p-2 min-w-[70px] bg-white border-2 border-brand-dark rounded-xl shadow-[2px_2px_0px_0px_rgba(30,41,59,1)] hover:shadow-none hover:translate-y-0.5 hover:bg-slate-50 transition-all shrink-0 group">
                <i data-lucide="${v.icon}" class="w-5 h-5 text-brand-${v.color} mb-1 group-hover:scale-110 transition-transform"></i>
                <span class="font-heading font-bold text-[10px] text-slate-600 uppercase leading-none">${v.label}</span>
            </button>
        `).join('');
        lucide.createIcons();
    },

    updateUI() {
        const g = Store.current.global;
        document.getElementById('global_title').value = g.title;
        document.getElementById('global_subtitle').value = g.subtitle;
        document.getElementById('global_badge').value = g.badge;

        const sel = document.getElementById('project-select');
        sel.innerHTML = Store.state.posters.map(p => `<option value="${p.id}" ${p.id === Store.current.id ? 'selected' : ''}>${p.global.title}</option>`).join('');
    },

    // Logic
    addModule(type) {
        const cfg = ModuleRegistry[type];
        const mod = {
            id: crypto.randomUUID(), type, title: cfg.label,
            color: cfg.color, size: 'md', height: 'auto', fontSize: 'md',
            data: JSON.parse(JSON.stringify(cfg.default))
        };
        Store.current.modules.push(mod);
        Store.save();
        Renderer.renderPoster();

        // Automatically open the editor for the new module
        App.openEditor(mod.id);
    },

    // EDITING INTERACTION
    openEditor(id) {
        // Safety check: Don't open if dragging just finished
        if (App.isDragging) return;

        App.editingId = id;
        const m = Store.current.modules.find(x => x.id === id);
        if (!m) return;

        document.getElementById('editor-title').innerText = `Edit ${m.title}`;
        document.getElementById('editor-modal').classList.remove('hidden');
        document.getElementById('editor-modal').classList.add('flex');

        Editor.render(id);
    },
    closeEditor() {
        App.editingId = null;
        document.getElementById('editor-modal').classList.add('hidden');
        document.getElementById('editor-modal').classList.remove('flex');
    },

    deleteCurrent() {
        if (!App.editingId) return;
        App.showConfirm('Delete this layer?', () => {
            Store.current.modules = Store.current.modules.filter(m => m.id !== App.editingId);
            Store.save();
            Renderer.renderPoster();
            App.closeEditor();
        });
    },
    duplicateCurrent() {
        if (!App.editingId) return;
        const idx = Store.current.modules.findIndex(m => m.id === App.editingId);
        const original = Store.current.modules[idx];
        const copy = JSON.parse(JSON.stringify(original));
        copy.id = crypto.randomUUID();
        Store.current.modules.splice(idx + 1, 0, copy);
        Store.save();
        Renderer.renderPoster();
        App.closeEditor();
    },
    moveModule(dir) {
        if (!App.editingId) return;
        Store.moveMod(App.editingId, dir);
    },
    showConfirm(msg, callback) {
        document.getElementById('confirm-msg').innerText = msg;
        App.confirmCallback = callback;
        document.getElementById('confirm-modal').classList.remove('hidden');
        document.getElementById('confirm-modal').classList.add('flex');
    },
    closeConfirm() {
        document.getElementById('confirm-modal').classList.add('hidden');
        document.getElementById('confirm-modal').classList.remove('flex');
        App.confirmCallback = null;
    },
    handleConfirmYes() { if (App.confirmCallback) App.confirmCallback(); App.closeConfirm(); },
    toggleHelp() {
        const el = document.getElementById('help-modal');
        if (el.classList.contains('hidden')) { el.classList.remove('hidden'); el.classList.add('flex'); } else { el.classList.add('hidden'); el.classList.remove('flex'); }
    },
    openImageSelector(modId, key = 'imageId') {
        App.currentImageModId = modId;
        App.currentImageKey = key;
        document.getElementById('image-modal').classList.remove('hidden');
        App.refreshImageLibrary();
    },
    closeImageLibrary() {
        document.getElementById('image-modal').classList.add('hidden');
        App.currentImageModId = null;
        App.currentImageKey = 'imageId';
    },
    handleImageUpload(input) { Store.uploadImage(input); input.value = ''; },
    async refreshImageLibrary() {
        const grid = document.getElementById('image-grid');
        grid.innerHTML = '<div class="col-span-full text-center p-4 text-slate-400 font-bold">Loading...</div>';
        const images = await Store.getAllImages();
        if (images.length === 0) { grid.innerHTML = '<div class="col-span-full text-center p-8 text-slate-400 font-bold border-2 border-dashed border-slate-300 rounded-xl">No images</div>'; return; }
        grid.innerHTML = images.map(img => `
            <div class="relative group aspect-square bg-slate-200 rounded-xl border-2 border-brand-dark overflow-hidden cursor-pointer shadow-sm hover:shadow-neo-sm transition-all" onclick="App.selectImage('${img.id}')">
                <img data-original-src="${img.id}" src="${img.url || ''}" class="w-full h-full object-cover">
                <button onclick="event.stopPropagation(); App.deleteImageAsset('${img.id}')" class="absolute top-1 right-1 p-1 bg-red-500 text-white rounded border border-brand-dark opacity-0 group-hover:opacity-100 transition-opacity"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
            </div>`).join('');
        lucide.createIcons();
        
        // Post-resolve images
        const imgs = grid.querySelectorAll('img[data-original-src]');
        for (const img of imgs) {
            const original = img.dataset.originalSrc;
            Store.getImage(original).then(src => { if (src) img.src = src; });
        }
    },
    selectImage(imgId) {
        if (App.currentImageModId) {
            const key = App.currentImageKey || 'imageId';
            Store.updateMod(App.currentImageModId, `data.${key}`, imgId);
            if (key === 'imageId') Store.updateMod(App.currentImageModId, 'data.url', null);
            Editor.render(App.currentImageModId);
            App.closeImageLibrary();
        }
    },
    deleteImageAsset(id) { if (confirm('Delete image?')) Store.deleteImage(id).then(App.refreshImageLibrary); },
    switchPoster(id) { Store.state.currentId = id; Store.loadCurrent(); App.updateUI(); Renderer.renderPoster(); App.fitToScreen(); },
    createNewPoster() {
        const newP = { id: crypto.randomUUID(), lastModified: Date.now(), zoom: 0.5, global: { title: 'UNTITLED', subtitle: 'New Project', badge: '1' }, modules: [] };
        Store.state.posters.push(newP); App.switchPoster(newP.id);
    },
    cyclePoster(dir) {
        const idx = Store.state.posters.findIndex(p => p.id === Store.current.id);
        let next = idx + dir;
        if (next >= Store.state.posters.length) next = 0; if (next < 0) next = Store.state.posters.length - 1;
        App.switchPoster(Store.state.posters[next].id);
    },
    toggleFullScreen() { document.body.classList.toggle('zen-mode'); setTimeout(App.fitToScreen, 300); },
    toggleTheme() {
        document.documentElement.classList.toggle('dark');
        const isDark = document.documentElement.classList.contains('dark');
        localStorage.setItem('theme_poster-studio', isDark ? 'dark' : 'light');
        lucide.createIcons();
    },
    changeZoom(d) { Store.current.zoom = Math.max(0.1, Math.min(2, (Store.current.zoom || 0.5) + d)); Renderer.applyZoom(); },
    fitToScreen() {
        const vp = document.getElementById('poster-viewport');
        if (!vp) return;
        const scale = Math.min((vp.clientWidth - 60) / 2560, (vp.clientHeight - 60) / 1440);
        Store.current.zoom = scale; Renderer.applyZoom();
    },
    openLibrary() {
        const list = document.getElementById('library-list');
        list.innerHTML = Store.state.posters.sort((a, b) => b.lastModified - a.lastModified).map(p => `
            <div class="p-3 border-2 ${p.id === Store.current.id ? 'border-brand-blue bg-blue-50' : 'border-slate-200 bg-white hover:border-slate-400'} rounded-xl flex justify-between items-center cursor-pointer" onclick="App.switchPoster('${p.id}'); document.getElementById('library-modal').classList.add('hidden')">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-lg bg-brand-dark text-white font-black flex items-center justify-center">${p.global.badge}</div>
                    <div><h4 class="font-heading font-bold text-sm text-brand-dark">${p.global.title}</h4><span class="text-xs text-slate-500">${p.modules.length} modules</span></div>
                </div>
                ${Store.state.posters.length > 1 ? `<button onclick="event.stopPropagation(); App.deletePoster('${p.id}')" class="p-2 text-slate-300 hover:text-red-500"><i data-lucide="trash-2" class="w-4 h-4"></i></button>` : ''}
            </div>
        `).join('');
        lucide.createIcons();
        document.getElementById('library-modal').classList.remove('hidden');
    },
    async deletePoster(id) { 
        App.showConfirm('Delete Project?', async () => { 
            // Cloud Cleanup
            const { data: { user } } = await db.auth.getUser();
            if (!isSandbox() && user) {
                deleteFolder(`${user.id}/poster_studio/${id}`).catch(e => console.warn("Cloud folder delete failed", e));
            }

            Store.state.posters = Store.state.posters.filter(p => p.id !== id); 
            if (id === Store.current.id) App.switchPoster(Store.state.posters[0].id); 
            else { Store.save(); App.openLibrary(); } 
        }); 
    },
    exportPoster() { const a = document.createElement('a'); a.href = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(Store.current)); a.download = `Poster_${Store.current.global.title}.json`; a.click(); },
    handleFileImport(input) { const f = input.files[0]; if (!f) return; const r = new FileReader(); r.onload = e => { try { const j = JSON.parse(e.target.result); j.id = crypto.randomUUID(); Store.state.posters.push(j); App.switchPoster(j.id); } catch (err) { alert('Invalid file'); } }; r.readAsText(f); },

    // --- DRAG AND DROP HANDLERS ---
    handleDragStart(e, idx) {
        App.isDragging = true;
        e.dataTransfer.setData('text/plain', idx);
        e.dataTransfer.effectAllowed = 'move';
        // Slight delay to allow ghost image to be generated from original
        setTimeout(() => e.target.classList.add('dragging'), 0);
    },
    handleDragEnd(e) {
        e.target.classList.remove('dragging');
        // Use small timeout to ensure click event doesn't fire after drag
        setTimeout(() => App.isDragging = false, 100);
    },
    handleDragOver(e) {
        e.preventDefault(); // Necessary to allow dropping
        e.dataTransfer.dropEffect = 'move';
        const card = e.currentTarget;
        if (!card.classList.contains('drag-over')) card.classList.add('drag-over');
    },
    handleDragLeave(e) {
        e.currentTarget.classList.remove('drag-over');
    },
    handleDrop(e, targetIdx) {
        e.preventDefault();
        e.currentTarget.classList.remove('drag-over');
        const sourceIdx = parseInt(e.dataTransfer.getData('text/plain'));

        if (sourceIdx !== parseInt(targetIdx)) {
            Store.reorderModules(sourceIdx, parseInt(targetIdx));
        }
    }
};

// --- 4. RENDERER (Canvas) ---
const Renderer = {
    renderPoster() {
        const g = Store.current.global;
        const area = document.getElementById('poster-area');
        if (!area) return;

        const header = `
            <div class="col-span-12 row-span-2 flex items-start justify-between pb-4 pointer-events-none" style="border-bottom: 4px solid var(--border-primary)">
                <div><h1 class="font-heading font-black text-8xl leading-none mb-4" style="color: var(--text-primary)">${g.title}</h1><p class="font-body font-bold text-4xl" style="color: var(--text-secondary)">${g.subtitle}</p></div>
                <div class="h-32 min-w-[180px] px-10 flex items-center justify-center bg-brand-yellow border-4 rounded-full shadow-neo transform rotate-2" style="border-color: var(--border-primary)">
                    <span class="font-heading font-black text-6xl text-brand-dark">${g.badge}</span>
                </div>
            </div>`;

        let contentHTML = '';

        if (Store.current.modules.length === 0) {
            contentHTML = `
            <div class="col-span-12 row-span-10 flex items-center justify-center pointer-events-none opacity-30">
                <div class="border-4 border-dashed rounded-3xl p-12 text-center" style="border-color: var(--border-primary)">
                    <i data-lucide="layout" class="w-24 h-24 mx-auto mb-4" style="color: var(--text-primary)"></i>
                    <h3 class="font-heading font-black text-4xl" style="color: var(--text-primary)">EMPTY POSTER</h3>
                    <p class="font-body font-bold text-2xl mt-2">Drop a layer from the bottom dock to begin</p>
                </div>
            </div>`;
        } else {
            contentHTML = Store.current.modules.map((m, idx) => {
                const cfg = ModuleRegistry[m.type];
                if (!cfg) return '';
                const spans = {
                    size: { xs: 'col-span-2', sm: 'col-span-4', md: 'col-span-6', lg: 'col-span-8', xl: 'col-span-10', full: 'col-span-12' },
                    height: { mini: 'row-span-1', short: 'row-span-2', auto: 'row-span-3', tall: 'row-span-6', grand: 'row-span-9', full: 'row-span-12' }
                };
                const fontSize = m.fontSize || 'md';
                const inner = cfg.render(m.data, m.color, fontSize);
                const titleSizeClass = CONFIG.sizes.title[fontSize] || CONFIG.sizes.title.md;

                return `
                    <div 
                        draggable="true"
                        ondragstart="App.handleDragStart(event, '${idx}')"
                        ondragend="App.handleDragEnd(event)"
                        ondragover="App.handleDragOver(event)"
                        ondragleave="App.handleDragLeave(event)"
                        ondrop="App.handleDrop(event, '${idx}')"
                        onclick="App.openEditor('${m.id}')" 
                        class="module-wrapper ${spans.size[m.size] || 'col-span-6'} ${spans.height[m.height] || 'row-span-3'} rounded-2xl overflow-hidden shadow-neo relative flex flex-col group" style="background-color: var(--surface-card); border: 4px solid var(--border-primary)">
                        <div class="bg-brand-${m.color} px-6 py-3 flex justify-between items-center relative z-10 shrink-0" style="border-bottom: 4px solid var(--border-primary)">
                            <h3 class="font-heading font-black text-white ${titleSizeClass} uppercase tracking-wide truncate pointer-events-none">${m.title}</h3>
                            <div class="opacity-0 group-hover:opacity-100 transition-opacity bg-black/20 rounded p-1 flex gap-1 cursor-grab active:cursor-grabbing hover:bg-black/30" onmousedown="event.stopPropagation()">
                                <i data-lucide="move" class="w-5 h-5 text-white"></i>
                            </div>
                        </div>
                        <div class="flex-1 overflow-hidden relative pointer-events-none">${inner}</div>
                        <div class="tape-strip pointer-events-none"></div>
                    </div>`;
            }).join('');
        }

        area.innerHTML = `<div class="p-16 h-full flex flex-col">${header}<div class="flex-1 grid grid-cols-12 grid-rows-12 gap-8 grid-flow-dense pt-6 min-h-0">${contentHTML}</div><div class="mt-auto pt-8 text-center opacity-40 font-heading font-bold text-xl uppercase tracking-[0.3em]" style="color: var(--text-primary)">KlassKit • Educational Resource</div></div>`;

        Renderer.applyZoom();
        Renderer.hydrateImages();
        lucide.createIcons();
    },
    applyZoom() {
        const z = Store.current.zoom || 0.5;
        const wrapper = document.getElementById('poster-wrapper');
        if (wrapper) wrapper.style.transform = `scale(${z})`;
        const zoomDisplay = document.getElementById('zoom-display');
        if (zoomDisplay) zoomDisplay.innerText = `${Math.round(z * 100)}%`;
    },
    async hydrateImages() {
        const imgs = document.querySelectorAll('img[data-idb-id]');
        for (const img of imgs) {
            const id = img.dataset.idbId;
            if (id && id.startsWith('http')) {
                img.src = await resolveMediaUrl(id);
            } else {
                const src = await Store.getImage(id);
                if (src) img.src = src;
            }
        }
    }
};

// --- 5. EDITOR (Modal) ---
const Editor = {
    render(id) {
        const m = Store.current.modules.find(x => x.id === id);
        if (!m) return;
        const cfg = ModuleRegistry[m.type];
        const con = document.getElementById('editor-content');
        if (!con) return;

        // Color Picker
        const colors = CONFIG.colors.map(c => `<button onclick="Store.updateMod('${id}','color','${c}'); Editor.render('${id}')" class="w-8 h-8 rounded-full bg-brand-${c} ${m.color === c ? 'border-4 border-brand-dark scale-110' : 'border-2 border-white opacity-50 ring-2 ring-transparent'}"></button>`).join('');

        // Enhanced Segment Control for Responsiveness
        const mkSeg = (lbl, key, opts) => `
            <div class="mb-3"><label class="lbl">${lbl}</label><div class="grid grid-cols-3 sm:grid-cols-6 gap-1 p-1 rounded-xl border-2" style="background-color: var(--bg-tertiary); border-color: var(--border-secondary)">
            ${opts.map((o, i) => `<button onclick="Store.updateMod('${id}','${key}','${o.v}'); Editor.render('${id}')" class="py-1.5 text-[9px] font-black uppercase rounded-lg border-2 transition-all ${(m[key] || o.def) === o.v ? 'shadow-neo-sm' : 'border-transparent'}" style="background-color: ${(m[key] || o.def) === o.v ? 'var(--text-primary)' : 'var(--surface-card)'}; color: ${(m[key] || o.def) === o.v ? 'var(--bg-primary)' : 'var(--text-secondary)'}; border-color: ${(m[key] || o.def) === o.v ? 'var(--border-primary)' : 'transparent'}">${o.l}</button>`).join('')}
            </div></div>`;

        con.innerHTML = `
            <div class="space-y-6">
                <div>
                    <label class="lbl">Layer Title</label>
                    <input type="text" value="${m.title}" class="w-full font-heading font-black text-2xl text-brand-dark bg-transparent border-b-2 border-slate-200 hover:border-brand-dark focus:border-brand-blue outline-none py-1" oninput="Store.updateMod('${id}','title',this.value)">
                </div>

                <div class="p-4 rounded-xl border-2" style="background-color: var(--bg-primary); border-color: var(--border-secondary)">
                    <label class="lbl mb-2">Style & Color</label>
                    <div class="flex gap-2 mb-4 overflow-x-auto pb-2 custom-scrollbar">${colors}</div>
                    
                    <div class="space-y-1">
                        ${mkSeg('Width', 'size', [
            { v: 'xs', l: 'XS' }, { v: 'sm', l: 'SM' }, { v: 'md', l: 'MD', def: true },
            { v: 'lg', l: 'LG' }, { v: 'xl', l: 'XL' }, { v: 'full', l: 'FULL' }
        ])}
                        ${mkSeg('Height', 'height', [
            { v: 'mini', l: 'XS' }, { v: 'short', l: 'SM' }, { v: 'auto', l: 'MD', def: true },
            { v: 'tall', l: 'LG' }, { v: 'grand', l: 'XL' }, { v: 'full', l: 'MAX' }
        ])}
                    </div>
                    ${mkSeg('Text Size', 'fontSize', [
                        { v: 'xs', l: 'XS' }, { v: 'sm', l: 'SM' }, { v: 'md', l: 'MD', def: true }, 
                        { v: 'lg', l: 'LG' }, { v: 'xl', l: 'XL' }, { v: '2xl', l: '2XL' }, { v: '3xl', l: '3XL' }
                    ])}
                </div>
                
                <div class="p-4 rounded-xl border-2 shadow-neo-sm" style="background-color: var(--surface-card); border-color: var(--border-primary)">
                    ${cfg.inputs(id, m.data)}
                </div>
            </div>`;

        const style = document.createElement('style');
        style.innerHTML = `.lbl { display:block; font-weight:900; font-size:10px; color:var(--text-tertiary); text-transform:uppercase; letter-spacing:0.05em; margin-bottom:4px; } .inp { width:100%; background:transparent; border-bottom:2px dashed var(--border-secondary); outline:none; padding:4px 0; color:var(--text-primary); } .inp:focus { border-color:var(--border-primary); } .inp-area { width:100%; background:var(--bg-primary); border:2px solid var(--border-secondary); border-radius:8px; padding:8px; font-size:14px; outline:none; resize:none; color:var(--text-primary); } .inp-area:focus { border-color:var(--border-primary); background:var(--surface-card); }`;
        con.appendChild(style);
        lucide.createIcons();
    }
};

// Load saved theme preference
(function () {
    const savedTheme = localStorage.getItem('theme_poster-studio');
    if (savedTheme === 'dark') {
        document.documentElement.classList.add('dark');
    }
})();

// BOOT
window.onload = App.init;
