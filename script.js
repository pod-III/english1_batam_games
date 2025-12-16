// ============================================
// REFACTORED script.js - English 1 Batam Hub
// Enhanced with advanced features
// ============================================

// --- CONSTANTS & CONFIG ---
const CONFIG = {
  helpUrl: "https://forms.gle/VRqg4f3KFHoJXFUu9",
  dataSource: "games.json",
  maxRecentGames: 5,
  storageKeys: {
    theme: "theme",
    recent: "recentGameIds",
    sound: "soundMuted",
    favorites: "favoriteGames"
  }
};

// --- STATE MANAGEMENT ---
const State = {
  games: [],
  activeGame: null,
  filters: {
    category: 'all',
    searchTerm: '',
    difficulty: 'all',
    tags: []
  },
  
  setGames(gamesData) {
    // Handle both old and new JSON format
    const gamesList = gamesData.games || gamesData;
    this.games = gamesList.sort((a, b) => a.title.localeCompare(b.title));
    
    // Store metadata if available
    if (gamesData.metadata) {
      this.metadata = gamesData.metadata;
    }
  },
  
  getFilteredGames() {
    return this.games.filter(game => {
      // Category filter
      const matchesCategory = this.filters.category === 'all' || 
                              game.category === this.filters.category;
      
      // Search filter
      const searchLower = this.filters.searchTerm.toLowerCase();
      const matchesSearch = !this.filters.searchTerm || 
                           game.title.toLowerCase().includes(searchLower) ||
                           game.description.toLowerCase().includes(searchLower) ||
                           game.category.toLowerCase().includes(searchLower) ||
                           (game.tags && game.tags.some(tag => tag.toLowerCase().includes(searchLower)));
      
      // Difficulty filter
      const matchesDifficulty = this.filters.difficulty === 'all' ||
                                !game.difficulty ||
                                game.difficulty === this.filters.difficulty;
      
      // Tags filter (if any tags selected)
      const matchesTags = this.filters.tags.length === 0 ||
                         (game.tags && this.filters.tags.some(tag => game.tags.includes(tag)));
      
      // Active filter (hide inactive games)
      const isActive = game.active !== false;
      
      return matchesCategory && matchesSearch && matchesDifficulty && matchesTags && isActive;
    });
  },
  
  getGameById(id) {
    return this.games.find(g => g.id === id);
  },
  
  getFeaturedGames() {
    return this.games.filter(g => g.featured === true);
  }
};

// --- STORAGE UTILITIES ---
const Storage = {
  get(key, fallback = null) {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : fallback;
    } catch (error) {
      console.warn(`Storage read error for key "${key}":`, error);
      return fallback;
    }
  },
  
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error(`Storage write error for key "${key}":`, error);
      return false;
    }
  },
  
  remove(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error(`Storage remove error for key "${key}":`, error);
      return false;
    }
  }
};

// --- AUDIO ENGINE ---
const AudioEngine = {
  ctx: null,
  muted: false,
  
  init() {
    if (this.ctx) return;
    
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContext();
      
      this.muted = Storage.get(CONFIG.storageKeys.sound, false);
      this.updateUI();
    } catch (error) {
      console.warn('Web Audio API not supported:', error);
    }
  },
  
  playTone(freq, type, duration) {
    if (this.muted || !this.ctx) return;
    
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      
      gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (error) {
      console.warn('Audio playback error:', error);
    }
  },
  
  hover() {
    this.playTone(400, 'sine', 0.1);
  },
  
  click() {
    this.playTone(600, 'square', 0.15);
  },
  
  toggle() {
    this.muted = !this.muted;
    Storage.set(CONFIG.storageKeys.sound, this.muted);
    this.updateUI();
    
    if (!this.muted && !this.ctx) {
      this.init();
    }
  },
  
  updateUI() {
    const btn = document.getElementById('sound-btn');
    if (!btn) return;
    
    const icon = btn.querySelector('i');
    if (!icon) return;
    
    if (this.muted) {
      icon.setAttribute('data-lucide', 'volume-x');
      icon.className = 'w-5 h-5 text-red-500 dark:text-red-400';
    } else {
      icon.setAttribute('data-lucide', 'volume-2');
      icon.className = 'w-5 h-5 text-green dark:text-green-400';
    }
    
    lucide.createIcons();
  }
};

