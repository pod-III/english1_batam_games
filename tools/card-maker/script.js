// --- State Management ---
const pagesContainer = document.getElementById("pagesContainer");
const gridSelect = document.getElementById("gridSelect");
const inputCols = document.getElementById("inputCols");
const inputRows = document.getElementById("inputRows");
const printStyle = document.getElementById("printOrientationStyle");

let state = {
    orientation: "portrait",
    gridCols: 3,
    gridRows: 3,
    imgHeight: 50,
    fontSize: 2,
    autoFit: false,
    pages: [[]], // Array of pages, each containing array of card objects
};

// --- UI Feedback ---
function showToast(message, type = "info") {
    const container = document.getElementById("toast-container");
    const toast = document.createElement("div");

    const colors = {
        success: "bg-brand-green text-brand-dark border-brand-dark",
        error: "bg-brand-pink text-white border-brand-dark",
        info: "bg-brand-blue text-white border-brand-dark",
        warning: "bg-brand-orange text-brand-dark border-brand-dark",
    };

    toast.className = `${colors[type]} px-6 py-3 rounded-2xl shadow-neo border-2 border-dark font-bold text-sm flex items-center gap-2 pointer-events-auto animate-pop-in`;
    toast.innerHTML = `<i data-lucide="${type === "success" ? "check-circle" : type === "error" ? "alert-circle" : "info"}" class="w-4 h-4"></i> ${message}`;

    container.appendChild(toast);
    lucide.createIcons();

    setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transform = "translateY(20px)";
        toast.style.transition = "all 0.4s ease";
        setTimeout(() => toast.remove(), 400);
    }, 3000);
}

function showConfirm(title, message) {
    return new Promise((resolve) => {
        const modal = document.getElementById('confirmModal');
        const titleEl = document.getElementById('confirmTitle');
        const msgEl = document.getElementById('confirmMessage');
        const yesBtn = document.getElementById('confirmBtnYes');
        const noBtn = document.getElementById('confirmBtnNo');

        titleEl.textContent = title;
        msgEl.textContent = message;
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        lucide.createIcons();

        const cleanup = (value) => {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
            yesBtn.onclick = null;
            noBtn.onclick = null;
            resolve(value);
        };

        yesBtn.onclick = () => cleanup(true);
        noBtn.onclick = () => cleanup(false);
        modal.onclick = (e) => { if(e.target === modal) cleanup(false); };
    });
}

// --- Core Functions ---

function toggleTheme() {
    const isDark = document.documentElement.classList.toggle("dark");
    localStorage.setItem("theme_card-maker", isDark ? "dark" : "light");
}

function initTheme() {
    const saved = localStorage.getItem('theme_card-maker');
    if (saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches)) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
}

// --- IndexedDB ---
const DB_NAME = 'CardMakerDB';
const DB_VER = 1;
const STATE_STORE = 'game_state';
const SETS_STORE = 'card_sets';

async function initDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VER);
        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STATE_STORE)) db.createObjectStore(STATE_STORE);
            if (!db.objectStoreNames.contains(SETS_STORE)) db.createObjectStore(SETS_STORE, { keyPath: 'id', autoIncrement: true });
        };
        req.onsuccess = (e) => resolve(e.target.result);
        req.onerror = (e) => reject(e.target.error);
    });
}
async function dbPut(key, data) {
    try { const db = await initDB(); db.transaction(STATE_STORE, 'readwrite').objectStore(STATE_STORE).put(data, key); } catch(e) { console.error(e); }
}
async function dbGet(key) {
    try {
        const db = await initDB();
        return new Promise((res) => { const r = db.transaction(STATE_STORE, 'readonly').objectStore(STATE_STORE).get(key); r.onsuccess = () => res(r.result); r.onerror = () => res(null); });
    } catch(e) { return null; }
}

// Card Sets CRUD
async function saveCardSetToDB(name, stateData) {
    const db = await initDB();
    const tx = db.transaction(SETS_STORE, 'readwrite');
    tx.objectStore(SETS_STORE).put({ name, stateData, createdAt: Date.now() });
    return new Promise(r => { tx.oncomplete = r; });
}
async function getAllCardSets() {
    try {
        const db = await initDB();
        return new Promise((res) => { const r = db.transaction(SETS_STORE, 'readonly').objectStore(SETS_STORE).getAll(); r.onsuccess = () => res(r.result || []); r.onerror = () => res([]); });
    } catch(e) { return []; }
}
async function deleteCardSet(id) {
    const db = await initDB();
    const tx = db.transaction(SETS_STORE, 'readwrite');
    tx.objectStore(SETS_STORE).delete(id);
    return new Promise(r => { tx.oncomplete = r; });
}

