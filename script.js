    // --- CONFIG ---
    const Config = {
      helpUrl: "https://forms.gle/VRqg4f3KFHoJXFUu9"
    };

    // --- GAME DATA (Keep this section) ---
    const GAMES = [
      { id: "clockcalendar", title: "Clock", category: "tool", path: "./clock/index.html", icon: "clock", color: "text-pink", description: "Time & Calendar", guide: "<ul class='list-disc pl-4 space-y-1'><li><strong>Modes:</strong> Switch between a clock, timer, stopwatch or a calender.</li><li><strong>Timer:</strong> Use the built-in stopwatch/timer.</li><li><strong>Display:</strong> Toggle Full Screen for visibility.</li></ul>" },
      { id: "whiteboard", title: "Whiteboard", category: "tool", path: "./whiteboard/index.html", icon: "pen-tool", color: "text-blue", description: "Draw & Explain", guide: "<ul class='list-disc pl-4 space-y-1'><li><strong>Draw:</strong> Select colors from the toolbar.</li><li><strong>Undo:</strong> Click the undo button to reverse action.</li><li><strong>Clear:</strong> Trash icon erases the board.</li></ul>" },
      { id: "scoreboard", title: "Scoreboard", category: "tool", path: "./scorecounter/index.html", icon: "trophy", color: "text-blue", description: "Track Points", guide: "<ul class='list-disc pl-4 space-y-1'><li><strong>Team:</strong> Add the team through the team name box.</li><li><strong>Points:</strong> Tap numbers or +/- to adjust scores.</li></ul>" },
      { id: "classtally", title: "Class Tally", category: "tool", path: "./class-tally/index.html", icon: "star", color: "text-orange", description: "Behavior Tracker", guide: "<ul class='list-disc pl-4 space-y-1'><li><strong>Setup:</strong> Add student names in settings.</li><li><strong>Reward:</strong> Click name to add Star/Warning.</li></ul>" },
      { id: "teampicker", title: "Team Picker", category: "tool", path: "./team-picker/index.html", icon: "users", color: "text-green", description: "Random Groups", guide: "<ul class='list-disc pl-4 space-y-1'><li><strong>Input:</strong> Paste list of student names.</li><li><strong>Config:</strong> Choose number of teams.</li><li><strong>Go:</strong> Click 'Pick Teams' to randomize.</li></ul>" },
      { id: "taskassigner", title: "Task Assigner", category: "tool", path: "./task-assigner/index.html", icon: "clipboard-list", color: "text-orange", description: "Assign Roles", guide: "<ul class='list-disc pl-4 space-y-1'><li><strong>Lists:</strong> Enter Names and Tasks.</li><li><strong>Assign:</strong> Randomly pairs students with tasks.</li></ul>" },
      { id: "lessonnotes", title: "Notes", category: "tool", path: "./lesson-note/index.html", icon: "notebook-pen", color: "text-orange", description: "Lesson Plans", guide: "<ul class='list-disc pl-4 space-y-1'><li><strong>Type:</strong> Write lesson notes.</li><li><strong>Save:</strong> Auto-saves locally.</li></ul>" },
      { id: "wordlist", title: "Word List", category: "tool", path: "./random-word-list/index.html", icon: "list", color: "text-pink", description: "Random Picker", guide: "<ul class='list-disc pl-4 space-y-1'><strong>Setup:</strong> Input words/names.</li><li><strong>Randomize:</strong> Click generate.</li></ul>" },
      { id: "presentations", title: "Slides", category: "tool", path: "./presentation-maker/index.html", icon: "monitor-play", color: "text-pink", description: "Quick Slides", guide: "<ul class='list-disc pl-4 space-y-1'><li><strong>Input:</strong> Write text.</li><li><strong>Seperation:</strong> Use ':' for new slide.</li></ul>" },
      { id: "scrambler", title: "Scrambler", category: "tool", path: "./word-scrambler/index.html", icon: "shuffle", color: "text-orange", description: "Word Mixer", guide: "<ul class='list-disc pl-4 space-y-1'><li><strong>Enter:</strong> Type a word.</li><li><strong>Show:</strong> Displays scrambled letters.</li></ul>" },
      { id: "spinwheel", title: "Spin Wheel", category: "tool", path: "./spin-the-wheel/index.html", icon: "pie-chart", color: "text-pink", description: "Randomizer", guide: "<ul class='list-disc pl-4 space-y-1'><li><strong>Edit:</strong> Customize segments.</li><li><strong>Spin:</strong> Click center.</li></ul>" },
      { id: "cardmatch", title: "Card Match", category: "game", path: "./card-match/index.html", icon: "layers", color: "text-blue", description: "Memory Game", guide: "<ul class='list-disc pl-4 space-y-1'><li><strong>Setup:</strong> Create pairs.</li><li><strong>Play:</strong> Flip cards to match.</li></ul>" },
      { id: "findball", title: "Magic Cups", category: "game", path: "./find-the-ball/index.html", icon: "help-circle", color: "text-orange", description: "Find the hidden ball.", guide: "<ul class='list-disc pl-4 space-y-1'><li><strong>Shuffle:</strong> Watch cups.</li><li><strong>Pick:</strong> Guess the location.</li></ul>" },
      { id: "guessemoji", title: "Guess the Emoji", category: "game", path: "./emoji-game/index.html", icon: "smile", color: "text-green", description: "Emoji Quiz", guide: "<ul class='list-disc pl-4 space-y-1'><li><strong>Read:</strong> Look at emojis.</li><li><strong>Infer:</strong> Guess the phrase.</li></ul>" },
      { id: "freezedance", title: "Freeze Dance", category: "game", path: "./freeze-dance/index.html", icon: "music", color: "text-green", description: "Movement", guide: "<ul class='list-disc pl-4 space-y-1'><li><strong>Start:</strong> Play music.</li><li><strong>Stop:</strong> Music pauses (Freeze).</li></ul>" },
      { id: "crossword", title: "Crossword", category: "game", path: "./crossword/index.html", icon: "pencil", color: "text-slate-500", description: "Puzzle Maker", guide: "<ul class='list-disc pl-4 space-y-1'><li><strong>Data:</strong> Enter words/clues.</li><li><strong>Grid:</strong> Auto-generates puzzle.</li></ul>" },
      { id: "wordsearch", title: "Word Search", category: "game", path: "./word-search/index.html", icon: "grid", color: "text-pink", description: "Find Words", guide: "<ul class='list-disc pl-4 space-y-1'><li><strong>Words:</strong> Enter vocabulary.</li><li><strong>Find:</strong> Highlight in grid.</li></ul>" },
      { id: "worddisplay", title: "Word Display", category: "game", path: "./random-word-display/index.html", icon: "tv", color: "text-green", description: "Flash Words", guide: "<ul class='list-disc pl-4 space-y-1'><li><strong>List:</strong> Paste list.</li><li><strong>Show:</strong> Displays one by one.</li></ul>" },
      { id: "hotseat", title: "Hot Seat", category: "game", path: "./hot-seat/index.html", icon: "flame", color: "text-orange", description: "Guessing", guide: "<ul class='list-disc pl-4 space-y-1'><li><strong>Sit:</strong> Face away from board.</li><li><strong>Clue:</strong> Class describes word.</li></ul>" },
      { id: "storydice", title: "Story Dice", category: "game", path: "./story-dice/index.html", icon: "dices", color: "text-pink", description: "Story Prompts", guide: "<ul class='list-disc pl-4 space-y-1'><li><strong>Roll:</strong> Generate icons.</li><li><strong>Tell:</strong> Make a story.</li></ul>" },
      { id: "hangman", title: "Hangman", category: "game", path: "./hangman/index.html", icon: "skull", color: "text-red-500", description: "Vocab Game", guide: "<ul class='list-disc pl-4 space-y-1'><li><strong>Secret:</strong> Type word.</li><li><strong>Play:</strong> Guess letters.</li></ul>" },
      { id: "reveal-picture-game", title: "Reveal Pic", category: "game", path: "./reveal-picture-game/index.html", icon: "image", color: "text-green", description: "Image Guess", guide: "<ul class='list-disc pl-4 space-y-1'><li><strong>Load:</strong> Upload image.</li><li><strong>Click:</strong> Remove tiles.</li></ul>" },
      { id: "secret-code", title: "Secret Code", category: "game", path: "./secret-code/index.html", icon: "lock-keyhole", color: "text-orange", description: "Decryption", guide: "<ul class='list-disc pl-4 space-y-1'><li><strong>Type:</strong> Enter message.</li><li><strong>Key:</strong> Show cipher.</li></ul>" },
      { id: "unscramble", title: "Unscramble", category: "game", path: "./unscramble/index.html", icon: "type", color: "text-blue", description: "Spelling Fix", guide: "<ul class='list-disc pl-4 space-y-1'><li><strong>List:</strong> Add words.</li><li><strong>Mix:</strong> Shows scrambled word.</li></ul>" },
      { id: "sentence-unscrambler", title: "Sentence Fix", category: "game", path: "./sentence-unscrambler/index.html", icon: "align-left", color: "text-pink", description: "Grammar Order", guide: "<ul class='list-disc pl-4 space-y-1'><li><strong>Input:</strong> Enter sentence.</li><li><strong>Sort:</strong> Drag words to fix.</li></ul>" },
      { id: "story-ordering", title: "Story Order", category: "game", path: "./story-ordering/index.html", icon: "book-open", color: "text-green", description: "Logic Sort", guide: "<ul class='list-disc pl-4 space-y-1'><li><strong>Text:</strong> Input paragraphs.</li><li><strong>Sort:</strong> Drag blocks.</li></ul>" },
      { id: "word-flashcard", title: "Flashcards", category: "game", path: "./word-flashcard/index.html", icon: "copy", color: "text-blue", description: "Review", guide: "<ul class='list-disc pl-4 space-y-1'><li><strong>Flip:</strong> Click card.</li><li><strong>Mix:</strong> Shuffle deck.</li></ul>" },
      { id: "random-card-shuffle", title: "Shuffle", category: "game", path: "./random-card-shuffle/index.html", icon: "box", color: "text-slate-500", description: "Utility", guide: "<ul class='list-disc pl-4 space-y-1'><li><strong>List:</strong> Enter items.</li><li><strong>Mix:</strong> Randomize order.</li></ul>" },
      { id: "connects", title: "Connects", category: "game", path: "./tic-tac-toe/index.html", icon: "grid-3x3", color: "text-blue", description: "Strategy Game", guide: "<ul class='list-disc pl-4 space-y-1'><li><strong>Setup:</strong> Select grid size.</li><li><strong>Goal:</strong> Connect marks horizontally/vertically.</li></ul>" }
    ];

    // --- UTILITY FUNCTION FOR SORTING ---
    const sortGamesAlphabetically = (a, b) => {
      return a.title.localeCompare(b.title);
    };
    // -------------------------------------


    // --- SOUND ENGINE (Web Audio API) ---
    const AudioEngine = {
      ctx: null,
      muted: false,
      init: () => {
        window.AudioContext = window.AudioContext || window.webkitAudioContext;
        AudioEngine.ctx = new AudioContext();
      },
      playTone: (freq, type, duration) => {
        if (AudioEngine.muted || !AudioEngine.ctx) return;
        const osc = AudioEngine.ctx.createOscillator();
        const gain = AudioEngine.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, AudioEngine.ctx.currentTime);
        gain.gain.setValueAtTime(0.1, AudioEngine.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, AudioEngine.ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(AudioEngine.ctx.destination);
        osc.start();
        osc.stop(AudioEngine.ctx.currentTime + duration);
      },
      hover: () => AudioEngine.playTone(400, 'sine', 0.1),
      click: () => AudioEngine.playTone(600, 'square', 0.15),
      toggle: () => {
        AudioEngine.muted = !AudioEngine.muted;
        const icon = document.querySelector('#sound-btn i');
        if (AudioEngine.muted) {
          icon.setAttribute('data-lucide', 'volume-x');
          icon.classList.replace('text-green', 'text-red-500');
          icon.classList.replace('dark:text-green-400', 'dark:text-red-400');
        } else {
          icon.setAttribute('data-lucide', 'volume-2');
          icon.classList.replace('text-red-500', 'text-green');
          icon.classList.replace('dark:text-red-400', 'dark:text-green-400');
          AudioEngine.init(); // Ensure context is ready
        }
        lucide.createIcons();
      }
    };

    // --- GLOBAL TIMER LOGIC ---
    const Timer = {
      interval: null,
      seconds: 0,
      isRunning: false,
      toggle: () => {
        if (Timer.isRunning) {
          clearInterval(Timer.interval);
          document.getElementById('timer-icon').setAttribute('data-lucide', 'play');
        } else {
          Timer.interval = setInterval(Timer.tick, 1000);
          document.getElementById('timer-icon').setAttribute('data-lucide', 'pause');
        }
        Timer.isRunning = !Timer.isRunning;
        lucide.createIcons();
      },
      tick: () => {
        Timer.seconds++;
        Timer.updateDisplay();
      },
      reset: () => {
        clearInterval(Timer.interval);
        Timer.seconds = 0;
        Timer.isRunning = false;
        document.getElementById('timer-icon').setAttribute('data-lucide', 'play');
        Timer.updateDisplay();
        lucide.createIcons();
      },
      updateDisplay: () => {
        const mins = Math.floor(Timer.seconds / 60).toString().padStart(2, '0');
        const secs = (Timer.seconds % 60).toString().padStart(2, '0');
        document.getElementById('global-timer-display').innerText = `${mins}:${secs}`;
      }
    };

    const Guides = {
      tool: "<ul class='list-disc pl-5 space-y-2'><li>Adjust settings using the on-screen controls.</li><li>Use fullscreen mode for better visibility in class.</li><li>Press <strong>Esc</strong> to close the activity quickly.</li></ul>",
      game: "<ul class='list-disc pl-5 space-y-2'><li>Follow the on-screen prompts to start.</li><li>Click the 'Setup' button (if available) to customize words.</li><li>Make sure sound is enabled for effects.</li></ul>"
    };

    // --- APP LOGIC ---
    const App = {
      activeGame: null, // Track currently active game for info modal

      init: () => {
        App.loadTheme(); // Load theme preference
        App.updateGreeting();

        // --- SORT GAMES ARRAY BEFORE RENDERING ---
        const sortedGames = [...GAMES].sort(sortGamesAlphabetically);
        App.renderGames(sortedGames);

        App.renderRecent();
        App.setupSearch();
        App.initLivingBg();

        // Initialize Audio Context on first interaction
        document.body.addEventListener('click', () => {
          if (!AudioEngine.ctx) AudioEngine.init();
        }, { once: true });

        document.addEventListener("keydown", (e) => {
          if (e.key === "/" && document.activeElement.tagName !== "INPUT") {
            e.preventDefault();
            document.getElementById("search-input").focus();
          }
          if (e.key === "Escape") {
            if (!document.getElementById("info-overlay").classList.contains("hidden")) {
              App.toggleInfo();
            } else if (document.getElementById("game-modal").classList.contains('flex')) {
              App.closeGame();
            }
          }
        });

        // Init 3D Tilt Effect
        document.querySelectorAll('.hub-card').forEach(card => {
          card.addEventListener('mousemove', (e) => App.tiltCard(e, card));
          card.addEventListener('mouseleave', () => {
            card.style.transform = `perspective(1000px) rotateX(0) rotateY(0)`;
          });
          card.addEventListener('mouseenter', AudioEngine.hover);
        });

        const hash = window.location.hash.substring(1);
        if (hash) App.openGame(hash);

        lucide.createIcons();
      },

      // --- PERSISTENCE & THEME FUNCTIONS ---
      loadTheme: () => {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'dark') {
          document.documentElement.classList.add('dark');
        } else if (savedTheme === 'light') {
          document.documentElement.classList.remove('dark');
        } else {
          // Fallback to system preference if no saved theme
          if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
            document.documentElement.classList.add('dark');
          }
        }
      },

      toggleTheme: () => {
        const isDark = document.documentElement.classList.toggle('dark');
        if (isDark) {
          localStorage.setItem('theme', 'dark');
        } else {
          localStorage.setItem('theme', 'light');
        }
        AudioEngine.click();
      },
      // -------------------------------------

      // --- 3D TILT EFFECT (Unchanged) ---
      tiltCard: (e, card) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        // Limit rotation to 10 deg
        const rotateX = ((y - centerY) / centerY) * -5;
        const rotateY = ((x - centerX) / centerX) * 5;

        card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.02)`;
      },

      // --- LIVING BACKGROUND (Unchanged) ---
      initLivingBg: () => {
        const container = document.querySelector('.living-bg');
        const shapes = ['circle', 'triangle', 'cross'];
        const colors = ['#FF6B95', '#FF8C42', '#00E676', '#2979FF'];

        for (let i = 0; i < 15; i++) {
          const el = document.createElement('div');
          el.className = 'shape';
          const size = Math.random() * 40 + 20;
          el.style.width = `${size}px`;
          el.style.height = `${size}px`;
          el.style.left = `${Math.random() * 100}vw`;
          el.style.top = `${Math.random() * 100}vh`;
          el.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
          el.style.borderRadius = Math.random() > 0.5 ? '50%' : '0';
          el.style.animationDuration = `${Math.random() * 20 + 20}s`;
          el.style.animationDelay = `-${Math.random() * 20}s`;
          container.appendChild(el);
        }
      },

      updateGreeting: () => {
        const hour = new Date().getHours();
        const greeting = hour < 12 ? "Good Morning" : hour < 18 ? "Good Afternoon" : "Good Evening";
        document.getElementById("greeting-display").innerText = `${greeting}!`;

        const options = { weekday: "long", month: "short", day: "numeric" };
        document.getElementById("date-display").innerText = new Date().toLocaleDateString("en-US", options);
      },

      // --- RECENT GAMES (Fixed Icon Rendering) ---
      getRecentIds: () => {
        try { return JSON.parse(localStorage.getItem("recentGameIds")) || []; } catch { return []; }
      },

      renderRecent: () => {
        const recentIds = App.getRecentIds();
        const container = document.getElementById("recent-list");
        const section = document.getElementById("recent-section");

        if (recentIds.length === 0) {
          section.classList.add('hidden');
          return;
        }

        section.classList.remove('hidden');
        container.innerHTML = recentIds.map(id => {
          const game = GAMES.find(g => g.id === id);
          if (!game) return '';

          const colorName = game.color.replace('text-', '');
          let bgClass = '';
          if (colorName === 'pink') bgClass = 'bg-pink';
          else if (colorName === 'orange') bgClass = 'bg-orange';
          else if (colorName === 'green') bgClass = 'bg-green';
          else if (colorName === 'blue') bgClass = 'bg-blue';
          else bgClass = 'bg-dark dark:bg-slate-700';

          return `
                        <button onclick="App.openGame('${game.id}')" onmouseenter="AudioEngine.hover()"
                            class="recent-pill bg-white flex items-center gap-3 px-3 py-2 rounded-xl shrink-0 min-w-[150px] group hover:bg-slate-50 border-2 border-dark shadow-hard-sm">
                            <div class="w-10 h-10 rounded-lg ${bgClass} flex items-center justify-center text-white border-2 border-dark dark:border-slate-300 shadow-sm">
                                <i data-lucide="${game.icon}" class="w-5 h-5"></i>
                            </div>
                            <div class="text-left">
                                <div class="text-xs font-bold text-dark dark:text-white truncate w-24">${game.title}</div>
                                <div class="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase">RESUME</div>
                            </div>
                        </button>
                    `;
        }).join('');
        lucide.createIcons(); // FIX: Call lucide.createIcons()
      },

      clearRecent: () => {
        localStorage.removeItem("recentGameIds");
        App.renderRecent();
        AudioEngine.click();
      },

      addToRecent: (id) => {
        let recentIds = App.getRecentIds().filter(recentId => recentId !== id);
        recentIds.unshift(id);
        localStorage.setItem("recentGameIds", JSON.stringify(recentIds.slice(0, 5)));
        App.renderRecent();
      },

      // --- MAIN GRID (Unchanged) ---
      renderGames: (gamesList) => {
        const grid = document.getElementById('games-grid');
        document.getElementById('count-badge').innerText = gamesList.length;

        grid.innerHTML = gamesList.map(game => {
          const colorName = game.color.replace('text-', '');
          const bgClass = colorName.includes('-') ? `bg-${colorName.replace('-500', '')}/10` : `bg-${colorName}/10`;

          return `
                    <article class="hub-card group cursor-pointer dark:bg-slate-800 dark:border-slate-500" onclick="App.openGame('${game.id}')">
                        <div class="${bgClass} p-6 border-b-4 border-dark dark:border-slate-500 h-40 flex items-center justify-center relative overflow-hidden group-hover:${bgClass.replace('/10', '/20')} transition-colors">
                            <div class="absolute inset-0 opacity-10" style="background-image: radial-gradient(#000 2px, transparent 2px); background-size: 12px 12px;"></div>
                            <i data-lucide="${game.icon}" class="absolute -right-6 -bottom-6 w-36 h-36 ${game.color} opacity-20 rotate-12 group-hover:scale-110 group-hover:rotate-6 transition-all duration-300"></i>
                            <div class="bg-white dark:bg-slate-700 p-4 rounded-2xl border-2 border-dark dark:border-slate-400 shadow-hard dark:shadow-neon-sm relative z-10 group-hover:scale-110 transition-transform duration-300">
                                <i data-lucide="${game.icon}" class="w-10 h-10 ${game.color} dark:text-white"></i>
                            </div>
                        </div>

                        <div class="p-6 flex-1 flex flex-col bg-white dark:bg-slate-800">
                            <div class="flex justify-between items-start mb-3">
                                <h2 class="text-2xl font-heading text-dark dark:text-white leading-none tracking-tight">${game.title}</h2>
                                <span class="sticker ${game.color.replace('text-', 'bg-')} text-white text-[10px] font-bold px-2 py-1 rounded-md transform ${Math.random() > 0.5 ? 'rotate-2' : '-rotate-2'}">
                                    ${game.category.toUpperCase()}
                                </span>
                            </div>
                            <p class="text-slate-500 dark:text-slate-400 font-bold text-sm mb-6 flex-1 leading-relaxed">
                                ${game.description}
                            </p>
                            <button class="btn-chunky ${game.color.replace('text-', 'bg-')} text-white w-full py-3 rounded-xl flex items-center justify-center gap-2 text-lg group-hover:brightness-105">
                                <i data-lucide="play" class="w-5 h-5 fill-current"></i> LAUNCH
                            </button>
                        </div>
                    </article>
                `}).join('');

        lucide.createIcons();
      },

      setupSearch: () => {
        const searchInput = document.getElementById('search-input');
        searchInput.addEventListener('input', (e) => {
          const term = e.target.value.toLowerCase();
          const filtered = GAMES.filter(g =>
            g.title.toLowerCase().includes(term) ||
            g.description.toLowerCase().includes(term) ||
            g.category.toLowerCase().includes(term)
          ).sort(sortGamesAlphabetically); // Sort filtered results

          App.renderGames(filtered);
          // Re-init tilt for new elements
          document.querySelectorAll('.hub-card').forEach(card => {
            card.addEventListener('mousemove', (e) => App.tiltCard(e, card));
            card.addEventListener('mouseleave', () => card.style.transform = `perspective(1000px) rotateX(0) rotateY(0)`);
            card.addEventListener('mouseenter', AudioEngine.hover);
          });
        });
      },

      openGame: (gameId) => {
        AudioEngine.click();
        const game = GAMES.find(g => g.id === gameId);
        if (!game) return;

        App.activeGame = game;
        App.addToRecent(gameId);

        const modal = document.getElementById('game-modal');
        const iframe = document.getElementById('game-frame');
        const spinner = document.getElementById('loading-spinner');

        iframe.src = game.path;

        modal.classList.remove('hidden');
        modal.classList.add('flex');

        spinner.classList.remove('hidden');
        iframe.onload = () => spinner.classList.add('hidden');

        window.location.hash = gameId;
      },

      toggleInfo: () => {
        AudioEngine.click();
        const overlay = document.getElementById('info-overlay');

        if (overlay.classList.contains('hidden')) {
          if (!App.activeGame) return;

          const game = App.activeGame;
          const colorName = game.color.replace('text-', '');
          const bgClass = colorName.includes('-') ? colorName : `bg-${colorName}-500`;

          document.getElementById('info-title-display').innerText = game.title.toUpperCase();
          document.getElementById('info-category').innerText = game.category;
          document.getElementById('info-icon').className = `w-24 h-24 rounded-2xl border-4 border-dark flex items-center justify-center text-white shadow-hard shrink-0 ${bgClass}`;
          document.getElementById('info-icon').innerHTML = `<i data-lucide="${game.icon}" class="w-10 h-10"></i>`;

          const guideText = game.guide || (game.category === 'tool' ? Guides.tool : Guides.game);
          document.getElementById('info-content').innerHTML = guideText;

          overlay.classList.remove('hidden');
          overlay.classList.add('flex');
          lucide.createIcons();
        } else {
          overlay.classList.add('hidden');
          overlay.classList.remove('flex');
        }
      },

      closeGame: () => {
        AudioEngine.click();
        const modal = document.getElementById('game-modal');
        const iframe = document.getElementById('game-frame');

        modal.classList.add('hidden');
        modal.classList.remove('flex');
        iframe.src = "";

        document.getElementById('info-overlay').classList.add('hidden');
        App.activeGame = null;

        history.pushState("", document.title, window.location.pathname + window.location.search);
      },

      openFeedback: () => window.open(Config.helpUrl, '_blank')
    };

    // Filter Logic
    window.filterGames = (category) => {
      AudioEngine.click();
      document.querySelectorAll('.filter-btn').forEach(btn => {
        if (btn.dataset.category === category) {
          btn.classList.add('active', 'bg-dark', 'text-white');
          btn.classList.remove('bg-white', 'text-dark');
        } else {
          btn.classList.remove('active', 'bg-dark', 'text-white');
          btn.classList.add('bg-white', 'text-dark');
        }
      });

      let gamesToRender;
      if (category === 'all') {
        gamesToRender = [...GAMES];
      } else {
        gamesToRender = GAMES.filter(g => g.category === category);
      }

      // --- SORT FILTERED RESULTS ---
      gamesToRender.sort(sortGamesAlphabetically);
      App.renderGames(gamesToRender);

      // Re-init tilt
      document.querySelectorAll('.hub-card').forEach(card => {
        card.addEventListener('mousemove', (e) => App.tiltCard(e, card));
        card.addEventListener('mouseleave', () => card.style.transform = `perspective(1000px) rotateX(0) rotateY(0)`);
        card.addEventListener('mouseenter', AudioEngine.hover);
      });
    };

    window.onload = App.init;