// --- THEME MANAGER ---
const Theme = {
  load() {
    const saved = Storage.get(CONFIG.storageKeys.theme);
    
    if (saved === 'dark') {
      document.documentElement.classList.add('dark');
    } else if (saved === 'light') {
      document.documentElement.classList.remove('dark');
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) {
        document.documentElement.classList.add('dark');
      }
    }
  },
  
  toggle() {
    const isDark = document.documentElement.classList.toggle('dark');
    Storage.set(CONFIG.storageKeys.theme, isDark ? 'dark' : 'light');
    AudioEngine.click();
  }
};

// --- UI UTILITIES ---
const UI = {
  updateGreeting() {
    const hour = new Date().getHours();
    const greeting = hour < 12 ? "Good Morning" : 
                     hour < 18 ? "Good Afternoon" : 
                     "Good Evening";
    
    const greetingEl = document.getElementById("greeting-display");
    if (greetingEl) greetingEl.textContent = `${greeting}!`;
    
    const dateEl = document.getElementById("date-display");
    if (dateEl) {
      const options = { weekday: "long", month: "short", day: "numeric" };
      dateEl.textContent = new Date().toLocaleDateString("en-US", options);
    }
  },
  
  updateCount(count) {
    const badge = document.getElementById('count-badge');
    if (badge) badge.textContent = count;
  },
  
  showError(message) {
    const grid = document.getElementById('games-grid');
    if (grid) {
      grid.innerHTML = `
        <div class="col-span-full text-center p-10">
          <div class="inline-block bg-red-100 dark:bg-red-900 border-4 border-red-500 rounded-2xl p-8">
            <i data-lucide="alert-circle" class="w-16 h-16 text-red-500 mx-auto mb-4"></i>
            <p class="text-xl font-bold text-red-700 dark:text-red-300">${message}</p>
          </div>
        </div>
      `;
      lucide.createIcons();
    }
  },
  
  showLoading() {
    const grid = document.getElementById('games-grid');
    if (grid) {
      grid.innerHTML = `
        <div class="col-span-full text-center p-10">
          <div class="w-16 h-16 border-4 border-slate-300 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p class="text-lg font-bold text-slate-400">Loading activities...</p>
        </div>
      `;
    }
  },
  
  // initLivingBackground() {
  //   const container = document.querySelector('.living-bg');
  //   if (!container) return;
    
  //   const colors = ['#FF6B95', '#FF8C42', '#00E676', '#2979FF'];
    
  //   for (let i = 0; i < 15; i++) {
  //     const shape = document.createElement('div');
  //     shape.className = 'shape';
      
  //     const size = Math.random() * 40 + 20;
  //     shape.style.cssText = `
  //       width: ${size}px;
  //       height: ${size}px;
  //       left: ${Math.random() * 100}vw;
  //       top: ${Math.random() * 100}vh;
  //       background-color: ${colors[Math.floor(Math.random() * colors.length)]};
  //       border-radius: ${Math.random() > 0.5 ? '50%' : '0'};
  //       animation-duration: ${Math.random() * 20 + 20}s;
  //       animation-delay: -${Math.random() * 20}s;
  //     `;
      
  //     container.appendChild(shape);
  //   }
  // }
};

