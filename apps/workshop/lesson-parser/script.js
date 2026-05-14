let quill;
let db;
let debugLines = [];

// ── Initialization ────────────────────────────────────────────────────────────
window.addEventListener('load', async () => {
    if (typeof requirePro === 'function') await requirePro();
    initQuill();
    await initDB();
    lucide.createIcons();

    const data = await loadFromDB();
    if (data) {
        document.getElementById('doc-title').innerText = data.title || 'Lesson Extractor';
        document.getElementById('unit-title-input').value = data.title || '';
        document.getElementById('unit-aims-input').value = data.unitAims || '';
        if (data.modules) {
            renderModules(data.modules);
            renderOverview(data.modules);
        }
    } else {
        renderModules([]);
        renderOverview([]);
    }
});

function initQuill() {
    quill = new Quill('#editor-container', {
        theme: 'snow',
        placeholder: 'Paste teacher notes text here...',
        modules: {
            toolbar: [
                ['bold', 'italic', 'underline'],
                [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                ['clean']
            ]
        }
    });
}

// ── Dark mode ─────────────────────────────────────────────────────────────────
function toggleDark() {
    document.documentElement.classList.toggle('dark');
    const dark = document.documentElement.classList.contains('dark');
    const darkIcon = document.getElementById('dark-icon');
    if (darkIcon) {
        darkIcon.setAttribute('data-lucide', dark ? 'sun' : 'moon');
        lucide.createIcons();
    }
    localStorage.setItem('theme', dark ? 'dark' : 'light');
}

if (localStorage.getItem('theme') === 'dark') {
    document.documentElement.classList.add('dark');
}

// ── Debug ─────────────────────────────────────────────────────────────────────
const log = (...a) => {
    const msg = a.map(x => typeof x === 'object' ? JSON.stringify(x, null, 2) : String(x)).join(' ');
    debugLines.push(msg);
    const p = document.getElementById('debug-panel');
    if (p && !p.classList.contains('hidden')) {
        p.textContent = debugLines.join('\n');
    }
};

function toggleDebug() {
    const p = document.getElementById('debug-panel');
    if (!p) return;
    p.classList.toggle('hidden');
    if (!p.classList.contains('hidden')) p.textContent = debugLines.join('\n') || '(no log yet)';
}

// ── IndexedDB ─────────────────────────────────────────────────────────────────
const DB_NAME = 'LessonExtractorDB_v2';
async function initDB() {
    return new Promise((res, rej) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onerror = () => rej('DB Error');
        req.onsuccess = e => { db = e.target.result; res(db); };
        req.onupgradeneeded = e => {
            const d = e.target.result;
            if (!d.objectStoreNames.contains('lessons'))
                d.createObjectStore('lessons', { keyPath: 'id' });
        };
    });
}

async function saveToDB(title, unitAims, modules) {
    if (!db) await initDB();
    return new Promise(res => {
        const tx = db.transaction('lessons', 'readwrite');
        tx.objectStore('lessons').put({ id: 'current', title, unitAims, modules });
        tx.oncomplete = () => res();
    });
}

async function loadFromDB() {
    if (!db) await initDB();
    return new Promise(res => {
        const tx = db.transaction('lessons', 'readonly');
        const req = tx.objectStore('lessons').get('current');
        req.onsuccess = () => res(req.result);
        req.onerror = () => res(null);
    });
}

