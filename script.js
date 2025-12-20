// ============================================
// REFACTORED script.js - English 1 Batam Hub
// Optimized for performance, reduced redundancy
// ============================================

// --- CONSTANTS & CONFIG ---
const CONFIG = {
  helpUrl: "https://forms.gle/VRqg4f3KFHoJXFUu9",
  dataSource: "games.json",
  maxRecentGames: 5,
  maxTabs: 8,
  debounceDelay: 300,
  loadTimeout: 5000,
  storageKeys: {
    theme: "theme",
    recent: "recentGameIds",
    sound: "soundMuted",
    favorites: "favoriteGames",
    tabs: "openTabs"
  }
};

// --- UTILITIES ---
const Utils = {
  debounce(fn, delay) {
    let timer;
    return function(...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  },

  getColorClass(colorName, prefix = 'bg') {
    const baseColor = colorName.replace('text-', '').split('-')[0];
    const colorMap = {
      pink: `${prefix}-pink`,
      orange: `${prefix}-orange`,
      green: `${prefix}-green`,
      blue: `${prefix}-blue`,
      red: `${prefix}-red-500`,
      slate: `${prefix}-slate-500`
    };
    return colorMap[baseColor] || `${prefix}-dark dark:${prefix}-slate-700`;
  },

  refreshIcons() {
    window.lucide?.createIcons?.();
  }
};

// --- STATE MANAGEMENT ---
const State = {
  games: [],
  activeGame: null,
  metadata: null,
  filters: { category: 'all', searchTerm: '', difficulty: 'all', tags: [] },

  setGames(data) {
    const gamesList = data.games || data;
    this.games = gamesList.sort((a, b) => a.title.localeCompare(b.title));
    if (data.metadata) this.metadata = data.metadata;
  },

  getFilteredGames() {
    return this.games.filter(game => {
      if (game.active === false) return false;

      const { category, searchTerm, difficulty, tags } = this.filters;
      const matchesCategory = category === 'all' || game.category === category;
      const matchesDifficulty = difficulty === 'all' || !game.difficulty || game.difficulty === difficulty;
      
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = !searchTerm || 
        [game.title, game.description, game.category].some(field => 
          field.toLowerCase().includes(searchLower)
        ) || game.tags?.some(tag => tag.toLowerCase().includes(searchLower));
      
      const matchesTags = tags.length === 0 || game.tags?.some(tag => tags.includes(tag));

      return matchesCategory && matchesSearch && matchesDifficulty && matchesTags;
    });
  },

  getGameById(id) {
    return this.games.find(g => g.id === id);
  }
};

// --- STORAGE ---
const Storage = {
  get(key, fallback = null) {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : fallback;
    } catch (error) {
      console.warn(`Storage read error for "${key}":`, error);
      return fallback;
    }
  },

  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error(`Storage write error for "${key}":`, error);
      return false;
    }
  },

  remove(key) {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error(`Storage remove error for "${key}":`, error);
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
      osc.connect(gain).connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (error) {
      console.warn('Audio error:', error);
    }
  },

  hover() { this.playTone(400, 'sine', 0.1); },
  click() { this.playTone(600, 'square', 0.15); },

  toggle() {
    if (!this.ctx) this.init();
    if (this.ctx.state === 'suspended') this.ctx.resume();
    this.muted = !this.muted;
    Storage.set(CONFIG.storageKeys.sound, this.muted);
    this.updateUI();
  },

  updateUI() {
    const icon = document.getElementById('sound-btn-icon');
    if (!icon) return;
    const config = this.muted 
      ? { icon: 'volume-x', color: 'rgb(248 113 113)' }
      : { icon: 'volume-2', color: 'rgb(74 222 128)' };
    icon.setAttribute('data-lucide', config.icon);
    icon.style.color = config.color;
    Utils.refreshIcons();
  }
};

