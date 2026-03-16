// ===== GLOBAL STATE =====
let notes = [];
let currentNoteId = null;
let quill;
let isZenMode = false;
let isOutlineOpen = false;
let isTrashMode = false;
let isDarkMode = false;
let db = null;
let blobUrlMap = {}; // blobUrl -> idbKey
let searchCache = null;
let strippedContentCache = new Map();

// ===== UTILITIES =====
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function fastStripHtml(html) {
    if (!html) return "";
    return html.replace(/<[^>]*>?/gm, ' ');
}

// ===== INDEXEDDB SETUP =====
const DB_NAME = 'LessonNotesDB';
const DB_VERSION = 2;
const STORES = {
    IMAGES: 'images',
    NOTES: 'notes',
    SETTINGS: 'settings'
};

function openDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORES.IMAGES)) {
                db.createObjectStore(STORES.IMAGES, { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains(STORES.NOTES)) {
                db.createObjectStore(STORES.NOTES, { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
                db.createObjectStore(STORES.SETTINGS);
            }
        };
        req.onsuccess = (e) => resolve(e.target.result);
        req.onerror = (e) => reject(e.target.error);
    });
}

// --- Image Store Helpers ---
function storeImage(id, arrayBuffer, mimeType) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORES.IMAGES, 'readwrite');
        tx.objectStore(STORES.IMAGES).put({ id, data: arrayBuffer, type: mimeType });
        tx.oncomplete = () => resolve();
        tx.onerror = (e) => reject(e.target.error);
    });
}

function getImage(id) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORES.IMAGES, 'readonly');
        const req = tx.objectStore(STORES.IMAGES).get(id);
        req.onsuccess = () => resolve(req.result);
        req.onerror = (e) => reject(e.target.error);
    });
}

function deleteImage(id) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORES.IMAGES, 'readwrite');
        tx.objectStore(STORES.IMAGES).delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = (e) => reject(e.target.error);
    });
}

// --- Notes Store Helpers ---
function getAllNotes() {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORES.NOTES, 'readonly');
        const req = tx.objectStore(STORES.NOTES).getAll();
        req.onsuccess = () => {
            const result = req.result || [];
            // Sort by updatedAt descending
            resolve(result.sort((a, b) => b.updatedAt - a.updatedAt));
        };
        req.onerror = (e) => reject(e.target.error);
    });
}

function saveNoteToDB(note) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORES.NOTES, 'readwrite');
        tx.objectStore(STORES.NOTES).put(note);
        tx.oncomplete = () => resolve();
        tx.onerror = (e) => reject(e.target.error);
    });
}

function deleteNoteFromDB(id) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORES.NOTES, 'readwrite');
        tx.objectStore(STORES.NOTES).delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = (e) => reject(e.target.error);
    });
}

// --- Settings Store Helpers ---
function getSetting(key) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORES.SETTINGS, 'readonly');
        const req = tx.objectStore(STORES.SETTINGS).get(key);
        req.onsuccess = () => resolve(req.result);
        req.onerror = (e) => reject(e.target.error);
    });
}

function saveSetting(key, value) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORES.SETTINGS, 'readwrite');
        tx.objectStore(STORES.SETTINGS).put(value, key);
        tx.oncomplete = () => resolve();
        tx.onerror = (e) => reject(e.target.error);
    });
}

// --- Migration ---
async function migrateFromLocalStorage() {
    const oldNotes = localStorage.getItem('e1_lesson_notes');
    if (oldNotes) {
        try {
            const parsedNotes = JSON.parse(oldNotes);
            if (Array.isArray(parsedNotes)) {
                for (const note of parsedNotes) {
                    await saveNoteToDB({
                        ...note,
                        deleted: note.deleted || false,
                        updatedAt: note.updatedAt || Date.now()
                    });
                }
            }
            localStorage.removeItem('e1_lesson_notes');
        } catch (e) {
            console.error('Migration failed:', e);
        }
    }

    const oldTheme = localStorage.getItem('e1_theme');
    if (oldTheme) {
        await saveSetting('theme', oldTheme);
        localStorage.removeItem('e1_theme');
    }

    const oldLastActive = localStorage.getItem('e1_last_active_note');
    if (oldLastActive) {
        await saveSetting('lastActiveNoteId', oldLastActive);
        localStorage.removeItem('e1_last_active_note');
    }
}

