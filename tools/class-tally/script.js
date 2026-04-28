const ClassTallyApp = (function () {
    let modalCallback = null;
    let timerInterval = null;

    // --- IndexedDB ---
    const DB_NAME = 'ClassTallyDB';
    const DB_VER = 1;
    const STATE_STORE = 'game_state';
    const SETS_STORE = 'class_sets';

    async function getAllClassSets() {
        const saved = await loadProgress('class_tally_sets')
        return saved?.sets || []
    }

    async function saveClassSetToDB(name, data) {
        const sets = await getAllClassSets()
        sets.push({ id: Date.now(), name, data, createdAt: Date.now() })
        await saveProgress('class_tally_sets', { sets })
    }

    async function deleteClassSet(id) {
        const sets = await getAllClassSets()
        const filtered = sets.filter(s => s.id !== id)
        await saveProgress('class_tally_sets', { sets: filtered })
    }

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
        cardSize: 1,
        isAutoFit: false,
        showRankings: false,
        editingStudentId: null,

        // NEW STATE PROPERTY FOR NON-REPEATING PICKER
        pickedQueue: [],

        CARD_COLORS: [
            { name: 'Blue', hex: '#3B82F6', bg: 'bg-blue-500' },
            { name: 'Sky', hex: '#0EA5E9', bg: 'bg-sky-500' },
            { name: 'Cyan', hex: '#06B6D4', bg: 'bg-cyan-500' },
            { name: 'Teal', hex: '#14B8A6', bg: 'bg-teal-500' },
            { name: 'Green', hex: '#22C55E', bg: 'bg-green-500' },
            { name: 'Lime', hex: '#84CC16', bg: 'bg-lime-500' },
            { name: 'Yellow', hex: '#EAB308', bg: 'bg-yellow-500' },
            { name: 'Orange', hex: '#F97316', bg: 'bg-orange-500' },
            { name: 'Red', hex: '#EF4444', bg: 'bg-red-500' },
            { name: 'Rose', hex: '#FDA4AF', bg: 'bg-rose-300' },
            { name: 'Pink', hex: '#EC4899', bg: 'bg-pink-500' },
            { name: 'Fuchsia', hex: '#D946EF', bg: 'bg-fuchsia-500' },
            { name: 'Purple', hex: '#A855F7', bg: 'bg-purple-500' },
            { name: 'Violet', hex: '#8B5CF6', bg: 'bg-violet-500' },
            { name: 'Slate', hex: '#64748B', bg: 'bg-slate-500' },
            { name: 'Black', hex: '#0F172A', bg: 'bg-slate-900' },
            { name: 'White', hex: '#FFFFFF', bg: 'bg-white' },
        ],

        AVATARS: [
            '😀', '😎', '🤩', '🥳', '🤠', '🤓', '😇', '😂', '😴', '🤔',
            '🐶', '🐱', '🦊', '🦁', '🐸', '🐼', '🐨', '🐯', '🦄', '🦖', '🐢', '🐙', '🦉', '🦋', '🐝', '🦈',
            '🤖', '👾', '👽', '👻', '💀', '🤡', '👹', '🧞',
            '🌈', '🔥', '⚡️', '🌟', '💎', '🚀', '🛸', '🏎️', '⚽️', '🏀', '🎮', '🎨', '🎸',
            '🍕', '🍔', '🍟', '🍦', '🍩', '🍪', '🍎', '🍓',
            '🐒', '🦥', '🦩', '🦕', '🦔'
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
                sound: State.soundEnabled,
                good: State.currentGood,
                bad: State.currentBad,
                pickedQueue: State.pickedQueue,
                cardSize: State.cardSize,
                isAutoFit: State.isAutoFit
            };
            saveProgress('class_tally', dataToSave)
        },
        load: async () => {
            // Try cloud first, fall back to old localStorage keys (auto-migration)
            let o = await loadProgress('class_tally')
            if (!o) {
                const old = localStorage.getItem('class_tally_v1')
                    || localStorage.getItem('klasskit_tally_v5')
                    || localStorage.getItem('klasskit_tally_v4_state')
                if (old) {
                    try { o = JSON.parse(old) } catch (e) { }
                }
            }
            if (o) {
                try {
                    State.students = o.students || []
                    State.soundEnabled = o.sound !== undefined ? o.sound : true
                    State.currentGood = o.good || '⭐️'
                    State.currentBad = o.bad || '⚠️'
                    State.pickedQueue = o.pickedQueue || []
                    State.cardSize = o.cardSize || 1
                    State.isAutoFit = o.isAutoFit || false
                } catch (e) {
                    console.error('Error loading saved state:', e)
                    State.students = []
                    State.pickedQueue = []
                }
            }
            State.students = State.students.map(s => ({
                ...s,
                cardColor: s.cardColor || '#3B82F6',
                avatar: s.avatar || '😀',
                goodLogs: s.goodLogs || [],
                badLogs: s.badLogs || []
            }))
            const studentIds = State.students.map(s => s.id)
            State.pickedQueue = State.pickedQueue.filter(id => studentIds.includes(id))
            if (State.pickedQueue.length > State.students.length) State.pickedQueue = []
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

            // --- EDIT MODE ---
            if (State.editingStudentId) {
                const s = State.students.find(x => x.id === State.editingStudentId);
                if (s) {
                    s.name = view === 'type' ? name : (s.name || 'Artist');
                    s.signatureData = view === 'draw' ? CanvasDraw.getSignature() : null;
                    s.avatar = State.currentAvatar;
                    s.cardColor = State.currentCardColor;
                }
                State.editingStudentId = null;
                State.showRankings = false;
                document.getElementById('student-name-input').value = '';
                UI.hideStudentModal();
                CanvasDraw.clear();
                Persistence.save();
                UI.render();
                Audio.playGood();
                return;
            }

            // --- CREATE MODE ---
            const newStudent = {
                id: Date.now(),
                name: view === 'type' ? name : 'Artist',
                signatureData: view === 'draw' ? CanvasDraw.getSignature() : null,
                avatar: State.currentAvatar,
                goodLogs: [], badLogs: [],
                cardColor: State.currentCardColor
            };
            State.students.push(newStudent);
            State.showRankings = false;
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
                State.showRankings = false;
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

        emptyScore: (id) => {
            const s = State.students.find(x => x.id === id); if (!s) return;
            const total = s.goodLogs.length + s.badLogs.length;
            if (total === 0) return;
            UI.showConfirmationModal(
                'Reset Score?',
                `This will clear all ${total} point(s) for ${s.name}. This cannot be undone.`,
                'Reset',
                (yes) => {
                    if (yes) {
                        s.goodLogs = [];
                        s.badLogs = [];
                        Persistence.save();
                        UI.updateCardLogs(id);
                        Audio.playTick();
                    }
                }
            );
        },

        editStudent: (id) => {
            const s = State.students.find(x => x.id === id); if (!s) return;
            State.editingStudentId = id;
            UI.showStudentModal(id);
        },

        addBulk: () => {
             const input = document.getElementById('bulk-import-input').value;
             if (!input.trim()) return;
             const names = input.split('\n').map(n => n.trim()).filter(n => n.length > 0);
             if (names.length === 0) return;

             names.forEach(name => {
                 State.students.push({
                     id: Date.now() + Math.floor(Math.random() * 10000),
                     name: name,
                     signatureData: null,
                     avatar: State.AVATARS[Math.floor(Math.random() * State.AVATARS.length)], // Random avatar
                     goodLogs: [], badLogs: [],
                     cardColor: State.CARD_COLORS[Math.floor(Math.random() * State.CARD_COLORS.length)].hex // Random color
                 });
             });
             
             document.getElementById('bulk-import-input').value = '';
             State.showRankings = false;
             UI.hideManageClassesModal();
             Persistence.save();
             UI.render();
             Audio.playGood();
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
        clearAll: () => UI.showConfirmationModal('Reset All', 'Delete all students and their data?', 'Delete All', (y) => { if (y) { State.students = []; State.pickedQueue = []; State.showRankings = false; Persistence.save(); UI.render(); } }),
        sortByRanking: () => {
            if (State.students.length === 0) return;
            
            UI.showConfirmationModal(
                'Ready for Rankings? 🏆',
                'Prepare the class! We\'re about to see who\'s leading the tally.',
                'Let\'s Go!',
                (confirmed) => {
                    if (!confirmed) return;
                    
                    State.students.sort((a, b) => {
                        const aStars = a.goodLogs.length;
                        const bStars = b.goodLogs.length;
                        if (aStars !== bStars) return bStars - aStars; // Most to least
                        return a.name.localeCompare(b.name); // Alphabetical fallback
                    });
                    
                    State.showRankings = true;
                    Persistence.save();
                    UI.render({ animate: true });
                    Audio.playMilestone();
                    
                    // Celebrate the top student
                    if (State.students.length > 0) {
                        setTimeout(() => {
                            const topStudentId = State.students[0].id;
                            UI.celebrate(topStudentId);
                        }, State.students.length * 50 + 200);
                    }
                }
            );
        },
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
        showStudentModal: (editId) => {
            const isEdit = !!editId;
            const student = isEdit ? State.students.find(x => x.id === editId) : null;

            // Pre-fill fields if editing
            if (student) {
                State.currentAvatar = student.avatar || '😀';
                State.currentCardColor = student.cardColor || '#3B82F6';
                document.getElementById('student-name-input').value = student.signatureData ? '' : (student.name || '');
                if (student.signatureData) {
                    UI.setModalView('draw');
                } else {
                    UI.setModalView('type');
                }
            } else {
                State.editingStudentId = null;
                document.getElementById('student-name-input').value = '';
                UI.setModalView('type');
            }

            UI.initCardColorPicker();
            UI.initAvatarPicker();

            // Update modal title & button text
            const titleEl = document.getElementById('modal-student-title');
            const subtitleEl = document.getElementById('modal-student-subtitle');
            const confirmBtn = document.getElementById('btn-add-confirm');
            if (titleEl) titleEl.textContent = isEdit ? 'Edit Student' : 'New Student';
            if (subtitleEl) subtitleEl.textContent = isEdit ? 'Update profile card' : 'Create a profile card';
            if (confirmBtn) {
                confirmBtn.innerHTML = isEdit
                    ? '<i data-lucide="check" class="w-5 h-5"></i> Save Changes'
                    : '<i data-lucide="check" class="w-5 h-5"></i> Create Student';
            }

            document.getElementById('add-student-modal').classList.remove('hidden');
            setTimeout(() => {
                document.getElementById('add-student-modal').classList.remove('opacity-0');
                lucide.createIcons();
            }, 10);
        },
        toggleModalPosition: () => {
            const modal = document.getElementById('add-student-modal');
            const inner = modal.querySelector('.max-w-5xl');
            const icon = document.querySelector('#modal-position-toggle i');
            if (modal.classList.contains('items-center')) {
                modal.classList.remove('items-center', 'p-4');
                modal.classList.add('items-end', 'px-2', 'pt-4', 'pb-0', 'sm:px-4');
                inner.classList.remove('rounded-[2.5rem]');
                inner.classList.add('rounded-t-[2.5rem]', 'rounded-b-none');
                icon.setAttribute('data-lucide', 'arrow-up-to-line');
            } else {
                modal.classList.remove('items-end', 'px-2', 'pt-4', 'pb-0', 'sm:px-4');
                modal.classList.add('items-center', 'p-4');
                inner.classList.remove('rounded-t-[2.5rem]', 'rounded-b-none');
                inner.classList.add('rounded-[2.5rem]');
                icon.setAttribute('data-lucide', 'arrow-down-to-line');
            }
            lucide.createIcons();
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

        // CARD RESIZING
        setCardSize: (val) => {
            State.cardSize = val;
            document.documentElement.style.setProperty('--card-scale', val);
            Persistence.save();
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
        toggleTheme: () => {
            const isDark = document.documentElement.classList.toggle('dark');
            localStorage.setItem('theme_class-tally', isDark ? 'dark' : 'light');
            lucide.createIcons();
        },
        initTheme: () => {
            const saved = localStorage.getItem('theme_class-tally') || 'light';
            if (saved === 'dark') document.documentElement.classList.add('dark');
            else document.documentElement.classList.remove('dark');
        },
        showManageClassesModal: () => {
            document.getElementById('manage-classes-modal').classList.remove('hidden');
            setTimeout(() => document.getElementById('manage-classes-modal').classList.remove('opacity-0'), 10);
            UI.renderClassSets();
        },
        hideManageClassesModal: () => {
            document.getElementById('manage-classes-modal').classList.add('opacity-0');
            setTimeout(() => document.getElementById('manage-classes-modal').classList.add('hidden'), 300);
        },
        setManagerView: (v) => {
            document.querySelectorAll('.tab-mgr-btn').forEach(b => {
                b.classList.remove('bg-white', 'dark:bg-slate-800', 'shadow', 'shadow-slate-200/50', 'dark:shadow-none', 'text-brand-blue');
                b.classList.add('text-slate-500', 'hover:text-slate-700', 'dark:text-slate-400', 'dark:hover:text-white');
            });
            const activeBtn = document.getElementById(`tab-mgr-${v}`);
            activeBtn.classList.remove('text-slate-500', 'hover:text-slate-700', 'dark:text-slate-400', 'dark:hover:text-white');
            activeBtn.classList.add('bg-white', 'dark:bg-slate-800', 'shadow', 'shadow-slate-200/50', 'dark:shadow-none', 'text-brand-blue');
            
            document.querySelectorAll('.tab-mgr-content').forEach(c => c.classList.add('hidden'));
            document.getElementById(`mgr-content-${v}`).classList.remove('hidden');
        },
        saveCurrentClass: async () => {
            const nameInput = document.getElementById('class-set-name');
            const name = nameInput.value.trim();
            if (!name || State.students.length === 0) return;
            const clone = JSON.parse(JSON.stringify({
                students: State.students,
                good: State.currentGood,
                bad: State.currentBad
            }));
            await saveClassSetToDB(name, clone);
            nameInput.value = '';
            UI.renderClassSets();
        },
        loadClassSet: (data) => {
            State.students = data.students || [];
            State.currentGood = data.good || '⭐️';
            State.currentBad = data.bad || '⚠️';
            State.pickedQueue = [];
            State.showRankings = false;
            Persistence.save();
            UI.initEmojiPickers();
            UI.render();
            UI.hideManageClassesModal();
        },
        renderClassSets: async () => {
            const list = document.getElementById('classes-list');
            if (!list) return;
            const sets = await getAllClassSets();
            if (sets.length === 0) { list.innerHTML = '<p class="text-slate-400 text-xs italic">No saved classes yet.</p>'; return; }
            list.innerHTML = '';
            sets.forEach(set => {
                const item = document.createElement('div');
                item.className = 'flex items-center gap-2 p-2 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-xl hover:border-brand-blue/40 transition-all';
                const count = set.data?.students?.length || 0;
                item.innerHTML = `
                    <div class="flex-1 min-w-0">
                        <p class="text-sm font-bold text-slate-700 dark:text-white truncate">${set.name}</p>
                        <p class="text-[10px] text-slate-400 truncate">${count} student(s)</p>
                    </div>
                    <button class="set-load p-1.5 bg-brand-blue/10 text-brand-blue rounded-lg border border-brand-blue/20 hover:bg-brand-blue hover:text-white transition-all" title="Load">
                        <i data-lucide="upload" class="w-3.5 h-3.5 pointer-events-none"></i>
                    </button>
                    <button class="set-del p-1.5 bg-brand-pink/10 text-brand-pink rounded-lg border border-brand-pink/20 hover:bg-brand-pink hover:text-white transition-all" title="Delete">
                        <i data-lucide="trash-2" class="w-3.5 h-3.5 pointer-events-none"></i>
                    </button>`;
                item.querySelector('.set-load').onclick = () => UI.loadClassSet(set.data);
                item.querySelector('.set-del').onclick = async () => { await deleteClassSet(set.id); UI.renderClassSets(); };
                list.appendChild(item);
            });
            lucide.createIcons();
        },
        toggleSettings: () => { document.getElementById('toolbar').classList.toggle('hidden'); document.getElementById('toolbar').classList.toggle('flex'); },
        celebrate: (id) => {
            const el = document.getElementById(`card-${id}`);
            if (!el) return;
            const r = el.getBoundingClientRect();
            confetti({ particleCount: 60, spread: 50, origin: { x: (r.left + r.width / 2) / window.innerWidth, y: (r.top + r.height / 2) / window.innerHeight } });
        },

        // CARD RESIZING & AUTO-FIT
        toggleAutoFit: () => {
            State.isAutoFit = !State.isAutoFit;
            UI.updateAutoFitUI();
            if (State.isAutoFit) {
                UI.calculateAutoFitScale();
            } else {
                UI.setCardSize(1); // Reset to default when turning off
            }
            Persistence.save();
        },

        updateAutoFitUI: () => {
            const btn = document.getElementById('btn-autofit');
            if (!btn) return;
            if (State.isAutoFit) {
                btn.classList.add('bg-brand-blue', 'text-white', 'border-brand-blue');
                btn.classList.remove('text-slate-500', 'border-slate-100');
            } else {
                btn.classList.remove('bg-brand-blue', 'text-white', 'border-brand-blue');
                btn.classList.add('text-slate-500', 'border-slate-100');
            }
        },

        calculateAutoFitScale: () => {
            if (!State.isAutoFit) {
                document.documentElement.style.removeProperty('--grid-cols');
                UI.setCardSize(1);
                return;
            }
            if (State.students.length === 0) {
                UI.setCardSize(1);
                document.documentElement.style.removeProperty('--grid-cols');
                return;
            }

            const appBody = document.getElementById('app-body');
            if (!appBody) return;

            // Base dimensions
            const cardBaseWidth = 360;
            const cardBaseHeight = 256;
            const gapBase = 24;
            const padding = 48; // generous padding for safe containment

            const availableWidth = appBody.clientWidth - padding;
            const availableHeight = appBody.clientHeight - padding;
            const count = State.students.length;

            let bestScale = 0.3;
            let bestCols = 1;

            // Try different column counts (from 1 to count) to find the best fit
            for (let cols = 1; cols <= count; cols++) {
                const rows = Math.ceil(count / cols);
                const totalWidthNeeded = (cols * cardBaseWidth) + ((cols - 1) * gapBase);
                const totalHeightNeeded = (rows * cardBaseHeight) + ((rows - 1) * gapBase);

                const scaleW = availableWidth / totalWidthNeeded;
                const scaleH = availableHeight / totalHeightNeeded;

                // We want to fit within BOTH width and height
                const scale = Math.min(scaleW, scaleH);

                if (scale > bestScale) {
                    bestScale = scale;
                    bestCols = cols;
                }
            }

            // Constrain scale to reasonable limits
            bestScale = Math.min(Math.max(bestScale, 0.3), 1.2);

            // Explicitly set the number of columns to prevent auto-fill overflow
            document.documentElement.style.setProperty('--grid-cols', bestCols);
            UI.setCardSize(bestScale);
        },

        setCardSize: (val) => {
            State.cardSize = val;
            document.documentElement.style.setProperty('--card-scale', val);
        },

        updateCardLogs: (id) => {
            const s = State.students.find(x => x.id === id); if (!s) return;
            const cardEl = document.getElementById(`card-${id}`);
            if (!cardEl) return;
            const logContainer = cardEl.querySelector(`.custom-scrollbar`);
            const goodCounter = cardEl.querySelector(`.good-count`);
            const badCounter = cardEl.querySelector(`.bad-count`);

            if (logContainer) {
                logContainer.innerHTML = `
                    ${s.goodLogs.map((e, i) => `<span onclick="event.stopPropagation(); ClassTallyApp.Student.removeLastPoint(${s.id},'good')" class="tally-item text-xl select-none hover:opacity-50 drop-shadow-sm cursor-pointer">${e}</span>`).join('')}
                    ${s.badLogs.map(e => `<span onclick="event.stopPropagation(); ClassTallyApp.Student.removeLastPoint(${s.id},'bad')" class="tally-item text-lg grayscale opacity-80 hover:opacity-100 drop-shadow-sm cursor-pointer">${e}</span>`).join('')}
                    ${s.goodLogs.length === 0 && s.badLogs.length === 0 ? '<span class="text-xs text-slate-300 font-bold self-center w-full text-center mt-2 uppercase tracking-wide opacity-50">Empty</span>' : ''}
                `;
                logContainer.scrollTop = logContainer.scrollHeight;
            }
            if (goodCounter) goodCounter.textContent = s.goodLogs.length;
            if (badCounter) badCounter.textContent = s.badLogs.length;
        },

        render: (options = {}) => {
            const animate = options.animate || false;
            const container = document.getElementById('grid-container');
            if (State.students.length === 0) {
                document.getElementById('empty-state').style.display = 'flex';
                container.innerHTML = '';
                return;
            }
            document.getElementById('empty-state').style.display = 'none';

            container.innerHTML = State.students.map((s, index) => {
                const goodCount = s.goodLogs.length;
                const badCount = s.badLogs.length;

                // Add a class if the student has been picked in the current cycle
                const pickedClass = State.pickedQueue.includes(s.id) ? 'opacity-70 border-b-4 border-slate-300' : '';
                const animationClass = animate ? 'animate-pop-in opacity-0' : '';
                const animationStyle = animate ? `animation-delay: ${index * 0.05}s; animation-fill-mode: forwards;` : '';

                const rankBadge = (State.showRankings && index < 3) ? `
                    <div class="absolute -top-1 -left-1 z-30 w-12 h-12 flex items-center justify-center pointer-events-none drop-shadow-lg animate-pop-in" style="animation-delay: ${(index * 0.05) + 0.3}s; animation-fill-mode: both;">
                        <div class="relative w-full h-full flex items-center justify-center">
                            <svg class="absolute w-full h-full" viewBox="0 0 100 100">
                                <defs>
                                    <linearGradient id="grad-${index}" x1="0%" y1="0%" x2="100%" y2="100%">
                                        ${index === 0 ? '<stop offset="0%" style="stop-color:#fbbf24"/><stop offset="100%" style="stop-color:#d97706"/>' : 
                                          index === 1 ? '<stop offset="0%" style="stop-color:#94a3b8"/><stop offset="100%" style="stop-color:#475569"/>' : 
                                          '<stop offset="0%" style="stop-color:#b45309"/><stop offset="100%" style="stop-color:#78350f"/>'}
                                    </linearGradient>
                                </defs>
                                <path d="M50 5 L63 35 L95 35 L70 55 L80 85 L50 65 L20 85 L30 55 L5 35 L37 35 Z" fill="url(#grad-${index})" stroke="white" stroke-width="2" />
                            </svg>
                            <span class="relative z-10 text-[10px] font-black text-white mt-1">
                                ${index + 1}${index === 0 ? 'st' : index === 1 ? 'nd' : 'rd'}
                            </span>
                        </div>
                    </div>
                ` : '';

                return `
                <div id="card-${s.id}" class="app-panel rounded-[2rem] flex flex-row relative overflow-hidden bg-white hover:border-slate-200 group transition-all duration-300 ${pickedClass} ${animationClass}" style="${animationStyle}">
                    ${rankBadge}
                    
                    <div class="w-32 sm:w-40 flex-none relative flex flex-col items-center justify-center p-2 transition-colors duration-300 border-r border-black/5" style="background-color: ${s.cardColor}; background-image: radial-gradient(circle, rgba(255,255,255,0.15) 2px, transparent 2.5px); background-size: 14px 14px;">
                        <div class="absolute inset-0 bg-gradient-to-b from-black/0 to-black/10"></div>
                        
                        <div class="w-24 h-24 rounded-full bg-white p-1.5 shadow-xl ring-4 ring-white/20 relative z-10 mb-4 transform group-hover:scale-105 transition-transform duration-300">
                             <div class="w-full h-full rounded-full bg-slate-50 flex items-center justify-center text-5xl select-none overflow-hidden">
                                <span class="filter drop-shadow-sm group-hover:scale-110 transition-transform duration-500 block">${s.avatar || '😀'}</span>
                            </div>
                        </div>

                        <!-- Numeric Counters -->
                        <div class="flex gap-2 relative z-10">
                            <div class="bg-white/90 backdrop-blur-sm px-2 py-0.5 rounded-full text-xs font-black text-brand-green flex items-center gap-1 shadow-sm">
                                <span>${State.currentGood}</span><span class="good-count">${s.goodLogs.length}</span>
                            </div>
                            <div class="bg-white/90 backdrop-blur-sm px-2 py-0.5 rounded-full text-xs font-black text-brand-pink flex items-center gap-1 shadow-sm">
                                <span>${State.currentBad}</span><span class="bad-count">${s.badLogs.length}</span>
                            </div>
                        </div>
                    </div>

                    <div class="flex-1 flex flex-col p-4 min-w-0 justify-between relative bg-gradient-to-br from-white to-slate-50">
                        <div class="flex justify-between items-start mb-2 pl-1 pt-1">
                            <div class="flex-1 min-w-0 pr-2">
                                ${s.signatureData ?
                        `<img src="${s.signatureData}" class="h-16 object-contain -ml-2" alt="Signature" />` :
                        `<h3 class="text-3xl font-black text-slate-800 truncate tracking-tight leading-none cursor-text hover:text-brand-blue transition-colors" title="Click to edit name" onclick="ClassTallyApp.Student.editStudent(${s.id})">${s.name}</h3>`
                    }
                            </div>
                            <div class="flex gap-1 -mt-2 -mr-2">
                                <button onclick="ClassTallyApp.Student.editStudent(${s.id})" title="Edit Name" class="text-slate-300 hover:text-brand-blue p-2 rounded-xl hover:bg-blue-50 transition-colors">
                                    <i data-lucide="pencil" class="w-4 h-4"></i>
                                </button>
                                <button onclick="ClassTallyApp.Student.emptyScore(${s.id})" title="Reset Score" class="text-slate-300 hover:text-brand-orange p-2 rounded-xl hover:bg-orange-50 transition-colors">
                                    <i data-lucide="rotate-ccw" class="w-4 h-4"></i>
                                </button>
                                <button onclick="ClassTallyApp.Student.remove(${s.id})" title="Delete Student" class="text-slate-300 hover:text-red-400 p-2 rounded-xl hover:bg-red-50 transition-colors">
                                    <i data-lucide="x" class="w-5 h-5"></i>
                                </button>
                            </div>
                        </div>

                        <div class="flex-grow bg-white rounded-xl border border-slate-100 p-2.5 mb-4 relative group/logs overflow-hidden shadow-inner">
                             <div class="custom-scrollbar flex flex-wrap content-start gap-1.5 h-full overflow-y-auto w-full">
                                ${s.goodLogs.map((e, i) => `<span onclick="event.stopPropagation(); ClassTallyApp.Student.removeLastPoint(${s.id},'good')" class="tally-item text-xl select-none hover:opacity-50 drop-shadow-sm cursor-pointer">${e}</span>`).join('')}
                                ${s.badLogs.map(e => `<span onclick="event.stopPropagation(); ClassTallyApp.Student.removeLastPoint(${s.id},'bad')" class="tally-item text-lg grayscale opacity-80 hover:opacity-100 drop-shadow-sm cursor-pointer">${e}</span>`).join('')}
                                ${s.goodLogs.length === 0 && s.badLogs.length === 0 ? '<span class="text-xs text-slate-300 font-bold self-center w-full text-center mt-2 uppercase tracking-wide opacity-50">Empty</span>' : ''}
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

    // --- KEYBOARD ---
    const Keyboard = {
        keys: [
            ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
            ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
            ['Z', 'X', 'C', 'V', 'B', 'N', 'M', '⌫'] // Backspace
        ],
        init: () => {
            const kb = document.getElementById('virtual-keyboard');
            if (!kb) return;
            kb.innerHTML = Keyboard.keys.map((row, i) => `
                <div class="flex justify-center gap-1.5 sm:gap-2 w-full ${i === 1 ? 'px-2 sm:px-4' : i === 2 ? 'px-4 sm:px-8' : ''}">
                    ${row.map(k => `
                        <button onclick="ClassTallyApp.Keyboard.press('${k}')" style="flex: ${k === '⌫' ? '1.5' : '1'};" 
                            class="h-[3.25rem] sm:h-14 bg-white dark:bg-slate-800 border-2 border-b-[4px] sm:border-b-[5px] border-slate-200 dark:border-slate-900 rounded-xl font-bold text-lg text-slate-700 dark:text-slate-200 shadow-sm active:translate-y-1 active:border-b-2 active:mt-1 transition-all flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-700">
                            ${k === '⌫' ? '<i data-lucide="delete" class="w-5 h-5 pointer-events-none"></i>' : k}
                        </button>
                    `).join('')}
                </div>
            `).join('');

            // Add a space bar row
            kb.innerHTML += `
                <div class="flex justify-center w-full mt-1">
                    <button onclick="ClassTallyApp.Keyboard.press(' ')" style="flex: 1;" 
                        class="h-[3.25rem] sm:h-14 bg-white dark:bg-slate-800 border-2 border-b-[4px] sm:border-b-[5px] border-slate-200 dark:border-slate-900 rounded-xl font-bold text-sm text-slate-500 shadow-sm active:translate-y-1 active:border-b-2 active:mt-1 transition-all flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-700 uppercase tracking-widest">
                        SPACE
                    </button>
                </div>
            `;
        },
        press: (key) => {
            const input = document.getElementById('student-name-input');
            if (key === '⌫') {
                input.value = input.value.slice(0, -1);
            } else {
                // If it is capital letters for names, we might want to auto correct case later or just let them type caps.
                // For a class tally, uppercase names are fine.
                // Let's implement auto-capitalization: 
                // Only capitalize if it's the first letter or after a space
                if (key !== ' ' && key !== '⌫') {
                    if (input.value.length === 0 || input.value.slice(-1) === ' ') {
                        input.value += key.toUpperCase();
                    } else {
                        input.value += key.toLowerCase();
                    }
                } else {
                    input.value += key;
                }
            }
            if (Audio && Audio.playTick && State.soundEnabled) {
                // Play a very subtle sound
                let origVolume = State.soundEnabled;
                // We don't want a loud tick for every keyboard press, so maybe we use a standard browser click or a very quiet sound.
                // Since our audio is basic tone, let's just make it shorter
                // Actually Audio module only checks for State.soundEnabled
            }

            // Re-trigger input event just in case
            input.dispatchEvent(new Event('input', { bubbles: true }));
            // Keep focus (mobile keyboards might pop up if we call input.focus(), so we might NOT to call input.focus() 
            // to prevent the native keyboard from showing up when they use the virtual one.
            // But if we don't, caret might be lost. 
            // A good compromise is just setting the value without focus since the input is visible.
        }
    };

    return {
        init: async () => {
            UI.initTheme();
            await Persistence.load();
            CanvasDraw.init('signature-canvas');
            UI.initEmojiPickers();
            Keyboard.init();
            UI.render();
            UI.updateAutoFitUI();
            UI.renderClassSets();

            if (State.isAutoFit) {
                UI.calculateAutoFitScale();
            } else {
                UI.setCardSize(State.cardSize);
            }

            // Resize observer for Auto-Fit
            const resizeObserver = new ResizeObserver(() => {
                if (State.isAutoFit) UI.calculateAutoFitScale();
            });
            resizeObserver.observe(document.getElementById('app-body'));

            document.addEventListener('click', UI.closeAllDropdowns);
            document.getElementById('btn-sound').innerHTML = State.soundEnabled ? '<i data-lucide="volume-2" class="w-5 h-5"></i>' : '<i data-lucide="volume-x" class="w-5 h-5 text-red-400"></i>';
            lucide.createIcons();
        },
        Student, Teams, UI, Timer, CanvasDraw, Keyboard
    };
})();

window.onload = async function () {
    await requireAuth()
    await ClassTallyApp.init()
}