/* ============================================
   ADMIN TRACKER LOGIC
   ============================================ */

/* ============================================
   LESSON_STATUSES — Mirrors schedule/templates.js
   ============================================ */
const LESSON_STATUSES = [
  { id: 'not_ready', label: 'Not Ready', icon: 'x-circle',    color: '#ef4444' },
  { id: 'draft',     label: 'Draft',     icon: 'edit-3',      color: '#f97316' },
  { id: 'ready',     label: 'Ready',     icon: 'check-circle',color: '#eab308' },
  { id: 'taught',    label: 'Taught',    icon: 'users',       color: '#22c55e' },
  { id: 'reviewed',  label: 'Reflected', icon: 'star',        color: '#10b981' }
];

let currentFilter = 'week'; // 'today', 'week', 'all'
let currentMode = 'lessons'; // 'lessons', 'units'
let currentDrawerClass = null;

/* ============================================
   DATA LAYER — Reads from schedule's localStorage
   ============================================ */

function loadScheduleEvents() {
  const raw = localStorage.getItem('schedule_events');
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

function saveScheduleEvents(events) {
  localStorage.setItem('schedule_events', JSON.stringify(events));
}

function loadRedDays() {
  const raw = localStorage.getItem('schedule_red_days');
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

function loadClassAdmin() {
  const raw = localStorage.getItem('schedule_class_admin');
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}

function saveClassAdmin(data) {
  localStorage.setItem('schedule_class_admin', JSON.stringify(data));
}

function loadClassUnits() {
  const raw = localStorage.getItem('schedule_class_units');
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}

function saveClassUnits(data) {
  localStorage.setItem('schedule_class_units', JSON.stringify(data));
}

function getClassEvents() {
  const allEvents = loadScheduleEvents();
  return allEvents.filter(e => e.typeId === 'class' && !e.isRecurrence);
}

function getWeekRange() {
  const now = new Date();
  const day = now.getDay();
  const mon = new Date(now); mon.setDate(now.getDate() - ((day + 6) % 7));
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  const fmt = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  return { start: fmt(mon), end: fmt(sun) };
}

function getMonthRange() {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const fmt = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  return { start: fmt(firstDay), end: fmt(lastDay) };
}

function getClassInstances(masterName) {
  const allEvents = loadScheduleEvents();
  const redDays = loadRedDays();
  let filtered = allEvents
    .filter(e => e.name === masterName && e.typeId === 'class')
    .filter(e => !(e.isRecurrence && redDays.includes(e.date)));

  // Apply time filter
  if (currentFilter === 'today') {
    const today = getTodayStr();
    filtered = filtered.filter(e => e.date === today);
  } else if (currentFilter === 'week') {
    const { start, end } = getWeekRange();
    filtered = filtered.filter(e => e.date >= start && e.date <= end);
  } else if (currentFilter === 'month') {
    const { start, end } = getMonthRange();
    filtered = filtered.filter(e => e.date >= start && e.date <= end);
  }

  return filtered.sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
}

function getUniqueClasses() {
  const masters = getClassEvents();
  // Group by name to find unique classes
  const classMap = {};
  masters.forEach(evt => {
    if (!classMap[evt.name]) {
      classMap[evt.name] = { name: evt.name, color: evt.color, events: [] };
    }
    classMap[evt.name].events.push(evt);
  });
  return Object.values(classMap);
}

/* ============================================
   ANALYSIS HELPERS
   ============================================ */

function getTodayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function isInPast(dateStr) { return dateStr < getTodayStr(); }
function isUpcoming(dateStr) { return dateStr >= getTodayStr(); }

function getLessonStatus(evt) {
  if (!evt.lessonPlan || (!evt.lessonPlan.unit && !evt.lessonPlan.lesson)) return 'not_ready';
  return evt.lessonPlan.status || 'not_ready';
}

function isPlanned(evt) {
  const s = getLessonStatus(evt);
  return s === 'ready' || s === 'taught' || s === 'reviewed';
}

function isSkipped(evt) {
  return isInPast(evt.date) && !isPlanned(evt);
}

function getClassStats(className) {
  const instances = getClassInstances(className);
  const total = instances.length;
  const planned = instances.filter(e => isPlanned(e)).length;
  const skipped = instances.filter(e => isSkipped(e)).length;
  const upcoming = instances.filter(e => isUpcoming(e.date) && getLessonStatus(e) !== 'taught' && getLessonStatus(e) !== 'reviewed').length;
  return { total, planned, skipped, upcoming, instances };
}

function getMajorityStatus(statuses) {
  if (!statuses || statuses.length === 0) return 'not_ready';
  const counts = {};
  let maxCount = 0;
  let majority = 'not_ready';
  statuses.forEach(s => {
    counts[s] = (counts[s] || 0) + 1;
    if (counts[s] > maxCount) {
      maxCount = counts[s];
      majority = s;
    }
  });
  return majority;
}

/* ============================================
   RENDERING
   ============================================ */

function renderClassGrid() {
  const grid = document.getElementById('class-grid');
  if (!grid) return;
  const emptyState = document.getElementById('empty-state');
  grid.innerHTML = '';

  const allClasses = getUniqueClasses();
  
  // Filter classes to only those that have instances in the current time filter
  const filteredClasses = allClasses.filter(cls => {
    const stats = getClassStats(cls.name);
    return stats.total > 0;
  });

  if (filteredClasses.length === 0) {
    if (emptyState) emptyState.classList.remove('hidden');
    grid.classList.add('hidden');
    updateGlobalStats(0, 0, 0, 0);
    return;
  }

  if (emptyState) emptyState.classList.add('hidden');
  grid.classList.remove('hidden');

  let gPlanned = 0, gSkipped = 0, gUpcoming = 0, gTotal = 0;

  filteredClasses.forEach(cls => {
    const stats = getClassStats(cls.name);
    
    gPlanned += stats.planned;
    gSkipped += stats.skipped;
    gUpcoming += stats.upcoming;
    gTotal += stats.total;

    const card = createClassCard(cls.name, cls.color, stats);
    grid.appendChild(card);
  });

  updateGlobalStats(filteredClasses.length, gPlanned, gSkipped, gUpcoming, gTotal);
  if (window.lucide) lucide.createIcons();
}

function createClassCard(className, color, stats) {
  const adminData = loadClassAdmin()[className] || { tasks: [] };
  const adminPlanned = adminData.tasks.filter(t => t.done).length;
  const adminTotal = adminData.tasks.length;
  
  const pct = stats.total > 0 ? Math.round((stats.planned / stats.total) * 100) : 0;

  // Next 3 upcoming (for Lessons mode)
  const next3 = stats.instances.filter(e => isUpcoming(e.date)).slice(0, 3);
  let quickHtml = '';
  let headerStatusObj = LESSON_STATUSES[0]; // default not_ready

  if (currentMode === 'lessons') {
    const statuses = stats.instances.map(l => getLessonStatus(l));
    const majority = getMajorityStatus(statuses);
    headerStatusObj = LESSON_STATUSES.find(x => x.id === majority) || LESSON_STATUSES[0];

    quickHtml = next3.length > 0 ? `<ul class="m-0 pl-4 list-disc marker:text-lg">` + next3.map(l => {
      const s = getLessonStatus(l);
      const sObj = LESSON_STATUSES.find(x => x.id === s);
      const dotColor = sObj ? sObj.color : 'var(--text-tertiary)';
      return `
        <li style="color:${dotColor}; font-size: 13px; font-weight: bold; margin-bottom: 2px;">
          <span style="color: var(--text-primary)">${l.lessonPlan?.lesson || l.name}</span> 
          <span style="color: var(--text-tertiary); font-weight: normal; font-size: 12px;">(${formatDate(l.date)})</span>
        </li>
      `;
    }).join('') + `</ul>` : '<p class="text-xs text-slate-400 font-semibold py-1 italic">No upcoming lessons</p>';
  } else {
    // For Units mode: get unique units and their progress
    const unitMap = {};
    const classUnits = loadClassUnits()[className] || {};
    
    // Initialize units from schedule_class_units first
    Object.keys(classUnits).forEach(u => {
      unitMap[u] = { total: 0, planned: 0, status: classUnits[u].status || 'not_ready' };
    });

    stats.instances.forEach(e => {
      const u = e.lessonPlan?.unit || 'Default Unit';
      if (!unitMap[u]) unitMap[u] = { total: 0, planned: 0, status: 'not_ready' };
      unitMap[u].total++;
      if (isPlanned(e)) unitMap[u].planned++;
    });

    const units = Object.keys(unitMap)
      .filter(u => !(u === 'Default Unit' && unitMap[u].total === 0))
      .slice(0, 3);
    
    const allUnitNames = Object.keys(unitMap);
    const statuses = allUnitNames.map(uName => unitMap[uName].status);
    const majority = getMajorityStatus(statuses);
    headerStatusObj = LESSON_STATUSES.find(x => x.id === majority) || LESSON_STATUSES[0];

    quickHtml = units.length > 0 ? `<ul class="m-0 pl-4 list-disc marker:text-lg">` + units.map(u => {
      const uStats = unitMap[u];
      const sObj = LESSON_STATUSES.find(x => x.id === uStats.status);
      const dotColor = sObj ? sObj.color : 'var(--text-tertiary)';

      return `
        <li style="color:${dotColor}; font-size: 13px; font-weight: bold; margin-bottom: 2px;">
          <span style="color: var(--text-primary)">${u}</span> 
          <span style="color: var(--text-tertiary); font-weight: normal; font-size: 12px;">(${uStats.total > 0 ? `${uStats.planned}/${uStats.total} Lessons` : sObj ? sObj.label : 'Empty'})</span>
        </li>
      `;
    }).join('') + `</ul>` : '<p class="text-xs text-slate-400 font-semibold py-1 italic">No active units</p>';
  }

  const hasSkipped = stats.skipped > 0;

  const card = document.createElement('div');
  card.className = `tracker-card ${hasSkipped ? 'has-skipped' : ''}`;
  card.setAttribute('data-class', className);
  card.setAttribute('data-color', color);
  card.onclick = () => openDrawer(className);

  card.innerHTML = `
    <div class="card-header">
      <div class="card-color-strip" style="background:${color}"></div>
      <div class="card-title-area">
        <h3 class="font-heading font-bold">${className}</h3>
        <div class="card-meta">
          <span>${stats.total} Lessons</span>
          ${hasSkipped ? `<span>•</span><span class="text-pink flex items-center gap-1"><span class="skipped-dot"></span> ${stats.skipped} Skipped</span>` : ''}
        </div>
      </div>
      <div class="card-status-badge">
        <span class="px-2 py-1 rounded-lg text-xs font-extrabold uppercase tracking-wider shadow-hard" style="background:${headerStatusObj.color}; color:#fff; border: 2px solid var(--border-primary); transform: translateY(-2px);">
          ${headerStatusObj.label}
        </span>
      </div>
    </div>
    
    <div class="card-body">
      ${adminTotal > 0 ? `
      <div class="card-section">
        <div class="card-section-label mb-1.5">
          <i data-lucide="layout-dashboard" class="w-3 h-3"></i> Class Admin
          <span class="ml-auto">${adminPlanned}/${adminTotal}</span>
        </div>
        <div class="flex gap-1 w-full h-1.5 mb-1">
          ${adminData.tasks.map(t => `
            <div class="flex-1 h-full rounded-sm ${t.done ? 'bg-[var(--color-green)]' : 'bg-[var(--border-secondary)]'}" title="${t.text.replace(/"/g, '&quot;')}"></div>
          `).join('')}
        </div>
        <div class="flex justify-between w-full gap-1">
          ${adminData.tasks.map(t => `
            <span class="flex-1 text-[9px] leading-[11px] uppercase tracking-wider text-slate-400 font-extrabold truncate text-center" title="${t.text.replace(/"/g, '&quot;')}">${t.text}</span>
          `).join('')}
        </div>
      </div>
      ` : ''}
      <div class="card-section pb-0 border-none">
        <div class="card-section-label">
          <i data-lucide="calendar" class="w-3 h-3"></i> Next Up
        </div>
        <div>
          ${quickHtml}
        </div>
      </div>
    </div>
  `;
  return card;
}

function updateCardStats(className) {
  const card = document.querySelector(`#class-grid .tracker-card[data-class="${className}"]`);
  if (!card) return;

  const stats = getClassStats(className);
  const color = card.getAttribute('data-color');
  
  const newCard = createClassCard(className, color, stats);
  card.parentNode.replaceChild(newCard, card);
  
  if (window.lucide) lucide.createIcons();
  recalculateGlobalStats();
}

function recalculateGlobalStats() {
  const allClasses = getUniqueClasses();
  let gClasses = 0, gPlanned = 0, gSkipped = 0, gUpcoming = 0, gTotal = 0;

  allClasses.forEach(cls => {
    const stats = getClassStats(cls.name);
    if (stats.total > 0) {
      gClasses++;
      gPlanned += stats.planned;
      gSkipped += stats.skipped;
      gUpcoming += stats.upcoming;
      gTotal += stats.total;
    }
  });

  updateGlobalStats(gClasses, gPlanned, gSkipped, gUpcoming, gTotal);
}

// Helper: get all class instances regardless of time filter
function getClassInstances_all() {
  const allEvents = loadScheduleEvents();
  return allEvents.filter(e => e.typeId === 'class')
    .filter(e => !(e.isRecurrence && loadRedDays().includes(e.date)));
}

function updateGlobalStats(classes, planned, skipped, upcoming, total = 0) {
  const statClasses = document.getElementById('stat-classes');
  const statPlanned = document.getElementById('stat-planned');
  const statSkipped = document.getElementById('stat-skipped');
  const statUpcoming = document.getElementById('stat-upcoming');

  if (statClasses) statClasses.textContent = classes;
  if (statPlanned) statPlanned.textContent = planned;
  if (statSkipped) statSkipped.textContent = skipped;
  if (statUpcoming) statUpcoming.textContent = upcoming;

  let pct = 0;
  if (total > 0) {
    pct = Math.round((planned / total) * 100);
  }

  const ringFill = document.getElementById('summary-ring-fill');
  const pctText = document.getElementById('summary-percent');
  if (ringFill && pctText) {
    pctText.textContent = `${pct}%`;
    const circ = 213.6; // 2 * pi * 34
    ringFill.style.strokeDashoffset = circ - (pct / 100) * circ;
    
    // Change color based on completion
    if (pct === 100) {
      ringFill.style.stroke = 'var(--color-green)';
    } else if (skipped > 0) {
      ringFill.style.stroke = 'var(--color-pink)';
    } else {
      ringFill.style.stroke = 'var(--color-blue)';
    }
  }

  // Still use alert for skipped? The design says integrate skipped into cards.
  // We left the banner just in case, let's keep it sync'd or hide it.
  const alertEl = document.getElementById('global-alert');
  const textEl = document.getElementById('alert-text');
  if (alertEl && textEl) {
    if (skipped > 0) {
      textEl.textContent = `${skipped} skipped lesson${skipped > 1 ? 's' : ''} — past classes with no plan assigned.`;
      alertEl.classList.remove('hidden');
    } else {
      alertEl.classList.add('hidden');
    }
  }
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatTime(timeStr) {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${period}`;
}

/* ============================================
   FILTER
   ============================================ */

function setFilter(mode) {
  currentFilter = mode;
  document.querySelectorAll('.toolbar-right .toolbar-btn').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById(`filter-${mode}`);
  if (btn) btn.classList.add('active');
  updateFilterLabel(mode);
  renderClassGrid();
  if (currentDrawerClass) openDrawer(currentDrawerClass);
}

function setMode(mode) {
  currentMode = mode;
  document.querySelectorAll('.toolbar-group:first-child .toolbar-btn').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById(`mode-${mode}`);
  if (btn) btn.classList.add('active');
  renderClassGrid();
}

function updateFilterLabel(mode) {
  const el = document.getElementById('filter-range-label');
  if (!el) return;
  if (mode === 'today') {
    const today = new Date();
    el.textContent = today.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  } else if (mode === 'week') {
    const { start, end } = getWeekRange();
    const fmt = s => new Date(s + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    el.textContent = `${fmt(start)} – ${fmt(end)}`;
  } else if (mode === 'month') {
    const now = new Date();
    el.textContent = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  } else {
    el.textContent = 'All lessons';
  }
}

/* ============================================
   DRAWER
   ============================================ */

function openDrawer(className) {
  currentDrawerClass = className;
  const instances = getClassInstances(className);

  const drawerTitle = document.getElementById('drawer-title');
  const drawerSubtitle = document.getElementById('drawer-subtitle');
  const drawerBody = document.getElementById('drawer-body');
  const drawerOverlay = document.getElementById('drawer-overlay');
  const drawerPanel = document.getElementById('drawer-panel');
  const prevScroll = drawerBody ? drawerBody.scrollTop : 0;

  if (drawerTitle) drawerTitle.textContent = className;
  if (drawerSubtitle) drawerSubtitle.textContent = `${instances.length} lessons • ${instances.filter(e => isPlanned(e)).length} planned`;

  // Group by unit
  const unitMap = {};
  instances.forEach(e => {
    const unitKey = e.lessonPlan?.unit || 'Default Unit';
    if (!unitMap[unitKey]) unitMap[unitKey] = [];
    unitMap[unitKey].push(e);
  });

  const classUnits = loadClassUnits()[className] || {};
  Object.keys(classUnits).forEach(uName => {
    if (!unitMap[uName]) unitMap[uName] = [];
  });

  const classAdmin = loadClassAdmin()[className] || { tasks: [] };
  const adminHtml = classAdmin.tasks.map((task, i) => `
    <div class="flex items-center justify-between group/task mb-1">
      <label class="chunky-check" onclick="event.stopPropagation()">
        <input type="checkbox" ${task.done ? 'checked' : ''} onchange="toggleClassAdminTask('${className}', ${i}, this.checked)">
        <div class="box"></div>
        <span class="text-[11px] font-semibold ${task.done ? 'line-through text-slate-400' : ''}">${task.text}</span>
      </label>
      <button onclick="deleteClassAdminTask('${className}', ${i})" class="delete-btn p-1 hover:bg-pink/10 rounded-lg transition-colors">
        <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
      </button>
    </div>
  `).join('');

  let html = `
    <div class="mb-8 p-4 bg-blue/5 border-2 border-blue/20 rounded-2xl">
      <div class="flex flex-col mb-3">
        <h4 class="font-heading text-base font-bold text-blue">Class-Wide Tasks</h4>
        <p class="text-sm text-slate-400 font-semibold mt-0.5">
          Things to do once for the whole class (e.g. print materials, set up gradebook)
        </p>
      </div>
      <div class="mb-3 flex gap-2">
        <input type="text" class="edit-input flex-1" id="ca-input-${className.replace(/[^a-z0-9]/gi, '_')}" placeholder="+ Add class task (e.g. Unit 1 Planning)" onkeydown="if(event.key==='Enter') { addClassAdminTask('${className}', this.value); this.value=''; }">
        <button onclick="const i=document.getElementById('ca-input-${className.replace(/[^a-z0-9]/gi, '_')}'); addClassAdminTask('${className}', i.value); i.value='';" class="px-3 py-1.5 rounded-xl bg-blue text-white text-sm font-bold border-2 border-dark shadow-[2px_2px_0px_0px_rgba(30,41,59,1)] hover:translate-y-[-1px] active:translate-y-[1px]">Add</button>
      </div>
      <div class="space-y-1">
        ${adminHtml || '<p class="text-xs text-slate-400 italic">No class-wide tasks yet.</p>'}
      </div>
    </div>
  `;
  Object.entries(unitMap).forEach(([unitName, lessons]) => {
    if (unitName === 'Default Unit' && lessons.length === 0) return;
    // Sort lessons chronologically to assign accurate numbers
    lessons.sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
    
    const allPlanned = lessons.every(l => isPlanned(l));
    const uData = classUnits[unitName] || { status: 'draft' };
    const uStatus = uData.status;

    html += `
      <div class="mb-6 rounded-xl border-2 border-transparent transition-colors duration-200" ondragover="allowLessonDrop(event)" ondragleave="dragLessonLeave(event)" ondrop="dropLesson(event, '${className}', '${unitName.replace(/'/g, "\\'")}')">
        <div class="flex items-center gap-2 mb-3 pb-2 border-b-[3px] border-[var(--border-primary)] group flex-wrap">
          <i data-lucide="book-open" class="w-4 h-4 text-blue"></i>
          <input type="text" value="${unitName.replace(/"/g, '&quot;')}" class="edit-input flex-1 py-1 px-2 text-base font-heading font-bold bg-transparent border-transparent hover:bg-[var(--surface-card)] hover:border-[var(--border-secondary)] focus:bg-[var(--surface-card)] focus:border-[var(--color-blue)] transition-all cursor-text outline-none min-w-[120px]" onchange="renameUnit('${className}', '${unitName.replace(/'/g, "\\'")}', this.value)" placeholder="Unit Name" title="Edit unit name">
          
          <div class="flex gap-1 items-center ml-auto">
            <button onclick="duplicateUnit('${className}', '${unitName.replace(/'/g, "\\'")}')" class="p-1.5 text-slate-400 hover:text-blue hover:bg-blue/10 rounded-lg transition-colors" title="Duplicate Unit"><i data-lucide="copy" class="w-3.5 h-3.5"></i></button>
            <button onclick="deleteUnit('${className}', '${unitName.replace(/'/g, "\\'")}')" class="p-1.5 text-slate-400 hover:text-pink hover:bg-pink/10 rounded-lg transition-colors" title="Delete Unit"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
          </div>
          
          <div class="flex gap-1.5 w-full mt-2">
            ${LESSON_STATUSES.map(s => `
              <button onclick="updateUnitStatus('${className}', '${unitName.replace(/'/g, "\\'")}', '${s.id}')" class="flex-1" style="padding: 4px 0; font-size: 10px; font-weight: 800; text-transform: uppercase; border-radius: 6px; background: ${uStatus === s.id ? s.color : 'var(--surface-card)'}; color: ${uStatus === s.id ? '#fff' : 'var(--text-tertiary)'}; border: 2px solid ${uStatus === s.id ? s.color : 'var(--border-secondary)'}; box-shadow: ${uStatus === s.id ? 'none' : '0 2px 0 var(--border-secondary)'}; transform: ${uStatus === s.id ? 'translateY(2px)' : 'none'}; transition: all 0.1s;">
                ${s.label}
              </button>
            `).join('')}
          </div>
        </div>
        <div class="flex flex-col gap-1">
    `;

    if (lessons.length === 0) {
      html += `<p class="text-[10px] text-slate-400 italic mb-2 px-2">No lessons assigned to this unit yet. Drag a lesson here.</p>`;
    } else {
      let currentL = 1;
      lessons.forEach((lesson, idx) => {
        if (lesson.lessonPlan && lesson.lessonPlan.lessonNumber) {
          const parsed = parseInt(lesson.lessonPlan.lessonNumber, 10);
          if (!isNaN(parsed)) currentL = parsed;
        }
        
        const lessonNumberDisplay = currentL;
        currentL++;

        const status = getLessonStatus(lesson);
        const skipped = isSkipped(lesson);
        const upcoming = isUpcoming(lesson.date) && status !== 'taught' && status !== 'reviewed';
        const statusObj = LESSON_STATUSES.find(s => s.id === status);
        const rowClass = skipped ? 'lesson-row skipped' : 'lesson-row';

        // Checklist HTML
        const checklistHtml = (lesson.checklist || []).map((item, i) => `
          <div class="flex items-center justify-between group/task mb-1">
            <label class="chunky-check" onclick="event.stopPropagation()">
              <input type="checkbox" ${item.done ? 'checked' : ''} onchange="toggleChecklist('${lesson.id}', ${i}, this.checked)">
              <div class="box"></div>
              <span class="text-[11px] font-semibold ${item.done ? 'line-through text-slate-400' : ''}">${item.text}</span>
            </label>
            <button onclick="event.stopPropagation(); deleteTask('${lesson.id}', ${i})" class="delete-btn p-1 hover:bg-pink/10 rounded-lg transition-colors" title="Delete Task">
              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        `).join('');

        html += `
          <div class="${rowClass} cursor-move bg-[var(--surface-card)]" draggable="true" ondragstart="dragLessonStart(event, '${lesson.id}')" onclick="toggleEdit('${lesson.id}')">
            <div class="flex flex-col px-2 pb-1 gap-2">
              <div class="flex items-center justify-between gap-2">
                <div class="flex items-center gap-2 min-w-0 flex-1">
                  <i data-lucide="grip-vertical" class="w-4 h-4 text-slate-300 hover:text-slate-500 transition-colors flex-shrink-0" onclick="event.stopPropagation()"></i>
                  <div class="status-dot" style="background:${statusObj ? statusObj.color : 'var(--text-tertiary)'}"></div>
                  <div class="flex flex-col min-w-0 flex-1">
                    <span class="font-bold text-base truncate"><span class="text-blue mr-1 opacity-80">L${lessonNumberDisplay}:</span> ${lesson.lessonPlan?.lesson || lesson.name}</span>
                    <span class="text-xs text-slate-400 font-semibold">
                      ${formatDate(lesson.date)} • ${formatTime(lesson.startTime)} • ${lesson.room || 'No Room'}
                    </span>
                  </div>
                </div>
                <div class="flex items-center gap-2 flex-shrink-0">
                  ${skipped ? '<span class="badge-status badge-skipped">Skipped</span>' : ''}
                  ${upcoming ? '<span class="badge-status badge-upcoming">Upcoming</span>' : ''}
                  <i data-lucide="chevron-down" class="w-3.5 h-3.5 text-slate-400 edit-chevron-${lesson.id} transition-transform"></i>
                </div>
              </div>
              <div class="flex gap-1.5 w-full pl-6 mt-1" onclick="event.stopPropagation()">
                ${LESSON_STATUSES.map(s => `
                  <button onclick="updateField('${lesson.id}', 'status', '${s.id}')" class="flex-1" style="padding: 4px 0; font-size: 9px; font-weight: 800; text-transform: uppercase; border-radius: 6px; background: ${status === s.id ? s.color : 'var(--surface-card)'}; color: ${status === s.id ? '#fff' : 'var(--text-tertiary)'}; border: 2px solid ${status === s.id ? s.color : 'var(--border-secondary)'}; box-shadow: ${status === s.id ? 'none' : '0 2px 0 var(--border-secondary)'}; transform: ${status === s.id ? 'translateY(2px)' : 'none'}; transition: all 0.1s;">
                    ${s.label}
                  </button>
                `).join('')}
              </div>
            </div>
            <!-- Edit Panel -->
            <div id="edit-${lesson.id}" class="hidden mt-2" onclick="event.stopPropagation()">
              <div class="edit-panel mx-2">
                <div class="grid grid-cols-[1.5fr_2fr_1fr] gap-3 mb-3">
                  <div>
                    <label class="block text-sm font-extrabold text-slate-400 uppercase tracking-widest mb-1">Unit / Module</label>
                    <input type="text" class="edit-input" value="${(lesson.lessonPlan?.unit || '').replace(/"/g, '&quot;')}" onchange="updateField('${lesson.id}', 'unit', this.value)" placeholder="e.g. Unit 1">
                  </div>
                  <div>
                    <label class="block text-sm font-extrabold text-slate-400 uppercase tracking-widest mb-1">Lesson Topic</label>
                    <input type="text" class="edit-input" value="${(lesson.lessonPlan?.lesson || '').replace(/"/g, '&quot;')}" onchange="updateField('${lesson.id}', 'lesson', this.value)" placeholder="e.g. Introduction">
                  </div>
                  <div>
                    <label class="block text-sm font-extrabold text-slate-400 uppercase tracking-widest mb-1 truncate" title="Lesson Number">L# Override</label>
                    <input type="number" min="1" class="edit-input px-2 text-center" value="${lesson.lessonPlan?.lessonNumber || ''}" onchange="updateField('${lesson.id}', 'lessonNumber', this.value)" placeholder="Auto">
                  </div>
                </div>

                <div class="mb-3">
                  <label class="block text-sm font-extrabold text-slate-400 uppercase tracking-widest mb-1">Notes</label>
                  <textarea class="edit-input edit-textarea" onchange="updateNotes('${lesson.id}', this.value)" placeholder="Add notes...">${lesson.notes || ''}</textarea>
                </div>
                <div>
                  <div class="flex flex-col mb-2">
                    <label class="text-sm font-extrabold text-slate-400 uppercase tracking-widest">This Lesson's Checklist</label>
                    <p class="text-xs text-slate-400 font-semibold mt-0.5">
                      Prep tasks specific to this single lesson session
                    </p>
                  </div>
                  <div class="mb-2 flex gap-2">
                    <input type="text" class="edit-input flex-1" id="task-input-${lesson.id}" placeholder="+ Add a new task..." onkeydown="if(event.key==='Enter') { addTask('${lesson.id}', this.value); this.value=''; }">
                    <button onclick="const i=document.getElementById('task-input-${lesson.id}'); addTask('${lesson.id}', i.value); i.value='';" class="px-3 py-1.5 rounded-xl bg-blue text-white text-sm font-bold border-2 border-dark shadow-[2px_2px_0px_0px_rgba(30,41,59,1)] hover:translate-y-[-1px] active:translate-y-[1px]">Add</button>
                  </div>
                  ${checklistHtml || '<p class="text-xs text-slate-400">No checklist items</p>'}
                </div>
              </div>
            </div>
          </div>
        `;
      });
    }

    html += '</div></div>';
  });

  html += `
    <div class="mt-6 p-4 border-2 border-dashed border-[var(--border-secondary)] rounded-xl bg-[var(--surface-card)]">
      <h4 class="font-heading text-base font-bold mb-2">Create New Unit</h4>
      <div class="flex gap-2">
        <input type="text" class="edit-input flex-1" id="add-unit-input-${className.replace(/[^a-z0-9]/gi, '_')}" placeholder="Unit name..." onkeydown="if(event.key==='Enter') { addNewUnit('${className}', this.value); }">
        <button onclick="const i=document.getElementById('add-unit-input-${className.replace(/[^a-z0-9]/gi, '_')}'); addNewUnit('${className}', i.value);" class="px-3 py-1.5 rounded-xl bg-slate-800 dark:bg-slate-700 text-white text-sm font-bold shadow-neo-sm hover:translate-y-[-1px] active:translate-y-[1px]">Add Unit</button>
      </div>
    </div>
  `;

  if (drawerBody) {
    drawerBody.innerHTML = html;
    drawerBody.scrollTop = prevScroll;
  }
  if (drawerOverlay) drawerOverlay.classList.add('open');
  if (drawerPanel) drawerPanel.classList.add('open');
  if (window.lucide) lucide.createIcons();
}

function closeDrawer() {
  currentDrawerClass = null;
  const drawerOverlay = document.getElementById('drawer-overlay');
  const drawerPanel = document.getElementById('drawer-panel');
  if (drawerOverlay) drawerOverlay.classList.remove('open');
  if (drawerPanel) drawerPanel.classList.remove('open');
}

function toggleEdit(eventId) {
  const panel = document.getElementById(`edit-${eventId}`);
  const chevron = document.querySelector(`.edit-chevron-${eventId}`);
  if (!panel) return;
  const isOpen = !panel.classList.contains('hidden');
  // Close all others first
  document.querySelectorAll('[id^="edit-"]').forEach(el => el.classList.add('hidden'));
  document.querySelectorAll('[class*="edit-chevron-"]').forEach(el => el.style.transform = '');
  if (!isOpen) {
    panel.classList.remove('hidden');
    if (chevron) chevron.style.transform = 'rotate(180deg)';
  }
}

/* ============================================
   DRAG AND DROP FOR LESSONS
   ============================================ */

function dragLessonStart(ev, lessonId) {
  ev.dataTransfer.setData("lessonId", lessonId);
  ev.dataTransfer.effectAllowed = "move";
}

function allowLessonDrop(ev) {
  ev.preventDefault();
  const dz = ev.currentTarget;
  dz.classList.add('border-blue', 'bg-blue/5');
}

function dragLessonLeave(ev) {
  const dz = ev.currentTarget;
  dz.classList.remove('border-blue', 'bg-blue/5');
}

function dropLesson(ev, className, targetUnit) {
  ev.preventDefault();
  const dz = ev.currentTarget;
  dz.classList.remove('border-blue', 'bg-blue/5');

  const lessonId = ev.dataTransfer.getData("lessonId");
  if (!lessonId) return;

  const allEvents = loadScheduleEvents();
  const evt = allEvents.find(e => e.id === lessonId);
  
  if (evt && evt.name === className) {
    if (!evt.lessonPlan) evt.lessonPlan = { unit: '', lesson: '', status: 'not_ready' };
    
    // Only update if unit changed
    if (evt.lessonPlan.unit !== targetUnit) {
      evt.lessonPlan.unit = targetUnit;
      evt.updatedAt = new Date().toISOString();
      saveScheduleEvents(allEvents);
      updateCardStats(className);
      if (currentDrawerClass === className) {
        // Re-open drawer so lessons recount and re-render
        openDrawer(className);
      }
    }
  }
}

/* ============================================
   WRITE BACK TO SCHEDULE DATA
   ============================================ */

function updateField(eventId, field, value) {
  const allEvents = loadScheduleEvents();
  const evt = allEvents.find(e => e.id === eventId);
  if (!evt) return;
  if (!evt.lessonPlan) evt.lessonPlan = { unit: '', lesson: '', status: 'not_ready' };
  evt.lessonPlan[field] = value;
  evt.updatedAt = new Date().toISOString();
  saveScheduleEvents(allEvents);
  updateCardStats(evt.name);
  if (currentDrawerClass) openDrawer(currentDrawerClass);
}

function renameUnit(className, oldName, newName) {
  if (!newName.trim() || oldName === newName) return;
  const allEvents = loadScheduleEvents();
  let changed = false;
  allEvents.forEach(e => {
    if (e.name === className && e.typeId === 'class') {
      const u = e.lessonPlan?.unit || 'Default Unit';
      if (u === oldName) {
        if (!e.lessonPlan) e.lessonPlan = { unit: '', lesson: '', status: 'not_ready' };
        e.lessonPlan.unit = newName.trim();
        e.updatedAt = new Date().toISOString();
        changed = true;
      }
    }
  });

  const unitsData = loadClassUnits();
  if (unitsData[className] && unitsData[className][oldName]) {
    unitsData[className][newName.trim()] = unitsData[className][oldName];
    delete unitsData[className][oldName];
    saveClassUnits(unitsData);
    changed = true;
  }

  if (changed) {
    saveScheduleEvents(allEvents);
    updateCardStats(className);
    if (currentDrawerClass === className) {
      openDrawer(className);
    }
  }
}

function updateUnitStatus(className, unitName, status) {
  const unitsData = loadClassUnits();
  if (!unitsData[className]) unitsData[className] = {};
  if (!unitsData[className][unitName]) unitsData[className][unitName] = { status: 'not_ready' };
  
  unitsData[className][unitName].status = status;
  saveClassUnits(unitsData);
  
  updateCardStats(className);
  if (currentDrawerClass === className) {
    openDrawer(className);
  }
}

/* ============================================
   UNIT MANAGEMENT (DELETE / DUPLICATE)
   ============================================ */

function deleteUnit(className, unitName) {
  if (unitName === 'Default Unit') {
    alert("You cannot delete the Default Unit.");
    return;
  }
  if (!confirm(`Are you sure you want to delete the unit "${unitName}"? All lessons inside will be moved to the Default Unit.`)) return;

  const unitsData = loadClassUnits();
  if (unitsData[className] && unitsData[className][unitName]) {
    delete unitsData[className][unitName];
    saveClassUnits(unitsData);
  }

  const allEvents = loadScheduleEvents();
  let changed = false;
  allEvents.forEach(e => {
    if (e.name === className && e.typeId === 'class' && e.lessonPlan && e.lessonPlan.unit === unitName) {
      e.lessonPlan.unit = 'Default Unit';
      changed = true;
    }
  });

  if (changed) saveScheduleEvents(allEvents);
  updateCardStats(className);
  if (currentDrawerClass === className) openDrawer(className);
}

function duplicateUnit(className, unitName) {
  const newName = prompt(`Enter a name for the duplicated unit:`, `${unitName} (Copy)`);
  if (!newName || newName.trim() === '' || newName === unitName) return;

  // Duplicate the unit structure
  const unitsData = loadClassUnits();
  if (!unitsData[className]) unitsData[className] = {};
  
  const srcStatus = (unitsData[className][unitName] && unitsData[className][unitName].status) ? unitsData[className][unitName].status : 'not_ready';
  unitsData[className][newName.trim()] = { status: srcStatus };
  saveClassUnits(unitsData);

  // Ask if they want to duplicate the lesson plans
  const allEvents = loadScheduleEvents();
  const unitLessons = allEvents.filter(e => e.name === className && e.typeId === 'class' && e.lessonPlan && e.lessonPlan.unit === unitName);
  
  // Ensure we sort source lessons chronologically to duplicate them in order
  unitLessons.sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
  
  if (unitLessons.length > 0 && confirm(`Do you also want to copy the ${unitLessons.length} lesson topics into the new unit?\n\n(They will be automatically assigned to your upcoming empty/unassigned scheduled classes for this group)`)) {
    // Find future classes for this classname that have NO unit and NO lesson
    const upcomingEmpty = allEvents.filter(e => e.name === className && e.typeId === 'class' && isUpcoming(e.date) && (!e.lessonPlan || (!e.lessonPlan.unit && !e.lessonPlan.lesson) || (e.lessonPlan.unit === 'Default Unit' && !e.lessonPlan.lesson)));
    
    // Sort them chronologically
    upcomingEmpty.sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
    
    let changed = false;
    for (let i = 0; i < Math.min(unitLessons.length, upcomingEmpty.length); i++) {
      const srcLesson = unitLessons[i];
      const targetSlot = upcomingEmpty[i];
      
      if (!targetSlot.lessonPlan) targetSlot.lessonPlan = { unit: '', lesson: '', status: 'not_ready' };
      targetSlot.lessonPlan.unit = newName.trim();
      targetSlot.lessonPlan.lesson = srcLesson.lessonPlan.lesson;
      targetSlot.lessonPlan.lessonNumber = srcLesson.lessonPlan.lessonNumber;
      
      // Copy checklist if exists
      if (srcLesson.checklist) {
        targetSlot.checklist = JSON.parse(JSON.stringify(srcLesson.checklist)).map(item => ({...item, done: false}));
      }
      targetSlot.updatedAt = new Date().toISOString();
      changed = true;
    }
    
    if (changed) saveScheduleEvents(allEvents);
    if (unitLessons.length > upcomingEmpty.length) {
      alert(`Note: Only ${upcomingEmpty.length} empty upcoming classes were available to copy into. The remaining ${unitLessons.length - upcomingEmpty.length} lessons were skipped. Please schedule more classes first!`);
    }
  }

  updateCardStats(className);
  if (currentDrawerClass === className) openDrawer(className);
}

function addNewUnit(className, unitName) {
  if (!unitName.trim()) return;
  const unitsData = loadClassUnits();
  if (!unitsData[className]) unitsData[className] = {};
  if (!unitsData[className][unitName.trim()]) {
    unitsData[className][unitName.trim()] = { status: 'not_ready' };
    saveClassUnits(unitsData);
    if (currentDrawerClass === className) {
      openDrawer(className);
    }
  }
}

function updateNotes(eventId, value) {
  const allEvents = loadScheduleEvents();
  const evt = allEvents.find(e => e.id === eventId);
  if (!evt) return;
  evt.notes = value;
  evt.updatedAt = new Date().toISOString();
  saveScheduleEvents(allEvents);
}

function toggleChecklist(eventId, index, checked) {
  const allEvents = loadScheduleEvents();
  const evt = allEvents.find(e => e.id === eventId);
  if (!evt || !evt.checklist || !evt.checklist[index]) return;
  evt.checklist[index].done = checked;
  evt.updatedAt = new Date().toISOString();
  saveScheduleEvents(allEvents);
  updateCardStats(evt.name);
  if (currentDrawerClass) {
    const openId = document.querySelector('[id^="edit-"]:not(.hidden)')?.id.replace('edit-', '');
    openDrawer(currentDrawerClass);
    if (openId) toggleEdit(openId);
  }
}

function addTask(eventId, text) {
  if (!text.trim()) return;
  const allEvents = loadScheduleEvents();
  const evt = allEvents.find(e => e.id === eventId);
  if (!evt) return;
  if (!evt.checklist) evt.checklist = [];
  evt.checklist.push({
    id: `chk_${Date.now()}`,
    text: text.trim(),
    done: false
  });
  evt.updatedAt = new Date().toISOString();
  saveScheduleEvents(allEvents);
  updateCardStats(evt.name);
  if (currentDrawerClass) {
    const openId = document.querySelector('[id^="edit-"]:not(.hidden)')?.id.replace('edit-', '');
    openDrawer(currentDrawerClass);
    if (openId) toggleEdit(openId);
  }
}

function deleteTask(eventId, index) {
  const allEvents = loadScheduleEvents();
  const evt = allEvents.find(e => e.id === eventId);
  if (!evt || !evt.checklist || !evt.checklist[index]) return;
  evt.checklist.splice(index, 1);
  evt.updatedAt = new Date().toISOString();
  saveScheduleEvents(allEvents);
  updateCardStats(evt.name);
  if (currentDrawerClass) {
    const openId = document.querySelector('[id^="edit-"]:not(.hidden)')?.id.replace('edit-', '');
    openDrawer(currentDrawerClass);
    if (openId) toggleEdit(openId);
  }
}

/* ============================================
   THEME
   ============================================ */

function toggleTheme() {
  document.documentElement.classList.toggle('dark');
  localStorage.setItem('theme_admin-tracker', document.documentElement.classList.contains('dark') ? 'dark' : 'light');
}

function refreshData() {
  renderClassGrid();
}

/* ============================================
   INIT
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {
  renderClassGrid();
  updateFilterLabel(currentFilter);
  if (window.lucide) lucide.createIcons();
});

// Listen for storage changes (if schedule is updated in another tab)
window.addEventListener('storage', (e) => {
  if (e.key === 'schedule_events' || e.key === 'schedule_red_days' || e.key === 'schedule_class_admin') {
    renderClassGrid();
  }
});

/* ============================================
   CLASS ADMIN ACTIONS
   ============================================ */

function addClassAdminTask(className, text) {
  if (!text.trim()) return;
  const data = loadClassAdmin();
  if (!data[className]) data[className] = { tasks: [] };
  data[className].tasks.push({
    text: text.trim(),
    done: false
  });
  saveClassAdmin(data);
  updateCardStats(className);
  if (currentDrawerClass) {
    const openId = document.querySelector('[id^="edit-"]:not(.hidden)')?.id.replace('edit-', '');
    openDrawer(className);
    if (openId) toggleEdit(openId);
  } else {
    openDrawer(className);
  }
}

function deleteClassAdminTask(className, index) {
  const data = loadClassAdmin();
  if (!data[className] || !data[className].tasks[index]) return;
  data[className].tasks.splice(index, 1);
  saveClassAdmin(data);
  updateCardStats(className);
  if (currentDrawerClass) {
    const openId = document.querySelector('[id^="edit-"]:not(.hidden)')?.id.replace('edit-', '');
    openDrawer(className);
    if (openId) toggleEdit(openId);
  } else {
    openDrawer(className);
  }
}

function toggleClassAdminTask(className, index, checked) {
  const data = loadClassAdmin();
  if (!data[className] || !data[className].tasks[index]) return;
  data[className].tasks[index].done = checked;
  saveClassAdmin(data);
  updateCardStats(className);
  if (currentDrawerClass) {
    const openId = document.querySelector('[id^="edit-"]:not(.hidden)')?.id.replace('edit-', '');
    openDrawer(className);
    if (openId) toggleEdit(openId);
  } else {
    openDrawer(className);
  }
}