// --- THEME ---
const Theme = {
  load() {
    const saved = Storage.get(CONFIG.storageKeys.theme);
    const isDark = saved === 'dark' || (saved !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', isDark);
  },

  toggle() {
    const isDark = document.documentElement.classList.toggle('dark');
    Storage.set(CONFIG.storageKeys.theme, isDark ? 'dark' : 'light');
    AudioEngine.click();
  }
};

// --- UI ---
const UI = {
  updateGreeting() {
    const hour = new Date().getHours();
    const greeting = hour < 12 ? "Good Morning" : hour < 18 ? "Good Afternoon" : "Good Evening";
    const greetingEl = document.getElementById("greeting-display");
    if (greetingEl) greetingEl.textContent = `${greeting}!`;

    const dateEl = document.getElementById("date-display");
    if (dateEl) {
      dateEl.textContent = new Date().toLocaleDateString("en-US", { 
        weekday: "long", month: "short", day: "numeric" 
      });
    }
  },

  updateCount(count) {
    const badge = document.getElementById('count-badge');
    if (badge) badge.textContent = count;
  },

  showError(message) {
    const grid = document.getElementById('games-grid');
    if (!grid) return;
    grid.innerHTML = `
      <div class="col-span-full text-center p-10">
        <div class="inline-block bg-red-100 dark:bg-red-900 border-4 border-red-500 rounded-2xl p-8">
          <i data-lucide="alert-circle" class="w-16 h-16 text-red-500 mx-auto mb-4"></i>
          <p class="text-xl font-bold text-red-700 dark:text-red-300">${message}</p>
        </div>
      </div>
    `;
    Utils.refreshIcons();
  },

  showLoading() {
    const grid = document.getElementById('games-grid');
    if (!grid) return;
    grid.innerHTML = `
      <div class="col-span-full text-center p-10">
        <div class="w-16 h-16 border-4 border-slate-300 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
        <p class="text-lg font-bold text-slate-400">Loading activities...</p>
      </div>
    `;
  },

  toggleModal(modalId, show) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.classList.toggle('hidden', !show);
    modal.style.display = show ? 'block' : 'none';
    modal.setAttribute('aria-hidden', String(!show));
    if (modalId === 'game-modal') document.body.style.overflow = show ? 'hidden' : '';
  }
};

// --- RECENT GAMES ---
const RecentGames = {
  get() { return Storage.get(CONFIG.storageKeys.recent, []); },

  add(gameId) {
    let recent = this.get().filter(id => id !== gameId);
    recent.unshift(gameId);
    Storage.set(CONFIG.storageKeys.recent, recent.slice(0, CONFIG.maxRecentGames));
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

    section.classList.toggle('hidden', recentIds.length === 0);
    if (recentIds.length === 0) return;

    container.innerHTML = recentIds.map(id => {
      const game = State.getGameById(id);
      if (!game) return '';
      return `
        <button data-action="openGame" data-param="${game.id}"
          class="recent-pill bg-white dark:bg-slate-800 flex items-center gap-3 px-3 py-2 rounded-xl shrink-0 min-w-[150px] group hover:bg-slate-50 dark:hover:bg-slate-700 border-2 border-dark dark:border-slate-500 shadow-hard-sm"
          aria-label="Resume ${game.title}">
          <div class="w-10 h-10 rounded-lg ${Utils.getColorClass(game.color)} flex items-center justify-center text-white border-2 border-dark dark:border-slate-300 shadow-sm">
            <i data-lucide="${game.icon}" class="w-5 h-5"></i>
          </div>
          <div class="text-left">
            <div class="text-xs font-bold text-dark dark:text-white truncate w-24">${game.title}</div>
            <div class="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase">RESUME</div>
          </div>
        </button>
      `;
    }).join('');
    Utils.refreshIcons();
  }
};

