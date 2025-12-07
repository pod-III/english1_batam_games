const ClassTallyApp = (function () {
    let modalCallback = null;
    let timerInterval = null;

    const State = {
        students: [],
        rules: [],
        className: 'Class Tally',
        modalView: 'type',
        soundEnabled: true,
        isGoodDropdownOpen: false,
        isBadDropdownOpen: false,
        currentGood: '⭐️',
        currentBad: '⚠️',
        currentStrokeColor: '#0f172a',
        currentStrokeWidth: 14,
        currentCardColor: '#3B82F6',
        currentAvatar: '😀',
        timerSeconds: 0,
        isPicking: false,

        ruleType: 'allowed',
        isRulesPanelOpen: false,

        // NEW STATE PROPERTY FOR NON-REPEATING PICKER
        pickedQueue: [],

        CARD_COLORS: [
            { name: 'Blue', hex: '#3B82F6', bg: 'bg-blue-500' },
            { name: 'Sky', hex: '#0EA5E9', bg: 'bg-sky-500' },
            { name: 'Teal', hex: '#14B8A6', bg: 'bg-teal-500' },
            { name: 'Green', hex: '#22C55E', bg: 'bg-green-500' },
            { name: 'Lime', hex: '#84CC16', bg: 'bg-lime-500' },
            { name: 'Yellow', hex: '#EAB308', bg: 'bg-yellow-500' },
            { name: 'Orange', hex: '#F97316', bg: 'bg-orange-500' },
            { name: 'Red', hex: '#EF4444', bg: 'bg-red-500' },
            { name: 'Pink', hex: '#EC4899', bg: 'bg-pink-500' },
            { name: 'Purple', hex: '#A855F7', bg: 'bg-purple-500' },
            { name: 'Indigo', hex: '#6366F1', bg: 'bg-indigo-500' },
            { name: 'Slate', hex: '#64748B', bg: 'bg-slate-500' },
        ],

        AVATARS: [
            '😀', '😎', '🤩', '🥳', '🤠', '🤓', '😇', '😂', '😴', '🤔',
            '🐶', '🐱', '🦊', '🦁', '🐸', '🐼', '🐨', '🐯', '🦄', '🦖', '🐢', '🐙', '🦉', '🦋', '🐝', '🦈',
            '🤖', '👾', '👽', '👻', '💀', '🤡', '👹', '🧞',
            '🌈', '🔥', '⚡️', '🌟', '💎', '🚀', '🛸', '🏎️', '⚽️', '🏀', '🎮', '🎨', '🎸',
            '🍕', '🍔', '🍟', '🍦', '🍩', '🍪', '🍎', '🍓'
        ],

        GOOD_EMOJIS: [
            '⭐️', '🌟', '✨', '💫', '❤️', '🧡', '💛', '💚', '💙', '💜', '🔥', '💯', '🏆', '🥇', '🥈', '🥉',
            '🏅', '🎖️', '🚀', '💎', '🦄', '👑', '🌈', '☀️', '🌻', '🌸', '🌹', '🍀', '🍎', '🍓', '🍒', '🍭',
            '🍬', '🍪', '🍩', '🍦', '🍕', '🍔', '🍟', '🍿', '⚽️', '🏀', '🏈', '⚾️', '🎾', '🏐', '🏉', '🎱',
            '🥊', '🥋', '🎮', '🎯', '🧩', '🎨', '🎬', '🎤', '🎧', '🎸', '🎹', '🥁', '🎺', '🎷', '🎻', '📚',
            '💡', '🔦', '🕯️', '🧱', '🧬', '🔬', '🔭', '📡', '🩺', '💊', '🩹', '🩸', '🦠', '🧼', '🧹', '🧺',
            '🧻', '🚿', '🛁', '🛀', '🧴', '🪒', '🧱', '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨',
            '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🐦', '🐤', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗',
            '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞', '🐜', '🦟', '🦗', '🕷️', '🕸️', '🦂', '🐢', '🐍', '🦎',
            '👍', '👏', '🙌', '🫶', '🤝', '💪', '🙏', '🫡', '🤩', '😍', '🥰', '🥳', '😎', '🤓', '🤠'
        ],
        BAD_EMOJIS: [
            '⚠️', '🛑', '⛔️', '🚫', '📛', '💢', '♨️', '📵', '🔞', '🔇', '🔈', '🔉', '🔊', '🔔', '🔕', '📢',
            '📣', '💤', '💭', '🗯️', '💬', '🕐', '🕑', '🕒', '🕓', '🕔', '🕕', '🕖', '🕗', '🕘', '🕙', '🕚',
            '🕛', '🕜', '🕝', '🕞', '🕟', '🕠', '🕡', '🕢', '🕣', '🕤', '🕥', '🕦', '🕧', '🐢', '🐌', '🙈',
            '🙉', '🙊', '🐵', '🐔', '🐧', '🐦', '🐤', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝',
            '🐛', '🦋', '🐌', '🐞', '🐜', '🦟', '🦗', '🕷️', '🕸️', '🦂', '🐢', '🐍', '🦎', '🦖', '🦕', '🐙',
            '🦑', '🦐', '🦞', '🦀', '🐡', '🐠', '🐟', '🐬', '🐳', '🐋', '🦈', '🐊', '🐅', '🐆', '🦓', '🦍',
            '🦧', '🐘', '🦛', '🦏', '🐪', '🐫', '🦒', '🦘', '🐃', '🐂', '🐄', '🐎', '🐖', '🐏', '🐑', '🦙',
            '🐐', '🦌', '🐕', '🐩', '🦮', '🐕‍🦺', '🐈', '🐈‍⬛', '🐓', '🦃', '🦚', '🦜', '🦢', '🦩', '🕊️',
            '🐇', '🦝', '🦨', '🦡', '🦦', '🦥', '🐁', '🐀', '🐿️', '🦔', '🐾', '🐉', '🐲', '🌵', '🎄', '🌲',
            '🌳', '🌴', '🌱', '🌿', '☘️', '🍀', '🎍', '🎋', '🍃', '🍂', '🍁', '🍄', '🐚', '🌾', '💐', '🌷',
            '🌹', '🥀', '🌺', '🌸', '🌼', '🌻', '🌞', '🌝', '🌛', '🌜', '🌚', '🌕', '🌖', '🌗', '🌘', '🌑',
            '🌒', '🌓', '🌔', '🌙', '🌎', '🌍', '🌏', '🪐', '💫', '⭐️', '🌟', '✨', '⚡️', '☄️', '💥', '🔥',
            '🌪️', '🌈', '☀️', '🌤️', '⛅️', '🌥️', '☁️', '🌦️', '🌧️', '⛈️', '🌩️', '🌨️', '❄️', '☃️', '⛄️',
            '🌬️', '💨', '💧', '💦', '☔️', '☂️', '🌊', '🌫️', '🍏', '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇',
            '🍓', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', '🥒', '🌶️', '🌽',
            '🥕', '🧄', '🧅', '🥔', '🍠', '🥐', '🥯', '🍞', '🥖', '🥨', '🧀', '🥚', '🍳', '🧈', '🥞', '🧇',
            '🥓', '🥩', '🍗', '🍖', '🦴', '🌭', '🍔', '🍟', '🍕', '🥪', '🥙', '🧆', '🌮', '🌯', '🥗', '🥘',
            '🗑️', '🪫', '🔌', '🔋', '💣', '🧨', '🪓', '🔪', '🗡️', '⚔️', '🛡️', '🚬', '⚰️', '⚱️', '🏺', '🔮',
            '👎', '👊', '🤛', '🤜', '🤚', '🖐️', '✋', '🖖', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙'
        ],
    };

    // --- RULES MODULE ---
    const Rules = {
        TYPES: {
            allowed: { bg: 'bg-emerald-500', border: 'border-emerald-600', text: 'text-white' },
            warning: { bg: 'bg-amber-400', border: 'border-amber-500', text: 'text-slate-900' },
            info: { bg: 'bg-blue-500', border: 'border-blue-600', text: 'text-white' },
            prohibited: { bg: 'bg-red-500', border: 'border-red-600', text: 'text-white' },
        },
        EMOJI_PICKER: [
            '🚭', '🚷', '📵', '🚯', '🤫', '🙋‍♂️', '🙋‍♀️', '🚮', '✅', '❌', '⚠️', '👮', '🎒', '🏫',
            '🚶', '🏃', '🗣️', '👂', '👀', '🤐', '✋', '⏰', '📝', '📚', '🤝', '🛑', '🚽', '💧'
        ],
        setType: (t) => {
            State.ruleType = t;
            document.querySelectorAll('.rule-type-btn').forEach(b => b.classList.remove('ring-4', 'ring-offset-2', 'ring-slate-300'));
            document.getElementById(`rule-type-${t}`).classList.add('ring-4', 'ring-offset-2', 'ring-slate-300');
        },
        setEmoji: (e) => {
            document.getElementById('rule-emoji-input').value = e;
        },
        initPicker: () => {
            const grid = document.getElementById('rule-emoji-grid');
            grid.innerHTML = Rules.EMOJI_PICKER.map(e =>
                `<button onclick="ClassTallyApp.Rules.setEmoji('${e}')" class="w-9 h-9 flex items-center justify-center text-xl bg-slate-50 hover:bg-slate-200 rounded-lg transition-colors border border-slate-100">${e}</button>`
            ).join('');
            Rules.setType(State.ruleType);
        },
        add: () => {
            const text = document.getElementById('rule-text').value.trim();
            const emoji = document.getElementById('rule-emoji-input').value.trim();

            if (!text) {
                document.getElementById('rule-text').focus();
                document.getElementById('rule-text').classList.add('animate-shake', 'border-red-500');
                setTimeout(() => document.getElementById('rule-text').classList.remove('animate-shake', 'border-red-500'), 500);
                return;
            }

            State.rules.push({
                id: Date.now(),
                text: text,
                type: State.ruleType,
                content: emoji || '📝',
                isImage: false
            });

            document.getElementById('rule-text').value = '';
            Persistence.save();
            Rules.render();
            Audio.playGood();
        },
        remove: (id) => {
            State.rules = State.rules.filter(r => r.id !== id);
            Persistence.save();
            Rules.render();
        },
        render: () => {
            const row = document.getElementById('rules-show-row');
            const emptyState = document.getElementById('rules-empty-state');

            if (!row) return;

            if (State.rules.length === 0) {
                row.innerHTML = '';
                if (emptyState) emptyState.style.display = 'flex';
            } else {
                if (emptyState) emptyState.style.display = 'none';
                row.innerHTML = State.rules.map(r => {
                    const style = Rules.TYPES[r.type];
                    return `
                        <div class="relative group animate-pop-in">
                            <div class="street-sign ${style.bg} ${style.border} rounded-2xl p-2 shadow-lg hover:shadow-xl">
                                <div class="bolt tl"></div><div class="bolt tr"></div>
                                <div class="bolt bl"></div><div class="bolt br"></div>
                                
                                <div class="flex-grow flex items-center justify-center w-full overflow-hidden z-10">
                                    <span class="text-6xl filter drop-shadow-md leading-none select-none">${r.content}</span>
                                </div>
                                
                                <div class="bg-black/10 backdrop-blur-sm rounded-lg px-2 py-1.5 w-[90%] text-center z-10 border border-white/10 mt-1 mb-1 shadow-inner">
                                    <span class="text-xs font-black uppercase tracking-widest ${style.text} block text-shadow-sm">${r.text}</span>
                                </div>
                            </div>
                            
                            <button onclick="ClassTallyApp.Rules.remove(${r.id})" class="absolute -top-2 -right-2 bg-white text-red-500 rounded-full p-1.5 shadow-lg opacity-0 group-hover:opacity-100 transition-all z-30 hover:scale-110 ring-2 ring-red-50 hover:bg-red-50">
                                <i data-lucide="x" class="w-3 h-3"></i>
                            </button>
                        </div>
                    `;
                }).join('');
            }
            lucide.createIcons();
        }
    };

    // --- TEAMS MODULE ---
    const Teams = {
        generate: () => {
            if (State.students.length < 2) return console.error("Need at least 2 students!");
            const countInput = document.getElementById('team-count');
            let numTeams = parseInt(countInput.value);
            if (isNaN(numTeams) || numTeams < 2) numTeams = 2;
            if (numTeams > State.students.length) numTeams = State.students.length;

            const shuffled = [...State.students].sort(() => 0.5 - Math.random());
            const teams = Array.from({ length: numTeams }, () => []);
            shuffled.forEach((student, index) => teams[index % numTeams].push(student));

            Teams.render(teams);
            Audio.playMilestone();
            confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
        },

        render: (teams) => {
            const container = document.getElementById('team-results');
            const colors = ['border-blue-500', 'border-pink-500', 'border-green-500', 'border-orange-500', 'border-purple-500'];
            const bgColors = ['bg-blue-50', 'bg-pink-50', 'bg-green-50', 'bg-orange-50', 'bg-purple-50'];
            const textColors = ['text-blue-600', 'text-pink-600', 'text-green-600', 'text-orange-600', 'text-purple-600'];

            container.innerHTML = teams.map((team, i) => {
                const idx = i % colors.length;
                const membersHtml = team.map(s => `
                    <div class="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-100 shadow-sm mb-2 transform transition-transform hover:scale-[1.01]">
                        <span class="text-2xl filter drop-shadow-sm">${s.avatar || '😀'}</span>
                        ${s.signatureData ? `<img src="${s.signatureData}" class="h-6 w-auto opacity-90" />` : `<span class="font-bold text-slate-700 truncate">${s.name}</span>`}
                    </div>
                `).join('');

                return `
                    <div class="rounded-[2rem] border-t-[8px] ${colors[idx]} ${bgColors[idx]} p-6 shadow-sm animate-pop-in hover:shadow-lg transition-shadow bg-white" style="animation-delay: ${i * 0.1}s">
                        <h4 class="font-black text-xl mb-5 ${textColors[idx]} flex justify-between items-center">
                            Team ${i + 1}
                            <span class="text-xs bg-white px-3 py-1 rounded-full font-bold shadow-sm text-slate-400 border border-slate-100 ring-1 ring-slate-50">${team.length}</span>
                        </h4>
                        <div>${membersHtml}</div>
                    </div>
                `;
            }).join('');
            lucide.createIcons();
        }
    };

    // --- TIMER MODULE ---
    const Timer = {
        toggle: () => {
            const overlay = document.getElementById('timer-overlay');
            if (overlay.classList.contains('hidden')) {
                overlay.classList.remove('hidden');
                if (State.timerSeconds === 0) Timer.add(5);
            } else {
                overlay.classList.add('hidden');
                Timer.stop();
            }
        },
        add: (m) => { Timer.stop(); State.timerSeconds += m * 60; Timer.updateDisplay(); Timer.start(); },
        reset: () => { Timer.stop(); State.timerSeconds = 0; Timer.updateDisplay(); },
        start: () => {
            if (timerInterval) clearInterval(timerInterval);
            timerInterval = setInterval(() => {
                if (State.timerSeconds > 0) {
                    State.timerSeconds--;
                    Timer.updateDisplay();
                    Audio.playTick();
                }
                else {
                    Timer.stop();
                    Audio.playMilestone();
                    console.error("Time's up! Timer stopped.");
                }
            }, 1000);
        },
        stop: () => { if (timerInterval) clearInterval(timerInterval); timerInterval = null; },
        updateDisplay: () => {
            const m = Math.floor(State.timerSeconds / 60).toString().padStart(2, '0');
            const s = (State.timerSeconds % 60).toString().padStart(2, '0');
            const display = document.getElementById('timer-display');
            if (display) display.textContent = `${m}:${s}`;
        }
    };

    // --- CANVAS DRAWING ---
    const CanvasDraw = {
        canvas: null, ctx: null, isDrawing: false, lastX: 0, lastY: 0, hasDrawn: false,
        init: (id) => {
            CanvasDraw.canvas = document.getElementById(id);
            if (!CanvasDraw.canvas) return;
            CanvasDraw.ctx = CanvasDraw.canvas.getContext('2d');
            CanvasDraw.ctx.lineWidth = State.currentStrokeWidth;
            CanvasDraw.ctx.lineCap = 'round';
            CanvasDraw.ctx.strokeStyle = State.currentStrokeColor;

            ['mousedown', 'mousemove', 'mouseup', 'mouseout'].forEach(evt => CanvasDraw.canvas.addEventListener(evt, e => {
                if (evt === 'mousedown') CanvasDraw.startDraw(e); else if (evt === 'mousemove') CanvasDraw.draw(e); else CanvasDraw.stopDraw();
            }));

            ['touchstart', 'touchmove', 'touchend'].forEach(evt => CanvasDraw.canvas.addEventListener(evt, e => {
                if (evt !== 'touchend') e.preventDefault();
                const touch = e.touches[0];
                if (evt === 'touchstart') CanvasDraw.startDraw(touch); else if (evt === 'touchmove') CanvasDraw.draw(touch); else CanvasDraw.stopDraw();
            }));
            CanvasDraw.updateUISelectors();
        },
        setStrokeColor: (c) => { State.currentStrokeColor = c; if (CanvasDraw.ctx) CanvasDraw.ctx.strokeStyle = c; CanvasDraw.updateUISelectors(); },
        setStrokeWidth: (w) => { State.currentStrokeWidth = w; if (CanvasDraw.ctx) CanvasDraw.ctx.lineWidth = w; CanvasDraw.updateUISelectors(); },
        updateUISelectors: () => {
            document.querySelectorAll('#content-draw button[id^="color-"]').forEach(btn => {
                btn.classList.remove('ring-4', 'ring-offset-2', 'ring-slate-300');
                const hex = State.currentStrokeColor.substring(1).toUpperCase();
                if (btn.id.includes(hex)) {
                    btn.classList.add('ring-4', 'ring-offset-2', 'ring-slate-300');
                }
            });
        },
        resizeObserver: new ResizeObserver(entries => {
            for (let entry of entries) {
                if (!CanvasDraw.canvas) continue;

                const { width, height } = entry.contentRect;
                let imgData = CanvasDraw.hasDrawn ? CanvasDraw.getSignature() : null;

                CanvasDraw.canvas.width = width;
                CanvasDraw.canvas.height = height;

                if (CanvasDraw.ctx) {
                    CanvasDraw.ctx.lineWidth = State.currentStrokeWidth;
                    CanvasDraw.ctx.lineCap = 'round';
                    CanvasDraw.ctx.strokeStyle = State.currentStrokeColor;
                }

                if (imgData) {
                    const img = new Image();
                    img.onload = () => CanvasDraw.ctx.drawImage(img, 0, 0, width, height);
                    img.src = imgData;
                }
            }
        }),
        startDraw: (e) => { CanvasDraw.isDrawing = true;[CanvasDraw.lastX, CanvasDraw.lastY] = CanvasDraw.getCoords(e); CanvasDraw.hasDrawn = true; },
        draw: (e) => {
            if (!CanvasDraw.isDrawing || !CanvasDraw.ctx) return;
            CanvasDraw.ctx.beginPath(); CanvasDraw.ctx.moveTo(CanvasDraw.lastX, CanvasDraw.lastY);
            const [nx, ny] = CanvasDraw.getCoords(e); CanvasDraw.ctx.lineTo(nx, ny); CanvasDraw.ctx.stroke();
            [CanvasDraw.lastX, CanvasDraw.lastY] = [nx, ny];
        },
        stopDraw: () => { CanvasDraw.isDrawing = false; },
        getCoords: (e) => {
            const r = CanvasDraw.canvas.getBoundingClientRect();
            const clientX = e.clientX !== undefined ? e.clientX : (e.targetTouches ? e.targetTouches[0].clientX : 0);
            const clientY = e.clientY !== undefined ? e.clientY : (e.targetTouches ? e.targetTouches[0].clientY : 0);
            return [clientX - r.left, clientY - r.top];
        },
        clear: () => {
            if (!CanvasDraw.ctx) return;
            CanvasDraw.ctx.clearRect(0, 0, CanvasDraw.canvas.width, CanvasDraw.canvas.height);
            CanvasDraw.hasDrawn = false;
        },
        getSignature: () => CanvasDraw.canvas.toDataURL('image/png')
    };

    document.addEventListener('DOMContentLoaded', () => {
        const canvas = document.getElementById('signature-canvas');
        if (canvas) {
            const rect = canvas.getBoundingClientRect();
            canvas.width = rect.width;
            canvas.height = rect.height;
        }
    });

    // --- AUDIO (REPLACEMENT) ---
    const Audio = {
        ctx: null,
        init: () => {
            if (!Audio.ctx) {
                Audio.ctx = new (window.AudioContext || window.webkitAudioContext)();
            }
        },
        playTone: (freq, type, duration) => {
            if (!State.soundEnabled) return;
            Audio.init();
            if (Audio.ctx.state === 'suspended') Audio.ctx.resume();

            const osc = Audio.ctx.createOscillator();
            const gain = Audio.ctx.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(freq, Audio.ctx.currentTime);

            gain.gain.setValueAtTime(0, Audio.ctx.currentTime);
            gain.gain.linearRampToValueAtTime(0.1, Audio.ctx.currentTime + 0.01);
            gain.gain.linearRampToValueAtTime(0, Audio.ctx.currentTime + duration);

            osc.connect(gain);
            gain.connect(Audio.ctx.destination);
            osc.start();
            osc.stop(Audio.ctx.currentTime + duration + 0.05);
        },
        playGood: () => { if (!State.soundEnabled) return; Audio.playTone(880, 'sine', 0.1); setTimeout(() => Audio.playTone(1320, 'sine', 0.15), 100); },
        playBad: () => { if (!State.soundEnabled) return; Audio.playTone(150, 'sawtooth', 0.3); },
        playMilestone: () => { if (!State.soundEnabled) return;[523, 659, 784, 1046].forEach((f, i) => setTimeout(() => Audio.playTone(f, 'triangle', 0.2), i * 80)); },
        playTick: () => { if (!State.soundEnabled) return; Audio.playTone(800, 'square', 0.05); },
        playMassAction: (t) => { if (!State.soundEnabled) return; if (t === 'good') Audio.playMilestone(); else Audio.playBad(); }
    };

    // --- PERSISTENCE ---
    const Persistence = {
        save: () => {
            const dataToSave = {
                students: State.students,
                rules: State.rules,
                sound: State.soundEnabled,
                good: State.currentGood,
                bad: State.currentBad,
                // Save the pickedQueue to maintain state across sessions
                pickedQueue: State.pickedQueue
            };
            localStorage.setItem('class_tally_v1', JSON.stringify(dataToSave));
        },
        load: () => {
            const d = localStorage.getItem('class_tally_v1') || localStorage.getItem('english1_tally_v5') || localStorage.getItem('english1_tally_v4_state');
            if (d) {
                try {
                    const o = JSON.parse(d);
                    State.students = o.students || [];
                    State.rules = o.rules || [];
                    State.soundEnabled = o.sound !== undefined ? o.sound : true;
                    State.currentGood = o.good || '⭐️';
                    State.currentBad = o.bad || '⚠️';
                    // Load the pickedQueue
                    State.pickedQueue = o.pickedQueue || [];
                } catch (e) {
                    console.error("Error loading saved state:", e);
                    State.students = [];
                    State.pickedQueue = [];
                }
            }
            State.students = State.students.map(s => ({
                ...s,
                cardColor: s.cardColor || '#3B82F6',
                avatar: s.avatar || '😀',
                goodLogs: s.goodLogs || [],
                badLogs: s.badLogs || []
            }));

            // Clean up the queue if students were deleted since last save
            const studentIds = State.students.map(s => s.id);
            State.pickedQueue = State.pickedQueue.filter(id => studentIds.includes(id));

            // Reset queue if it somehow got corrupted and has more elements than students
            if (State.pickedQueue.length > State.students.length) {
                State.pickedQueue = [];
            }
        }
    };

    // --- STUDENT LOGIC ---
    const Student = {
        addTyped: () => {
            const nameInput = document.getElementById('student-name-input');
            const canvas = document.getElementById('signature-canvas');
            const name = nameInput.value.trim();
            const view = State.modalView;

            if (view === 'type' && !name) {
                nameInput.focus();
                nameInput.classList.add('animate-shake', 'ring-2', 'ring-red-500', 'border-red-500');
                setTimeout(() => nameInput.classList.remove('animate-shake', 'ring-2', 'ring-red-500', 'border-red-500'), 500);
                return;
            }
            if (view === 'draw' && !CanvasDraw.hasDrawn) {
                canvas.classList.add('animate-shake', 'border-red-500', 'ring-2', 'ring-red-500');
                setTimeout(() => canvas.classList.remove('animate-shake', 'border-red-500', 'ring-2', 'ring-red-500'), 500);
                return;
            }

            const newStudent = {
                id: Date.now(),
                name: view === 'type' ? name : 'Artist',
                signatureData: view === 'draw' ? CanvasDraw.getSignature() : null,
                avatar: State.currentAvatar,
                goodLogs: [], badLogs: [],
                cardColor: State.currentCardColor
            };
            State.students.push(newStudent);
            document.getElementById('student-name-input').value = '';
            UI.hideStudentModal();
            CanvasDraw.clear();
            Persistence.save();
            UI.render();
            Audio.playGood();
        },
        remove: (id) => UI.showConfirmationModal('Remove Student?', 'Are you sure you want to delete this student data?', 'Delete', (y) => {
            if (y) {
                State.students = State.students.filter(s => s.id !== id);
                // Remove from the pickedQueue as well
                State.pickedQueue = State.pickedQueue.filter(queueId => queueId !== id);
                Persistence.save();
                UI.render();
            }
        }),

        addPoint: (id, type) => {
            const s = State.students.find(x => x.id === id); if (!s) return;
            if (type === 'good') {
                s.goodLogs.push(State.currentGood); Audio.playGood();
                if (s.goodLogs.length % 5 === 0) { UI.celebrate(id); Audio.playMilestone(); }
            } else {
                s.badLogs.push(State.currentBad); Audio.playBad();
                const card = document.getElementById(`card-${id}`);
                if (card) { card.classList.remove('animate-shake'); void card.offsetWidth; card.classList.add('animate-shake'); }
            }
            Persistence.save();
            UI.updateCardLogs(id);
        },

        removeLastPoint: (id, type) => {
            const s = State.students.find(x => x.id === id); if (!s) return;
            if (type === 'good' && s.goodLogs.length > 0) s.goodLogs.pop();
            else if (type === 'bad' && s.badLogs.length > 0) s.badLogs.pop();
            Persistence.save();
            UI.updateCardLogs(id);
        },

        // MODIFIED: NON-REPEATING PICK RANDOM LOGIC
        pickRandom: () => {
            if (State.students.length === 0) return console.error("Class is empty. Add students first.");
            if (State.isPicking) return;

            // 1. Reset queue if all students have been picked
            if (State.pickedQueue.length >= State.students.length) {
                console.log("All students picked. Resetting queue.");
                State.pickedQueue = [];
            }

            // 2. Identify available students (those not in the current queue)
            const availableStudents = State.students.filter(
                s => !State.pickedQueue.includes(s.id)
            );

            if (availableStudents.length === 0) {
                // Should only happen if the length check above was exactly equal but no available student was found (a safeguard)
                State.pickedQueue = [];
                return Student.pickRandom(); // Try again with a fresh queue
            }

            // 3. Select a random student from the available list
            const randomIndex = Math.floor(Math.random() * availableStudents.length);
            const selectedStudent = availableStudents[randomIndex];

            // 4. Update the queue with the selected student's ID and save
            State.pickedQueue.push(selectedStudent.id);
            Persistence.save();
            // End of non-repeating logic

            State.isPicking = true;
            document.querySelectorAll('.app-panel').forEach(el => el.classList.remove('card-highlight'));

            let i = 0, delay = 50;
            const loop = () => {
                // Highlight random students for a spin effect (using the full student list for visual variability)
                document.querySelectorAll('.app-panel').forEach(el => el.classList.remove('card-highlight'));

                const rS = State.students[Math.floor(Math.random() * State.students.length)];
                const card = document.getElementById(`card-${rS.id}`);

                if (card) { card.classList.add('card-highlight'); Audio.playTick(); }

                i++;
                if (i < 25) {
                    delay *= 1.1;
                    setTimeout(loop, delay);
                }
                else {
                    // Final reveal logic: focus on the determined selectedStudent
                    const finalCard = document.getElementById(`card-${selectedStudent.id}`);
                    document.querySelectorAll('.app-panel').forEach(el => el.classList.remove('card-highlight')); // Clear last highlight

                    if (finalCard) {
                        finalCard.classList.add('card-highlight');
                        finalCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        setTimeout(() => {
                            Audio.playMilestone();
                            const rect = finalCard.getBoundingClientRect();
                            confetti({
                                particleCount: 60,
                                spread: 70,
                                origin: {
                                    x: (rect.left + rect.width / 2) / window.innerWidth,
                                    y: (rect.top + rect.height / 2) / window.innerHeight
                                }
                            });
                            State.isPicking = false;
                        }, 300);
                    } else {
                        State.isPicking = false;
                    }
                }
            };
            loop();
        },
        addAllGood: () => UI.showConfirmationModal('Reward Class', `Give +1 ${State.currentGood} to everyone?`, 'Yes', (y) => { if (y) { State.students.forEach(s => s.goodLogs.push(State.currentGood)); Persistence.save(); UI.render(); Audio.playMassAction('good'); confetti(); } }),
        addAllBad: () => UI.showConfirmationModal('Warn Class', `Give +1 ${State.currentBad} to everyone?`, 'Yes', (y) => { if (y) { State.students.forEach(s => s.badLogs.push(State.currentBad)); Persistence.save(); UI.render(); Audio.playMassAction('bad'); } }),
        clearAll: () => UI.showConfirmationModal('Reset All', 'Delete all students and their data?', 'Delete All', (y) => { if (y) { State.students = []; State.pickedQueue = []; Persistence.save(); UI.render(); } }),
    };

    // --- UI ---
    const UI = {
        initCardColorPicker: () => {
            document.getElementById('card-color-picker').innerHTML = State.CARD_COLORS.map(c =>
                `<button onclick="ClassTallyApp.UI.setCardColor('${c.hex}')" id="color-btn-${c.hex.substring(1)}" class="w-10 h-10 rounded-full ${c.bg} hover:scale-110 transition-transform shadow-sm ring-offset-2"></button>`
            ).join('');
            UI.updateCardColorPicker();
        },
        setCardColor: (c) => { State.currentCardColor = c; UI.updateCardColorPicker(); },
        updateCardColorPicker: () => {
            State.CARD_COLORS.forEach(c => {
                const btn = document.getElementById(`color-btn-${c.hex.substring(1)}`);
                if (btn) {
                    if (c.hex === State.currentCardColor) { btn.classList.add('ring-4', 'ring-slate-300'); }
                    else { btn.classList.remove('ring-4', 'ring-slate-300'); }
                }
            });
        },
        initAvatarPicker: () => {
            document.getElementById('avatar-picker-grid').innerHTML = State.AVATARS.map(a =>
                `<button onclick="ClassTallyApp.UI.setAvatar('${a}')" class="avatar-btn w-10 h-10 text-2xl rounded-xl border border-slate-100 bg-white hover:bg-slate-50 ${a === State.currentAvatar ? 'selected' : ''}">${a}</button>`
            ).join('');
        },
        setAvatar: (a) => { State.currentAvatar = a; UI.initAvatarPicker(); },
        setModalView: (v) => {
            State.modalView = v;
            document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));
            document.getElementById(`tab-${v}`).classList.add('active');
            document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
            document.getElementById(`content-${v}`).style.display = 'block';

            if (v === 'draw') {
                const canvas = document.getElementById('signature-canvas');
                if (canvas) CanvasDraw.resizeObserver.observe(canvas);
                CanvasDraw.clear();
            }
            else {
                const canvas = document.getElementById('signature-canvas');
                if (canvas) CanvasDraw.resizeObserver.unobserve(canvas);
            }
        },
        showStudentModal: () => {
            UI.setModalView('type');
            UI.initCardColorPicker();
            UI.initAvatarPicker();
            document.getElementById('add-student-modal').classList.remove('hidden');
            setTimeout(() => document.getElementById('add-student-modal').classList.remove('opacity-0'), 10);
        },
        hideStudentModal: () => {
            const canvas = document.getElementById('signature-canvas');
            if (canvas) CanvasDraw.resizeObserver.unobserve(canvas);
            document.getElementById('add-student-modal').classList.add('opacity-0');
            setTimeout(() => document.getElementById('add-student-modal').classList.add('hidden'), 300);
        },
        showTeamModal: () => {
            document.getElementById('team-modal').classList.remove('hidden');
            setTimeout(() => document.getElementById('team-modal').classList.remove('opacity-0'), 10);
        },
        hideTeamModal: () => {
            document.getElementById('team-modal').classList.add('opacity-0');
            setTimeout(() => document.getElementById('team-modal').classList.add('hidden'), 300);
        },
        showConfirmationModal: (t, m, c, cb) => {
            modalCallback = cb;
            document.getElementById('modal-title').textContent = t;
            document.getElementById('modal-message').textContent = m;
            document.getElementById('modal-confirm').textContent = c;
            document.getElementById('confirmation-modal').classList.remove('hidden');
            setTimeout(() => document.getElementById('confirmation-modal').classList.remove('opacity-0'), 10);
        },
        hideModal: () => {
            document.getElementById('confirmation-modal').classList.add('opacity-0');
            setTimeout(() => document.getElementById('confirmation-modal').classList.add('hidden'), 300);
        },
        handleModalAction: (y) => { UI.hideModal(); if (modalCallback) { modalCallback(y); modalCallback = null; } },

        toggleRulesPanel: () => {
            State.isRulesPanelOpen = !State.isRulesPanelOpen;
            const editor = document.getElementById('rules-editor-panel');
            const btn = document.getElementById('btn-toggle-rules');

            if (State.isRulesPanelOpen) {
                editor.classList.remove('collapsed');
                btn.classList.add('bg-slate-100', 'text-slate-900', 'ring-2', 'ring-slate-200');
                Rules.render();
            } else {
                editor.classList.add('collapsed');
                btn.classList.remove('bg-slate-100', 'text-slate-900', 'ring-2', 'ring-slate-200');
            }
        },

        toggleGoodDropdown: (e) => {
            e.stopPropagation();
            const dropdown = document.getElementById('dropdown-good');
            dropdown.classList.toggle('hidden');
            document.getElementById('dropdown-bad').classList.add('hidden');
        },
        toggleBadDropdown: (e) => {
            e.stopPropagation();
            const dropdown = document.getElementById('dropdown-bad');
            dropdown.classList.toggle('hidden');
            document.getElementById('dropdown-good').classList.add('hidden');
        },
        closeAllDropdowns: () => {
            document.getElementById('dropdown-good').classList.add('hidden');
            document.getElementById('dropdown-bad').classList.add('hidden');
        },

        initEmojiPickers: () => {
            document.getElementById('current-good-emoji').textContent = State.currentGood;
            document.getElementById('current-bad-emoji').textContent = State.currentBad;

            const gen = (arr, t) => arr.map(e => {
                const isSelected = (t === 'good' && e === State.currentGood) || (t === 'bad' && e === State.currentBad);
                const selectedClass = isSelected ? 'emoji-grid-selected ring-2 ring-brand-blue/30' : 'hover:bg-slate-50 hover:scale-125';
                return `<button onclick="ClassTallyApp.UI.setEmoji('${t}','${e}')" class="w-9 h-9 text-xl transition-all rounded-lg ${selectedClass}">${e}</button>`;
            }).join('');

            document.getElementById('good-picker-grid').innerHTML = gen(State.GOOD_EMOJIS, 'good');
            document.getElementById('bad-picker-grid').innerHTML = gen(State.BAD_EMOJIS, 'bad');
        },
        setEmoji: (t, e) => {
            if (t === 'good') State.currentGood = e; else State.currentBad = e;
            Persistence.save();
            UI.initEmojiPickers();
            UI.render();
            UI.closeAllDropdowns();
        },
        toggleSound: () => {
            State.soundEnabled = !State.soundEnabled;
            document.getElementById('btn-sound').innerHTML = State.soundEnabled ? '<i data-lucide="volume-2" class="w-5 h-5"></i>' : '<i data-lucide="volume-x" class="w-5 h-5 text-red-400"></i>';
            lucide.createIcons(); Persistence.save();
        },
        toggleSettings: () => { document.getElementById('toolbar').classList.toggle('hidden'); document.getElementById('toolbar').classList.toggle('flex'); },
        celebrate: (id) => {
            const el = document.getElementById(`card-${id}`);
            if (!el) return;
            const r = el.getBoundingClientRect();
            confetti({ particleCount: 60, spread: 50, origin: { x: (r.left + r.width / 2) / window.innerWidth, y: (r.top + r.height / 2) / window.innerHeight } });
        },

        updateCardLogs: (id) => {
            const s = State.students.find(x => x.id === id); if (!s) return;
            const logContainer = document.querySelector(`#card-${id} .custom-scrollbar`);
            const tapHint = document.querySelector(`#card-${id} .tap-hint`);

            if (logContainer) {
                const goodCount = s.goodLogs.length;
                const badCount = s.badLogs.length;

                logContainer.innerHTML = `
                    ${s.goodLogs.map((e, i) => `<span onclick="event.stopPropagation(); ClassTallyApp.Student.removeLastPoint(${s.id},'good')" class="tally-item text-xl select-none hover:opacity-50 drop-shadow-sm cursor-pointer">${e}</span>`).join('')}
                    ${s.badLogs.map(e => `<span onclick="event.stopPropagation(); ClassTallyApp.Student.removeLastPoint(${s.id},'bad')" class="tally-item text-lg grayscale opacity-80 hover:opacity-100 drop-shadow-sm cursor-pointer">${e}</span>`).join('')}
                    ${goodCount === 0 && badCount === 0 ? '<span class="text-xs text-slate-300 font-bold self-center w-full text-center mt-2 uppercase tracking-wide opacity-50">Empty</span>' : ''}
                `;
                logContainer.scrollTop = logContainer.scrollHeight;
            }
            if (tapHint) {
                tapHint.style.display = (s.goodLogs.length > 0 || s.badLogs.length > 0) ? 'block' : 'none';
            }
        },

        render: () => {
            const container = document.getElementById('grid-container');
            if (State.students.length === 0) {
                document.getElementById('empty-state').style.display = 'flex';
                container.innerHTML = '';
                return;
            }
            document.getElementById('empty-state').style.display = 'none';

            container.innerHTML = State.students.map(s => {
                const goodCount = s.goodLogs.length;
                const badCount = s.badLogs.length;

                // Add a class if the student has been picked in the current cycle
                const pickedClass = State.pickedQueue.includes(s.id) ? 'opacity-70 border-b-4 border-slate-300' : '';

                return `
                <div id="card-${s.id}" class="app-panel rounded-[2rem] flex flex-row relative overflow-hidden bg-white hover:border-slate-200 h-64 group transition-all duration-300 ${pickedClass}">
                    
                    <div class="w-32 sm:w-40 flex-none relative flex flex-col items-center justify-center p-2 transition-colors duration-300 border-r border-black/5" style="background-color: ${s.cardColor}; background-image: radial-gradient(circle, rgba(255,255,255,0.15) 2px, transparent 2.5px); background-size: 14px 14px;">
                        <div class="absolute inset-0 bg-gradient-to-b from-black/0 to-black/10"></div>
                        
                        <div class="w-24 h-24 rounded-full bg-white p-1.5 shadow-xl ring-4 ring-white/20 relative z-10 mb-4 transform group-hover:scale-105 transition-transform duration-300">
                             <div class="w-full h-full rounded-full bg-slate-50 flex items-center justify-center text-5xl select-none overflow-hidden">
                                <span class="filter drop-shadow-sm group-hover:scale-110 transition-transform duration-500 block">${s.avatar || '😀'}</span>
                            </div>
                        </div>
                    </div>

                    <div class="flex-1 flex flex-col p-4 min-w-0 justify-between relative bg-gradient-to-br from-white to-slate-50">
                        <div class="flex justify-between items-start mb-2 pl-1 pt-1">
                            <div class="flex-1 min-w-0 pr-2">
                                ${s.signatureData ?
                        `<img src="${s.signatureData}" class="h-16 object-contain -ml-2" alt="Signature" />` :
                        `<h3 class="text-3xl sm:text-4xl font-black text-slate-800 truncate tracking-tight leading-none" title="${s.name}">${s.name}</h3>`
                    }
                            </div>
                            <button onclick="ClassTallyApp.Student.remove(${s.id})" class="text-slate-200 hover:text-red-400 p-2 -mt-2 -mr-2 rounded-xl hover:bg-red-50 transition-colors">
                                <i data-lucide="x" class="w-5 h-5"></i>
                            </button>
                        </div>

                        <div class="flex-grow bg-white rounded-xl border border-slate-100 p-2.5 mb-4 relative group/logs overflow-hidden shadow-inner">
                             <div class="flex flex-wrap content-start gap-1.5 h-full overflow-y-auto custom-scrollbar w-full">
                                ${s.goodLogs.map((e, i) => `<span onclick="event.stopPropagation(); ClassTallyApp.Student.removeLastPoint(${s.id},'good')" class="tally-item text-xl select-none hover:opacity-50 drop-shadow-sm cursor-pointer">${e}</span>`).join('')}
                                ${s.badLogs.map(e => `<span onclick="event.stopPropagation(); ClassTallyApp.Student.removeLastPoint(${s.id},'bad')" class="tally-item text-lg grayscale opacity-80 hover:opacity-100 drop-shadow-sm cursor-pointer">${e}</span>`).join('')}
                                ${goodCount === 0 && badCount === 0 ? '<span class="text-xs text-slate-300 font-bold self-center w-full text-center mt-2 uppercase tracking-wide opacity-50">Empty</span>' : ''}
                            </div>
                             <div class="tap-hint absolute bottom-1 right-2 text-[8px] text-slate-300 font-bold uppercase tracking-widest pointer-events-none opacity-0 group-hover/logs:opacity-100 transition-opacity bg-white px-1 rounded">Click items to remove</div>
                        </div>

                        <div class="flex gap-3 h-14">
                             <button onclick="ClassTallyApp.Student.addPoint(${s.id}, 'good')" 
                                class="flex-1 bg-white hover:bg-brand-green hover:text-white text-brand-green border border-slate-100 hover:border-brand-green rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95 font-bold shadow-sm hover:shadow-lg hover:-translate-y-1 group/btn">
                                <span class="text-2xl filter drop-shadow-sm group-hover/btn:scale-110 transition-transform">${State.currentGood}</span>
                                <span class="hidden xl:inline text-sm uppercase tracking-wide">Good</span>
                            </button>
                            <button onclick="ClassTallyApp.Student.addPoint(${s.id}, 'bad')" 
                                class="flex-1 bg-white hover:bg-brand-pink hover:text-white text-brand-pink border border-slate-100 hover:border-brand-pink rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95 font-bold shadow-sm hover:shadow-lg hover:-translate-y-1 group/btn">
                                <span class="text-2xl filter drop-shadow-sm group-hover/btn:scale-110 transition-transform">${State.currentBad}</span>
                                <span class="hidden xl:inline text-sm uppercase tracking-wide">Bad</span>
                            </button>
                        </div>
                    </div>
                </div>`;
            }).join('');
            lucide.createIcons();
        }
    };

    return {
        init: () => {
            Persistence.load();
            CanvasDraw.init('signature-canvas');
            UI.initEmojiPickers();
            Rules.initPicker();
            Rules.render();
            UI.render();
            document.addEventListener('click', UI.closeAllDropdowns);
            document.getElementById('btn-sound').innerHTML = State.soundEnabled ? '<i data-lucide="volume-2" class="w-5 h-5"></i>' : '<i data-lucide="volume-x" class="w-5 h-5 text-red-400"></i>';
            lucide.createIcons();
        },
        Student, Teams, UI, Timer, CanvasDraw, Rules
    };
})();

window.onload = ClassTallyApp.init;