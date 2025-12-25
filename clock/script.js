// --- PERFORMANCE-OPTIMIZED TIME TOOLS ---

// DOM Cache - Store frequently accessed elements
const DOM = {
    cache: new Map(),
    get(id) {
        if (!this.cache.has(id)) {
            this.cache.set(id, document.getElementById(id));
        }
        return this.cache.get(id);
    },
    clearCache() {
        this.cache.clear();
    }
};

// --- CONSTANTS ---
const CONSTANTS = {
    DAYS: ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'],
    MONTHS: ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'],
    MONTH_NAMES: ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"],
    CLOCK_MARKERS: 60,
    CIRCLE_CIRCUMFERENCE: 283,
    STOPWATCH_DISPLAY_FPS: 30,
    TIMER_UPDATE_INTERVAL: 1000,
    CALENDAR_GRID_SIZE: 42
};

// --- GLOBAL STATE ---
const state = {
    currentTool: 'clock',
    clock: { is24Hour: false, isAnalog: false, animFrame: null },
    stopwatch: { startTime: 0, elapsed: 0, running: false, animFrame: null, laps: [] },
    timer: { timeLeft: 300, initial: 300, running: false, interval: null, mode: 'calm' },
    calendar: { date: new Date(), marked: {}, selected: null },
    audio: { ctx: null, oscillatorPool: [] }
};

// --- UTILITY FUNCTIONS ---
const utils = {
    padZero: (num, length = 2) => String(num).padStart(length, '0'),
    
    formatTime: (ms) => {
        const m = utils.padZero(Math.floor(ms / 60000));
        const s = utils.padZero(Math.floor(ms / 1000) % 60);
        const ms2 = utils.padZero(Math.floor((ms % 1000) / 10));
        return `${m}:${s}.${ms2}`;
    },
    
    getDateString: (date) => `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`,
    
    getTodayString: () => utils.getDateString(new Date()),
    
    parseTimeInputs: (minId, secId) => {
        const m = parseInt(DOM.get(minId).value) || 0;
        const s = parseInt(DOM.get(secId).value) || 0;
        return (m * 60) + s;
    },
    
    setTimeInputs: (minId, secId, totalSeconds) => {
        const m = utils.padZero(Math.floor(totalSeconds / 60));
        const s = utils.padZero(totalSeconds % 60);
        DOM.get(minId).value = m;
        DOM.get(secId).value = s;
        return { m, s };
    },
    
    // Batched DOM updates using DocumentFragment
    batchUpdate(parent, htmlArray) {
        const fragment = document.createDocumentFragment();
        const temp = document.createElement('div');
        temp.innerHTML = htmlArray.join('');
        while (temp.firstChild) {
            fragment.appendChild(temp.firstChild);
        }
        parent.innerHTML = '';
        parent.appendChild(fragment);
    }
};

