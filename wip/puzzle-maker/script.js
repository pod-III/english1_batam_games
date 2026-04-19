// --- CACHED DOM ELEMENTS ---
const canvas = document.getElementById("puzzleCanvas");
const ctx = canvas.getContext("2d");
const printModal = document.getElementById("printModal");
const gameContainer = document.getElementById("game-container");
const placeholder = document.getElementById("placeholder");
const timerDisplay = document.getElementById("timerDisplay");
const movesDisplay = document.getElementById("movesDisplay");
const thumb = document.getElementById("thumb-preview");
const stats = document.getElementById("liveStats");
const toast = document.getElementById("toast");
const roundsList = document.getElementById("roundsList");
const sidebar = document.getElementById("sidebar");

const displayCols = document.getElementById("displayCols");
const displayRows = document.getElementById("displayRows");
const finalTimeDisplay = document.getElementById("finalTime");
const finalMovesDisplay = document.getElementById("finalMoves");
const liveNextBtn = document.getElementById("liveNextBtn");
const modalNextBtn = document.getElementById("modalNextBtn");

const state = {
  rounds: [],
  activeRound: 0,
  tabSize: 0.18,
  printReference: false,
  timer: null,
  start: 0,
  selectedIdx: -1,
  appMode: 'play', // 'play' or 'print'
  worksheetTitle: '',
  worksheetDesc: ''
};

// --- INDEXED DB SETUP ---
const DB_NAME = "KlassKitPuzzleDB";
const STORE_NAME = "gameState";
const DB_VERSION = 1;

function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = (e) => reject("DB error: " + e.target.error);
    request.onsuccess = (e) => resolve(e.target.result);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

// --- DARK MODE TOGGLE ---
function toggleDarkMode() {
  const html = document.documentElement;
  html.classList.toggle("dark");
  const isDark = html.classList.contains("dark");

  const icon = document.getElementById("darkModeIcon");
  if (icon) {
      icon.innerHTML = lucide.icons[isDark ? "sun" : "moon"].toSvg();
  }

  if (isDark) localStorage.setItem('theme_puzzle-maker', "dark");
  else localStorage.setItem('theme_puzzle-maker', "light");

  const r = getCurrentRound();
  if (r) {
      preRenderTiles(r);
      draw();
  }
}

// Load theme on startup
if (
  localStorage.getItem('theme_puzzle-maker') === "dark" ||
  (!("theme_puzzle-maker" in localStorage) &&
    window.matchMedia("(prefers-color-scheme: dark)").matches)
) {
  document.documentElement.classList.add("dark");
  document.addEventListener("DOMContentLoaded", () => {
    const icon = document.getElementById("darkModeIcon");
    if (icon) {
        icon.innerHTML = lucide.icons["sun"].toSvg();
    }
  });
}

function getCurrentRound() {
  return state.rounds[state.activeRound];
}

function toggleSidebar() {
  sidebar.classList.toggle("hidden-panel");
  const icon = document.getElementById("fsIcon");
  if (sidebar.classList.contains("hidden-panel")) {
    icon.innerHTML = lucide.icons["minimize-2"].toSvg();
    setTimeout(resize, 310);
  } else {
    icon.innerHTML = lucide.icons["maximize-2"].toSvg();
    setTimeout(resize, 310);
  }
}

function giveUp() {
  const r = getCurrentRound();
  if (!r || !r.isActive) return;

  r.isActive = false;
  clearInterval(state.timer);
  r.tiles.forEach((t) => {
    t.curC = t.c;
    t.curR = t.r;
  });

  preRenderTiles(r);
  draw();
  saveState();

  toast.innerHTML =
    '<i data-lucide="flag" class="w-4 h-4 text-pink"></i> <span>Puzzle Skipped</span>';
  showToast();
  updateNextBtnVisibility();
}

function nextRound() {
  if (state.activeRound < state.rounds.length - 1) {
    closeModal("winnerModal");
    switchToRound(state.activeRound + 1);
  }
}

function updateNextBtnVisibility() {
  const hasNext = state.activeRound < state.rounds.length - 1;
  if (hasNext) {
    liveNextBtn.classList.remove("hidden");
    modalNextBtn.style.display = "flex";
  } else {
    liveNextBtn.classList.add("hidden");
    modalNextBtn.style.display = "none";
  }
}