// --- RECENT GAMES MANAGER ---
const RecentGames = {
  get() {
    return Storage.get(CONFIG.storageKeys.recent, []);
  },
  
  add(gameId) {
    let recent = this.get().filter(id => id !== gameId);
    recent.unshift(gameId);
    recent = recent.slice(0, CONFIG.maxRecentGames);
    Storage.set(CONFIG.storageKeys.recent, recent);
    this.render();
  },
  
  clear() {
    Storage.remove(CONFIG.storageKeys.recent);
    this.render();
    AudioEngine.click();
  },
  
  render() {
    const recentIds = this.get();
    const container = document.getElementById("recent-list");
    const section = document.getElementById("recent-section");
    
    if (!container || !section) return;
    
    if (recentIds.length === 0) {
      section.classList.add('hidden');
      return;
    }
    
    section.classList.remove('hidden');
    
    const html = recentIds.map(id => {
      const game = State.getGameById(id);
      if (!game) return '';
      
      const colorName = game.color.replace('text-', '');
      const bgClass = this.getColorClass(colorName);
      
      return `
        <button 
          data-action="openGame" 
          data-param="${game.id}"
          onmouseenter="AudioEngine.hover()"
          class="recent-pill bg-white dark:bg-slate-800 flex items-center gap-3 px-3 py-2 rounded-xl shrink-0 min-w-[150px] group hover:bg-slate-50 dark:hover:bg-slate-700 border-2 border-dark dark:border-slate-500 shadow-hard-sm"
          aria-label="Resume ${game.title}">
          <div class="w-10 h-10 rounded-lg ${bgClass} flex items-center justify-center text-white border-2 border-dark dark:border-slate-300 shadow-sm">
            <i data-lucide="${game.icon}" class="w-5 h-5" aria-hidden="true"></i>
          </div>
          <div class="text-left">
            <div class="text-xs font-bold text-dark dark:text-white truncate w-24">${game.title}</div>
            <div class="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase">RESUME</div>
          </div>
        </button>
      `;
    }).join('');
    
    container.innerHTML = html;
    lucide.createIcons();
  },
  
  getColorClass(colorName) {
    const colorMap = {
      'pink': 'bg-pink',
      'orange': 'bg-orange',
      'green': 'bg-green',
      'blue': 'bg-blue',
      'red-500': 'bg-red-500',
      'slate-500': 'bg-slate-500'
    };
    return colorMap[colorName] || 'bg-dark dark:bg-slate-700';
  }
};