// --- GAME GRID ---
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
      Utils.refreshIcons();
      return;
    }

    grid.innerHTML = gamesToRender.map(game => this.createCard(game)).join('');
    Utils.refreshIcons();
    this.initCardEffects();
  },

  createCard(game) {
    const baseColor = game.color.replace('text-', '').split('-')[0];
    const bgClass = `bg-${baseColor}/10`;
    const btnClass = game.color.replace('text-', 'bg-');
    const difficultyBadge = game.difficulty 
      ? `<span class="text-[8px] font-bold px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400 uppercase">${game.difficulty}</span>`
      : '';

    return `
      <article class="hub-card group cursor-pointer dark:bg-slate-800 dark:border-slate-500" 
        data-action="openGame" data-param="${game.id}" role="button" tabindex="0"
        aria-label="Launch ${game.title}: ${game.description}">
        <div class="${bgClass} p-6 border-b-4 border-dark dark:border-slate-500 h-40 flex items-center justify-center relative overflow-hidden group-hover:${bgClass.replace('/10', '/20')} transition-colors">
          <div class="absolute inset-0 opacity-10" style="background-image:radial-gradient(#000 2px,transparent 2px);background-size:12px 12px"></div>
          <i data-lucide="${game.icon}" class="absolute -right-6 -bottom-6 w-36 h-36 ${game.color} opacity-20 rotate-12 group-hover:scale-110 group-hover:rotate-6 transition-all duration-300"></i>
          <div class="bg-white dark:bg-slate-700 p-4 rounded-2xl border-2 border-dark dark:border-slate-400 shadow-hard dark:shadow-neon-sm relative z-10 group-hover:scale-110 transition-transform duration-300">
            <i data-lucide="${game.icon}" class="w-10 h-10 ${game.color} dark:text-white"></i>
          </div>
        </div>
        <div class="p-6 flex-1 flex flex-col bg-white dark:bg-slate-800">
          <div class="flex justify-between items-start mb-3">
            <h2 class="text-2xl font-heading text-dark dark:text-white leading-none tracking-tight">${game.title}</h2>
            <div class="flex flex-col gap-1 items-end">
              <span class="sticker ${btnClass} text-white text-[10px] font-bold px-2 py-1 rounded-md transform ${Math.random()>0.5?'rotate-2':'-rotate-2'}">${game.category.toUpperCase()}</span>
              ${difficultyBadge}
            </div>
          </div>
          <p class="text-slate-500 dark:text-slate-400 font-bold text-sm mb-6 flex-1 leading-relaxed">${game.description}</p>
          <button class="btn-chunky ${btnClass} text-white w-full py-3 rounded-xl flex items-center justify-center gap-2 text-lg group-hover:brightness-105" tabindex="-1">
            <i data-lucide="play" class="w-5 h-5 fill-current"></i> LAUNCH
          </button>
        </div>
      </article>
    `;
  },

  getGuideText(game) {
    if (!game.guide) {
      return game.category === 'tool'
        ? "<ul class='list-disc pl-5 space-y-2'><li>Adjust settings using the on-screen controls.</li><li>Use fullscreen mode for better visibility.</li></ul>"
        : "<ul class='list-disc pl-5 space-y-2'><li>Follow the on-screen prompts to start.</li><li>Customize words in setup if available.</li></ul>";
    }
    if (typeof game.guide === 'object' && game.guide.steps) {
      return `<ul class='list-disc pl-5 space-y-2'>${game.guide.steps.map(s => `<li>${s}</li>`).join('')}</ul>`;
    }
    return game.guide;
  },

  initCardEffects() {
    document.querySelectorAll('.hub-card').forEach(card => {
      card.addEventListener('mousemove', (e) => this.tiltCard(e, card));
      card.addEventListener('mouseleave', () => {
        card.style.transform = 'perspective(1000px) rotateX(0) rotateY(0)';
      });
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
    const rotateX = ((y - rect.height/2) / (rect.height/2)) * -5;
    const rotateY = ((x - rect.width/2) / (rect.width/2)) * 5;
    card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.02)`;
  }
};

// --- FILTERS ---
const Filters = {
  setCategory(category) {
    AudioEngine.click();
    State.filters.category = category;
    this.updateUI();
    GameGrid.render();
  },

  setSearch: Utils.debounce(function(term) {
    State.filters.searchTerm = term.toLowerCase();
    GameGrid.render();
  }, CONFIG.debounceDelay),

  setDifficulty(difficulty) {
    AudioEngine.click();
    State.filters.difficulty = difficulty;
    GameGrid.render();
  },

  updateUI() {
    document.querySelectorAll('.filter-btn').forEach(btn => {
      const isActive = btn.dataset.category === State.filters.category;
      btn.classList.toggle('active', isActive);
      btn.classList.toggle('bg-dark', isActive);
      btn.classList.toggle('text-white', isActive);
      btn.classList.toggle('bg-white', !isActive);
      btn.classList.toggle('text-dark', !isActive);
      btn.setAttribute('aria-pressed', String(isActive));
    });
  }
};

// --- TAB MANAGER ---
const TabManager = {
  tabs: [],
  activeTabId: null,

  init() {
    this.setupKeyboardShortcuts();
    this.loadTabsFromStorage();
  },

  saveTabsToStorage() {
    const tabsData = this.tabs.map(({id, gameId, title, icon, color}) => ({id, gameId, title, icon, color}));
    Storage.set(CONFIG.storageKeys.tabs, {tabs: tabsData, activeTabId: this.activeTabId});
  },

  loadTabsFromStorage() {
    const savedData = Storage.get(CONFIG.storageKeys.tabs);
    if (!savedData?.tabs?.length) return;

    UI.toggleModal('game-modal', true);
    savedData.tabs.forEach(tabData => {
      const game = State.getGameById(tabData.gameId);
      if (game) this.createTabSilent(game, tabData.id);
    });

    const targetTab = (savedData.activeTabId && this.tabs.find(t => t.id === savedData.activeTabId))
      ? savedData.activeTabId : this.tabs[0]?.id;
    if (targetTab) this.switchToTab(targetTab);
  },

  createTab(game) {
    const existingTab = this.tabs.find(tab => tab.gameId === game.id);
    if (existingTab) {
      this.switchToTab(existingTab.id);
      return existingTab;
    }
    if (this.tabs.length >= CONFIG.maxTabs) {
      this.showMaxTabsWarning();
      return null;
    }
    const tabId = `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    return this.createTabSilent(game, tabId, true);
  },

  createTabSilent(game, tabId, switchTo = false) {
    const tab = {id: tabId, gameId: game.id, title: game.title, icon: game.icon, color: game.color, loading: true};
    this.createTabIcon(tab);
    this.createTabPanel(tab);
    this.tabs.push(tab);
    if (switchTo) this.switchToTab(tabId);
    this.loadGame(tab, game.path);
    this.saveTabsToStorage();
    return tab;
  },

  createTabIcon(tab) {
    const sidePanelTabs = document.getElementById('side-panel-tabs');
    if (!sidePanelTabs) return;

    const tabIcon = document.createElement('button');
    tabIcon.id = `tab-icon-${tab.id}`;
    tabIcon.className = `side-panel-tab${tab.loading?' loading':''}`;
    tabIcon.dataset.tabId = tab.id;
    tabIcon.dataset.color = tab.color;
    tabIcon.title = tab.title;
    tabIcon.setAttribute('role', 'tab');
    tabIcon.setAttribute('aria-selected', 'false');
    tabIcon.setAttribute('aria-label', `Switch to ${tab.title}`);
    tabIcon.innerHTML = `
      <i data-lucide="${tab.icon}" class="side-panel-tab-icon"></i>
      <button class="side-panel-tab-close" data-tab-id="${tab.id}" aria-label="Close ${tab.title}" type="button">
        <i data-lucide="x"></i>
      </button>
    `;

    tabIcon.addEventListener('click', (e) => {
      if (!e.target.closest('.side-panel-tab-close')) {
        this.switchToTab(tab.id);
        AudioEngine.click();
      }
    });

    const closeBtn = tabIcon.querySelector('.side-panel-tab-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.closeTab(closeBtn.dataset.tabId);
      });
    }

    sidePanelTabs.appendChild(tabIcon);
    Utils.refreshIcons();
    tab.iconElement = tabIcon;
  },

  createTabPanel(tab) {
    const tabContentArea = document.getElementById('tab-content-area');
    if (!tabContentArea) return;

    const panel = document.createElement('div');
    panel.id = `tab-panel-${tab.id}`;
    panel.className = 'tab-panel';
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', `tab-icon-${tab.id}`);
    panel.innerHTML = `
      <div class="tab-loading">
        <div class="spinner"></div>
        <div class="loading-text">Loading ${tab.title.toUpperCase()}...</div>
      </div>
    `;

    const iframe = document.createElement('iframe');
    iframe.id = `iframe-${tab.id}`;
    iframe.title = tab.title;
    iframe.setAttribute('aria-label', `${tab.title} game content`);

    panel.appendChild(iframe);
    tabContentArea.appendChild(panel);
    tab.panel = panel;
    tab.iframe = iframe;
  },

  loadGame(tab, path) {
    if (!tab.iframe) return;

    tab.iframe.src = path;
    tab.iframe.onload = () => {
      tab.loading = false;
      tab.panel.classList.add('loaded');
      tab.iconElement?.classList.remove('loading');
      if (this.activeTabId === tab.id) tab.iframe.focus();
    };

    tab.iframe.onerror = () => {
      tab.loading = false;
      const loadingDiv = tab.panel.querySelector('.tab-loading');
      if (loadingDiv) {
        loadingDiv.innerHTML = `
          <i data-lucide="alert-circle" style="width:4rem;height:4rem;color:#ef4444"></i>
          <div class="loading-text" style="color:#ef4444">FAILED TO LOAD</div>
          <p style="color:#ef4444;font-size:0.875rem;margin-top:1rem">Path: ${path}</p>
          <button class="btn-chunky bg-blue text-white px-6 py-3 rounded-xl mt-4" onclick="TabManager.retryLoad('${tab.id}')">
            <i data-lucide="rotate-cw" class="w-5 h-5 inline mr-2"></i>RETRY
          </button>
        `;
        Utils.refreshIcons();
      }
    };

    setTimeout(() => {
      if (tab.loading) {
        tab.loading = false;
        tab.panel.classList.add('loaded');
        tab.iconElement?.classList.remove('loading');
      }
    }, CONFIG.loadTimeout);
  },

  retryLoad(tabId) {
    const tab = this.tabs.find(t => t.id === tabId);
    const game = tab && State.getGameById(tab.gameId);
    if (!tab || !game) return;

    tab.loading = true;
    tab.iconElement?.classList.add('loading');
    tab.panel.classList.remove('loaded');
    tab.panel.innerHTML = `
      <div class="tab-loading">
        <div class="spinner"></div>
        <div class="loading-text">Loading ${tab.title.toUpperCase()}...</div>
      </div>
    `;

    const iframe = document.createElement('iframe');
    iframe.id = `iframe-${tab.id}`;
    iframe.title = tab.title;
    tab.panel.appendChild(iframe);
    tab.iframe = iframe;
    this.loadGame(tab, game.path);
  },

  switchToTab(tabId) {
    const tab = this.tabs.find(t => t.id === tabId);
    if (!tab) return;

    this.activeTabId = tabId;
    this.tabs.forEach(t => {
      const isActive = t.id === tabId;
      t.iconElement?.classList.toggle('active', isActive);
      t.iconElement?.setAttribute('aria-selected', String(isActive));
      t.panel?.classList.toggle('active', isActive);
    });

    const game = State.getGameById(tab.gameId);
    if (game) State.activeGame = game;

    if (window.location.hash !== `#${tab.gameId}`) {
      history.pushState(null, null, `#${tab.gameId}`);
    }

    tab.iconElement?.scrollIntoView({behavior: 'smooth', block: 'nearest'});
    this.saveTabsToStorage();
  },

  closeTab(tabId) {
    const tabIndex = this.tabs.findIndex(t => t.id === tabId);
    if (tabIndex === -1) return;

    const tab = this.tabs[tabIndex];
    const wasActive = this.activeTabId === tabId;

    tab.iconElement?.remove();
    tab.panel?.remove();
    this.tabs.splice(tabIndex, 1);

    if (this.tabs.length === 0) {
      this.closeModal();
      return;
    }

    this.saveTabsToStorage();
    if (wasActive) {
      const newIndex = Math.min(tabIndex, this.tabs.length - 1);
      this.switchToTab(this.tabs[newIndex].id);
    }
    AudioEngine.click();
  },

  closeCurrentTab() {
    if (this.activeTabId) this.closeTab(this.activeTabId);
  },

  returnToHome() {
    this.closeModal();
    AudioEngine.click();
  },

  closeModal() {
    UI.toggleModal('game-modal', false);
    const infoOverlay = document.getElementById('info-overlay');
    if (infoOverlay) {
      infoOverlay.classList.add('hidden');
      infoOverlay.classList.remove('flex');
    }
    this.activeTabId = null;
    State.activeGame = null;
    history.pushState("", document.title, window.location.pathname + window.location.search);
    this.saveTabsToStorage();
  },

  confirmCloseAllTabs() {
    if (this.tabs.length === 0) return;
    const confirmModal = document.getElementById('confirm-modal');
    const countSpan = document.getElementById('confirm-count');
    if (!confirmModal) return;
    if (countSpan) countSpan.textContent = this.tabs.length;
    confirmModal.classList.remove('hidden');
    confirmModal.classList.add('flex');
    Utils.refreshIcons();
  },

  cancelConfirmation() {
    const confirmModal = document.getElementById('confirm-modal');
    if (confirmModal) {
      confirmModal.classList.add('hidden');
      confirmModal.classList.remove('flex');
    }
  },

  closeAllTabsConfirmed() {
    this.cancelConfirmation();
    if (this.tabs.length === 0) return;
    this.tabs.forEach(tab => {
      tab.iconElement?.remove();
      tab.panel?.remove();
    });
    this.tabs = [];
    this.activeTabId = null;
    State.activeGame = null;
    Storage.remove(CONFIG.storageKeys.tabs);
    this.closeModal();
    AudioEngine.click();
  },

  reloadCurrentTab() {
    const tab = this.tabs.find(t => t.id === this.activeTabId);
    if (!tab?.iframe) return;
    tab.loading = true;
    tab.iconElement?.classList.add('loading');
    tab.iframe.contentWindow.location.reload();
    setTimeout(() => {
      tab.loading = false;
      tab.iconElement?.classList.remove('loading');
    }, 1000);
  },

  getCurrentTab() {
    return this.tabs.find(t => t.id === this.activeTabId);
  },

  showMaxTabsWarning() {
    const existingWarning = document.querySelector('.max-tabs-warning');
    if (existingWarning) existingWarning.remove();

    const warning = document.createElement('div');
    warning.className = 'max-tabs-warning';
    warning.innerHTML = `<i data-lucide="alert-triangle" class="w-5 h-5 inline mr-2"></i>Maximum ${CONFIG.maxTabs} tabs open. Close a tab to open another.`;
    document.body.appendChild(warning);
    Utils.refreshIcons();

    setTimeout(() => {
      warning.style.opacity = '0';
      warning.style.transform = 'translateX(-50%) translateY(-20px)';
      warning.style.transition = 'all 0.3s ease';
      setTimeout(() => warning.remove(), 300);
    }, 3000);
  },

  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      const modal = document.getElementById('game-modal');
      if (!modal || modal.style.display === 'none') return;

      if ((e.ctrlKey || e.metaKey) && e.key === 'Tab' && !e.altKey) {
        e.preventDefault();
        this.switchToNextTab(e.shiftKey ? -1 : 1);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'w') {
        e.preventDefault();
        this.closeCurrentTab();
      }
      if (e.altKey && e.key >= '1' && e.key <= '8') {
        e.preventDefault();
        const index = parseInt(e.key) - 1;
        if (this.tabs[index]) this.switchToTab(this.tabs[index].id);
      }
      if (e.key === 'Escape') {
        const infoOverlay = document.getElementById('info-overlay');
        if (infoOverlay && !infoOverlay.classList.contains('hidden')) {
          GameModal.toggleInfo();
        } else {
          this.returnToHome();
        }
      }
    });
  },

  switchToNextTab(direction = 1) {
    if (this.tabs.length === 0) return;
    const currentIndex = this.tabs.findIndex(t => t.id === this.activeTabId);
    if (currentIndex === -1) {
      this.switchToTab(this.tabs[0].id);
      return;
    }
    let newIndex = currentIndex + direction;
    if (newIndex >= this.tabs.length) newIndex = 0;
    else if (newIndex < 0) newIndex = this.tabs.length - 1;
    this.switchToTab(this.tabs[newIndex].id);
    AudioEngine.click();
  }
};

