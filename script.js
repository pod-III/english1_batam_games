// ============================================
// REFACTORED script.js - KlassKit Hub
// Optimized for performance, reduced redundancy
// ============================================

// --- CONSTANTS & CONFIG ---
const CONFIG = {
  helpUrl: "https://forms.gle/VRqg4f3KFHoJXFUu9",
  dataSource: "games.json",
  maxRecentGames: 5,
  maxTabs: 20,
  debounceDelay: 300,
  loadTimeout: 5000,
  storageKeys: {
    theme: "theme_hub",
    recent: "recentGameIds",
    sound: "soundMuted",
    favorites: "favoriteGames",
    tabs: "openTabs",
    pinned: "pinnedGameIds",
    homeView: "klasskit_homeView",
    viewMode: "klasskit_viewMode",
    lastReadAnn: "klasskit_lastReadAnn"
  }
};

// --- UTILITIES ---
const Utils = {
  debounce(fn, delay) {
    let timer;
    return function (...args) {
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

  _iconRefreshPending: false,
  refreshIcons(container) {
    if (this._iconRefreshPending) return;
    this._iconRefreshPending = true;
    requestAnimationFrame(() => {
      this._iconRefreshPending = false;
      if (container && window.lucide?.createIcons) {
        // Scoped refresh — only process icons within the given container
        window.lucide.createIcons({ nodes: container.querySelectorAll('[data-lucide]') });
      } else {
        window.lucide?.createIcons?.();
      }
    });
  }
};

// --- STATE MANAGEMENT ---
const State = {
  games: [],
  gameMap: new Map(), // O(1) lookup by ID
  activeGame: null,
  metadata: null,
  filters: { category: 'all', searchTerm: '', difficulty: 'all', tags: [] },

  setGames(data) {
    const gamesList = data.games || data;
    this.games = gamesList.sort((a, b) => a.title.localeCompare(b.title));
    // Build lookup map
    this.gameMap.clear();
    for (const game of this.games) {
      this.gameMap.set(game.id, game);
    }
    if (data.metadata) this.metadata = data.metadata;
  },

  getFilteredGames() {
    const { category, searchTerm, difficulty, tags } = this.filters;
    const searchLower = searchTerm.toLowerCase().trim();

    return this.games
      .filter(game => {
        if (game.active === false) return false;

        const matchesCategory = category === 'all' ||
          (category === 'featured' ? game.featured === true : game.category === category);
        const matchesDifficulty = difficulty === 'all' || !game.difficulty || game.difficulty === difficulty;
        const matchesTags = tags.length === 0 || game.tags?.some(tag => tags.includes(tag));

        // Basic Filter
        if (!matchesCategory || !matchesDifficulty || !matchesTags) return false;

        // Search Filter
        if (!searchLower) return true;

        const title = game.title.toLowerCase();
        const description = (game.description || "").toLowerCase();
        const cat = game.category.toLowerCase();

        return title.includes(searchLower) ||
          description.includes(searchLower) ||
          cat.includes(searchLower) ||
          game.tags?.some(tag => tag.toLowerCase().includes(searchLower));
      })
      .sort((a, b) => {
        if (searchLower) {
          // Compute scores inline to avoid creating new objects
          const scoreA = this._searchScore(a, searchLower);
          const scoreB = this._searchScore(b, searchLower);
          if (scoreB !== scoreA) return scoreB - scoreA;
        }
        return a.title.localeCompare(b.title);
      });
  },

  _searchScore(game, term) {
    const title = game.title.toLowerCase();
    let score = 0;
    if (title === term) score += 100;
    else if (title.startsWith(term)) score += 80;
    else if (title.includes(term)) score += 60;
    if ((game.description || '').toLowerCase().includes(term)) score += 40;
    if (game.category.toLowerCase().includes(term)) score += 30;
    if (game.tags?.some(tag => tag.toLowerCase().includes(term))) score += 20;
    return score;
  },

  getGameById(id) {
    return this.gameMap.get(id) || null;
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

      // If this is a hub key, trigger a cloud save in background
      const hubKeys = Object.values(CONFIG.storageKeys);
      if (hubKeys.includes(key)) {
        this.triggerCloudSave();
      }
      return true;
    } catch (error) {
      console.error(`Storage write error for "${key}":`, error);
      return false;
    }
  },

  remove(key) {
    try {
      localStorage.removeItem(key);
      const hubKeys = Object.values(CONFIG.storageKeys);
      if (hubKeys.includes(key)) {
        this.triggerCloudSave();
      }
    } catch (error) {
      console.error(`Storage remove error for "${key}":`, error);
    }
  },

  _saveTimeout: null,
  triggerCloudSave() {
    if (this._saveTimeout) clearTimeout(this._saveTimeout);
    this._saveTimeout = setTimeout(async () => {
      if (typeof isSandbox === 'function' && isSandbox()) return;
      const user = await getUser();
      if (!user) return;

      const hubState = {};
      Object.keys(CONFIG.storageKeys).forEach(keyName => {
        const key = CONFIG.storageKeys[keyName];
        const val = this.get(key);
        if (val !== null) hubState[key] = val;
      });

      console.log('[CloudPersistence] Saving hub state...', hubState);
      await saveProgress('klasskit_hub', hubState);
    }, 2000); // Debounce to avoid excessive writes
  },

  async syncWithCloud() {
    if (typeof isSandbox === 'function' && isSandbox()) return;
    const user = await getUser();
    if (!user) return;

    console.log('[CloudPersistence] Syncing with cloud...');
    const cloudHubState = await loadProgress('klasskit_hub');

    if (cloudHubState) {
      console.log('[CloudPersistence] Found cloud state:', cloudHubState);
      let changed = false;
      Object.keys(cloudHubState).forEach(key => {
        const localVal = localStorage.getItem(key);
        const cloudVal = JSON.stringify(cloudHubState[key]);
        if (localVal !== cloudVal) {
          localStorage.setItem(key, cloudVal);
          changed = true;
        }
      });
      return changed;
    }
    return false;
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
    let greeting = "";

    if (hour < 12) greeting = "Good Morning, Teacher! ☕";
    else if (hour < 15) greeting = "Good Afternoon! ☀️";
    else if (hour < 18) greeting = "Almost the weekend? 🍎";
    else greeting = "Good Evening! 🌙";

    const greetingEl = document.getElementById("greeting-display");
    if (greetingEl) greetingEl.textContent = greeting;

    const dateEl = document.getElementById("date-display");
    if (dateEl) {
      const dateStr = new Date().toLocaleDateString("en-US", {
        weekday: "long", month: "short", day: "numeric"
      });
      dateEl.innerHTML = `<i data-lucide="calendar" class="w-3.5 h-3.5"></i> ${dateStr}`;
    }

    this.updateDailyTip();
  },

  updateDailyTip() {
    const tips = [
      'Use shortcut "/" to quickly search the library!',
      'Press Alt+H to quickly return Home while in a tool.',
      'Pin your Most Used items to keep them at the top.',
      'Tap the Moon icon to switch to Dark Mode for projectors.',
      'Need focus? Hit the maximize button in the side panel for full-screen!',
      'Keep everything tidy: use the trash icon to close all running tabs.'
    ];
    // Seed random tip based on current day to act as a "Daily" tip
    const today = new Date().getDate();
    const tipIndex = today % tips.length;
    const tipEl = document.getElementById('daily-tip');
    if (tipEl) tipEl.innerHTML = `<i data-lucide="sparkles" class="w-4 h-4 text-yellow-300"></i> Tip: ${tips[tipIndex]}`;
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

    let skeletons = '';
    for (let i = 0; i < 8; i++) {
      skeletons += `
        <div class="skeleton-card skeleton animate-pop-in" style="animation-delay: ${i * 0.05}s"></div>
      `;
    }
    grid.innerHTML = skeletons;
  },

  toggleModal(modalId, show) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.classList.toggle('hidden', !show);
    modal.setAttribute('aria-hidden', String(!show));
    if (modalId === 'game-modal') {
      document.body.style.overflow = show ? 'hidden' : '';
      document.body.classList.toggle('game-modal-open', show);
    }
  },

  toggleFocus() {
    AudioEngine.click();
    document.body.classList.toggle('focus-mode');

    // Attempt to resize or trigger a window resize event so games adapt
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 300);
  },

  toggleSettings() {
    AudioEngine.click();
    const menu = document.getElementById('settings-menu');
    const container = document.getElementById('settings-container');
    if (!menu || !container) return;

    const isClosed = menu.classList.contains('opacity-0');

    menu.classList.toggle('opacity-0', !isClosed);
    menu.classList.toggle('pointer-events-none', !isClosed);
    menu.classList.toggle('translate-y-4', !isClosed);
    menu.classList.toggle('translate-y-0', isClosed);

    const icon = container.querySelector('[data-action="toggleSettings"] i');
    if (icon) icon.classList.toggle('rotate-90', isClosed);
  },

  showToast(message, type = 'warning', duration = 3000) {
    const existingToast = document.querySelector('.toast');
    if (existingToast) existingToast.remove();

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const iconMap = {
      warning: 'alert-triangle',
      info: 'info',
      success: 'check-circle',
      error: 'x-circle'
    };

    toast.innerHTML = `
      <i data-lucide="${iconMap[type] || 'info'}" class="w-5 h-5"></i>
      <span>${message}</span>
    `;

    document.body.appendChild(toast);
    Utils.refreshIcons();

    setTimeout(() => toast.classList.add('show'), 10);

    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },

  /**
   * Spatial Expansion Animation: Opens modal from the clicked element's position
   */
  animateModalOpen(element, modalId) {
    const modal = document.getElementById(modalId);
    if (!modal || !element) {
      this.toggleModal(modalId, true);
      return;
    }

    const rect = element.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    modal.style.display = 'block';
    modal.classList.remove('hidden');
    modal.style.clipPath = `circle(0% at ${centerX}px ${centerY}px)`;
    modal.style.opacity = '0';
    modal.style.transition = 'clip-path 0.5s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease-out';

    // Force reflow
    modal.offsetHeight;

    modal.style.clipPath = `circle(150% at ${centerX}px ${centerY}px)`;
    modal.style.opacity = '1';

    document.body.style.overflow = 'hidden';
    if (modalId === 'game-modal') document.body.classList.add('game-modal-open');

    setTimeout(() => {
      modal.style.clipPath = '';
      modal.style.transition = '';
    }, 600);
  }
};