function arrayBufferToBase64(buf) {
    const bytes = new Uint8Array(buf);
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
}

function base64ToArrayBuffer(b64) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes.buffer;
}

// ===== DARK MODE =====
async function initDarkMode() {
    const saved = await getSetting('theme');
    if (saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        isDarkMode = true;
        document.documentElement.classList.add('dark');
    }
    updateDarkModeUI();
}

async function toggleDarkMode() {
    isDarkMode = !isDarkMode;
    document.documentElement.classList.toggle('dark', isDarkMode);
    await saveSetting('theme', isDarkMode ? 'dark' : 'light');
    updateDarkModeUI();
}

function updateDarkModeUI() {
    const icon = document.getElementById('darkModeIcon');
    const text = document.getElementById('darkModeText');
    if (icon) icon.setAttribute('data-lucide', isDarkMode ? 'sun' : 'moon');
    if (text) text.textContent = isDarkMode ? 'Light' : 'Dark';
    lucide.createIcons();
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', async () => {
    db = await openDB();
    await migrateFromLocalStorage();
    await initDarkMode();
    initQuill();

    notes = await getAllNotes();

    const lastActiveId = await getSetting('lastActiveNoteId');
    const noteToLoad = notes.find(n => n.id === lastActiveId && !n.deleted) || notes.find(n => !n.deleted);

    if (noteToLoad) {
        await loadNote(noteToLoad.id);
    } else {
        await createNewNote();
    }

    renderNotesList();

    document.getElementById('noteTitle').addEventListener('input', () => {
        saveCurrentNote();
        renderNotesList();
    });
    
    quill.on('text-change', (delta, oldDelta, source) => {
        if (source === 'user') {
            const hasImage = delta.ops.some(op => op.insert && op.insert.image);
            if (hasImage) convertBase64ImagesToIDB();
            
            debouncedSave();
            debouncedOutline();
            debouncedRenderList();
        }
    });

    const debouncedSave = debounce(saveCurrentNote, 1000);
    const debouncedOutline = debounce(updateOutline, 1500);
    const debouncedRenderList = debounce(renderNotesList, 500);

    document.getElementById('searchInput').addEventListener('input', renderNotesList);

    lucide.createIcons();
});

// ===== QUILL 2.0 SETUP =====
function initQuill() {
    quill = new Quill('#editor-container', {
        theme: 'snow',
        placeholder: 'Start typing your amazing lesson plan...',
        modules: {
            table: true,
            toolbar: [
                [{ 'header': [1, 2, false] }],
                ['bold', 'italic', 'underline', 'strike'],
                [{ 'list': 'ordered' }, { 'list': 'bullet' }, { 'list': 'check' }],
                [{ 'color': [] }, { 'background': [] }],
                ['link', 'image', 'table'],
                ['clean']
            ]
        }
    });

    // Handle the native table button click
    const toolbar = quill.getModule('toolbar');
    toolbar.addHandler('table', function () {
        openTableDialog();
    });
}

// ===== IMAGE HANDLING =====
function handleImageInsert() {
    document.getElementById('imageInput').click();
}

async function processImageInput(inputEl) {
    const file = inputEl.files[0];
    if (!file) return;
    try {
        const id = `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const arrayBuffer = await file.arrayBuffer();
        await storeImage(id, arrayBuffer, file.type);

        const blob = new Blob([arrayBuffer], { type: file.type });
        const blobUrl = URL.createObjectURL(blob);
        blobUrlMap[blobUrl] = id;

        const range = quill.getSelection(true);
        quill.insertEmbed(range.index, 'image', blobUrl);
        quill.setSelection(range.index + 1);
    } catch (err) {
        console.error('Failed to insert image:', err);
        alert('Failed to insert image. Please try again.');
    }
    inputEl.value = '';
}

async function convertBase64ImagesToIDB() {
    const images = quill.root.querySelectorAll('img[src^="data:"]');
    for (const img of images) {
        const src = img.getAttribute('src');
        const match = src.match(/^data:([^;]+);base64,(.+)$/);
        if (match) {
            try {
                const id = `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
                const arrayBuffer = base64ToArrayBuffer(match[2]);
                await storeImage(id, arrayBuffer, match[1]);
                const blob = new Blob([arrayBuffer], { type: match[1] });
                const blobUrl = URL.createObjectURL(blob);
                blobUrlMap[blobUrl] = id;
                img.setAttribute('src', blobUrl);
            } catch (e) { console.warn('Failed to convert pasted image', e); }
        }
    }
}

