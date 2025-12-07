// --- GLOBAL STATE ---
let currentTool = 'clock';

// --- CLOCK STATE ---
let clockInterval;
let is24Hour = false;
let isAnalog = false;
let secondsLoop = 0;
let lastSeconds = -1;

// --- STOPWATCH STATE ---
let swStartTime = 0;
let swElapsed = 0;
let swRunning = false;
let swInterval;
let swLaps = [];

// --- TIMER STATE ---
let tTimeLeft = 300;
let tInitial = 300;
let tRunning = false;
let tInterval;
let tMode = 'calm';
let audioCtx;

// --- CALENDAR STATE ---
let calDate = new Date();
let calDisplayDate = new Date();
let calMarked = {};
let calSelected = null;

// --- UTILS ---
function formatDateLocal(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

// --- INITIALIZATION ---
window.onload = function() {
    lucide.createIcons();
    
    // Init Clock immediately to prevent FOUC
    initClock();
    clockInterval = setInterval(updateClock, 1000);
    
    // Init Calendar
    loadCalData();
    renderCalendar();
    
    // Init Timer Visuals
    timerSetMode('calm');

    // Reveal clock after init
    setTimeout(() => {
        document.getElementById('clock-digital').classList.remove('loading-hide');
    }, 50);
};

// --- ROUTER ---
function switchTool(toolId) {
    // Update Nav UI
    document.querySelectorAll('.btn-nav').forEach(b => b.classList.remove('active'));
    document.getElementById(`nav-${toolId}`).classList.add('active');

    // Hide all tools
    const tools = ['clock', 'stopwatch', 'timer', 'calendar'];
    tools.forEach(t => {
        const el = document.getElementById(`tool-${t}`);
        el.style.opacity = '0';
        el.style.pointerEvents = 'none';
        el.style.transform = 'translateY(1rem)'; // Reset slide position
    });

    // Show Target Tool
    setTimeout(() => {
        const target = document.getElementById(`tool-${toolId}`);
        target.style.opacity = '1';
        target.style.pointerEvents = 'auto';
        target.style.transform = 'translateY(0)';
    }, 100);

    // Handle Backgrounds & Body Theme
    const bgDefault = document.getElementById('bg-default');
    const bgTimerCalm = document.getElementById('bg-timer-calm');
    const bgTimerBomb = document.getElementById('bg-timer-bomb');
    const body = document.body;

    // Reset all BGs
    bgDefault.style.opacity = '0';
    bgTimerCalm.style.opacity = '0';
    bgTimerBomb.style.opacity = '0';

    if (toolId === 'timer') {
        if(tMode === 'calm') {
            bgTimerCalm.style.opacity = '1';
            body.style.backgroundColor = '#f0fdf4'; // Light green tint
        } else {
            bgTimerBomb.style.opacity = '1';
            body.style.backgroundColor = '#fff7ed'; // Light orange tint
        }
    } else {
        bgDefault.style.opacity = '1';
        body.style.backgroundColor = '#F8FAFC'; // Default Slate-50
    }
    currentTool = toolId;
}

// --- CLOCK LOGIC ---
function initClock() {
    const markers = document.getElementById('clock-face-markers');
    markers.innerHTML = '';
    for (let i = 0; i < 60; i++) {
        const angle = i * 6;
        const isHour = i % 5 === 0;
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("x1", "50"); line.setAttribute("y1", "4"); line.setAttribute("x2", "50"); 
        line.setAttribute("y2", 4 + (isHour ? 7 : 3)); 
        line.setAttribute("stroke", isHour ? "#cbd5e1" : "#e2e8f0");
        line.setAttribute("stroke-width", isHour ? "2" : "1");
        line.setAttribute("stroke-linecap", "round");
        line.setAttribute("transform", `rotate(${angle} 50 50)`);
        markers.appendChild(line);
    }
    updateClock();
}

function updateClock() {
    const now = new Date();
    let h = now.getHours();
    const m = String(now.getMinutes()).padStart(2,'0');
    const s = String(now.getSeconds()).padStart(2,'0');
    
    let ampm = '';
    let dh = h;
    if (!is24Hour) {
        ampm = h >= 12 ? 'PM' : 'AM';
        dh = h % 12 || 12;
    } else {
        dh = String(dh).padStart(2,'0');
    }
    
    // DOM Updates
    const timeEl = document.getElementById('clock-time');
    if(timeEl) {
        timeEl.innerText = `${dh}:${m}`;
        document.getElementById('clock-sec-dig').innerText = s;
        const ampmEl = document.getElementById('clock-ampm');
        ampmEl.innerText = ampm;
        ampmEl.style.display = is24Hour ? 'none' : 'inline-block';
        
        const days = ['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'];
        const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
        document.getElementById('clock-date').innerText = `${days[now.getDay()]}, ${months[now.getMonth()]} ${now.getDate()}`;
    }

    // Analog Logic
    const sec = now.getSeconds();
    const min = now.getMinutes();
    const hr = now.getHours();
    // Smoother loop handling for seconds hand
    if (lastSeconds === 59 && sec === 0) secondsLoop++;
    lastSeconds = sec;
    const totalSeconds = sec + (secondsLoop * 60);
    
    const sRatio = totalSeconds / 60;
    const mRatio = (min + sec/60) / 60;
    const hRatio = (hr % 12 + mRatio) / 12;

    document.getElementById('hand-sec-group').style.transform = `rotate(${sRatio * 360}deg)`;
    document.getElementById('hand-min').style.transform = `rotate(${mRatio * 360}deg)`;
    document.getElementById('hand-hour').style.transform = `rotate(${hRatio * 360}deg)`;
}

function clockToggleFormat() {
    is24Hour = !is24Hour;
    document.getElementById('clock-btn-format').innerText = is24Hour ? '24H' : '12H';
    updateClock();
}

function clockToggleView() {
    isAnalog = !isAnalog;
    const dig = document.getElementById('clock-digital');
    const ana = document.getElementById('clock-analog');
    const btn = document.getElementById('clock-btn-view');
    
    if(isAnalog) {
        dig.style.opacity = '0'; 
        setTimeout(() => dig.classList.add('hidden'), 200);
        ana.classList.remove('hidden');
        setTimeout(() => ana.style.opacity = '1', 50);
        btn.innerText = "Digital";
        btn.classList.add('bg-blue-100', 'text-blue-600');
    } else {
        ana.style.opacity = '0';
        setTimeout(() => ana.classList.add('hidden'), 200);
        dig.classList.remove('hidden');
        setTimeout(() => dig.style.opacity = '1', 50);
        btn.innerText = "Analog";
        btn.classList.remove('bg-blue-100', 'text-blue-600');
    }
}

// --- STOPWATCH LOGIC ---
function swToggle() {
    if (swRunning) swStop();
    else swStart();
}
function swStart() {
    swRunning = true;
    swStartTime = Date.now() - swElapsed;
    swInterval = setInterval(swUpdate, 10);
    const btn = document.getElementById('sw-btn-main');
    btn.classList.replace('bg-blue-500', 'bg-orange-400');
    btn.innerHTML = '<i data-lucide="pause" class="w-8 h-8 fill-current"></i>';
    lucide.createIcons();
}
function swStop() {
    swRunning = false;
    clearInterval(swInterval);
    const btn = document.getElementById('sw-btn-main');
    btn.classList.replace('bg-orange-400', 'bg-blue-500');
    btn.innerHTML = '<i data-lucide="play" class="w-8 h-8 fill-current ml-1"></i>';
    lucide.createIcons();
}
function swReset() {
    swStop();
    swElapsed = 0;
    swLaps = [];
    swUpdateDisplay(0);
    document.getElementById('sw-laps').innerHTML = '<div class="text-slate-400 italic py-8 text-center text-xs">Press Flag to record laps</div>';
    document.getElementById('sw-ring').style.strokeDashoffset = 0;
}
function swUpdate() {
    swElapsed = Date.now() - swStartTime;
    swUpdateDisplay(swElapsed);
}
function swUpdateDisplay(ms) {
    const date = new Date(ms);
    const m = String(date.getUTCMinutes()).padStart(2, '0');
    const s = String(date.getUTCSeconds()).padStart(2, '0');
    const mils = String(Math.floor(date.getUTCMilliseconds() / 10)).padStart(2, '0');
    document.getElementById('sw-display').innerText = `${m}:${s}`;
    document.getElementById('sw-ms').innerText = `.${mils}`;
    
    const sec = (ms / 1000) % 60;
    const dash = 289;
    const offset = dash - (sec / 60) * dash;
    document.getElementById('sw-ring').style.strokeDashoffset = offset;
}
function swLap() {
    if (!swRunning && swElapsed === 0) return;
    const lapTime = swElapsed;
    const prevLapTime = swLaps.length > 0 ? swLaps[0].total : 0;
    const split = lapTime - prevLapTime;
    swLaps.unshift({ total: lapTime, split: split, index: swLaps.length + 1 });
    renderLaps();
}
function renderLaps() {
    const container = document.getElementById('sw-laps');
    container.innerHTML = swLaps.map(lap => {
        const total = formatMs(lap.total);
        const split = formatMs(lap.split);
        return `<div class="lap-row flex justify-between items-center py-2 border-b border-white/50 last:border-0"><span class="text-slate-400 font-mono text-xs w-8">#${lap.index}</span><span class="text-slate-600 font-mono text-sm">+ ${split}</span><span class="font-bold text-slate-800 font-mono">${total}</span></div>`;
    }).join('');
}
function formatMs(ms) {
    const date = new Date(ms);
    const m = String(date.getUTCMinutes()).padStart(2, '0');
    const s = String(date.getUTCSeconds()).padStart(2, '0');
    const mils = String(Math.floor(date.getUTCMilliseconds() / 10)).padStart(2, '0');
    return `${m}:${s}.${mils}`;
}

// --- TIMER LOGIC ---
function initAudio() {
    if(!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if(audioCtx.state === 'suspended') audioCtx.resume();
    document.getElementById('audio-indicator').style.opacity = '1';
}
function playSound(type) {
    if(!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    if(type === 'tick') {
        osc.frequency.value = tTimeLeft <= 10 ? 800 : 400;
        osc.type = 'square';
        gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
        osc.start(); osc.stop(audioCtx.currentTime + 0.1);
    } else if (type === 'chime') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime+0.1);
        // Simple chord effect
        const osc2 = audioCtx.createOscillator();
        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(554, audioCtx.currentTime); // C#
        osc2.frequency.exponentialRampToValueAtTime(1108, audioCtx.currentTime+0.1);

        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 2);
        
        osc.connect(gain);
        osc2.connect(gain);
        osc.start(); osc.stop(audioCtx.currentTime + 2);
        osc2.start(); osc2.stop(audioCtx.currentTime + 2);
        
        gain.connect(audioCtx.destination);
        return; // Custom connect handled above
    }
    osc.connect(gain); gain.connect(audioCtx.destination);
}
function timerSetMode(mode) {
    tMode = mode;
    timerStop();
    const btnC = document.getElementById('btn-mode-calm');
    const btnB = document.getElementById('btn-mode-bomb');
    const display = document.getElementById('timer-display-container');
    const vis = document.getElementById('timer-visual');

    const bgTimerCalm = document.getElementById('bg-timer-calm');
    const bgTimerBomb = document.getElementById('bg-timer-bomb');
    
    // Switch Backgrounds
    if(currentTool === 'timer') {
        document.getElementById('bg-default').style.opacity = '0';
        if(mode === 'calm') {
            bgTimerCalm.style.opacity = '1';
            bgTimerBomb.style.opacity = '0';
            document.body.style.backgroundColor = '#f0fdf4';
        } else {
            bgTimerCalm.style.opacity = '0';
            bgTimerBomb.style.opacity = '1';
            document.body.style.backgroundColor = '#fff7ed';
        }
    }

    if(mode === 'calm') {
        btnC.className = "px-5 py-2 rounded-full text-sm font-bold transition-all flex items-center gap-2 bg-green-500 text-white shadow-md transform scale-105";
        btnB.className = "px-5 py-2 rounded-full text-sm font-bold transition-all flex items-center gap-2 text-slate-500 hover:bg-white/60";
        display.classList.remove('digital-font', 'text-red-500');
        vis.innerHTML = `<svg class="w-full h-full zen-circle drop-shadow-lg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="45" fill="none" stroke="#E2E8F0" stroke-width="6"/><circle cx="50" cy="50" r="45" fill="none" stroke="${getComputedStyle(document.documentElement).getPropertyValue('--color-green')}" stroke-width="6" stroke-dasharray="283" stroke-dashoffset="0" id="t-progress" stroke-linecap="round" transform="rotate(-90 50 50)"/></svg><i data-lucide="leaf" class="absolute text-green-400 w-10 h-10 opacity-80"></i>`;
    } else {
        btnB.className = "px-5 py-2 rounded-full text-sm font-bold transition-all flex items-center gap-2 bg-orange-500 text-white shadow-md transform scale-105";
        btnC.className = "px-5 py-2 rounded-full text-sm font-bold transition-all flex items-center gap-2 text-slate-500 hover:bg-white/60";
        display.classList.add('digital-font');
        vis.innerHTML = `<svg class="w-full h-full drop-shadow-2xl" viewBox="0 0 100 100"><path d="M50 20 Q 60 5, 80 15" fill="none" stroke="#64748b" stroke-width="3"/><line x1="80" y1="15" x2="80" y2="15" stroke="#ef4444" stroke-width="4" id="t-fuse" stroke-linecap="round"/><circle cx="50" cy="60" r="32" fill="#334155"/><circle cx="58" cy="50" r="6" fill="rgba(255,255,255,0.1)"/><text x="50" y="70" font-size="24" text-anchor="middle" fill="rgba(255,255,255,0.8)" style="font-family:sans-serif">☠</text></svg>`;
    }
    lucide.createIcons();
    timerUpdateDisplay();
}
function timerUpdateInputs() {
     let m = parseInt(document.getElementById('t-min').value) || 0;
     let s = parseInt(document.getElementById('t-sec').value) || 0;
     tTimeLeft = (m*60) + s;
     tInitial = tTimeLeft > 0 ? tTimeLeft : 300;
}
function timerUpdateDisplay(fromTimerLoop = false) {
     const m = Math.floor(tTimeLeft/60);
     const s = tTimeLeft%60;
     const minEl = document.getElementById('t-min');
     const secEl = document.getElementById('t-sec');
     if(fromTimerLoop || (document.activeElement !== minEl && document.activeElement !== secEl)) {
         minEl.value = String(m).padStart(2,'0');
         secEl.value = String(s).padStart(2,'0');
     }
     const pct = Math.max(0, tTimeLeft / tInitial);
     if (tMode === 'calm') {
         const circle = document.getElementById('t-progress');
         if(circle) circle.style.strokeDashoffset = 283 * (1 - pct);
     } else {
         const fuse = document.getElementById('t-fuse');
         if(fuse) {
             fuse.setAttribute('x2', 80 - (1-pct)*30);
             fuse.setAttribute('y2', 15 + (1-pct)*5);
         }
         const cont = document.getElementById('timer-container');
         const disp = document.getElementById('timer-display-container');
         if(tTimeLeft <= 10 && tRunning) {
             disp.classList.add('text-red-500');
             cont.classList.add('shake-mild');
         } else {
             disp.classList.remove('text-red-500');
             cont.classList.remove('shake-mild');
         }
     }
}
function timerToggle() {
    initAudio();
    if(tRunning) timerStop(); else timerStart();
}
function timerStart() {
    timerUpdateInputs();
    if(tTimeLeft <= 0) return;
    tRunning = true;
    const btn = document.getElementById('timer-btn-start');
    btn.innerHTML = '<i data-lucide="pause" class="w-8 h-8 fill-current"></i>';
    btn.classList.replace('bg-blue-500', 'bg-orange-400');
    lucide.createIcons();
    document.getElementById('timer-status').innerText = tMode === 'calm' ? 'FLOWING...' : 'FUSE LIT!';
    
    tInterval = setInterval(() => {
        tTimeLeft--;
        timerUpdateDisplay(true);
        if(tMode === 'bomb') playSound('tick');
        if(tTimeLeft <= 0) {
            timerStop();
            if(tMode === 'bomb') {
                document.getElementById('explosion-overlay').style.display = 'flex';
            } else {
                playSound('chime');
                document.getElementById('timer-status').innerText = 'COMPLETE';
            }
        }
    }, 1000);
}
function timerStop() {
    tRunning = false;
    clearInterval(tInterval);
    const btn = document.getElementById('timer-btn-start');
    btn.innerHTML = '<i data-lucide="play" class="w-8 h-8 fill-current ml-1"></i>';
    btn.classList.replace('bg-orange-400', 'bg-blue-500');
    lucide.createIcons();
    document.getElementById('timer-status').innerText = 'PAUSED';
    document.getElementById('timer-container').classList.remove('shake-mild');
}
function timerReset() {
    timerStop();
    tTimeLeft = tInitial;
    timerUpdateDisplay(true);
    document.getElementById('timer-status').innerText = 'READY';
}
function timerAdjust(sec) {
    timerUpdateInputs();
    tTimeLeft += sec;
    if(tTimeLeft < 0) tTimeLeft = 0;
    if(tTimeLeft > tInitial) tInitial = tTimeLeft;
    timerUpdateDisplay(true);
}