// --- HERO BANNER ---
const Hero = {
  headings: [
    "Let's start teaching",
    "Ready to inspire?",
    "Make learning fun",
    "Time to teach!",
    "Spark curiosity today",
    "Learning starts here",
    "Build great lessons"
  ],

  updateHeading() {
    const el = document.getElementById('hero-heading');
    if (!el) return;
    const today = new Date().getDate();
    el.textContent = this.headings[today % this.headings.length];
  },

  updateStats() {
    const active = State.games.filter(g => g.active !== false);
    const tools = active.filter(g => g.category === 'tool').length;
    const games = active.filter(g => g.category === 'game').length;
    const workshop = active.filter(g => g.category === 'workshop').length;
    const pinned = PinnedGames.get().length;

    const toolsEl = document.getElementById('stat-tools');
    const gamesEl = document.getElementById('stat-games');
    const workshopEl = document.getElementById('stat-workshop');
    const pinnedEl = document.getElementById('stat-pinned');
    if (toolsEl) toolsEl.textContent = tools;
    if (gamesEl) gamesEl.textContent = games;
    if (workshopEl) workshopEl.textContent = workshop;
    if (pinnedEl) pinnedEl.textContent = pinned;
  },

  updateContinueBtn() {
    const btn = document.getElementById('continue-btn');
    const label = document.getElementById('continue-btn-label');
    if (!btn || !label) return;

    const recentIds = RecentGames.get();
    if (recentIds.length === 0) {
      btn.classList.add('hidden');
      return;
    }

    const lastGame = State.getGameById(recentIds[0]);
    if (!lastGame) {
      btn.classList.add('hidden');
      return;
    }

    label.textContent = `Continue: ${lastGame.title}`;
    btn.dataset.param = lastGame.id;
    btn.classList.remove('hidden');
  },

  surpriseMe() {
    AudioEngine.click();
    const active = State.games.filter(g => g.active !== false);
    if (active.length === 0) return;
    const random = active[Math.floor(Math.random() * active.length)];
    GameModal.open(random.id);
  },

  init() {
    this.updateHeading();
    this.updateStats();
    this.updateContinueBtn();
    Announcements.init();
    StorageManager.init();
  }
};

// --- STORAGE MANAGER ---
const StorageManager = {
  async init() {
    const user = await getUser();
    if (!user) return;

    document.getElementById('storage-badge')?.classList.remove('hidden');
    await this.update();
  },

  async update() {
    try {
      const usage = await getUserStorageUsage();
      this.render(usage);
      
      // Quota check (80%) - skip for sandbox
      if (!usage.isSandbox && usage.percent >= 80) {
        const lastWarned = localStorage.getItem('kk_quota_warned_at');
        const now = Date.now();
        // Warn once every 24h
        if (!lastWarned || (now - parseInt(lastWarned)) > 24 * 60 * 60 * 1000) {
          UI.showToast(`Storage Quota: ${usage.percent}% used. Consider cleaning up old images.`, 'warning', 5000);
          localStorage.setItem('kk_quota_warned_at', now.toString());
        }
      }
    } catch (err) {
      console.warn('[StorageManager] Update error:', err);
    }
  },

  render(usage) {
    const textEl = document.getElementById('storage-text');
    const barEl = document.getElementById('storage-bar');
    if (!textEl || !barEl) return;

    const usedMB = (usage.used / (1024 * 1024)).toFixed(1);
    
    if (usage.isSandbox) {
        textEl.textContent = `${usedMB} MB Used (Local)`;
        barEl.style.width = `${usage.percent}%`;
        barEl.classList.remove('bg-blue', 'bg-orange', 'bg-red-500');
        barEl.classList.add('bg-slate-300');
    } else {
        textEl.textContent = `${usage.percent}% Storage Used`;
        barEl.style.width = `${usage.percent}%`;
        
        // Dynamic Color Triage
        barEl.classList.remove('bg-blue', 'bg-orange', 'bg-pink', 'bg-slate-300', 'bg-green');
        if (usage.percent >= 85) {
          barEl.classList.add('bg-pink');
        } else if (usage.percent >= 60) {
          barEl.classList.add('bg-orange');
        } else {
          barEl.classList.add('bg-green');
        }
    }
  }
};