function renameRound(e, idx) {
  e.stopPropagation();
  const r = state.rounds[idx];
  const newName = prompt(
    "Enter a name for this puzzle:",
    r.name || `Page ${idx + 1}`,
  );
  if (newName) {
    r.name = newName;
    renderRoundsList();
    saveState();
  }
}

// --- PERSISTENCE (IndexedDB) ---
async function saveState() {
  try {
    const data = {
      activeRound: state.activeRound,
      rounds: state.rounds.map((r) => ({
        name: r.name,
        imgData: r.imgData,
        cols: r.cols,
        rows: r.rows,
        puzzleStyle: r.puzzleStyle,
        showHints: r.showHints,
        moves: r.moves,
        isActive: r.isActive,
        secondsElapsed: r.secondsElapsed,
        edges: r.edges,
        // Only save tile data, not the pre-rendered canvas objects
        tiles: r.tiles.map((t) => ({
          c: t.c,
          r: t.r,
          curC: t.curC,
          curR: t.curR,
          id: t.id,
        })),
      })),
    };

    const db = await initDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(data, "currentState");
  } catch (e) {
    console.error("Failed to save state to IndexedDB:", e);
  }
}

function showToast() {
  toast.classList.add("active");
  setTimeout(() => toast.classList.remove("active"), 2000);
  lucide.createIcons();
}

async function loadState() {
  try {
    const db = await initDB();
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).get("currentState");

    request.onsuccess = () => {
      const data = request.result;
      if (!data) return;

      state.activeRound = data.activeRound || 0;

      if (data.rounds && data.rounds.length > 0) {
        let loadedCount = 0;
        data.rounds.forEach((r, idx) => {
          const img = new Image();
          img.onload = () => {
            state.rounds[idx].imgObj = img;
            loadedCount++;
            if (loadedCount === data.rounds.length) {
              renderRoundsList();
              switchToRound(state.activeRound);
            }
          };
          img.src = r.imgData;
          state.rounds.push({
            ...r,
            name: r.name || `Page ${idx + 1}`,
            timer: null,
          });
        });
      }
    };
  } catch (e) {
    console.error("Error loading state from IndexedDB:", e);
  }
}

async function clearStorage() {
  if (
    !confirm(
      "Are you sure you want to delete all puzzle pages? This cannot be undone.",
    )
  )
    return;
  try {
    const db = await initDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete("currentState");
    tx.oncomplete = () => location.reload();
  } catch (e) {
    console.error("Error clearing IndexedDB", e);
    location.reload();
  }
}

// --- ROUND MANAGEMENT ---
function handleImageUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    const tempImg = new Image();
    tempImg.onload = () => {
      const targetRatio = 4 / 3;
      const imgRatio = tempImg.width / tempImg.height;

      let cropW,
        cropH,
        cropX = 0,
        cropY = 0;

      if (imgRatio > targetRatio) {
        cropH = tempImg.height;
        cropW = cropH * targetRatio;
        cropX = (tempImg.width - cropW) / 2;
      } else {
        cropW = tempImg.width;
        cropH = cropW / targetRatio;
        cropY = (tempImg.height - cropH) / 2;
      }

      const maxDim = 1024;
      let finalW = cropW;
      let finalH = cropH;

      if (finalW > maxDim) {
        const scale = maxDim / finalW;
        finalW *= scale;
        finalH *= scale;
      }

      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = finalW;
      tempCanvas.height = finalH;
      const tempCtx = tempCanvas.getContext("2d");

      tempCtx.drawImage(
        tempImg,
        cropX,
        cropY,
        cropW,
        cropH,
        0,
        0,
        finalW,
        finalH,
      );

      const compressedDataUrl = tempCanvas.toDataURL("image/jpeg", 0.7);

      const finalImg = new Image();
      finalImg.onload = () => {
        addNewRound(finalImg, compressedDataUrl);
        e.target.value = "";
      };
      finalImg.src = compressedDataUrl;
    };
    tempImg.src = event.target.result;
  };
  reader.readAsDataURL(file);
}

function addNewRound(imgObj, imgData) {
  const newRound = {
    name: `Page ${state.rounds.length + 1}`,
    imgObj: imgObj,
    imgData: imgData,
    cols: 3,
    rows: 3,
    tiles: [],
    edges: { h: [], v: [] },
    puzzleStyle: "jigsaw",
    showHints: false,
    moves: 0,
    isActive: false,
    secondsElapsed: 0,
    timer: null,
  };

  generateTilesForRound(newRound);
  state.rounds.push(newRound);
  state.activeRound = state.rounds.length - 1;

  renderRoundsList();
  switchToRound(state.activeRound);
  saveState();

  toast.innerHTML =
    '<i data-lucide="check" class="w-4 h-4 text-green"></i> <span>Page Added</span>';
  showToast();
}

