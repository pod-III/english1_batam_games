// --- STORAGE ---
const DB_NAME = "CardMatchDB";
const STORE_NAME = "Configs";
const DB_VERSION = 1;

const dbPromise = new Promise((resolve, reject) => {
  const request = indexedDB.open(DB_NAME, DB_VERSION);
  request.onupgradeneeded = (e) => {
    const db = e.target.result;
    if (!db.objectStoreNames.contains(STORE_NAME))
      db.createObjectStore(STORE_NAME);
  };
  request.onsuccess = (e) => resolve(e.target.result);
  request.onerror = (e) => reject(e.target.error);
});

async function dbSave(key, value) {
  try {
    const db = await dbPromise;
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(value, key);
  } catch (err) {
    console.error("Save Failed", err);
  }
}

async function dbGet(key) {
  try {
    const db = await dbPromise;
    return new Promise((resolve) => {
      const req = db
        .transaction(STORE_NAME, "readonly")
        .objectStore(STORE_NAME)
        .get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    });
  } catch (err) {
    return null;
  }
}

// --- CONSTANTS ---
const MAX_PAIRS = 12;
const OFFLINE_PLACEHOLDER =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 24 24' fill='none' stroke='%23475569' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='3' y='3' width='18' height='18' rx='2' ry='2'/%3E%3C/svg%3E";

function escapeHTML(str) {
  return str
    ? str.replace(
      /[&<>'"]/g,
      (tag) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;",
      }[tag])
    )
    : str;
}

// --- STATE ---
let gameConfig = { pairs: [] };
let cards = [],
  flippedCards = [],
  matchedPairs = 0,
  totalPairs = 0,
  moves = 0;
let timerSeconds = 0,
  timerInterval = null,
  isLocked = false;
let audioEnabled = true;
let activeSetupTab = "simple";

const PRESETS = {
  simple: {
    colors: "Red, Blue, Green, Yellow, Orange, Purple, Pink, Black",
    animals: "Dog, Cat, Bird, Fish, Lion, Elephant, Tiger, Monkey",
    fruits: "Apple, Banana, Orange, Grape, Mango, Pear, Lemon, Berry",
    school: "Pencil, Book, Eraser, Ruler, Desk, Chair, Pen, Bag",
    body: "Head, Hand, Foot, Eye, Ear, Mouth, Nose, Knee",
    weather: "Sunny, Rainy, Cloudy, Snowy, Windy, Stormy, Hot, Cold",
    sports: "Soccer, Tennis, Golf, Swim, Run, Jump, Basket, Box",
    family: "Mom, Dad, Sister, Brother, Grandma, Grandpa, Aunt, Uncle",
  },
  "word-def": {
    jobs: [
      { matchKey: "Doctor", content: "Treats sick people" },
      { matchKey: "Teacher", content: "Educates students" },
      { matchKey: "Chef", content: "Cooks meals" },
      { matchKey: "Pilot", content: "Flies airplanes" },
      { matchKey: "Artist", content: "Creates paintings" },
      { matchKey: "Police", content: "Enforces the law" },
    ],
    nature: [
      { matchKey: "Volcano", content: "Mountain with lava" },
      { matchKey: "Island", content: "Land in water" },
      { matchKey: "Valley", content: "Low land between hills" },
      { matchKey: "Forest", content: "Area with many trees" },
      { matchKey: "Desert", content: "Dry sandy place" },
      { matchKey: "Ocean", content: "Large body of salt water" },
    ],
    emotions: [
      { matchKey: "Jubilant", content: "Extremely joyful" },
      { matchKey: "Melancholy", content: "Pensive sadness" },
      { matchKey: "Anxious", content: "Worried or nervous" },
      { matchKey: "Furious", content: "Very angry" },
      { matchKey: "Exhausted", content: "Very tired" },
      { matchKey: "Terrified", content: "Very scared" },
    ],
    movement: [
      { matchKey: "Sprint", content: "Run very fast" },
      { matchKey: "Whisper", content: "Speak softly" },
      { matchKey: "Gaze", content: "Look steadily" },
      { matchKey: "Devour", content: "Eat quickly" },
      { matchKey: "Stroll", content: "Walk slowly" },
      { matchKey: "Hurl", content: "Throw forcefully" },
    ],
    opposites: [
      { matchKey: "Ancient", content: "Modern" },
      { matchKey: "Expand", content: "Shrink" },
      { matchKey: "Victory", content: "Defeat" },
      { matchKey: "Public", content: "Private" },
      { matchKey: "Generous", content: "Stingy" },
      { matchKey: "Innocent", content: "Guilty" },
    ],
  },
};