function getContentForSave() {
    let html = quill.root.innerHTML;
    for (const [blobUrl, idbKey] of Object.entries(blobUrlMap)) {
        html = html.split(blobUrl).join(`idb://${idbKey}`);
    }
    return html;
}

async function resolveImagesInHtml(html) {
    // Revoke old blob URLs
    for (const url of Object.keys(blobUrlMap)) {
        URL.revokeObjectURL(url);
    }
    blobUrlMap = {};

    const regex = /idb:\/\/([\w_-]+)/g;
    const ids = Array.from(new Set([...html.matchAll(regex)].map(m => m[1])));
    
    if (ids.length === 0) return html;

    const results = await Promise.all(ids.map(async id => {
        try {
            const data = await getImage(id);
            if (data) {
                const blob = new Blob([data.data], { type: data.type });
                const blobUrl = URL.createObjectURL(blob);
                blobUrlMap[blobUrl] = id;
                return { from: `idb://${id}`, to: blobUrl };
            }
        } catch (e) { console.warn('Failed to load image', id); }
        return null;
    }));

    for (const res of results) {
        if (res) html = html.split(res.from).join(res.to);
    }
    return html;
}

async function resolveImagesToBase64(html) {
    const regex = /idb:\/\/([\w_-]+)/g;
    let m;
    const replacements = [];
    while ((m = regex.exec(html)) !== null) {
        try {
            const data = await getImage(m[1]);
            if (data) {
                const b64 = arrayBufferToBase64(data.data);
                replacements.push({ from: `idb://${m[1]}`, to: `data:${data.type};base64,${b64}` });
            }
        } catch (e) { console.warn('PDF image resolve fail', m[1]); }
    }
    for (const { from, to } of replacements) {
        html = html.split(from).join(to);
    }
    return html;
}

// ===== TABLE HANDLING =====
function openTableDialog() {
    document.getElementById('tableDialog').classList.remove('hidden');
    document.getElementById('tableRows').value = 3;
    document.getElementById('tableCols').value = 3;
    lucide.createIcons();
}

function closeTableDialog() {
    document.getElementById('tableDialog').classList.add('hidden');
}

function confirmInsertTable() {
    const rows = parseInt(document.getElementById('tableRows').value) || 3;
    const cols = parseInt(document.getElementById('tableCols').value) || 3;
    closeTableDialog();
    insertTable(Math.min(rows, 20), Math.min(cols, 10));
}

function insertTable(rows, cols) {
    const tableModule = quill.getModule('table');
    // Ensure editor is focused and has a valid selection
    quill.focus();
    let range = quill.getSelection();
    if (!range) {
        quill.setSelection(quill.getLength(), 0);
        range = quill.getSelection();
    }
    tableModule.insertTable(rows, cols);
}

