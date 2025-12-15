        lucide.createIcons();
        const LS_KEY = 'crosswordNeoWords_v3';
        
        // --- STATE ---
        let GRID_SIZE = 15;
        let CELL_SIZE = 45; 
        let grid = [];
        let words = []; 
        let currentFocus = { r: -1, c: -1 };
        let currentDir = 'across'; 

        // --- AUDIO ---
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const playTone = (freq, type, duration) => {
            if (audioCtx.state === 'suspended') audioCtx.resume();
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
            gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start();
            osc.stop(audioCtx.currentTime + duration);
        };
        const Sound = {
            type: () => playTone(800, 'sine', 0.05),
            back: () => playTone(600, 'sine', 0.05),
            click: () => playTone(400, 'triangle', 0.05),
            success: () => { playTone(500, 'sine', 0.1); setTimeout(() => playTone(1000, 'sine', 0.2), 100); },
            error: () => playTone(150, 'sawtooth', 0.2)
        };

        // --- ELEMENTS ---
        const els = {
            grid: document.getElementById('crossword-grid'),
            across: document.getElementById('clues-across'),
            down: document.getElementById('clues-down'),
            input: document.getElementById('word-input'),
            controls: document.getElementById('controls')
        };

        // --- PERSISTENCE ---
        function saveWords(text) {
             try { localStorage.setItem(LS_KEY, text); } catch (e) { console.error("Could not save words:", e); }
        }

        function loadWords() {
            try {
                const savedWords = localStorage.getItem(LS_KEY);
                if (savedWords) els.input.value = savedWords;
            } catch (e) { console.error("Could not load words:", e); }
        }

        // --- UI & UTILS ---
        function toggleControlPanel(forceHide = false) {
            const isHidden = window.innerWidth >= 768 
                ? els.controls.classList.contains('hidden-panel-desktop')
                : els.controls.classList.contains('hidden-panel-mobile');
            
            if(forceHide || !isHidden) els.controls.classList.add('hidden-panel-mobile', 'hidden-panel-desktop');
            else els.controls.classList.remove('hidden-panel-mobile', 'hidden-panel-desktop');
        }

        function updateGridSize() {
            document.querySelectorAll('.cw-cell.filled').forEach(el => {
                el.style.width = `${CELL_SIZE}px`;
                el.style.height = `${CELL_SIZE}px`;
            });
            // Also adjust input font size for zoom effect
            document.querySelectorAll('.cw-cell input').forEach(input => {
                const fontSize = Math.max(1.2, CELL_SIZE / 30);
                input.style.fontSize = `${fontSize}rem`;
            });
            document.querySelectorAll('.cw-number').forEach(num => {
                const numSize = Math.max(0.6, CELL_SIZE / 60);
                num.style.fontSize = `${numSize}rem`;
            });
        }
        
        // --- LAYOUT ENGINE (Core Logic) ---
        
        function generateLayout(inputWords) {
            grid = Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(null)); 
            words = [];
            const first = inputWords[0];
            
            // Check if grid size can even fit the longest word
            if (first.word.length > GRID_SIZE) {
                console.error("Longest word is too long for the current grid size.");
                return false; 
            }

            // Place first word centered
            placeWord(first, Math.floor(GRID_SIZE/2), Math.floor((GRID_SIZE - first.word.length)/2), 'across');
            
            const remaining = inputWords.slice(1);
            let placedCount = 0;

            for(let pass = 0; pass < 50; pass++) { 
                remaining.forEach(item => {
                    if(!item.placed) if(tryFitWord(item)) { item.placed = true; placedCount++; }
                });
                if(remaining.every(w => w.placed)) break;
            }

            words = words.filter(w => w.placed || w === words[0]); 
            words.sort((a,b) => (a.row - b.row) || (a.col - b.col));
            
            let num = 1;
            words.forEach((w, i) => {
                const existing = words.slice(0, i).find(prev => prev.row === w.row && prev.col === w.col && prev.dir !== w.dir);
                w.num = existing ? existing.num : num++;
            });
            return words.length >= Math.min(inputWords.length, 2); 
        }

        function placeWord(item, r, c, dir) {
            words.push({ ...item, row: r, col: c, dir: dir, placed: true });
            for(let i=0; i<item.word.length; i++) {
                const row = dir === 'across' ? r : r + i;
                const col = dir === 'across' ? c + i : c;
                grid[row][col] = item.word[i];
            }
        }

        function tryFitWord(item) {
            for(let i=0; i<item.word.length; i++) {
                const char = item.word[i];
                for(let r=0; r<GRID_SIZE; r++) {
                    for(let c=0; c<GRID_SIZE; c++) {
                        if(grid[r][c] === char) {
                            if(checkPlacement(item.word, r - i, c, 'down')) { placeWord(item, r - i, c, 'down'); return true; }
                            if(checkPlacement(item.word, r, c - i, 'across')) { placeWord(item, r, c - i, 'across'); return true; }
                        }
                    }
                }
            }
            return false;
        }

        function checkPlacement(word, startR, startC, dir) {
            // 1. Bounds Check
            if(startR < 0 || startC < 0) return false;
            if(dir === 'across' && startC + word.length > GRID_SIZE) return false;
            if(dir === 'down' && startR + word.length > GRID_SIZE) return false;

            // 2. Overlap, Neighbor, and End Caps Check
            for(let i=0; i<word.length; i++) {
                const r = dir === 'across' ? startR : startR + i;
                const c = dir === 'across' ? startC + i : startC;
                const currentVal = grid[r][c];
                const char = word[i];
                
                // A. Direct Collision (Letter Mismatch)
                if(currentVal !== null && currentVal !== char) return false;
                
                // B. Placing on an existing letter means it must be an intersection
                if (currentVal === char) {
                    // Check if placement continues parallel to an existing word (e.g., placing across word into another across word)
                    if (dir === 'across') {
                        // Check if left/right neighbors exist for an intersection point
                        if((c > 0 && grid[r][c-1] !== null) || (c < GRID_SIZE - 1 && grid[r][c+1] !== null)) {
                            // If intersection is NOT at the start/end of the existing word segment, reject (prevents 3-letter strings)
                            if (grid[r][c-1] === null && grid[r][c+1] === null) {} // OK, isolated cell
                            else if (grid[r][c-1] !== null && grid[r][c+1] !== null) return false; // Already middle of another across word
                            else {
                                // Must only place if the word continues in the opposite direction (down)
                                // This is already handled by the logic; no need to check parallel here if it's an intersection
                            }
                        }
                    }
                    if (dir === 'down') {
                        // Check if top/bottom neighbors exist for an intersection point
                        if((r > 0 && grid[r-1][c] !== null) || (r < GRID_SIZE - 1 && grid[r+1][c] !== null)) {
                            if (grid[r-1][c] === null && grid[r+1][c] === null) {}
                            else if (grid[r-1][c] !== null && grid[r+1][c] !== null) return false; 
                        }
                    }
                }


                // C. Social Distancing (Avoid touching words parallel) for EMPTY cells
                if(currentVal === null) {
                    if(dir === 'across') {
                        if(r > 0 && grid[r-1][c] !== null) return false; // Top
                        if(r < GRID_SIZE-1 && grid[r+1][c] !== null) return false; // Bottom
                    } else {
                        if(c > 0 && grid[r][c-1] !== null) return false; // Left
                        if(c < GRID_SIZE-1 && grid[r][c+1] !== null) return false; // Right
                    }
                }
            }

            // 3. End Caps Check (Ensure word doesn't accidentally extend another word)
            if(dir === 'across') {
                if(startC > 0 && grid[startR][startC-1] !== null) return false; 
                if(startC + word.length < GRID_SIZE && grid[startR][startC + word.length] !== null) return false; 
            } else {
                if(startR > 0 && grid[startR-1][startC] !== null) return false; 
                if(startR + word.length < GRID_SIZE && grid[startR + word.length][startC] !== null) return false; 
            }

            return true;
        }


        // --- RENDER ---
        function render() {
            els.grid.innerHTML = '';
            els.grid.style.gridTemplateColumns = `repeat(${GRID_SIZE}, 1fr)`;
            
            // Render Web Grid
            for(let r=0; r<GRID_SIZE; r++) {
                for(let c=0; c<GRID_SIZE; c++) {
                    const cell = document.createElement('div');
                    cell.className = 'cw-cell ' + (grid[r][c] ? 'filled' : 'empty');
                    cell.dataset.r = r; cell.dataset.c = c;
                    
                    // Set cell size dynamically
                    cell.style.width = `${CELL_SIZE}px`;
                    cell.style.height = `${CELL_SIZE}px`;

                    if(grid[r][c]) {
                        const startWord = words.find(w => w.row === r && w.col === c && (
                            (w.dir === 'across' && (words.findIndex(other => other.row === r && other.col === c && other.dir === 'down') === -1)) ||
                            (w.dir === 'down' && (words.findIndex(other => other.row === r && other.col === c && other.dir === 'across') === -1))
                        ));
                        
                        // Check if this is the start of *any* word
                        const isStart = words.some(w => w.row === r && w.col === c);

                        // Only add number if it's the start of a word
                        if(isStart) {
                            const wordWithNum = words.find(w => w.row === r && w.col === c);
                            const num = document.createElement('span');
                            num.className = 'cw-number';
                            num.innerText = wordWithNum.num;
                            cell.appendChild(num);
                        }

                        const input = document.createElement('input');
                        input.maxLength = 1;
                        input.dataset.r = r; input.dataset.c = c;
                        input.addEventListener('mousedown', (e) => handleCellClick(e, r, c));
                        input.addEventListener('keydown', (e) => handleKeyDown(e, r, c));
                        input.addEventListener('focus', () => updateHighlights(r, c));
                        input.addEventListener('blur', () => { 
                             // Remove focus highlights when blurred, unless an arrow key re-focused it
                             if(document.activeElement !== input) {
                                document.querySelectorAll('.cell-focused').forEach(el => el.classList.remove('cell-focused'));
                                document.querySelectorAll('.word-highlight').forEach(el => el.classList.remove('word-highlight'));
                                document.querySelectorAll('.clue-item.active').forEach(el => el.classList.remove('active'));
                             }
                        });
                        
                        cell.appendChild(input);
                    }
                    els.grid.appendChild(cell);
                }
            }

            // Render Clues
            els.across.innerHTML = ''; els.down.innerHTML = '';
            if(words.length === 0) {
                 els.across.innerHTML = '<p class="text-slate-400 text-sm">No words placed yet.</p>';
                 els.down.innerHTML = '<p class="text-slate-400 text-sm">No words placed yet.</p>';
            } else {
                 words.filter(w => w.dir === 'across').forEach(w => {
                    const li = document.createElement('div');
                    li.className = 'clue-item';
                    li.id = `clue-${w.num}-across`;
                    li.innerHTML = `<span class="font-bold text-blue mr-2">${w.num}.</span> ${w.clue}`;
                    li.onclick = () => selectWordByClue(w);
                    els.across.appendChild(li);
                });
                words.filter(w => w.dir === 'down').forEach(w => {
                    const li = document.createElement('div');
                    li.className = 'clue-item';
                    li.id = `clue-${w.num}-down`;
                    li.innerHTML = `<span class="font-bold text-pink mr-2">${w.num}.</span> ${w.clue}`;
                    li.onclick = () => selectWordByClue(w);
                    els.down.appendChild(li);
                });
            }
            
            updateGridSize();
            preparePrintVersion();
        }

        // --- INTERACTION ---
        function handleCellClick(e, r, c) {
            Sound.click();
            // If clicking the currently focused cell, switch direction
            if(currentFocus.r === r && currentFocus.c === c) currentDir = currentDir === 'across' ? 'down' : 'across';
            // Otherwise, determine preferred direction
            else {
                const hasAcross = words.some(w => w.dir === 'across' && r === w.row && c >= w.col && c < w.col + w.word.length);
                const hasDown = words.some(w => w.dir === 'down' && c === w.col && r >= w.row && r < w.row + w.word.length);
                if(hasAcross && !hasDown) currentDir = 'across';
                else if(!hasAcross && hasDown) currentDir = 'down';
            }
            updateHighlights(r, c);
        }

        function handleKeyDown(e, r, c) {
            const key = e.key.toUpperCase();
            
            // Allow typing letters A-Z
            if (key.length === 1 && key >= 'A' && key <= 'Z') {
                e.preventDefault(); 
                Sound.type();
                // If cell is locked, do nothing
                if (e.target.parentElement.classList.contains('locked')) return;
                
                e.target.value = key;
                
                // Immediately check word status after typing
                checkCurrentWordCompletion(r, c);
                
                // Smart Move
                jumpToNextCell(r, c);
                return;
            }

            if(e.key === 'Backspace' || e.key === 'Delete') {
                e.preventDefault(); 
                // If cell is locked, do nothing
                if (e.target.parentElement.classList.contains('locked')) return;

                if(e.target.value) {
                     e.target.value = ''; Sound.back();
                } else { 
                     Sound.back(); 
                     jumpToPrevCell(r, c); 
                }
            } 
            // Navigation
            else if(e.key === 'ArrowRight') focusCell(r, c+1);
            else if(e.key === 'ArrowLeft') focusCell(r, c-1);
            else if(e.key === 'ArrowDown') focusCell(r+1, c);
            else if(e.key === 'ArrowUp') focusCell(r-1, c);
            
            // Allow Enter to change direction
            else if(e.key === 'Enter') {
                e.preventDefault();
                currentDir = currentDir === 'across' ? 'down' : 'across';
                updateHighlights(r, c); // Re-highlight based on new direction
            }
        }
        
        // Jumps to the next available (unlocked) cell in the current direction
        function jumpToNextCell(r, c) {
            const dr = currentDir === 'across' ? 0 : 1;
            const dc = currentDir === 'across' ? 1 : 0;
            let nr = r + dr, nc = c + dc;
            
            for(let i=0; i<GRID_SIZE; i++) { // Max iterations to prevent infinite loop
                 const cell = document.querySelector(`.cw-cell[data-r="${nr}"][data-c="${nc}"]`);
                 
                 // If we hit the boundary of the grid or an empty cell, stop
                 if(!cell || !cell.classList.contains('filled')) break;

                 const input = cell.querySelector('input');
                 
                 // Found the next focusable cell if it's not locked
                 if(input && !cell.classList.contains('locked')) { 
                    focusCell(nr, nc); 
                    return; 
                 }
                 
                 // Move to next cell
                 nr += dr; nc += dc;
            }
            
            // If we finish the loop, we are at the end of the word/grid. Stay put.
        }
        
        // Jumps to the previous available (unlocked) cell in the current direction and clears it
        function jumpToPrevCell(r, c) {
             const dr = currentDir === 'across' ? 0 : -1;
             const dc = currentDir === 'across' ? -1 : 0;
             let pr = r + dr, pc = c + dc;

             for(let i=0; i<GRID_SIZE; i++) {
                 const cell = document.querySelector(`.cw-cell[data-r="${pr}"][data-c="${pc}"]`);
                 
                 if(!cell || !cell.classList.contains('filled')) break;
                 
                 const input = cell.querySelector('input');

                 if (input && !cell.classList.contains('locked')) {
                    input.value = '';
                    focusCell(pr, pc);
                    return;
                 }
                 
                 pr += dr; pc += dc;
             }
        }

        function checkCurrentWordCompletion(r, c) {
            // Find the word that contains this cell in the current direction
            const activeWord = words.find(w => 
                w.dir === currentDir && 
                (currentDir === 'across' ? (w.row === r && c >= w.col && c < w.col + w.word.length) 
                                         : (w.col === c && r >= w.row && r < w.row + w.word.length))
            );
            if(!activeWord) return;
            
            let guess = "", isFull = true;
            const els = [];
            for(let i=0; i<activeWord.word.length; i++) {
                const cr = activeWord.dir === 'across' ? activeWord.row : activeWord.row + i;
                const cc = activeWord.dir === 'across' ? activeWord.col + i : activeWord.col;
                const cell = document.querySelector(`.cw-cell[data-r="${cr}"][data-c="${cc}"]`);
                const val = cell.querySelector('input').value.toUpperCase();
                
                if(!val) { isFull = false; break; }
                guess += val; els.push(cell);
            }

            if(isFull) {
                if(guess === activeWord.word) {
                    Sound.success();
                    confetti({ particleCount: 30, spread: 40, origin: { y: 0.7 } });
                    // Lock cells
                    els.forEach(cell => { cell.classList.add('locked'); cell.classList.remove('word-highlight', 'cell-focused'); });
                    // Mark clue solved
                    const clueEl = document.getElementById(`clue-${activeWord.num}-${activeWord.dir}`);
                    if(clueEl) clueEl.classList.add('solved');
                } else {
                    Sound.error();
                    // Shake and highlight error
                    els.forEach(cell => { cell.classList.add('error'); setTimeout(() => cell.classList.remove('error'), 400); });
                }
            }
        }

        function focusCell(r, c) {
            const input = document.querySelector(`input[data-r="${r}"][data-c="${c}"]`);
            if(input) { 
                input.focus(); 
                updateHighlights(r, c); 
            }
        }

        function selectWordByClue(w) {
            currentDir = w.dir;
            focusCell(w.row, w.col);
            Sound.click();
        }

        function updateHighlights(r, c) {
            currentFocus = { r, c };
            // Clear previous
            document.querySelectorAll('.word-highlight').forEach(el => el.classList.remove('word-highlight'));
            document.querySelectorAll('.cell-focused').forEach(el => el.classList.remove('cell-focused'));
            document.querySelectorAll('.clue-item.active').forEach(el => el.classList.remove('active'));

            const focusedCell = document.querySelector(`.cw-cell[data-r="${r}"][data-c="${c}"]`);
            if(focusedCell) focusedCell.classList.add('cell-focused');

            // Find the word that contains this cell in the current direction
            const activeWord = words.find(w => 
                w.dir === currentDir && 
                (currentDir === 'across' ? (w.row === r && c >= w.col && c < w.col + w.word.length) 
                                         : (w.col === c && r >= w.row && r < w.row + w.word.length))
            );

            if(activeWord) {
                // Highlight word cells
                for(let i=0; i<activeWord.word.length; i++) {
                    const row = activeWord.dir === 'across' ? activeWord.row : activeWord.row + i;
                    const col = activeWord.dir === 'across' ? activeWord.col + i : activeWord.col;
                    const cell = document.querySelector(`.cw-cell[data-r="${row}"][data-c="${col}"]`);
                    if(cell && !cell.classList.contains('locked')) cell.classList.add('word-highlight');
                }
                // Highlight clue
                const clue = document.getElementById(`clue-${activeWord.num}-${activeWord.dir}`);
                if(clue) { 
                    clue.classList.add('active'); 
                    clue.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); 
                }
            }
        }

        function preparePrintVersion() {
            // Replicates grid for print area
            const printGrid = els.grid.cloneNode(true);
            printGrid.id = "print-grid-clone";
            printGrid.className = "print-grid";
            printGrid.style.gridTemplateColumns = `repeat(${GRID_SIZE}, 40px)`;
            
            // Remove interactive/highlight classes for printing
            printGrid.querySelectorAll('.cw-cell').forEach(cell => {
                cell.classList.remove('cell-focused', 'word-highlight', 'locked', 'error');
                // Clear inputs unless solution is revealed (not implemented in the print prep but good practice)
                const input = cell.querySelector('input');
                if(input) input.value = ''; 
            });

            document.getElementById('print-grid-container').innerHTML = '';
            document.getElementById('print-grid-container').appendChild(printGrid);
            
            // Prepare Clues
            const pa = document.getElementById('print-clues-across');
            const pd = document.getElementById('print-clues-down');
            pa.innerHTML = '<h3 class="font-bold border-b border-black mb-2 uppercase">Across</h3>';
            pd.innerHTML = '<h3 class="font-bold border-b border-black mb-2 uppercase">Down</h3>';
            
            words.forEach(w => {
                const div = document.createElement('div');
                div.className = 'print-clue';
                div.innerHTML = `<strong>${w.num}.</strong> ${w.clue}`;
                if(w.dir === 'across') pa.appendChild(div); else pd.appendChild(div);
            });
        }


        // --- INIT & EVENTS ---
        document.getElementById('generate-btn').onclick = () => {
            const lines = els.input.value.split('\n').filter(l => l.includes(':'));
            saveWords(els.input.value);
            
            if(lines.length < 2) { console.error("Please add at least 2 words!"); return; }

            const inputData = lines.map(l => {
                const [w, c] = l.split(':');
                return { word: w.trim().toUpperCase().replace(/[^A-Z]/g, ''), clue: c.trim() };
            }).sort((a,b) => b.word.length - a.word.length);

            if(generateLayout(inputData)) {
                render();
                if(window.innerWidth < 768) toggleControlPanel(true);
                confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 }, colors: ['#2979FF', '#FF6B95'] });
            } else { 
                console.error("Could not fit all words. Try increasing grid size.");
                // Provide visual feedback instead of an alert
                document.getElementById('generate-btn').classList.add('bg-pink', 'animate-shake');
                setTimeout(() => {
                    document.getElementById('generate-btn').classList.remove('bg-pink', 'animate-shake');
                }, 400);
            }
        };

        document.getElementById('solution-btn').onclick = () => {
            document.querySelectorAll('.cw-cell input').forEach(inp => {
                const r = inp.dataset.r;
                const c = inp.dataset.c;
                inp.value = grid[r][c];
                inp.parentElement.classList.add('locked');
            });
            // Mark all clues solved when revealing
            document.querySelectorAll('.clue-item').forEach(el => el.classList.add('solved'));
            Sound.success();
        };

        document.querySelectorAll('.preset-btn').forEach(b => {
            b.onclick = () => { els.input.value = b.dataset.text; saveWords(b.dataset.text); }
        });
        
        document.querySelectorAll('.grid-btn').forEach(b => {
            b.onclick = (e) => {
                document.querySelectorAll('.grid-btn').forEach(btn => {
                    btn.classList.remove('bg-blue', 'text-white', 'shadow-hard-sm');
                    btn.classList.add('bg-slate-100', 'text-slate-400');
                });
                e.target.classList.remove('bg-slate-100', 'text-slate-400');
                e.target.classList.add('bg-blue', 'text-white', 'shadow-hard-sm');
                GRID_SIZE = parseInt(e.target.dataset.size);
            }
        });

        document.getElementById('zoom-in').onclick = () => { CELL_SIZE = Math.min(CELL_SIZE + 5, 80); updateGridSize(); };
        document.getElementById('zoom-out').onclick = () => { CELL_SIZE = Math.max(CELL_SIZE - 5, 25); updateGridSize(); };
        
        // Initial setup
        window.onload = () => {
            loadWords();
            els.input.addEventListener('input', (e) => saveWords(e.target.value));
            
            // Set default grid size button style
            document.querySelector('.grid-btn[data-size="15"]').click();

            // Auto-hide controls on mobile
            if(window.innerWidth < 768) toggleControlPanel(true);
        };