// --- ANNOUNCEMENTS ---
const Announcements = {
  list: [],

  async init() {
    await this.fetch();
    this.render();
    this.renderPanel();
    this.checkNew();
  },

  async fetch() {
    try {
      const { data, error } = await db
        .from('announcements')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(3);

      if (error) throw error;
      this.list = data || [];
    } catch (err) {
      console.warn('[Announcements] Fetch error:', err);
      this.list = [];
    }
  },

  render() {
    const container = document.getElementById('announcement-board');
    if (!container) return;

    if (this.list.length === 0) {
      container.classList.add('hidden');
      return;
    }

    container.classList.remove('hidden');
    
    // Check for unread
    const lastRead = Storage.get(CONFIG.storageKeys.lastReadAnn, 0);
    const latestTime = new Date(this.list[0].created_at).getTime();
    const hasNew = latestTime > lastRead;

    const badge = document.getElementById('ann-new-badge');
    const headerBadge = document.getElementById('header-ann-badge');
    if (badge) badge.classList.toggle('hidden', !hasNew);
    if (headerBadge) headerBadge.classList.toggle('hidden', !hasNew);

    const listEl = document.getElementById('ann-items-list');
    if (!listEl) return;

    listEl.innerHTML = this.list.map((ann, i) => {
      const date = new Date(ann.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
      const typeColors = {
        info: 'blue',
        update: 'green',
        alert: 'orange'
      };
      const color = typeColors[ann.type] || 'blue';
      const icon = ann.type === 'alert' ? 'alert-triangle' : (ann.type === 'update' ? 'sparkles' : 'info');

      return `
        <div onclick="Announcements.viewDetail('${ann.id}')" 
          class="ann-card bg-white dark:bg-slate-800 p-6 rounded-2xl border-[3px] border-dark dark:border-slate-600 shadow-hard dark:shadow-neon-sm hover:border-blue dark:hover:border-blue transition-all cursor-pointer group animate-pop-in" 
          style="animation-delay: ${i * 0.1}s">
          
          <div class="flex items-start justify-between mb-4">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-${color}/10 text-${color} flex items-center justify-center border-2 border-${color}/20">
                <i data-lucide="${icon}" class="w-5 h-5"></i>
              </div>
              <div>
                <span class="text-[10px] font-black text-${color} uppercase tracking-widest">${ann.type}</span>
                <div class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">${date}</div>
              </div>
            </div>
            <i data-lucide="chevron-right" class="w-5 h-5 text-slate-300 group-hover:text-blue transition-colors"></i>
          </div>
          
          <h4 class="text-xl font-heading font-black text-dark dark:text-white mb-3 leading-tight group-hover:text-blue transition-colors">${ann.title}</h4>
          <p class="text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-body font-semibold line-clamp-3 mb-4">${this.formatText(ann.content).replace(/<br>/g, ' ')}</p>
          
          <div class="flex items-center gap-2 text-[10px] font-black text-blue uppercase tracking-[0.2em] opacity-0 group-hover:opacity-100 transition-opacity">
            <span>View Full Update</span>
            <i data-lucide="arrow-right" class="w-3 h-3"></i>
          </div>
        </div>
      `;
    }).join('');

    Utils.refreshIcons(listEl);
  },

  markAsRead() {
    if (this.list.length > 0) {
      const latestTime = this.list[0].created_at;
      const latestTimestamp = new Date(latestTime).getTime();
      
      // Update Local Storage (this triggers the existing Hub Cloud Sync automatically)
      Storage.set(CONFIG.storageKeys.lastReadAnn, latestTimestamp);
      
      const badge = document.getElementById('ann-new-badge');
      const headerBadge = document.getElementById('header-ann-badge');
      if (badge) badge.classList.add('hidden');
      if (headerBadge) headerBadge.classList.add('hidden');
    }
  },

  checkNew() {
    if (this.list.length > 0) {
      const lastRead = Storage.get(CONFIG.storageKeys.lastReadAnn, 0);
      const latestTime = new Date(this.list[0].created_at).getTime();
      if (latestTime > lastRead) {
        UI.showToast(`New announcement: ${this.list[0].title}`, 'info', 5000);
      }
    }
  },

  renderPanel() {
    const listEl = document.getElementById('panel-ann-list');
    if (!listEl) return;

    if (this.list.length === 0) {
      listEl.innerHTML = '<div class="text-center p-12 text-slate-500 font-bold">No notifications yet.</div>';
      return;
    }

    const lastRead = Storage.get(CONFIG.storageKeys.lastReadAnn, 0);

    listEl.innerHTML = this.list.map((ann, i) => {
      const date = new Date(ann.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
      const typeColors = {
        info: 'blue',
        update: 'green',
        alert: 'orange'
      };
      const color = typeColors[ann.type] || 'blue';
      const isUnread = new Date(ann.created_at).getTime() > lastRead;
      const statusIcon = isUnread ? 'mail' : 'mail-open';
      const statusColor = isUnread ? 'text-blue' : 'text-slate-400';

      return `
        <div onclick="Announcements.viewDetail('${ann.id}')" 
          class="p-5 bg-white dark:bg-slate-800 rounded-2xl border-2 border-dark dark:border-slate-700 hover:border-blue dark:hover:border-blue transition-all cursor-pointer group animate-pop-in relative overflow-hidden shadow-sm hover:shadow-md"
          style="animation-delay: ${i * 0.05}s">
          
          ${isUnread ? '<div class="absolute top-0 right-0 w-3 h-3 bg-blue rounded-bl-lg"></div>' : ''}
          
          <div class="flex items-start justify-between mb-3">
            <div class="flex items-center gap-2">
              <i data-lucide="${statusIcon}" class="w-4 h-4 ${statusColor}"></i>
              <span class="text-[10px] font-black uppercase tracking-widest text-slate-500">${ann.type}</span>
            </div>
            <span class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">${date}</span>
          </div>
          
          <h4 class="text-lg font-heading font-black text-dark dark:text-white mb-2 group-hover:text-blue transition-colors leading-tight">${ann.title}</h4>
          <p class="text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-semibold line-clamp-2">${this.formatText(ann.content).replace(/<br>/g, ' ')}</p>
          
          <div class="mt-4 flex items-center gap-1 text-[10px] font-black text-blue uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
            <span>Read More</span>
            <i data-lucide="chevron-right" class="w-3 h-3"></i>
          </div>
        </div>
      `;
    }).join('');
    Utils.refreshIcons(listEl);
  },

  viewDetail(annId) {
    const ann = this.list.find(a => a.id === annId);
    if (!ann) return;

    AudioEngine.click();
    
    // Populate Modal
    const titleEl = document.getElementById('ann-detail-title');
    const typeEl = document.getElementById('ann-detail-type');
    const dateEl = document.getElementById('ann-detail-date');
    const contentEl = document.getElementById('ann-detail-content');
    const iconEl = document.getElementById('ann-detail-icon');
    const headerEl = document.getElementById('ann-detail-header');
    
    if (titleEl) titleEl.textContent = ann.title;
    if (typeEl) typeEl.textContent = ann.type;
    if (dateEl) dateEl.textContent = new Date(ann.created_at).toLocaleDateString(undefined, { 
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
    });
    if (contentEl) contentEl.innerHTML = this.formatText(ann.content);
    
    // Set type icon and header color
    const typeConfigs = {
      info: { icon: 'info', color: 'bg-blue' },
      update: { icon: 'sparkles', color: 'bg-green' },
      alert: { icon: 'alert-triangle', color: 'bg-orange' }
    };
    const config = typeConfigs[ann.type] || typeConfigs.info;
    
    if (iconEl) iconEl.setAttribute('data-lucide', config.icon);
    if (headerEl) {
      headerEl.className = headerEl.className.replace(/bg-(blue|green|orange)/g, config.color);
    }
    
    Utils.refreshIcons(headerEl);
    UI.toggleModal('ann-detail-modal', true);
  },

  closeDetail() {
    AudioEngine.click();
    UI.toggleModal('ann-detail-modal', false);
  },

  togglePanel(show = null) {
    AudioEngine.click();
    const panel = document.getElementById('notification-panel');
    if (!panel) return;

    const isVisible = !panel.classList.contains('translate-x-full');
    const targetShow = show !== null ? show : !isVisible;

    if (targetShow) {
      panel.classList.remove('translate-x-full');
      // No longer auto-marking as read on open, user can use the button or read specific ones
    } else {
      panel.classList.add('translate-x-full');
      // Optional: mark as read when closing?
      // this.markAsRead(); 
    }
  },

  toggleBoard() {
    this.togglePanel();
  },

  formatText(text) {
    if (!text) return '';
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br>');
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
    Hero.updateContinueBtn();
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
          class="recent-pill bg-white dark:bg-slate-800 flex items-center gap-2 px-2 py-1.5 rounded-xl shrink-0 min-w-[120px] group hover:bg-slate-50 dark:hover:bg-slate-700 border-2 border-dark dark:border-slate-500 shadow-hard-sm"
          aria-label="Resume ${game.title}">
          <div class="w-8 h-8 rounded-lg ${Utils.getColorClass(game.color)} flex items-center justify-center text-white border-2 border-dark dark:border-slate-300 shadow-sm">
            <i data-lucide="${game.icon}" class="w-4 h-4"></i>
          </div>
          <div class="text-left">
            <div class="text-[10px] font-black text-dark dark:text-white truncate w-20 leading-tight">${game.title}</div>
            <div class="text-[8px] text-slate-400 font-black uppercase tracking-tighter">RESUME</div>
          </div>
        </button>
      `;
    }).join('');
    Utils.refreshIcons(container);
  }
};

// --- PINNED GAMES ---
const PinnedGames = {
  get() { return Storage.get(CONFIG.storageKeys.pinned, []); },

  isPinned(gameId) {
    return this.get().includes(gameId);
  },

  toggle(gameId) {
    let pinned = this.get();
    const isPinned = pinned.includes(gameId);

    if (isPinned) {
      pinned = pinned.filter(id => id !== gameId);
    } else {
      pinned.unshift(gameId);
    }

    Storage.set(CONFIG.storageKeys.pinned, pinned);
    this.render();
    GameGrid.render(); // Refresh main grid to update pin icons
    AudioEngine.click();
    return !isPinned;
  },

  render() {
    const pinnedIds = this.get();
    const container = document.getElementById("pinned-list");
    const section = document.getElementById("pinned-section");
    const badge = document.getElementById("pinned-count-badge");

    if (!container || !section) return;

    section.classList.toggle('hidden', pinnedIds.length === 0);
    if (badge) badge.textContent = pinnedIds.length;

    if (pinnedIds.length === 0) return;

    container.innerHTML = pinnedIds.map(id => {
      const game = State.getGameById(id);
      if (!game) return '';
      return `
        <article class="recent-pill bg-white dark:bg-slate-800 flex items-center gap-2 px-2.5 py-1.5 rounded-xl shrink-0 min-w-[150px] group hover:bg-slate-50 dark:hover:bg-slate-700 border-2 border-dark dark:border-slate-500 shadow-hard-sm cursor-pointer"
          data-action="openGame" data-param="${game.id}">
          <div class="w-8 h-8 rounded-lg ${Utils.getColorClass(game.color)} flex items-center justify-center text-white border-2 border-dark dark:border-slate-300 shadow-sm relative">
             <i data-lucide="${game.icon}" class="w-4 h-4"></i>
          </div>
          <div class="text-left flex-1">
            <div class="text-xs font-black text-dark dark:text-white truncate w-24 leading-tight">${game.title}</div>
            <div class="text-[9px] text-slate-400 font-black uppercase tracking-tight">${game.category}</div>
          </div>
          <button data-action="togglePin" data-param="${game.id}" class="p-1 hover:text-red-500 text-slate-400 transition-colors" title="Unpin">
            <i data-lucide="pin-off" class="w-3.5 h-3.5"></i>
          </button>
        </article>
      `;
    }).join('');
    Utils.refreshIcons(container);
  }
};

// Stats module removed


// --- GAME GRID ---
const GameGrid = {
  render(games = null) {
    const gamesToRender = games || State.getFilteredGames();
    const grid = document.getElementById('games-grid');
    if (!grid) return;

    UI.updateCount(gamesToRender.length);

    if (gamesToRender.length === 0) {
      grid.innerHTML = `
        <div class="empty-state">
          <i data-lucide="search-x" class="empty-state-icon"></i>
          <p class="empty-state-title">No activities found</p>
          <p class="empty-state-subtitle">Try adjusting your filters</p>
        </div>
      `;
      Utils.refreshIcons();
      return;
    }

    // Group by category
    const tools = gamesToRender.filter(g => g.category === 'tool');
    const gamesList = gamesToRender.filter(g => g.category === 'game');
    const workshop = gamesToRender.filter(g => g.category === 'workshop');
    const other = gamesToRender.filter(g => !['tool', 'game', 'workshop'].includes(g.category));

    let html = '';

    if (tools.length > 0) {
      html += this.renderCategorySection('tools', 'wrench', 'var(--color-blue)', 'Teaching Tools', tools);
    }
    if (workshop.length > 0) {
      html += this.renderCategorySection('workshop', 'hammer', 'var(--color-pink)', 'Workshop Tools', workshop);
    }
    if (gamesList.length > 0) {
      html += this.renderCategorySection('games', 'gamepad-2', 'var(--color-green)', 'Classroom Games', gamesList);
    }
    if (other.length > 0) {
      html += this.renderCategorySection('other', 'box', 'var(--color-orange)', 'Other', other);
    }

    grid.innerHTML = html;
    ViewMode.apply();
    Utils.refreshIcons(grid);
    this.initCardEffects(grid);
  },

  renderCategorySection(id, icon, color, title, games) {
    return `
      <section class="category-section" id="category-${id}">
        <div class="section-header">
          <div class="section-header-icon" style="background: ${color};">
            <i data-lucide="${icon}" class="w-4 h-4"></i>
          </div>
          <h3 class="section-header-title">${title}</h3>
          <span class="section-header-badge">${games.length}</span>
        </div>
        <div class="category-grid">
          ${games.map(game => this.createCard(game)).join('')}
        </div>
      </section>
    `;
  },

  createCard(game) {
    const baseColor = game.color.replace('text-', '').split('-')[0];
    const bgClass = `bg-${baseColor}/10`;
    const btnClass = game.color.replace('text-', 'bg-');
    const difficultyBadge = game.difficulty
      ? `<span class="text-[8px] font-bold px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400 uppercase">${game.difficulty}</span>`
      : '';

    const isPinned = PinnedGames.isPinned(game.id);
    const pinIcon = isPinned ? 'pin-off' : 'pin';
    const pinTitle = isPinned ? 'Unpin from top' : 'Pin to top';

    let displayTitle = game.title;
    let displayDesc = game.description;

    if (State.filters.searchTerm) {
      const regex = new RegExp(`(${State.filters.searchTerm})`, 'gi');
      displayTitle = displayTitle.replace(regex, '<mark class="bg-yellow-200 text-slate-800 rounded px-1">$1</mark>');
      displayDesc = displayDesc.replace(regex, '<mark class="bg-yellow-200 text-slate-800 rounded px-1">$1</mark>');
    }

    return `
      <article class="hub-card group cursor-pointer dark:bg-slate-800 dark:border-slate-500" 
        data-action="openGame" data-param="${game.id}" role="button" tabindex="0"
        aria-label="Launch ${game.title}: ${game.description}">
        <div class="${bgClass} p-6 border-b-4 border-dark dark:border-slate-500 h-40 flex items-center justify-center relative overflow-hidden group-hover:${bgClass.replace('/10', '/20')} transition-colors">
          <button data-action="togglePin" data-param="${game.id}" 
            class="pin-btn absolute top-3 right-3 z-30 w-8 h-8 rounded-lg bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center text-dark opacity-0 group-hover:opacity-100 transition-all hover:bg-white/40 hover:scale-110"
            title="${pinTitle}">
            <i data-lucide="${pinIcon}" class="w-4 h-4 ${isPinned ? 'text-red-500' : ''}"></i>
          </button>
          <div class="absolute inset-0 opacity-10" style="background-image:radial-gradient(#000 2px,transparent 2px);background-size:12px 12px"></div>
          <i data-lucide="${game.icon}" class="absolute -right-6 -bottom-6 w-36 h-36 ${game.color} opacity-20 rotate-12 group-hover:scale-110 group-hover:rotate-6 transition-all duration-300"></i>
          <div class="bg-white dark:bg-slate-700 p-4 rounded-2xl border-2 border-dark dark:border-slate-400 shadow-hard dark:shadow-neon-sm relative z-10 group-hover:scale-110 transition-transform duration-300">
            <i data-lucide="${game.icon}" class="w-10 h-10 ${game.color} dark:text-white"></i>
          </div>
        </div>
        <div class="p-6 flex-1 flex flex-col bg-white dark:bg-slate-800">
          <div class="flex justify-between items-start mb-3">
            <h2 class="text-2xl font-heading text-dark dark:text-white leading-none tracking-tight">${displayTitle}</h2>
            <div class="flex flex-col gap-1 items-end">
              <span class="sticker ${btnClass} text-white text-[10px] font-bold px-2 py-1 rounded-md transform ${Math.random() > 0.5 ? 'rotate-2' : '-rotate-2'}">${game.category.toUpperCase()}</span>
              ${difficultyBadge}
            </div>
          </div>
          <p class="text-slate-500 dark:text-slate-400 font-bold text-sm mb-6 flex-1 leading-relaxed">${displayDesc}</p>
          <button class="btn-chunky ${btnClass} text-white w-full py-3 rounded-xl flex items-center justify-center gap-2 text-lg group-hover:brightness-105" tabindex="-1">
            <i data-lucide="play" class="w-5 h-5 fill-current"></i> LAUNCH
          </button>
        </div>
      </article>
    `;
  },

  getGuideText(game) {
    if (!game.guide) {
      return (game.category === 'tool' || game.category === 'workshop')
        ? "<ul class='list-disc pl-5 space-y-2'><li>Adjust settings using the on-screen controls.</li><li>Use fullscreen mode for better visibility.</li></ul>"
        : "<ul class='list-disc pl-5 space-y-2'><li>Follow the on-screen prompts to start.</li><li>Customize words in setup if available.</li></ul>";
    }
    if (typeof game.guide === 'object' && game.guide.steps) {
      return `<ul class='list-disc pl-5 space-y-2'>${game.guide.steps.map(s => `<li>${s}</li>`).join('')}</ul>`;
    }
    return game.guide;
  },

  initCardEffects(container) {
    if (!container) return;
    // Delegated event handling on the grid container
    container.addEventListener('mousemove', (e) => {
      const card = e.target.closest('.hub-card');
      if (card) this.tiltCard(e, card);
    });
    container.addEventListener('mouseleave', (e) => {
      const card = e.target.closest('.hub-card');
      if (card) card.style.transform = '';
    }, true); // use capture to catch leave from children
  },

  tiltCard(e, card) {
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Glare coordinates (percentage)
    const glareX = (x / rect.width) * 100;
    const glareY = (y / rect.height) * 100;
    card.style.setProperty('--glare-x', `${glareX}%`);
    card.style.setProperty('--glare-y', `${glareY}%`);

    const rotateX = ((y - rect.height / 2) / (rect.height / 2)) * -5;
    const rotateY = ((x - rect.width / 2) / (rect.width / 2)) * 5;
    card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.02)`;
  }
};

// --- VIEW MODE ---
const ViewMode = {
  current: 'cards', // 'cards' | 'list' | 'icons'

  init() {
    this.current = Storage.get(CONFIG.storageKeys.viewMode, 'cards') || 'cards';
    this.updateToggleUI();
    this.apply(); // Actually apply the CSS classes on load
  },

  set(mode) {
    if (!['cards', 'list', 'icons'].includes(mode)) return;
    this.current = mode;
    Storage.set(CONFIG.storageKeys.viewMode, mode);
    this.apply();
    this.updateToggleUI();
    AudioEngine.click();
  },

  apply() {
    const gridContainer = document.getElementById('games-grid');
    if (!gridContainer) return;
    gridContainer.classList.remove('view-list', 'view-icons');
    if (this.current === 'list') gridContainer.classList.add('view-list');
    if (this.current === 'icons') gridContainer.classList.add('view-icons');
  },

  updateToggleUI() {
    const container = document.getElementById('view-toggle');
    if (!container) return;
    container.querySelectorAll('.view-toggle-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.param === this.current);
    });
  }
};

// --- LANDING PAGE ---
const LandingPage = {
  currentView: 'landing', // 'landing' or 'library'

  init() {
    const saved = Storage.get(CONFIG.storageKeys.homeView);
    if (saved === 'library') {
      this.showLibrary(true);
    } else {
      this.showLanding(true);
    }
  },

  showLanding(silent = false) {
    const landingView = document.getElementById('landing-view');
    const libraryView = document.getElementById('library-view');
    const homeBtn = document.getElementById('nav-home-btn');
    if (!landingView || !libraryView) return;

    // Reset state to original
    State.filters = { category: 'all', searchTerm: '', difficulty: 'all', tags: [] };
    const searchInput = document.getElementById('search-input');
    if (searchInput) searchInput.value = '';

    this.currentView = 'landing';
    landingView.style.display = '';
    libraryView.style.display = 'none';

    // Re-trigger entrance animation
    landingView.style.animation = 'none';
    landingView.offsetHeight; // force reflow
    landingView.style.animation = '';

    // Update sidebar active states
    if (homeBtn) homeBtn.classList.add('active');
    document.querySelectorAll('.filter-btn[data-category]').forEach(btn => {
      btn.classList.remove('active');
    });

    Storage.set(CONFIG.storageKeys.homeView, 'landing');
    if (!silent) AudioEngine.click();
    Utils.refreshIcons();
  },

  showLibrary(silent = false) {
    const landingView = document.getElementById('landing-view');
    const libraryView = document.getElementById('library-view');
    const homeBtn = document.getElementById('nav-home-btn');
    if (!landingView || !libraryView) return;

    this.currentView = 'library';
    landingView.style.display = 'none';
    libraryView.style.display = '';

    // Re-trigger entrance animation
    libraryView.style.animation = 'none';
    libraryView.offsetHeight; // force reflow
    libraryView.style.animation = '';

    // Update sidebar active states
    if (homeBtn) homeBtn.classList.remove('active');
    Filters.updateUI();

    Storage.set(CONFIG.storageKeys.homeView, 'library');
    if (!silent) AudioEngine.click();
    Utils.refreshIcons();
  }
};

// --- FILTERS ---
const Filters = {
  setCategory(category) {
    AudioEngine.click();
    State.filters.category = category;
    this.updateUI();
    GameGrid.render();

    // Auto-switch to library view when a filter is selected
    if (LandingPage.currentView !== 'library') {
      LandingPage.showLibrary(true);
    }
  },

  setSearch: Utils.debounce(function (term) {
    State.filters.searchTerm = term.toLowerCase();
    GameGrid.render();

    // Auto-switch to library view when searching
    if (term.trim() !== '' && LandingPage.currentView !== 'library') {
      LandingPage.showLibrary(true);
    }

    // Toggle clear search button visibility
    const clearBtn = document.getElementById('clear-search-btn');
    if (clearBtn) {
      if (term.trim() !== '') {
        clearBtn.classList.remove('hidden');
      } else {
        clearBtn.classList.add('hidden');
      }
    }
  }, CONFIG.debounceDelay),

  updateUI() {
    const homeBtn = document.getElementById('nav-home-btn');
    const bnavHome = document.getElementById('bnav-home');
    const isLanding = LandingPage.currentView === 'landing';

    if (homeBtn) homeBtn.classList.toggle('active', isLanding);
    if (bnavHome) bnavHome.classList.toggle('active', isLanding);

    document.querySelectorAll('.filter-btn[data-category]').forEach(btn => {
      const isActive = btn.dataset.category === State.filters.category && LandingPage.currentView === 'library';
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-pressed', String(isActive));
    });

    // Update Bottom Nav items
    const bnavItems = {
      all: 'bnav-library',
      tool: 'bnav-tools',
      workshop: 'bnav-workshop'
    };

    Object.keys(bnavItems).forEach(cat => {
      const el = document.getElementById(bnavItems[cat]);
      if (el) {
        const isActive = State.filters.category === cat && LandingPage.currentView === 'library';
        el.classList.toggle('active', isActive);
      }
    });
  }
};

// --- TAB MANAGER ---
const TabManager = {
  tabs: [],
  activeTabId: null, // This is the "primary" or "left" tab when split
  splitScreenActive: false,
  rightTabId: null,

  init() {
    this.setupKeyboardShortcuts();
    this.loadTabsFromStorage();
  },

  saveTabsToStorage() {
    const tabsData = this.tabs.map(({ id, gameId, title, icon, color, pinned }) => ({ id, gameId, title, icon, color, pinned }));
    Storage.set(CONFIG.storageKeys.tabs, { tabs: tabsData, activeTabId: this.activeTabId });
  },

  loadTabsFromStorage() {
    const savedData = Storage.get(CONFIG.storageKeys.tabs);
    if (!savedData?.tabs?.length) return;

    UI.toggleModal('game-modal', true);
    savedData.tabs.forEach(tabData => {
      const game = State.getGameById(tabData.gameId);
      if (game) {
        const tab = this.createTabSilent(game, tabData.id);
        if (tabData.pinned) this.togglePinTab(tab.id, true);
      }
    });

    const targetTab = (savedData.activeTabId && this.tabs.find(t => t.id === savedData.activeTabId))
      ? savedData.activeTabId : this.tabs[0]?.id;
    if (targetTab) this.switchToTab(targetTab);
    this.updateEmptyState();
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
    const tab = { id: tabId, gameId: game.id, title: game.title, icon: game.icon, color: game.color, loading: true, pinned: false };
    this.createTabIcon(tab);
    this.createTabPanel(tab);
    this.tabs.push(tab);
    if (switchTo) this.switchToTab(tabId);
    this.loadGame(tab, game.path);
    this.saveTabsToStorage();
    this.updateEmptyState();
    return tab;
  },

  createTabIcon(tab) {
    const sidePanelTabs = document.getElementById('side-panel-tabs');
    if (!sidePanelTabs) return;

    const tabIcon = document.createElement('button');
    tabIcon.id = `tab-icon-${tab.id}`;
    tabIcon.className = `side-panel-tab${tab.loading ? ' loading' : ''}`;
    tabIcon.dataset.tabId = tab.id;
    tabIcon.dataset.color = tab.color;
    tabIcon.setAttribute('data-title', tab.title);
    tabIcon.setAttribute('role', 'tab');
    tabIcon.setAttribute('aria-selected', 'false');
    tabIcon.setAttribute('aria-label', `Switch to ${tab.title}`);
    tabIcon.draggable = true;
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

    tabIcon.addEventListener('dblclick', (e) => {
      e.preventDefault();
      this.togglePinTab(tab.id);
    });

    // Drag and Drop implementation
    tabIcon.addEventListener('dragstart', (e) => {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', tab.id);
      setTimeout(() => tabIcon.classList.add('dragging'), 0);
    });

    tabIcon.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      tabIcon.classList.add('drag-over');
    });

    tabIcon.addEventListener('dragleave', () => {
      tabIcon.classList.remove('drag-over');
    });

    tabIcon.addEventListener('drop', (e) => {
      e.preventDefault();
      tabIcon.classList.remove('drag-over');
      const draggedTabId = e.dataTransfer.getData('text/plain');
      if (draggedTabId && draggedTabId !== tab.id) {
        this.reorderTabs(draggedTabId, tab.id);
        AudioEngine.click();
      }
    });

    tabIcon.addEventListener('dragend', () => {
      tabIcon.classList.remove('dragging');
      document.querySelectorAll('.side-panel-tab').forEach(el => el.classList.remove('drag-over'));
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

  togglePinTab(tabId, forceState = null) {
    const tabIndex = this.tabs.findIndex(t => t.id === tabId);
    if (tabIndex === -1) return;

    const tab = this.tabs[tabIndex];
    tab.pinned = forceState !== null ? forceState : !tab.pinned;

    if (tab.iconElement) {
      tab.iconElement.classList.toggle('pinned', tab.pinned);
    }

    // Move pinned tabs to the front natively (but keep active state etc)
    this.reorderAllTabsByPinStatus();
    this.saveTabsToStorage();
    if (forceState === null) AudioEngine.click();
  },

  reorderAllTabsByPinStatus() {
    this.tabs.sort((a, b) => {
      if (a.pinned === b.pinned) return 0;
      return a.pinned ? -1 : 1;
    });

    const sidePanelTabs = document.getElementById('side-panel-tabs');
    if (!sidePanelTabs) return;

    // Re-append to DOM to match array order
    this.tabs.forEach(t => {
      if (t.iconElement) sidePanelTabs.appendChild(t.iconElement);
    });
  },

  reorderTabs(draggedId, targetId) {
    const draggedIndex = this.tabs.findIndex(t => t.id === draggedId);
    const targetIndex = this.tabs.findIndex(t => t.id === targetId);
    if (draggedIndex === -1 || targetIndex === -1) return;

    // Rearrange in array
    const [draggedTab] = this.tabs.splice(draggedIndex, 1);
    this.tabs.splice(targetIndex, 0, draggedTab);

    // Maintain pin rule: pinned above unpinned
    this.reorderAllTabsByPinStatus();

    this.saveTabsToStorage();
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
      if (!isActive && t.iframe) {
        // Preserve iframe but stop JS execution
        t.iframe.style.display = 'none';
      } else if (isActive) {
        t.iframe.style.display = 'block';
      }
    });

    const game = State.getGameById(tab.gameId);
    if (game) State.activeGame = game;

    if (window.location.hash !== `#${tab.gameId}`) {
      history.pushState(null, null, `#${tab.gameId}`);
    }

    tab.iconElement?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    this.updateSplitScreenClasses();
    this.saveTabsToStorage();
  },

  toggleSplitScreen() {
    if (this.tabs.length < 2) {
      // Need at least 2 tabs to split screen
      const section = document.body;
      const warning = document.createElement('div');
      warning.className = 'fixed bottom-4 left-1/2 -translate-x-1/2 bg-dark text-white px-6 py-3 rounded-xl shadow-hard z-[100] animate-pop-in font-bold text-sm flex items-center gap-3';
      warning.innerHTML = `<i data-lucide="info" class="w-5 h-5 text-blue"></i> Open at least 2 activities to use Split Screen`;
      document.body.appendChild(warning);
      Utils.refreshIcons();
      setTimeout(() => warning.remove(), 3000);
      return;
    }

    this.splitScreenActive = !this.splitScreenActive;
    AudioEngine.click();

    if (this.splitScreenActive) {
      // Find the most recently used other tab, or just the first other tab
      const otherTabs = this.tabs.filter(t => t.id !== this.activeTabId);
      this.rightTabId = otherTabs[0].id; // Simple for now: just grab the first other tab
    } else {
      this.rightTabId = null;
    }

    this.updateSplitScreenClasses();
  },

  updateEmptyState() {
    const emptyState = document.getElementById('workspace-empty-state');
    if (!emptyState) return;
    if (this.tabs.length === 0) {
      emptyState.classList.remove('hidden');
    } else {
      emptyState.classList.add('hidden');
    }
  },

  updateSplitScreenClasses() {
    const area = document.getElementById('tab-content-area');
    if (!area) return;

    if (this.splitScreenActive && this.tabs.length >= 2) {
      area.classList.add('split-mode');

      this.tabs.forEach(tab => {
        if (!tab.panel) return;

        const isLeft = tab.id === this.activeTabId;
        const isRight = tab.id === this.rightTabId;

        tab.panel.classList.toggle('split-left', isLeft);
        tab.panel.classList.toggle('split-right', isRight);

        if (isLeft || isRight) {
          tab.panel.classList.add('active');
          if (tab.iframe) tab.iframe.style.display = 'block';
        } else {
          tab.panel.classList.remove('active', 'split-left', 'split-right');
          if (tab.iframe) tab.iframe.style.display = 'none';
        }
      });
    } else {
      this.splitScreenActive = false; // Reset if tabs fell below 2
      area.classList.remove('split-mode');

      this.tabs.forEach(tab => {
        if (!tab.panel) return;
        const isActive = tab.id === this.activeTabId;
        tab.panel.classList.remove('split-left', 'split-right');
        tab.panel.classList.toggle('active', isActive);
        if (tab.iframe) tab.iframe.style.display = isActive ? 'block' : 'none';
      });
    }

    // Attempt to resize or trigger a window resize event so games adapt
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 50);
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
      this.splitScreenActive = false;
      this.activeTabId = null;
      this.updateEmptyState();
      // Auto-close workspace when no tabs remain
      this.closeModal();
      return;
    }

    if (tabId === this.rightTabId) {
      this.rightTabId = null;
      this.splitScreenActive = false;
    }

    this.saveTabsToStorage();
    if (wasActive) {
      const newIndex = Math.min(tabIndex, this.tabs.length - 1);
      this.switchToTab(this.tabs[newIndex].id);
    } else {
      this.updateSplitScreenClasses();
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

    const tabsToKeep = [];

    this.tabs.forEach(tab => {
      if (tab.pinned) {
        tabsToKeep.push(tab);
      } else {
        tab.iconElement?.remove();
        tab.panel?.remove();
      }
    });

    this.tabs = tabsToKeep;

    // If active tab was closed, switch to the last pinned one or null
    if (!this.tabs.find(t => t.id === this.activeTabId)) {
      this.activeTabId = this.tabs.length > 0 ? this.tabs[this.tabs.length - 1].id : null;
    }

    if (this.tabs.length === 0) {
      State.activeGame = null;
      Storage.remove(CONFIG.storageKeys.tabs);
      this.activeTabId = null;
      this.updateEmptyState();
    } else {
      if (this.activeTabId) this.switchToTab(this.activeTabId);
      this.saveTabsToStorage();
    }

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



  toggleSidePanelMobile() {
    AudioEngine.click();
    const panel = document.getElementById('side-panel');
    if (!panel) return;
    panel.classList.toggle('open');
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
  open(gameId, element = null) {
    AudioEngine.click();
    const game = State.getGameById(gameId);
    if (!game) return console.error(`Game not found: ${gameId}`);
    RecentGames.add(gameId);

    if (element) {
      UI.animateModalOpen(element, 'game-modal');
    } else {
      UI.toggleModal('game-modal', true);
    }

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
    if (input) {
      input.addEventListener('input', (e) => {
        Filters.setSearch(e.target.value);
      });
    }
  },

  clear() {
    const input = document.getElementById('search-input');
    if (input) {
      input.value = '';
      input.focus();
    }
    Filters.setSearch('');
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

// --- FOOTER ---
const Footer = {
  render() {
    const el = document.getElementById('footer-version');
    if (!el || !State.metadata) return;
    const version = State.metadata.version || '';
    const updated = State.metadata.lastUpdated || '';
    const parts = [];
    if (version) parts.push(`v${version}`);
    if (updated) parts.push(`Updated ${updated}`);
    el.innerHTML = parts.join('<br>');
  }
};

// --- BUG REPORT ---
const BugReport = {
  open() {
    AudioEngine.click();
    const modal = document.getElementById('bug-report-modal');
    const iframe = document.getElementById('bug-report-iframe');
    const loader = document.getElementById('bug-report-loader');

    if (!modal || !iframe) return;

    modal.classList.remove('hidden');
    modal.classList.add('flex');

    if (loader) loader.style.opacity = '1';
    iframe.src = CONFIG.helpUrl;

    iframe.onload = () => {
      if (loader) loader.style.opacity = '0';
      iframe.classList.remove('opacity-0');
      iframe.classList.add('opacity-100');
      setTimeout(() => { if (loader) loader.style.display = 'none'; }, 300);
    };
  },

  close() {
    const modal = document.getElementById('bug-report-modal');
    const iframe = document.getElementById('bug-report-iframe');
    const loader = document.getElementById('bug-report-loader');

    if (!modal || !iframe) return;

    modal.classList.add('hidden');
    modal.classList.remove('flex');
    iframe.src = 'about:blank';
    iframe.classList.add('opacity-0');
    iframe.classList.remove('opacity-100');
    if (loader) {
      loader.style.display = 'flex';
      loader.style.opacity = '1';
    }
    AudioEngine.click();
  }
};

// --- APP CONTROLLER ---
const App = {
  async init() {
    await requireAuth();
    try {
      Theme.load();
      UI.updateGreeting();
      UI.showLoading();

      // Cloud Persistence: Sync with cloud BEFORE loading games or initialization
      // This ensures pinned/recent items are up to date
      const dataChanged = await Storage.syncWithCloud();
      if (dataChanged) {
        console.log('[CloudPersistence] Local state updated from cloud. Refreshing theme...');
        Theme.load();
      }

      // Handle migration if needed
      if (typeof migrateLocalToCloud === 'function') {
        migrateLocalToCloud();
      }

      const data = await DataLoader.loadGames();
      State.setGames(data);
      // Store top-level metadata for footer
      if (data.version) State.metadata = { ...(State.metadata || {}), version: data.version, lastUpdated: data.lastUpdated };

      GameGrid.render();
      PinnedGames.render();
      RecentGames.render();
      Hero.init();
      Footer.render();
      Search.setup();
      LandingPage.init();
      ViewMode.init();

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
      toggleNotifications: () => Announcements.togglePanel(),
      returnToHome: () => TabManager.returnToHome(),
      closeAllTabs: () => TabManager.confirmCloseAllTabs(),
      confirmDelete: () => TabManager.closeAllTabsConfirmed(),
      confirmCancel: () => TabManager.cancelConfirmation(),
      closeCurrentTab: () => TabManager.closeCurrentTab(),
      reloadGame: () => TabManager.reloadCurrentTab(),
      toggleSplitScreen: () => TabManager.toggleSplitScreen(),
      toggleFocus: () => UI.toggleFocus(),
      toggleSettings: () => UI.toggleSettings(),
      toggleInfo: () => GameModal.toggleInfo(),
      openWorkspace: () => {
        AudioEngine.click();

        // Check if there are any active tabs
        if (TabManager.tabs.length === 0) {
          UI.showToast('No active tabs. Open an activity first!', 'warning', 3000);
          return;
        }

        UI.toggleModal('game-modal', true);
        TabManager.updateEmptyState();
      },

      toggleSidePanelMobile: () => TabManager.toggleSidePanelMobile(),
      filterGames: (param) => Filters.setCategory(param),
      clearRecent: () => RecentGames.clear(),
      clearSearch: () => Search.clear(),
      togglePin: (param) => { PinnedGames.toggle(param); Hero.updateStats(); },
      surpriseMe: () => Hero.surpriseMe(),
      continueGame: (param) => GameModal.open(param),
      openFeedback: () => BugReport.open(),
      openBugReport: () => BugReport.open(),
      closeBugReport: () => BugReport.close(),
      showLanding: () => LandingPage.showLanding(),
      showLibrary: () => LandingPage.showLibrary(),
      setViewMode: (param) => ViewMode.set(param)
    };

    document.addEventListener('click', (e) => {
      const pinBtn = e.target.closest('[data-action="togglePin"]');
      if (pinBtn) {
        e.stopPropagation();
        e.preventDefault();
      }

      const target = e.target.closest('[data-action]');

      const settingsContainer = document.getElementById('settings-container');
      const settingsMenu = document.getElementById('settings-menu');
      if (settingsContainer && settingsMenu && !settingsMenu.classList.contains('opacity-0')) {
        const isToggleButton = target && target.dataset.action === 'toggleSettings';
        if (!isToggleButton && (!settingsContainer.contains(e.target) || target)) {
          settingsMenu.classList.add('opacity-0', 'pointer-events-none', 'translate-y-4');
          settingsMenu.classList.remove('translate-y-0');
          const icon = settingsContainer.querySelector('[data-action="toggleSettings"] i');
          if (icon) icon.classList.remove('rotate-90');
        }
      }

      if (!target) return;
      const action = actions[target.dataset.action];
      if (action) {
        if (target.dataset.action === 'openGame') {
          action(target.dataset.param, target);
        } else {
          action(target.dataset.param);
        }
      }
    });
  }
};

// --- DISPLAY NAME EDITING ---
function initDisplayNameEditor() {
  const editBtn = document.getElementById('auth-edit-name-btn');
  const modal = document.getElementById('display-name-modal');
  const input = document.getElementById('display-name-input');
  const cancelBtn = document.getElementById('display-name-cancel');
  const saveBtn = document.getElementById('display-name-save');
  const errorEl = document.getElementById('display-name-error');
  const usernameEl = document.getElementById('auth-username');

  if (!editBtn || !modal || !input) return;

  function openModal() {
    const currentName = usernameEl?.textContent || '';
    input.value = currentName;
    errorEl.classList.add('hidden');
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
    input.focus();
    input.select();
  }

  function closeModal() {
    modal.classList.add('hidden');
    modal.style.display = 'none';
  }

  async function saveDisplayName() {
    const newName = input.value.trim();
    if (!newName) {
      errorEl.textContent = 'Please enter a display name';
      errorEl.classList.remove('hidden');
      return;
    }

    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i data-lucide="loader-2" class="w-5 h-5 animate-spin"></i> Saving...';
    lucide?.createIcons?.();

    const result = await updateDisplayName(newName);

    saveBtn.disabled = false;
    saveBtn.innerHTML = '<i data-lucide="check" class="w-5 h-5"></i> Save';
    lucide?.createIcons?.();

    if (result.error) {
      errorEl.textContent = result.error;
      errorEl.classList.remove('hidden');
    } else {
      if (usernameEl) usernameEl.textContent = newName;
      closeModal();
    }
  }

  editBtn.addEventListener('click', openModal);
  cancelBtn?.addEventListener('click', closeModal);
  saveBtn?.addEventListener('click', saveDisplayName);

  input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') saveDisplayName();
    if (e.key === 'Escape') closeModal();
  });

  modal?.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });
}