// ===== OUTLINE =====
function updateOutline() {
    const outlineList = document.getElementById('outlineList');
    const editor = quill.root;
    const headings = editor.querySelectorAll('h1, h2');

    // Check if anything actually changed to avoid expensive DOM re-renders
    const currentStructure = Array.from(headings).map(h => h.tagName + h.innerText).join('|');
    if (editor._lastOutlineStructure === currentStructure) return;
    editor._lastOutlineStructure = currentStructure;

    if (headings.length === 0) {
        outlineList.innerHTML = `
            <div class="flex flex-col items-center justify-center h-40 text-center px-6 mt-10">
                <div class="w-12 h-12 bg-gray-100 border-2 border-dashed border-gray-300 rounded-xl flex items-center justify-center mb-3 text-gray-400">
                    <i data-lucide="heading" class="w-6 h-6"></i>
                </div>
                <p class="text-gray-400 text-sm font-bold">Use H1 or H2 headings to generate an outline.</p>
            </div>`;
        lucide.createIcons();
        return;
    }

    outlineList.innerHTML = '';
    headings.forEach((heading, index) => {
        const text = heading.innerText.trim();
        if (!text) return;
        const type = heading.tagName.toLowerCase();
        heading.id = `heading-${index}`;
        const item = document.createElement('div');
        item.className = `outline-link py-2 px-3 rounded-lg cursor-pointer mb-1 ${type === 'h1' ? 'font-heading font-bold text-sm text-dark' : 'font-body font-bold text-xs text-gray-500 pl-6'}`;
        item.innerText = text;
        item.onclick = () => {
            heading.scrollIntoView({ behavior: 'smooth', block: 'center' });
            const orig = heading.style.backgroundColor;
            heading.style.backgroundColor = isDarkMode ? '#334155' : '#fff7ed';
            setTimeout(() => heading.style.backgroundColor = orig, 1500);
            if (window.innerWidth < 768) toggleOutline();
        };
        outlineList.appendChild(item);
    });
}

function toggleOutline() {
    const sidebar = document.getElementById('outlineSidebar');
    isOutlineOpen = !isOutlineOpen;
    if (isOutlineOpen) {
        sidebar.classList.remove('w-0', 'opacity-0');
        sidebar.classList.add('w-80', 'opacity-100');
        updateOutline();
    } else {
        sidebar.classList.remove('w-80', 'opacity-100');
        sidebar.classList.add('w-0', 'opacity-0');
    }
}

// ===== EXPORT / IMPORT =====
async function exportJSON() {
    const exportData = JSON.parse(JSON.stringify(notes));

    // Convert idb:// refs to base64 data URIs for portability
    for (const note of exportData) {
        const regex = /idb:\/\/([\w_-]+)/g;
        let m;
        const reps = [];
        while ((m = regex.exec(note.content)) !== null) {
            try {
                const data = await getImage(m[1]);
                if (data) {
                    const b64 = arrayBufferToBase64(data.data);
                    reps.push({ from: `idb://${m[1]}`, to: `data:${data.type};base64,${b64}` });
                }
            } catch (e) { console.warn('Export image failed', m[1]); }
        }
        for (const { from, to } of reps) note.content = note.content.split(from).join(to);
    }

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const link = document.createElement('a');
    link.setAttribute('href', dataUri);
    link.setAttribute('download', `english1_backup_${new Date().toISOString().split('T')[0]}.json`);
    link.click();
}

function triggerImport() { document.getElementById('importInput').click(); }

async function processImport(inputElement) {
    const file = inputElement.files[0];
    if (!file) return;

    const confirmed = await showModal('Import Backup?', 'WARNING: This will REPLACE all current notes with the backup file. This cannot be undone.', 'Yes, Replace All', 'alert-triangle');
    if (!confirmed) { inputElement.value = ''; return; }

    const reader = new FileReader();
    reader.onload = async function (e) {
        try {
            const imported = JSON.parse(e.target.result);
            if (!Array.isArray(imported)) { alert('Invalid backup file format.'); return; }

            // Clear current notes from DB first
            for (const n of notes) {
                await deleteNoteFromDB(n.id);
            }

            // Convert base64 data URIs in imported notes to IndexedDB
            for (const note of imported) {
                const regex = /data:([^;]+);base64,([A-Za-z0-9+\/=]+)/g;
                let m;
                const reps = [];
                while ((m = regex.exec(note.content)) !== null) {
                    try {
                        const id = `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
                        await storeImage(id, base64ToArrayBuffer(m[2]), m[1]);
                        reps.push({ from: m[0], to: `idb://${id}` });
                    } catch (err) { console.warn('Import image failed', err); }
                }
                for (const { from, to } of reps) note.content = note.content.split(from).join(to);
                
                await saveNoteToDB(note);
            }

            notes = await getAllNotes();
            if (isTrashMode) toggleTrashMode();
            const first = notes.find(n => !n.deleted);
            if (first) await loadNote(first.id);
            else await createNewNote();
            renderNotesList();
            alert('Backup restored successfully!');
        } catch (err) {
            alert('Error parsing JSON file.');
            console.error(err);
        }
    };
    reader.readAsText(file);
    inputElement.value = '';
}

