/* ============================================
   ADMIN TRACKER LOGIC
   ============================================ */


let currentFilter = 'week'; // 'today', 'week', 'all'
let currentMode = 'lessons'; // 'lessons', 'units'
let currentDrawerClass = null;

/* ============================================
   DATA LAYER — Dual-mode: localStorage + Cloud
   ============================================ */

function loadScheduleEvents() {
  const mastersRaw = localStorage.getItem('schedule_events');
  const promotedRaw = localStorage.getItem('schedule_promoted_instances');
  let masters = [];
  if (mastersRaw) {
    try {
      const parsed = JSON.parse(mastersRaw);
      if (Array.isArray(parsed)) masters = parsed;
    } catch(e) {}
  }
  
  let promoted = [];
  if (promotedRaw) {
    try {
      const parsed = JSON.parse(promotedRaw);
      if (Array.isArray(parsed)) promoted = parsed;
    } catch(e) {}
  }
  
  let allEvents = [...masters];
  masters.forEach(m => {
    if (m.recurrence && m.recurrence !== 'none') {
      const rangeStart = new Date(m.date);
      const rangeEnd = new Date(rangeStart);
      rangeEnd.setMonth(rangeEnd.getMonth() + 6);
      const clones = generateRecurrences(m, rangeStart, rangeEnd);
      allEvents = [...allEvents, ...clones];
    }
  });
  return allEvents;
}

function saveScheduleEvents(allEvents) {
  const masters = allEvents.filter(e => !e.isRecurrence);
  const promoted = allEvents.filter(e => e.isRecurrence && (window.Sync ? Sync.isPromoted(e) : false));

  localStorage.setItem('schedule_events', JSON.stringify(masters));
  localStorage.setItem('schedule_promoted_instances', JSON.stringify(promoted));
  
  // Non-blocking cloud save
  if (window.Sync) Sync.fireCloudSave(userId =>
    Sync.cloudReplaceAllScheduleEvents(userId, [...masters, ...promoted])
  );
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
  // Non-blocking cloud save
  if (window.Sync) Sync.fireCloudSave(userId =>
    Sync.cloudSaveClassAdmin(userId, data)
  );
}

function loadClassUnits() {
  const raw = localStorage.getItem('schedule_class_units');
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}

function saveClassUnits(data) {
  localStorage.setItem('schedule_class_units', JSON.stringify(data));
  // Non-blocking cloud save
  if (window.Sync) Sync.fireCloudSave(userId =>
    Sync.cloudSaveClassUnits(userId, data)
  );
}

function getClassEvents() {
  const allEvents = loadScheduleEvents();
  return allEvents.filter(e => e.typeId === 'class');
}

function get3DaysRange() {
  const now = new Date();
  const later = new Date(now);
  later.setDate(now.getDate() + 2);
  const fmt = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  return { start: fmt(now), end: fmt(later) };
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
  } else if (currentFilter === '3days') {
    const { start, end } = get3DaysRange();
    filtered = filtered.filter(e => e.date >= start && e.date <= end);
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
  const ready = instances.filter(e => getLessonStatus(e) === 'ready').length;
  const taught = instances.filter(e => getLessonStatus(e) === 'taught' || getLessonStatus(e) === 'reviewed').length;
  const planned = instances.filter(e => isPlanned(e)).length;
  const skipped = instances.filter(e => isSkipped(e)).length;
  const upcoming = instances.filter(e => isUpcoming(e.date) && getLessonStatus(e) !== 'taught' && getLessonStatus(e) !== 'reviewed').length;
  return { total, ready, taught, planned, skipped, upcoming, instances };
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
    recalculateGlobalStats();
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

  recalculateGlobalStats();
  if (window.lucide) lucide.createIcons();
}

/**
 * Returns HTML string for the card header including class name, color strip and status badge
 */
function renderCardHeader(className, color, stats, headerStatusObj) {
  const hasSkipped = stats.skipped > 0;
  return `
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
  `;
}

/**
 * Returns HTML string for the admin task progress strip (bar + labels)
 */