// --- OPTIMIZED AUDIO ENGINE ---
const audio = {
    init() {
        if (!state.audio.ctx) {
            state.audio.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
    },
    
    playTone(freq, type, duration, volume = 0.05) {
        if (!state.audio.ctx) return;
        
        const osc = state.audio.ctx.createOscillator();
        const gain = state.audio.ctx.createGain();
        
        osc.frequency.value = freq;
        osc.type = type;
        gain.gain.setValueAtTime(volume, state.audio.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, state.audio.ctx.currentTime + duration);
        
        osc.connect(gain);
        gain.connect(state.audio.ctx.destination);
        osc.start();
        osc.stop(state.audio.ctx.currentTime + duration);
    },
    
    playTick() {
        const isBomb = state.timer.mode === 'bomb';
        audio.playTone(isBomb ? 800 : 400, isBomb ? 'square' : 'sine', 0.05);
    },
    
    playChime() {
        audio.playTone(523.25, 'sine', 1.5, 0.2);
    }
};

// --- OPTIMIZED CLOCK MODULE (using RAF) ---
const clock = {
    elements: null,
    
    cacheElements() {
        if (!this.elements) {
            this.elements = {
                time: DOM.get('clock-time'),
                secDig: DOM.get('clock-sec-dig'),
                ampm: DOM.get('clock-ampm'),
                date: DOM.get('clock-date'),
                dateAnalog: DOM.get('clock-date-analog'),
                handSec: DOM.get('hand-sec'),
                handMin: DOM.get('hand-min'),
                handHour: DOM.get('hand-hour'),
                btnFormat: DOM.get('clock-btn-format'),
                btnView: DOM.get('clock-btn-view'),
                digital: DOM.get('clock-digital'),
                analog: DOM.get('clock-analog')
            };
        }
        return this.elements;
    },
    
    initFace() {
        const markers = DOM.get('clock-face-markers');
        if (!markers) return;
        
        const fragment = document.createDocumentFragment();
        for (let i = 0; i < CONSTANTS.CLOCK_MARKERS; i++) {
            const isHour = i % 5 === 0;
            const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
            
            line.setAttribute("x1", "50");
            line.setAttribute("y1", "4");
            line.setAttribute("x2", "50");
            line.setAttribute("y2", String(4 + (isHour ? 7 : 2)));
            line.setAttribute("stroke", "#cbd5e1");
            line.setAttribute("stroke-width", isHour ? "2" : "1");
            line.setAttribute("transform", `rotate(${i * 6} 50 50)`);
            
            fragment.appendChild(line);
        }
        markers.appendChild(fragment);
    },
    
    startLoop() {
        const animate = () => {
            clock.update();
            state.clock.animFrame = requestAnimationFrame(animate);
        };
        animate();
    },
    
    update() {
        const now = new Date();
        const els = this.cacheElements();
        
        const h = now.getHours();
        const m = now.getMinutes();
        const s = now.getSeconds();
        
        // Only update if values changed (optimization)
        const displayHour = state.clock.is24Hour ? utils.padZero(h) : (h % 12 || 12);
        const displayMin = utils.padZero(m);
        const displaySec = utils.padZero(s);
        
        const newTime = `${displayHour}:${displayMin}`;
        if (els.time.innerText !== newTime) {
            els.time.innerText = newTime;
        }
        
        if (els.secDig.innerText !== displaySec) {
            els.secDig.innerText = displaySec;
        }
        
        // Update AM/PM
        const ampm = h >= 12 ? 'PM' : 'AM';
        if (els.ampm.innerText !== ampm) {
            els.ampm.innerText = ampm;
        }
        els.ampm.style.display = state.clock.is24Hour ? 'none' : 'block';
        
        // Update date (less frequently - only when it changes)
        const dateStr = `${CONSTANTS.DAYS[now.getDay()]}, ${CONSTANTS.MONTHS[now.getMonth()]} ${now.getDate()}`;
        if (els.date.innerText !== dateStr) {
            els.date.innerText = dateStr;
            if (els.dateAnalog) els.dateAnalog.innerText = dateStr;
        }
        
        // Analog clock updates (use transforms for GPU acceleration)
        if (state.clock.isAnalog && els.handSec) {
            const secRatio = s / 60;
            const minRatio = (m + secRatio) / 60;
            const hourRatio = ((h % 12) + minRatio) / 12;
            
            els.handSec.setAttribute('transform', `rotate(${secRatio * 360} 50 50)`);
            els.handMin.setAttribute('transform', `rotate(${minRatio * 360} 50 50)`);
            els.handHour.setAttribute('transform', `rotate(${hourRatio * 360} 50 50)`);
        }
    },
    
    toggleFormat() {
        state.clock.is24Hour = !state.clock.is24Hour;
        const els = this.cacheElements();
        els.btnFormat.innerText = state.clock.is24Hour ? '24H' : '12H';
        clock.update();
    },
    
    toggleView() {
        state.clock.isAnalog = !state.clock.isAnalog;
        const els = this.cacheElements();
        
        if (state.clock.isAnalog) {
            els.digital.classList.add('hidden');
            els.analog.classList.remove('hidden');
            els.analog.classList.add('flex');
            els.btnView.innerText = "DIGITAL";
            els.btnView.classList.add('bg-blue', 'text-white', 'border-blue');
        } else {
            els.analog.classList.add('hidden');
            els.analog.classList.remove('flex');
            els.digital.classList.remove('hidden');
            els.btnView.innerText = "ANALOG";
            els.btnView.classList.remove('bg-blue', 'text-white', 'border-blue');
        }
    }
};

// --- OPTIMIZED STOPWATCH (RAF instead of setInterval) ---
const stopwatch = {
    elements: null,
    lastDisplayUpdate: 0,
    
    cacheElements() {
        if (!this.elements) {
            this.elements = {
                display: DOM.get('sw-display'),
                ms: DOM.get('sw-ms'),
                ring: DOM.get('sw-ring'),
                btn: DOM.get('sw-btn-main'),
                indicator: DOM.get('sw-indicator'),
                laps: DOM.get('sw-laps')
            };
        }
        return this.elements;
    },
    
    toggle() {
        const sw = state.stopwatch;
        const els = this.cacheElements();
        
        if (sw.running) {
            cancelAnimationFrame(sw.animFrame);
            sw.running = false;
            els.btn.innerHTML = '<i data-lucide="play" class="w-8 h-8 fill-current ml-1"></i>';
            els.btn.classList.replace('bg-orange', 'bg-blue');
            els.indicator.classList.remove('bg-green', 'animate-pulse');
            els.indicator.classList.add('bg-slate-300');
        } else {
            sw.startTime = performance.now() - sw.elapsed;
            sw.running = true;
            stopwatch.animate();
            els.btn.innerHTML = '<i data-lucide="pause" class="w-8 h-8 fill-current"></i>';
            els.btn.classList.replace('bg-blue', 'bg-orange');
            els.indicator.classList.remove('bg-slate-300');
            els.indicator.classList.add('bg-green', 'animate-pulse');
        }
        lucide.createIcons();
    },
    
    animate() {
        const sw = state.stopwatch;
        const now = performance.now();
        
        if (sw.running) {
            sw.elapsed = now - sw.startTime;
            
            // Throttle display updates to ~30fps for performance
            if (now - this.lastDisplayUpdate > 1000 / CONSTANTS.STOPWATCH_DISPLAY_FPS) {
                stopwatch.updateDisplay();
                this.lastDisplayUpdate = now;
            }
            
            sw.animFrame = requestAnimationFrame(() => stopwatch.animate());
        }
    },
    
    updateDisplay() {
        const sw = state.stopwatch;
        const els = this.cacheElements();
        
        const m = utils.padZero(Math.floor(sw.elapsed / 60000));
        const s = utils.padZero(Math.floor(sw.elapsed / 1000) % 60);
        const ms = utils.padZero(Math.floor((sw.elapsed % 1000) / 10));
        
        els.display.innerText = `${m}:${s}`;
        els.ms.innerText = `.${ms}`;
        
        // Ring animation (60s loop) - use transform for GPU acceleration
        const sec = (sw.elapsed / 1000) % 60;
        const offset = CONSTANTS.CIRCLE_CIRCUMFERENCE * (1 - sec / 60);
        els.ring.style.strokeDashoffset = offset;
    },
    
    reset() {
        const sw = state.stopwatch;
        if (sw.running) stopwatch.toggle();
        
        sw.elapsed = 0;
        sw.laps = [];
        stopwatch.updateDisplay();
        
        const els = this.cacheElements();
        els.laps.innerHTML = 
            '<div class="flex flex-col items-center justify-center h-full text-slate-400 gap-2 opacity-60">' +
            '<i data-lucide="ghost" class="w-6 h-6"></i>' +
            '<span class="text-xs font-bold">NO LAPS RECORDED</span></div>';
        
        els.ring.style.strokeDashoffset = 0;
        lucide.createIcons();
    },
    
    lap() {
        const sw = state.stopwatch;
        if (sw.elapsed === 0) return;
        
        const prevLapTotal = sw.laps.length > 0 ? sw.laps[0].total : 0;
        const split = sw.elapsed - prevLapTotal;
        
        sw.laps.unshift({
            total: sw.elapsed,
            split: split,
            id: sw.laps.length + 1
        });
        
        const els = this.cacheElements();
        const lapHtml = `
            <div class="flex justify-between items-center py-2 border-b border-slate-200 last:border-0 hover:bg-white px-2 rounded-lg transition-colors">
                <span class="font-bold text-slate-400 w-8 text-xs">#${sw.laps.length}</span>
                <span class="font-mono text-dark font-bold text-base">${utils.formatTime(sw.elapsed)}</span>
                <span class="text-[0.6rem] text-blue font-bold bg-blue/10 px-2 py-1 rounded">+${utils.formatTime(split)}</span>
            </div>`;
        
        if (sw.laps.length === 1) els.laps.innerHTML = '';
        els.laps.innerHTML = lapHtml + els.laps.innerHTML;
    }
};

// --- OPTIMIZED TIMER MODULE ---
const timer = {
    elements: null,
    
    cacheElements() {
        if (!this.elements) {
            this.elements = {
                card: DOM.get('timer-card'),
                btnStart: DOM.get('timer-btn-start'),
                zenVis: DOM.get('timer-visual-zen'),
                rushVis: DOM.get('timer-visual-rush'),
                btnCalm: DOM.get('btn-mode-calm'),
                btnBomb: DOM.get('btn-mode-bomb'),
                minInput: DOM.get('t-min'),
                secInput: DOM.get('t-sec'),
                rushDisplay: DOM.get('t-rush-display'),
                ringZen: DOM.get('timer-ring-zen'),
                fuseRush: DOM.get('timer-fuse-rush')
            };
        }
        return this.elements;
    },
    
    setMode(mode) {
        state.timer.mode = mode;
        const els = this.cacheElements();
        
        // Reset button states
        els.btnCalm.className = 'px-6 py-2 rounded-lg text-sm font-bold uppercase transition-all flex items-center gap-2 border-2 border-transparent';
        els.btnBomb.className = 'px-6 py-2 rounded-lg text-sm font-bold uppercase transition-all flex items-center gap-2 border-2 border-transparent';
        
        if (mode === 'calm') {
            els.btnCalm.classList.add('bg-green', 'text-white', 'shadow-hard-sm');
            els.zenVis.classList.remove('hidden', 'opacity-0');
            els.rushVis.classList.add('hidden', 'opacity-0');
            els.btnStart.className = "btn-chunky w-24 h-24 rounded-3xl bg-green border-4 border-dark text-white flex items-center justify-center mx-4 hover:scale-105 transition-transform shadow-hard-lg";
            els.card.classList.remove('border-orange');
        } else {
            els.btnBomb.classList.add('bg-orange', 'text-white', 'shadow-hard-sm');
            els.zenVis.classList.add('hidden', 'opacity-0');
            els.rushVis.classList.remove('hidden');
            setTimeout(() => els.rushVis.classList.remove('opacity-0'), 10);
            els.btnStart.className = "btn-chunky w-24 h-24 rounded-3xl bg-orange border-4 border-dark text-white flex items-center justify-center mx-4 hover:scale-105 transition-transform shadow-hard-lg";
            els.card.classList.add('border-orange');
        }
        
        timer.updateInputs();
    },
    
    adjust(sec) {
        const total = utils.parseTimeInputs('t-min', 't-sec') + sec;
        state.timer.timeLeft = Math.max(0, total);
        state.timer.initial = Math.max(state.timer.initial, state.timer.timeLeft);
        timer.updateInputs();
    },
    
    updateInputs() {
        const t = state.timer;
        t.timeLeft = Math.max(0, t.timeLeft);
        
        const { m, s } = utils.setTimeInputs('t-min', 't-sec', t.timeLeft);
        
        const els = this.cacheElements();
        if (els.rushDisplay) els.rushDisplay.innerText = `${m}:${s}`;
    },
    
    toggle() {
        audio.init();
        
        if (state.timer.running) {
            timer.stop();
        } else {
            timer.start();
        }
    },
    
    start() {
        const t = state.timer;
        t.timeLeft = utils.parseTimeInputs('t-min', 't-sec');
        
        if (t.timeLeft <= 0) return;
        
        t.initial = Math.max(t.initial, t.timeLeft);
        t.running = true;
        
        const els = this.cacheElements();
        els.btnStart.innerHTML = '<i data-lucide="pause" class="w-12 h-12 fill-current"></i>';
        
        t.interval = setInterval(() => {
            t.timeLeft--;
            t.timeLeft = Math.max(0, t.timeLeft);
            timer.updateInputs();
            
            if (t.timeLeft > 0) audio.playTick();
            
            timer.updateVisuals();
            
            if (t.timeLeft === 0) timer.finish();
        }, CONSTANTS.TIMER_UPDATE_INTERVAL);
        
        lucide.createIcons();
    },
    
    updateVisuals() {
        const t = state.timer;
        const pct = t.timeLeft / t.initial;
        const els = this.cacheElements();
        
        if (t.mode === 'calm' && els.ringZen) {
            els.ringZen.style.strokeDashoffset = CONSTANTS.CIRCLE_CIRCUMFERENCE * (1 - pct);
        } else if (els.fuseRush) {
            els.fuseRush.style.strokeDashoffset = 100 * (1 - pct);
            
            if (t.timeLeft <= 10) {
                els.card.classList.add('shake-hard');
            } else {
                els.card.classList.remove('shake-hard');
            }
        }
    },
    
    stop() {
        const t = state.timer;
        clearInterval(t.interval);
        t.running = false;
        
        const els = this.cacheElements();
        if (els.btnStart) {
            els.btnStart.innerHTML = '<i data-lucide="play" class="w-12 h-12 fill-current ml-1"></i>';
            lucide.createIcons();
        }
    },
    
    reset() {
        timer.stop();
        
        state.timer.timeLeft = 300;
        utils.setTimeInputs('t-min', 't-sec', 300);
        timer.updateInputs();
        
        const els = this.cacheElements();
        if (els.ringZen) els.ringZen.style.strokeDashoffset = 0;
        if (els.fuseRush) els.fuseRush.style.strokeDashoffset = 0;
        els.card.classList.remove('shake-hard');
    },
    
    finish() {
        timer.stop();
        const els = this.cacheElements();
        els.card.classList.remove('shake-hard');
        
        const overlayId = state.timer.mode === 'bomb' ? 'explosion-overlay' : 'zen-overlay';
        const overlay = DOM.get(overlayId);
        
        if (overlay) {
            overlay.style.display = 'flex';
            setTimeout(() => overlay.style.opacity = '1', 10);
        }
        
        audio.playChime();
    },
    
    resetOverlay() {
        ['explosion-overlay', 'zen-overlay'].forEach(id => {
            const overlay = DOM.get(id);
            if (overlay) {
                overlay.style.opacity = '0';
                setTimeout(() => overlay.style.display = 'none', 300);
            }
        });
        
        timer.reset();
    }
};

// --- OPTIMIZED CALENDAR (Event Delegation + Debounced Save) ---
const calendar = {
    elements: null,
    saveTimeout: null,
    
    cacheElements() {
        if (!this.elements) {
            this.elements = {
                grid: DOM.get('cal-grid'),
                monthYear: DOM.get('cal-month-year'),
                counter: DOM.get('cal-counter-display')
            };
        }
        return this.elements;
    },
    
    load() {
        try {
            state.calendar.marked = JSON.parse(localStorage.getItem('hub_calendar')) || {};
        } catch {
            state.calendar.marked = {};
        }
    },
    
    // Debounced save to avoid excessive localStorage writes
    save() {
        clearTimeout(this.saveTimeout);
        this.saveTimeout = setTimeout(() => {
            localStorage.setItem('hub_calendar', JSON.stringify(state.calendar.marked));
        }, 500);
    },
    
    navigate(delta) {
        state.calendar.date.setMonth(state.calendar.date.getMonth() + delta);
        calendar.render();
    },
    
    render() {
        const cal = state.calendar;
        const els = this.cacheElements();
        
        // Update header
        const monthYear = `${CONSTANTS.MONTH_NAMES[cal.date.getMonth()]} ${cal.date.getFullYear()}`;
        els.monthYear.innerText = monthYear;
        
        const year = cal.date.getFullYear();
        const month = cal.date.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const startOffset = (firstDay + 6) % 7;
        
        const todayStr = utils.getTodayString();
        
        // Build HTML array for batch update
        const cellsHTML = [];
        for (let i = 0; i < CONSTANTS.CALENDAR_GRID_SIZE; i++) {
            const cellDate = new Date(year, month, 1 - startOffset + i);
            cellsHTML.push(calendar.createCellHTML(cellDate, month, todayStr));
        }
        
        // Batch DOM update
        els.grid.innerHTML = cellsHTML.join('');
    },
    
    createCellHTML(cellDate, currentMonth, todayStr) {
        const dNum = cellDate.getDate();
        const dMonth = cellDate.getMonth();
        const dateStr = utils.getDateString(cellDate);
        
        const isCurrMonth = dMonth === currentMonth;
        const isToday = dateStr === todayStr;
        const isSelected = state.calendar.selected === dateStr;
        const isMarked = state.calendar.marked[dateStr];
        
        let classes = 'cal-day rounded-lg border-2 flex flex-col items-center justify-center font-bold text-lg relative overflow-hidden shadow-sm';
        
        if (isCurrMonth) {
            classes += ' bg-white border-slate-200 text-dark';
        } else {
            classes += ' bg-slate-50 border-transparent text-slate-300 empty';
        }
        
        if (isToday) {
            classes = 'cal-day rounded-lg border-2 flex flex-col items-center justify-center font-bold text-lg relative overflow-hidden shadow-sm bg-blue text-white border-dark shadow-hard-sm ring-4 ring-orange/50 ring-offset-2 z-10';
        }
        
        if (isSelected) {
            classes += ' ring-2 ring-orange z-10';
        }
        
        const dotHTML = isMarked ? `<div class="absolute bottom-1 w-1.5 h-1.5 rounded-full ${isToday ? 'bg-white' : 'bg-pink'}"></div>` : '';
        
        return `<div class="${classes}" data-date="${dateStr}" data-time="${cellDate.getTime()}">${dNum}${dotHTML}</div>`;
    },
    
    // Event delegation for better performance
    setupEventDelegation() {
        const els = this.cacheElements();
        els.grid.addEventListener('click', (e) => {
            const cell = e.target.closest('.cal-day');
            if (!cell || cell.classList.contains('empty')) return;
            
            const dateStr = cell.dataset.date;
            const cellTime = parseInt(cell.dataset.time);
            const cellDate = new Date(cellTime);
            
            if (e.altKey) {
                // Toggle mark
                if (state.calendar.marked[dateStr]) {
                    delete state.calendar.marked[dateStr];
                } else {
                    state.calendar.marked[dateStr] = true;
                }
                calendar.save();
                calendar.render();
            } else {
                // Select date
                state.calendar.selected = dateStr;
                calendar.render();
                calendar.updateCounter(cellDate);
            }
        });
    },
    
    updateCounter(cellDate) {
        const cellDayStart = new Date(cellDate).setHours(0, 0, 0, 0);
        const todayDayStart = new Date().setHours(0, 0, 0, 0);
        const diffDays = Math.ceil((cellDayStart - todayDayStart) / (1000 * 60 * 60 * 24));
        
        let text = "TODAY";
        if (diffDays > 0) {
            text = `${diffDays} DAY${diffDays > 1 ? 'S' : ''} FROM NOW`;
        } else if (diffDays < 0) {
            const absDiff = Math.abs(diffDays);
            text = `${absDiff} DAY${absDiff > 1 ? 'S' : ''} AGO`;
        }
        
        const dateStr = cellDate.toISOString().split('T')[0];
        const els = this.cacheElements();
        els.counter.innerHTML = `
            <span class="text-orange font-bold uppercase tracking-wider">${text}</span>
            <span class="text-slate-400 text-xs ml-2 border-l pl-2 border-slate-300">${dateStr}</span>
        `;
    }
};

// --- NAVIGATION ---
function switchTool(toolId) {
    // Update sidebar
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    const navBtn = DOM.get(`nav-${toolId}`);
    if (navBtn) navBtn.classList.add('active');
    
    // Hide all sections
    document.querySelectorAll('section').forEach(el => {
        el.classList.add('hidden');
        el.classList.remove('flex');
    });
    
    // Show target section
    const target = DOM.get(`tool-${toolId}`);
    if (target) {
        target.classList.remove('hidden');
        target.classList.add('flex');
    }
    
    state.currentTool = toolId;
    lucide.createIcons();
}

// --- INPUT VALIDATION ---
function setupInputValidation() {
    document.querySelectorAll('input[type="number"]').forEach(input => {
        input.addEventListener('change', function() {
            let val = parseInt(this.value);
            if (isNaN(val) || val < 0) val = 0;
            if (val > 99) val = 99;
            this.value = utils.padZero(val);
        });
    });
}

// --- INITIALIZATION ---
window.onload = function() {
    lucide.createIcons();
    
    // Initialize modules
    clock.initFace();
    clock.startLoop(); // Use RAF instead of setInterval
    
    calendar.load();
    calendar.setupEventDelegation();
    calendar.render();
    
    // Setup input validation
    setupInputValidation();
    
    // Switch to default tool
    switchTool('clock');
};

// --- GLOBAL FUNCTION BINDINGS ---
window.clockToggleFormat = () => clock.toggleFormat();
window.clockToggleView = () => clock.toggleView();
window.swToggle = () => stopwatch.toggle();
window.swReset = () => stopwatch.reset();
window.swLap = () => stopwatch.lap();
window.timerSetMode = (mode) => timer.setMode(mode);
window.timerAdjust = (sec) => timer.adjust(sec);
window.timerToggle = () => timer.toggle();
window.timerReset = () => timer.reset();
window.resetTimerOverlay = () => timer.resetOverlay();
window.calNav = (delta) => calendar.navigate(delta);