const AudioEngine = {
  init: async () => {
    if (Tone.context.state !== "running") await Tone.start();
  },
  playFlip: () => {
    if (audioEnabled)
      new Tone.MembraneSynth()
        .toDestination()
        .triggerAttackRelease("C2", "32n");
  },
  playMatch: () => {
    if (audioEnabled)
      new Tone.PolySynth(Tone.Synth)
        .toDestination()
        .triggerAttackRelease(["C4", "E4", "G4"], "16n");
  },
  playError: () => {
    if (audioEnabled)
      new Tone.PluckSynth()
        .toDestination()
        .triggerAttackRelease("C2", "16n");
  },
  playWin: () => {
    if (audioEnabled) {
      const s = new Tone.PolySynth().toDestination();
      s.triggerAttackRelease(["C4", "E4", "G4", "C5"], "8n");
    }
  },
};

function showToast(message, type = "success") {
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");

  // New "Chunky" Toast Style
  toast.className = `flex items-center gap-2 px-4 py-3 rounded-xl border-3 border-dark shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] font-bold text-dark transition-all transform translate-y-10 opacity-0 ${type === "success" ? "bg-green" : "bg-pink"
    }`;

  toast.innerHTML = `<i data-lucide="${type === "success" ? "check-circle" : "alert-circle"
    }" class="w-5 h-5"></i><span>${message}</span>`;

  container.appendChild(toast);
  lucide.createIcons();

  // Animation
  requestAnimationFrame(() => {
    toast.classList.remove("translate-y-10", "opacity-0");
  });

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(10px)";
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// --- DOM ---
const elements = {
  grid: document.getElementById("game-grid"),
  msg: document.getElementById("empty-grid-msg"),
  modal: document.getElementById("setup-modal"),
  win: document.getElementById("win-modal"),
  pairList: document.getElementById("pair-list"),
  simpleInput: document.getElementById("simple-word-input"),
  defKey: document.getElementById("def-input-match-key"),
  defContent: document.getElementById("def-input-content"),
  wordImgKey: document.getElementById("word-image-input-match-key"),
  wordImgFile: document.getElementById("word-image-input-filename"),
  imgDrop: document.getElementById("image-upload-zone"),
  imgInput: document.getElementById("image-file-input"),
};

// --- PAIR MANAGEMENT (IMPROVED) ---
function clearSetupInputs() {
  elements.defKey.value = "";
  elements.defContent.value = "";
  elements.wordImgKey.value = "";
  elements.wordImgFile.value = "";
  elements.imgInput.value = "";
}

async function addStructuredPair(
  pairType,
  matchKey,
  content1,
  content2,
  imageURL1,
  imageURL2
) {
  if (!matchKey || (!content1 && !imageURL1)) {
    return showToast("Missing Fields", "error");
  }
  if (gameConfig.pairs.length >= MAX_PAIRS) {
    return showToast("Max 12 Pairs Reached", "error");
  }

  gameConfig.pairs.push({
    id: Date.now() + Math.random(),
    pairType,
    matchKey,
    content: content1,
    content2,
    imageURL1,
    imageURL2,
  });

  await saveConfig();
  renderPairList();
  clearSetupInputs();
  showToast("Pair Added");
  AudioEngine.playMatch();
}

async function editPair(id) {
  const pair = gameConfig.pairs.find((p) => p.id === id);
  if (!pair) return;

  // Remove from list
  gameConfig.pairs = gameConfig.pairs.filter((p) => p.id !== id);
  await saveConfig();
  renderPairList();

  // Populate inputs & switch tab
  if (pair.pairType === "word-def") {
    switchSetupTab("word-def");
    elements.defKey.value = pair.matchKey;
    elements.defContent.value = pair.content2;
    elements.defContent.focus();
  } else if (pair.pairType === "word-image") {
    switchSetupTab("word-image");
    elements.wordImgKey.value = pair.matchKey;
    elements.wordImgFile.value = pair.imageURL1;
    elements.wordImgFile.focus();
  }
}

function renderPairList() {
  elements.pairList.innerHTML = "";
  document.getElementById(
    "current-pairs-count"
  ).textContent = `(${gameConfig.pairs.length}/${MAX_PAIRS})`;

  if (gameConfig.pairs.length === 0) {
    elements.pairList.innerHTML =
      '<div class="text-slate-400 text-sm font-bold text-center py-6 border-2 border-dashed border-slate-300 rounded-xl">No staged pairs yet.<br><span class="text-xs font-normal">Add from tabs on the left.</span></div>';
    document
      .getElementById("clear-all-pairs-btn")
      .classList.add("hidden");
    return;
  }
  document
    .getElementById("clear-all-pairs-btn")
    .classList.remove("hidden");

  gameConfig.pairs.forEach((pair) => {
    const isImg = pair.imageURL1 && pair.imageURL1 !== pair.matchKey;
    const icon =
      pair.pairType === "word-def"
        ? "book-open"
        : pair.pairType === "word-image"
          ? "image"
          : "layers";
    const color =
      pair.pairType === "word-def"
        ? "text-orange"
        : pair.pairType === "word-image"
          ? "text-green"
          : "text-pink";

    const el = document.createElement("div");
    // New List Item Style
    el.className = `p-3 rounded-xl flex gap-3 items-center bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-600 shadow-sm group hover:border-blue transition-colors`;

    // Content Preview
    let contentPreview = "";
    if (
      pair.pairType === "image-image" ||
      (pair.pairType === "word-image" && pair.imageURL1)
    ) {
      contentPreview = `<img src="${pair.imageURL1}" class="w-10 h-10 rounded-lg bg-slate-100 object-cover border-2 border-slate-200">`;
    } else {
      contentPreview = `<div class="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-xs text-slate-400 font-mono border-2 border-slate-200 dark:border-slate-600 font-bold">Abc</div>`;
    }

    el.innerHTML = `
              ${contentPreview}
              <div class="flex flex-col flex-1 min-w-0">
                  <div class="flex items-center gap-2">
                      <i data-lucide="${icon}" class="w-3 h-3 ${color}"></i>
                      <span class="text-dark dark:text-white font-bold text-sm truncate leading-tight">${escapeHTML(
      pair.matchKey
    )}</span>
                  </div>
                  <span class="text-[10px] text-slate-400 font-bold truncate">${pair.content2
        ? escapeHTML(pair.content2)
        : "Image Match"
      }</span>
              </div>
              
              <div class="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                  ${pair.pairType !== "image-image"
        ? `
                  <button class="edit-btn p-1.5 hover:bg-blue/10 rounded-md text-blue transition" title="Edit">
                      <i data-lucide="pencil" class="w-4 h-4"></i>
                  </button>`
        : ""
      }
                  <button class="rm-btn p-1.5 hover:bg-pink/10 rounded-md text-pink transition" title="Delete">
                      <i data-lucide="trash-2" class="w-4 h-4"></i>
                  </button>
              </div>
          `;

    if (pair.pairType !== "image-image")
      el.querySelector(".edit-btn").onclick = () => editPair(pair.id);
    el.querySelector(".rm-btn").onclick = async () => {
      gameConfig.pairs = gameConfig.pairs.filter((p) => p.id !== pair.id);
      await saveConfig();
      renderPairList();
      AudioEngine.playError();
    };
    elements.pairList.appendChild(el);
  });
  lucide.createIcons();
}

// --- SETUP TABS ---
function switchSetupTab(tabName) {
  clearSetupInputs();
  activeSetupTab = tabName;
  ["simple", "word-def", "word-image", "image-image"].forEach((t) => {
    const panel =
      document.getElementById(t + "-panel") ||
      document.getElementById(t + "-setup-panel");
    if (panel) panel.classList.toggle("hidden", t !== tabName);
    const btn = document.getElementById("tab-" + t);
    // Updated Tab Styling logic
    if (btn)
      btn.className = `flex-1 py-2 rounded-lg text-sm font-bold transition-all ${t === tabName
        ? "bg-white text-dark shadow-sm border border-slate-200"
        : "text-slate-400 hover:text-slate-600 hover:bg-slate-200/50"
        }`;
  });
}

// --- EVENT BINDINGS ---
window.onload = async () => {
  await loadConfig();
  setupDragDrop();

  // Generate Presets
  Object.keys(PRESETS).forEach((mode) => {
    const c = document.getElementById(mode + "-presets");
    if (c)
      Object.keys(PRESETS[mode]).forEach((k) => {
        const b = document.createElement("button");
        // Updated Preset Button Style
        b.className =
          "bg-white dark:bg-slate-800 hover:bg-blue hover:text-white text-slate-500 text-xs font-bold px-3 py-1.5 rounded-lg transition border-2 border-slate-200 dark:border-slate-600 uppercase tracking-wide";
        b.innerText = k.charAt(0).toUpperCase() + k.slice(1);
        b.onclick = async () => {
          if (mode === "simple")
            elements.simpleInput.value = PRESETS[mode][k];
          else {
            gameConfig.pairs = PRESETS[mode][k].map((item) => ({
              id: Date.now() + Math.random(),
              pairType: mode,
              matchKey: item.matchKey,
              content: item.content || item.matchKey,
              content2: item.content,
              imageURL1: item.imageURL1 || item.content,
            }));
            await saveConfig();
            renderPairList();
            switchSetupTab(mode);
          }
          showToast("Preset Loaded");
        };
        c.appendChild(b);
      });
  });

  renderPairList();

  const simpleWords = elements.simpleInput.value
    .split(",")
    .filter((w) => w.trim());
  if (simpleWords.length >= 2) initGame(compileTextPairs(simpleWords));
  else elements.modal.classList.remove("hidden");
};

// Button Actions
document.getElementById("settings-btn").onclick = () => {
  elements.modal.classList.remove("hidden");
  elements.win.classList.add("hidden");
};
document.getElementById("close-setup").onclick = () =>
  elements.modal.classList.add("hidden");
document.getElementById("restart-btn").onclick = () => restartGame();

document.getElementById("start-game-btn").onclick = () => {
  if (activeSetupTab === "simple") {
    const words = elements.simpleInput.value
      .split(",")
      .filter((w) => w.trim());
    if (words.length < 2)
      return showToast("Need at least 2 words", "error");
    initGame(compileTextPairs(words));
  } else {
    if (gameConfig.pairs.length < 2)
      return showToast("Need at least 2 pairs", "error");
    initGame(gameConfig.pairs);
  }

  // --- NEW: Single Image Upload Logic ---
  const singleImgPicker = document.getElementById('word-img-single-picker');
  const urlInput = document.getElementById('word-image-input-filename');

  singleImgPicker.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // limit size if needed (e.g., 2MB)
    if (file.size > 2 * 1024 * 1024) {
      showToast("Image too large (Max 2MB)", "error");
      return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      // 1. Put the Base64 string into the input field
      urlInput.value = evt.target.result;

      // 2. Visual Feedback
      showToast("Image Loaded!");

      // 3. Optional: Focus the 'Add' button so user can just hit Enter
      document.getElementById('add-word-image-pair-btn').focus();
    };
    reader.readAsDataURL(file);
  };
};