// ===== TRASH MODE =====
function toggleTrashMode() {
    isTrashMode = !isTrashMode;
    const trashBtn = document.getElementById('trashToggleBtn');
    const trashHeader = document.getElementById('trashHeader');
    const newNoteBtn = document.getElementById('newNoteBtn');

    if (isTrashMode) {
        trashBtn.classList.replace('bg-gray-200', 'bg-pink');
        trashBtn.classList.replace('text-dark', 'text-white');
        trashHeader.classList.remove('hidden');
        newNoteBtn.classList.add('opacity-50', 'pointer-events-none');
        const firstTrash = notes.find(n => n.deleted);
        if (firstTrash) { loadNote(firstTrash.id); }
        else {
            currentNoteId = null;
            document.getElementById('noteTitle').value = "";
            quill.root.innerHTML = "<p>Trash is empty.</p>";
            quill.disable();
            renderNotesList();
        }
    } else {
        trashBtn.classList.replace('bg-pink', 'bg-gray-200');
        trashBtn.classList.replace('text-white', 'text-dark');
        trashHeader.classList.add('hidden');
        newNoteBtn.classList.remove('opacity-50', 'pointer-events-none');
        quill.enable();
        const firstActive = notes.find(n => !n.deleted);
        if (firstActive) loadNote(firstActive.id);
        else createNewNote();
    }
    renderNotesList();
    updateUIState();
}

function updateUIState() {
    const softDelBtn = document.getElementById('softDeleteBtn');
    const trashButtons = document.getElementById('trashButtons');
    const statusIndicator = document.getElementById('statusIndicator');
    const statusText = document.getElementById('statusText');
    if (isTrashMode) {
        softDelBtn.classList.add('hidden');
        trashButtons.classList.remove('hidden');
        statusIndicator.className = "w-3 h-3 rounded-full bg-pink border-[1px] border-slate-300 dark:border-white/10";
        statusText.innerText = "Deleted Note";
        document.getElementById('noteTitle').disabled = true;
        quill.disable();
    } else {
        softDelBtn.classList.remove('hidden');
        trashButtons.classList.add('hidden');
        statusIndicator.className = "w-3 h-3 rounded-full bg-green border-[1px] border-slate-300 dark:border-white/10";
        statusText.innerText = "Auto-saved";
        document.getElementById('noteTitle').disabled = false;
        quill.enable();
    }
}

// ===== NOTE CRUD =====
async function createNewNote() {
    if (isTrashMode) return;
    const newNote = { id: Date.now().toString(), title: '', content: '', updatedAt: Date.now(), deleted: false };
    notes.unshift(newNote);
    await saveNoteToDB(newNote);
    await loadNote(newNote.id);
    if (window.innerWidth < 768) toggleSidebar();
}

async function loadNote(id) {
    currentNoteId = id;
    if (!isTrashMode) await saveSetting('lastActiveNoteId', id);
    const note = notes.find(n => n.id === id);
    if (!note) return;

    document.getElementById('noteTitle').value = note.title;

    // Resolve idb:// image URLs
    const resolvedHtml = await resolveImagesInHtml(note.content);
    quill.root.innerHTML = resolvedHtml;

    renderNotesList();
    updateOutline();
    updateUIState();
}

async function saveCurrentNote() {
    if (!currentNoteId || isTrashMode) return;
    const noteIndex = notes.findIndex(n => n.id === currentNoteId);
    if (noteIndex !== -1) {
        const note = notes[noteIndex];
        note.title = document.getElementById('noteTitle').value;
        note.content = getContentForSave();
        note.updatedAt = Date.now();
        
        // Update cache
        strippedContentCache.set(note.id, fastStripHtml(note.content).toLowerCase());
        
        notes.splice(noteIndex, 1);
        notes.unshift(note);
        await saveNoteToDB(note);
    }
}