async function renderCardSets() {
    const list = document.getElementById('sets-list');
    if (!list) return;
    const sets = await getAllCardSets();
    if (sets.length === 0) { list.innerHTML = '<p class="text-slate-400 text-[10px] italic">No saved sets yet.</p>'; return; }
    list.innerHTML = '';
    sets.forEach(set => {
        const item = document.createElement('div');
        item.className = 'flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-800 border-2 border-brand-dark/10 dark:border-slate-600 rounded-lg hover:border-brand-blue/40 transition-all';
        const pageCount = set.stateData?.pages?.length || 0;
        const cardCount = set.stateData?.pages?.reduce((a, p) => a + p.length, 0) || 0;
        item.innerHTML = `
            <div class="flex-1 min-w-0">
                <p class="text-xs font-bold text-brand-dark dark:text-white truncate">${set.name}</p>
                <p class="text-[9px] text-slate-400 truncate">${pageCount} page(s), ${cardCount} card(s)</p>
            </div>
            <button class="set-load p-1.5 bg-brand-blue/10 text-brand-blue rounded-md border border-brand-blue/20 hover:bg-brand-blue hover:text-white transition-all" title="Load">
                <i data-lucide="upload" class="w-3 h-3 pointer-events-none"></i>
            </button>
            <button class="set-del p-1.5 bg-brand-pink/10 text-brand-pink rounded-md border border-brand-pink/20 hover:bg-brand-pink hover:text-white transition-all" title="Delete">
                <i data-lucide="trash-2" class="w-3 h-3 pointer-events-none"></i>
            </button>`;
        item.querySelector('.set-load').onclick = () => loadCardSet(set.stateData);
        item.querySelector('.set-del').onclick = async () => { await deleteCardSet(set.id); renderCardSets(); };
        list.appendChild(item);
    });
    lucide.createIcons();
}

function loadCardSet(stateData) {
    state = { ...state, ...stateData };
    inputCols.value = state.gridCols || 3;
    inputRows.value = state.gridRows || 3;
    renderAllPages();
    setOrientation(state.orientation);
    setImageSize(state.imgHeight);
    setFontSize(state.fontSize);
    updateToggleUI();
}

async function saveCurrentSet() {
    const nameInput = document.getElementById('set-name-input');
    const name = nameInput.value.trim();
    if (!name) return;
    saveState(); // Harvest DOM into state
    // Clone state without saving the full state reference
    const clone = JSON.parse(JSON.stringify(state));
    await saveCardSetToDB(name, clone);
    nameInput.value = '';
    renderCardSets();

    // Sync Sets to Cloud
    await syncSetsToCloud();
}

async function syncSetsToCloud() {
    try {
        const sets = await getAllCardSets();
        await saveProgress('card_maker_sets', sets);
        console.log("✅ Card Sets synced to cloud");
    } catch (e) {
        console.error("Cloud sync failed", e);
    }
}

async function syncStateToCloud() {
    try {
        // Strip large dataURLs from cloud sync to avoid payload limits
        const cloudState = JSON.parse(JSON.stringify(state));
        cloudState.pages = cloudState.pages.map(page => 
            page.map(card => ({
                ...card,
                img: (card.img && card.img.startsWith('http')) ? card.img : "" 
            }))
        );
        await saveProgress('card_maker_state', cloudState);
        console.log("✅ Card State synced to cloud");
    } catch (e) {
        console.error("Cloud sync failed", e);
    }
}

