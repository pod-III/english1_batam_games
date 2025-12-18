// --- CONSTANTS ---
const CONSTANTS = {
    DAYS: ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'],
    MONTHS: ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'],
    MONTH_NAMES: ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"],
    CLOCK_MARKERS: 60,
    CIRCLE_CIRCUMFERENCE: 283,
    STOPWATCH_UPDATE_INTERVAL: 10,
    TIMER_UPDATE_INTERVAL: 1000,
    CALENDAR_GRID_SIZE: 42
};

// --- GLOBAL STATE ---
const state = {
    currentTool: 'clock',
    clock: { is24Hour: false, isAnalog: false },
    stopwatch: { startTime: 0, elapsed: 0, running: false, interval: null, laps: [] },
    timer: { timeLeft: 300, initial: 300, running: false, interval: null, mode: 'calm' },
    calendar: { date: new Date(), marked: {}, selected: null },
    audio: { ctx: null }
};

// --- UTILITY FUNCTIONS ---
const utils = {
    padZero: (num, length = 2) => String(num).padStart(length, '0'),
    
    formatTime: (ms) => {
        const d = new Date(ms);
        const m = utils.padZero(d.getUTCMinutes());
        const s = utils.padZero(d.getUTCSeconds());
        const ms2 = utils.padZero(Math.floor(d.getUTCMilliseconds() / 10));
        return `${m}:${s}.${ms2}`;
    },
    
    getDateString: (date) => `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`,
    
    getTodayString: () => {
        const today = new Date();
        return utils.getDateString(today);
    },
    
    parseTimeInputs: (minId, secId) => {
        const m = parseInt(document.getElementById(minId).value) || 0;
        const s = parseInt(document.getElementById(secId).value) || 0;
        return (m * 60) + s;
    },
    
    setTimeInputs: (minId, secId, totalSeconds) => {
        const m = utils.padZero(Math.floor(totalSeconds / 60));
        const s = utils.padZero(totalSeconds % 60);
        document.getElementById(minId).value = m;
        document.getElementById(secId).value = s;
        return { m, s };
    }
};

