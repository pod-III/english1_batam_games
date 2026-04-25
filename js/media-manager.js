/**
 * Media Manager Logic for KlassKit
 * Handles both Cloud and Sandbox storage inspection and deletion.
 */

const MediaManager = {
    modal: null,
    grid: null,
    loader: null,
    empty: null,
    breadcrumbs: null,
    usageText: null,
    clearAllBtn: null,
    refreshBtn: null,
    
    currentPath: [], // Array of folder names for cloud. Empty = root.
    cloudFiles: [], // Cache of flat file list from Supabase
    
    KNOWN_DB_NAMES: [
        { name: 'KKPosterStudioDB', label: 'Poster Studio', store: 'images' },
        { name: 'KKThisOrThatDB', label: 'This or That', store: 'image_cache' },
        { name: 'KKMemoryBlockDB', label: 'Memory Block', store: 'image_cache' },
        { name: 'KKPresentationSimpleDB', label: 'Speedy Slides', store: 'media' },
        { name: 'KKPresentationSimpleDB', label: 'Speedy Slides Cache', store: 'image_cache' },
    ],
    
    init() {
        this.modal = document.getElementById('media-manager-modal');
        if (!this.modal) return;

        this.grid = document.getElementById('media-manager-grid');
        this.loader = document.getElementById('media-manager-loader');
        this.empty = document.getElementById('media-manager-empty');
        this.breadcrumbs = document.getElementById('media-breadcrumbs');
        this.usageText = document.getElementById('media-manager-usage');
        this.clearAllBtn = document.getElementById('media-manager-clear-all');
        this.refreshBtn = document.getElementById('media-manager-refresh-btn');

        // Event Listeners
        document.querySelectorAll('[data-action="openMediaManager"]').forEach(btn => {
            btn.addEventListener('click', () => this.open());
        });

        document.querySelectorAll('[data-action="closeMediaManager"]').forEach(btn => {
            btn.addEventListener('click', () => this.close());
        });

        this.refreshBtn.addEventListener('click', () => this.loadData());

        // Clear all button click is handled dynamically in loadCloudData/loadSandboxData
    },

    open() {
        this.modal.classList.remove('hidden');
        this.loadData();
    },

    close() {
        this.modal.classList.add('hidden');
    },

    async loadData() {
        this.showLoader();
        this.grid.innerHTML = '';
        this.empty.classList.add('hidden');
        this.empty.classList.remove('flex');
        this.clearAllBtn.classList.add('hidden');
        
        try {
            const usage = await getUserStorageUsage();
            this.updateUsageText(usage);

            if (isSandbox()) {
                await this.loadSandboxData();
            } else {
                await this.loadCloudData();
            }
        } catch (error) {
            console.error("Media Manager Load Error:", error);
        } finally {
            this.hideLoader();
        }
    },

    updateUsageText(usage) {
        const mbUsed = (usage.used / (1024 * 1024)).toFixed(2);
        if (usage.isSandbox) {
            this.usageText.innerText = `Used: ${mbUsed} MB (Local)`;
        } else {
            const mbLimit = (usage.limit / (1024 * 1024)).toFixed(0);
            this.usageText.innerText = `${mbUsed} MB / ${mbLimit} MB`;
        }
    },

    // ---------------------------------------------------------
    // CLOUD MODE
    // ---------------------------------------------------------
    async loadCloudData() {
        const user = await getUser();
        if (!user) return;

        this.clearAllBtn.classList.remove('hidden');
        this.clearAllBtn.onclick = () => this.handleClearCloudAll();

        this.grid.innerHTML = '';
        // Change grid to a flex container for sections
        this.grid.className = 'h-full overflow-y-auto p-6 flex flex-col gap-8 custom-scrollbar';
        this.breadcrumbs.innerHTML = '<span class="text-dark dark:text-white font-bold">All Cloud Media (Grouped by Tool/Set)</span>';

        const allFiles = await this.fetchAllCloudFiles(user.id);
        
        if (allFiles.length === 0) {
            this.empty.classList.remove('hidden');
            this.empty.classList.add('flex');
            return;
        }

        // Group by relative path
        const groups = {};
        for (const file of allFiles) {
            const parts = file.fullPath.split('/');
            parts.shift(); // remove user_id
            parts.pop(); // remove filename
            const groupName = parts.join('/') || 'Root';
            
            if (!groups[groupName]) groups[groupName] = [];
            groups[groupName].push(file);
        }

        for (const [groupName, files] of Object.entries(groups)) {
            let label = groupName.split('/').map(p => p.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')).join(' > ');
            
            const section = this.createSection(label, async () => {
                if(confirm(`Delete all media in ${label}?`)) {
                    this.showLoader();
                    await deleteFolder(`${user.id}/${groupName}`);
                    this.loadData();
                    if(typeof StorageManager !== 'undefined') StorageManager.update();
                }
            });
            const grid = section.querySelector('.media-grid');

            for (const file of files) {
                grid.appendChild(this.createCloudCard(user.id, file));
            }
            this.grid.appendChild(section);
        }
        
        lucide.createIcons();
    },

    async fetchAllCloudFiles(path, files = []) {
        const { data, error } = await db.storage.from('klasskit-media').list(path, { limit: 1000 });
        if (error || !data) return files;
        
        for (const item of data) {
            if (item.name === '.emptyFolderPlaceholder') continue;
            
            if (!item.metadata) {
                // Folder
                await this.fetchAllCloudFiles(`${path}/${item.name}`, files);
            } else {
                // File
                files.push({ ...item, fullPath: `${path}/${item.name}` });
            }
        }
        return files;
    },

    createCloudCard(userId, file) {
        const card = document.createElement('div');
        card.className = "bg-white dark:bg-slate-800 rounded-2xl border-[3px] border-dark dark:border-slate-600 p-3 flex flex-col gap-2 relative group shadow-hard hover:-translate-y-1 hover:shadow-hard-lg transition-all duration-200 cursor-pointer";
        
        card.innerHTML = `
            <div class="flex-1 flex items-center justify-center bg-slate-100 dark:bg-slate-900 rounded-xl border-2 border-dark/20 dark:border-slate-700/50 aspect-square overflow-hidden relative">
                <div class="absolute inset-0 flex items-center justify-center"><i data-lucide="image" class="w-8 h-8 text-slate-300"></i></div>
                <img class="w-full h-full object-cover relative z-10 opacity-0 transition-opacity duration-300" />
            </div>
            <div class="text-center font-bold text-xs text-slate-500 dark:text-slate-400 truncate w-full px-2" title="${file.name}">${file.name}</div>
            <button class="delete-btn opacity-0 group-hover:opacity-100 absolute -top-3 -right-3 w-10 h-10 bg-red-500 text-white rounded-xl border-3 border-dark dark:border-slate-500 shadow-hard hover:bg-red-600 transition-all z-20 flex items-center justify-center hover:scale-110 btn-chunky" title="Delete File">
                <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
        `;
        
        this.loadCloudPreview(card.querySelector('img'), file.fullPath);
        
        const delBtn = card.querySelector('.delete-btn');
        delBtn.onclick = async (e) => {
            e.stopPropagation();
            if(confirm(`Delete file "${file.name}"?`)) {
                this.showLoader();
                await db.storage.from('klasskit-media').remove([file.fullPath]);
                this.loadData();
                if(typeof StorageManager !== 'undefined') StorageManager.update();
            }
        };

        return card;
    },
    
    async loadCloudPreview(imgEl, fullPath) {
        const { data } = await db.storage.from('klasskit-media').createSignedUrl(fullPath, 60);
        if (data && data.signedUrl) {
            imgEl.src = data.signedUrl;
            imgEl.onload = () => imgEl.classList.remove('opacity-0');
        }
    },
    
    async handleClearCloudAll() {
        if (!confirm("Are you sure you want to delete ALL your cloud media across all tools? This cannot be undone.")) return;
        
        const user = await getUser();
        const { data } = await db.storage.from('klasskit-media').list(user.id);
        if(data) {
            this.showLoader();
            for (const item of data) {
                const pathStr = `${user.id}/${item.name}`;
                if (!item.metadata) {
                    await deleteFolder(pathStr);
                } else {
                    await db.storage.from('klasskit-media').remove([pathStr]);
                }
            }
            this.loadData();
            if(typeof StorageManager !== 'undefined') StorageManager.update();
        }
    },

    // ---------------------------------------------------------
    // SANDBOX MODE (IndexedDB)
    // ---------------------------------------------------------
    async loadSandboxData() {
        this.clearAllBtn.classList.remove('hidden');
        this.clearAllBtn.onclick = () => this.handleClearSandboxAll();
        
        this.grid.innerHTML = '';
        this.grid.className = 'h-full overflow-y-auto p-6 flex flex-col gap-8 custom-scrollbar';
        this.breadcrumbs.innerHTML = '<span class="text-dark dark:text-white font-bold">All Local Media (Grouped by Tool)</span>';
        
        let hasAnyMedia = false;

        for (const dbInfo of this.KNOWN_DB_NAMES) {
            try {
                const items = await this.getAllFromIDB(dbInfo.name, dbInfo.store);
                if (!items || items.length === 0) continue;
                
                const validItems = items.filter(item => {
                    const isBlob = item.value instanceof Blob;
                    const isDataUrl = typeof item.value === 'string' && item.value.startsWith('data:image');
                    const isUrlObj = item.value && item.value.dataUrl;
                    return isBlob || isDataUrl || isUrlObj;
                });
                
                if (validItems.length === 0) continue;
                hasAnyMedia = true;

                const section = this.createSection(dbInfo.label, async () => {
                    if(confirm(`Delete all local media in ${dbInfo.label}?`)) {
                        this.showLoader();
                        await this.clearIDBStore(dbInfo.name, dbInfo.store);
                        this.loadData();
                        if(typeof StorageManager !== 'undefined') StorageManager.update();
                    }
                });
                const grid = section.querySelector('.media-grid');

                for (const item of validItems) {
                    grid.appendChild(this.createSandboxCard(dbInfo, item));
                }
                this.grid.appendChild(section);
            } catch (e) {
                console.error("IDB Error parsing", dbInfo.name, e);
            }
        }
        
        if (!hasAnyMedia) {
            this.empty.classList.remove('hidden');
            this.empty.classList.add('flex');
        }
        
        lucide.createIcons();
    },

    createSandboxCard(dbInfo, item) {
        let srcUrl = '';
        if (item.value instanceof Blob) srcUrl = URL.createObjectURL(item.value);
        else if (typeof item.value === 'string') srcUrl = item.value;
        else if (item.value && item.value.dataUrl) srcUrl = item.value.dataUrl;
        
        const card = document.createElement('div');
        card.className = "bg-white dark:bg-slate-800 rounded-2xl border-[3px] border-dark dark:border-slate-600 p-3 flex flex-col gap-2 relative group shadow-hard hover:-translate-y-1 hover:shadow-hard-lg transition-all duration-200 cursor-pointer";
        
        card.innerHTML = `
            <div class="flex-1 flex items-center justify-center bg-slate-100 dark:bg-slate-900 rounded-xl border-2 border-dark/20 dark:border-slate-700/50 aspect-square overflow-hidden relative">
                <img src="${srcUrl}" class="w-full h-full object-cover relative z-10" />
            </div>
            <div class="text-center font-bold text-[10px] text-slate-500 dark:text-slate-400 truncate w-full px-2" title="${item.key}">${item.key}</div>
            <button class="delete-btn opacity-0 group-hover:opacity-100 absolute -top-3 -right-3 w-10 h-10 bg-red-500 text-white rounded-xl border-3 border-dark dark:border-slate-500 shadow-hard hover:bg-red-600 transition-all z-20 flex items-center justify-center hover:scale-110 btn-chunky" title="Delete File">
                <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
        `;
        
        const delBtn = card.querySelector('.delete-btn');
        delBtn.onclick = async () => {
            if(confirm("Delete this local file?")) {
                this.showLoader();
                await this.deleteFromIDB(dbInfo.name, dbInfo.store, item.key);
                this.loadData();
                if(typeof StorageManager !== 'undefined') StorageManager.update();
            }
        };

        return card;
    },
    
    async handleClearSandboxAll() {
        if (!confirm("Are you sure you want to clear ALL local sandbox data?")) return;
        
        for (const dbInfo of this.KNOWN_DB_NAMES) {
            await this.clearIDBStore(dbInfo.name, dbInfo.store);
        }
        this.loadData();
        if(typeof StorageManager !== 'undefined') StorageManager.update();
    },

    // --- IDB Helpers ---
    openIDB(dbName) {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(dbName);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    },
    
    async getAllFromIDB(dbName, storeName) {
        const db = await this.openIDB(dbName);
        if (!db.objectStoreNames.contains(storeName)) {
            db.close();
            return [];
        }
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const req = store.getAll();
            const keysReq = store.getAllKeys();
            
            tx.oncomplete = () => {
                const results = req.result.map((val, i) => ({
                    key: keysReq.result[i],
                    value: val
                }));
                db.close();
                resolve(results);
            };
            tx.onerror = () => {
                db.close();
                reject(tx.error);
            };
        });
    },
    
    async deleteFromIDB(dbName, storeName, key) {
        const db = await this.openIDB(dbName);
        if (!db.objectStoreNames.contains(storeName)) return;
        return new Promise((resolve) => {
            const tx = db.transaction(storeName, 'readwrite');
            tx.objectStore(storeName).delete(key);
            tx.oncomplete = () => { db.close(); resolve(); };
        });
    },
    
    async clearIDBStore(dbName, storeName) {
        const db = await this.openIDB(dbName);
        if (!db.objectStoreNames.contains(storeName)) return;
        return new Promise((resolve) => {
            const tx = db.transaction(storeName, 'readwrite');
            tx.objectStore(storeName).clear();
            tx.oncomplete = () => { db.close(); resolve(); };
        });
    },

    // ---------------------------------------------------------
    // COMMON UI HELPERS
    // ---------------------------------------------------------
    createSection(title, onClearGroup) {
        const section = document.createElement('div');
        section.className = "flex flex-col gap-4";
        
        const header = document.createElement('div');
        header.className = "flex items-center justify-between border-b-[4px] border-dark dark:border-slate-600 pb-4 mb-2";
        header.innerHTML = `
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 bg-blue text-white rounded-xl border-3 border-dark dark:border-slate-500 flex items-center justify-center shadow-hard-sm">
                    <i data-lucide="folder" class="w-5 h-5"></i>
                </div>
                <h3 class="font-heading font-black text-2xl text-dark dark:text-white tracking-tight uppercase">${title}</h3>
            </div>
            <button class="btn-chunky bg-red-500 text-white w-10 h-10 rounded-xl border-3 border-dark dark:border-slate-500 shadow-hard flex items-center justify-center hover:bg-red-600 transition-colors" title="Clear Group">
                <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
        `;
        
        const clearBtn = header.querySelector('button');
        clearBtn.onclick = onClearGroup;

        const grid = document.createElement('div');
        grid.className = "media-grid grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4";

        section.appendChild(header);
        section.appendChild(grid);
        return section;
    },

    showLoader() {
        this.loader.classList.remove('hidden');
        this.loader.classList.add('flex');
    },

    hideLoader() {
        this.loader.classList.add('hidden');
        this.loader.classList.remove('flex');
    }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    MediaManager.init();
});