function renderAdminStrip(adminData) {
  const adminTotal = adminData.tasks.length;
  const adminPlanned = adminData.tasks.filter(t => t.done).length;
  
  if (adminTotal === 0) return '';

  return `
    <div class="card-section">
      <div class="card-section-label mb-1.5">
        <i data-lucide="layout-dashboard" class="w-3 h-3"></i> Class Admin
        <span class="ml-auto">${adminPlanned}/${adminTotal}</span>
      </div>
      <div class="flex gap-1 w-full h-1.5 mb-1">
        ${adminData.tasks.map(t => {
          const isOverdue = !t.done && t.deadline && t.deadline < getTodayStr();
          return `
            <div class="flex-1 h-full rounded-sm ${t.done ? 'bg-[var(--color-green)]' : (isOverdue ? 'bg-pink' : 'bg-[var(--border-secondary)]')}" title="${t.text.replace(/"/g, '&quot;')}"></div>
          `;
        }).join('')}
      </div>
      <div class="flex justify-between w-full gap-1">
        ${adminData.tasks.map(t => {
          const isOverdue = !t.done && t.deadline && t.deadline < getTodayStr();
          return `
            <span class="flex-1 text-[9px] leading-[11px] uppercase tracking-wider ${isOverdue ? 'text-pink' : 'text-slate-400'} font-extrabold truncate text-center" title="${t.text.replace(/"/g, '&quot;')}">${t.text}</span>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

/**
 * Returns HTML string for the upcoming lessons or units list preview
 */
function renderNextUpSection(instances, mode, classUnits, className) {
  let quickHtml = '';

  if (mode === 'lessons') {
    const next3 = instances.filter(e => isUpcoming(e.date)).slice(0, 3);
    quickHtml = next3.length > 0 ? `<div class="space-y-1.5 mt-2">` + next3.map(l => {
      const s = getLessonStatus(l);
      const sObj = LESSON_STATUSES.find(x => x.id === s);
      const statusColor = sObj ? sObj.color : 'var(--text-tertiary)';
      const label = sObj ? sObj.label : 'Unknown';
      return `
        <div class="flex items-center gap-2">
          <span class="px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wider text-white shadow-sm flex-shrink-0" style="background:${statusColor}">${label}</span>
          <span class="text-[12px] font-bold truncate flex-1" style="color: var(--text-primary)">${l.lessonPlan?.lesson || l.name}</span> 
          <span class="text-[10px] text-slate-400 font-semibold whitespace-nowrap">${formatDate(l.date)}</span>
        </div>
      `;
    }).join('') + `</div>` : '<p class="text-xs text-slate-400 font-semibold py-1 italic">No upcoming lessons</p>';
  } else {
    const unitMap = {};
    Object.keys(classUnits).forEach(u => {
      unitMap[u] = { total: 0, planned: 0, status: classUnits[u].status || 'not_ready' };
    });

    instances.forEach(e => {
      const u = e.lessonPlan?.unit || 'Default Unit';
      if (!unitMap[u]) unitMap[u] = { total: 0, planned: 0, status: 'not_ready' };
      unitMap[u].total++;
      if (isPlanned(e)) unitMap[u].planned++;
    });

    const units = Object.keys(unitMap)
      .filter(u => !(u === 'Default Unit' && unitMap[u].total === 0))
      .slice(0, 3);

    quickHtml = units.length > 0 ? `<div class="space-y-1.5 mt-2">` + units.map(u => {
      const uStats = unitMap[u];
      const sObj = LESSON_STATUSES.find(x => x.id === uStats.status);
      const statusColor = sObj ? sObj.color : 'var(--text-tertiary)';
      const label = sObj ? sObj.label : 'Empty';

      return `
        <div class="flex items-center gap-2">
          <span class="px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wider text-white shadow-sm flex-shrink-0" style="background:${statusColor}">${label}</span>
          <span class="text-[12px] font-bold truncate flex-1" style="color: var(--text-primary)">${u}</span> 
          <span class="text-[10px] text-slate-400 font-semibold whitespace-nowrap">${uStats.total > 0 ? `${uStats.planned}/${uStats.total}` : ''}</span>
        </div>
      `;
    }).join('') + `</div>` : '<p class="text-xs text-slate-400 font-semibold py-1 italic">No active units</p>';
  }

  return `
    <div class="card-section pb-0 border-none">
      <div class="card-section-label">
        <i data-lucide="calendar" class="w-3 h-3"></i> Next Up
      </div>
      <div>
        ${quickHtml}
      </div>
    </div>
  `;
}

