/* ============================================
   ADMIN TRACKER LOGIC
   ============================================ */


let currentFilter = 'week'; // 'today', 'week', 'all'
let currentMode = 'lessons'; // 'lessons', 'units'
let currentView = 'table'; // 'cards', 'table'
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
    } catch (e) { }
  }

  let promoted = [];
  if (promotedRaw) {
    try {
      const parsed = JSON.parse(promotedRaw);
      if (Array.isArray(parsed)) promoted = parsed;
    } catch (e) { }
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

  // Overwrite clones with promoted instances
  promoted.forEach(p => {
    const idx = allEvents.findIndex(e => e.id === p.id);
    if (idx !== -1) {
      allEvents[idx] = p;
    } else if (p.isRecurrence) {
      // If it's a promoted instance but not in the generated list (e.g. range changed), still keep it
      allEvents.push(p);
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
  if (window.Sync) {
    Sync.fireCloudSave(async userId => {
      await Sync.cloudSaveScheduleEvents(userId, [...masters, ...promoted]);
    });
  }
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
  const fmt = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { start: fmt(now), end: fmt(later) };
}

function getWeekRange() {
  const now = new Date();
  const day = now.getDay();
  const mon = new Date(now); mon.setDate(now.getDate() - ((day + 6) % 7));
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  const fmt = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { start: fmt(mon), end: fmt(sun) };
}

function getMonthRange() {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const fmt = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { start: fmt(firstDay), end: fmt(lastDay) };
}

function getClassInstances(masterName) {
  const allEvents = loadScheduleEvents();
  const redDays = loadRedDays();
  let filtered = allEvents
    .filter(e => e.name === masterName && e.typeId === 'class')
    .filter(e => !(e.isRecurrence && redDays.includes(e.date)))
    // Exclude recurring master events — they're always represented by their clones,
    // so keeping both causes the first date to appear twice in the sequence.
    .filter(e => !(!e.isRecurrence && e.recurrence && e.recurrence !== 'none'));

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

function getClassInstances_all(masterName) {
  const allEvents = loadScheduleEvents();
  const redDays = loadRedDays();
  return allEvents
    .filter(e => e.name === masterName && e.typeId === 'class')
    .filter(e => !(e.isRecurrence && redDays.includes(e.date)))
    // Exclude recurring master events — they're always represented by their clones,
    // so keeping both causes the first date to appear twice in the sequence.
    .filter(e => !(!e.isRecurrence && e.recurrence && e.recurrence !== 'none'))
    .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
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
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isInPast(dateStr) { return dateStr < getTodayStr(); }
function isUpcoming(dateStr) { return dateStr >= getTodayStr(); }

function isDateInFilter(dateStr) {
  if (currentFilter === 'today') return dateStr === getTodayStr();
  if (currentFilter === '3days') {
    const { start, end } = get3DaysRange();
    return dateStr >= start && dateStr <= end;
  }
  if (currentFilter === 'week') {
    const { start, end } = getWeekRange();
    return dateStr >= start && dateStr <= end;
  }
  if (currentFilter === 'month') {
    const { start, end } = getMonthRange();
    return dateStr >= start && dateStr <= end;
  }
  return true; // 'all'
}

function getClassStats(className) {
  const allEvents = loadScheduleEvents();
  const redDays = loadRedDays();
  const syllabusMap = loadClassUnits();

  const instances = getClassInstances(className);
  const total = instances.length;
  let taught = 0, planned = 0, skipped = 0, upcoming = 0;

  instances.forEach(evt => {
    const session = window.Sync.getSessionForDate(className, evt.date, allEvents, redDays, syllabusMap, evt.startTime);

    let status = 'not_ready';
    if (session.override_type) {
      status = 'ready';
    } else if (session.lesson) {
      status = session.lesson.status || (session.lesson.is_completed ? 'completed' : 'not_ready');
    }

    if (status === 'completed') {
      taught++;
      planned++; // completed implies it was planned/ready
    } else if (status === 'ready') {
      planned++;
      if (isUpcoming(evt.date)) upcoming++;
      else skipped++;
    } else {
      if (isInPast(evt.date)) skipped++;
      else upcoming++;
    }
  });

  return { total, taught, planned, ready: planned - taught, skipped, upcoming, instances };
}

function getHeaderStatusObj(stats) {
  if (stats.total === 0) return LESSON_STATUSES[0];
  if (stats.taught === stats.total) return LESSON_STATUSES.find(x => x.id === 'taught');
  if (stats.skipped > 0) return LESSON_STATUSES[0]; // not_ready
  return LESSON_STATUSES.find(x => x.id === 'ready') || LESSON_STATUSES[2];
}

/* ============================================
   RENDERING
   ============================================ */

function renderClassGrid() {
  const grid = document.getElementById('class-grid');
  const tableContainer = document.getElementById('class-table-view');
  if (!grid || !tableContainer) return;
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
    tableContainer.classList.add('hidden');
    recalculateGlobalStats();
    return;
  }

  if (emptyState) emptyState.classList.add('hidden');

  if (currentView === 'cards') {
    grid.classList.remove('hidden');
    tableContainer.classList.add('hidden');

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
  } else {
    grid.classList.add('hidden');
    tableContainer.classList.remove('hidden');
    renderTableView(filteredClasses);
  }

  recalculateGlobalStats();
  if (window.lucide) lucide.createIcons();
}

function scrollToToday() {
  const todayBadge = document.querySelector('th span.bg-blue');
  if (todayBadge) {
    const th = todayBadge.closest('th');
    th.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }
}

function renderTableView(classes) {
  const dateSet = new Set();
  const allEvents = loadScheduleEvents();
  const redDays = loadRedDays();
  const syllabusMap = loadClassUnits();
  const adminData = loadClassAdmin();
  const classDataMap = {};

  classes.forEach(cls => {
    const stats = getClassStats(cls.name);
    const adminTasks = window.Sync.getAdminDataForClass(cls.name, adminData) || [];

    classDataMap[cls.name] = {
      color: cls.color,
      stats: stats,
      instancesByDate: {},
      tasksByDate: {}
    };

    // Add dates for instances
    stats.instances.forEach(evt => {
      dateSet.add(evt.date);
      if (!classDataMap[cls.name].instancesByDate[evt.date]) {
        classDataMap[cls.name].instancesByDate[evt.date] = [];
      }
      classDataMap[cls.name].instancesByDate[evt.date].push(evt);
    });

    // Add dates for admin tasks (only if they fall within the current filter)
    adminTasks.forEach(task => {
      if (task.deadline && !task.done && isDateInFilter(task.deadline)) {
        dateSet.add(task.deadline);
        if (!classDataMap[cls.name].tasksByDate[task.deadline]) {
          classDataMap[cls.name].tasksByDate[task.deadline] = [];
        }
        classDataMap[cls.name].tasksByDate[task.deadline].push(task);
      }
    });
  });

  const sortedDates = Array.from(dateSet).sort();

  const thead = document.getElementById('table-header-row');
  const tbody = document.getElementById('table-body');

  // Header
  let headerHtml = `<th class="p-3 font-heading text-[10px] uppercase tracking-widest text-slate-400 bg-chalk dark:bg-dark sticky left-0 z-20 w-40 border-r-2 border-[var(--border-secondary)]">Class</th>`;
  sortedDates.forEach(dateStr => {
    const isToday = dateStr === getTodayStr();
    headerHtml += `
      <th class="p-4 font-heading text-sm whitespace-nowrap ${isToday ? 'text-blue' : ''} bg-slate-50 dark:bg-slate-900/50">
        ${isToday ? '<span class="px-2 py-0.5 rounded-md bg-blue text-white text-[10px] mr-1 shadow-sm">TODAY</span>' : ''}
        ${formatDate(dateStr)}
      </th>
    `;
  });
  thead.innerHTML = headerHtml;

  // Body
  let bodyHtml = '';
  classes.forEach(cls => {
    const cdata = classDataMap[cls.name];
    const headerStatusObj = getHeaderStatusObj(cdata.stats);
    
    bodyHtml += `<tr class="border-b-2 border-slate-200 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/20 group">`;
    bodyHtml += `
      <td class="p-3 sticky left-0 z-10 bg-white/80 dark:bg-dark/80 backdrop-blur-md group-hover:bg-slate-50 dark:group-hover:bg-slate-800/50 border-r-2 border-[var(--border-secondary)] transition-colors" onclick="openDrawer('${cls.name.replace(/'/g, "\\'")}')" style="cursor: pointer;">
        <div class="flex items-center gap-2">
          <div class="w-1 h-8 rounded-full flex-shrink-0 shadow-sm" style="background:${cdata.color}"></div>
          <div class="flex-1 min-w-0">
            <div class="flex flex-col mb-1">
              <div class="font-heading font-bold text-[12px] leading-tight truncate max-w-[100px]">${cls.name}</div>
              <div class="mt-1 flex">
                <span class="px-1.5 py-0.5 rounded text-[7px] font-black uppercase tracking-wider text-white shadow-sm flex-shrink-0" style="background:${headerStatusObj.color}">${headerStatusObj.label}</span>
              </div>
            </div>
            <div class="text-[8px] font-extrabold uppercase tracking-widest text-slate-400">${cdata.stats.total} Sess</div>
          </div>
        </div>
      </td>
    `;

    sortedDates.forEach(dateStr => {
      bodyHtml += `<td class="p-3 align-top min-w-[190px]">`;

      const instances = cdata.instancesByDate[dateStr] || [];
      const tasks = cdata.tasksByDate[dateStr] || [];

      if (instances.length === 0 && tasks.length === 0) {
        bodyHtml += `<div class="h-full flex items-center pt-5"><div class="w-full h-1 bg-slate-100 dark:bg-slate-800/50 rounded-full mx-4"></div></div>`;
      } else {
        bodyHtml += `<div class="space-y-3">`;

        // Render instances
        instances.forEach(inst => {
          const session = window.Sync.getSessionForDate(cls.name, inst.date, allEvents, redDays, syllabusMap, inst.startTime);
          const ls = session.lesson?.status || (session.lesson?.is_completed ? 'completed' : 'not_ready');
          const isCompleted = ls === 'completed';
          const isReady = ls === 'ready' || session.override_type;

          const statusColor = session.override_type ? 'var(--color-purple)' : (isCompleted ? 'var(--color-green)' : (isReady ? 'var(--color-blue)' : 'var(--text-tertiary)'));
          const label = session.override_type ? 'Override' : (isCompleted ? 'Taught' : (isReady ? 'Ready' : 'Draft'));
          const title = session.override_type || session.lesson?.lesson || 'No Lesson Planned';
          const unitLabel = session.lesson?.unit ? `<span class="block text-[10px] font-extrabold uppercase tracking-widest text-slate-400 truncate mt-1"><i data-lucide="layers" class="w-3 h-3 inline pb-0.5"></i> ${session.lesson.unit}</span>` : '';

          bodyHtml += `
            <div class="p-2.5 rounded-xl border-[3px] border-[var(--border-primary)] bg-[var(--surface-card)] shadow-[2px_2px_0px_0px_rgba(30,41,59,0.1)] hover:shadow-hard transition-all cursor-pointer hover:-translate-y-0.5" onclick="openDrawer('${cls.name.replace(/'/g, "\\'")}')">
              <div class="flex items-center gap-2 mb-1">
                <button onclick="event.stopPropagation(); cycleSyllabusLessonStatus('${cls.name.replace(/'/g, "\\'")}', ${session.sequenceIndex})" class="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider text-white shadow-sm hover:brightness-110 active:translate-y-0.5 transition-all" style="background:${statusColor}">${label}</button>
                <span class="text-[10px] font-extrabold text-slate-400 ml-auto whitespace-nowrap"><i data-lucide="clock" class="w-3 h-3 inline pb-0.5"></i> ${formatTime(inst.startTime)}</span>
              </div>
              <div class="text-[12px] font-bold leading-snug text-dark dark:text-white line-clamp-2">${title}</div>
              ${unitLabel}
            </div>
          `;
        });

        // Render tasks
        tasks.forEach(task => {
          const isOverdue = task.deadline < getTodayStr();
          const dueToday = task.deadline === getTodayStr();
          bodyHtml += `
            <div class="p-2.5 rounded-xl border-2 ${isOverdue ? 'border-pink bg-pink/5' : 'border-orange bg-orange/5'} flex items-start gap-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors" onclick="openDrawer('${cls.name.replace(/'/g, "\\'")}')">
              <i data-lucide="${isOverdue ? 'alert-octagon' : 'alert-circle'}" class="w-4 h-4 mt-0.5 ${isOverdue ? 'text-pink' : 'text-orange'} flex-shrink-0"></i>
              <div>
                <div class="text-[12px] font-bold leading-tight ${isOverdue ? 'text-pink' : 'text-orange'}">${task.text}</div>
                <div class="text-[9px] font-black uppercase tracking-widest mt-1 ${isOverdue ? 'text-pink' : 'text-orange'}">${isOverdue ? 'OVERDUE TASK' : 'DUE TODAY'}</div>
              </div>
            </div>
          `;
        });

        bodyHtml += `</div>`;
      }

      bodyHtml += `</td>`;
    });

    bodyHtml += `</tr>`;
  });

  tbody.innerHTML = bodyHtml;
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
function renderAdminStrip(tasks) {
  const adminTotal = tasks.length;
  const adminPlanned = tasks.filter(t => t.done).length;

  if (adminTotal === 0) return '';

  return `
    <div class="card-section">
      <div class="card-section-label mb-1.5">
        <i data-lucide="layout-dashboard" class="w-3 h-3"></i> Class Admin
        <span class="ml-auto">${adminPlanned}/${adminTotal}</span>
      </div>
      <div class="flex gap-1 w-full h-1.5 mb-1">
        ${tasks.map(t => {
    const isOverdue = !t.done && t.deadline && t.deadline < getTodayStr();
    return `
            <div class="flex-1 h-full rounded-sm ${t.done ? 'bg-[var(--color-green)]' : (isOverdue ? 'bg-pink' : 'bg-[var(--border-secondary)]')}" title="${t.text.replace(/"/g, '&quot;')}"></div>
          `;
  }).join('')}
      </div>
      <div class="flex justify-between w-full gap-1">
        ${tasks.map(t => {
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
function renderNextUpSection(instances, mode, classSyllabus, className) {
  let quickHtml = '';
  const allEvents = loadScheduleEvents();
  const redDays = loadRedDays();
  const syllabusMap = loadClassUnits();

  if (mode === 'lessons') {
    const next3 = instances.filter(e => isUpcoming(e.date)).slice(0, 3);
    quickHtml = next3.length > 0 ? `<div class="space-y-1.5 mt-2">` + next3.map(l => {
      const session = window.Sync.getSessionForDate(className, l.date, allEvents, redDays, syllabusMap, l.startTime);
      const ls = session.lesson?.status || (session.lesson?.is_completed ? 'completed' : 'not_ready');
      const isCompleted = ls === 'completed';
      const isReady = ls === 'ready' || session.override_type;

      const statusColor = session.override_type ? 'var(--color-purple)' : (isCompleted ? 'var(--color-green)' : (isReady ? 'var(--color-blue)' : 'var(--text-tertiary)'));
      const label = session.override_type ? 'Override' : (isCompleted ? 'Taught' : (isReady ? 'Ready' : 'Draft'));
      const title = session.override_type || session.lesson?.lesson || 'No Lesson Planned';

      return `
        <div class="flex items-center gap-2">
          <span class="px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wider text-white shadow-sm flex-shrink-0" style="background:${statusColor}">${label}</span>
          <span class="text-[12px] font-bold truncate flex-1" style="color: var(--text-primary)">${title}</span> 
          <span class="text-[10px] text-slate-400 font-semibold whitespace-nowrap">${formatDate(l.date)}</span>
        </div>
      `;
    }).join('') + `</div>` : '<p class="text-xs text-slate-400 font-semibold py-1 italic">No upcoming lessons</p>';
  } else {
    // Group syllabus by unit
    const unitMap = {};
    classSyllabus.forEach(item => {
      if (!unitMap[item.unit]) unitMap[item.unit] = { total: 0, completed: 0 };
      unitMap[item.unit].total++;
      if (item.status === 'completed' || item.is_completed) unitMap[item.unit].completed++;
    });

    const units = Object.keys(unitMap).slice(0, 3);
    quickHtml = units.length > 0 ? `<div class="space-y-1.5 mt-2">` + units.map(u => {
      const uStats = unitMap[u];
      const statusColor = uStats.completed === uStats.total ? 'var(--color-green)' : 'var(--color-blue)';
      const label = uStats.completed === uStats.total ? 'Taught' : 'Active';

      return `
        <div class="flex items-center gap-2">
          <span class="px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wider text-white shadow-sm flex-shrink-0" style="background:${statusColor}">${label}</span>
          <span class="text-[12px] font-bold truncate flex-1" style="color: var(--text-primary)">${u}</span> 
          <span class="text-[10px] text-slate-400 font-semibold whitespace-nowrap">${uStats.total > 0 ? `${uStats.completed}/${uStats.total}` : ''}</span>
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
  const adminTasks = window.Sync.getAdminDataForClass(className, loadClassAdmin());
  const classSyllabus = loadClassUnits()[className] || [];

  let headerStatusObj = getHeaderStatusObj(stats);

  const card = document.createElement('div');
  const hasSkipped = stats.skipped > 0;
  card.className = `tracker-card ${hasSkipped ? 'has-skipped' : ''}`;
  card.setAttribute('data-class', className);
  card.setAttribute('data-color', color);
  card.onclick = () => openDrawer(className);

  card.innerHTML = `
    ${renderCardHeader(className, color, stats, headerStatusObj)}
    <div class="card-body">
      ${renderAdminStrip(adminTasks)}
      ${renderNextUpSection(stats.instances, currentMode, classSyllabus, className)}
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
    syllabus: { total: 0, finished: 0 },
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
    const tasks = window.Sync.getAdminDataForClass(cls.name, adminData);
    if (tasks) {
      tasks.forEach(t => {
        stats.admin.total++;
        if (t.done) stats.admin.done++;
        else {
          stats.admin.pending++;
          if (t.deadline && t.deadline < todayStr) stats.admin.overdue++;
        }
      });
    }

    // Syllabus stats
    const syllabus = unitData[cls.name] || [];
    stats.syllabus.total += syllabus.length;
    syllabus.forEach(item => {
      if (item.is_completed) stats.syllabus.finished++;
    });
  });

  updateGlobalStats(stats);
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

  const set = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
  set('stat-lessons-upcoming', l.upcoming);
  set('stat-lessons-ready', l.ready);
  set('stat-lessons-finished', l.finished);
  set('stat-lessons-skipped', l.skipped);

  // 2. Syllabus
  const s = data.syllabus;
  const sPct = s.total > 0 ? Math.round((s.finished / s.total) * 100) : 0;
  const ringUnits = document.getElementById('ring-units');
  if (ringUnits) ringUnits.style.strokeDashoffset = circ - (sPct / 100) * circ;
  set('pct-units', `${sPct}%`);
  set('stat-units', `${s.finished}/${s.total}`);
  set('stat-units-draft', s.total);
  set('stat-units-finished', s.finished);

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

  // Show Toast for skipped lessons if any
  console.log(`[Stats] Lessons: upcoming=${l.upcoming}, ready=${l.ready}, finished=${l.finished}, skipped=${l.skipped}`);
  if (l.skipped > 0) {
    const msg = `${l.skipped} skipped lesson${l.skipped > 1 ? 's' : ''} — past classes with no plan assigned.`;
    // Only toast if it hasn't been toasted this session to avoid spamming
    if (!window._skippedToasted) {
      console.log('[Stats] Triggering skipped lessons toast');
      window.showToast(msg, 'warning');
      window._skippedToasted = true;
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

function setView(view) {
  currentView = view;
  document.getElementById('view-cards').classList.toggle('active', view === 'cards');
  document.getElementById('view-table').classList.toggle('active', view === 'table');
  renderClassGrid();
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
  renderLessonsDrawer(className);

  if (drawerOverlay) drawerOverlay.classList.add('open');
  if (drawerPanel) drawerPanel.classList.add('open');
  if (window.lucide) lucide.createIcons();
}


function renderLessonsDrawer(className) {
  const allEvents = loadScheduleEvents();
  const redDays = loadRedDays();
  const syllabusMap = loadClassUnits();

  const classSyllabus = syllabusMap[className] || [];
  const adminTasks = window.Sync.getAdminDataForClass(className, loadClassAdmin()) || [];
  const instances = getClassInstances(className);
  const allInstances = getClassInstances_all(className);

  const drawerTitle = document.getElementById('drawer-title');
  const drawerSubtitle = document.getElementById('drawer-subtitle');
  const drawerBody = document.getElementById('drawer-body');

  if (drawerTitle) drawerTitle.textContent = className;
  if (drawerSubtitle) drawerSubtitle.textContent = `${instances.length} lessons • ${classSyllabus.length} planned`;

  // Render Admin Tasks
  const adminHtml = adminTasks.map((task, i) => `
    <div class="flex flex-col mb-2 bg-[var(--surface-card)] rounded-xl border-2 border-[var(--border-secondary)] p-2">
      <div class="flex items-center justify-between group/task">
        <label class="chunky-check flex-1 min-w-0" onclick="event.stopPropagation()">
          <input type="checkbox" ${task.done ? 'checked' : ''} onchange="toggleClassAdminTask('${className}', '${task.id}', this.checked)">
          <div class="box"></div>
          <span class="text-[11px] font-semibold truncate ${task.done ? 'line-through text-slate-400' : ''}">${task.text}</span>
        </label>
        <div class="flex gap-1.5 items-center flex-shrink-0">
          <button onclick="document.getElementById('ca-deadline-panel-${className.replace(/[^a-z0-9]/gi, '_')}-${task.id}').classList.toggle('hidden')" class="p-2 text-slate-400 hover:text-blue rounded-lg transition-colors" title="Set Deadline">
            <i data-lucide="calendar" class="w-4 h-4"></i>
          </button>
          <button onclick="deleteClassAdminTask('${className}', '${task.id}')" class="delete-btn p-2 hover:bg-pink/10 rounded-lg transition-colors">
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

      <div id="ca-deadline-panel-${className.replace(/[^a-z0-9]/gi, '_')}-${task.id}" class="hidden mt-2 ml-7 bg-slate-50 dark:bg-slate-800 p-2 rounded-lg border-2 border-[var(--border-secondary)]">
        <label class="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1">Deadline</label>
        <div class="flex items-center gap-2 mb-2">
          <input type="date" class="edit-input flex-1 py-1 px-2 text-xs" value="${task.deadline || ''}" onchange="setTaskDeadline('${className}', '${task.id}', this.value)">
          <button onclick="setTaskDeadline('${className}', '${task.id}', '')" class="text-[10px] font-bold text-slate-400 hover:text-pink uppercase tracking-wider px-2 py-1">Clear</button>
        </div>
        <div class="flex flex-wrap gap-1">
          <button onclick="setTaskDeadlineDays('${className}', '${task.id}', 1)" class="px-2 py-1 bg-slate-200 dark:bg-slate-700 rounded text-[9px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 hover:bg-blue hover:text-white transition-colors">1 Day</button>
          <button onclick="setTaskDeadlineDays('${className}', '${task.id}', 3)" class="px-2 py-1 bg-slate-200 dark:bg-slate-700 rounded text-[9px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 hover:bg-blue hover:text-white transition-colors">3 Days</button>
          <button onclick="setTaskDeadlineDays('${className}', '${task.id}', 7)" class="px-2 py-1 bg-slate-200 dark:bg-slate-700 rounded text-[9px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 hover:bg-blue hover:text-white transition-colors">1 Week</button>
          <button onclick="setTaskDeadlineDays('${className}', '${task.id}', 14)" class="px-2 py-1 bg-slate-200 dark:bg-slate-700 rounded text-[9px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 hover:bg-blue hover:text-white transition-colors">2 Weeks</button>
        </div>
      </div>
    </div>
  `).join('');

  let html = `
    <div class="mb-10 p-5 bg-slate-50 dark:bg-slate-900/50 border-2 border-slate-200 dark:border-slate-800 rounded-2xl relative overflow-hidden">
      <div class="absolute top-0 left-0 w-1 h-full bg-blue"></div>
      <div class="flex flex-col mb-4">
        <h4 class="font-heading text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2"><i data-lucide="check-square" class="w-4 h-4 text-blue"></i> Class-Wide Tasks</h4>
        <p class="text-xs text-slate-400 font-semibold mt-1">
          Things to do once for the whole class (e.g. print materials, set up gradebook)
        </p>
      </div>
      <div class="mb-4 flex gap-2">
        <input type="text" class="edit-input flex-1 py-1.5 px-3 text-sm font-bold bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl focus:border-blue transition-all" id="ca-input-${className.replace(/[^a-z0-9]/gi, '_')}" placeholder="+ Add new task..." onkeydown="if(event.key==='Enter') { addClassAdminTask('${className}', this.value); this.value=''; }">
        <button onclick="const i=document.getElementById('ca-input-${className.replace(/[^a-z0-9]/gi, '_')}'); addClassAdminTask('${className}', i.value); i.value='';" class="px-4 py-1.5 rounded-xl bg-blue text-white text-xs font-black uppercase tracking-widest border-2 border-dark shadow-[2px_2px_0px_0px_rgba(30,41,59,1)] hover:translate-y-[-1px] active:translate-y-[1px] active:shadow-none transition-all">Add</button>
      </div>
      <div class="space-y-2">
        ${adminHtml || '<p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center py-2 opacity-50">No tasks yet</p>'}
      </div>
    </div>
  `;

  // Render Syllabus Editor
  const groupedSyllabus = {};
  classSyllabus.forEach((item, index) => {
    const u = item.unit || '(No Unit)';
    if (!groupedSyllabus[u]) groupedSyllabus[u] = [];
    groupedSyllabus[u].push({ ...item, originalIndex: index });
  });

  html += `
    <div class="mb-8">
      <div class="flex items-center justify-between mb-4">
        <h4 class="font-heading text-base font-bold">Syllabus</h4>
        <button onclick="addSyllabusUnit('${className}')" class="px-3 py-1.5 rounded-xl bg-blue text-white text-sm font-bold border-2 border-dark shadow-[2px_2px_0px_0px_rgba(30,41,59,1)] hover:translate-y-[-1px] active:translate-y-[1px]">+ Add Unit</button>
      </div>
      <div class="space-y-6" id="syllabus-list-${className.replace(/[^a-z0-9]/gi, '_')}">
  `;

  if (Object.keys(groupedSyllabus).length === 0) {
    html += `<p class="text-xs text-slate-400 italic mb-2 text-center py-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700">No syllabus created yet. Add your first unit.</p>`;
  } else {
    Object.entries(groupedSyllabus).forEach(([unitName, lessons]) => {
      const unitBaseIndex = parseInt(lessons[0]?.unitStartIndex || 1);
      html += `
        <div class="unit-group p-5 bg-[var(--surface-card)] rounded-2xl border-2 border-slate-200 dark:border-slate-800 mb-6 transition-all hover:border-slate-300 dark:hover:border-slate-600">
          <div class="flex items-center justify-between mb-4 gap-3">
            <div class="flex-1 flex items-center gap-3 bg-slate-50 dark:bg-slate-900/50 px-3 py-1.5 rounded-xl border-2 border-slate-200 dark:border-slate-700 focus-within:border-blue transition-all">
              <input type="text" class="text-sm font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 bg-transparent border-none outline-none focus:text-blue w-full placeholder:text-slate-400" value="${unitName}" placeholder="Unit Name" onchange="updateSyllabusUnitName('${className}', '${unitName.replace(/'/g, "\\'")}', this.value)">
              <div class="flex items-center gap-1.5 px-2 py-0.5 bg-white dark:bg-slate-800 rounded-lg border-2 border-slate-200 dark:border-slate-700 flex-shrink-0">
                <span class="text-[8px] font-black uppercase text-slate-400">L#</span>
                <input type="number" class="w-8 bg-transparent border-none text-[10px] font-black text-blue p-0 text-center focus:ring-0 outline-none" value="${unitBaseIndex}" onchange="updateSyllabusUnitStartIndex('${className}', '${unitName.replace(/'/g, "\\'")}', this.value)">
              </div>
            </div>
            <div class="flex items-center gap-2">
              <button onclick="addSyllabusLesson('${className}', '${unitName.replace(/'/g, "\\'")}')" class="px-3 py-1.5 rounded-lg bg-[var(--surface-card)] text-[10px] font-extrabold uppercase tracking-widest border-[var(--border-width-medium)] border-[var(--border-primary)] shadow-[2px_2px_0px_0px_rgba(30,41,59,1)] hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-none transition-all whitespace-nowrap">+ Lesson</button>
              <button onclick="deleteSyllabusUnit('${className}', '${unitName.replace(/'/g, "\\'")}')" class="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[var(--color-pink)] border-[var(--border-width-medium)] border-transparent hover:border-[var(--border-primary)] hover:shadow-[2px_2px_0px_0px_rgba(30,41,59,1)] transition-all" title="Delete Unit"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
            </div>
          </div>
          <div class="space-y-2">
      `;

      lessons.forEach((item, i) => {
        const index = item.originalIndex;
        const inst = allInstances[index];
        const dateHtml = inst ? `<span class="text-[10px] font-bold text-slate-400 ml-2 whitespace-nowrap"><i data-lucide="calendar" class="w-3 h-3 inline"></i> ${formatDate(inst.date)}</span>` : '';

        const resolvedStatus = item.status || (item.is_completed ? 'completed' : 'not_ready');
        const statusMap = {
          'not_ready': { label: 'Draft', cls: 'bg-slate-200 text-slate-500 dark:bg-slate-700' },
          'ready': { label: 'Ready', cls: 'bg-blue text-white' },
          'completed': { label: 'Done', cls: 'bg-green text-white' }
        };
        const s = statusMap[resolvedStatus];

        html += `
          <div class="flex items-center gap-3 p-3 bg-white dark:bg-slate-800/50 border-2 border-slate-100 dark:border-slate-800 rounded-xl relative group/lesson hover:border-slate-200 dark:hover:border-slate-700 transition-colors">
            <button onclick="cycleSyllabusLessonStatus('${className}', ${index})" class="flex-shrink-0 w-16 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border-2 border-dark shadow-[2px_2px_0px_0px_rgba(30,41,59,1)] active:translate-y-[1px] active:shadow-none hover:brightness-110 ${s.cls}">
              ${s.label}
            </button>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-3">
                <span class="text-xs font-black text-slate-300 w-8 flex-shrink-0 flex items-center justify-center bg-slate-50 dark:bg-slate-900 py-1 rounded-md">
                  ${unitBaseIndex + i}
                </span>
                <input type="text" class="edit-input flex-1 py-1.5 px-2 text-sm font-bold bg-transparent border-transparent hover:bg-slate-50 dark:hover:bg-slate-800 transition-all outline-none" value="${(item.lesson || '').replace(/"/g, '&quot;')}" placeholder="Lesson Name" onchange="updateSyllabusLesson('${className}', ${index}, 'lesson', this.value)">
                ${dateHtml}
              </div>
            </div>
            <button onclick="deleteSyllabusLesson('${className}', ${index})" class="p-2 text-slate-300 hover:text-pink hover:bg-pink/10 rounded-lg transition-colors flex-shrink-0 opacity-0 group-hover/lesson:opacity-100" title="Delete Lesson"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
          </div>
        `;
      });

      html += `</div></div>`;
    });
  }

  html += `</div></div>`;

  if (drawerBody) {
    drawerBody.innerHTML = html;
    if (window.lucide) lucide.createIcons();
  }
}


function closeDrawer() {
  currentDrawerClass = null;
  const drawerOverlay = document.getElementById('drawer-overlay');
  const drawerPanel = document.getElementById('drawer-panel');
  if (drawerOverlay) drawerOverlay.classList.remove('open');
  if (drawerPanel) drawerPanel.classList.remove('open');
}



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
  if (e.key === 'schedule_events' || e.key === 'schedule_red_days' || e.key === 'schedule_class_admin' || e.key === 'schedule_class_units') {
    renderClassGrid();
    if (currentDrawerClass) renderLessonsDrawer(currentDrawerClass);
  }
});

/* ============================================
   CLASS ADMIN ACTIONS
   ============================================ */


// --- TASK CRUD ---
function addClassAdminTask(className, text) {
  if (!text.trim()) return;
  const data = loadClassAdmin();
  if (!data[className]) data[className] = [];
  data[className].push({ id: (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : Date.now().toString(), text: text.trim(), done: false, deadline: null });
  saveClassAdmin(data);
  renderLessonsDrawer(className);
  renderClassGrid();
}
function toggleClassAdminTask(className, taskId, isDone) {
  const data = loadClassAdmin();
  const tasks = data[className] || [];
  const task = tasks.find(t => t.id === taskId);
  if (task) task.done = isDone;
  saveClassAdmin(data);
  renderLessonsDrawer(className);
  renderClassGrid();
}
function deleteClassAdminTask(className, taskId) {
  const data = loadClassAdmin();
  const tasks = data[className] || [];
  data[className] = tasks.filter(t => t.id !== taskId);
  saveClassAdmin(data);
  renderLessonsDrawer(className);
  renderClassGrid();
}
function setTaskDeadline(className, taskId, dateStr) {
  const data = loadClassAdmin();
  const tasks = data[className] || [];
  const task = tasks.find(t => t.id === taskId);
  if (task) task.deadline = dateStr || null;
  saveClassAdmin(data);
  renderLessonsDrawer(className);
  renderClassGrid();
}
function setTaskDeadlineDays(className, taskId, days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  setTaskDeadline(className, taskId, getDayString(d));
}

// --- SYLLABUS CRUD ---
function addSyllabusLesson(className, unitName = '(No Unit)') {
  const data = loadClassUnits();
  if (!data[className]) data[className] = [];
  
  const unitLessons = data[className].filter(l => l.unit === unitName);
  const firstLesson = unitLessons[0];
  const unitBaseIndex = parseInt(firstLesson?.unitStartIndex || 1);
  const lessonNumber = unitBaseIndex + unitLessons.length;
  
  const nextIndex = data[className].length;
  data[className].push({ 
    index: nextIndex, 
    unit: unitName, 
    lesson: `Lesson ${lessonNumber}`, 
    status: 'not_ready' 
  });
  
  saveClassUnits(data);
  renderLessonsDrawer(className);
  renderClassGrid();
}

async function addSyllabusUnit(className) {
  const unitName = await window.showPrompt('Enter unit name:');
  if (unitName && unitName.trim()) {
    addSyllabusLesson(className, unitName.trim());
  }
}

function updateSyllabusUnitName(className, oldUnitName, newUnitName) {
  if (!newUnitName.trim()) return;
  const data = loadClassUnits();
  if (data[className]) {
    data[className].forEach(item => {
      if (item.unit === oldUnitName) item.unit = newUnitName.trim();
    });
    saveClassUnits(data);
    renderLessonsDrawer(className);
    renderClassGrid();
  }
}

function updateSyllabusUnitStartIndex(className, unitName, newStart) {
  const val = parseInt(newStart);
  if (isNaN(val)) return;
  const data = loadClassUnits();
  if (data[className]) {
    // Find the first lesson of this unit and store the start index there
    const firstLesson = data[className].find(item => item.unit === unitName);
    if (firstLesson) {
      firstLesson.unitStartIndex = val;
      saveClassUnits(data);
      renderLessonsDrawer(className);
      renderClassGrid();
    }
  }
}

async function deleteSyllabusUnit(className, unitName) {
  if (!(await window.showConfirm(`Are you sure you want to delete "${unitName}" and all its lessons?`))) return;
  const data = loadClassUnits();
  if (data[className]) {
    data[className] = data[className].filter(item => item.unit !== unitName);
    // Re-index
    data[className].forEach((item, i) => item.index = i);
    saveClassUnits(data);
    renderLessonsDrawer(className);
    renderClassGrid();
  }
}

function cycleSyllabusLessonStatus(className, index) {
  const data = loadClassUnits();
  if (data[className] && data[className][index]) {
    const currentStatus = data[className][index].status || (data[className][index].is_completed ? 'completed' : 'not_ready');
    const statuses = ['not_ready', 'ready', 'completed'];
    const nextStatus = statuses[(statuses.indexOf(currentStatus) + 1) % statuses.length];
    data[className][index].status = nextStatus;
    data[className][index].is_completed = (nextStatus === 'completed');
    saveClassUnits(data);
    renderLessonsDrawer(className);
    renderClassGrid();
  }
}

function updateSyllabusLesson(className, index, field, value) {
  const data = loadClassUnits();
  if (data[className] && data[className][index]) {
    data[className][index][field] = value;
    saveClassUnits(data);
    renderLessonsDrawer(className);
    renderClassGrid();
  }
}
async function deleteSyllabusLesson(className, index) {
  const data = loadClassUnits();
  if (data[className] && data[className][index]) {
    const lessonName = data[className][index].lesson || 'this lesson';
    if (!(await window.showConfirm(`Are you sure you want to delete "${lessonName}"?`))) return;
    const deletedLesson = data[className][index];
    const unitOfDeleted = deletedLesson?.unit;
    const oldUnitStart = deletedLesson?.unitStartIndex;

    data[className].splice(index, 1);

    // If we deleted the lesson that held the unitStartIndex, move it to the new first lesson of that unit
    if (oldUnitStart !== undefined) {
      const nextFirst = data[className].find(item => item.unit === unitOfDeleted);
      if (nextFirst) nextFirst.unitStartIndex = oldUnitStart;
    }

    // Re-index
    data[className].forEach((item, i) => item.index = i);
    saveClassUnits(data);
    renderLessonsDrawer(className);
    renderClassGrid();
  }
}

function toggleTheme() {
  const isDark = document.documentElement.classList.toggle('dark');
  localStorage.setItem('theme_admin-tracker', isDark ? 'dark' : 'light');
}