function deleteRound(e, idx) {
  e.stopPropagation();
  if (confirm("Remove this page?")) {
    state.rounds.splice(idx, 1);
    if (state.rounds.length === 0) {
      clearStorage();
    } else {
      state.activeRound = Math.max(0, state.activeRound - 1);
      renderRoundsList();
      switchToRound(state.activeRound);
      saveState();
    }
  }
}

function renderRoundsList() {
  roundsList.innerHTML = "";
  state.rounds.forEach((r, idx) => {
    const div = document.createElement("div");
    div.className = `round-item ${idx === state.activeRound ? "active" : ""}`;
    div.onclick = () => switchToRound(idx);

    div.innerHTML = `
            <div class="relative w-12 h-12 flex-shrink-0">
                <img src="${r.imgData}" alt="Round ${idx + 1}">
                <div class="absolute -top-1 -right-1 bg-blue text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">${idx + 1}</div>
            </div>
            <div class="flex-1 min-w-0">
                <h4 class="font-bold text-dark dark:text-white text-xs truncate">${r.name}</h4>
                <p class="text-[10px] text-slate-400 font-bold">${r.cols}x${r.rows}</p>
            </div>
            <div class="flex flex-col gap-1">
                <button onclick="renameRound(event, ${idx})" class="p-1 text-slate-300 hover:text-blue transition-colors" title="Rename">
                    <i data-lucide="pencil" class="w-3 h-3"></i>
                </button>
                <button onclick="deleteRound(event, ${idx})" class="p-1 text-slate-300 hover:text-pink transition-colors" title="Delete">
                    <i data-lucide="trash-2" class="w-3 h-3"></i>
                </button>
            </div>
        `;
    roundsList.appendChild(div);
  });
  lucide.createIcons();
  document.getElementById("printPageCount").textContent = state.rounds.length;
}

function switchToRound(idx) {
  clearInterval(state.timer);
  state.activeRound = idx;
  const r = getCurrentRound();

  renderRoundsList();

  if (!r) {
    placeholder.style.display = "block";
    gameContainer.style.display = "none";
    return;
  }

  placeholder.style.display = "none";
  gameContainer.style.display = "block";
  ["btnScramble", "btnSolve", "btnPrint"].forEach(
    (id) => (document.getElementById(id).disabled = false),
  );

  displayCols.textContent = r.cols;
  displayRows.textContent = r.rows;
  updateStyleUI(r);
  updateHintUI(r);
  movesDisplay.textContent = r.moves;
  timerDisplay.textContent = formatTime(r.secondsElapsed);
  thumb.src = r.imgData;
  thumb.style.display = "none";

  if (r.isActive) {
    stats.classList.remove("hidden");
    state.start = Date.now() - r.secondsElapsed * 1000;
    state.timer = setInterval(updTimer, 1000);
  } else {
    stats.classList.add("hidden");
  }

  updateNextBtnVisibility();
  resize();
}

// --- GAME LOGIC & PRE-RENDERING ---
function generateTilesForRound(round) {
  round.tiles = [];
  round.edges.h = [];
  round.edges.v = [];

  for (let r = 0; r < round.rows; r++) {
    const row = [];
    for (let c = 0; c < round.cols - 1; c++)
      row.push(Math.random() < 0.5 ? 1 : -1);
    round.edges.h.push(row);
  }
  for (let r = 0; r < round.rows - 1; r++) {
    const row = [];
    for (let c = 0; c < round.cols; c++) row.push(Math.random() < 0.5 ? 1 : -1);
    round.edges.v.push(row);
  }

  for (let r = 0; r < round.rows; r++) {
    for (let c = 0; c < round.cols; c++) {
      round.tiles.push({ c, r, curC: c, curR: r, id: r * round.cols + c + 1 });
    }
  }
}

