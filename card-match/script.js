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
        toast.className = "toast";
        toast.innerHTML = `<i data-lucide="${
          type === "success" ? "check-circle" : "alert-circle"
        }" class="${
          type === "success" ? "text-green" : "text-pink"
        } w-5 h-5"></i><span>${message}</span>`;
        container.appendChild(toast);
        lucide.createIcons();
        setTimeout(() => {
          toast.style.opacity = "0";
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
        elements.defKey.focus();
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
        // For simple image match, we just delete as they are file uploads
      }

      function renderPairList() {
        elements.pairList.innerHTML = "";
        document.getElementById(
          "current-pairs-count"
        ).textContent = `(${gameConfig.pairs.length}/${MAX_PAIRS})`;

        if (gameConfig.pairs.length === 0) {
          elements.pairList.innerHTML =
            '<div class="text-gray-500 text-sm text-center py-6 border-2 border-dashed border-white/10 rounded-xl">No staged pairs yet.<br><span class="text-xs">Add from tabs above.</span></div>';
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
          el.className = `list-item-hover p-2 rounded-lg flex gap-3 items-center bg-surface/50 border border-white/5 group`;

          // Content Preview
          let contentPreview = "";
          if (
            pair.pairType === "image-image" ||
            (pair.pairType === "word-image" && pair.imageURL1)
          ) {
            contentPreview = `<img src="${pair.imageURL1}" class="w-8 h-8 rounded bg-dark object-cover border border-white/10">`;
          } else {
            contentPreview = `<div class="w-8 h-8 rounded bg-dark flex items-center justify-center text-xs text-gray-400 font-mono border border-white/10">Abc</div>`;
          }

          el.innerHTML = `
                    ${contentPreview}
                    <div class="flex flex-col flex-1 min-w-0">
                        <div class="flex items-center gap-2">
                            <i data-lucide="${icon}" class="w-3 h-3 ${color}"></i>
                            <span class="text-white font-bold text-sm truncate leading-tight">${escapeHTML(
                              pair.matchKey
                            )}</span>
                        </div>
                        <span class="text-[10px] text-gray-400 truncate">${
                          pair.content2
                            ? escapeHTML(pair.content2)
                            : "Image Match"
                        }</span>
                    </div>
                    
                    <div class="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                        ${
                          pair.pairType !== "image-image"
                            ? `
                        <button class="edit-btn p-1.5 hover:bg-blue/20 rounded-md text-blue transition" title="Edit">
                            <i data-lucide="pencil" class="w-3 h-3"></i>
                        </button>`
                            : ""
                        }
                        <button class="rm-btn p-1.5 hover:bg-pink/20 rounded-md text-pink transition" title="Delete">
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
          if (btn)
            btn.className = `tab-btn px-4 py-3 font-bold text-sm tracking-wide border-b-2 transition ${
              t === tabName
                ? "border-blue bg-surface/50 text-white"
                : "border-transparent text-gray-400 hover:border-white/20"
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
              b.className =
                "bg-dark hover:bg-blue/20 hover:text-blue text-gray-400 text-xs font-mono px-3 py-1.5 rounded-full transition border border-white/5";
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
        e.currentTarget.innerHTML = `<i data-lucide="${
          audioEnabled ? "volume-2" : "volume-x"
        }" class="w-5 h-5"></i>`;
        lucide.createIcons();
      };

      elements.simpleInput.oninput = () => saveConfig();

      // --- GAME ENGINE ---
      function restartGame() {
        elements.win.classList.add("hidden");
        document.getElementById("start-game-btn").click();
      }

      async function initGame(pairs) {
        await AudioEngine.init();
        elements.modal.classList.add("hidden");
        elements.msg.classList.add("hidden");
        document.getElementById("game-stats").classList.remove("hidden");
        document.getElementById("mobile-stats").classList.remove("hidden");

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

        deck.forEach((data) => {
          const card = document.createElement("div");
          card.className = "card aspect-square relative";
          card.dataset.key = data.matchKey;

          const contentHtml =
            data.type === "image"
              ? `<img src="${data.url}" class="" onerror="this.src='${OFFLINE_PLACEHOLDER}'">`
              : `<span class="${
                  data.content.length > 10 ? "text-xs" : "text-lg"
                }">${escapeHTML(data.content)}</span>`;

          card.innerHTML = `
                    <div class="card-inner">
                        <div class="card-face card-front border-2 border-white/10 rounded-xl">${contentHtml}</div>
                        <div class="card-face card-back border-2 border-white/10 flex items-center justify-center">?</div>
                    </div>`;

          card.onclick = () => flipCard(card);
          elements.grid.appendChild(card);
          cards.push(card);
        });

        // Timer
        if (timerInterval) clearInterval(timerInterval);
        timerSeconds = 0;
        const updateTimer = () => {
          const s = timerSeconds % 60,
            m = Math.floor(timerSeconds / 60);
          const str = `${m.toString().padStart(2, "0")}:${s
            .toString()
            .padStart(2, "0")}`;
          document.getElementById("timer-display").innerText = str;
          document.getElementById("mobile-timer").innerText = str;
          document.getElementById("moves-display").innerText = moves;
          document.getElementById("mobile-moves").innerText = moves;
          document.getElementById(
            "pairs-display"
          ).innerText = `${matchedPairs}/${totalPairs}`;
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