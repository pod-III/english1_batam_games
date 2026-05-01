/* ============================================
   ADMIN TRACKER LOGIC
   ============================================ */

/* ============================================
   LESSON_STATUSES — Mirrors schedule/templates.js
   ============================================ */
const LESSON_STATUSES = [
  { id: 'draft',    label: 'Draft',     icon: 'edit-3',       color: '#94a3b8' },
  { id: 'ready',    label: 'Ready',     icon: 'check-circle', color: '#2979FF' },
  { id: 'taught',   label: 'Taught',    icon: 'users',        color: '#00E676' },
  { id: 'reviewed', label: 'Reflected', icon: 'star',         color: '#FF8C42' }
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
  return evt.lessonPlan?.status || 'draft';
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
  const upcoming = instances.filter(e => isUpcoming(e.date) && !isPlanned(e)).length;
  return { total, planned, skipped, upcoming, instances };
}

/* ============================================
   RENDERING
   ============================================ */

function renderClassGrid() {
  const grid = document.getElementById('class-grid');
  const emptyState = document.getElementById('empty-state');
  if (!grid) return;
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

  let gPlanned = 0, gSkipped = 0, gUpcoming = 0;

  filteredClasses.forEach(cls => {
    const stats = getClassStats(cls.name);
    const adminData = loadClassAdmin()[cls.name] || { tasks: [] };
    const adminPlanned = adminData.tasks.filter(t => t.done).length;
    const adminTotal = adminData.tasks.length;
    const adminPercent = adminTotal > 0 ? Math.round((adminPlanned / adminTotal) * 100) : 0;

    gPlanned += stats.planned;
    gSkipped += stats.skipped;
    gUpcoming += stats.upcoming;

    // Lesson Progress (Segmented Bar)
    const unitMap = {};
    stats.instances.forEach(e => {
      const unitKey = e.lessonPlan?.unit || 'Unassigned';
      if (!unitMap[unitKey]) unitMap[unitKey] = [];
      unitMap[unitKey].push(e);
    });
    const unitNames = Object.keys(unitMap);
    const segHtml = unitNames.length > 0 ? unitNames.map(uName => {
      const unitLessons = unitMap[uName];
      const allPlanned = unitLessons.every(l => isPlanned(l));
      const hasMissing = unitLessons.some(l => isSkipped(l));
      return `<div class="seg ${allPlanned ? 'done' : (hasMissing ? 'missing' : '')}" title="${uName}"></div>`;
    }).join('') : '<div class="seg" title="No units"></div>';

    // Next 3 upcoming
    const next3 = stats.instances.filter(e => isUpcoming(e.date)).slice(0, 3);
    const quickHtml = next3.length > 0 ? next3.map(l => `
      <div class="flex items-center justify-between text-xs py-1">
        <div class="flex items-center gap-2 min-w-0">
          <span class="w-1 h-1 rounded-full flex-shrink-0" style="background:${cls.color}"></span>
          <span class="font-bold truncate text-[11px]">${l.lessonPlan?.lesson || l.name}</span>
        </div>
        <span class="text-slate-400 font-bold flex-shrink-0 ml-2 text-[9px] uppercase tracking-tighter">${formatDate(l.date)}</span>
      </div>
    `).join('') : '<p class="text-[10px] text-slate-400 font-semibold py-1 italic">No upcoming lessons</p>';

    const card = document.createElement('div');
    card.className = 'tracker-card p-5';
    card.onclick = () => openDrawer(cls.name);

    card.innerHTML = `
      <div class="flex items-start justify-between mb-4">
        <div class="flex items-center gap-2.5">
          <div class="w-2.5 h-10 rounded-full" style="background:${cls.color}"></div>
          <div>
            <h3 class="font-heading text-base font-bold leading-none mb-1">${cls.name}</h3>
            <div class="flex items-center gap-2">
              <span class="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest">${stats.total} Lessons</span>
              ${stats.skipped > 0 ? `<span class="badge-status badge-skipped py-0 px-1 text-[8px] font-black">${stats.skipped} Missing</span>` : ''}
            </div>
          </div>
        </div>
      </div>

      <div class="space-y-4 mb-4">
        <!-- Lessons Section -->
        <div>
          <div class="flex items-center justify-between mb-1.5">
            <div class="flex items-center gap-1.5">
              <i data-lucide="book-open" class="w-3 h-3 text-slate-400"></i>
              <span class="text-[9px] font-extrabold uppercase tracking-widest text-slate-500">Lesson Planning</span>
            </div>
            <span class="text-[10px] font-bold text-slate-600">${stats.planned}/${stats.total}</span>
          </div>
          <div class="seg-bar">${segHtml}</div>
        </div>

        <!-- Class Admin Section -->
        <div>
          <div class="flex items-center justify-between mb-1.5">
            <div class="flex items-center gap-1.5">
              <i data-lucide="layout-dashboard" class="w-3 h-3 text-blue"></i>
              <span class="text-[9px] font-extrabold uppercase tracking-widest text-slate-500">Class Admin</span>
            </div>
            <span class="text-[10px] font-bold text-blue">${adminPlanned}/${adminTotal}</span>
          </div>
          <div class="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden border border-[var(--border-primary)]">
            <div class="h-full bg-blue transition-all duration-500" style="width: ${adminPercent}%"></div>
          </div>
        </div>
      </div>

      <div class="border-t border-[var(--bg-tertiary)] pt-3">
        <span class="text-[9px] font-extrabold uppercase tracking-widest text-slate-400 mb-2 block">Next Schedule</span>
        <div class="space-y-0.5">
          ${quickHtml}
        </div>
      </div>
    `;
    grid.appendChild(card);
  });

  updateGlobalStats(filteredClasses.length, gPlanned, gSkipped, gUpcoming);
  if (window.lucide) lucide.createIcons();
}