function drawTileShape(ctx, c, r, w, h, x, y, round) {
  const ts = Math.min(w, h) * state.tabSize;
  ctx.beginPath();
  ctx.moveTo(x, y);

  if (r === 0 || round.puzzleStyle === "grid") ctx.lineTo(x + w, y);
  else drawEdge(ctx, x, y, x + w, y, round.edges.v[r - 1][c], ts);

  if (c === round.cols - 1 || round.puzzleStyle === "grid")
    ctx.lineTo(x + w, y + h);
  else drawEdge(ctx, x + w, y, x + w, y + h, round.edges.h[r][c], ts);

  if (r === round.rows - 1 || round.puzzleStyle === "grid")
    ctx.lineTo(x, y + h);
  else drawEdge(ctx, x + w, y + h, x, y + h, -round.edges.v[r][c], ts);

  if (c === 0 || round.puzzleStyle === "grid") ctx.lineTo(x, y);
  else drawEdge(ctx, x, y + h, x, y, -round.edges.h[r][c - 1], ts);

  ctx.closePath();
}

function drawEdge(ctx, x1, y1, x2, y2, side, ts) {
  const dx = x2 - x1,
    dy = y2 - y1;
  const nx = -dy / Math.sqrt(dx * dx + dy * dy),
    ny = dx / Math.sqrt(dx * dx + dy * dy);
  const p1x = x1 + dx * 0.35,
    p1y = y1 + dy * 0.35;
  const p2x = x1 + dx * 0.35 + nx * ts * side,
    p2y = y1 + dy * 0.35 + ny * ts * side;
  const p3x = x1 + dx * 0.65 + nx * ts * side,
    p3y = y1 + dy * 0.65 + ny * ts * side;
  const p4x = x1 + dx * 0.65,
    p4y = y1 + dy * 0.65;
  ctx.lineTo(p1x, p1y);
  ctx.bezierCurveTo(p2x, p2y, p3x, p3y, p4x, p4y);
  ctx.lineTo(x2, y2);
}

function preRenderTiles(r) {
  if (!r || !r.imgObj || canvas.width === 0) return;

  const tw = canvas.width / r.cols;
  const th = canvas.height / r.rows;
  const iw = r.imgObj.width / r.cols;
  const ih = r.imgObj.height / r.rows;
  const bleed = Math.min(tw, th) * state.tabSize;

  const isDarkMode = document.documentElement.classList.contains("dark");
  const defaultStroke = isDarkMode
    ? "rgba(148, 163, 184, 0.4)"
    : "rgba(30, 41, 59, 0.3)";
  const activeStroke = "rgba(255,255,255,0.8)";

  r.tiles.forEach((t) => {
    const tCanvas = document.createElement("canvas");
    tCanvas.width = tw + bleed * 2;
    tCanvas.height = th + bleed * 2;
    const tCtx = tCanvas.getContext("2d");

    tCtx.translate(bleed - t.c * tw, bleed - t.r * th);

    tCtx.save();
    drawTileShape(tCtx, t.c, t.r, tw, th, t.c * tw, t.r * th, r);
    tCtx.clip();

    tCtx.drawImage(
      r.imgObj,
      t.c * iw - iw * state.tabSize,
      t.r * ih - ih * state.tabSize,
      iw + iw * state.tabSize * 2,
      ih + ih * state.tabSize * 2,
      t.c * tw - bleed,
      t.r * th - bleed,
      tw + bleed * 2,
      th + bleed * 2,
    );
    tCtx.restore();

    tCtx.save();
    drawTileShape(tCtx, t.c, t.r, tw, th, t.c * tw, t.r * th, r);
    tCtx.lineWidth = 4;
    tCtx.strokeStyle = r.isActive ? activeStroke : defaultStroke;
    tCtx.stroke();
    tCtx.restore();

    t.canvas = tCanvas;
  });
}

function draw() {
  const r = getCurrentRound();
  if (!r || !r.imgObj) return;

  const tw = canvas.width / r.cols;
  const th = canvas.height / r.rows;
  const bleed = Math.min(tw, th) * state.tabSize;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const isDarkMode = document.documentElement.classList.contains("dark");

  r.tiles.forEach((t, i) => {
    const dx = t.curC * tw;
    const dy = t.curR * th;

    if (t.canvas) {
      ctx.drawImage(t.canvas, dx - bleed, dy - bleed);
    }

    if (i === state.selectedIdx) {
      ctx.save();
      drawTileShape(ctx, t.curC, t.curR, tw, th, dx, dy, r);
      ctx.strokeStyle = "#2979FF";
      ctx.lineWidth = 6;
      ctx.stroke();
      ctx.fillStyle = "rgba(41, 121, 255, 0.2)";
      ctx.fill();
      ctx.restore();
    }

    if (r.showHints) {
      ctx.fillStyle = r.isActive
        ? "rgba(255,255,255,0.95)"
        : isDarkMode
          ? "rgba(255,255,255,0.6)"
          : "rgba(30,41,59,0.5)";
      ctx.font = `bold ${Math.min(tw, th) * 0.35}px Fredoka`;
      ctx.textAlign = "center";
      ctx.fillText(t.id, dx + tw / 2, dy + th / 2 + 10);
    }
  });
}