// --- GAME GRID RENDERER ---
const GameGrid = {
  render(games = null) {
    const gamesToRender = games || State.getFilteredGames();
    const grid = document.getElementById('games-grid');
    
    if (!grid) return;
    
    UI.updateCount(gamesToRender.length);
    
    if (gamesToRender.length === 0) {
      grid.innerHTML = `
        <div class="col-span-full text-center p-10">
          <i data-lucide="search-x" class="w-16 h-16 text-slate-300 dark:text-slate-600 mx-auto mb-4"></i>
          <p class="text-lg font-bold text-slate-400 dark:text-slate-500">No activities found</p>
          <p class="text-sm text-slate-400 dark:text-slate-600 mt-2">Try adjusting your filters</p>
        </div>
      `;
      lucide.createIcons();
      return;
    }
    
    const html = gamesToRender.map(game => {
      const colorName = game.color.replace('text-', '');
      const baseColor = colorName.includes('-') ? colorName.split('-')[0] : colorName;
      const bgClass = `bg-${baseColor}/10`;
      
      // Difficulty badge (if available)
      const difficultyBadge = game.difficulty ? 
        `<span class="text-[8px] font-bold px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400 uppercase">${game.difficulty}</span>` 
        : '';
      
      return `
        <article 
          class="hub-card group cursor-pointer dark:bg-slate-800 dark:border-slate-500" 
          data-action="openGame" 
          data-param="${game.id}"
          role="button"
          tabindex="0"
          aria-label="Launch ${game.title}: ${game.description}">
          
          <div class="${bgClass} p-6 border-b-4 border-dark dark:border-slate-500 h-40 flex items-center justify-center relative overflow-hidden group-hover:${bgClass.replace('/10', '/20')} transition-colors">
            <div class="absolute inset-0 opacity-10" style="background-image: radial-gradient(#000 2px, transparent 2px); background-size: 12px 12px;"></div>
            <i data-lucide="${game.icon}" class="absolute -right-6 -bottom-6 w-36 h-36 ${game.color} opacity-20 rotate-12 group-hover:scale-110 group-hover:rotate-6 transition-all duration-300" aria-hidden="true"></i>
            <div class="bg-white dark:bg-slate-700 p-4 rounded-2xl border-2 border-dark dark:border-slate-400 shadow-hard dark:shadow-neon-sm relative z-10 group-hover:scale-110 transition-transform duration-300">
              <i data-lucide="${game.icon}" class="w-10 h-10 ${game.color} dark:text-white" aria-hidden="true"></i>
            </div>
          </div>

          <div class="p-6 flex-1 flex flex-col bg-white dark:bg-slate-800">
            <div class="flex justify-between items-start mb-3">
              <h2 class="text-2xl font-heading text-dark dark:text-white leading-none tracking-tight">${game.title}</h2>
              <div class="flex flex-col gap-1 items-end">
                <span class="sticker ${game.color.replace('text-', 'bg-')} text-white text-[10px] font-bold px-2 py-1 rounded-md transform ${Math.random() > 0.5 ? 'rotate-2' : '-rotate-2'}">
                  ${game.category.toUpperCase()}
                </span>
                ${difficultyBadge}
              </div>
            </div>
            <p class="text-slate-500 dark:text-slate-400 font-bold text-sm mb-6 flex-1 leading-relaxed">
              ${game.description}
            </p>
            <button class="btn-chunky ${game.color.replace('text-', 'bg-')} text-white w-full py-3 rounded-xl flex items-center justify-center gap-2 text-lg group-hover:brightness-105" tabindex="-1">
              <i data-lucide="play" class="w-5 h-5 fill-current" aria-hidden="true"></i> LAUNCH
            </button>
          </div>
        </article>
      `;
    }).join('');
    
    grid.innerHTML = html;
    lucide.createIcons();
    this.initCardEffects();
  },
  
  getGuideText(game) {
    if (!game.guide) {
      // Fallback to default guides
      return game.category === 'tool' ? 
        "<ul class='list-disc pl-5 space-y-2'><li>Adjust settings using the on-screen controls.</li><li>Use fullscreen mode for better visibility.</li></ul>" :
        "<ul class='list-disc pl-5 space-y-2'><li>Follow the on-screen prompts to start.</li><li>Customize words in setup if available.</li></ul>";
    }
    
    // Handle new format (object with steps)
    if (typeof game.guide === 'object' && game.guide.steps) {
      const steps = game.guide.steps.map(step => `<li>${step}</li>`).join('');
      return `<ul class='list-disc pl-5 space-y-2'>${steps}</ul>`;
    }
    
    // Handle old format (HTML string)
    return game.guide;
  },
  
  initCardEffects() {
    document.querySelectorAll('.hub-card').forEach(card => {
      card.addEventListener('mousemove', (e) => this.tiltCard(e, card));
      card.addEventListener('mouseleave', () => {
        card.style.transform = 'perspective(1000px) rotateX(0) rotateY(0)';
      });
      card.addEventListener('mouseenter', () => AudioEngine.hover());
      
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          card.click();
        }
      });
    });
  },
  
  tiltCard(e, card) {
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    const rotateX = ((y - centerY) / centerY) * -5;
    const rotateY = ((x - centerX) / centerX) * 5;
    
    card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.02)`;
  }
};

// --- FILTER MANAGER ---
const Filters = {
  setCategory(category) {
    AudioEngine.click();
    State.filters.category = category;
    this.updateUI();
    GameGrid.render();
  },
  
  setSearch(term) {
    State.filters.searchTerm = term.toLowerCase();
    GameGrid.render();
  },
  
  setDifficulty(difficulty) {
    AudioEngine.click();
    State.filters.difficulty = difficulty;
    GameGrid.render();
  },
  
  updateUI() {
    document.querySelectorAll('.filter-btn').forEach(btn => {
      const isActive = btn.dataset.category === State.filters.category;
      
      if (isActive) {
        btn.classList.add('active', 'bg-dark', 'text-white');
        btn.classList.remove('bg-white', 'text-dark');
        btn.setAttribute('aria-pressed', 'true');
      } else {
        btn.classList.remove('active', 'bg-dark', 'text-white');
        btn.classList.add('bg-white', 'text-dark');
        btn.setAttribute('aria-pressed', 'false');
      }
    });
  }
};

// --- GAME MODAL MANAGER ---
const GameModal = {
  open(gameId) {
    AudioEngine.click();
    
    const game = State.getGameById(gameId);
    if (!game) {
      console.error(`Game not found: ${gameId}`);
      return;
    }
    
    State.activeGame = game;
    RecentGames.add(gameId);
    
    const modal = document.getElementById('game-modal');
    const iframe = document.getElementById('game-frame');
    const spinner = document.getElementById('loading-spinner');
    
    if (!modal || !iframe || !spinner) return;
    
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    modal.setAttribute('aria-hidden', 'false');
    
    iframe.src = game.path;
    spinner.classList.remove('hidden');
    
    iframe.onload = () => {
      spinner.classList.add('hidden');
      iframe.focus();
    };
    
    window.location.hash = gameId;
    this.trapFocus(modal);
  },
  
  close() {
    AudioEngine.click();
    
    const modal = document.getElementById('game-modal');
    const iframe = document.getElementById('game-frame');
    const infoOverlay = document.getElementById('info-overlay');
    
    if (!modal || !iframe) return;
    
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    modal.setAttribute('aria-hidden', 'true');
    
    iframe.src = "";
    
    if (infoOverlay) {
      infoOverlay.classList.add('hidden');
      infoOverlay.classList.remove('flex');
    }
    
    State.activeGame = null;
    
    history.pushState("", document.title, window.location.pathname + window.location.search);
    
    document.querySelector('[data-action="openGame"]')?.focus();
  },
  
  reload() {
    const iframe = document.getElementById('game-frame');
    if (iframe?.contentWindow) {
      iframe.contentWindow.location.reload();
    }
  },
  
  toggleInfo() {
    AudioEngine.click();
    
    const overlay = document.getElementById('info-overlay');
    if (!overlay) return;
    
    const isHidden = overlay.classList.contains('hidden');
    
    if (isHidden) {
      if (!State.activeGame) return;
      
      this.renderInfo(State.activeGame);
      overlay.classList.remove('hidden');
      overlay.classList.add('flex');
      
      overlay.querySelector('button')?.focus();
    } else {
      overlay.classList.add('hidden');
      overlay.classList.remove('flex');
      
      document.getElementById('game-frame')?.focus();
    }
  },
  
  renderInfo(game) {
    const colorName = game.color.replace('text-', '');
    const bgClass = colorName.includes('-') ? colorName : `bg-${colorName}`;
    
    const iconEl = document.getElementById('info-icon');
    const titleEl = document.getElementById('info-title-display');
    const categoryEl = document.getElementById('info-category');
    const contentEl = document.getElementById('info-content');
    
    if (iconEl) {
      iconEl.className = `w-24 h-24 rounded-2xl border-4 border-dark flex items-center justify-center text-white shadow-hard shrink-0 ${bgClass}`;
      iconEl.innerHTML = `<i data-lucide="${game.icon}" class="w-10 h-10" aria-hidden="true"></i>`;
    }
    
    if (titleEl) titleEl.textContent = game.title.toUpperCase();
    if (categoryEl) categoryEl.textContent = game.category.toUpperCase();
    
    const guideText = GameGrid.getGuideText(game);
    if (contentEl) contentEl.innerHTML = guideText;
    
    lucide.createIcons();
  },
  
  trapFocus(modal) {
    const focusableElements = modal.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    
    const handleTabKey = (e) => {
      if (e.key !== 'Tab') return;
      
      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };
    
    modal.addEventListener('keydown', handleTabKey);
  }
};

// --- SEARCH MANAGER ---
const Search = {
  setup() {
    const input = document.getElementById('search-input');
    if (!input) return;
    
    let debounceTimer;
    input.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        Filters.setSearch(e.target.value);
      }, 300); // Debounce for better performance
    });
  }
};

// --- DATA LOADER ---
const DataLoader = {
  async loadGames() {
    try {
      const response = await fetch(CONFIG.dataSource);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Failed to load games data`);
      }
      
      const data = await response.json();
      
      // Validate data structure
      if (!this.validateData(data)) {
        throw new Error('Invalid games data structure');
      }
      
      return data;
      
    } catch (error) {
      console.error('Data loading error:', error);
      throw error;
    }
  },
  
  validateData(data) {
    // Handle both old and new format
    const games = data.games || data;
    
    if (!Array.isArray(games)) {
      console.error('Games data must be an array');
      return false;
    }
    
    // Validate each game has required fields
    const requiredFields = ['id', 'title', 'category', 'path', 'icon', 'color'];
    
    for (const game of games) {
      for (const field of requiredFields) {
        if (!game[field]) {
          console.error(`Game "${game.title || 'unknown'}" missing required field: ${field}`);
          return false;
        }
      }
    }
    
    return true;
  }
};