// --- GAME MODAL ---
const GameModal = {
  open(gameId) {
    AudioEngine.click();
    const game = State.getGameById(gameId);
    if (!game) return console.error(`Game not found: ${gameId}`);
    RecentGames.add(gameId);
    UI.toggleModal('game-modal', true);
    TabManager.createTab(game);
  },

  close() {
    TabManager.returnToHome();
  },

  reload() {
    TabManager.reloadCurrentTab();
  },

  toggleInfo() {
    AudioEngine.click();
    const overlay = document.getElementById('info-overlay');
    if (!overlay) return;

    const isHidden = overlay.classList.contains('hidden');
    if (isHidden) {
      const currentTab = TabManager.getCurrentTab();
      const game = currentTab && State.getGameById(currentTab.gameId);
      if (!game) return;
      this.renderInfo(game);
      overlay.classList.remove('hidden');
      overlay.classList.add('flex');
      overlay.querySelector('button')?.focus();
    } else {
      overlay.classList.add('hidden');
      overlay.classList.remove('flex');
      const currentTab = TabManager.getCurrentTab();
      if (currentTab?.iframe) currentTab.iframe.focus();
    }
  },

  renderInfo(game) {
    const baseColor = game.color.replace('text-', '').split('-')[0];
    const bgClass = `bg-${baseColor}`;

    const iconEl = document.getElementById('info-icon');
    const titleEl = document.getElementById('info-title-display');
    const categoryEl = document.getElementById('info-category');
    const difficultyEl = document.getElementById('info-difficulty');
    const contentEl = document.getElementById('info-content');

    if (iconEl) {
      iconEl.className = `w-24 h-24 rounded-2xl border-4 border-dark dark:border-slate-500 flex items-center justify-center text-white shadow-hard dark:shadow-neon shrink-0 ${bgClass}`;
      iconEl.innerHTML = `<i data-lucide="${game.icon}" class="w-12 h-12"></i>`;
    }
    if (titleEl) titleEl.textContent = game.title.toUpperCase();
    if (categoryEl) categoryEl.textContent = game.category.toUpperCase();
    if (difficultyEl) {
      difficultyEl.textContent = game.difficulty?.toUpperCase() || '';
      difficultyEl.style.display = game.difficulty ? 'inline-block' : 'none';
    }
    if (contentEl) contentEl.innerHTML = GameGrid.getGuideText(game);
    Utils.refreshIcons();
  }
};