canvas.addEventListener("click", (e) => {
  const r = getCurrentRound();
  if (!r || !r.isActive) return;

  const rect = canvas.getBoundingClientRect();
  const sx = canvas.width / rect.width;
  const sy = canvas.height / rect.height;

  let x = (e.clientX - rect.left) * sx;
  let y = (e.clientY - rect.top) * sy;
  x = Math.max(0, Math.min(x, canvas.width - 0.1));
  y = Math.max(0, Math.min(y, canvas.height - 0.1));

  const c = Math.floor(x / (canvas.width / r.cols));
  const row = Math.floor(y / (canvas.height / r.rows));

  const idx = r.tiles.findIndex((t) => t.curC === c && t.curR === row);
  if (idx === -1) return;

  if (state.selectedIdx === -1) state.selectedIdx = idx;
  else if (state.selectedIdx === idx) state.selectedIdx = -1;
  else {
    const t1 = r.tiles[state.selectedIdx],
      t2 = r.tiles[idx];
    [t1.curC, t2.curC] = [t2.curC, t1.curC];
    [t1.curR, t2.curR] = [t2.curR, t1.curR];
    state.selectedIdx = -1;
    r.moves++;
    movesDisplay.textContent = r.moves;
    checkWin();
    saveState();
  }
  draw();
});

function checkWin() {
  const r = getCurrentRound();
  if (r.tiles.every((t) => t.c === t.curC && t.r === t.curR)) {
    r.isActive = false;
    clearInterval(state.timer);
    finalTimeDisplay.textContent = timerDisplay.textContent;
    finalMovesDisplay.textContent = r.moves;

    setTimeout(
      () => document.getElementById("winnerModal").classList.add("active"),
      400,
    );
    updateNextBtnVisibility();

    preRenderTiles(r);
    draw();
    saveState();
  }
}

function scramblePuzzle() {
  const r = getCurrentRound();
  if (!r) return;

  const pos = [];
  for (let row = 0; row < r.rows; row++)
    for (let c = 0; c < r.cols; c++) pos.push({ c, row });
  pos.sort(() => Math.random() - 0.5);
  r.tiles.forEach((t, i) => {
    t.curC = pos[i].c;
    t.curR = pos[i].row;
  });

  r.isActive = true;
  state.selectedIdx = -1;
  r.moves = 0;
  movesDisplay.textContent = "0";
  stats.classList.remove("hidden");
  liveNextBtn.classList.add("hidden");

  clearInterval(state.timer);
  r.secondsElapsed = 0;
  state.start = Date.now();
  state.timer = setInterval(updTimer, 1000);

  preRenderTiles(r);
  draw();
  saveState();
}

function toggleSolve() {
  if (!getCurrentRound()) return;
  const isShown = thumb.style.display === "block";
  thumb.style.display = isShown ? "none" : "block";
}

function updTimer() {
  const r = getCurrentRound();
  if (!r || !r.isActive) return;

  r.secondsElapsed = Math.floor((Date.now() - state.start) / 1000);
  timerDisplay.textContent = formatTime(r.secondsElapsed);
  if (r.secondsElapsed % 5 === 0) saveState();
}

function formatTime(sec) {
  return `${Math.floor(sec / 60)
    .toString()
    .padStart(2, "0")}:${(sec % 60).toString().padStart(2, "0")}`;
}

function adjustGrid(k, v) {
  const r = getCurrentRound();
  if (!r || r.isActive) return;
  r[k] = Math.max(2, Math.min(10, r[k] + v));
  if (k === "cols") displayCols.textContent = r[k];
  else displayRows.textContent = r[k];

  renderRoundsList();
  generateTilesForRound(r);
  preRenderTiles(r);
  draw();
  saveState();
}

function setPreset(n) {
  const r = getCurrentRound();
  if (!r || r.isActive) return;
  r.cols = n;
  r.rows = n;
  displayCols.textContent = n;
  displayRows.textContent = n;

  renderRoundsList();
  generateTilesForRound(r);
  preRenderTiles(r);
  draw();
  saveState();
}

