// ===== GLOBAL STATE =====
let notes = [];
let folders = [];
let currentNoteId = null;
let activeFolderId = null;
let quill;
let isZenMode = false;
let isOutlineOpen = false;
let isTrashMode = false;
let isDarkMode = false;
let idb = null;
let blobUrlMap = {}; // blobUrl -> idbKey
let searchCache = null;
let strippedContentCache = new Map();

const FOLDER_COLORS = [
    { name: 'Blue', hex: '#2979FF' },
    { name: 'Orange', hex: '#FF8C42' },
    { name: 'Pink', hex: '#FF6B95' },
    { name: 'Green', hex: '#00E676' },
    { name: 'Purple', hex: '#7C4DFF' },
    { name: 'Teal', hex: '#00BCD4' },
];

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
            const upgradeDB = e.target.result;
            if (!upgradeDB.objectStoreNames.contains(STORES.IMAGES)) {
                upgradeDB.createObjectStore(STORES.IMAGES, { keyPath: 'id' });
            }
            if (!upgradeDB.objectStoreNames.contains(STORES.NOTES)) {
                upgradeDB.createObjectStore(STORES.NOTES, { keyPath: 'id' });
            }
            if (!upgradeDB.objectStoreNames.contains(STORES.SETTINGS)) {
                upgradeDB.createObjectStore(STORES.SETTINGS);
            }
        };
        req.onsuccess = (e) => resolve(e.target.result);
        req.onerror = (e) => reject(e.target.error);
    });
}

// --- Image Store Helpers ---
function storeImage(id, arrayBuffer, mimeType) {
    return new Promise((resolve, reject) => {
        const tx = idb.transaction(STORES.IMAGES, 'readwrite');
        tx.objectStore(STORES.IMAGES).put({ id, data: arrayBuffer, type: mimeType });
        tx.oncomplete = () => resolve();
        tx.onerror = (e) => reject(e.target.error);
    });
}

function getImage(id) {
    return new Promise((resolve, reject) => {
        const tx = idb.transaction(STORES.IMAGES, 'readonly');
        const req = tx.objectStore(STORES.IMAGES).get(id);
        req.onsuccess = () => resolve(req.result);
        req.onerror = (e) => reject(e.target.error);
    });
}

function deleteImage(id) {
    return new Promise((resolve, reject) => {
        const tx = idb.transaction(STORES.IMAGES, 'readwrite');
        tx.objectStore(STORES.IMAGES).delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = (e) => reject(e.target.error);
    });
}

// --- Notes Store Helpers ---
function getAllNotes() {
    return new Promise((resolve, reject) => {
        const tx = idb.transaction(STORES.NOTES, 'readonly');
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
        const tx = idb.transaction(STORES.NOTES, 'readwrite');
        tx.objectStore(STORES.NOTES).put(note);
        tx.oncomplete = () => resolve();
        tx.onerror = (e) => reject(e.target.error);
    });
}

function deleteNoteFromDB(id) {
    return new Promise((resolve, reject) => {
        const tx = idb.transaction(STORES.NOTES, 'readwrite');
        tx.objectStore(STORES.NOTES).delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = (e) => reject(e.target.error);
    });
}

// --- Settings Store Helpers ---
function getSetting(key) {
    return new Promise((resolve, reject) => {
        const tx = idb.transaction(STORES.SETTINGS, 'readonly');
        const req = tx.objectStore(STORES.SETTINGS).get(key);
        req.onsuccess = () => resolve(req.result);
        req.onerror = (e) => reject(e.target.error);
    });
}

