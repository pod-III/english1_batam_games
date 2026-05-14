const rain = document.getElementById('rain');
for (let i = 0; i < 60; i++) {
    let d = document.createElement('div');
    d.className = 'drop';
    d.style.left = Math.random() * 100 + '%';
    d.style.animationDuration = (Math.random() * 0.5 + 0.5) + 's';
    d.style.animationDelay = Math.random() + 's';
    rain.appendChild(d);
}

// -- MODIFIED: DB is now empty initially --
let DB = {};

// -- NEW: Fetch Data & Build Menu --
async function initGame() {
    try {
        const response = await fetch('./cases.json');
        if (!response.ok) throw new Error("Failed to load cases");
        DB = await response.json();
        renderCaseMenu();
    } catch (err) {
        console.error(err);
        document.querySelector('.case-list').innerHTML = `<p style="color:var(--noir-red)">ERROR: Could not decrypt archives.<br>${err.message}</p>`;
    }
}

// -- NEW: Generate Menu UI from JSON --
function renderCaseMenu() {
    const list = document.querySelector('.case-list');
    list.innerHTML = ''; // Clear loading state or hardcoded items

    Object.keys(DB).forEach(key => {
        const c = DB[key];
        // Default values for robustness if JSON is missing fields
        const subtitle = c.subtitle || "Unclassified";
        const lvlClass = c.lvlClass || "lvl-1";
        const lvlLabel = c.lvlLabel || "UNK";

        const btn = document.createElement('div');
        btn.className = 'case-btn';
        btn.onclick = () => loadCase(key);
        btn.innerHTML = `
            <strong>${c.title}</strong><br><small>${subtitle}</small>
            <div class="level ${lvlClass}">${lvlLabel}</div>
        `;
        list.appendChild(btn);
    });
}

// Initialize on load
document.addEventListener('DOMContentLoaded', initGame);

let activeCase = null;
let time = 600;
let strikes = 0;
let gameOn = false;
let timerInt, autoInt;
let sound = true;

const SFX = {
    ctx: null,
    init() { if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)(); },
    play(f, t, l) {
        if (!sound || !this.ctx) return;
        let o = this.ctx.createOscillator(), g = this.ctx.createGain();
        o.type = t; o.frequency.value = f;
        o.connect(g); g.connect(this.ctx.destination);
        o.start(); g.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + l);
        o.stop(this.ctx.currentTime + l);
    },
    warn() { this.play(100, 'sawtooth', 0.4); },
    click() { this.play(800, 'sine', 0.05); },
    beep() { this.play(2000, 'square', 0.1); },
    win() { this.play(600, 'sine', 0.2); setTimeout(() => this.play(900, 'sine', 0.4), 150); }
};

function toggleMute() { sound = !sound; document.getElementById('soundBtn').innerText = sound ? "SND: ON" : "SND: OFF"; }

function loadCase(id) {
    if (!DB[id]) return; // Safety check

    SFX.init();
    if (SFX.ctx.state === 'suspended') SFX.ctx.resume();

    activeCase = DB[id];
    gameOn = true;
    time = 600; strikes = 0;

    document.getElementById('startModal').style.display = 'none';
    document.getElementById('endModal').style.display = 'none';
    document.getElementById('cTitle').innerText = activeCase.title;
    document.getElementById('cDiff').innerText = activeCase.diff;
    document.getElementById('cBrief').innerText = activeCase.brief;

    // Reset Tabs
    tab(document.querySelector('.tabs .tab'), 'brief');

    log("CASE LOADED: " + activeCase.title);

    let evH = '';
    activeCase.ev.forEach(e => {
        let r = (Math.random() * 4 - 2).toFixed(1);
        evH += `<div class="doc" id="${e.id}" style="transform:rotate(${r}deg)">
                    <div class="tape"></div><h3>${e.name}</h3><p>${e.desc}</p>
                    <div class="censored">${e.hidden}</div>
                    <div class="actions"><button class="stamp-btn btn-reveal" onclick="force('${e.id}','${e.name}')">FORCE DECRYPT (-90s)</button></div>
                </div>`;
    });
    document.getElementById('evGrid').innerHTML = evH;

    let susH = '';
    activeCase.sus.forEach(s => {
        let r = (Math.random() * 4 - 2).toFixed(1);
        susH += `<div class="polaroid" id="${s.id}" style="transform:rotate(${r}deg)">
                    <div class="tape"></div><div class="photo">?</div>
                    <div class="name-tag">${s.name} <small>(${s.role})</small></div>
                    <div class="censored">${s.hidden}</div>
                    <div class="actions">
                        <button class="stamp-btn btn-reveal" onclick="force('${s.id}','${s.name}')">BG CHECK (-90s)</button>
                        <button class="stamp-btn" onclick="accuse('${s.name}')" style="color:#8a0b0b; border-color:#8a0b0b">ISSUE WARRANT</button>
                    </div>
                </div>`;
    });
    document.getElementById('susGrid').innerHTML = susH;

    updateHUD();
    if (timerInt) clearInterval(timerInt);
    timerInt = setInterval(tick, 1000);
    if (autoInt) clearInterval(autoInt);
    autoInt = setInterval(autoReveal, 60000);
}