async function loadState() {
    const saved = localStorage.getItem("flashcard_klasskit_state_v5");
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            // Merge saved state with defaults to handle version upgrades
            state = { ...state, ...parsed };

            // Restore UI Controls
            inputCols.value = state.gridCols || 3;
            inputRows.value = state.gridRows || 3;

            // Apply visual settings (without saving again to avoid loops)
            setOrientation(state.orientation, false);
            setImageSize(state.imgHeight ?? 50, false);
            setFontSize(state.fontSize || 2, false);
            updateToggleUI();
        } catch (e) {
            console.error("Load Error:", e);
        }
    }

    // Sync from Cloud
    try {
        const cloudState = await loadProgress('card_maker_state');
        if (cloudState) {
            state = { ...state, ...cloudState };
            // Reset UI with cloud data
            inputCols.value = state.gridCols || 3;
            inputRows.value = state.gridRows || 3;
            setOrientation(state.orientation, false);
            setImageSize(state.imgHeight ?? 50, false);
            setFontSize(state.fontSize || 2, false);
            updateToggleUI();
        }

        const cloudSets = await loadProgress('card_maker_sets');
        if (cloudSets && cloudSets.length > 0) {
            // Merge cloud sets into local DB
            const db = await initDB();
            for (const set of cloudSets) {
                const tx = db.transaction(SETS_STORE, 'readwrite');
                // Use put to overwrite/add
                tx.objectStore(SETS_STORE).put(set);
            }
            renderCardSets();
        }
    } catch (e) {
        console.error("Cloud load failed", e);
    }

    // Ensure at least one page exists
    if (!state.pages || state.pages.length === 0) {
        state.pages = [[]];
    }
    renderAllPages(false);
    lucide.createIcons();
}

function saveState() {
    // Harvest data from DOM
    const pageWrappers = document.querySelectorAll(".page-wrapper");

    state.pages = Array.from(pageWrappers).map((wrapper) => {
        const cards = [];
        const cardElements =
            wrapper.querySelectorAll(".brutalist-card");

        cardElements.forEach((card) => {
            const labelElement =
                card.querySelector(".card-label-input");
            const textElement = card.querySelector(
                "[contenteditable]:not(.card-label-input)",
            );
            const imgElement = card.querySelector(".image-preview");

            const label = labelElement
                ? labelElement.innerText
                : "";
            const text = textElement ? textElement.innerText : "";
            const imgSrc = imgElement ? imgElement.src : "";
            // Check if image is actually visible/set. If src is empty or hidden, save empty string.
            const hasImage =
                imgElement &&
                !imgElement.classList.contains("hidden") &&
                imgSrc &&
                !imgSrc.includes("w3.org"); // Check against SVG placeholder url if needed

            cards.push({
                text: text,
                img: hasImage ? imgSrc : "",
                label: label,
            });
        });
        return cards;
    });

    localStorage.setItem(
        "flashcard_klasskit_state_v5",
        JSON.stringify(state),
    );
    // Also persist to IndexedDB
    dbPut('cardMakerState', state);

    // Sync to Cloud (Debounced)
    if (window.cloudSaveTimeout) clearTimeout(window.cloudSaveTimeout);
    window.cloudSaveTimeout = setTimeout(() => syncStateToCloud(), 2000);
}

function exportData() {
    saveState(); // Ensure latest
    const dataStr =
        "data:text/json;charset=utf-8," +
        encodeURIComponent(JSON.stringify(state));
    const downloadAnchorNode = document.createElement("a");
    downloadAnchorNode.setAttribute("href", dataStr);
    const date = new Date().toISOString().slice(0, 10);
    downloadAnchorNode.setAttribute(
        "download",
        `Flashcards_KlassKit_${date}.json`,
    );
    document.body.appendChild(downloadAnchorNode); // required for firefox
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
}

function importData(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const parsed = JSON.parse(e.target.result);
            state = { ...state, ...parsed };

            // Update UI inputs
            inputCols.value = state.gridCols;
            inputRows.value = state.gridRows;

            renderAllPages();
            // Apply settings
            setOrientation(state.orientation);
            setImageSize(state.imgHeight);
            setFontSize(state.fontSize);
            updateToggleUI();

            showToast("Flashcards loaded successfully!", "success");
        } catch (err) {
            showToast("Error loading file. Check JSON format.", "error");
            console.error(err);
        }
    };
    reader.readAsText(file);
    input.value = ""; // Reset input
}

// --- Page Manipulation ---

function addNewPage() {
    saveState();
    state.pages.push([]);
    renderAllPages();
    showToast("New page added", "success");
    // Scroll to new page
    setTimeout(() => {
        const wrappers = document.querySelectorAll(".page-wrapper");
        if (wrappers.length > 0) {
            wrappers[wrappers.length - 1].scrollIntoView({
                behavior: "smooth",
            });
        }
    }, 100);
}