function togglePuzzleStyle() {
  const r = getCurrentRound();
  if (!r) return;
  r.puzzleStyle = r.puzzleStyle === "jigsaw" ? "grid" : "jigsaw";
  updateStyleUI(r);
  preRenderTiles(r);
  draw();
  saveState();
}

function toggleHints() {
  const r = getCurrentRound();
  if (!r) return;
  r.showHints = !r.showHints;
  updateHintUI(r);
  draw();
  saveState();
}

function updateStyleUI(r) {
  const btn = document.getElementById("styleToggleBtn");
  const icon = document.getElementById("styleIcon");
  if (r.puzzleStyle === "jigsaw") {
    btn.classList.add("active");
    icon.innerHTML = lucide.icons["puzzle"].toSvg({ strokeWidth: 3 });
  } else {
    btn.classList.remove("active");
    icon.innerHTML = lucide.icons["grid"].toSvg({ strokeWidth: 2 });
  }
}

function updateHintUI(r) {
  const btn = document.getElementById("hintToggleBtn");
  const icon = document.getElementById("hintIcon");
  if (r.showHints) {
    btn.classList.add("active");
    icon.innerHTML = lucide.icons["check-circle-2"].toSvg({ strokeWidth: 3 });
  } else {
    btn.classList.remove("active");
    icon.innerHTML = lucide.icons["circle"].toSvg({ strokeWidth: 2 });
  }
}

function resize() {
  const r = getCurrentRound();
  if (!r || !r.imgObj) return;

  const isFullscreen = sidebar.classList.contains("hidden-panel");
  const mw = window.innerWidth - (isFullscreen ? 80 : 440);
  const mh = window.innerHeight - 180;

  const ratio = Math.min(mw / r.imgObj.width, mh / r.imgObj.height);
  canvas.width = r.imgObj.width * ratio;
  canvas.height = r.imgObj.height * ratio;

  gameContainer.style.width = canvas.width + "px";
  gameContainer.style.height = canvas.height + "px";

  preRenderTiles(r);
  draw();
}

window.onresize = resize;
function closeModal(id) {
  document.getElementById(id).classList.remove("active");
}
function openPrintModal() {
  printModal.classList.add("active");
}

window.onload = () => {
  setAppMode('play');
  loadState();
  lucide.createIcons();
};


function setAppMode(mode) {
  state.appMode = mode;
  
  const playBtn = document.getElementById('modePlayBtn');
  const printBtn = document.getElementById('modePrintBtn');
  
  const gameContainer = document.getElementById('game-container');
  const printPreview = document.getElementById('printPreviewContainer');
  
  const playActions = document.getElementById('playActions');
  const printActions = document.getElementById('printActions');
  const printSetup = document.getElementById('printSetupSection');
  const printModalBtn = document.getElementById('btnPrint'); // Old modal btn
  const styleToggleBtn = document.getElementById('styleToggleBtn');
  const hintToggleBtn = document.getElementById('hintToggleBtn');

  if (mode === 'play') {
    // Style buttons
    playBtn.className = "px-6 py-3 rounded-xl font-heading font-bold text-sm tracking-wider uppercase transition-colors bg-blue text-white";
    printBtn.className = "px-6 py-3 rounded-xl font-heading font-bold text-sm tracking-wider uppercase transition-colors text-slate-500 hover:bg-slate-100";
    
    // Containers
    printPreview.classList.add('hidden');
    gameContainer.classList.remove('hidden');
    document.getElementById('liveStats').classList.remove('no-print'); // Re-enable stats visually if active
    if (!getCurrentRound() || !getCurrentRound().isActive) {
      document.getElementById('liveStats').classList.add('hidden');
    } else {
      document.getElementById('liveStats').classList.remove('hidden');
    }
    
    // Sidebar
    playActions.classList.remove('hidden');
    printActions.classList.add('hidden');
    printSetup.style.display = 'none';
    if(printModalBtn) printModalBtn.parentElement.classList.remove('hidden');
    
    // Puzzle styling buttons available in both, but let's make sure they are enabled
    styleToggleBtn.style.opacity = '1';
    hintToggleBtn.style.opacity = '1';
    styleToggleBtn.style.pointerEvents = 'auto';
    hintToggleBtn.style.pointerEvents = 'auto';

    resize();
  } else {
    // Style buttons
    printBtn.className = "px-6 py-3 rounded-xl font-heading font-bold text-sm tracking-wider uppercase transition-colors bg-blue text-white";
    playBtn.className = "px-6 py-3 rounded-xl font-heading font-bold text-sm tracking-wider uppercase transition-colors text-slate-500 hover:bg-slate-100";
    
    // Containers
    gameContainer.classList.add('hidden');
    printPreview.classList.remove('hidden');
    printPreview.classList.add('flex');
    document.getElementById('liveStats').classList.add('hidden');
    
    // Sidebar
    playActions.classList.add('hidden');
    printActions.classList.remove('hidden');
    printSetup.style.display = 'block';
    if(printModalBtn) printModalBtn.parentElement.classList.add('hidden');
    
    // Update preview
    updateWorksheetPreview();
  }
}