document
  .getElementById("add-def-pair-btn")
  .addEventListener("click", () =>
    addStructuredPair(
      "word-def",
      elements.defKey.value,
      elements.defContent.value,
      elements.defContent.value
    )
  );

document
  .getElementById("add-word-image-pair-btn")
  .addEventListener("click", () => {
    const f = elements.wordImgFile.value.trim();
    addStructuredPair(
      "word-image",
      elements.wordImgKey.value,
      f,
      null,
      f,
      null
    );
  });

document.getElementById("clear-all-pairs-btn").onclick = async () => {
  if (confirm("Delete all staged pairs?")) {
    gameConfig.pairs = [];
    await saveConfig();
    renderPairList();
  }
};

// "Enter" key trigger
document.querySelectorAll(".enter-trigger").forEach((input) => {
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      if (activeSetupTab === "word-def")
        document.getElementById("add-def-pair-btn").click();
      else if (activeSetupTab === "word-image")
        document.getElementById("add-word-image-pair-btn").click();
    }
  });
});

document.getElementById("sound-toggle").onclick = (e) => {
  audioEnabled = !audioEnabled;
  // Updated Icon coloring
  const icon = e.currentTarget.querySelector('svg');
  if (audioEnabled) {
    icon.classList.remove('text-slate-400');
    icon.classList.add('text-green');
  } else {
    icon.classList.remove('text-green');
    icon.classList.add('text-slate-400');
  }

  e.currentTarget.innerHTML = `<i data-lucide="${audioEnabled ? "volume-2" : "volume-x"
    }" class="w-5 h-5 ${audioEnabled ? "text-green" : "text-slate-400"}"></i>`;
  lucide.createIcons();
};