// --- Bulk Import ---

function openBulkTextModal() {
    document.getElementById("bulkTextModal").classList.remove("hidden");
    document.getElementById("bulkTextModal").classList.add("flex");
    document.getElementById("bulkTextarea").focus();
}

function closeBulkTextModal() {
    document.getElementById("bulkTextModal").classList.add("hidden");
    document.getElementById("bulkTextModal").classList.remove("flex");
}

function toggleBulkLabelInput() {
    const type = document.getElementById("bulkLabelType").value;
    document.getElementById("bulkLabelFixedText").classList.toggle("hidden", type !== "fixed");
}

function updateBulkLineCount() {
    const text = document.getElementById("bulkTextarea").value;
    const count = text.split("\n").filter(l => l.trim()).length;
    document.getElementById("bulkLineCount").textContent = count + " items";
}

function handleBulkTextImport() {
    const text = document.getElementById("bulkTextarea").value;
    const lines = text
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l);

    if (lines.length === 0) return;

    const labelType = document.getElementById("bulkLabelType").value;
    const fixedLabel = document.getElementById("bulkLabelFixedText").value;
    
    saveState();
    const cardsPerPage = state.gridCols * state.gridRows;

    // Flatten all lines and comma-separated words into a single list of strings
    const allWords = lines.flatMap(line => 
        line.split(",").map(w => w.trim()).filter(w => w)
    );

    // Build array of new card objects from the flattened list
    const newCards = allWords.map((word, idx) => {
        let label = "";

        if (labelType === "number") {
            label = (idx + 1).toString();
        } else if (labelType === "fixed") {
            label = fixedLabel;
        }

        return { text: word, img: "", label: label };
    });

    // Fill the current page's empty slots first, then overflow to new pages
    const lastPageIdx = state.pages.length - 1;
    const currentPage = state.pages[lastPageIdx];
    
    // Find empty slots in the current page (slots with no text and no image)
    let inserted = 0;
    for (let i = 0; i < cardsPerPage && inserted < newCards.length; i++) {
        if (i >= currentPage.length) {
            // Slot doesn't exist yet, push to it
            currentPage.push(newCards[inserted]);
            inserted++;
        } else if (!currentPage[i].text && !currentPage[i].img) {
            // Slot is empty, replace it
            currentPage[i] = newCards[inserted];
            inserted++;
        }
    }

    // Overflow remaining cards into new pages
    const remaining = newCards.slice(inserted);
    for (let i = 0; i < remaining.length; i += cardsPerPage) {
        state.pages.push(remaining.slice(i, i + cardsPerPage));
    }

    renderAllPages();
    closeBulkTextModal();
    document.getElementById("bulkTextarea").value = "";
    showToast(`Imported ${lines.length} items into cards`, "success");
}

async function handleBulkImageImport(input) {
    const files = Array.from(input.files);
    if (files.length === 0) return;

    saveState();
    showToast(`Processing ${files.length} images...`, "info");

    const cardsPerPage = state.gridCols * state.gridRows;

    // Process all images
    const newCards = [];
    for (const file of files) {
        try {
            let imgSource;
            const { data: { user } } = await db.auth.getUser();
            if (!isSandbox() && user) {
                imgSource = await uploadMedia(file, 'card_maker');
            } else {
                imgSource = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = (e) => resolve(e.target.result);
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                });
            }
            newCards.push({ text: "", img: imgSource, label: "" });
        } catch (e) {
            console.error("Image processing failed", e);
        }
    }

    // Fill current page's empty slots first
    const lastPageIdx = state.pages.length - 1;
    const currentPage = state.pages[lastPageIdx];

    let inserted = 0;
    for (let i = 0; i < cardsPerPage && inserted < newCards.length; i++) {
        if (i >= currentPage.length) {
            currentPage.push(newCards[inserted]);
            inserted++;
        } else if (!currentPage[i].text && !currentPage[i].img) {
            currentPage[i] = newCards[inserted];
            inserted++;
        }
    }

    // Overflow remaining into new pages
    const remaining = newCards.slice(inserted);
    for (let i = 0; i < remaining.length; i += cardsPerPage) {
        state.pages.push(remaining.slice(i, i + cardsPerPage));
    }

    renderAllPages();
    input.value = "";
    showToast(`Imported ${files.length} images into cards`, "success");
}