function extractTileAsImage(r, t, tw, th, iw, ih, bleed) {
  const pCanvas = document.createElement("canvas");
  pCanvas.width = tw + bleed * 2;
  pCanvas.height = th + bleed * 2;
  const pCtx = pCanvas.getContext("2d");

  const sx = t.c * iw;
  const sy = t.r * ih;
  const dx = bleed; // inside the isolated canvas
  const dy = bleed;

  pCtx.save();
  // Draw puzzle shape Path starting from (dx, dy)
  drawTileShape(pCtx, t.c, t.r, tw, th, dx, dy, r);
  pCtx.clip();
  pCtx.drawImage(
    r.imgObj,
    sx - iw * state.tabSize,
    sy - ih * state.tabSize,
    iw + iw * state.tabSize * 2,
    ih + ih * state.tabSize * 2,
    0,
    0,
    tw + bleed * 2,
    th + bleed * 2
  );
  pCtx.restore();

  // Draw outline
  pCtx.save();
  drawTileShape(pCtx, t.c, t.r, tw, th, dx, dy, r);
  pCtx.lineWidth = Math.max(2, (Math.min(tw,th)*0.015));
  pCtx.strokeStyle = "rgba(0,0,0,0.8)";
  pCtx.stroke();
  pCtx.restore();

  return pCanvas.toDataURL("image/png"); // Important: PNG for transparency
}

function extractEmptyShape(r, t, tw, th, bleed) {
  const pCanvas = document.createElement("canvas");
  pCanvas.width = tw + bleed * 2;
  pCanvas.height = th + bleed * 2;
  const pCtx = pCanvas.getContext("2d");

  const dx = bleed;
  const dy = bleed;

  pCtx.save();
  drawTileShape(pCtx, t.c, t.r, tw, th, dx, dy, r);
  pCtx.lineWidth = Math.max(1, (Math.min(tw,th)*0.01));
  pCtx.strokeStyle = "rgba(100,116,139,0.3)"; // Faint slate outline
  
  if (r.puzzleStyle === "jigsaw") {
    pCtx.setLineDash([5, 5]); // Dashed line for pasteboard
  }
  pCtx.stroke();
  pCtx.restore();

  if (r.showHints) {
    pCtx.fillStyle = "rgba(148, 163, 184, 0.4)"; // muted hint
    pCtx.font = `bold ${Math.min(tw, th) * 0.3}px Fredoka`;
    pCtx.textAlign = "center";
    pCtx.textBaseline = "middle";
    pCtx.fillText(t.id, dx + tw/2, dy + th/2);
  }

  return pCanvas.toDataURL("image/png");
}