// --- AUDIO ENGINE ---
const audio = {
    init: () => {
        if (!state.audio.ctx) {
            state.audio.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
    },
    
    playTone: (freq, type, duration, volume = 0.05) => {
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
    
    playTick: () => {
        const isBomb = state.timer.mode === 'bomb';
        audio.playTone(isBomb ? 800 : 400, isBomb ? 'square' : 'sine', 0.05);
    },
    
    playChime: () => audio.playTone(523.25, 'sine', 1.5, 0.2)
};

// --- CLOCK MODULE ---
const clock = {
    initFace: () => {
        const markers = document.getElementById('clock-face-markers');
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
        markers.innerHTML = '';
        markers.appendChild(fragment);
    },
    
    update: () => {
        const now = new Date();
        clock.updateDigital(now);
        clock.updateAnalog(now);
    },
    
    updateDigital: (now) => {
        const h = now.getHours();
        const m = utils.padZero(now.getMinutes());
        const s = utils.padZero(now.getSeconds());
        
        const displayHour = state.clock.is24Hour 
            ? utils.padZero(h) 
            : (h % 12 || 12);
        
        const timeEl = document.getElementById('clock-time');
        if (!timeEl) return;
        
        timeEl.innerText = `${displayHour}:${m}`;
        document.getElementById('clock-sec-dig').innerText = s;
        
        const ampmEl = document.getElementById('clock-ampm');
        ampmEl.innerText = h >= 12 ? 'PM' : 'AM';
        ampmEl.style.display = state.clock.is24Hour ? 'none' : 'block';
        
        clock.updateDate(now);
    },
    
    updateDate: (now) => {
        const dateStr = `${CONSTANTS.DAYS[now.getDay()]}, ${CONSTANTS.MONTHS[now.getMonth()]} ${now.getDate()}`;
        document.getElementById('clock-date').innerText = dateStr;
        
        const anaDate = document.getElementById('clock-date-analog');
        if (anaDate) anaDate.innerText = dateStr;
    },
    
    updateAnalog: (now) => {
        const secRatio = now.getSeconds() / 60;
        const minRatio = (now.getMinutes() + secRatio) / 60;
        const hourRatio = (now.getHours() % 12 + minRatio) / 12;
        
        const hands = {
            sec: document.getElementById('hand-sec'),
            min: document.getElementById('hand-min'),
            hour: document.getElementById('hand-hour')
        };
        
        if (hands.sec) hands.sec.setAttribute('transform', `rotate(${secRatio * 360} 50 50)`);
        if (hands.min) hands.min.setAttribute('transform', `rotate(${minRatio * 360} 50 50)`);
        if (hands.hour) hands.hour.setAttribute('transform', `rotate(${hourRatio * 360} 50 50)`);
    },
    
    toggleFormat: () => {
        state.clock.is24Hour = !state.clock.is24Hour;
        document.getElementById('clock-btn-format').innerText = state.clock.is24Hour ? '24H' : '12H';
        clock.update();
    },
    
    toggleView: () => {
        state.clock.isAnalog = !state.clock.isAnalog;
        const dig = document.getElementById('clock-digital');
        const ana = document.getElementById('clock-analog');
        const btn = document.getElementById('clock-btn-view');
        
        if (state.clock.isAnalog) {
            dig.classList.add('hidden');
            ana.classList.remove('hidden');
            ana.classList.add('flex');
            btn.innerText = "DIGITAL";
            btn.classList.add('bg-blue', 'text-white', 'border-blue');
        } else {
            ana.classList.add('hidden');
            ana.classList.remove('flex');
            dig.classList.remove('hidden');
            btn.innerText = "ANALOG";
            btn.classList.remove('bg-blue', 'text-white', 'border-blue');
        }
    }
};

// --- STOPWATCH MODULE ---
const stopwatch = {
    toggle: () => {
        const sw = state.stopwatch;
        const btn = document.getElementById('sw-btn-main');
        const indicator = document.getElementById('sw-indicator');
        
        if (sw.running) {
            clearInterval(sw.interval);
            sw.running = false;
            btn.innerHTML = '<i data-lucide="play" class="w-8 h-8 fill-current ml-1"></i>';
            btn.classList.replace('bg-orange', 'bg-blue');
            indicator.classList.remove('bg-green', 'animate-pulse');
            indicator.classList.add('bg-slate-300');
        } else {
            sw.startTime = Date.now() - sw.elapsed;
            sw.interval = setInterval(stopwatch.tick, CONSTANTS.STOPWATCH_UPDATE_INTERVAL);
            sw.running = true;
            btn.innerHTML = '<i data-lucide="pause" class="w-8 h-8 fill-current"></i>';
            btn.classList.replace('bg-blue', 'bg-orange');
            indicator.classList.remove('bg-slate-300');
            indicator.classList.add('bg-green', 'animate-pulse');
        }
        lucide.createIcons();
    },
    
    tick: () => {
        state.stopwatch.elapsed = Date.now() - state.stopwatch.startTime;
        stopwatch.updateDisplay();
    },
    
    updateDisplay: () => {
        const sw = state.stopwatch;
        const date = new Date(sw.elapsed);
        const m = utils.padZero(date.getUTCMinutes());
        const s = utils.padZero(date.getUTCSeconds());
        const ms = utils.padZero(Math.floor(date.getUTCMilliseconds() / 10));
        
        document.getElementById('sw-display').innerText = `${m}:${s}`;
        document.getElementById('sw-ms').innerText = `.${ms}`;
        
        // Ring animation (60s loop)
        const sec = (sw.elapsed / 1000) % 60;
        const offset = CONSTANTS.CIRCLE_CIRCUMFERENCE * (1 - sec / 60);
        document.getElementById('sw-ring').style.strokeDashoffset = offset;
    },
    
    reset: () => {
        const sw = state.stopwatch;
        if (sw.running) stopwatch.toggle();
        
        sw.elapsed = 0;
        sw.laps = [];
        stopwatch.updateDisplay();
        
        document.getElementById('sw-laps').innerHTML = 
            '<div class="flex flex-col items-center justify-center h-full text-slate-400 gap-2 opacity-60">' +
            '<i data-lucide="ghost" class="w-6 h-6"></i>' +
            '<span class="text-xs font-bold">NO LAPS RECORDED</span></div>';
        
        document.getElementById('sw-ring').style.strokeDashoffset = 0;
        lucide.createIcons();
    },
    
    lap: () => {
        const sw = state.stopwatch;
        if (sw.elapsed === 0) return;
        
        const prevLapTotal = sw.laps.length > 0 ? sw.laps[0].total : 0;
        const split = sw.elapsed - prevLapTotal;
        
        sw.laps.unshift({
            total: sw.elapsed,
            split: split,
            id: sw.laps.length + 1
        });
        
        const container = document.getElementById('sw-laps');
        const lapHtml = `
            <div class="flex justify-between items-center py-2 border-b border-slate-200 last:border-0 hover:bg-white px-2 rounded-lg transition-colors">
                <span class="font-bold text-slate-400 w-8 text-xs">#${sw.laps.length}</span>
                <span class="font-mono text-dark font-bold text-base">${utils.formatTime(sw.elapsed)}</span>
                <span class="text-[0.6rem] text-blue font-bold bg-blue/10 px-2 py-1 rounded">+${utils.formatTime(split)}</span>
            </div>`;
        
        if (sw.laps.length === 1) container.innerHTML = '';
        container.innerHTML = lapHtml + container.innerHTML;
    }
};

// --- TIMER MODULE ---
const timer = {
    setMode: (mode) => {
        state.timer.mode = mode;
        const elements = {
            card: document.getElementById('timer-card'),
            btnStart: document.getElementById('timer-btn-start'),
            zenVis: document.getElementById('timer-visual-zen'),
            rushVis: document.getElementById('timer-visual-rush'),
            btnCalm: document.getElementById('btn-mode-calm'),
            btnBomb: document.getElementById('btn-mode-bomb')
        };
        
        if (!elements.zenVis || !elements.rushVis) return;
        
        // Reset button states
        elements.btnCalm.classList.remove('bg-green', 'text-white', 'shadow-hard-sm');
        elements.btnBomb.classList.remove('bg-orange', 'text-white', 'shadow-hard-sm');
        
        if (mode === 'calm') {
            elements.btnCalm.classList.add('bg-green', 'text-white', 'shadow-hard-sm');
            elements.zenVis.classList.remove('hidden', 'opacity-0');
            elements.rushVis.classList.add('hidden', 'opacity-0');
            elements.rushVis.classList.remove('flex');
            elements.btnStart.className = "btn-chunky w-24 h-24 rounded-3xl bg-green border-4 border-dark text-white flex items-center justify-center mx-4 hover:scale-105 transition-transform shadow-hard-lg";
            elements.card.classList.remove('border-orange');
        } else {
            elements.btnBomb.classList.add('bg-orange', 'text-white', 'shadow-hard-sm');
            elements.zenVis.classList.add('hidden', 'opacity-0');
            elements.rushVis.classList.remove('hidden');
            setTimeout(() => elements.rushVis.classList.remove('opacity-0'), 10);
            elements.rushVis.classList.add('flex');
            elements.btnStart.className = "btn-chunky w-24 h-24 rounded-3xl bg-orange border-4 border-dark text-white flex items-center justify-center mx-4 hover:scale-105 transition-transform shadow-hard-lg";
            elements.card.classList.add('border-orange');
        }
        
        timer.updateInputs();
    },
    
    adjust: (sec) => {
        const total = utils.parseTimeInputs('t-min', 't-sec') + sec;
        state.timer.timeLeft = Math.max(0, total);
        state.timer.initial = Math.max(state.timer.initial, state.timer.timeLeft);
        timer.updateInputs();
    },
    
    updateInputs: () => {
        const t = state.timer;
        t.timeLeft = Math.max(0, t.timeLeft);
        
        const { m, s } = utils.setTimeInputs('t-min', 't-sec', t.timeLeft);
        
        const rushDisp = document.getElementById('t-rush-display');
        if (rushDisp) rushDisp.innerText = `${m}:${s}`;
    },
    
    toggle: () => {
        audio.init();
        
        if (state.timer.running) {
            timer.stop();
        } else {
            timer.start();
        }
    },
    
    start: () => {
        const t = state.timer;
        t.timeLeft = utils.parseTimeInputs('t-min', 't-sec');
        
        if (t.timeLeft <= 0) return;
        
        t.initial = Math.max(t.initial, t.timeLeft);
        t.running = true;
        
        const btn = document.getElementById('timer-btn-start');
        btn.innerHTML = '<i data-lucide="pause" class="w-12 h-12 fill-current"></i>';
        
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
    
    updateVisuals: () => {
        const t = state.timer;
        const pct = t.timeLeft / t.initial;
        
        if (t.mode === 'calm') {
            const ring = document.getElementById('timer-ring-zen');
            if (ring) ring.style.strokeDashoffset = CONSTANTS.CIRCLE_CIRCUMFERENCE * (1 - pct);
        } else {
            const fuse = document.getElementById('timer-fuse-rush');
            if (fuse) fuse.style.strokeDashoffset = 100 * (1 - pct);
            
            const card = document.getElementById('timer-card');
            if (t.timeLeft <= 10) {
                card.classList.add('shake-hard');
            } else {
                card.classList.remove('shake-hard');
            }
        }
    },
    
    stop: () => {
        const t = state.timer;
        clearInterval(t.interval);
        t.running = false;
        
        const btn = document.getElementById('timer-btn-start');
        if (btn) btn.innerHTML = '<i data-lucide="play" class="w-12 h-12 fill-current ml-1"></i>';
        
        lucide.createIcons();
    },
    
    reset: () => {
        timer.stop();
        
        state.timer.timeLeft = 300;
        utils.setTimeInputs('t-min', 't-sec', 300);
        timer.updateInputs();
        
        const ring = document.getElementById('timer-ring-zen');
        if (ring) ring.style.strokeDashoffset = 0;
        
        const fuse = document.getElementById('timer-fuse-rush');
        if (fuse) fuse.style.strokeDashoffset = 0;
        
        document.getElementById('timer-card').classList.remove('shake-hard');
    },
    
    finish: () => {
        timer.stop();
        document.getElementById('timer-card').classList.remove('shake-hard');
        
        const overlayId = state.timer.mode === 'bomb' ? 'explosion-overlay' : 'zen-overlay';
        const overlay = document.getElementById(overlayId);
        
        if (overlay) {
            const overlayButton = overlay.querySelector('button');
            if (overlayButton) overlayButton.onclick = timer.resetOverlay;
            
            overlay.style.display = 'flex';
            setTimeout(() => overlay.style.opacity = '1', 10);
        }
        
        audio.playChime();
    },
    
    resetOverlay: () => {
        ['explosion-overlay', 'zen-overlay'].forEach(id => {
            const overlay = document.getElementById(id);
            if (overlay) {
                overlay.style.opacity = '0';
                setTimeout(() => overlay.style.display = 'none', 300);
            }
        });
        
        timer.reset();
    }
};

// --- CALENDAR MODULE ---
const calendar = {
    load: () => {
        try {
            state.calendar.marked = JSON.parse(localStorage.getItem('hub_calendar')) || {};
        } catch {
            state.calendar.marked = {};
        }
    },
    
    save: () => {
        localStorage.setItem('hub_calendar', JSON.stringify(state.calendar.marked));
    },
    
    navigate: (delta) => {
        state.calendar.date.setMonth(state.calendar.date.getMonth() + delta);
        calendar.render();
    },
    
    render: () => {
        const cal = state.calendar;
        const grid = document.getElementById('cal-grid');
        grid.innerHTML = '';
        
        // Update header
        const monthYear = `${CONSTANTS.MONTH_NAMES[cal.date.getMonth()]} ${cal.date.getFullYear()}`;
        document.getElementById('cal-month-year').innerText = monthYear;
        
        const year = cal.date.getFullYear();
        const month = cal.date.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const startOffset = (firstDay + 6) % 7; // Monday start
        
        const todayStr = utils.getTodayString();
        const fragment = document.createDocumentFragment();
        
        for (let i = 0; i < CONSTANTS.CALENDAR_GRID_SIZE; i++) {
            const cellDate = new Date(year, month, 1 - startOffset + i);
            const cell = calendar.createCell(cellDate, month, todayStr);
            fragment.appendChild(cell);
        }
        
        grid.appendChild(fragment);
    },
    
    createCell: (cellDate, currentMonth, todayStr) => {
        const dNum = cellDate.getDate();
        const dMonth = cellDate.getMonth();
        const dYear = cellDate.getFullYear();
        const dateStr = utils.getDateString(cellDate);
        
        const isCurrMonth = dMonth === currentMonth;
        const isToday = dateStr === todayStr;
        const isSelected = state.calendar.selected === dateStr;
        const isMarked = state.calendar.marked[dateStr];
        
        const cell = document.createElement('div');
        cell.className = 'cal-day rounded-lg border-2 flex flex-col items-center justify-center font-bold text-lg relative overflow-hidden shadow-sm';
        
        // Apply styling
        if (isCurrMonth) {
            cell.classList.add('bg-white', 'border-slate-200', 'text-dark');
        } else {
            cell.classList.add('bg-slate-50', 'border-transparent', 'text-slate-300', 'empty');
        }
        
        if (isToday) {
            cell.classList.remove('bg-white', 'border-slate-200', 'text-dark', 'bg-slate-50', 'border-transparent', 'text-slate-300');
            cell.classList.add('bg-blue', 'text-white', 'border-dark', 'shadow-hard-sm', 'ring-4', 'ring-orange/50', 'ring-offset-2', 'z-10');
        }
        
        if (isSelected) {
            cell.classList.add('ring-2', 'ring-orange', 'z-10');
        }
        
        if (isMarked) {
            const dot = document.createElement('div');
            dot.className = `absolute bottom-1 w-1.5 h-1.5 rounded-full ${isToday ? 'bg-white' : 'bg-pink'}`;
            cell.appendChild(dot);
        }
        
        cell.innerText = dNum;
        cell.onclick = (e) => calendar.handleClick(e, dateStr, cellDate);
        
        return cell;
    },
    
    handleClick: (e, dateStr, cellDate) => {
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
    },
    
    updateCounter: (cellDate) => {
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
        document.getElementById('cal-counter-display').innerHTML = `
            <span class="text-orange font-bold uppercase tracking-wider">${text}</span>
            <span class="text-slate-400 text-xs ml-2 border-l pl-2 border-slate-300">${dateStr}</span>
        `;
    }
};

// --- NAVIGATION ---
function switchTool(toolId) {
    // Update sidebar
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    const navBtn = document.getElementById(`nav-${toolId}`);
    if (navBtn) navBtn.classList.add('active');
    
    // Hide all sections
    document.querySelectorAll('section').forEach(el => {
        el.classList.add('hidden');
        el.classList.remove('flex');
    });
    
    // Show target section
    const target = document.getElementById(`tool-${toolId}`);
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
    calendar.load();
    calendar.render();
    
    // Start clock updates
    setInterval(clock.update, 500);
    clock.update();
    
    // Setup input validation
    setupInputValidation();
    
    // Switch to default tool
    switchTool('clock');
};

// --- GLOBAL FUNCTION BINDINGS (for onclick handlers) ---
window.clockToggleFormat = clock.toggleFormat;
window.clockToggleView = clock.toggleView;
window.swToggle = stopwatch.toggle;
window.swReset = stopwatch.reset;
window.swLap = stopwatch.lap;
window.timerSetMode = timer.setMode;
window.timerAdjust = timer.adjust;
window.timerToggle = timer.toggle;
window.timerReset = timer.reset;
window.resetTimerOverlay = timer.resetOverlay;
window.calNav = calendar.navigate;