async function deletePage(index) {
    if (state.pages.length <= 1) {
        showToast("You need at least one page.", "error");
        return;
    }
    const confirmed = await showConfirm(
        "Delete Page",
        `Delete Page ${index + 1}? This cannot be undone.`
    );

    if (confirmed) {
        saveState(); // Save current state of other pages first
        state.pages.splice(index, 1);
        renderAllPages();
        showToast("Page deleted", "info");
    }
}

async function savePageAsImage(pageIndex, wrapperElement) {
    const a4Page = wrapperElement.querySelector(".a4-page");
    if (!a4Page) return;

    // Temporarily hide UI elements we don't want in the screenshot
    const hideElements = a4Page.querySelectorAll(".no-print");
    hideElements.forEach((el) => (el.style.display = "none"));

    try {
        // Generate the canvas using html2canvas
        const canvas = await html2canvas(a4Page, {
            scale: 2, // High resolution for sharper text/images
            useCORS: true,
            backgroundColor: "#ffffff",
        });

        // Convert to PNG and download
        const dataUrl = canvas.toDataURL("image/png");
        const link = document.createElement("a");
        link.download = `Flashcards_Page_${pageIndex + 1}.png`;
        link.href = dataUrl;
        link.click();
        link.remove();
    } catch (error) {
        console.error("Error generating image:", error);
        showToast("Oops! Something went wrong while saving.", "error");
    } finally {
        // Restore hidden UI elements
        hideElements.forEach((el) => (el.style.display = ""));
    }
}

// --- Styling & Settings ---

function setImageSize(size, shouldSave = true) {
    state.imgHeight = size;
    document.getElementById("imgSizeLabel").innerText = size + "%";
    [0, 25, 50, 75, 100].forEach((b) => {
        const btn = document.getElementById(`img-${b}`);
        if (btn) btn.classList.toggle("active", b === size);
    });
    updateCardDisplay();
    if (shouldSave) saveState();
}

function setFontSize(size, shouldSave = true) {
    state.fontSize = size;
    const sizes = [1.2, 2, 3.5, 5];
    sizes.forEach((s) => {
        const btn = document.getElementById(`font-${s}`);
        if (btn)
            btn.classList.toggle("active", s === parseFloat(size));
    });
    updateCardDisplay();
    if (shouldSave) saveState();
}

function toggleAutoFit() {
    state.autoFit = !state.autoFit;
    updateToggleUI();
    updateCardDisplay();
    saveState();
}

function updateToggleUI() {
    document
        .getElementById("toggleAutoFit")
        .classList.toggle("active", state.autoFit);
}

function autoFitText(element) {
    if (
        !state.autoFit ||
        element.classList.contains("card-label-input")
    )
        return;
    const container = element.parentElement;
    if (!container || container.clientHeight === 0) return;

    // Binary search for best fit font size
    let minSize = 0.5;
    let maxSize = 15; // Max REM
    let optimal = state.fontSize; // Start with current preference

    // Temporary set to max to see bounds
    element.style.fontSize = maxSize + "rem";

    // Simple iterative reduction
    let current = maxSize;
    while (current > minSize) {
        element.style.fontSize = current + "rem";
        if (
            element.scrollHeight <= container.clientHeight &&
            element.scrollWidth <= container.clientWidth
        ) {
            optimal = current;
            break;
        }
        current -= 0.5;
    }
    // Fine tuning
    element.style.fontSize = optimal + "rem";
}

function updateCardDisplay() {
    const isFullImg = state.imgHeight === 100;
    const isNoImg = state.imgHeight === 0;

    document.querySelectorAll(".image-container").forEach((c) => {
        c.style.height = `${state.imgHeight}%`;
        c.style.display = isNoImg ? "none" : "flex";
    });

    document.querySelectorAll(".text-container").forEach((c) => {
        c.style.height = `${100 - state.imgHeight}%`;
        c.style.display = isFullImg ? "none" : "flex";
    });

    document
        .querySelectorAll(
            "[contenteditable]:not(.card-label-input)",
        )
        .forEach((t) => {
            if (state.autoFit) {
                autoFitText(t);
            } else {
                t.style.fontSize = `${state.fontSize}rem`;
            }
        });

    document.querySelectorAll(".brutalist-card").forEach((card) => {
        // If full image or no image, remove padding for cleaner look
        card.style.padding = isFullImg || isNoImg ? "0" : "10px";
    });

    document.querySelectorAll(".image-preview").forEach((img) => {
        img.classList.remove("cover");
        img.classList.add("contain");
        img.style.padding = isFullImg ? "0" : "4px";
    });
}