function updateGlobalStats(classes, planned, skipped, upcoming) {
  const statClasses = document.getElementById('stat-classes');
  const statPlanned = document.getElementById('stat-planned');
  const statSkipped = document.getElementById('stat-skipped');
  const statUpcoming = document.getElementById('stat-upcoming');

  if (statClasses) statClasses.textContent = classes;
  if (statPlanned) statPlanned.textContent = planned;
  if (statSkipped) statSkipped.textContent = skipped;
  if (statUpcoming) statUpcoming.textContent = upcoming;

  const alertEl = document.getElementById('global-alert');
  const textEl = document.getElementById('alert-text');
  if (alertEl && textEl) {
    if (skipped > 0) {
      textEl.textContent = `You have ${skipped} lesson${skipped > 1 ? 's' : ''} that passed without a plan being set.`;
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
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById(`filter-${mode}`);
  if (btn) btn.classList.add('active');
  renderClassGrid();
  if (currentDrawerClass) openDrawer(currentDrawerClass);
}

function setMode(mode) {
  currentMode = mode;
  document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById(`mode-${mode}`);
  if (btn) btn.classList.add('active');
  renderClassGrid();
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

  if (drawerTitle) drawerTitle.textContent = className;
  if (drawerSubtitle) drawerSubtitle.textContent = `${instances.length} lessons • ${instances.filter(e => isPlanned(e)).length} planned`;

  // Group by unit
  const unitMap = {};
  instances.forEach(e => {
    const unitKey = e.lessonPlan?.unit || 'Unassigned';
    if (!unitMap[unitKey]) unitMap[unitKey] = [];
    unitMap[unitKey].push(e);
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
      <div class="flex items-center justify-between mb-3">
        <h4 class="font-heading text-sm font-bold text-blue">Class Admin Tracker</h4>
      </div>
      <div class="mb-3">
        <input type="text" class="edit-input" placeholder="+ Add class task (e.g. Unit 1 Planning)" onkeydown="if(event.key==='Enter') addClassAdminTask('${className}', this.value)">
      </div>
      <div class="space-y-1">
        ${adminHtml || '<p class="text-[10px] text-slate-400 italic">No class-wide tasks yet.</p>'}
      </div>
    </div>
  `;
  Object.entries(unitMap).forEach(([unitName, lessons]) => {
    const allPlanned = lessons.every(l => isPlanned(l));

    html += `
      <div class="mb-6">
        <div class="flex items-center gap-2 mb-3 pb-2 border-b-[3px] border-[var(--border-primary)]">
          <i data-lucide="book-open" class="w-4 h-4 text-blue"></i>
          <span class="font-heading font-bold text-sm">${unitName}</span>
          ${allPlanned ? '<span class="badge-status badge-planned ml-auto">Complete</span>' : ''}
        </div>
        <div class="flex flex-col">
    `;

    lessons.forEach(lesson => {
      const skipped = isSkipped(lesson);
      const upcoming = isUpcoming(lesson.date) && !isPlanned(lesson);
      const status = getLessonStatus(lesson);
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
        <div class="${rowClass}" onclick="toggleEdit('${lesson.id}')">
          <div class="flex items-center justify-between gap-3">
            <div class="flex flex-col min-w-0 flex-1">
              <span class="font-bold text-sm truncate">${lesson.lessonPlan?.lesson || lesson.name}</span>
              <span class="text-[10px] text-slate-400 font-semibold">
                ${formatDate(lesson.date)} • ${formatTime(lesson.startTime)} • ${lesson.room || 'No Room'}
              </span>
            </div>
            <div class="flex items-center gap-2 flex-shrink-0">
              ${skipped ? '<span class="badge-status badge-skipped">Skipped</span>' : ''}
              ${upcoming ? '<span class="badge-status badge-upcoming">Upcoming</span>' : ''}
              ${!skipped && !upcoming && statusObj ? `<span class="badge-status badge-${status}">${statusObj.label}</span>` : ''}
              <i data-lucide="chevron-down" class="w-3.5 h-3.5 text-slate-400 edit-chevron-${lesson.id} transition-transform"></i>
            </div>
          </div>
          <!-- Edit Panel -->
          <div id="edit-${lesson.id}" class="hidden" onclick="event.stopPropagation()">
            <div class="edit-panel">
              <div class="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label class="block text-[9px] font-extrabold text-slate-400 uppercase tracking-widest mb-1">Unit / Module</label>
                  <input type="text" class="edit-input" value="${(lesson.lessonPlan?.unit || '').replace(/"/g, '&quot;')}" onchange="updateField('${lesson.id}', 'unit', this.value)" placeholder="e.g. Unit 1">
                </div>
                <div>
                  <label class="block text-[9px] font-extrabold text-slate-400 uppercase tracking-widest mb-1">Lesson Topic</label>
                  <input type="text" class="edit-input" value="${(lesson.lessonPlan?.lesson || '').replace(/"/g, '&quot;')}" onchange="updateField('${lesson.id}', 'lesson', this.value)" placeholder="e.g. Introduction">
                </div>
              </div>
              <div class="mb-3">
                <label class="block text-[9px] font-extrabold text-slate-400 uppercase tracking-widest mb-1">Status</label>
                <div class="flex gap-1.5 flex-wrap">
                  ${LESSON_STATUSES.map(s => `
                    <button onclick="updateField('${lesson.id}', 'status', '${s.id}')" class="status-btn ${status === s.id ? 'active' : ''}" style="background: ${status === s.id ? s.color : 'var(--surface-card)'}; color: ${status === s.id ? '#fff' : 'var(--text-secondary)'}">
                      ${s.label}
                    </button>
                  `).join('')}
                </div>
              </div>
              <div class="mb-3">
                <label class="block text-[9px] font-extrabold text-slate-400 uppercase tracking-widest mb-1">Notes</label>
                <textarea class="edit-input edit-textarea" onchange="updateNotes('${lesson.id}', this.value)" placeholder="Add notes...">${lesson.notes || ''}</textarea>
              </div>
              <div>
                <div class="flex items-center justify-between mb-1">
                  <label class="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest">Admin Checklist</label>
                </div>
                <div class="mb-2">
                  <input type="text" class="edit-input" placeholder="+ Add a new task..." onkeydown="if(event.key==='Enter') addTask('${lesson.id}', this.value)">
                </div>
                ${checklistHtml || '<p class="text-[10px] text-slate-400">No checklist items</p>'}
              </div>
            </div>
          </div>
        </div>
      `;
    });

    html += '</div></div>';
  });

  if (drawerBody) drawerBody.innerHTML = html;
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
   WRITE BACK TO SCHEDULE DATA
   ============================================ */

function updateField(eventId, field, value) {
  const allEvents = loadScheduleEvents();
  const evt = allEvents.find(e => e.id === eventId);
  if (!evt) return;
  if (!evt.lessonPlan) evt.lessonPlan = { unit: '', lesson: '', status: 'draft' };
  evt.lessonPlan[field] = value;
  evt.updatedAt = new Date().toISOString();
  saveScheduleEvents(allEvents);
  renderClassGrid();
  if (currentDrawerClass) openDrawer(currentDrawerClass);
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
  renderClassGrid();
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
  renderClassGrid();
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
  renderClassGrid();
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
  renderClassGrid();
  openDrawer(className);
}

function deleteClassAdminTask(className, index) {
  const data = loadClassAdmin();
  if (!data[className] || !data[className].tasks[index]) return;
  data[className].tasks.splice(index, 1);
  saveClassAdmin(data);
  renderClassGrid();
  openDrawer(className);
}

function toggleClassAdminTask(className, index, checked) {
  const data = loadClassAdmin();
  if (!data[className] || !data[className].tasks[index]) return;
  data[className].tasks[index].done = checked;
  saveClassAdmin(data);
  renderClassGrid();
  openDrawer(className);
}