// --- CALENDAR LOGIC ---
function loadCalData() {
    try { calMarked = JSON.parse(localStorage.getItem('hub_calendar')) || {}; } 
    catch { calMarked = {}; }
}
function saveCalData() {
    localStorage.setItem('hub_calendar', JSON.stringify(calMarked));
}
function calNav(delta) {
    calDisplayDate.setMonth(calDisplayDate.getMonth() + delta);
    renderCalendar();
}
function renderCalendar() {
    const grid = document.getElementById('cal-grid');
    grid.innerHTML = '';
    
    const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    document.getElementById('cal-month-year').innerText = `${monthNames[calDisplayDate.getMonth()]} ${calDisplayDate.getFullYear()}`;

    const year = calDisplayDate.getFullYear();
    const month = calDisplayDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const startOffset = (firstDay + 6) % 7; // Mon=0
    
    const cursor = new Date(year, month, 1 - startOffset);
    const todayStr = formatDateLocal(new Date());

    for(let i=0; i<42; i++) {
        const dateStr = formatDateLocal(cursor);
        const isCurrMonth = cursor.getMonth() === month;
        const dNum = cursor.getDate();
        
        const cell = document.createElement('div');
        cell.className = 'day-cell';
        if(!isCurrMonth) cell.classList.add('other-month');
        cell.innerText = dNum;
        
        if(isCurrMonth) {
            if(dateStr === todayStr) cell.classList.add('current-day');
            if(calMarked[dateStr]) {
                const dot = document.createElement('div');
                dot.className = 'marker-dot';
                cell.appendChild(dot);
            }
            if(calSelected === dateStr) cell.classList.add('day-selected');

            cell.onclick = (e) => {
                // Animation
                cell.style.transform = 'scale(0.9)';
                setTimeout(() => cell.style.transform = '', 100);

                if(e.altKey) {
                    if(calMarked[dateStr]) delete calMarked[dateStr];
                    else calMarked[dateStr] = true;
                    saveCalData();
                    renderCalendar();
                } else {
                    calSelected = dateStr;
                    renderCalendar();
                    calUpdateCounter();
                }
            };
        }
        grid.appendChild(cell);
        cursor.setDate(cursor.getDate() + 1);
    }
}
function calUpdateCounter() {
    const disp = document.getElementById('cal-counter-display');
    if(!calSelected) {
        disp.innerHTML = `<span class="text-slate-400 italic text-sm">Select a date above to calculate days</span><span class="text-xs text-slate-300 mt-1">(Alt + Click to mark dates)</span>`;
        return;
    }
    const target = new Date(calSelected);
    const today = new Date();
    today.setHours(0,0,0,0); target.setHours(0,0,0,0);
    const diff = Math.round((target - today) / (1000*60*60*24));
    
    let msg = '';
    if(diff === 0) msg = `<div class="animate-pop"><span class="text-xs font-bold text-slate-400 uppercase block mb-1">Target Date</span><span class="text-green-500 font-bold text-3xl">Today</span></div>`;
    else if(diff > 0) msg = `<div class="animate-pop"><span class="text-xs font-bold text-slate-400 uppercase block mb-1">Days Remaining</span><span class="text-blue-500 font-bold text-3xl">${diff}</span><span class="text-slate-400 ml-1">days</span></div>`;
    else msg = `<div class="animate-pop"><span class="text-xs font-bold text-slate-400 uppercase block mb-1">Days Since</span><span class="text-orange-500 font-bold text-3xl">${Math.abs(diff)}</span><span class="text-slate-400 ml-1">days ago</span></div>`;
    
    disp.innerHTML = msg;
}