function setOrientation(type, shouldSave = true) {
    state.orientation = type;
    const isP = type === "portrait";
    document
        .getElementById("btnPortrait")
        .classList.toggle("active", isP);
    document
        .getElementById("btnLandscape")
        .classList.toggle("active", !isP);

    document.querySelectorAll(".a4-page").forEach((page) => {
        page.classList.remove("a4-portrait", "a4-landscape");
        page.classList.add(`a4-${type}`);
    });

    printStyle.innerHTML = `@page { size: ${type}; margin: 0; }`;
    if (shouldSave) saveState();
}


function handleCustomGrid() {
    state.gridCols = Math.max(
        1,
        Math.min(10, parseInt(inputCols.value) || 1),
    );
    state.gridRows = Math.max(
        1,
        Math.min(10, parseInt(inputRows.value) || 1),
    );
    gridSelect.value = ""; // clear preset selection
    saveState();
    renderAllPages();
}

function syncFromPreset() {
    if (!gridSelect.value) return;
    const [cols, rows] = gridSelect.value.split(",").map(Number);
    inputCols.value = cols;
    inputRows.value = rows;
    state.gridCols = cols;
    state.gridRows = rows;
    saveState();
    renderAllPages();
}

function removeImage(pageIndex, cardIndex) {
    const uid = `${pageIndex}-${cardIndex}`;
    const img = document.getElementById(`img-${uid}`);
    const icon = document.getElementById(`icon-${uid}`);
    const delBtn = document.getElementById(`del-${uid}`);

    if (img) {
        img.src = "";
        img.classList.add("hidden");
    }
    if (icon) icon.classList.remove("hidden");
    if (delBtn) delBtn.classList.add("hidden");
    saveState();
}

// --- Rendering ---

function renderAllPages(shouldSave = true) {
    pagesContainer.innerHTML = "";

    state.pages.forEach((pageData, pageIndex) => {
        renderSinglePage(pageIndex, pageData);
    });

    setOrientation(state.orientation, false);
    updateCardDisplay(); // Applies fonts, sizes, visibility
    lucide.createIcons();

    if (shouldSave) saveState();
}