elements.simpleInput.oninput = () => saveConfig();

// --- GAME ENGINE ---
function restartGame() {
  elements.win.classList.add("hidden");
  document.getElementById("start-game-btn").click();
}

async function initGame(pairs) {
  // 1. Safety check for Audio (prevents crashing if browser blocks it)
  try { await AudioEngine.init(); } catch (e) { console.warn("Audio failed", e); }

  elements.modal.classList.add("hidden");
  elements.msg.classList.add("hidden");
  document.getElementById("game-stats").classList.remove("hidden");

  matchedPairs = 0;
  moves = 0;
  totalPairs = pairs.length;
  cards = [];
  flippedCards = [];
  isLocked = false;

  let deck = [];
  pairs.forEach((p) => {
    const base = { id: p.id, matchKey: p.matchKey };
    if (p.pairType === "simple-word" || p.pairType === "word-def") {
      deck.push(
        { ...base, type: "text", content: p.matchKey },
        { ...base, type: "text", content: p.content2 || p.content }
      );
    } else if (p.pairType === "word-image") {
      deck.push(
        { ...base, type: "text", content: p.matchKey },
        { ...base, type: "image", url: p.imageURL1 }
      );
    } else if (p.pairType === "image-image") {
      deck.push(
        { ...base, type: "image", url: p.imageURL1 },
        { ...base, type: "image", url: p.imageURL2 || p.imageURL1 }
      );
    }
  });

  // Shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  elements.grid.innerHTML = "";
  let cols = deck.length > 12 ? (deck.length > 16 ? 6 : 5) : 4;
  elements.grid.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;

  deck.forEach((data, index) => {
    const card = document.createElement("div");
    card.className = "card";

    // Animation Delay
    card.style.animationDelay = `${index * 0.05}s`;

    // Store data
    card.dataset.key = data.matchKey;

    const contentHtml =
      data.type === "image"
        ? `<img src="${data.url}" class="w-full h-full object-cover rounded-[0.8rem] pointer-events-none" onerror="this.src='${OFFLINE_PLACEHOLDER}'">`
        : `<span class="${data.content.length > 10 ? "text-sm" : "text-xl"
        } font-heading font-bold px-2 select-none">${escapeHTML(data.content)}</span>`;

    card.innerHTML = `
        <div class="card-inner pointer-events-auto">
            <div class="card-face card-front pointer-events-none">${contentHtml}</div>
            <div class="card-face card-back pointer-events-none">
                <i data-lucide="help-circle" class="w-8 h-8 opacity-50"></i>
            </div>
        </div>`;

    // NOTE: Removed card.onclick here. We use delegation below.
    elements.grid.appendChild(card);
    cards.push(card);
  });

  lucide.createIcons();

  // --- NEW: EVENT DELEGATION ---
  // This listens for clicks on the GRID, then finds the CARD
  elements.grid.onclick = (e) => {
    const card = e.target.closest('.card');
    if (card && elements.grid.contains(card)) {
      flipCard(card);
    }
  };

  // Timer Logic
  if (timerInterval) clearInterval(timerInterval);
  timerSeconds = 0;
  const updateTimer = () => {
    const s = timerSeconds % 60,
      m = Math.floor(timerSeconds / 60);
    document.getElementById("timer-display").innerText =
      `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    document.getElementById("moves-display").innerText = moves;
    document.getElementById("pairs-display").innerText = `${matchedPairs}/${totalPairs}`;
  };
  updateTimer();
  timerInterval = setInterval(() => {
    timerSeconds++;
    updateTimer();
  }, 1000);
}

function flipCard(card) {
  if (
    isLocked ||
    card.classList.contains("flipped") ||
    card.classList.contains("matched")
  )
    return;
  card.classList.add("flipped");
  flippedCards.push(card);
  AudioEngine.playFlip();
  if (flippedCards.length === 2) {
    moves++;
    checkForMatch();
  }
}

function checkForMatch() {
  isLocked = true;
  const [c1, c2] = flippedCards;
  if (c1.dataset.key === c2.dataset.key) {
    setTimeout(() => {
      c1.classList.add("matched");
      c2.classList.add("matched");
      matchedPairs++;
      AudioEngine.playMatch();
      if (matchedPairs === totalPairs) handleWin();
      flippedCards = [];
      isLocked = false;
    }, 500);
  } else {
    setTimeout(() => {
      c1.classList.remove("flipped");
      c2.classList.remove("flipped");
      AudioEngine.playError();
      flippedCards = [];
      isLocked = false;
    }, 1000);
  }
}

function handleWin() {
  clearInterval(timerInterval);
  AudioEngine.playWin();
  confetti({
    particleCount: 150,
    spread: 70,
    origin: { y: 0.6 },
    colors: ["#FF6B95", "#FF8C42", "#00E676", "#2979FF"],
  });
  document.getElementById("final-time").innerText =
    document.getElementById("timer-display").innerText;
  document.getElementById("final-moves").innerText = moves;
  setTimeout(() => elements.win.classList.remove("hidden"), 1000);
}

function compileTextPairs(words) {
  return [...new Set(words)].map((w) => ({
    id: Math.random(),
    pairType: "simple-word",
    matchKey: w.trim(),
    content: w.trim(),
  }));
}

async function saveConfig() {
  await dbSave("gameConfig", {
    pairs: gameConfig.pairs,
    simpleWords: elements.simpleInput.value,
  });
}
async function loadConfig() {
  const data = (await dbGet("gameConfig")) || {};
  if (data.pairs) gameConfig.pairs = data.pairs;
  if (data.simpleWords) elements.simpleInput.value = data.simpleWords;
}

// Drag Drop Logic
function setupDragDrop() {
  const zone = elements.imgDrop;
  const input = elements.imgInput;
  const processFiles = (files) => {
    let count = 0;
    Array.from(files).forEach((file) => {
      if (
        !file.type.startsWith("image/") ||
        gameConfig.pairs.length >= MAX_PAIRS
      )
        return;
      const reader = new FileReader();
      reader.onload = async (e) => {
        gameConfig.pairs.push({
          id: Date.now() + Math.random(),
          pairType: "image-image",
          matchKey: file.name.replace(/\.[^/.]+$/, ""),
          content: "Image",
          content2: "Image",
          imageURL1: e.target.result,
          imageURL2: e.target.result,
        });
        count++;
        if (
          count ===
          Math.min(
            files.length,
            MAX_PAIRS - gameConfig.pairs.length + count
          )
        ) {
          await saveConfig();
          renderPairList();
          showToast("Images Added");
          AudioEngine.playMatch();
        }
      };
      reader.readAsDataURL(file);
    });
  };
  input.onchange = (e) => processFiles(e.target.files);
  zone.ondragover = (e) => {
    e.preventDefault();
    zone.classList.add("drag-over");
  };
  zone.ondragleave = () => zone.classList.remove("drag-over");
  zone.ondrop = (e) => {
    e.preventDefault();
    zone.classList.remove("drag-over");
    processFiles(e.dataTransfer.files);
  };
}