// --- MAIN APP CONTROLLER ---
const App = {
  async init() {
    try {
      Theme.load();
      UI.updateGreeting();
      UI.initLivingBackground();
      UI.showLoading();
      
      const data = await DataLoader.loadGames();
      State.setGames(data);
      
      GameGrid.render();
      RecentGames.render();
      Search.setup();
      
      document.body.addEventListener('click', () => {
        AudioEngine.init();
      }, { once: true });
      
      this.setupKeyboardShortcuts();
      this.setupEventDelegation();
      
      const hash = window.location.hash.substring(1);
      if (hash) {
        GameModal.open(hash);
      }
      
      lucide.createIcons();
      
    } catch (error) {
      console.error('Initialization error:', error);
      UI.showError('Failed to load activities. Please refresh the page.');
    }
  },
  
  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      if (e.key === '/' && document.activeElement.tagName !== 'INPUT') {
        e.preventDefault();
        document.getElementById('search-input')?.focus();
      }
      
      if (e.key === 'Escape') {
        const infoOverlay = document.getElementById('info-overlay');
        const gameModal = document.getElementById('game-modal');
        
        if (infoOverlay && !infoOverlay.classList.contains('hidden')) {
          GameModal.toggleInfo();
        } else if (gameModal && gameModal.classList.contains('flex')) {
          GameModal.close();
        }
      }
    });
  },
  
  setupEventDelegation() {
    document.addEventListener('click', (e) => {
      const target = e.target.closest('[data-action]');
      if (!target) return;
      
      const action = target.dataset.action;
      const param = target.dataset.param;
      
      switch (action) {
        case 'toggleTheme':
          Theme.toggle();
          break;
        case 'toggleSound':
          AudioEngine.toggle();
          break;
        case 'openGame':
          GameModal.open(param);
          break;
        case 'closeGame':
          GameModal.close();
          break;
        case 'reloadGame':
          GameModal.reload();
          break;
        case 'toggleInfo':
          GameModal.toggleInfo();
          break;
        case 'filterGames':
          Filters.setCategory(param);
          break;
        case 'clearRecent':
          RecentGames.clear();
          break;
        case 'openFeedback':
          window.open(CONFIG.helpUrl, '_blank');
          break;
      }
    });
  }
};

// --- GLOBAL EXPORTS (for HTML compatibility during transition) ---
window.App = App;
window.AudioEngine = AudioEngine;
// --- GLOBAL EXPORTS (for HTML compatibility during transition) ---
window.App = App;
window.AudioEngine = AudioEngine;
window.filterGames = (category) => Filters.setCategory(category);

// --- INITIALIZE ---
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => App.init());
} else {
  App.init();
}