function renderSinglePage(pageIndex, pageData) {
    const cols = state.gridCols;
    const rows = state.gridRows;

    const wrapper = document.createElement("div");
    wrapper.className = "page-wrapper no-break-inside";

    // --- Page Controls Header ---
    const headerDiv = document.createElement("div");
    headerDiv.className =
        "absolute -top-10 left-0 w-full flex justify-between items-end no-print pb-2";

    const pageLabel = document.createElement("div");
    pageLabel.className =
        "font-heading font-bold text-slate-400 text-sm uppercase tracking-widest";
    pageLabel.innerText = `Page ${pageIndex + 1}`;
    headerDiv.appendChild(pageLabel);

    const controlsDiv = document.createElement("div");
    controlsDiv.className = "flex gap-2";

    // Save PNG Btn
    const saveImgBtn = document.createElement("button");
    saveImgBtn.className =
        "bg-blue text-white border-2 border-dark px-3 py-1.5 rounded-lg font-heading font-bold text-[11px] shadow-hard-sm hover:scale-105 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all flex items-center gap-1.5";
    saveImgBtn.innerHTML = `<i data-lucide="image" class="w-3.5 h-3.5"></i> SAVE PNG`;
    saveImgBtn.onclick = () => savePageAsImage(pageIndex, wrapper);
    controlsDiv.appendChild(saveImgBtn);

    // Delete Btn
    if (state.pages.length > 1) {
        const delBtn = document.createElement("button");
        delBtn.className =
            "bg-red-500 text-white border-2 border-dark px-3 py-1.5 rounded-lg font-heading font-bold text-[11px] shadow-hard-sm hover:scale-105 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all flex items-center gap-1.5";
        delBtn.innerHTML = `<i data-lucide="trash-2" class="w-3.5 h-3.5"></i> DELETE PAGE`;
        delBtn.onclick = () => deletePage(pageIndex);
        controlsDiv.appendChild(delBtn);
    }

    headerDiv.appendChild(controlsDiv);
    wrapper.appendChild(headerDiv);

    // --- The Actual Page ---
    const a4Page = document.createElement("div");
    a4Page.className = `a4-page a4-${state.orientation}`;
    a4Page.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    a4Page.style.gridTemplateRows = `repeat(${rows}, 1fr)`;

    const totalCardsPerPage = cols * rows;

    for (let i = 0; i < totalCardsPerPage; i++) {
        const card = document.createElement("div");
        card.className = "brutalist-card group";

        const savedCard =
            pageData && pageData[i]
                ? pageData[i]
                : { text: "", img: "", label: "" };
        const uid = `${pageIndex}-${i}`;

        // --- Card Contents ---

        // 1. Label Input (Top Left)
        const labelInput = document.createElement("div");
        labelInput.className = "card-label-input";
        labelInput.contentEditable = true;
        labelInput.innerText = savedCard.label || "";
        labelInput.onblur = () => saveState();
        labelInput.onkeydown = (e) => e.stopPropagation(); // Allow typing without triggering global hotkeys

        // 2. Remove Image Button
        const delBtn = document.createElement("button");
        delBtn.id = `del-${uid}`;
        delBtn.className = `no-print absolute top-2 right-2 bg-red-500 text-white rounded-md p-1 border-2 border-brand-dark shadow-sm z-50 hover:scale-110 transition-transform ${savedCard.img ? "" : "hidden"}`;
        delBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4"><path d="M18 6L6 18M6 6l12 12"/></svg>`;
        delBtn.onclick = (e) => {
            e.stopPropagation();
            removeImage(pageIndex, i);
        };

        // 3. Image Container
        const imgContainer = document.createElement("div");
        imgContainer.className = "image-container cursor-pointer";
        // Click to upload
        imgContainer.onclick = (e) => {
            if (
                e.target.tagName !== "INPUT" &&
                e.target.tagName !== "BUTTON"
            ) {
                document.getElementById(`file-${uid}`).click();
            }
        };

        const img = document.createElement("img");
        img.className = `image-preview ${savedCard.img ? "" : "hidden"}`;
        img.id = `img-${uid}`;
        if (savedCard.img) {
            resolveMediaUrl(savedCard.img).then(url => {
                img.src = url;
            });
        }

        const icon = document.createElement("div");
        icon.className = `no-print opacity-20 group-hover:opacity-100 transition-opacity duration-200 ${savedCard.img ? "hidden" : ""}`;
        icon.id = `icon-${uid}`;
        icon.innerHTML = `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`;

        // 4. Text Container
        const textContainer = document.createElement("div");
        textContainer.className = "text-container";
        const text = document.createElement("div");
        text.contentEditable = true;
        text.className = "outline-none"; 
        text.innerText = savedCard.text || "";
        text.oninput = () => {
            if (state.autoFit) autoFitText(text);
        };
        text.onblur = () => saveState();

        // PASTE SANITIZATION
        text.addEventListener("paste", (e) => {
            e.preventDefault();
            const textContent = (
                e.clipboardData || window.clipboardData
            ).getData("text");
            document.execCommand("insertText", false, textContent);
        });

        // 5. Hidden File Input
        const fileInput = document.createElement("input");
        fileInput.type = "file";
        fileInput.id = `file-${uid}`;
        fileInput.className = "hidden";
        fileInput.accept = "image/*";
        fileInput.onchange = (e) =>
            handleFileSelect(e.target.files[0], uid, pageIndex);

        // --- Drag and Drop Handlers ---
        card.addEventListener("dragover", (e) => {
            e.preventDefault();
            e.stopPropagation();
            card.classList.add("drag-over");
            card.style.opacity = "0.7";
        });

        card.addEventListener("dragleave", (e) => {
            e.preventDefault();
            e.stopPropagation();
            card.classList.remove("drag-over");
            card.style.opacity = "1";
        });

        card.addEventListener("drop", (e) => {
            e.preventDefault();
            e.stopPropagation();
            card.classList.remove("drag-over");
            card.style.opacity = "1";
            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith("image/")) {
                handleFileSelect(file, uid, pageIndex);
            }
        });

        // Assemble Card
        imgContainer.append(img, icon);
        textContainer.append(text);
        card.append(
            labelInput,
            delBtn,
            imgContainer,
            textContainer,
            fileInput,
        );
        a4Page.appendChild(card);
    }

    // Grid Guide Lines
    for (let i = 1; i < cols; i++) {
        const line = document.createElement("div");
        line.className = "guide-line guide-v";
        line.style.left = `${(i / cols) * 100}%`;
        a4Page.appendChild(line);
    }
    for (let i = 1; i < rows; i++) {
        const line = document.createElement("div");
        line.className = "guide-line guide-h";
        line.style.top = `${(i / rows) * 100}%`;
        a4Page.appendChild(line);
    }

    wrapper.appendChild(a4Page);
    pagesContainer.appendChild(wrapper);
}