// --- SEARCH ---
const Search = {
  setup() {
    const input = document.getElementById('search-input');
    if (!input) return;
    input.addEventListener('input', (e) => Filters.setSearch(e.target.value));
  }
};

// --- DATA LOADER ---
const DataLoader = {
  async loadGames() {
    const response = await fetch(CONFIG.dataSource);
    if (!response.ok) throw new Error(`HTTP ${response.status}: Failed to load games data`);
    const data = await response.json();
    if (!this.validateData(data)) throw new Error('Invalid games data structure');
    return data;
  },

  validateData(data) {
    const games = data.games || data;
    if (!Array.isArray(games)) {
      console.error('Games data must be an array');
      return false;
    }
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

// --- APP CONTROLLER ---
const App = {
  async init() {
    try {
      Theme.load();
      UI.updateGreeting();
      UI.showLoading();

      const data = await DataLoader.loadGames();
      State.setGames(data);

      GameGrid.render();
      RecentGames.render();
      Search.setup();

      document.body.addEventListener('click', () => AudioEngine.init(), { once: true });

      TabManager.init();
      this.setupKeyboardShortcuts();
      this.setupEventDelegation();
      this.setupHistoryListener();

      const hash = window.location.hash.substring(1);
      if (hash && !TabManager.tabs.find(t => t.gameId === hash)) {
        GameModal.open(hash);
      }

      Utils.refreshIcons();
    } catch (error) {
      console.error('Initialization error:', error);
      UI.showError('Failed to load activities. Please refresh the page.');
    }
  },

  setupHistoryListener() {
    window.addEventListener('hashchange', () => {
      const hash = window.location.hash.substring(1);
      if (!hash) {
        TabManager.returnToHome();
      } else {
        const existingTab = TabManager.tabs.find(t => t.gameId === hash);
        if (existingTab) {
          TabManager.switchToTab(existingTab.id);
          document.getElementById('game-modal')?.classList.remove('hidden');
        } else {
          GameModal.open(hash);
        }
      }
    });
  },

  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      if (e.key === '/' && document.activeElement.tagName !== 'INPUT') {
        e.preventDefault();
        document.getElementById('search-input')?.focus();
      }

      if (e.key === 'Escape') {
        const infoOverlay = document.getElementById('info-overlay');
        if (infoOverlay && !infoOverlay.classList.contains('hidden')) {
          GameModal.toggleInfo();
          return;
        }
        const modal = document.getElementById('game-modal');
        if (modal && !modal.classList.contains('hidden') && modal.style.display !== 'none') {
          TabManager.returnToHome();
        }
      }
    });
  },

  setupEventDelegation() {
    const actions = {
      toggleTheme: () => Theme.toggle(),
      toggleSound: () => AudioEngine.toggle(),
      openGame: (param) => GameModal.open(param),
      returnToHome: () => TabManager.returnToHome(),
      closeAllTabs: () => TabManager.confirmCloseAllTabs(),
      confirmDelete: () => TabManager.closeAllTabsConfirmed(),
      confirmCancel: () => TabManager.cancelConfirmation(),
      closeCurrentTab: () => TabManager.closeCurrentTab(),
      reloadGame: () => TabManager.reloadCurrentTab(),
      toggleInfo: () => GameModal.toggleInfo(),
      filterGames: (param) => Filters.setCategory(param),
      clearRecent: () => RecentGames.clear(),
      openFeedback: () => window.open(CONFIG.helpUrl, '_blank')
    };

    document.addEventListener('click', (e) => {
      const target = e.target.closest('[data-action]');
      if (!target) return;
      const action = actions[target.dataset.action];
      if (action) action(target.dataset.param);
    });
  }
};

// --- EXPORTS & INITIALIZATION ---
window.App = App;
window.AudioEngine = AudioEngine;
window.TabManager = TabManager;
window.filterGames = (category) => Filters.setCategory(category);

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => App.init());
} else {
  App.init();
}