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

        this.clearAllBtn.addEventListener('click', () => this.handleClearAll());
    },

    open() {
        this.modal.classList.remove('hidden');
        this.currentPath = [];
        this.loadData();
    },

    close() {
        this.modal.classList.add('hidden');
    },

    async loadData() {
        this.showLoader();
        this.grid.innerHTML = '';
        this.empty.classList.add('hidden');
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

        // Fetch all files flat if at root, or use cached
        if (this.currentPath.length === 0) {
            // Using recursive list by fetching flat
            // Note: Supabase JS v2 list does not support recursive natively in all versions, 
            // but we can query with search or just list everything if possible.
            // Wait, we'll list folders level by level for simplicity.
            const pathStr = this.currentPath.length > 0 ? `${user.id}/${this.currentPath.join('/')}` : user.id;
            
            const { data, error } = await db.storage.from('klasskit-media').list(pathStr, { limit: 1000 });
            if (error) {
                console.error("Cloud list error", error);
                return;
            }
            
            this.renderCloudLevel(data);
        } else {
            const pathStr = `${user.id}/${this.currentPath.join('/')}`;
            const { data, error } = await db.storage.from('klasskit-media').list(pathStr, { limit: 1000 });
            if (error) return;
            this.renderCloudLevel(data);
        }
        
        this.renderBreadcrumbs();
    },

    async renderCloudLevel(items) {
        this.grid.innerHTML = '';
        if (!items || items.length === 0) {
            this.empty.classList.remove('hidden');
            return;
        }

        // Filter out empty folder placeholders
        const validItems = items.filter(item => item.name !== '.emptyFolderPlaceholder');
        if (validItems.length === 0) {
            this.empty.classList.remove('hidden');
            return;
        }

        this.clearAllBtn.classList.remove('hidden');
        this.clearAllBtn.onclick = () => this.handleClearCloudCurrent();

        for (const item of validItems) {
            // In Supabase, if metadata is null, it's usually a folder
            const isFolder = !item.metadata;
            
            const card = document.createElement('div');
            card.className = "bg-white dark:bg-slate-800 rounded-xl border-2 border-slate-200 dark:border-slate-700 p-3 flex flex-col gap-2 relative group hover:border-blue transition-colors cursor-pointer";
            
            if (isFolder) {
                card.onclick = () => {
                    this.currentPath.push(item.name);
                    this.loadData();
                };
                card.innerHTML = `
                    <div class="flex-1 flex items-center justify-center bg-slate-50 dark:bg-slate-900 rounded-lg aspect-square">
                        <i data-lucide="folder" class="w-12 h-12 text-blue opacity-80"></i>
                    </div>
                    <div class="text-center font-bold text-sm text-slate-700 dark:text-slate-300 truncate w-full" title="${item.name}">${item.name}</div>
                    <button class="delete-btn hidden absolute top-1 right-1 bg-red-500 text-white p-1.5 rounded-lg border-2 border-dark shadow-hard-sm hover:scale-110" title="Delete Folder">
                        <i data-lucide="trash-2" class="w-3 h-3"></i>
                    </button>
                `;
                
                const delBtn = card.querySelector('.delete-btn');
                delBtn.onclick = async (e) => {
                    e.stopPropagation();
                    if(confirm(`Delete folder "${item.name}" and all contents?`)) {
                        await this.deleteCloudFolder(item.name);
                    }
                };
            } else {
                // It's a file. Get signed URL for preview
                card.innerHTML = `
                    <div class="flex-1 flex items-center justify-center bg-slate-100 dark:bg-slate-900 rounded-lg aspect-square overflow-hidden relative">
                        <div class="absolute inset-0 flex items-center justify-center"><i data-lucide="image" class="w-8 h-8 text-slate-300"></i></div>
                        <img class="w-full h-full object-cover relative z-10 opacity-0 transition-opacity duration-300" />
                    </div>
                    <div class="text-center font-bold text-xs text-slate-500 dark:text-slate-400 truncate w-full" title="${item.name}">${item.name}</div>
                    <button class="delete-btn absolute top-1 right-1 bg-red-500 text-white p-1.5 rounded-lg border-2 border-dark shadow-hard-sm hover:scale-110" title="Delete File">
                        <i data-lucide="trash-2" class="w-3 h-3"></i>
                    </button>
                `;
                
                // Fetch image preview async
                this.loadCloudPreview(card.querySelector('img'), item.name);
                
                const delBtn = card.querySelector('.delete-btn');
                delBtn.onclick = async (e) => {
                    e.stopPropagation();
                    if(confirm(`Delete file "${item.name}"?`)) {
                        await this.deleteCloudFile(item.name);
                    }
                };
            }
            this.grid.appendChild(card);
        }
        
        // Show delete buttons on hover for folders
        this.grid.querySelectorAll('.group').forEach(el => {
            el.addEventListener('mouseenter', () => {
                const btn = el.querySelector('.delete-btn');
                if(btn) btn.classList.remove('hidden');
            });
            el.addEventListener('mouseleave', () => {
                const btn = el.querySelector('.delete-btn');
                if(btn) btn.classList.add('hidden');
            });
        });
        
        lucide.createIcons();
    },
    
    async loadCloudPreview(imgEl, fileName) {
        const user = await getUser();
        const pathStr = `${user.id}/${this.currentPath.length > 0 ? this.currentPath.join('/') + '/' : ''}${fileName}`;
        const { data } = await db.storage.from('klasskit-media').createSignedUrl(pathStr, 60);
        if (data && data.signedUrl) {
            imgEl.src = data.signedUrl;
            imgEl.onload = () => imgEl.classList.remove('opacity-0');
        }
    },
    
    async deleteCloudFolder(folderName) {
        const user = await getUser();
        const pathStr = `${user.id}/${this.currentPath.length > 0 ? this.currentPath.join('/') + '/' : ''}${folderName}`;
        this.showLoader();
        await deleteFolder(pathStr);
        this.loadData();
        // Update hub storage badge
        if(typeof StorageManager !== 'undefined') StorageManager.update();
    },
    
    async deleteCloudFile(fileName) {
        const user = await getUser();
        const pathStr = `${user.id}/${this.currentPath.length > 0 ? this.currentPath.join('/') + '/' : ''}${fileName}`;
        this.showLoader();
        await db.storage.from('klasskit-media').remove([pathStr]);
        this.loadData();
        if(typeof StorageManager !== 'undefined') StorageManager.update();
    },
    
    async handleClearCloudCurrent() {
        if (!confirm("Are you sure you want to delete ALL items in this view?")) return;
        
        if (this.currentPath.length === 0) {
            // At root, we need to delete all folders
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
        } else {
            // Delete the current folder we are inside, then go back
            const folderName = this.currentPath.pop();
            await this.deleteCloudFolder(folderName);
        }
    },

    // ---------------------------------------------------------
    // SANDBOX MODE (IndexedDB)
    // ---------------------------------------------------------
    async loadSandboxData() {
        this.clearAllBtn.classList.remove('hidden');
        this.clearAllBtn.onclick = () => this.handleClearSandboxAll();
        
        if (this.currentPath.length === 0) {
            // Show known DBs as folders
            this.renderSandboxRoot();
        } else {
            // Show files in specific DB
            await this.renderSandboxFolder(this.currentPath[0]);
        }
        this.renderBreadcrumbs();
    },
    
    renderSandboxRoot() {
        this.grid.innerHTML = '';
        for (const dbInfo of this.KNOWN_DB_NAMES) {
            const card = document.createElement('div');
            card.className = "bg-white dark:bg-slate-800 rounded-xl border-2 border-slate-200 dark:border-slate-700 p-3 flex flex-col gap-2 relative group hover:border-blue transition-colors cursor-pointer";
            card.onclick = () => {
                this.currentPath.push(dbInfo.name);
                this.loadData();
            };
            card.innerHTML = `
                <div class="flex-1 flex items-center justify-center bg-slate-50 dark:bg-slate-900 rounded-lg aspect-square">
                    <i data-lucide="database" class="w-12 h-12 text-orange opacity-80"></i>
                </div>
                <div class="text-center font-bold text-sm text-slate-700 dark:text-slate-300 truncate w-full" title="${dbInfo.label}">${dbInfo.label}</div>
            `;
            this.grid.appendChild(card);
        }
        lucide.createIcons();
    },
    
    async renderSandboxFolder(dbName) {
        this.grid.innerHTML = '';
        const dbInfo = this.KNOWN_DB_NAMES.find(d => d.name === dbName);
        if (!dbInfo) {
            this.empty.classList.remove('hidden');
            return;
        }

        try {
            const items = await this.getAllFromIDB(dbInfo.name, dbInfo.store);
            if (!items || items.length === 0) {
                this.empty.classList.remove('hidden');
                return;
            }
            
            for (const item of items) {
                const isBlob = item.value instanceof Blob;
                const isDataUrl = typeof item.value === 'string' && item.value.startsWith('data:image');
                const isUrlObj = item.value && item.value.dataUrl; // Some tools wrap it
                
                if (!isBlob && !isDataUrl && !isUrlObj) continue; // Skip non-images
                
                let srcUrl = '';
                if (isBlob) srcUrl = URL.createObjectURL(item.value);
                else if (isDataUrl) srcUrl = item.value;
                else if (isUrlObj) srcUrl = item.value.dataUrl;
                
                const card = document.createElement('div');
                card.className = "bg-white dark:bg-slate-800 rounded-xl border-2 border-slate-200 dark:border-slate-700 p-3 flex flex-col gap-2 relative group";
                
                card.innerHTML = `
                    <div class="flex-1 flex items-center justify-center bg-slate-100 dark:bg-slate-900 rounded-lg aspect-square overflow-hidden relative">
                        <img src="${srcUrl}" class="w-full h-full object-cover relative z-10" />
                    </div>
                    <div class="text-center font-bold text-[10px] text-slate-500 truncate w-full" title="Key: ${item.key}">Key: ${item.key}</div>
                    <button class="delete-btn hidden absolute top-1 right-1 bg-red-500 text-white p-1.5 rounded-lg border-2 border-dark shadow-hard-sm hover:scale-110" title="Delete File">
                        <i data-lucide="trash-2" class="w-3 h-3"></i>
                    </button>
                `;
                
                const delBtn = card.querySelector('.delete-btn');
                delBtn.onclick = async () => {
                    if(confirm("Delete this local file?")) {
                        await this.deleteFromIDB(dbInfo.name, dbInfo.store, item.key);
                        this.loadData();
                        if(typeof StorageManager !== 'undefined') StorageManager.update();
                    }
                };
                this.grid.appendChild(card);
            }
            
            this.grid.querySelectorAll('.group').forEach(el => {
                el.addEventListener('mouseenter', () => el.querySelector('.delete-btn')?.classList.remove('hidden'));
                el.addEventListener('mouseleave', () => el.querySelector('.delete-btn')?.classList.add('hidden'));
            });
            
            lucide.createIcons();
            
            if (this.grid.children.length === 0) {
                this.empty.classList.remove('hidden');
            }
            
        } catch (e) {
            console.error("IDB Error", e);
            this.empty.classList.remove('hidden');
        }
    },
    
    async handleClearSandboxAll() {
        if (!confirm("Are you sure you want to clear this local sandbox data?")) return;
        
        if (this.currentPath.length === 0) {
            // Clear all known DBs
            for (const dbInfo of this.KNOWN_DB_NAMES) {
                await this.clearIDBStore(dbInfo.name, dbInfo.store);
            }
        } else {
            // Clear current DB
            const dbName = this.currentPath[0];
            const dbInfo = this.KNOWN_DB_NAMES.find(d => d.name === dbName);
            if (dbInfo) {
                await this.clearIDBStore(dbInfo.name, dbInfo.store);
            }
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
    renderBreadcrumbs() {
        let html = `
            <button class="hover:text-blue transition-colors flex items-center gap-1" onclick="MediaManager.navigateHome()">
                <i data-lucide="home" class="w-4 h-4"></i> Root
            </button>
        `;
        
        let pathSoFar = [];
        for (let i = 0; i < this.currentPath.length; i++) {
            const part = this.currentPath[i];
            pathSoFar.push(part);
            const isLast = i === this.currentPath.length - 1;
            
            let label = part;
            // Prettify known DB names in sandbox
            if (isSandbox()) {
                const known = this.KNOWN_DB_NAMES.find(d => d.name === part);
                if (known) label = known.label;
            }
            
            html += `<i data-lucide="chevron-right" class="w-3 h-3 text-slate-400"></i>`;
            
            if (isLast) {
                html += `<span class="text-dark dark:text-white">${label}</span>`;
            } else {
                const targetIdx = i;
                html += `
                    <button class="hover:text-blue transition-colors" onclick="MediaManager.navigateTo(${targetIdx})">
                        ${label}
                    </button>
                `;
            }
        }
        
        this.breadcrumbs.innerHTML = html;
        lucide.createIcons();
    },

    navigateHome() {
        this.currentPath = [];
        this.loadData();
    },
    
    navigateTo(index) {
        this.currentPath = this.currentPath.slice(0, index + 1);
        this.loadData();
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
