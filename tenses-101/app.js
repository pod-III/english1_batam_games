const App = (function () {

    // --- STATE & INIT ---
    let currentTenseKey = 'presentSimple';
    let compareTenseKey = null;
    let isCompareMode = false;
    let isQuizMode = false;
    let currentQuizAnswer = null;
    let builderState = {
        active: false,
        tool: null,
        items: [] // {type: 'pin', l: 50}
    };

    const TENSE_KEYS = [
        'presentSimple', 'presentCont', 'presentPerfect', 'presentPerfectCont',
        'pastSimple', 'pastCont', 'pastPerfect', 'pastPerfectCont',
        'futureSimple', 'futureCont', 'futurePerfect', 'futurePerfectCont',
        'pastFutureSimple', 'pastFutureCont', 'pastFuturePerfect', 'pastFuturePerfectCont'
    ];

    function handleKeyDown(e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        if (isCompareMode || isQuizMode) return; // Disable navigation in special modes

        const currentIndex = TENSE_KEYS.indexOf(currentTenseKey);
        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
            e.preventDefault();
            if (currentIndex < TENSE_KEYS.length - 1) {
                loadTense(TENSE_KEYS[currentIndex + 1]);
                const activeBtn = document.getElementById(`nav-${TENSE_KEYS[currentIndex + 1]}`);
                if (activeBtn) activeBtn.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }
        } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
            e.preventDefault();
            if (currentIndex > 0) {
                loadTense(TENSE_KEYS[currentIndex - 1]);
                const activeBtn = document.getElementById(`nav-${TENSE_KEYS[currentIndex - 1]}`);
                if (activeBtn) activeBtn.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }
        }
    }

    function init() {
        if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        lucide.createIcons();
        renderSidebar();
        loadTense('presentSimple');
        document.addEventListener('keydown', handleKeyDown);
    }

    // --- VIEW LOGIC ---
    function renderSidebar() {
        const sidebarEl = document.getElementById('sidebar-content');
        sidebarEl.innerHTML = '';
        const groups = {
            green: { label: 'Present', keys: ['presentSimple', 'presentCont', 'presentPerfect', 'presentPerfectCont'] },
            pink: { label: 'Past', keys: ['pastSimple', 'pastCont', 'pastPerfect', 'pastPerfectCont'] },
            blue: { label: 'Future', keys: ['futureSimple', 'futureCont', 'futurePerfect', 'futurePerfectCont'] },
            orange: { label: 'Past Future', keys: ['pastFutureSimple', 'pastFutureCont', 'pastFuturePerfect', 'pastFuturePerfectCont'] }
        };
        for (const [color, group] of Object.entries(groups)) {
            const groupContainer = document.createElement('div');
            groupContainer.innerHTML = `
                <div class="flex items-center gap-2 mb-2 px-2">
                    <div class="w-2.5 h-2.5 rounded bg-brand-${color} border border-brand-dark dark:border-white/50"></div>
                    <span class="font-heading font-bold text-brand-dark dark:text-slate-200">${group.label}</span>
                </div>
                <div class="space-y-1">
                    ${group.keys.map(key => `
                        <button onclick="App.loadTense('${key}')" id="nav-${key}" 
                            class="nav-btn w-full text-left px-4 py-2.5 rounded-xl border-2 border-transparent font-bold text-slate-400 hover:text-brand-dark dark:hover:text-white transition-all hover:bg-slate-50 dark:hover:bg-slate-800 mb-1 text-sm flex items-center justify-between group">
                            <span>${TENSES[key].title}</span>
                            <div class="w-1.5 h-1.5 rounded-full bg-brand-${color} opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        </button>
                    `).join('')}
                </div>
            `;
            sidebarEl.appendChild(groupContainer);
        }
    }

    function loadTense(key) {
        if (isCompareMode) {
            if (key === currentTenseKey) return; // Prevent selecting same for both
            compareTenseKey = key;
            renderSidebar();
            renderCompareTense();
            document.getElementById('compare-timeline-container').classList.remove('opacity-50', 'pointer-events-none');
            document.getElementById('compare-tense-formula').parentElement.classList.remove('opacity-50');
            return; // Don't wipe out the primary tense
        }

        if (isQuizMode) return; // Disable navigation during quiz

        currentTenseKey = key;
        resetBuilder(false); // Reset builder state without clearing feedback immediately
        const data = TENSES[key];

        // Sidebar Logic
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.className = "nav-btn w-full text-left px-4 py-2.5 rounded-xl border-2 border-transparent font-bold text-slate-400 hover:text-brand-dark dark:hover:text-white transition-all hover:bg-slate-50 dark:hover:bg-slate-800 mb-1 text-sm flex items-center justify-between group";
            btn.querySelector('div').className = `w-1.5 h-1.5 rounded-full bg-brand-${data.color} opacity-0 group-hover:opacity-100 transition-opacity`;
        });

        const activeBtn = document.getElementById(`nav-${key}`);
        if (activeBtn) {
            activeBtn.className = "nav-btn w-full text-left px-4 py-2.5 rounded-xl border-2 border-brand-dark dark:border-white bg-brand-dark dark:bg-white text-white dark:text-brand-dark shadow-neo-sm dark:shadow-neo-sm-white font-bold transition-all mb-1 text-sm active:translate-y-1 active:shadow-none flex items-center justify-between";
            activeBtn.querySelector('div').className = `w-2 h-2 rounded-full bg-brand-${data.color}`;
        }

        // Header Info
        const badge = document.getElementById('tense-category');
        badge.innerText = data.cat;
        badge.className = `text-[10px] md:text-xs font-black uppercase tracking-widest px-2 py-1 rounded border bg-brand-${data.color}/10 text-brand-${data.color} border-brand-${data.color}/30 select-none transition-colors`;

        const title = document.getElementById('tense-title');
        title.innerText = data.title;
        title.className = `text-3xl md:text-5xl font-heading font-black mt-2 leading-tight text-brand-${data.color} drop-shadow-sm transition-colors`;

        // Interactive Formula Builder
        const formulaContainer = document.getElementById('tense-formula');
        formulaContainer.innerHTML = '';
        if (data.formulaParts) {
            data.formulaParts.forEach(part => {
                const isInteractive = part.tip && part.tip !== '';
                const spanClasses = isInteractive
                    ? "cursor-help relative group/tip hover:bg-brand-purple/10 px-0.5 rounded transition-colors border-b border-dashed border-brand-purple/30"
                    : "px-0.5";

                let html = `<span class="${spanClasses}">${part.text}`;
                if (isInteractive) {
                    html += `<div class="absolute -bottom-10 left-1/2 transform -translate-x-1/2 bg-brand-dark text-white font-body font-bold tracking-wide text-[11px] px-3 py-1.5 rounded-lg opacity-0 group-hover/tip:opacity-100 transition-all whitespace-nowrap pointer-events-none z-[60] shadow-neo-sm translate-y-2 group-hover/tip:translate-y-0">${part.tip}</div>`;
                }
                html += `</span>`;
                formulaContainer.innerHTML += html;
            });
        } else {
            formulaContainer.innerText = data.formula || "Formula missing";
        }

        document.getElementById('tense-desc').innerText = data.desc;
        document.getElementById('static-example').innerText = data.example;

        // Usage List
        const listEl = document.getElementById('usage-list');
        listEl.innerHTML = '';
        data.usage.forEach((u, idx) => {
            listEl.innerHTML += `
                <li class="flex items-start gap-3 animate-fade-in" style="animation-delay: ${idx * 0.05}s">
                    <div class="bg-brand-${data.color}/20 p-0.5 rounded-full mt-0.5 shrink-0">
                        <i data-lucide="check" class="w-3 h-3 text-brand-${data.color}"></i>
                    </div>
                    <span class="font-bold text-slate-600 dark:text-slate-300 leading-snug text-sm md:text-base">${u}</span>
                </li>`;
        });

        // Signals List
        const signalsEl = document.getElementById('signals-list');
        if (signalsEl) {
            signalsEl.innerHTML = '';
            if (data.signals && data.signals.length > 0) {
                data.signals.forEach(sig => {
                    signalsEl.innerHTML += `<span class="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded border border-slate-200 dark:border-slate-700 text-[11px] font-bold uppercase tracking-wider">${sig}</span>`;
                });
            } else {
                signalsEl.innerHTML = `<span class="text-xs text-slate-400 italic">No specific signal words</span>`;
            }
        }

        drawTimeline(data.viz, data.color);
        lucide.createIcons();

        if (window.innerWidth < 768) {
            document.getElementById('sidebar').classList.add('-translate-x-full');
        }
    }

    function replayAnimation() {
        const data = TENSES[currentTenseKey];
        drawTimeline(data.viz, data.color, 'timeline-layer');
        if (isCompareMode && compareTenseKey) {
            const compData = TENSES[compareTenseKey];
            drawTimeline(compData.viz, compData.color, 'compare-timeline-layer');
        }
        lucide.createIcons();
    }

    function speakExample() {
        const text = document.getElementById('static-example').innerText;
        if (!text || text === 'Loading...') return;

        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'en-US';
        utterance.rate = 0.9;
        window.speechSynthesis.speak(utterance);
    }

    // --- COMPARE & QUIZ LOGIC ---

    function toggleCompareMode() {
        isCompareMode = !isCompareMode;
        const compareBtn = document.getElementById('compare-btn');
        const infoSection = document.getElementById('info-section');
        const compareContainer = document.getElementById('compare-container');

        if (isCompareMode) {
            if (isQuizMode) toggleQuizMode(); // Disable quiz if entering compare

            if (compareBtn) compareBtn.classList.add('bg-brand-blue/10', 'border-brand-blue', 'text-brand-blue');
            infoSection.classList.add('hidden');
            compareContainer.classList.remove('hidden');
            compareTenseKey = null; // Reset selection

            // Reset UI
            document.getElementById('compare-tense-title').innerText = "Select a secondary tense from sidebar...";
            document.getElementById('compare-tense-title').className = "text-2xl md:text-4xl font-heading font-black mt-1 leading-tight drop-shadow-sm text-slate-400";
            document.getElementById('compare-tense-category').innerText = "Category";
            document.getElementById('compare-timeline-layer').innerHTML = '';
            document.getElementById('compare-timeline-container').classList.add('opacity-50', 'pointer-events-none');
            document.getElementById('compare-tense-formula').parentElement.classList.add('opacity-50');
            document.getElementById('compare-tense-formula').innerHTML = 'Formula';

            renderSidebar(); // Update sidebar state // Re-render sidebar to apply ghost styling to current active tense if needed
        } else {
            if (compareBtn) compareBtn.classList.remove('bg-brand-blue/10', 'border-brand-blue', 'text-brand-blue');
            infoSection.classList.remove('hidden');
            compareContainer.classList.add('hidden');
            compareTenseKey = null;
            renderSidebar();
        }
    }

    function renderCompareTense() {
        if (!compareTenseKey) return;
        const data = TENSES[compareTenseKey];

        const badge = document.getElementById('compare-tense-category');
        badge.innerText = data.cat;
        badge.className = `text-[10px] md:text-xs font-black uppercase tracking-widest px-2 py-1 rounded-sm border bg-brand-${data.color}/10 text-brand-${data.color} border-brand-${data.color}/30 select-none transition-colors`;

        const title = document.getElementById('compare-tense-title');
        title.innerText = data.title;
        title.className = `text-2xl md:text-4xl font-heading font-black mt-1 leading-tight text-brand-${data.color} drop-shadow-sm transition-colors`;

        // Static formula for comparison
        let formulaHtml = '';
        if (data.formulaParts) {
            formulaHtml = data.formulaParts.map(p => p.text).join(' ');
        }
        document.getElementById('compare-tense-formula').innerHTML = formulaHtml;

        drawTimeline(data.viz, data.color, 'compare-timeline-layer');
        lucide.createIcons();
    }

    function toggleQuizMode() {
        isQuizMode = !isQuizMode;
        const quizBtn = document.getElementById('quiz-btn');
        const infoSection = document.getElementById('info-section');
        const timelineSection = document.getElementById('timeline-container').parentElement;
        const quizContainer = document.getElementById('quiz-container');

        if (isQuizMode) {
            if (isCompareMode) toggleCompareMode(); // Turn off compare

            if (quizBtn) quizBtn.classList.add('ring-4', 'ring-brand-orange/30');
            infoSection.classList.add('hidden');
            timelineSection.classList.add('hidden');
            quizContainer.classList.remove('hidden');

            document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.add('opacity-50', 'pointer-events-none'));

            nextQuizQuestion();
        } else {
            if (quizBtn) quizBtn.classList.remove('ring-4', 'ring-brand-orange/30');
            infoSection.classList.remove('hidden');
            timelineSection.classList.remove('hidden');
            quizContainer.classList.add('hidden');

            renderSidebar(); // Restore sidebar
        }
    }

    function nextQuizQuestion() {
        // Formatting reset
        document.getElementById('quiz-feedback').innerText = '';
        document.getElementById('quiz-options').innerHTML = '';

        // Pick a random tense
        const keys = TENSE_KEYS;
        const correctKey = keys[Math.floor(Math.random() * keys.length)];
        currentQuizAnswer = correctKey;
        const correctAnswerData = TENSES[correctKey];

        // Show example
        document.getElementById('quiz-question').innerText = correctAnswerData.example;

        // Generate 3 random distractors
        let options = [correctKey];
        while (options.length < 4) {
            let rand = keys[Math.floor(Math.random() * keys.length)];
            if (!options.includes(rand)) {
                options.push(rand);
            }
        }

        // Shuffle options
        options.sort(() => Math.random() - 0.5);

        const optionsContainer = document.getElementById('quiz-options');
        options.forEach(optKey => {
            const data = TENSES[optKey];
            const btn = document.createElement('button');
            btn.className = `w-full px-4 py-3 bg-white/10 hover:bg-white/20 border-2 border-transparent hover:border-white rounded-xl text-white font-bold text-left transition-all relative group overflow-hidden flex items-center justify-between`;
            btn.innerHTML = `
                <span class="relative z-10 text-lg">${data.title}</span>
                <div class="w-3 h-3 rounded-full bg-brand-${data.color} opacity-0 group-hover:opacity-100 transition-opacity"></div>
            `;
            btn.onclick = () => handleQuizAnswer(optKey, btn);
            optionsContainer.appendChild(btn);
        });
    }

    function handleQuizAnswer(selectedKey, btnEl) {
        const feedbackEl = document.getElementById('quiz-feedback');
        const options = document.getElementById('quiz-options').children;

        // Disable all buttons
        Array.from(options).forEach(opt => {
            opt.onclick = null;
            opt.classList.add('opacity-50', 'pointer-events-none');
        });

        if (selectedKey === currentQuizAnswer) {
            feedbackEl.innerText = "🎉 Correct!";
            feedbackEl.className = "text-center font-black text-xl mb-4 min-h-[28px] tracking-wide text-brand-green animate-bounce-subtle";
            btnEl.classList.remove('bg-white/10', 'border-transparent', 'opacity-50');
            btnEl.classList.add('bg-brand-green', 'border-brand-green', 'text-brand-dark', 'opacity-100', 'shadow-neo-sm-white');

            setTimeout(() => {
                feedbackEl.className = "text-center font-black text-lg mb-4 min-h-[28px] tracking-wide text-white";
                nextQuizQuestion();
            }, 1500);
        } else {
            feedbackEl.innerText = `❌ Oops! It was exactly: ${TENSES[currentQuizAnswer].title}`;
            feedbackEl.className = "text-center font-black text-xl mb-4 min-h-[28px] tracking-wide text-red-300";
            btnEl.classList.remove('bg-white/10', 'border-transparent');
            btnEl.classList.add('bg-red-500/50', 'border-red-500');

            setTimeout(() => {
                feedbackEl.className = "text-center font-black text-lg mb-4 min-h-[28px] tracking-wide text-white";
                nextQuizQuestion();
            }, 2500);
        }
    }

    // --- BUILDER LOGIC ---
    function selectTool(toolName) {
        // Activate Builder Mode
        if (!builderState.active) {
            builderState.active = true;
            builderState.items = []; // Clear current items for building
            document.getElementById('builder-badge').classList.remove('hidden');
            drawTimeline([], 'dark'); // Clear timeline, use neutral color
        }

        builderState.tool = toolName;

        // Update UI
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.classList.remove('border-brand-blue', 'bg-brand-blue/10');
            btn.classList.add('border-slate-200', 'dark:border-slate-600');
        });
        const activeBtn = document.getElementById(`tool-${toolName}`);
        if (activeBtn) {
            activeBtn.classList.remove('border-slate-200', 'dark:border-slate-600');
            activeBtn.classList.add('border-brand-blue', 'bg-brand-blue/10');
        }

        // Add cursor hint to timeline
        document.getElementById('timeline-container').classList.add('cursor-pen');
        document.getElementById('builder-feedback').innerText = `Place the ${toolName} on the timeline...`;
        document.getElementById('builder-feedback').className = "text-center font-bold text-sm mb-3 min-h-[20px] text-brand-blue";
    }

    function handleTimelineClick(e) {
        if (!builderState.active || !builderState.tool) return;

        // Calculate % position
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const percent = Math.max(5, Math.min(95, (x / rect.width) * 100)); // Clamp between 5% and 95%

        // Add item
        const newItem = {
            type: builderState.tool,
            l: percent,
            label: 'My Item',
            y: 50,
            w: builderState.tool === 'range' ? 20 : (builderState.tool === 'arrow' ? 20 : 0) // Defaults
        };

        builderState.items.push(newItem);

        // Redraw
        const currentColor = TENSES[currentTenseKey].color;
        drawTimeline(builderState.items, currentColor);
        lucide.createIcons();
    }

    function resetBuilder(fullReset = true) {
        builderState.active = false;
        builderState.tool = null;
        builderState.items = [];
        document.getElementById('builder-badge').classList.add('hidden');
        document.getElementById('timeline-container').classList.remove('cursor-pen');

        // Reset Tool UI
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.classList.remove('border-brand-blue', 'bg-brand-blue/10');
            btn.classList.add('border-slate-200', 'dark:border-slate-600');
        });

        if (fullReset) {
            replayAnimation();
            document.getElementById('builder-feedback').innerText = "";
        }
    }

    function checkBuilder() {
        if (!builderState.active) {
            document.getElementById('builder-feedback').innerText = "Select a tool first!";
            document.getElementById('builder-feedback').className = "text-center font-bold text-sm mb-3 min-h-[20px] text-brand-pink";
            return;
        }

        const correctViz = TENSES[currentTenseKey].viz;
        const userViz = builderState.items;

        // Simple Logic: Do we have roughly the same number of items of each type?
        // And are they in roughly the correct position (Left vs Right)?

        let score = 0;
        let maxScore = correctViz.length;
        let hints = [];

        // Copy userViz to track matches
        let remainingUserItems = [...userViz];

        correctViz.forEach(target => {
            // Find a match in user items
            const matchIndex = remainingUserItems.findIndex(u =>
                u.type === target.type && Math.abs(u.l - target.l) < 20 // 20% tolerance
            );

            if (matchIndex !== -1) {
                score++;
                remainingUserItems.splice(matchIndex, 1);
            } else {
                hints.push(`Missing a ${target.type} at ${target.l < 50 ? 'Past' : 'Future'} side.`);
            }
        });

        const feedbackEl = document.getElementById('builder-feedback');
        if (score === maxScore && remainingUserItems.length === 0) {
            feedbackEl.innerText = "Perfect! You rebuilt the timeline!";
            feedbackEl.className = "text-center font-bold text-sm mb-3 min-h-[20px] text-brand-green animate-bounce-subtle";
        } else if (score === maxScore) {
            feedbackEl.innerText = "Correct! (You added some extra items though).";
            feedbackEl.className = "text-center font-bold text-sm mb-3 min-h-[20px] text-brand-green";
        } else {
            feedbackEl.innerText = hints.length > 0 ? hints[0] : "Not quite right. Try again!";
            feedbackEl.className = "text-center font-bold text-sm mb-3 min-h-[20px] text-brand-pink";
        }
    }

    // --- DRAWING LOGIC ---
    function drawTimeline(items, color, targetLayerId = 'timeline-layer') {
        const layer = document.getElementById(targetLayerId);
        layer.innerHTML = '';

        items.forEach((item, index) => {
            const el = document.createElement('div');
            el.className = 't-item pointer-events-none'; // Items shouldn't block clicks in builder mode
            const topVal = item.y ? item.y + '%' : '50%';
            el.style.left = item.l + '%';
            el.style.top = topVal;

            let animationClass = (item.type === 'range' || item.type === 'arrow') ? 'animate-pop-left' : 'animate-pop-center';
            el.style.animationDelay = (index * 0.1) + 's';
            el.classList.add(animationClass);

            if (item.type === 'pin') {
                const ghostClass = item.ghost ? 'opacity-50 border-dashed' : '';
                const crossHTML = item.cross ? '<div class="absolute inset-0 flex items-center justify-center text-white font-black text-lg">X</div>' : '';
                const iconHTML = item.cross ? '' : '<i data-lucide="map-pin" class="w-3.5 h-3.5 relative z-10"></i>';
                el.innerHTML = `
                    <div class="flex flex-col items-center group">
                        <div class="w-8 h-8 rounded-full bg-brand-${color} border-2 border-brand-dark dark:border-white shadow-neo-sm dark:shadow-neo-sm-white flex items-center justify-center text-white relative z-20 ${ghostClass}">
                            ${iconHTML} ${crossHTML}
                        </div>
                        <div class="h-8 w-0.5 bg-brand-dark/50 dark:bg-white/50 z-10"></div>
                    </div>`;
            } else if (item.type === 'range') {
                const width = item.w + '%';
                const activeClass = item.active ? 'animate-pulse' : '';
                const ghostClass = item.ghost ? 'opacity-50 border-dashed' : '';
                el.style.width = width;
                el.style.transform = 'translate(0, -50%)';
                el.innerHTML = `
                    <div class="w-full h-8 bg-brand-${color} border-2 border-brand-dark dark:border-white rounded-lg shadow-neo-sm dark:shadow-neo-sm-white opacity-90 flex items-center justify-center ${activeClass} ${ghostClass} origin-left">
                        <span class="bg-white/90 dark:bg-brand-blackboard/90 backdrop-blur-sm px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border border-brand-dark dark:border-white text-brand-dark dark:text-white shadow-sm whitespace-nowrap select-none opacity-0 group-hover:opacity-100 transition-opacity">Range</span>
                    </div>`;
            } else if (item.type === 'arrow') {
                const dashed = item.dashed ? 'border-dashed' : 'border-solid';
                el.style.width = item.w + '%';
                el.style.transform = 'translate(0, -50%)';
                el.innerHTML = `
                    <div class="w-full h-4 bg-transparent border-b-4 border-brand-dark/40 dark:border-white/40 ${dashed} relative flex justify-center group">
                        <div class="absolute right-0 -bottom-[5px] w-0 h-0 border-t-[6px] border-t-transparent border-l-[10px] border-l-brand-dark/40 dark:border-l-white/40 border-b-[6px] border-b-transparent"></div>
                    </div>`;
            } else if (item.type === 'marker') {
                el.innerHTML = `
                    <div class="flex flex-col items-center">
                        <span class="text-[9px] font-black text-brand-dark/70 dark:text-white/70 uppercase tracking-widest mb-1 bg-white/50 dark:bg-brand-blackboard/50 px-1 rounded">TIME</span>
                        <div class="w-0.5 h-3 bg-brand-dark/70 dark:bg-white/70"></div>
                    </div>`;
            }
            layer.appendChild(el);
        });
    }

    function toggleSidebar() { document.getElementById('sidebar').classList.toggle('-translate-x-full'); }
    function closeSidebarMobile() { if (window.innerWidth < 768) document.getElementById('sidebar').classList.add('-translate-x-full'); }
    function toggleTheme() {
        if (document.documentElement.classList.contains('dark')) {
            document.documentElement.classList.remove('dark');
            localStorage.theme = 'light';
        } else {
            document.documentElement.classList.add('dark');
            localStorage.theme = 'dark';
        }
    }

    return { init, loadTense, selectTool, handleTimelineClick, resetBuilder, checkBuilder, toggleSidebar, closeSidebarMobile, replayAnimation, renderSidebar, toggleTheme, speakExample, toggleCompareMode, toggleQuizMode };
})();