function createClassCard(className, color, stats) {
  const adminData = loadClassAdmin()[className] || { tasks: [] };
  const classUnits = loadClassUnits()[className] || {};
  
  // Calculate Header Status
  let headerStatusObj = LESSON_STATUSES[0];
  if (currentMode === 'lessons') {
    const statuses = stats.instances.map(l => getLessonStatus(l));
    const majority = getMajorityStatus(statuses);
    headerStatusObj = LESSON_STATUSES.find(x => x.id === majority) || LESSON_STATUSES[0];
  } else {
    const unitMap = {};
    Object.keys(classUnits).forEach(u => { unitMap[u] = { status: classUnits[u].status || 'not_ready' }; });
    stats.instances.forEach(e => {
      const u = e.lessonPlan?.unit || 'Default Unit';
      if (!unitMap[u]) unitMap[u] = { status: 'not_ready' };
    });
    const statuses = Object.keys(unitMap).map(u => unitMap[u].status);
    const majority = getMajorityStatus(statuses);
    headerStatusObj = LESSON_STATUSES.find(x => x.id === majority) || LESSON_STATUSES[0];
  }

  const card = document.createElement('div');
  const hasSkipped = stats.skipped > 0;
  card.className = `tracker-card ${hasSkipped ? 'has-skipped' : ''}`;
  card.setAttribute('data-class', className);
  card.setAttribute('data-color', color);
  card.onclick = () => openDrawer(className);

  card.innerHTML = `
    ${renderCardHeader(className, color, stats, headerStatusObj)}
    <div class="card-body">
      ${renderAdminStrip(adminData)}
      ${renderNextUpSection(stats.instances, currentMode, classUnits, className)}
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
  const adminData = loadClassAdmin();
  const unitData = loadClassUnits();
  const todayStr = getTodayStr();

  const stats = {
    classes: 0,
    lessons: { total: 0, upcoming: 0, ready: 0, finished: 0, skipped: 0 },
    units: { total: 0, draft: 0, ready: 0, finished: 0 },
    admin: { total: 0, pending: 0, done: 0, overdue: 0 }
  };

  allClasses.forEach(cls => {
    const cStats = getClassStats(cls.name);
    if (cStats.total > 0) {
      stats.classes++;
      stats.lessons.total += cStats.total;
      stats.lessons.ready += cStats.ready;
      stats.lessons.finished += cStats.taught;
      stats.lessons.skipped += cStats.skipped;
      stats.lessons.upcoming += cStats.upcoming;
    }
    
    // Admin stats
    const classAdmin = adminData[cls.name];
    if (classAdmin && classAdmin.tasks) {
      classAdmin.tasks.forEach(t => {
        stats.admin.total++;
        if (t.done) stats.admin.done++;
        else {
          stats.admin.pending++;
          if (t.deadline && t.deadline < todayStr) stats.admin.overdue++;
        }
      });
    }

    // Unit stats
    const classUnits = unitData[cls.name] || {};
    Object.keys(classUnits).forEach(uName => {
      const u = classUnits[uName];
      stats.units.total++;
      if (u.status === 'ready') stats.units.ready++;
      else if (u.status === 'taught' || u.status === 'reviewed') stats.units.finished++;
      else if (u.status === 'draft') stats.units.draft++;
    });
  });

  updateGlobalStats(stats);
}

// Helper: get all class instances regardless of time filter
function getClassInstances_all() {
  const allEvents = loadScheduleEvents();
  return allEvents.filter(e => e.typeId === 'class')
    .filter(e => !(e.isRecurrence && loadRedDays().includes(e.date)));
}

function updateGlobalStats(data) {
  const circ = 213.6;

  // 1. Lessons
  const l = data.lessons;
  const lpPct = l.total > 0 ? Math.round(((l.ready + l.finished) / l.total) * 100) : 0;
  
  const ringLessons = document.getElementById('ring-lessons');
  if (ringLessons) {
    ringLessons.style.strokeDashoffset = circ - (lpPct / 100) * circ;
    ringLessons.style.stroke = l.skipped > 0 ? 'var(--color-orange)' : 'var(--color-blue)';
  }
  const elPctL = document.getElementById('pct-lessons');
  if (elPctL) elPctL.textContent = `${lpPct}%`;
  
  const elStatL = document.getElementById('stat-progress');
  if (elStatL) elStatL.textContent = `${l.ready + l.finished}/${l.total}`;
  
  const set = (id, val) => { const e = document.getElementById(id); if(e) e.textContent = val; };
  set('stat-lessons-upcoming', l.upcoming);
  set('stat-lessons-ready', l.ready);
  set('stat-lessons-finished', l.finished);
  set('stat-lessons-skipped', l.skipped);

  // 2. Units
  const u = data.units;
  const uPct = u.total > 0 ? Math.round(((u.ready + u.finished) / u.total) * 100) : 0;
  const ringUnits = document.getElementById('ring-units');
  if (ringUnits) ringUnits.style.strokeDashoffset = circ - (uPct / 100) * circ;
  set('pct-units', `${uPct}%`);
  set('stat-units', `${u.ready + u.finished}/${u.total}`);
  set('stat-units-draft', u.draft);
  set('stat-units-ready', u.ready);
  set('stat-units-finished', u.finished);

  // 3. Admin
  const a = data.admin;
  const aPct = a.total > 0 ? Math.round((a.done / a.total) * 100) : 0;
  const ringAdmin = document.getElementById('ring-admin');
  if (ringAdmin) {
    ringAdmin.style.strokeDashoffset = circ - (aPct / 100) * circ;
    ringAdmin.style.stroke = a.overdue > 0 ? 'var(--color-pink)' : 'var(--color-orange)';
  }
  set('pct-admin', `${aPct}%`);
  set('stat-admin', `${a.done}/${a.total}`);
  set('stat-admin-pending', a.pending);
  set('stat-admin-done', a.done);
  set('stat-admin-overdue', a.overdue);

  const overdueBadge = document.getElementById('stat-overdue-badge');
  if (overdueBadge) {
    if (a.overdue > 0) overdueBadge.classList.remove('hidden');
    else overdueBadge.classList.add('hidden');
  }

  // Alert
  const alertEl = document.getElementById('global-alert');
  const textEl = document.getElementById('alert-text');
  if (alertEl && textEl) {
    if (l.skipped > 0) {
      textEl.textContent = `${l.skipped} skipped lesson${l.skipped > 1 ? 's' : ''} — past classes with no plan assigned.`;
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
  } else if (mode === '3days') {
    const { start, end } = get3DaysRange();
    const fmt = s => new Date(s + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    el.textContent = `${fmt(start)} – ${fmt(end)}`;
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
  const drawerOverlay = document.getElementById('drawer-overlay');
  const drawerPanel = document.getElementById('drawer-panel');
  
  if (currentMode === 'units') {
    renderUnitsDrawer(className);
  } else {
    renderLessonsDrawer(className);
  }

  if (drawerOverlay) drawerOverlay.classList.add('open');
  if (drawerPanel) drawerPanel.classList.add('open');
  if (window.lucide) lucide.createIcons();
}

function renderLessonsDrawer(className) {
  const instances = getClassInstances(className);
  const drawerTitle = document.getElementById('drawer-title');
  const drawerSubtitle = document.getElementById('drawer-subtitle');
  const drawerBody = document.getElementById('drawer-body');
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
    <div class="flex flex-col mb-2 bg-[var(--surface-card)] rounded-xl border-2 border-[var(--border-secondary)] p-2">
      <div class="flex items-center justify-between group/task">
        <label class="chunky-check flex-1 min-w-0" onclick="event.stopPropagation()">
          <input type="checkbox" ${task.done ? 'checked' : ''} onchange="toggleClassAdminTask('${className}', ${i}, this.checked)">
          <div class="box"></div>
          <span class="text-[11px] font-semibold truncate ${task.done ? 'line-through text-slate-400' : ''}">${task.text}</span>
        </label>
        <div class="flex gap-1.5 items-center flex-shrink-0">
          <button onclick="document.getElementById('ca-deadline-panel-${className.replace(/[^a-z0-9]/gi, '_')}-${i}').classList.toggle('hidden')" class="p-2 text-slate-400 hover:text-blue rounded-lg transition-colors" title="Set Deadline">
            <i data-lucide="calendar" class="w-4 h-4"></i>
          </button>
          <button onclick="deleteClassAdminTask('${className}', ${i})" class="delete-btn p-2 hover:bg-pink/10 rounded-lg transition-colors">
            <i data-lucide="trash-2" class="w-4 h-4"></i>
          </button>
        </div>
      </div>
      
      ${task.deadline && !task.done ? `
        <div class="ml-7 mt-1 text-[10px] font-bold ${task.deadline < getTodayStr() ? 'text-pink' : 'text-slate-400'}">
          <i data-lucide="clock" class="w-3 h-3 inline-block mr-0.5 align-text-bottom"></i>
          ${task.deadline < getTodayStr() ? 'Overdue: ' : 'Due: '} ${formatDate(task.deadline)}
        </div>
      ` : ''}

      <div id="ca-deadline-panel-${className.replace(/[^a-z0-9]/gi, '_')}-${i}" class="hidden mt-2 ml-7 bg-slate-50 dark:bg-slate-800 p-2 rounded-lg border-2 border-[var(--border-secondary)]">
        <label class="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1">Deadline</label>
        <div class="flex items-center gap-2 mb-2">
          <input type="date" class="edit-input flex-1 py-1 px-2 text-xs" value="${task.deadline || ''}" onchange="setTaskDeadline('${className}', ${i}, this.value)">
          <button onclick="setTaskDeadline('${className}', ${i}, '')" class="text-[10px] font-bold text-slate-400 hover:text-pink uppercase tracking-wider px-2 py-1">Clear</button>
        </div>
        <div class="flex flex-wrap gap-1">
          <button onclick="setTaskDeadlineDays('${className}', ${i}, 1)" class="px-2 py-1 bg-slate-200 dark:bg-slate-700 rounded text-[9px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 hover:bg-blue hover:text-white transition-colors">1 Day</button>
          <button onclick="setTaskDeadlineDays('${className}', ${i}, 3)" class="px-2 py-1 bg-slate-200 dark:bg-slate-700 rounded text-[9px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 hover:bg-blue hover:text-white transition-colors">3 Days</button>
          <button onclick="setTaskDeadlineDays('${className}', ${i}, 7)" class="px-2 py-1 bg-slate-200 dark:bg-slate-700 rounded text-[9px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 hover:bg-blue hover:text-white transition-colors">1 Week</button>
          <button onclick="setTaskDeadlineDays('${className}', ${i}, 14)" class="px-2 py-1 bg-slate-200 dark:bg-slate-700 rounded text-[9px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 hover:bg-blue hover:text-white transition-colors">2 Weeks</button>
        </div>
      </div>
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
}

function renderUnitsDrawer(className) {
  const instances = getClassInstances(className);
  const drawerTitle = document.getElementById('drawer-title');
  const drawerSubtitle = document.getElementById('drawer-subtitle');
  const drawerBody = document.getElementById('drawer-body');
  const prevScroll = drawerBody ? drawerBody.scrollTop : 0;

  const unitMap = {};
  instances.forEach(e => {
    const unitKey = e.lessonPlan?.unit || 'Default Unit';
    if (!unitMap[unitKey]) unitMap[unitKey] = { lessons: [] };
    unitMap[unitKey].lessons.push(e);
  });

  const classUnits = loadClassUnits()[className] || {};
  Object.keys(classUnits).forEach(uName => {
    if (!unitMap[uName]) unitMap[uName] = { lessons: [] };
    unitMap[uName].status = classUnits[uName].status || 'draft';
  });

  const units = Object.entries(unitMap).filter(([name, data]) => !(name === 'Default Unit' && data.lessons.length === 0));
  
  // Stats
  const totalUnits = units.length;
  const readyUnits = units.filter(([_, data]) => data.status === 'ready' || data.status === 'taught' || data.status === 'reviewed').length;
  const readinessPct = totalUnits > 0 ? Math.round((readyUnits / totalUnits) * 100) : 0;

  if (drawerTitle) drawerTitle.textContent = className;
  if (drawerSubtitle) drawerSubtitle.textContent = `${totalUnits} units • ${readinessPct}% ready`;

  if (units.length === 0) {
    if (drawerBody) {
      drawerBody.innerHTML = `
        <div class="flex flex-col items-center justify-center py-20 text-center opacity-60">
          <div class="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
            <i data-lucide="layers" class="w-8 h-8 text-slate-400"></i>
          </div>
          <h3 class="font-heading text-xl font-bold mb-1">No units yet</h3>
          <p class="text-sm font-semibold text-slate-400 max-w-[240px]">Assign lessons to units from the Lessons view</p>
          <button onclick="const n=prompt('Unit Name:'); if(n) addNewUnit('${className}', n);" class="mt-6 px-4 py-2 rounded-xl bg-blue text-white font-bold text-sm border-2 border-dark shadow-neo-sm hover:translate-y-[-1px] active:translate-y-[1px]">
            + Create First Unit
          </button>
        </div>
      `;
    }
    return;
  }

  let html = `
    <div class="grid grid-cols-2 gap-3 mb-8">
      <div class="bg-blue/5 border-2 border-blue/20 rounded-2xl p-4 text-center">
        <span class="block text-2xl font-heading text-blue">${totalUnits}</span>
        <span class="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Total Units</span>
      </div>
      <div class="bg-green/5 border-2 border-green/20 rounded-2xl p-4 text-center">
        <span class="block text-2xl font-heading text-green">${readinessPct}%</span>
        <span class="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Overall Readiness</span>
      </div>
    </div>
    
    <div class="space-y-4">
  `;

  units.forEach(([unitName, data]) => {
    const totalL = data.lessons.length;
    const taughtL = data.lessons.filter(l => {
      const s = getLessonStatus(l);
      return s === 'taught' || s === 'reviewed';
    }).length;
    const progressPct = totalL > 0 ? Math.round((taughtL / totalL) * 100) : 0;
    const uStatus = data.status || 'draft';

    html += `
      <div class="p-4 bg-[var(--surface-card)] rounded-2xl border-2 border-[var(--border-secondary)] shadow-sm">
        <div class="flex items-start justify-between mb-3">
          <div class="min-w-0 flex-1">
            <h4 class="font-heading text-base font-bold truncate">${unitName}</h4>
            <p class="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mt-0.5">${totalL} Lessons</p>
          </div>
          <div class="flex gap-1 ml-4">
             <button onclick="duplicateUnit('${className}', '${unitName.replace(/'/g, "\\'")}')" class="p-1.5 text-slate-400 hover:text-blue hover:bg-blue/10 rounded-lg transition-colors"><i data-lucide="copy" class="w-3.5 h-3.5"></i></button>
             <button onclick="deleteUnit('${className}', '${unitName.replace(/'/g, "\\'")}')" class="p-1.5 text-slate-400 hover:text-pink hover:bg-pink/10 rounded-lg transition-colors"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
          </div>
        </div>

        <div class="flex gap-1 mb-4">
          ${LESSON_STATUSES.map(s => `
            <button onclick="updateUnitStatus('${className}', '${unitName.replace(/'/g, "\\'")}', '${s.id}')" class="flex-1" style="padding: 6px 0; font-size: 9px; font-weight: 800; text-transform: uppercase; border-radius: 8px; background: ${uStatus === s.id ? s.color : 'var(--bg-tertiary)'}; color: ${uStatus === s.id ? '#fff' : 'var(--text-tertiary)'}; border: 2px solid ${uStatus === s.id ? s.color : 'var(--border-secondary)'}; box-shadow: ${uStatus === s.id ? 'none' : '0 2px 0 var(--border-secondary)'}; transform: ${uStatus === s.id ? 'translateY(2px)' : 'none'}; transition: all 0.1s;">
              ${s.label}
            </button>
          `).join('')}
        </div>

        <div class="flex flex-col gap-1.5">
          <div class="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider">
            <span class="text-slate-400">Taught Progress</span>
            <span class="text-blue">${taughtL}/${totalL}</span>
          </div>
          <div class="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden border border-[var(--border-secondary)]">
            <div class="h-full bg-blue transition-all duration-500" style="width: ${progressPct}%"></div>
          </div>
        </div>
      </div>
    `;
  });

  html += `
    </div>
    <button onclick="const n=prompt('Unit Name:'); if(n) addNewUnit('${className}', n);" class="w-full mt-8 p-4 border-2 border-dashed border-[var(--border-secondary)] rounded-2xl text-slate-400 font-bold hover:border-blue hover:text-blue hover:bg-blue/5 transition-all text-sm flex items-center justify-center gap-2">
      <i data-lucide="plus" class="w-4 h-4"></i> Add New Unit
    </button>
  `;

  if (drawerBody) {
    drawerBody.innerHTML = html;
    drawerBody.scrollTop = prevScroll;
  }
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
    const normalizedTarget = targetUnit === 'Default Unit' ? '' : targetUnit;
    if (evt.lessonPlan.unit !== normalizedTarget) {
      evt.lessonPlan.unit = normalizedTarget;
      evt.updatedAt = new Date().toISOString();
      if (evt.isRecurrence) evt._modified = true;
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
  if (evt.isRecurrence) evt._modified = true;
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
      e.lessonPlan.unit = '';
      if (e.isRecurrence) e._modified = true;
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
  if (evt.isRecurrence) evt._modified = true;
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
   TOAST (for sync notifications)
   ============================================ */

function showToast(message, type = 'info') {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] flex flex-col gap-3 items-center pointer-events-none';
    document.body.appendChild(container);
  }

  const types = {
    info:    { icon: 'info',           color: 'bg-blue text-white' },
    success: { icon: 'check-circle',   color: 'bg-green text-white' },
    warning: { icon: 'alert-triangle', color: 'bg-orange text-white' },
    error:   { icon: 'x-circle',       color: 'bg-pink text-white' },
  };
  const config = types[type] || types.info;

  const toast = document.createElement('div');
  toast.className = `px-4 py-3 rounded-xl shadow-neo font-bold text-sm flex items-center gap-3 transform transition-all duration-300 translate-y-10 opacity-0 ${config.color} border-2 border-[#1e293b]`;
  toast.innerHTML = `<i data-lucide="${config.icon}" class="w-5 h-5"></i><span>${message}</span>`;
  container.appendChild(toast);
  if (window.lucide) lucide.createIcons({ root: toast });

  setTimeout(() => {
    toast.classList.remove('translate-y-10', 'opacity-0');
    toast.classList.add('translate-y-0', 'opacity-100');
  }, 10);
  setTimeout(() => {
    toast.classList.remove('translate-y-0', 'opacity-100');
    toast.classList.add('translate-y-10', 'opacity-0');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Expose for sync.js
window.showToast = showToast;

/* ============================================
   INIT
   ============================================ */

// Re-render callback for sync.js loadFromCloud
window._syncRerender = function () {
  renderClassGrid();
};

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Render immediately from localStorage
  renderClassGrid();
  updateFilterLabel(currentFilter);
  if (window.lucide) lucide.createIcons();

  // 2. Cloud mode: handle first-login migration and sync
  if (window.Sync && Sync.isCloudMode()) {
    try {
      const user = await getUser();
      if (user && !user.is_sandbox) {
        await Sync.handleFirstCloudLogin(user.id);
      } else {
        Sync.setSyncBadge('local');
      }
    } catch (err) {
      console.error('[Admin] Cloud init failed:', err);
      Sync.setSyncBadge('error');
    }
  } else if (window.Sync) {
    Sync.setSyncBadge('local');
  }
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
    id: `task_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
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

function setTaskDeadline(className, index, dateStr) {
  const data = loadClassAdmin();
  if (!data[className] || !data[className].tasks[index]) return;
  data[className].tasks[index].deadline = dateStr || null;
  saveClassAdmin(data);
  if (currentDrawerClass) {
    const openId = document.querySelector('[id^="edit-"]:not(.hidden)')?.id.replace('edit-', '');
    openDrawer(className);
    if (openId) toggleEdit(openId);
  } else {
    openDrawer(className);
  }
}

function setTaskDeadlineDays(className, index, days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const fmt = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  setTaskDeadline(className, index, fmt(date));
}