function saveSetting(key, value) {
    return new Promise((resolve, reject) => {
        const tx = idb.transaction(STORES.SETTINGS, 'readwrite');
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
    const saved = localStorage.getItem('theme_lesson-note');
    if (saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        isDarkMode = true;
        document.documentElement.classList.add('dark');
    } else {
        isDarkMode = false;
        document.documentElement.classList.remove('dark');
    }
    updateDarkModeUI();
}

async function toggleDarkMode() {
    isDarkMode = !isDarkMode;
    document.documentElement.classList.toggle('dark', isDarkMode);
    localStorage.setItem('theme_lesson-note', isDarkMode ? 'dark' : 'light');
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
    await requireAuth();
    idb = await openDB();
    await migrateFromLocalStorage();
    await initDarkMode();
    initQuill();

    notes = await getAllNotes();
    folders = (await getSetting('folders')) || [];
    await loadFromCloud(); // Sync with cloud on startup
    await purgeExpiredTrash(); // Auto-delete notes trashed >14 days ago

    const lastActiveId = await getSetting('lastActiveNoteId');
    const noteToLoad = notes.find(n => n.id === lastActiveId && !n.deleted) || notes.find(n => !n.deleted);

    if (noteToLoad) {
        await loadNote(noteToLoad.id);
    } else {
        await createNewNote();
    }

    renderNotesList();

    // Close context menus on outside click
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.note-ctx-menu') && !e.target.closest('.note-ctx-trigger')) {
            document.querySelectorAll('.note-ctx-menu').forEach(m => m.remove());
        }
    });

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
                ['link', 'image', 'table', 'video'],
                ['clean']
            ]
        }
    });

    // Move the toolbar to our custom container for the "seamless" look
    const toolbarContainer = quill.getModule('toolbar').container;
    const customToolbarTarget = document.getElementById('note-toolbar');
    if (customToolbarTarget && toolbarContainer) {
        customToolbarTarget.appendChild(toolbarContainer);
    }

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
        showToast('Failed to insert image', 'error');
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
    link.setAttribute('download', `klasskit_backup_${new Date().toISOString().split('T')[0]}.json`);
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
            if (!Array.isArray(imported)) { showToast('Invalid backup format', 'error'); return; }

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
            showToast('Backup restored!', 'success');
        } catch (err) {
            showToast('Error parsing file', 'error');
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
    const newNote = { id: Date.now().toString(), title: '', content: '', updatedAt: Date.now(), deleted: false, folderId: activeFolderId || null };
    notes.unshift(newNote);
    await saveNoteToDB(newNote);
    saveToCloud();
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
        saveToCloud(); // Fire and forget cloud sync
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

async function deleteImagesInContent(content) {
    if (!content) return;
    const regex = /idb:\/\/([\w_-]+)/g;
    let m;
    while ((m = regex.exec(content)) !== null) {
        try { await deleteImage(m[1]); } catch (e) { console.warn('Failed to delete image', m[1]); }
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
        saveToCloud();
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

async function emptyTrash() {
    const trashedNotes = notes.filter(n => n.deleted);
    if (trashedNotes.length === 0) return;

    const confirmed = await showModal(
        'Empty Trash?',
        `This will permanently delete ${trashedNotes.length} note(s). This cannot be undone.`,
        'Delete All',
        'flame'
    );
    if (!confirmed) return;

    for (const note of trashedNotes) {
        await deleteImagesInContent(note.content);
        await deleteNoteFromDB(note.id);
    }
    notes = notes.filter(n => !n.deleted);
    saveToCloud();

    currentNoteId = null;
    document.getElementById('noteTitle').value = "";
    quill.root.innerHTML = "<p>Trash is empty.</p>";
    renderNotesList();
}

async function purgeExpiredTrash() {
    const TWO_WEEKS = 14 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const expired = notes.filter(n => n.deleted && (now - n.updatedAt) > TWO_WEEKS);
    if (expired.length === 0) return;

    for (const note of expired) {
        await deleteImagesInContent(note.content);
        await deleteNoteFromDB(note.id);
    }
    notes = notes.filter(n => !expired.some(e => e.id === n.id));
    saveToCloud();
    console.log(`Auto-purged ${expired.length} expired trash note(s).`);
}

async function restoreCurrentNote() {
    if (!currentNoteId) return;
    const noteIndex = notes.findIndex(n => n.id === currentNoteId);
    if (noteIndex !== -1) {
        notes[noteIndex].deleted = false;
        notes[noteIndex].updatedAt = Date.now();
        await saveNoteToDB(notes[noteIndex]);
        saveToCloud();
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

// ===== CLOUD SYNC =====
async function saveToCloud() {
    const statusText = document.getElementById('statusText');
    const originalText = statusText ? statusText.innerText : 'Auto-saved';
    
    if (statusText) statusText.innerText = 'Syncing...';
    
    try {
        await saveProgress('lesson_notes', { notes, folders });
        if (statusText) statusText.innerText = 'Cloud Synced';
        setTimeout(() => {
            if (statusText && statusText.innerText === 'Cloud Synced') statusText.innerText = originalText;
        }, 3000);
    } catch (e) {
        console.warn('Cloud save failed', e);
        if (statusText) statusText.innerText = 'Sync Error';
    }
}

async function loadFromCloud() {
    try {
        const cloudData = await loadProgress('lesson_notes');
        if (cloudData && cloudData.notes) {
            const cloudNotes = cloudData.notes;
            let hasChanges = false;

            for (const cn of cloudNotes) {
                const localNote = notes.find(n => n.id === cn.id);
                // If cloud note is newer or doesn't exist locally, update local
                if (!localNote || cn.updatedAt > localNote.updatedAt) {
                    await saveNoteToDB(cn);
                    hasChanges = true;
                }
            }

            if (hasChanges) {
                notes = await getAllNotes();
                renderNotesList();
            }
        }
        // Sync folders from cloud if present
        if (cloudData && cloudData.folders) {
            folders = cloudData.folders;
            await saveSetting('folders', folders);
        }
    } catch (e) {
        console.warn('Cloud load failed', e);
    }
}

// ===== RENDER NOTES LIST =====
function renderNotesList() {
    const list = document.getElementById('notesList');
    const search = document.getElementById('searchInput').value.toLowerCase();
    list.innerHTML = '';

    // Filter by trash/active mode
    const modeFiltered = notes.filter(n => isTrashMode ? n.deleted === true : n.deleted !== true);

    // If searching or in trash mode, render flat list
    if (search || isTrashMode) {
        const filtered = modeFiltered.filter(n => {
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
        filtered.forEach(note => fragment.appendChild(buildNoteItem(note)));
        list.appendChild(fragment);
        lucide.createIcons({ scope: list });
        return;
    }

    // ── FOLDER GROUPED VIEW ──
    const fragment = document.createDocumentFragment();

    // Render each folder
    folders.forEach(folder => {
        const folderNotes = modeFiltered.filter(n => n.folderId === folder.id);
        const section = document.createElement('div');
        section.className = 'folder-section mb-2';

        const isActive = activeFolderId === folder.id;
        section.innerHTML = `
            <div class="folder-header flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer select-none group transition-all ${isActive ? 'bg-blue/10 border border-blue/30' : 'hover:bg-slate-100 dark:hover:bg-slate-800/60'}" data-folder-id="${folder.id}">
                <div class="w-3 h-3 rounded-full flex-none" style="background-color: ${folder.color}"></div>
                <i data-lucide="chevron-${folder.collapsed ? 'right' : 'down'}" class="w-3.5 h-3.5 text-gray-400 flex-none"></i>
                <span class="font-heading font-bold text-sm text-dark dark:text-slate-200 truncate flex-1">${folder.name}</span>
                <span class="text-[10px] font-bold bg-gray-200 dark:bg-slate-700 text-gray-500 dark:text-slate-400 px-1.5 py-0.5 rounded-md">${folderNotes.length}</span>
                <button class="folder-menu-btn opacity-0 group-hover:opacity-100 text-gray-400 hover:text-dark dark:hover:text-white p-1 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-700 transition-all" onclick="event.stopPropagation(); showFolderMenu(event, '${folder.id}')">
                    <i data-lucide="more-horizontal" class="w-3.5 h-3.5 pointer-events-none"></i>
                </button>
            </div>
        `;

        section.querySelector('.folder-header').addEventListener('click', (e) => {
            if (e.target.closest('.folder-menu-btn')) return;
            if (activeFolderId === folder.id) {
                activeFolderId = null;
            } else {
                activeFolderId = folder.id;
            }
            folder.collapsed = !folder.collapsed;
            saveFolders();
            renderNotesList();
        });

        if (!folder.collapsed && folderNotes.length > 0) {
            const notesContainer = document.createElement('div');
            notesContainer.className = 'pl-4 border-l-2 ml-4 mt-1 mb-2';
            notesContainer.style.borderColor = folder.color + '40';
            folderNotes.forEach(note => notesContainer.appendChild(buildNoteItem(note)));
            section.appendChild(notesContainer);
        }

        fragment.appendChild(section);
    });

    // Unfiled notes
    const unfiledNotes = modeFiltered.filter(n => !n.folderId || !folders.some(f => f.id === n.folderId));
    if (unfiledNotes.length > 0) {
        if (folders.length > 0) {
            const unfiledHeader = document.createElement('div');
            unfiledHeader.className = 'flex items-center gap-2 px-3 py-2 mt-2 mb-1';
            unfiledHeader.innerHTML = `
                <i data-lucide="inbox" class="w-3.5 h-3.5 text-gray-300"></i>
                <span class="text-xs font-bold text-gray-400 uppercase tracking-wider">Unfiled</span>
                <span class="text-[10px] font-bold bg-gray-100 dark:bg-slate-800 text-gray-400 px-1.5 py-0.5 rounded-md">${unfiledNotes.length}</span>
            `;
            fragment.appendChild(unfiledHeader);
        }
        unfiledNotes.forEach(note => fragment.appendChild(buildNoteItem(note)));
    }

    if (modeFiltered.length === 0) {
        list.innerHTML = `<div class="text-center py-8 text-gray-400 font-bold text-sm">No notes yet.</div>`;
        return;
    }

    list.appendChild(fragment);
    lucide.createIcons({ scope: list });
}

function buildNoteItem(note) {
    const el = document.createElement('div');
    const title = note.title || 'Untitled Lesson';
    const date = new Date(note.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const isActive = note.id === currentNoteId;
    let baseClasses = "note-item p-4 rounded-xl cursor-pointer mb-2 relative overflow-hidden group/note";
    if (isActive) baseClasses += isTrashMode ? " active-trash" : " active";
    el.className = baseClasses;
    el.onclick = (e) => { if (e.target.closest('.note-ctx-trigger')) return; loadNote(note.id); if (window.innerWidth < 768) toggleSidebar(); };

    if (!strippedContentCache.has(note.id)) {
        strippedContentCache.set(note.id, fastStripHtml(note.content).toLowerCase());
    }
    const rawText = strippedContentCache.get(note.id) || "";
    const titleColor = isActive ? (isTrashMode ? 'text-pink text-lg' : 'text-blue text-lg') : 'text-dark text-base';
    const badgeColor = isActive ? (isTrashMode ? 'bg-pink text-white border-[1px] border-white/20' : 'bg-blue text-white border-[1px] border-white/20') : 'bg-gray-200 text-gray-500';

    el.innerHTML = `
        <div class="flex justify-between items-start mb-1.5 relative z-10">
            <h4 class="font-heading font-bold truncate pr-2 ${titleColor}">${title}</h4>
            <div class="flex items-center gap-1">
                <span class="text-[10px] font-bold ${badgeColor} px-2 py-1 rounded-md">${date}</span>
                ${!isTrashMode ? `<button class="note-ctx-trigger opacity-0 group-hover/note:opacity-100 text-gray-400 hover:text-dark dark:hover:text-white p-1 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-700 transition-all" onclick="event.stopPropagation(); showNoteContextMenu(event, '${note.id}')">
                    <i data-lucide="more-vertical" class="w-3.5 h-3.5 pointer-events-none"></i>
                </button>` : ''}
            </div>
        </div>
        <p class="text-xs ${isActive ? 'text-dark' : 'text-gray-400'} truncate font-bold relative z-10">${rawText.substring(0, 60) || 'Empty note...'}</p>`;
    return el;
}

// ===== FOLDER CRUD =====
async function saveFolders() {
    await saveSetting('folders', folders);
    saveToCloud();
}

async function createFolder() {
    const name = await showPrompt('New Folder', 'Give your new workspace a name', 'folder-plus');
    if (!name || !name.trim()) return;
    const color = FOLDER_COLORS[folders.length % FOLDER_COLORS.length].hex;
    const folder = { id: 'folder_' + Date.now(), name: name.trim(), color, collapsed: false };
    folders.push(folder);
    await saveFolders();
    renderNotesList();
    showToast(`Folder "${name.trim()}" created!`, 'folder');
}

async function renameFolder(id) {
    const folder = folders.find(f => f.id === id);
    if (!folder) return;
    const newName = await showPrompt('Rename Folder', 'Enter a new name for this folder', 'pencil', folder.name);
    if (!newName || !newName.trim()) return;
    folder.name = newName.trim();
    await saveFolders();
    renderNotesList();
    showToast('Folder renamed', 'success');
}

async function changeFolderColor(id) {
    const folder = folders.find(f => f.id === id);
    if (!folder) return;
    const currentIdx = FOLDER_COLORS.findIndex(c => c.hex === folder.color);
    const nextIdx = (currentIdx + 1) % FOLDER_COLORS.length;
    folder.color = FOLDER_COLORS[nextIdx].hex;
    await saveFolders();
    renderNotesList();
}

async function deleteFolder(id) {
    const folder = folders.find(f => f.id === id);
    if (!folder) return;
    const folderNotes = notes.filter(n => n.folderId === id && !n.deleted);
    const confirmed = await showModal('Delete Folder?', `"${folder.name}" will be deleted. ${folderNotes.length} note(s) inside will be moved to Unfiled.`, 'Delete Folder');
    if (!confirmed) return;

    // Move notes to unfiled
    for (const note of folderNotes) {
        note.folderId = null;
        await saveNoteToDB(note);
    }
    folders = folders.filter(f => f.id !== id);
    if (activeFolderId === id) activeFolderId = null;
    await saveFolders();
    renderNotesList();
}

async function moveNoteToFolder(noteId, folderId) {
    const note = notes.find(n => n.id === noteId);
    if (!note) return;
    note.folderId = folderId;
    note.updatedAt = Date.now();
    await saveNoteToDB(note);
    saveToCloud();
    renderNotesList();
}

// ===== CONTEXT MENUS =====
function showNoteContextMenu(e, noteId) {
    document.querySelectorAll('.note-ctx-menu').forEach(m => m.remove());
    const menu = document.createElement('div');
    menu.className = 'note-ctx-menu absolute z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg p-2 min-w-[180px] animate-pop';

    let items = '';
    // Move to folder options
    if (folders.length > 0) {
        items += `<div class="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-3 py-1">Move to</div>`;
        folders.forEach(f => {
            items += `<button class="w-full text-left px-3 py-2 text-sm font-bold text-dark dark:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2 transition-colors" onclick="moveNoteToFolder('${noteId}', '${f.id}'); this.closest('.note-ctx-menu').remove()">
                <div class="w-2.5 h-2.5 rounded-full flex-none" style="background:${f.color}"></div>
                ${f.name}
            </button>`;
        });
        // Unfiled option
        items += `<button class="w-full text-left px-3 py-2 text-sm font-bold text-gray-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2 transition-colors" onclick="moveNoteToFolder('${noteId}', null); this.closest('.note-ctx-menu').remove()">
            <i data-lucide="inbox" class="w-3 h-3 pointer-events-none"></i> Unfiled
        </button>`;
        items += `<div class="border-t border-slate-100 dark:border-slate-700 my-1"></div>`;
    }
    items += `<button class="w-full text-left px-3 py-2 text-sm font-bold text-pink rounded-lg hover:bg-pink/10 flex items-center gap-2 transition-colors" onclick="document.querySelectorAll('.note-ctx-menu').forEach(m=>m.remove()); softDeleteNote('${noteId}')">
        <i data-lucide="trash-2" class="w-3.5 h-3.5 pointer-events-none"></i> Move to Trash
    </button>`;

    menu.innerHTML = items;

    // Position near the button
    const rect = e.target.closest('.note-ctx-trigger').getBoundingClientRect();
    const sidebar = document.getElementById('notesList');
    const sidebarRect = sidebar.getBoundingClientRect();
    menu.style.position = 'fixed';
    menu.style.top = Math.min(rect.bottom + 4, window.innerHeight - 250) + 'px';
    menu.style.left = Math.min(rect.left - 140, sidebarRect.right - 200) + 'px';

    document.body.appendChild(menu);
    lucide.createIcons({ scope: menu });
}

function showFolderMenu(e, folderId) {
    document.querySelectorAll('.note-ctx-menu').forEach(m => m.remove());
    const menu = document.createElement('div');
    menu.className = 'note-ctx-menu absolute z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg p-2 min-w-[160px] animate-pop';
    menu.innerHTML = `
        <button class="w-full text-left px-3 py-2 text-sm font-bold text-dark dark:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2 transition-colors" onclick="this.closest('.note-ctx-menu').remove(); renameFolder('${folderId}')">
            <i data-lucide="pencil" class="w-3.5 h-3.5 pointer-events-none"></i> Rename
        </button>
        <button class="w-full text-left px-3 py-2 text-sm font-bold text-dark dark:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2 transition-colors" onclick="this.closest('.note-ctx-menu').remove(); changeFolderColor('${folderId}')">
            <i data-lucide="palette" class="w-3.5 h-3.5 pointer-events-none"></i> Change Color
        </button>
        <div class="border-t border-slate-100 dark:border-slate-700 my-1"></div>
        <button class="w-full text-left px-3 py-2 text-sm font-bold text-pink rounded-lg hover:bg-pink/10 flex items-center gap-2 transition-colors" onclick="this.closest('.note-ctx-menu').remove(); deleteFolder('${folderId}')">
            <i data-lucide="trash-2" class="w-3.5 h-3.5 pointer-events-none"></i> Delete Folder
        </button>
    `;
    const rect = e.target.closest('.folder-menu-btn').getBoundingClientRect();
    menu.style.position = 'fixed';
    menu.style.top = rect.bottom + 4 + 'px';
    menu.style.left = Math.max(rect.left - 120, 8) + 'px';
    document.body.appendChild(menu);
    lucide.createIcons({ scope: menu });
}

async function softDeleteNote(noteId) {
    const confirmed = await showModal('Move to Trash?', 'You can restore this note later from the Trash bin.', 'Trash It');
    if (!confirmed) return;
    const noteIndex = notes.findIndex(n => n.id === noteId);
    if (noteIndex !== -1) {
        notes[noteIndex].deleted = true;
        notes[noteIndex].updatedAt = Date.now();
        await saveNoteToDB(notes[noteIndex]);
        if (noteId === currentNoteId) {
            const nextNote = notes.find(n => !n.deleted);
            if (nextNote) await loadNote(nextNote.id);
            else await createNewNote();
        }
        renderNotesList();
        saveToCloud();
    }
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
        showToast('PDF Exported', 'success');
    } catch (err) {
        console.error('PDF Export Error:', err);
        showToast('PDF Export Failed', 'error');
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
        modal.classList.add('flex');
        const cleanup = (value) => {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
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

function showPrompt(title, desc, iconName, defaultValue = '') {
    return new Promise((resolve) => {
        const modal = document.getElementById('promptModal');
        const titleEl = document.getElementById('promptTitle');
        const descEl = document.getElementById('promptDesc');
        const confirmBtn = document.getElementById('promptConfirm');
        const cancelBtn = document.getElementById('promptCancel');
        const iconEl = document.getElementById('promptIcon');
        const inputEl = document.getElementById('promptInput');

        titleEl.innerText = title;
        descEl.innerText = desc;
        inputEl.value = defaultValue;
        if (iconName) { iconEl.setAttribute('data-lucide', iconName); lucide.createIcons(); }
        
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        inputEl.focus();
        inputEl.select();

        const cleanup = (value) => {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
            confirmBtn.onclick = null;
            cancelBtn.onclick = null;
            resolve(value);
        };

        confirmBtn.onclick = () => cleanup(inputEl.value);
        cancelBtn.onclick = () => cleanup(null);
        inputEl.onkeydown = (e) => {
            if(e.key === 'Enter') cleanup(inputEl.value);
            if(e.key === 'Escape') cleanup(null);
        };
    });
}

function showToast(message, type = "success") {
    const container = document.getElementById("toastContainer");
    if (!container) return;

    const toast = document.createElement("div");
    const colors = {
        success: "bg-green text-dark border-dark",
        error: "bg-pink text-white border-dark",
        info: "bg-blue text-white border-dark",
        folder: "bg-orange text-dark border-dark",
    };

    const icons = {
        success: "check-circle",
        error: "alert-circle",
        info: "info",
        folder: "folder",
    };

    toast.className = `${colors[type] || colors.success} px-6 py-3 rounded-2xl shadow-neo border-2 border-dark font-bold text-sm flex items-center gap-2 pointer-events-auto animate-pop`;
    toast.innerHTML = `<i data-lucide="${icons[type] || icons.success}" class="w-4 h-4"></i> ${message}`;

    container.appendChild(toast);
    lucide.createIcons({ scope: toast });

    setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transform = "translateY(20px)";
        toast.style.transition = "all 0.4s ease";
        setTimeout(() => toast.remove(), 400);
    }, 3000);
}