function generatePrintPages(r, isPreview = false) {
    const title = document.getElementById('wsTitleInput').value.trim() || r.name;
    const desc = document.getElementById('wsDescInput').value.trim() || "Cut out the pieces and glue them onto the empty grid to complete the puzzle.";
    
    // Header standard html
    const headerHtml = `
        <div class="w-full flex justify-between items-end border-b-[3px] border-dark pb-4 mb-8 shrink-0">
            <div>
                <h1 class="text-3xl font-heading font-black text-dark tracking-tight">${title}</h1>
                <p class="text-xs font-bold uppercase tracking-widest text-slate-500 mt-2">${desc}</p>
            </div>
            <div class="flex flex-col gap-3 text-right shrink-0 ml-8">
                <div class="flex items-end gap-2 text-sm font-bold text-dark whitespace-nowrap">
                    <span>Name:</span><div class="border-b-2 border-dark w-48 shrink-0 inline-block"></div>
                </div>
                <div class="flex items-end gap-2 text-sm font-bold text-dark whitespace-nowrap">
                    <span>Date:</span><div class="border-b-2 border-dark w-48 shrink-0 inline-block"></div>
                </div>
            </div>
        </div>
    `;

    // 1. Generate pieces
    const tw = r.imgObj.width / r.cols;
    const th = r.imgObj.height / r.rows;
    const iw = r.imgObj.width / r.cols;
    const ih = r.imgObj.height / r.rows;
    // For print, we want to scale to a standard resolution to fit the page and not be huge
    const printScale = Math.min(800 / r.imgObj.width, 800 / r.imgObj.height); 
    const pTw = tw * printScale;
    const pTh = th * printScale;
    const pIw = iw * printScale;
    const pIh = ih * printScale;
    const pBleed = Math.min(pTw, pTh) * state.tabSize;

    // Scramble tiles for page 1
    const scrambledTiles = [...r.tiles].sort(() => Math.random() - 0.5);
    
    const piecesPageHtml = `
        <div class="a4-preview ${!isPreview ? 'print-page' : ''} flex flex-col">
            ${headerHtml}
            <div class="flex-1 w-full flex flex-wrap justify-center items-center gap-6 p-4">
                ${scrambledTiles.map(t => {
                    const src = extractTileAsImage(r, t, pTw, pTh, pIw, pIh, pBleed);
                    return `<img src="${src}" class="max-w-[150px] max-h-[150px] object-contain drop-shadow-sm filter contrast-105" />`;
                }).join('')}
            </div>
        </div>
    `;

    // 2. Pasteboard
    const pastePageHtml = `
        <div class="a4-preview ${!isPreview ? 'print-page' : ''} flex flex-col">
            ${headerHtml}
            <div class="flex-1 w-full flex justify-center items-center p-4">
                <div class="relative" style="width: ${r.imgObj.width * printScale}px; height: ${r.imgObj.height * printScale}px; border: 4px solid #1e293b;">
                    ${r.tiles.map(t => {
                        const src = extractEmptyShape(r, t, pTw, pTh, pBleed);
                        // The shape includes bleed, meaning its total size is larger.
                        // We must offset it by -bleed to place the core tile matching the logical grid coordinates.
                        const left = (t.c * pTw) - pBleed;
                        const top = (t.r * pTh) - pBleed;
                        return `<img src="${src}" class="absolute pointer-events-none" style="left: ${left}px; top: ${top}px; width: ${pTw + 2*pBleed}px; height: ${pTh + 2*pBleed}px;" />`;
                    }).join('')}
                </div>
            </div>
        </div>
    `;

    // 3. Answer Key
    const answerPageHtml = `
        <div class="a4-preview ${!isPreview ? 'print-page' : ''} flex flex-col">
            ${headerHtml}
            <div class="flex-1 w-full flex flex-col justify-center items-center">
                 <h2 class="text-2xl font-bold font-heading text-slate-300 mb-8 uppercase tracking-widest">Answer Key</h2>
                 <img src="${r.imgData}" class="max-w-[70%] max-h-[60%] border-4 border-dark object-contain shadow-neo" />
            </div>
        </div>
    `;

    return piecesPageHtml + pastePageHtml + answerPageHtml;
}

function updateWorksheetPreview() {
  const r = getCurrentRound();
  const previewContainer = document.getElementById('worksheetPreviewPages');
  if (!r || !r.imgObj) {
      previewContainer.innerHTML = '<div class="p-8 text-center text-slate-400 font-bold">Please select or upload a page first.</div>';
      return;
  }
  
  if (state.appMode !== 'print') return;
  
  // Save input values to state
  state.worksheetTitle = document.getElementById('wsTitleInput').value;
  state.worksheetDesc = document.getElementById('wsDescInput').value;

  previewContainer.innerHTML = generatePrintPages(r, true);
  lucide.createIcons();
}

function executeWorksheetPrint() {
  const r = getCurrentRound();
  if(!r) return;

  const printArea = document.getElementById("print-area");
  printArea.innerHTML = generatePrintPages(r, false);
  
  setTimeout(() => {
    window.print();
  }, 500);
}

// Hook it into switch to round
const originalSwitchToRound = switchToRound;
switchToRound = function(idx) {
    originalSwitchToRound(idx);
    
    // restore title/desc inputs if they were cleared
    document.getElementById('wsTitleInput').value = state.worksheetTitle || '';
    document.getElementById('wsDescInput').value = state.worksheetDesc || '';
    
    // Enable print setup section button
    document.getElementById('btnPrintWorksheet').disabled = (idx === -1);
    
    if (state.appMode === 'print') {
        updateWorksheetPreview();
    }
}