async function softDeleteCurrentNote() {
    if (!currentNoteId) return;
    const confirmed = await showModal('Move to Trash?', 'You can restore this note later from the Trash bin.', 'Trash It');
    if (confirmed) {
        const noteIndex = notes.findIndex(n => n.id === currentNoteId);
        if (noteIndex !== -1) {
            notes[noteIndex].deleted = true;
            notes[noteIndex].updatedAt = Date.now();
            await saveNoteToDB(notes[noteIndex]);
            const nextNote = notes.find(n => !n.deleted);
            if (nextNote) await loadNote(nextNote.id);
            else await createNewNote();
        }
    }
}

async function permanentDeleteCurrentNote() {
    if (!currentNoteId) return;
    const confirmed = await showModal('Delete Forever?', 'This action cannot be undone. The note will be gone.', 'Delete Forever');
    if (confirmed) {
        const note = notes.find(n => n.id === currentNoteId);
        if (note) {
            await deleteImagesInContent(note.content);
            await deleteNoteFromDB(note.id);
        }
        notes = notes.filter(n => n.id !== currentNoteId);
        const nextTrash = notes.find(n => n.deleted);
        if (nextTrash) { 
            await loadNote(nextTrash.id); 
        } else {
            currentNoteId = null;
            document.getElementById('noteTitle').value = "";
            quill.root.innerHTML = "<p>Trash is empty.</p>";
            renderNotesList();
        }
    }
}

async function restoreCurrentNote() {
    if (!currentNoteId) return;
    const noteIndex = notes.findIndex(n => n.id === currentNoteId);
    if (noteIndex !== -1) {
        notes[noteIndex].deleted = false;
        notes[noteIndex].updatedAt = Date.now();
        await saveNoteToDB(notes[noteIndex]);
        const nextTrash = notes.find(n => n.deleted);
        if (nextTrash) {
            await loadNote(nextTrash.id);
        } else {
            toggleTrashMode();
            await loadNote(notes[noteIndex].id);
            return;
        }
        renderNotesList();
    }
}

