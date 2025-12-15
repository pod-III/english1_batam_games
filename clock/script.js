        // --- GLOBAL STATE ---
        let currentTool = 'clock';

        // --- CLOCK STATE ---
        let is24Hour = false;
        let isAnalog = false;

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
        let tMode = 'calm'; // calm (Green) or bomb (Orange)
        let audioCtx;

        // --- CALENDAR STATE ---
        let calDate = new Date();
        let calMarked = {};
        let calSelected = null;

        // --- INITIALIZATION ---
        window.onload = function () {
            lucide.createIcons();
            
            // Init Clock
            initClockFace();
            setInterval(updateClock, 1000);
            updateClock();

            // Init Calendar
            loadCalData();
            renderCalendar();

            // Init Default Tool
            switchTool('clock');
            
            // Ensure inputs parse correctly
            document.querySelectorAll('input[type="number"]').forEach(input => {
                input.addEventListener('change', function() {
                    let val = parseInt(this.value);
                    if(isNaN(val) || val < 0) val = 0;
                    if(val > 99) val = 99;
                    this.value = String(val).padStart(2, '0');
                });
            });
        };

        // --- ROUTER ---
        function switchTool(toolId) {
            // Update Sidebar
            document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
            const navBtn = document.getElementById(`nav-${toolId}`);
            if (navBtn) navBtn.classList.add('active');

            // Hide Sections
            document.querySelectorAll('section').forEach(el => {
                el.classList.add('hidden');
                el.classList.remove('flex');
            });

            // Show Target
            const target = document.getElementById(`tool-${toolId}`);
            target.classList.remove('hidden');
            target.classList.add('flex');
            currentTool = toolId;
            
            lucide.createIcons();
        }

        // --- CLOCK LOGIC ---
        function initClockFace() {
            const markers = document.getElementById('clock-face-markers');
            if (!markers) return;
            markers.innerHTML = '';
            for (let i = 0; i < 60; i++) {
                const angle = i * 6;
                const isHour = i % 5 === 0;
                const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
                line.setAttribute("x1", "50"); line.setAttribute("y1", "4");
                line.setAttribute("x2", "50"); line.setAttribute("y2", 4 + (isHour ? 7 : 2));
                line.setAttribute("stroke", "#cbd5e1");
                line.setAttribute("stroke-width", isHour ? "2" : "1");
                line.setAttribute("transform", `rotate(${angle} 50 50)`);
                markers.appendChild(line);
            }
        }

        function updateClock() {
            const now = new Date();
            let h = now.getHours();
            const m = String(now.getMinutes()).padStart(2, '0');
            const s = String(now.getSeconds()).padStart(2, '0');

            // Digital Logic
            let dh = h;
            let ampm = h >= 12 ? 'PM' : 'AM';
            if (!is24Hour) {
                dh = h % 12 || 12;
            } else {
                dh = String(dh).padStart(2, '0');
            }

            const timeEl = document.getElementById('clock-time');
            if (timeEl) {
                timeEl.innerText = `${dh}:${m}`;
                document.getElementById('clock-sec-dig').innerText = s;
                const ampmEl = document.getElementById('clock-ampm');
                ampmEl.innerText = ampm;
                ampmEl.style.display = is24Hour ? 'none' : 'block';

                const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
                const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
                const dateStr = `${days[now.getDay()]}, ${months[now.getMonth()]} ${now.getDate()}`;
                document.getElementById('clock-date').innerText = dateStr;
                const anaDate = document.getElementById('clock-date-analog');
                if (anaDate) anaDate.innerText = dateStr;
            }

            // Analog Logic
            const secRatio = now.getSeconds() / 60;
            const minRatio = (now.getMinutes() + secRatio) / 60;
            const hourRatio = (now.getHours() % 12 + minRatio) / 12;

            const handSec = document.getElementById('hand-sec');
            const handMin = document.getElementById('hand-min');
            const handHour = document.getElementById('hand-hour');

            if (handSec) handSec.setAttribute('transform', `rotate(${secRatio * 360} 50 50)`);
            if (handMin) handMin.setAttribute('transform', `rotate(${minRatio * 360} 50 50)`);
            if (handHour) handHour.setAttribute('transform', `rotate(${hourRatio * 360} 50 50)`);
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

            if (isAnalog) {
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

        // --- STOPWATCH LOGIC ---
        function swToggle() {
            const btn = document.getElementById('sw-btn-main');
            const indicator = document.getElementById('sw-indicator');

            if (swRunning) {
                clearInterval(swInterval);
                swRunning = false;
                btn.innerHTML = '<i data-lucide="play" class="w-8 h-8 fill-current ml-1"></i>';
                btn.classList.remove('bg-orange'); btn.classList.add('bg-blue');
                indicator.classList.remove('bg-green', 'animate-pulse'); indicator.classList.add('bg-slate-300');
            } else {
                swStartTime = Date.now() - swElapsed;
                swInterval = setInterval(() => {
                    swElapsed = Date.now() - swStartTime;
                    swUpdateDisplay();
                }, 10);
                swRunning = true;
                btn.innerHTML = '<i data-lucide="pause" class="w-8 h-8 fill-current"></i>';
                btn.classList.remove('bg-blue'); btn.classList.add('bg-orange');
                indicator.classList.remove('bg-slate-300'); indicator.classList.add('bg-green', 'animate-pulse');
            }
            lucide.createIcons();
        }

        function swReset() {
            if (swRunning) swToggle();
            swElapsed = 0;
            swLaps = [];
            swUpdateDisplay();
            document.getElementById('sw-laps').innerHTML = '<div class="flex flex-col items-center justify-center h-full text-slate-400 gap-2 opacity-60"><i data-lucide="ghost" class="w-6 h-6"></i><span class="text-xs font-bold">NO LAPS RECORDED</span></div>';
            document.getElementById('sw-ring').style.strokeDashoffset = 0;
            lucide.createIcons();
        }

        function swUpdateDisplay() {
            const date = new Date(swElapsed);
            const m = String(date.getUTCMinutes()).padStart(2, '0');
            const s = String(date.getUTCSeconds()).padStart(2, '0');
            const ms = String(Math.floor(date.getUTCMilliseconds() / 10)).padStart(2, '0');
            document.getElementById('sw-display').innerText = `${m}:${s}`;
            document.getElementById('sw-ms').innerText = `.${ms}`;

            // Ring Animation (60s loop)
            const sec = (swElapsed / 1000) % 60;
            const offset = 283 - (sec / 60) * 283;
            document.getElementById('sw-ring').style.strokeDashoffset = offset;
        }

        function swLap() {
            if (swElapsed === 0) return;
            const lapTime = swElapsed;
            const prevLap = swLaps.length > 0 ? swLaps[0].total : 0;
            const split = lapTime - prevLap;
            swLaps.unshift({ total: lapTime, split: split, id: swLaps.length + 1 });

            const container = document.getElementById('sw-laps');
            const lapHtml = `<div class="flex justify-between items-center py-2 border-b border-slate-200 last:border-0 hover:bg-white px-2 rounded-lg transition-colors">
                <span class="font-bold text-slate-400 w-8 text-xs">#${swLaps.length}</span>
                <span class="font-mono text-dark font-bold text-base">${formatTime(lapTime)}</span>
                <span class="text-[0.6rem] text-blue font-bold bg-blue/10 px-2 py-1 rounded">+${formatTime(split)}</span>
            </div>`;

            if (swLaps.length === 1) container.innerHTML = '';
            container.innerHTML = lapHtml + container.innerHTML;
        }

        function formatTime(ms) {
            const d = new Date(ms);
            return `${String(d.getUTCMinutes()).padStart(2, '0')}:${String(d.getUTCSeconds()).padStart(2, '0')}.${String(Math.floor(d.getUTCMilliseconds() / 10)).padStart(2, '0')}`;
        }

        // --- TIMER LOGIC ---
        function initAudio() {
            if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }

        function timerSetMode(mode) {
            tMode = mode;
            const card = document.getElementById('timer-card');
            const btnStart = document.getElementById('timer-btn-start');
            const zenVis = document.getElementById('timer-visual-zen');
            const rushVis = document.getElementById('timer-visual-rush');
            const btnCalm = document.getElementById('btn-mode-calm');
            const btnBomb = document.getElementById('btn-mode-bomb');

            if (!zenVis || !rushVis) return;

            btnCalm.classList.remove('bg-green', 'text-white', 'shadow-hard-sm');
            btnBomb.classList.remove('bg-orange', 'text-white', 'shadow-hard-sm');

            if (mode === 'calm') {
                btnCalm.classList.add('bg-green', 'text-white', 'shadow-hard-sm');
                zenVis.classList.remove('hidden', 'opacity-0');
                rushVis.classList.add('hidden', 'opacity-0');
                rushVis.classList.remove('flex');
                btnStart.className = "btn-chunky w-24 h-24 rounded-3xl bg-green border-4 border-dark text-white flex items-center justify-center mx-4 hover:scale-105 transition-transform shadow-hard-lg";
                card.classList.remove('border-orange');
            } else {
                btnBomb.classList.add('bg-orange', 'text-white', 'shadow-hard-sm');
                zenVis.classList.add('hidden', 'opacity-0');
                rushVis.classList.remove('hidden');
                setTimeout(() => rushVis.classList.remove('opacity-0'), 10);
                rushVis.classList.add('flex');
                btnStart.className = "btn-chunky w-24 h-24 rounded-3xl bg-orange border-4 border-dark text-white flex items-center justify-center mx-4 hover:scale-105 transition-transform shadow-hard-lg";
                card.classList.add('border-orange');
            }
            timerUpdateInputs();
        }

        function timerAdjust(sec) {
            let m = parseInt(document.getElementById('t-min').value) || 0;
            let s = parseInt(document.getElementById('t-sec').value) || 0;
            let total = (m * 60) + s + sec;
            if (total < 0) total = 0;
            tTimeLeft = total;
            tInitial = Math.max(tInitial, total); // Adjust initial so bar doesn't jump
            timerUpdateInputs();
        }

        function timerUpdateInputs() {
            if (tTimeLeft < 0) tTimeLeft = 0;
            const mStr = String(Math.floor(tTimeLeft / 60)).padStart(2, '0');
            const sStr = String(tTimeLeft % 60).padStart(2, '0');
            document.getElementById('t-min').value = mStr;
            document.getElementById('t-sec').value = sStr;
            const rushDisp = document.getElementById('t-rush-display');
            if (rushDisp) rushDisp.innerText = `${mStr}:${sStr}`;
        }

        function timerToggle() {
            initAudio();
            if (tRunning) {
                timerStop();
            } else {
                let m = parseInt(document.getElementById('t-min').value) || 0;
                let s = parseInt(document.getElementById('t-sec').value) || 0;
                tTimeLeft = (m * 60) + s;
                if (tTimeLeft <= 0) return;

                tInitial = Math.max(tInitial, tTimeLeft);
                tRunning = true;
                
                const btn = document.getElementById('timer-btn-start');
                btn.innerHTML = '<i data-lucide="pause" class="w-12 h-12 fill-current"></i>';

                tInterval = setInterval(() => {
                    tTimeLeft--;
                    if (tTimeLeft < 0) tTimeLeft = 0;
                    timerUpdateInputs();

                    if (tTimeLeft > 0) playTick();

                    const pct = (tTimeLeft / tInitial);
                    if (tMode === 'calm') {
                        const ring = document.getElementById('timer-ring-zen');
                        if (ring) ring.style.strokeDashoffset = 283 - (pct * 283);
                    } else {
                        const fuse = document.getElementById('timer-fuse-rush');
                        if (fuse) fuse.style.strokeDashoffset = 100 - (pct * 100);
                        if (tTimeLeft <= 10) document.getElementById('timer-card').classList.add('shake-hard');
                    }

                    if (tTimeLeft === 0) timerFinish();
                }, 1000);
            }
            lucide.createIcons();
        }

        function timerFinish() {
            timerStop();
            document.getElementById('timer-card').classList.remove('shake-hard');
            
            let overlay;
            if (tMode === 'bomb') {
                overlay = document.getElementById('explosion-overlay');
            } else {
                overlay = document.getElementById('zen-overlay');
            }
            
            if (overlay) {
                // Ensure the button on the overlay triggers the reset function
                const overlayButton = overlay.querySelector('button');
                if (overlayButton) overlayButton.onclick = resetTimerOverlay;
                
                overlay.style.display = 'flex';
                setTimeout(() => overlay.style.opacity = '1', 10);
            }
            playChime();
        }

        function timerStop() {
            clearInterval(tInterval);
            tRunning = false;
            const btn = document.getElementById('timer-btn-start');
            if (btn) btn.innerHTML = '<i data-lucide="play" class="w-12 h-12 fill-current ml-1"></i>';
            lucide.createIcons();
        }

        function timerReset() {
            timerStop();
            document.getElementById('t-min').value = '05';
            document.getElementById('t-sec').value = '00';
            tTimeLeft = 300;
            timerUpdateInputs();
            const ring = document.getElementById('timer-ring-zen');
            if (ring) ring.style.strokeDashoffset = 0;
            const fuse = document.getElementById('timer-fuse-rush');
            if (fuse) fuse.style.strokeDashoffset = 0;
            document.getElementById('timer-card').classList.remove('shake-hard');
        }

        function resetTimerOverlay() {
            const rushOverlay = document.getElementById('explosion-overlay');
            const zenOverlay = document.getElementById('zen-overlay');

            [rushOverlay, zenOverlay].forEach(overlay => {
                if (overlay) {
                    overlay.style.opacity = '0';
                    setTimeout(() => overlay.style.display = 'none', 300);
                }
            });
            
            timerReset();
        }

        // --- AUDIO ---
        function playTick() {
            if (!audioCtx) return;
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.frequency.value = tMode === 'bomb' ? 800 : 400;
            osc.type = tMode === 'bomb' ? 'square' : 'sine';
            gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.05);
            osc.connect(gain); gain.connect(audioCtx.destination);
            osc.start(); osc.stop(audioCtx.currentTime + 0.05);
        }

        function playChime() {
            if (!audioCtx) return;
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain); gain.connect(audioCtx.destination);
            osc.frequency.value = 523.25; 
            gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 1.5);
            osc.start(); osc.stop(audioCtx.currentTime + 1.5);
        }

        // --- CALENDAR LOGIC ---
        function loadCalData() {
            try { calMarked = JSON.parse(localStorage.getItem('hub_calendar')) || {}; } catch { }
        }

        function calNav(delta) {
            calDate.setMonth(calDate.getMonth() + delta);
            renderCalendar();
        }

        function renderCalendar() {
            const grid = document.getElementById('cal-grid');
            grid.innerHTML = '';

            const monthNames = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];
            document.getElementById('cal-month-year').innerText = `${monthNames[calDate.getMonth()]} ${calDate.getFullYear()}`;

            const year = calDate.getFullYear();
            const month = calDate.getMonth();
            const firstDay = new Date(year, month, 1).getDay();
            const startOffset = (firstDay + 6) % 7; // Mon start

            // We generate 42 cells (6 rows) to keep grid stable
            const today = new Date();
            // Standardizing today's date string for comparison
            const todayStr = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;

            for (let i = 0; i < 42; i++) {
                // Calculate date for this cell
                const cellDate = new Date(year, month, 1 - startOffset + i);
                const dNum = cellDate.getDate();
                const dMonth = cellDate.getMonth();
                const dYear = cellDate.getFullYear();
                const dateStr = `${dYear}-${dMonth + 1}-${dNum}`; // Key for storage

                const isCurrMonth = dMonth === month;
                const isToday = (dateStr === todayStr); // Use the standardized string for a reliable check

                const cell = document.createElement('div');
                cell.className = 'cal-day rounded-lg border-2 flex flex-col items-center justify-center font-bold text-lg relative overflow-hidden shadow-sm';
                
                // --- Style based on state ---

                // 1. Base style (current vs. outside month)
                if (isCurrMonth) {
                    cell.classList.add('bg-white', 'border-slate-200', 'text-dark');
                } else {
                    cell.classList.add('bg-slate-50', 'border-transparent', 'text-slate-300', 'empty');
                }

                // 2. Highlight Today (Override base styling for today)
                if (isToday) {
                    // Remove standard border/bg/text
                    cell.classList.remove('bg-white', 'border-slate-200', 'text-dark', 'bg-slate-50', 'border-transparent', 'text-slate-300');
                    // Add distinct current day styling
                    cell.classList.add('bg-blue', 'text-white', 'border-dark', 'shadow-hard-sm', 'ring-4', 'ring-orange/50', 'ring-offset-2', 'z-10'); 
                    cell.style.setProperty('box-shadow', '0 0 0 2px var(--colors-dark), 0 0 0 6px var(--colors-orange)', 'important');
                } else {
                    // Ensure the box shadow doesn't interfere if it's not today
                    cell.style.setProperty('box-shadow', '', 'important');
                }


                // 3. Highlight Selected
                if (calSelected === dateStr) {
                    cell.classList.add('ring-2', 'ring-orange', 'z-10');
                }

                // 4. Mark Day
                if (calMarked[dateStr]) {
                    const dot = document.createElement('div');
                    dot.className = `absolute bottom-1 w-1.5 h-1.5 rounded-full ${isToday ? 'bg-white' : 'bg-pink'}`;
                    cell.appendChild(dot);
                }

                cell.innerText = dNum;

                // Event Listener
                cell.onclick = (e) => {
                    if (e.altKey) {
                        if (calMarked[dateStr]) delete calMarked[dateStr];
                        else calMarked[dateStr] = true;
                        localStorage.setItem('hub_calendar', JSON.stringify(calMarked));
                        renderCalendar();
                    } else {
                        calSelected = dateStr;
                        renderCalendar(); // Re-render to show selection ring
                        
                        // Calculate Diff
                        const cellDayStart = cellDate.setHours(0,0,0,0);
                        const todayDayStart = new Date().setHours(0,0,0,0);
                        const diffTime = Math.ceil((cellDayStart - todayDayStart) / (1000 * 60 * 60 * 24)); 
                        
                        let text = "TODAY";
                        if (diffTime > 0) text = `${diffTime} DAY${diffTime > 1 ? 'S' : ''} FROM NOW`;
                        if (diffTime < 0) text = `${Math.abs(diffTime)} DAY${Math.abs(diffTime) > 1 ? 'S' : ''} AGO`;
                        
                        document.getElementById('cal-counter-display').innerHTML = `
                            <span class="text-orange font-bold uppercase tracking-wider">${text}</span>
                            <span class="text-slate-400 text-xs ml-2 border-l pl-2 border-slate-300">${dYear}-${String(dMonth + 1).padStart(2, '0')}-${String(dNum).padStart(2, '0')}</span>
                        `;
                    }
                };

                grid.appendChild(cell);
            }
        }