// --- AUTH INDICATOR ---
async function initAuthIndicator() {
  const signInLink = document.getElementById('auth-signin-link');
  const loggedInDiv = document.getElementById('auth-logged-in');
  const usernameEl = document.getElementById('auth-username');

  if (!signInLink || !loggedInDiv) return;

  const user = await getUser();
  if (user) {
    signInLink.classList.add('hidden');
    loggedInDiv.classList.remove('hidden');
    
    if (user.is_sandbox) {
      if (usernameEl) usernameEl.innerHTML = '<span class="flex items-center gap-2"><i data-lucide="shield-check" class="w-4 h-4 text-green"></i> Sandbox Mode</span>';
      return;
    }

    const displayName = user.user_metadata?.display_name || user.email?.split('@')[0] || 'User';
    if (usernameEl) usernameEl.textContent = displayName;

    // Check if admin and show link
    console.log('[HubAuth] Querying role for UID:', user.id);
    const { data: profile, error: roleError } = await db
      .from('profiles').select('role').eq('id', user.id).single();
    
    if (roleError) {
      console.error('[HubAuth] ERROR CODE:', roleError.code);
      console.error('[HubAuth] ERROR MESSAGE:', roleError.message);
      console.error('[HubAuth] FULL ERROR OBJECT:', roleError);
    }
    
    console.log('[HubAuth] RAW PROFILE DATA:', profile);
    console.log('[HubAuth] FINAL DETECTED ROLE:', profile?.role);

    if (profile?.role === 'admin') {
      console.log("[HubAuth] Success! Admin access granted.");
      const adminLink = document.getElementById('auth-admin-link');
      if (adminLink) adminLink.classList.remove('hidden');
    }
  } else {
    console.log("is user")
    signInLink.classList.remove('hidden');
    loggedInDiv.classList.add('hidden');
  }
}

// --- EXPORTS & INITIALIZATION ---
window.App = App;
window.AudioEngine = AudioEngine;
window.TabManager = TabManager;
window.filterGames = (category) => Filters.setCategory(category);

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    App.init();
    initAuthIndicator();
    initDisplayNameEditor();
  });
} else {
  App.init();
  initAuthIndicator();
  initDisplayNameEditor();
}
// --- MOBILE UI HELPERS ---
const MobileUI = {
  openSidebar() {
    const s = document.getElementById('sidebar-nav');
    const b = document.getElementById('sidebar-backdrop');
    if (s && b) {
      s.classList.remove('hidden');
      setTimeout(() => s.classList.remove('-translate-x-full'), 10);
      b.classList.add('active');
    }
  },
  closeSidebar() {
    const s = document.getElementById('sidebar-nav');
    const b = document.getElementById('sidebar-backdrop');
    if (s && b) {
      s.classList.add('-translate-x-full');
      setTimeout(() => s.classList.add('hidden'), 300);
      b.classList.remove('active');
    }
  }
};