// ===== RENDER NOTES LIST =====
function renderNotesList() {
    const list = document.getElementById('notesList');
    const search = document.getElementById('searchInput').value.toLowerCase();
    list.innerHTML = '';
    const filtered = notes.filter(n => {
        const matchesMode = isTrashMode ? n.deleted === true : n.deleted !== true;
        if (!matchesMode) return false;
        
        if (!search) return true;

        if (!strippedContentCache.has(n.id)) {
            strippedContentCache.set(n.id, fastStripHtml(n.content).toLowerCase());
        }
        
        const contentMatch = strippedContentCache.get(n.id).includes(search);
        const titleMatch = (n.title || 'Untitled').toLowerCase().includes(search);
        
        return titleMatch || contentMatch;
    });
    if (filtered.length === 0) {
        list.innerHTML = `<div class="text-center py-8 text-gray-400 font-bold text-sm">${isTrashMode ? 'Trash is empty.' : 'No notes found.'}</div>`;
        return;
    }
    const fragment = document.createDocumentFragment();
    filtered.forEach(note => {
        const el = document.createElement('div');
        const title = note.title || 'Untitled Lesson';
        const date = new Date(note.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const isActive = note.id === currentNoteId;
        let baseClasses = "note-item p-4 rounded-xl cursor-pointer mb-2 relative overflow-hidden";
        if (isActive) baseClasses += isTrashMode ? " active-trash" : " active";
        el.className = baseClasses;
        el.onclick = () => { loadNote(note.id); if (window.innerWidth < 768) toggleSidebar(); };
        const rawText = strippedContentCache.get(note.id) || "";
        const titleColor = isActive ? (isTrashMode ? 'text-pink text-lg' : 'text-blue text-lg') : 'text-dark text-base';
        const badgeColor = isActive ? (isTrashMode ? 'bg-pink text-white border-[1px] border-white/20' : 'bg-blue text-white border-[1px] border-white/20') : 'bg-gray-200 text-gray-500';
        el.innerHTML = `
            <div class="flex justify-between items-start mb-1.5 relative z-10">
                <h4 class="font-heading font-bold truncate pr-2 ${titleColor}">${title}</h4>
                <span class="text-[10px] font-bold ${badgeColor} px-2 py-1 rounded-md">${date}</span>
            </div>
            <p class="text-xs ${isActive ? 'text-dark' : 'text-gray-400'} truncate font-bold relative z-10">${rawText.substring(0, 60) || 'Empty note...'}</p>`;
        fragment.appendChild(el);
    });
    list.appendChild(fragment);
    lucide.createIcons({ props: {}, nameAttr: "data-lucide", attrs: {}, scope: list });
}

// ===== UTILITY =====
function stripHtml(html) { const t = document.createElement("DIV"); t.innerHTML = html; return t.textContent || t.innerText || ""; }
function toggleSidebar() { document.getElementById('sidebar').classList.toggle('-translate-x-full'); }

function toggleZenMode() {
    const sidebar = document.getElementById('sidebar');
    const btnIcon = document.getElementById('zenModeIcon');
    const btnText = document.getElementById('zenModeText');
    isZenMode = !isZenMode;
    if (isZenMode) {
        sidebar.classList.add('md:w-0', 'md:opacity-0', 'md:border-none');
        sidebar.classList.remove('md:w-80', 'border-r-3');
        if (btnIcon) btnIcon.setAttribute('data-lucide', 'minimize-2');
        if (btnText) btnText.textContent = 'Exit Zen';
        if (isOutlineOpen) toggleOutline();
    } else {
        sidebar.classList.remove('md:w-0', 'md:opacity-0', 'md:border-none');
        sidebar.classList.add('md:w-80', 'border-r-3');
        if (btnIcon) btnIcon.setAttribute('data-lucide', 'maximize-2');
        if (btnText) btnText.textContent = 'Zen Mode';
    }
    lucide.createIcons();
}

async function exportPDF() {
    const note = notes.find(n => n.id === currentNoteId);
    if (!note) return;

    const status = document.getElementById('statusText');
    if (status) status.textContent = 'Generating PDF...';

    try {
        const printEl = document.getElementById('print-container');
        document.getElementById('print-title').textContent = note.title || 'Untitled Lesson';
        document.getElementById('print-date').textContent = new Date().toLocaleDateString();

        // Resolve all images to base64 for PDF reliability
        const resolvedHtml = await resolveImagesToBase64(note.content);
        document.getElementById('print-body').innerHTML = resolvedHtml;

        printEl.classList.remove('hidden');

        const opt = {
            margin: 0.5,
            filename: `${(note.title || 'lesson-note').replace(/\s+/g, '_')}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, logging: false },
            jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
        };

        await html2pdf().set(opt).from(printEl).save();
        printEl.classList.add('hidden');
        if (status) status.textContent = 'PDF Saved';
    } catch (err) {
        console.error('PDF Export Error:', err);
        alert('Failed to generate PDF. Please try again.');
        if (status) status.textContent = 'PDF Failed';
    }
}

function showModal(title, desc, confirmText, iconName) {
    return new Promise((resolve) => {
        const modal = document.getElementById('customModal');
        const titleEl = document.getElementById('modalTitle');
        const descEl = document.getElementById('modalDesc');
        const confirmBtn = document.getElementById('modalConfirm');
        const cancelBtn = document.getElementById('modalCancel');
        const iconEl = document.getElementById('modalIcon');
        if (title) titleEl.innerText = title;
        if (desc) descEl.innerText = desc;
        if (confirmText) confirmBtn.innerText = confirmText;
        if (iconName) { iconEl.setAttribute('data-lucide', iconName); lucide.createIcons(); }
        modal.classList.remove('hidden');
        const cleanup = (value) => {
            modal.classList.add('hidden');
            confirmBtn.onclick = null;
            cancelBtn.onclick = null;
            iconEl.setAttribute('data-lucide', 'trash-2');
            lucide.createIcons();
            resolve(value);
        };
        confirmBtn.onclick = () => cleanup(true);
        cancelBtn.onclick = () => cleanup(false);
    });
}