async function clearData() {
    if (!db) await initDB();
    const tx = db.transaction('lessons', 'readwrite');
    tx.objectStore('lessons').delete('current');
    tx.oncomplete = () => {
        document.getElementById('doc-title').innerText = 'Lesson Extractor';
        document.getElementById('unit-title-input').value = '';
        document.getElementById('unit-aims-input').value = '';
        quill.setContents([]);
        debugLines = [];
        renderModules([]);
        renderOverview([]);
        showToast('🗑️ Saved data cleared');
    };
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function showToast(msg) {
    const c = document.getElementById('toast-container');
    if (!c) return;
    const t = document.createElement('div');
    t.className = 'toast';
    t.innerHTML = `<i data-lucide="check-circle" class="w-5 h-5 stroke-[2.5]" style="color:#00E676;flex-shrink:0;"></i><span>${msg}</span>`;
    c.appendChild(t); 
    lucide.createIcons();
    setTimeout(() => { t.classList.add('show'); }, 10);
    setTimeout(() => { 
        t.style.opacity = '0';
        t.style.transform = 'translateY(-20px)';
        setTimeout(() => t.remove(), 400); 
    }, 2800);
}

// ── Tabs ──────────────────────────────────────────────────────────────────────
function switchTab(tab) {
    ['paste', 'overview'].forEach(t => {
        const btn = document.getElementById('tab-' + t);
        if (btn) btn.classList.remove('active');
    });
    
    const activeBtn = document.getElementById('tab-' + tab);
    if (activeBtn) activeBtn.classList.add('active');

    const overviewView = document.getElementById('view-overview');
    const modulesContainer = document.getElementById('modules-container');

    if (tab === 'overview') {
        if (overviewView) overviewView.classList.remove('hidden');
        if (modulesContainer) modulesContainer.classList.add('hidden');
    } else {
        if (overviewView) overviewView.classList.add('hidden');
        if (modulesContainer) modulesContainer.classList.remove('hidden');
    }
}

async function updateUnitMetadata() {
    const title = document.getElementById('unit-title-input').value;
    const aims = document.getElementById('unit-aims-input').value;
    document.getElementById('doc-title').innerText = title || 'Lesson Extractor';
    const data = await loadFromDB();
    await saveToDB(title, aims, data?.modules || []);
    renderOverview(data?.modules || []);
}

async function processPastedText() {
    const fullText = quill.getText();
    if (!fullText.trim()) { 
        showToast('⚠️ Nothing to extract!'); 
        return; 
    }

    // Generate bold stream from Quill Delta
    const delta = quill.getContents();
    let boldText = '';
    delta.ops.forEach(op => {
        const text = op.insert;
        if (typeof text !== 'string') return;
        if (op.attributes && op.attributes.bold) {
            boldText += text;
        } else {
            boldText += ' '.repeat(text.length);
        }
    });

    const container = document.getElementById('modules-container');
    if (container) container.innerHTML = ''; 
    debugLines = [];
    
    log('── EXTRACTION START ──');

    let title = document.getElementById('unit-title-input').value || 'Lesson Extractor';
    const tm = fullText.match(/(Book\s+\d+,\s+Unit\s+\d+)/i);
    if (tm && !document.getElementById('unit-title-input').value) {
        title = tm[1];
        document.getElementById('unit-title-input').value = title;
        document.getElementById('doc-title').innerText = title;
    }

    const modules = parseExtractedText(fullText, boldText);
    const aims = document.getElementById('unit-aims-input').value;
    await saveToDB(title, aims, modules);
    renderModules(modules);
    renderOverview(modules);
    showToast(`✅ ${modules.length} module${modules.length !== 1 ? 's' : ''} extracted!`);
}

// ── Parser Logic ──────────────────────────────────────────────────────────────
function isJunk(line) {
    const s = line.trim();
    return (
        !s || s.length < 2 ||
        /^\d{1,2}\/\d{1,2}\/\d{2,4}/.test(s) ||
        /^https?:\/\//.test(s) ||
        /Teacher Notes/i.test(s) ||
        /^Frontrunner/i.test(s) ||
        /^Book \d+/i.test(s)
    );
}

const ANCHORS = [
    'Target Language:',
    'Target Grammar:',
    'Materials:',
    'Preparation:',
    'In this section'
];

const BODY_RE = /\n[ \t]*(?=(?:Setting the Context|Pre-?reading|Post-?reading|Pre-?speaking|Post-?speaking|Pre-?writing|Post-?writing|Pre-?listening|Post-?listening|Introducing |Using |Listening: |Speaking: |Reading: |Writing: |Tell the |Have the |Use slide|Use Presentation|Discuss |Divide |Distribute |Ask the|Open Presentation|Display |Inform |Show the))/;

function splitChunk(chunk) {
    const m = BODY_RE.exec(chunk);
    if (m) return { header: chunk.slice(0, m.index), body: chunk.slice(m.index) };
    return { header: chunk, body: '' };
}

function extractField(key, header) {
    const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const stopPat = ANCHORS.filter(a => a !== key).map(esc).join('|');
    const re = new RegExp(`${esc(key)}\\s*(.*?)(?=\\n\\s*(?:${stopPat}|$))`, 'is');
    const m = re.exec(header);
    if (!m) return [];
    
    return m[1]
        .split('\n')
        .map(s => s.replace(/^[-•…*]\s*/, '').trim())
        .filter(s => !isJunk(s));
}

function expandNums(str) {
    const out = new Set();
    str.replace(/\band\b/gi, ',').split(/[,\s]+/).forEach(p => {
        const r = p.match(/^(\d+)[-–](\d+)$/);
        if (r) {
            const lo = +r[1], hi = +r[2];
            if (hi - lo <= 20) for (let i = lo; i <= hi; i++) out.add(String(i));
            else out.add(p);
        } else if (/^\d+$/.test(p)) out.add(p);
    });
    return [...out].filter(Boolean);
}

function collapseBold(boldChunk) {
    return boldChunk.replace(/\n+/g, ' ').replace(/\s{2,}/g, ' ').trim();
}

function tokenizeRefs(text) {
    const flat = text.replace(/[\r\n]+/g, ' ').replace(/\s{2,}/g, ' ');
    const tokens = [];
    let m;

    const rP = /\bPresentation\s+(\d+)/gi;
    while ((m = rP.exec(flat)) !== null)
        tokens.push({ type: 'pres', value: m[1], pos: m.index });

    const rS = /\bslides?\s+(\d[\d,\s\-–]*)/gi;
    while ((m = rS.exec(flat)) !== null)
        tokens.push({ type: 'slide', value: m[1].trim(), pos: m.index });

    const rPg = /\b(?:pages?|p\.)\s+(\d[\d,\s\-–]*)/gi;
    while ((m = rPg.exec(flat)) !== null)
        tokens.push({ type: 'page', value: m[1].trim(), pos: m.index });

    return tokens.sort((a, b) => a.pos - b.pos);
}

function buildRefsState(tokens) {
    const pres = {};
    const pages = new Set();
    const presTokens = tokens.filter(t => t.type === 'pres');
    presTokens.forEach(pt => { if (!pres[pt.value]) pres[pt.value] = new Set(); });

    tokens.forEach(tok => {
        if (tok.type === 'slide') {
            if (!presTokens.length) return;
            let nearest = presTokens[0];
            let minDist = Math.abs(tok.pos - presTokens[0].pos);
            presTokens.forEach(pt => {
                const d = Math.abs(tok.pos - pt.pos);
                if (d < minDist) { minDist = d; nearest = pt; }
            });
            expandNums(tok.value).forEach(n => pres[nearest.value].add(n));
        } else if (tok.type === 'page') {
            expandNums(tok.value).forEach(n => { if (+n >= 1 && +n <= 999) pages.add(n); });
        }
    });

    return { pres, pages: [...pages].sort((a, b) => +a - +b) };
}

function parseExtractedText(rawFull, rawBold) {
    const norm = t => t.replace(/\r/g, '').replace(/•/g, '-').replace(/[\u2013\u2014]/g, '-').replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"');
    const fullText = norm(rawFull);
    const boldText = norm(rawBold);
    const boldOK = boldText.length === fullText.length;

    const modules = [];
    const MOD_RE = /^([A-Z][A-Za-z0-9\s&:\-\/'"]+?)\s*\(\s*(\d+)\s*min\.?\s*\)/gm;
    let match;
    const idx = [];
    while ((match = MOD_RE.exec(fullText)) !== null)
        idx.push({ title: match[1].trim(), duration: match[2] + ' min.', pos: match.index });

    for (let i = 0; i < idx.length; i++) {
        const start = idx[i].pos;
        const end = i + 1 < idx.length ? idx[i + 1].pos : fullText.length;
        const fullChunk = fullText.slice(start, end);
        const boldChunk = boldOK ? boldText.slice(start, end) : '';
        const { header, body } = splitChunk(fullChunk);
        const bodyOffset = fullChunk.length - body.length;
        const boldBody = boldChunk ? boldChunk.slice(bodyOffset) : '';

        const langLines = extractField('Target Language:', header);
        const gramLines = extractField('Target Grammar:', header);
        const matLines = extractField('Materials:', header);
        const prepLines = extractField('Preparation:', header);
        const willRaw = extractField('In this section', header);
        const willLines = willRaw.filter(l => !l.match(/^the students will/i) && !l.match(/^[….]+$/) && l.length > 4);

        let pres = {};
        let pages = [];
        const boldFlat = collapseBold(boldBody);
        const hasBoldContent = boldFlat.replace(/\s/g, '').length > 3;

        if (hasBoldContent) {
            const boldTokens = tokenizeRefs(boldFlat);
            const boldRefs = buildRefsState(boldTokens);
            pres = boldRefs.pres;
            pages = boldRefs.pages;
        }

        if (!Object.keys(pres).length) {
            const bodyTokens = tokenizeRefs(body);
            const bodyRefs = buildRefsState(bodyTokens);
            pres = bodyRefs.pres;
            if (!pages.length) pages = bodyRefs.pages;
        }

        modules.push({
            title: idx[i].title,
            duration: idx[i].duration,
            data: {
                lang: langLines,
                gram: gramLines,
                materials: matLines.length ? matLines : ['Check textbook.'],
                prep: prepLines.length ? prepLines : ['None'],
                will: willLines,
                presentations: pres,
                pages
            }
        });
    }
    return modules;
}

// ── Renderer ──────────────────────────────────────────────────────────────────
const ACCENTS = ['#FF6B95', '#FF8C42', '#1ea7fd', '#00d063'];
const TXT_ON = ['#ffffff', '#ffffff', '#ffffff', '#ffffff'];

function listHTML(items, empty = 'N/A') {
    if (!items || !items.length) return `<span class="opacity-50 italic text-sm">${empty}</span>`;
    if (items.length === 1) return `<span class="text-sm leading-snug">${items[0]}</span>`;
    return `<ul class="space-y-1">${items.map(item => `<li class="flex items-start gap-2 text-sm leading-snug"><span class="mt-1.5 w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0"></span><span>${item}</span></li>`).join('')}</ul>`;
}

function presHTML(presentations) {
    const keys = Object.keys(presentations).sort((a, b) => +a - +b);
    if (!keys.length) return `<span class="opacity-50 italic text-sm">See Presentation</span>`;
    return `<div class="flex flex-wrap gap-2">${keys.map(pk => {
        const slides = [...presentations[pk]].sort((a, b) => +a - +b);
        return `<span class="pres-chip"><i data-lucide="monitor" class="w-3.5 h-3.5"></i>Pres.${pk}: <strong>${slides.join(', ')}</strong></span>`;
    }).join('')}</div>`;
}

function pagesHTML(pages) {
    if (!pages || !pages.length) return `<span class="opacity-50 italic text-sm">See Teacher Notes</span>`;
    const ranges = [];
    let s = null, p = null;
    pages.forEach(n => {
        const v = +n;
        if (s === null) { s = v; p = v; }
        else if (v === p + 1) { p = v; }
        else { ranges.push(s === p ? String(s) : `${s}–${p}`); s = v; p = v; }
    });
    if (s !== null) ranges.push(s === p ? String(s) : `${s}–${p}`);
    return `<span class="text-sm font-bold">${ranges.join(', ')}</span>`;
}

function renderModules(modules) {
    const container = document.getElementById('modules-container');
    if (!container) return;
    container.innerHTML = '';
    if (!modules.length) {
        container.innerHTML = `
            <div class="card p-12 text-center flex flex-col items-center gap-4">
                <div class="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-2xl border-2 border-slate-300 dark:border-slate-600 flex items-center justify-center">
                    <i data-lucide="inbox" class="w-8 h-8 opacity-30"></i>
                </div>
                <h3 class="font-heading text-xl">No Modules Yet</h3>
                <p class="opacity-60 text-sm">Extract some notes to get started!</p>
            </div>`;
        lucide.createIcons();
        return;
    }

    modules.forEach((mod, i) => {
        const id = `mod-${i}`;
        const accent = ACCENTS[i % ACCENTS.length];
        const txtcol = TXT_ON[i % TXT_ON.length];
        const d = mod.data;

        const html = `
            <article class="card" id="${id}" style="animation-delay:${i * 60}ms;">
                <div class="flex items-center justify-between px-4 py-3 border-b-3 border-slate-900 dark:border-slate-700" style="background:${accent};">
                    <div class="flex items-center gap-3">
                        <span class="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center font-bold" style="color:${txtcol};">${i + 1}</span>
                        <h2 class="font-heading text-lg" style="color:${txtcol};">${mod.title}</h2>
                    </div>
                    <span class="badge bg-white/80 text-slate-900 border-none">${mod.duration}</span>
                </div>
                <div class="p-5 flex flex-col gap-5">
                    <div class="section-stripe" style="border-color:${accent};">
                        <h3 class="font-heading text-sm uppercase tracking-wider opacity-60 mb-2">Target Focus</h3>
                        <div class="space-y-3">
                            <div><p class="text-xs font-bold uppercase opacity-40 mb-1">Language</p>${listHTML(d.lang)}</div>
                            ${d.gram.length ? `<div><p class="text-xs font-bold uppercase opacity-40 mb-1">Grammar</p>${listHTML(d.gram)}</div>` : ''}
                        </div>
                    </div>
                    <div>
                        <h3 class="font-heading text-sm uppercase tracking-wider opacity-60 mb-2">Requirements</h3>
                        <div class="grid grid-cols-2 gap-4">
                            <div><p class="text-xs font-bold uppercase opacity-40 mb-1">Materials</p>${listHTML(d.materials)}</div>
                            <div><p class="text-xs font-bold uppercase opacity-40 mb-1">Preparation</p>${listHTML(d.prep)}</div>
                        </div>
                    </div>
                    ${d.will.length ? `
                    <div class="pt-3 border-t border-slate-100 dark:border-slate-800">
                        <button class="w-full flex items-center justify-between py-1" onclick="toggleWill(${i})">
                            <span class="font-heading text-sm opacity-60">LEARNING OUTCOMES</span>
                            <i data-lucide="chevron-down" class="w-4 h-4 opacity-40 transition-transform" id="chev-${i}"></i>
                        </button>
                        <div class="hidden mt-2 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl" id="will-${i}">${listHTML(d.will)}</div>
                    </div>` : ''}
                    <div class="grid grid-cols-1 gap-3 mt-2">
                        <div class="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border-2 border-slate-100 dark:border-slate-800">
                             <p class="text-[10px] font-bold uppercase opacity-40 mb-2">Presentations</p>
                             ${presHTML(d.presentations)}
                        </div>
                        <div class="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border-2 border-slate-100 dark:border-slate-800 flex items-center justify-between">
                             <p class="text-[10px] font-bold uppercase opacity-40">Pages</p>
                             ${pagesHTML(d.pages)}
                        </div>
                    </div>
                    <button onclick="copyCard('${id}')" class="btn-chunky btn-chalk w-full mt-2 text-sm py-2">
                        <i data-lucide="copy" class="w-4 h-4"></i> Copy Details
                    </button>
                </div>
            </article>`;
        container.insertAdjacentHTML('beforeend', html);
    });
    lucide.createIcons();
}

function renderOverview(modules) {
    const container = document.getElementById('overview-content');
    if (!container) return;
    container.innerHTML = '';

    const title = document.getElementById('unit-title-input').value || 'Unit Overview';
    const aims = document.getElementById('unit-aims-input').value || 'No unit aims defined.';

    function getUnique(items) {
        const seen = new Set();
        return items.filter(item => {
            const normalized = item.toLowerCase().replace(/[.,!?;:]/g, '').trim();
            if (seen.has(normalized)) return false;
            seen.add(normalized);
            return true;
        });
    }

    const rawLang = [];
    const rawGram = [];
    modules.forEach(m => {
        m.data.lang.forEach(l => rawLang.push(l));
        m.data.gram.forEach(g => rawGram.push(g));
    });

    const uniqueLang = getUnique(rawLang);
    const uniqueGram = getUnique(rawGram);

    const html = `
        <div class="flex flex-col gap-6">
            <div class="card p-6 bg-blue-500 text-white relative overflow-hidden" style="background:var(--color-blue);">
                <h2 class="font-heading text-2xl relative z-10">${title}</h2>
                <div class="mt-4 p-4 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 relative z-10">
                    <p class="text-sm uppercase font-bold opacity-60 mb-1">Unit Aims</p>
                    <p class="text-lg font-bold">${aims.replace(/\n/g, '<br>')}</p>
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="card p-5 border-pink-500" style="border-color:var(--color-pink);">
                    <h3 class="font-heading text-pink-500 mb-3 flex items-center gap-2">
                        <i data-lucide="languages" class="w-5 h-5"></i> All Target Language
                    </h3>
                    ${listHTML(uniqueLang, 'No language extracted.')}
                </div>
                <div class="card p-5 border-orange-500" style="border-color:var(--color-orange);">
                    <h3 class="font-heading text-orange-500 mb-3 flex items-center gap-2">
                        <i data-lucide="scroll" class="w-5 h-5"></i> All Target Grammar
                    </h3>
                    ${listHTML(uniqueGram, 'No grammar extracted.')}
                </div>
            </div>

            <div class="card overflow-hidden">
                <div class="p-4 bg-slate-900 dark:bg-slate-800 text-white font-heading flex items-center gap-2">
                    <i data-lucide="map" class="w-5 h-5 text-green-400"></i> Resource Navigator
                </div>
                <div class="overflow-x-auto">
                    <table class="w-full text-left">
                        <thead>
                            <tr class="bg-slate-50 dark:bg-slate-900/50 border-b-2 border-slate-900 dark:border-slate-700">
                                <th class="p-4 text-xs font-bold uppercase opacity-50">Module</th>
                                <th class="p-4 text-xs font-bold uppercase opacity-50">Slides</th>
                                <th class="p-4 text-xs font-bold uppercase opacity-50">Pages</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${modules.map((m, i) => `
                                <tr class="border-b border-slate-100 dark:border-slate-800">
                                    <td class="p-4 font-bold text-sm">${m.title}</td>
                                    <td class="p-4">${presHTML(m.data.presentations)}</td>
                                    <td class="p-4 text-blue-500 font-bold" style="color:var(--color-blue);">${pagesHTML(m.data.pages)}</td>
                                </tr>`).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>`;

    container.innerHTML = html;
    lucide.createIcons();
}

function toggleWill(i) {
    const el = document.getElementById(`will-${i}`);
    const chv = document.getElementById(`chev-${i}`);
    if (el) el.classList.toggle('hidden');
    if (chv) chv.style.transform = el.classList.contains('hidden') ? 'rotate(0deg)' : 'rotate(180deg)';
}

function copyCard(id) {
    const card = document.getElementById(id);
    if (!card) return;
    
    const title = card.querySelector('h2')?.innerText || '';
    const dur = card.querySelector('.badge')?.innerText?.trim() || '';
    const focus = card.querySelector('.section-stripe')?.innerText || '';
    
    // Simplistic copy format
    const out = `📋 ${title} (${dur})\n\n${focus}`;

    navigator.clipboard?.writeText(out).then(() => {
        showToast('📋 Copied to clipboard!');
    });
}