function tick() {
    if (!gameOn) return;
    time--;
    updateHUD();
    if (time <= 0) gameOver(false, "TIME EXPIRED");
}

function updateHUD() {
    let m = Math.floor(time / 60).toString().padStart(2, '0');
    let s = (time % 60).toString().padStart(2, '0');
    let tEl = document.getElementById('timer');
    tEl.innerText = m + ":" + s;
    tEl.className = time < 60 ? "timer-stamp critical" : "timer-stamp";

    document.getElementById('x1').className = strikes >= 1 ? "x-mark active" : "x-mark";
    document.getElementById('x2').className = strikes >= 2 ? "x-mark active" : "x-mark";
}

function force(id, name) {
    if (!gameOn) return;
    let el = document.getElementById(id);
    if (el.classList.contains('revealed')) return;

    time -= 90;
    updateHUD();
    shake();
    SFX.warn();
    log("PENALTY: -90s");
    reveal(id, name, false);
}

function reveal(id, name, auto) {
    let el = document.getElementById(id);
    if (!el) return;
    el.classList.add('revealed');
    log(auto ? "NEW INTEL: " + name : "DECRYPTED: " + name);
    if (auto) SFX.beep();
}

function autoReveal() {
    if (!gameOn) return;
    let hidden = document.querySelectorAll('.doc:not(.revealed), .polaroid:not(.revealed)');
    if (hidden.length > 0) {
        let t = hidden[Math.floor(Math.random() * hidden.length)];
        let n = t.querySelector('h3') ? t.querySelector('h3').innerText : t.querySelector('.name-tag').innerText;
        reveal(t.id, n, true);
    }
}

function accuse(name) {
    if (!gameOn) return;
    if (name.toLowerCase().includes(activeCase.culprit)) {
        gameOver(true);
    } else {
        strikes++;
        shake();
        SFX.warn();
        updateHUD();
        if (strikes >= 2) gameOver(false, "EXCESSIVE ERRORS. FIRED.");
        else {
            time -= 60;
            updateHUD();
            log("WARRANT DENIED. STRIKE " + strikes);
        }
    }
}

function gameOver(win, reason) {
    gameOn = false;
    clearInterval(timerInt);
    clearInterval(autoInt);

    let modal = document.getElementById('endModal');
    let stamp = document.getElementById('endStamp');
    let text = document.getElementById('endText');

    if (win) {
        SFX.win();
        stamp.innerText = "SOLVED";
        stamp.className = "stamp s-solved";
        text.innerHTML = activeCase.text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    } else {
        SFX.warn();
        stamp.innerText = "COLD CASE";
        stamp.className = "stamp s-failed";
        text.innerHTML = `<strong style="color:#a00">FAILURE REPORT:</strong><br>${reason}`;
    }
    modal.style.display = 'flex';
}

function log(msg) {
    let d = document.createElement('div');
    d.className = 'log-entry';
    d.innerText = "> " + msg;
    document.getElementById('log').prepend(d);
}

function shake() {
    let b = document.getElementById('shaker');
    b.style.transform = "translate(4px, 4px)";
    setTimeout(() => b.style.transform = "translate(-4px, -4px)", 50);
    setTimeout(() => b.style.transform = "translate(4px, -4px)", 100);
    setTimeout(() => b.style.transform = "none", 150);
}

function tab(el, id) {
    if (!el) return;
    document.querySelectorAll('.view').forEach(e => e.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(e => e.classList.remove('active'));

    const targetView = document.getElementById(id);
    if (targetView) targetView.classList.add('active');
    el.classList.add('active');

    SFX.init();
    SFX.click();
}

function showArchives() {
    gameOn = false;
    document.getElementById('endModal').style.display = 'none';
    document.getElementById('startModal').style.display = 'flex';
    // Re-render incase data changed (optional, but safer)
    if (Object.keys(DB).length > 0) renderCaseMenu();
}