function handleFileSelect(file, uid, pageIndex) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (re) => {
        const img = document.getElementById(`img-${uid}`);
        const icon = document.getElementById(`icon-${uid}`);
        const delBtn = document.getElementById(`del-${uid}`);

        img.src = reader.result;
        img.classList.remove("hidden");
        icon.classList.add("hidden");
        delBtn.classList.remove("hidden");

        // Check if full image mode is on, if so, update object fit
        img.classList.remove("cover");
        img.classList.add("contain");
        img.style.padding = state.imgHeight === 100 ? "0" : "4px";

        saveState();
    };
    reader.readAsDataURL(file);
}

async function resetTool() {
    const confirmed = await showConfirm(
        "Clear Workspace",
        "Clear everything? This will delete all cards and pages."
    );

    if (confirmed) {
        // Reset state to defaults
        state = {
            orientation: "portrait",
            gridCols: 3,
            gridRows: 3,
            imgHeight: 50,
            fontSize: 2,
            autoFit: false,
            pages: [[]],
        };

        // Update local storage
        localStorage.removeItem("flashcard_klasskit_state_v5");
        
        // Update IndexedDB
        await dbPut('cardMakerState', state);

        // Update UI
        inputCols.value = state.gridCols;
        inputRows.value = state.gridRows;
        renderAllPages(false);
        setOrientation(state.orientation, false);
        setImageSize(state.imgHeight, false);
        setFontSize(state.fontSize, false);
        updateToggleUI();
        
        showToast("Workspace cleared", "success");

        // Update Cloud State (Background)
        try {
            saveProgress('card_maker_state', state);
        } catch (e) {
            console.error("Cloud sync failed during reset", e);
        }
        
        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

async function exportToPNG() {
    const pages = document.querySelectorAll(".a4-page");
    if (pages.length === 0) {
        showToast("No pages to export!", "warning");
        return;
    }

    // Temporarily hide delete buttons & other UI clutter for pure export
    document.querySelectorAll('.no-print').forEach(el => {
        // Ensure del buttons within cards are completely hidden
        if (el.id && el.id.startsWith('del-')) {
            el.style.display = 'none';
        }
    });

    // Prevent text placeholders
    document.querySelectorAll('[contenteditable]').forEach(el => {
        if (el.innerText.trim() === '') {
            el.style.color = 'transparent';
            if (el.classList.contains('card-label-input')) {
                el.style.display = 'none';
            }
        }
    });

    for (let i = 0; i < pages.length; i++) {
        const page = pages[i];

        // Slightly scale up for better resolution pngs
        const canvas = await html2canvas(page, {
            scale: 2,
            useCORS: true,
            backgroundColor: '#ffffff'
        });

        const link = document.createElement("a");
        link.download = `card_maker_page_${i + 1}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
    }

    // Restore UI
    document.querySelectorAll('.no-print').forEach(el => {
        if (el.id && el.id.startsWith('del-')) {
            el.style.display = '';
        }
    });
    document.querySelectorAll('[contenteditable]').forEach(el => {
        if (el.innerText.trim() === '') {
            el.style.color = '';
            if (el.classList.contains('card-label-input')) {
                el.style.display = '';
            }
        }
    });
}

// --- Init ---
window.onload = async () => {
    await requireAuth();
    initTheme();
    await loadState();
    renderCardSets();
};
window.onresize = () => {
    if (state.autoFit)
        document
            .querySelectorAll(
                "[contenteditable]:not(.card-label-input)",
            )
            .forEach(autoFitText);
};
