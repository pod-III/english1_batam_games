/* ============================================
   SCRIPT.JS - Main Logic for Schedule Tool
   ============================================ */

// State
let events = [];
let currentWeekStart = getMonday(new Date());
let selectedEventId = null;
let weekDayCount = 5; // 5, 6, or 7
let viewMode = 'week'; // 'week', '3-day', 'day'
let currentDayOffset = 0; // for day/3-day view modes
let redDays = []; // Dates marked as holidays (YYYY-MM-DD)
let tempRedDays = []; // Draft holidays
let isHolidayModalDirty = false; // Track if holiday modal has unsaved changes
let isDetailPanelDirty = false; // Track if current event detail has unsaved changes

// Initialize Lucide Icons
lucide.createIcons();

// Elements
const calendarWrapper = document.getElementById('calendar-wrapper');
const dayHeadersRow = document.getElementById('day-headers-row');
const timeGutter = document.getElementById('time-gutter');
const dayColumns = document.getElementById('day-columns');
const detailPanel = document.getElementById('detail-panel');
const templateList = document.getElementById('template-list');

/* ============================================
   1. Initialization & State Management
   ============================================ */

function init() {
  loadData();
  
  // Update offset based on viewMode after loadData
  if (viewMode === 'day' || viewMode === '3-day') {
    const now = new Date();
    currentDayOffset = (now.getDay() + 6) % 7;
  }

  renderSidebar();
  renderCalendar();
  setupEventListeners();
  updateTimeIndicator();
  setupTouchSupport();
  updateViewModeUI();
  setInterval(updateTimeIndicator, 60000); // Update every minute
  
  // Wait a bit for layout to settle before scrolling
  setTimeout(scrollToCurrentTime, 300);
}

let touchGhost = null;
let lastDropTarget = null;
let touchStartX = 0;
let touchStartY = 0;
let pendingDragTarget = null;
let isTouchDragging = false;

function setupTouchSupport() {
  document.addEventListener('touchstart', handleTouchStart, { passive: false });
  document.addEventListener('touchmove', handleTouchMove, { passive: false });
  document.addEventListener('touchend', handleTouchEnd);
}

function handleTouchStart(e) {
  if (e.target.closest('.resize-handle')) return;
  const target = e.target.closest('.template-chip, .event-block');
  if (!target) return;

  const touch = e.touches[0];
  touchStartX = touch.clientX;
  touchStartY = touch.clientY;
  pendingDragTarget = target;
  isTouchDragging = false;
}

function handleTouchMove(e) {
  if (!pendingDragTarget) return;
  
  const touch = e.touches[0];
  
  if (!isTouchDragging) {
    const dist = Math.hypot(touch.clientX - touchStartX, touch.clientY - touchStartY);
    if (dist > 10) {
      startTouchDrag(touch);
    }
  }
  
  if (isTouchDragging && touchGhost) {
    e.preventDefault();
    updateGhostPosition(touch);
    
    // Highlight target
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    const dropTarget = el ? el.closest('.grid-cell') : null;
    
    if (dropTarget !== lastDropTarget) {
      if (lastDropTarget) lastDropTarget.classList.remove('drop-target');
      if (dropTarget) dropTarget.classList.add('drop-target');
      lastDropTarget = dropTarget;
    }
  }
}

function startTouchDrag(touch) {
  isTouchDragging = true;
  const target = pendingDragTarget;
  draggedType = target.dataset.type || null;
  draggedEventId = target.dataset.id || null;

  // Create ghost
  touchGhost = target.cloneNode(true);
  touchGhost.classList.add('drag-ghost');
  
  const rect = target.getBoundingClientRect();
  touchGhost.style.width = `${Math.min(rect.width, 160)}px`; 
  
  document.body.appendChild(touchGhost);
  updateGhostPosition(touch);
  
  // Prevent scrolling while dragging and disable interaction with existing events
  document.body.style.overflow = 'hidden';
  document.body.classList.add('dragging-active');
}

function handleTouchEnd(e) {
  if (isTouchDragging && touchGhost) {
    if (lastDropTarget) {
      const dateStr = lastDropTarget.dataset.date;
      const timeStr = lastDropTarget.dataset.time;
      processDropAction(dateStr, timeStr, draggedType, draggedEventId);
      lastDropTarget.classList.remove('drop-target');
    }
    
    touchGhost.remove();
    document.body.style.overflow = '';
    document.body.classList.remove('dragging-active');
  }
  
  // Cleanup
  touchGhost = null;
  lastDropTarget = null;
  draggedType = null;
  draggedEventId = null;
  pendingDragTarget = null;
  isTouchDragging = false;
}

function updateGhostPosition(touch) {
  if (!touchGhost) return;
  touchGhost.style.left = `${touch.clientX - touchGhost.offsetWidth / 2}px`;
  touchGhost.style.top = `${touch.clientY - touchGhost.offsetHeight / 2}px`;
}

function scrollToCurrentTime() {
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes();
  
  // Only scroll if within schedule hours
  if (h < SCHEDULE_START_HOUR || h >= SCHEDULE_END_HOUR) return;
  
  const totalMinutes = (h * 60 + m) - (SCHEDULE_START_HOUR * 60);
  const topPx = (totalMinutes / 15) * 20; // 20px per 15 min slot
  
  // Center it slightly (1/3 from top)
  const wrapperHeight = calendarWrapper.clientHeight;
  const targetScroll = Math.max(0, topPx - (wrapperHeight / 3));
  
  calendarWrapper.scrollTo({
    top: targetScroll,
    behavior: 'smooth'
  });
}

function loadData() {
  const saved = localStorage.getItem('schedule_events');
  let masters = [];
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) masters = parsed;
    } catch(e) {}
  }
  
  // Start with masters
  events = [...masters];
  
  // Generate clones for each master
  masters.forEach(m => {
    if (m.recurrence && m.recurrence !== 'none') {
      const rangeStart = new Date(m.date);
      const rangeEnd = new Date(rangeStart);
      rangeEnd.setMonth(rangeEnd.getMonth() + 6);
      const clones = generateRecurrences(m, rangeStart, rangeEnd);
      events = [...events, ...clones];
    }
  });
  
  const savedWeekDayCount = localStorage.getItem('schedule_week_day_count');
  if (savedWeekDayCount) {
    weekDayCount = parseInt(savedWeekDayCount);
  }
  
  const savedViewMode = localStorage.getItem('schedule_view_mode');
  if (savedViewMode) {
    viewMode = savedViewMode;
  }
  
  const savedStart = localStorage.getItem('schedule_start_hour');
  const savedEnd = localStorage.getItem('schedule_end_hour');
  if (savedStart && savedEnd) {
    updateScheduleRange(savedStart, savedEnd);
  }

  const savedRedDays = localStorage.getItem('schedule_red_days');
  if (savedRedDays) {
    redDays = JSON.parse(savedRedDays);
  }
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

function toggleClassAdminTask(className, index, done) {
  const adminData = loadClassAdmin();
  if (adminData[className] && adminData[className].tasks[index]) {
    adminData[className].tasks[index].done = done;
    saveClassAdmin(adminData);
    // Refresh the panel
    if (selectedEventId) {
      const evt = events.find(e => e.id === selectedEventId);
      if (evt && evt.name === className) {
        // Re-open current panel to refresh
        openDetailPanel(selectedEventId);
      }
    }
  }
}

function saveData() {
  const masters = events.filter(e => !e.isRecurrence);
  const promoted = events.filter(e => e.isRecurrence && (window.Sync ? Sync.isPromoted(e) : false));

  localStorage.setItem('schedule_events', JSON.stringify(masters));
  localStorage.setItem('schedule_promoted_instances', JSON.stringify(promoted));
  localStorage.setItem('schedule_week_day_count', weekDayCount);
  localStorage.setItem('schedule_view_mode', viewMode);
  localStorage.setItem('schedule_red_days', JSON.stringify(redDays));
  updateStats();
  updateTodayList();
  
  // Non-blocking cloud save
  if (window.Sync) {
    const rdsCopy = [...redDays];
    Sync.fireCloudSave(async userId => {
      await Promise.all([
        Sync.cloudReplaceAllScheduleEvents(userId, [...masters, ...promoted]),
        Sync.cloudSaveRedDays(userId, rdsCopy),
      ]);
    });
  }
}

function toggleRedDay(dateStr) {
  const index = redDays.indexOf(dateStr);
  if (index === -1) {
    redDays.push(dateStr);
  } else {
    redDays.splice(index, 1);
  }
  saveData();
  renderCalendar();
}

function refreshRecurrences(masterId) {
  if (!masterId) return;
  
  // 1. Remove all existing clones of this master
  events = events.filter(e => e.originalEventId !== masterId);
  
  const master = events.find(e => e.id === masterId);
  if (!master || master.recurrence === 'none') return;
  
  // 2. Generate new clones for the next 6 months
  const rangeStart = new Date(master.date);
  const rangeEnd = new Date(rangeStart);
  rangeEnd.setMonth(rangeEnd.getMonth() + 6); // Safety limit
  
  const newOccurrences = generateRecurrences(master, rangeStart, rangeEnd);
  events = [...events, ...newOccurrences];
}

/* ============================================
   2. Date Helpers
   ============================================ */

function getMonday(d) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function getDayString(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getTodayStr() {
  return getDayString(new Date());
}

function getDisplayWeekRange() {
  if (viewMode === 'day') {
    const d = new Date(currentWeekStart);
    d.setDate(d.getDate() + currentDayOffset);
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  }
  if (viewMode === '3-day') {
    const start = new Date(currentWeekStart);
    start.setDate(start.getDate() + currentDayOffset);
    const end = new Date(start);
    end.setDate(end.getDate() + 2);
    
    const startStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const endStr = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `${startStr} – ${endStr}`;
  }
  const end = new Date(currentWeekStart);
  end.setDate(end.getDate() + (weekDayCount - 1));
  
  const startStr = currentWeekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const endStr = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${startStr} – ${endStr}`;
}

/* ============================================
   3. Sidebar Rendering
   ============================================ */

function renderSidebar() {
  templateList.innerHTML = '';
  EVENT_TYPES.forEach(type => {
    const chip = document.createElement('div');
    chip.className = 'template-chip';
    chip.draggable = true;
    chip.dataset.type = type.id;
    chip.innerHTML = `
      <div class="chip-dot" style="background-color: ${type.defaultColor}"></div>
      <i data-lucide="${type.icon}" class="w-4 h-4"></i>
      <span>${type.label}</span>
    `;
    
    chip.addEventListener('dragstart', handleDragStartTemplate);
    chip.addEventListener('dragend', () => chip.classList.remove('dragging'));
    
    templateList.appendChild(chip);
  });
  lucide.createIcons({ root: templateList });
  updateStats();
  updateTodayList();
}

function updateStats() {
  const start = new Date(currentWeekStart);
  start.setHours(0, 0, 0, 0);
  const end = new Date(currentWeekStart);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  let weekEvents = 0;
  let totalTasks = 0;
  let doneTasks = 0;
  
  let countTaught = 0;
  let countReady = 0;
  let countDraft = 0;
  
  const uniqueClasses = new Set();
  const classAdminData = loadClassAdmin();

  events.forEach(evt => {
    const evtDate = new Date(evt.date + 'T00:00:00');
    if (evtDate >= start && evtDate <= end) {
      if (evt.isRecurrence && redDays.includes(evt.date)) return;
      
      weekEvents++;
      
      // Lesson statuses
      const status = evt.lessonPlan?.status || 'draft';
      if (status === 'taught' || status === 'reviewed') countTaught++;
      else if (status === 'ready') countReady++;
      else countDraft++;

      // Admin tasks (local checklist)
      if (evt.checklist) {
        totalTasks += evt.checklist.length;
        doneTasks += evt.checklist.filter(i => i.done).length;
      }
      
      if (evt.typeId === 'class') {
        uniqueClasses.add(evt.name);
      }
    }
  });

  // Global Admin Progress
  let globalAdminTotal = 0;
  let globalAdminDone = 0;
  uniqueClasses.forEach(className => {
    const tasks = classAdminData[className]?.tasks || [];
    globalAdminTotal += tasks.length;
    globalAdminDone += tasks.filter(t => t.done).length;
  });

  const elEvents = document.getElementById('stat-events');
  const elTasks = document.getElementById('stat-tasks');
  
  if (elEvents) elEvents.textContent = weekEvents;
  if (elTasks) elTasks.textContent = totalTasks;

  // Update Lesson Bar
  const totalLessons = countTaught + countReady + countDraft;
  const pctTaught = totalLessons > 0 ? (countTaught / totalLessons) * 100 : 0;
  const pctReady = totalLessons > 0 ? (countReady / totalLessons) * 100 : 0;
  const pctDraft = totalLessons > 0 ? (countDraft / totalLessons) * 100 : 0;
  
  const elLessonCount = document.getElementById('lesson-stats-count');
  if (elLessonCount) elLessonCount.textContent = `${countTaught + countReady}/${totalLessons}`;
  
  const bTaught = document.getElementById('bar-taught');
  const bReady = document.getElementById('bar-ready');
  const bDraft = document.getElementById('bar-draft');
  
  if (bTaught) bTaught.style.width = `${pctTaught}%`;
  if (bReady) bReady.style.width = `${pctReady}%`;
  if (bDraft) bDraft.style.width = `${pctDraft}%`;

  // Update Admin Bar
  const adminPct = globalAdminTotal > 0 ? (globalAdminDone / globalAdminTotal) * 100 : 0;
  const elAdminPct = document.getElementById('admin-stats-pct');
  const elAdminCount = document.getElementById('admin-stats-count');
  const bAdmin = document.getElementById('bar-admin');
  
  if (elAdminPct) elAdminPct.textContent = `${Math.round(adminPct)}%`;
  if (elAdminCount) elAdminCount.textContent = `${globalAdminDone}/${globalAdminTotal} tasks`;
  if (bAdmin) bAdmin.style.width = `${adminPct}%`;
}

function updateTodayList() {
  const container = document.getElementById('today-events-list');
  if (!container) return;
  container.innerHTML = '';
  
  const todayStr = getDayString(new Date());
  const isTodayRed = redDays.includes(todayStr);
  const todayEvents = events
    .filter(e => e.date === todayStr)
    .filter(e => !(isTodayRed && e.isRecurrence))
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
  
  if (todayEvents.length === 0) {
    container.innerHTML = '<p class="text-slate-400 text-xs font-semibold px-1">No events today</p>';
    return;
  }
  
  todayEvents.forEach(evt => {
    const div = document.createElement('div');
    div.className = 'p-2 rounded-lg bg-white dark:bg-slate-800 border-l-4 shadow-sm flex flex-col gap-0.5 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors mb-1.5';
    div.style.borderColor = evt.color;
    div.onclick = () => {
      // If event is on another week (shouldn't happen for today list but good for safety)
      const evtDate = new Date(evt.date);
      const weekStart = getMonday(evtDate);
      if (currentWeekStart.getTime() !== weekStart.getTime()) {
        currentWeekStart = weekStart;
        renderCalendar();
      }
      openDetailPanel(evt.id);
    };
    
    div.innerHTML = `
      <div class="font-bold text-dark dark:text-white truncate text-[11px]">${evt.name}</div>
      <div class="text-[9px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-tight">
        ${formatTimeDisplay(evt.startTime)} • ${evt.room || 'No Room'}
      </div>
    `;
    container.appendChild(div);
  });
}

/* ============================================
   4. Calendar Rendering
   ============================================ */

function renderCalendar() {
  document.getElementById('week-label').textContent = getDisplayWeekRange();
  const isDayMode = viewMode === 'day';
  const is3DayMode = viewMode === '3-day';
  const numDays = isDayMode ? 1 : (is3DayMode ? 3 : weekDayCount);
  
  // Render Day Headers
  dayHeadersRow.innerHTML = '<div class="time-gutter flex-none"></div>';
  dayHeadersRow.style.display = 'grid';
  dayHeadersRow.style.gridTemplateColumns = `56px repeat(${numDays}, 1fr)`; 
  const todayStr = getDayString(new Date());
  
  for (let i = 0; i < numDays; i++) {
    const dayDate = new Date(currentWeekStart);
    if (isDayMode || is3DayMode) {
      dayDate.setDate(dayDate.getDate() + currentDayOffset + i);
    } else {
      dayDate.setDate(dayDate.getDate() + i);
    }
    const isToday = getDayString(dayDate) === todayStr;
    const dateStr = getDayString(dayDate);
    const isRedDay = redDays.includes(dateStr);
    
    const header = document.createElement('div');
    header.className = `day-header flex flex-col items-center justify-center py-2 border-l border-slate-200 dark:border-slate-700 ${isToday ? 'today' : ''} ${isRedDay ? 'red-day' : ''}`;
    header.style.cursor = 'pointer';
    header.onclick = () => toggleRedDay(dateStr);
    
    header.innerHTML = `
      <span class="text-[10px] font-bold opacity-60 uppercase">${dayDate.toLocaleDateString('en-US', { weekday: 'short' })}</span>
      <span class="day-number">${dayDate.getDate()}</span>
      ${isRedDay ? '<span class="text-[8px] font-bold text-red-500 uppercase mt-0.5">Off</span>' : ''}
    `;
    dayHeadersRow.appendChild(header);
  }
  
  // Render Time Gutter
  timeGutter.innerHTML = '';
  for (let i = 0; i <= TOTAL_SLOTS; i++) {
    const time = slotIndexToTime(i);
    const isHour = time.endsWith(':00');
    if (isHour) {
      const div = document.createElement('div');
      div.className = 'time-label';
      div.style.height = i === TOTAL_SLOTS ? '0' : '80px'; 
      div.innerHTML = `<span>${formatTimeDisplay(time).replace(' AM', '').replace(' PM', '')}</span>`;
      timeGutter.appendChild(div);
    }
  }
  // Setup grid CSS variables
  calendarWrapper.style.setProperty('--slot-height', '20px'); 
  
  // Render Day Columns and Grid Slots
  dayColumns.innerHTML = '';
  dayColumns.style.display = 'grid';
  dayColumns.style.gridTemplateColumns = `repeat(${numDays}, 1fr)`;
  
  for (let d = 0; d < numDays; d++) {
    const dayDate = new Date(currentWeekStart);
    if (isDayMode || is3DayMode) {
      dayDate.setDate(dayDate.getDate() + currentDayOffset + d);
    } else {
      dayDate.setDate(dayDate.getDate() + d);
    }
    const dayStr = getDayString(dayDate);
    const isDayRed = redDays.includes(dayStr);
    
    const col = document.createElement('div');
    col.className = `day-column relative ${isDayRed ? 'red-day-bg' : ''}`;
    col.dataset.date = dayStr;
    
    // Draw background grid lines for this column
    for (let i = 0; i < TOTAL_SLOTS; i++) {
      const line = document.createElement('div');
      line.className = `slot-line ${i % 4 === 0 ? 'hour-start' : ''}`;
      line.style.top = `${i * 20}px`; 
      col.appendChild(line);
      
      // Drop target logic
      const dropZone = document.createElement('div');
      dropZone.className = 'grid-cell absolute w-full';
      dropZone.style.top = `${i * 20}px`;
      dropZone.style.height = `20px`;
      dropZone.dataset.time = slotIndexToTime(i);
      dropZone.dataset.date = dayStr;
      
      dropZone.addEventListener('dragover', handleDragOver);
      dropZone.addEventListener('dragleave', handleDragLeave);
      dropZone.addEventListener('drop', handleDrop);
      dropZone.addEventListener('dblclick', () => openEventModal(null, dayStr, slotIndexToTime(i)));
      
      col.appendChild(dropZone);
    }
    
    // Draw Events for this day
    const dayEvents = events.filter(e => e.date === dayStr);
    dayEvents.forEach(evt => {
      // Skip recurrences on red days (holidays/leaves)
      if (isDayRed && evt.isRecurrence) return;
      col.appendChild(createEventBlock(evt));
    });
    
    dayColumns.appendChild(col);
  }
  
  updateStats();
  updateTodayList();
  updateTimeIndicator();
}

/* ============================================
   5. Partial UI Updates (Performance)
   ============================================ */

function createEventBlock(evt) {
  const startIndex = timeToSlotIndex(evt.startTime);
  const endIndex = timeToSlotIndex(evt.endTime);
  const height = (endIndex - startIndex) * 20;

  const evtBlock = document.createElement('div');
  evtBlock.className = 'event-block shadow-sm';
  evtBlock.style.top = `${startIndex * 20}px`;
  evtBlock.style.height = `${height}px`;
  evtBlock.style.backgroundColor = getRgba(evt.color, 0.15);
  evtBlock.style.color = evt.color;
  evtBlock.style.borderColor = evt.color;
  evtBlock.dataset.id = evt.id;

  evtBlock.draggable = true;
  evtBlock.addEventListener('dragstart', handleDragStartEvent);
  evtBlock.addEventListener('dragend', (e) => e.currentTarget.classList.remove('opacity-50'));
  evtBlock.addEventListener('click', (e) => {
    e.stopPropagation();
    if (isDetailPanelDirty && selectedEventId !== evt.id) {
       buzzSaveButton();
       return;
    }
    openDetailPanel(evt.id);
  });

  let progressHtml = '';
  if (evt.checklist && evt.checklist.length > 0) {
    const done = evt.checklist.filter(i => i.done).length;
    const total = evt.checklist.length;
    const pct = (done / total) * 100;
    progressHtml = `
      <div class="event-progress w-full">
        <div class="event-progress-fill" style="width: ${pct}%; background-color: currentColor;"></div>
      </div>
    `;
  }

  let lessonStatusHtml = '';
  if (evt.lessonPlan && evt.lessonPlan.status && evt.lessonPlan.status !== 'draft') {
    const status = LESSON_STATUSES.find(s => s.id === evt.lessonPlan.status);
    if (status) {
      lessonStatusHtml = `
        <div class="absolute top-1.5 right-7 opacity-80" title="Lesson: ${status.label}">
          <i data-lucide="${status.icon}" class="w-2.5 h-2.5" style="color: ${status.color}"></i>
        </div>
      `;
    }
  }

  let notesHtml = '';
  if (evt.notes && evt.notes.trim() && height >= 40) {
    notesHtml = `<div class="event-notes text-[9px] opacity-80 italic leading-tight pointer-events-none text-dark dark:text-white whitespace-pre-wrap mt-1">${evt.notes.trim().replace(/"/g, '&quot;')}</div>`;
  }

  evtBlock.innerHTML = `
    <div class="event-title text-dark dark:text-white">${evt.name}</div>
    <div class="event-time text-dark dark:text-white opacity-70">${formatTimeDisplay(evt.startTime)} - ${formatTimeDisplay(evt.endTime)}</div>${progressHtml}${notesHtml}${lessonStatusHtml}
    ${evt.recurrence !== 'none' ? '<i data-lucide="repeat" class="event-recurrence-badge w-3 h-3"></i>' : ''}
    <div class="resize-handle" draggable="false" data-id="${evt.id}"></div>
  `;

  const handle = evtBlock.querySelector('.resize-handle');
  handle.addEventListener('mousedown', initResize);
  
  lucide.createIcons({ root: evtBlock });
  return evtBlock;
}

function updateEventUI(eventId) {
  if (!eventId) return;
  const evt = events.find(e => e.id === eventId);
  const oldBlock = document.querySelector(`.event-block[data-id="${eventId}"]`);
  
  if (!evt) {
    if (oldBlock) oldBlock.remove();
    updateStats();
    updateTodayList();
    return;
  }

  const newBlock = createEventBlock(evt);
  
  if (oldBlock) {
    // If date changed, move to correct column
    if (oldBlock.parentElement.dataset.date !== evt.date) {
      oldBlock.remove();
      const newCol = document.querySelector(`.day-column[data-date="${evt.date}"]`);
      if (newCol) newCol.appendChild(newBlock);
    } else {
      oldBlock.replaceWith(newBlock);
    }
  } else {
    // Brand new event
    const col = document.querySelector(`.day-column[data-date="${evt.date}"]`);
    if (col) col.appendChild(newBlock);
  }
  
  updateStats();
  updateTodayList();
}

function getRgba(hex, alpha) {
  let r = parseInt(hex.slice(1, 3), 16),
      g = parseInt(hex.slice(3, 5), 16),
      b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/* ============================================
   5. Current Time Indicator
   ============================================ */

function updateTimeIndicator() {
  // Remove existing
  const existing = document.querySelector('.current-time-line');
  if (existing) existing.remove();
  
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes();
  
  // If outside schedule hours, don't show
  if (h < SCHEDULE_START_HOUR || h >= SCHEDULE_END_HOUR) return;
  
  const todayStr = getDayString(now);
  const dayCol = document.querySelector(`.day-column[data-date="${todayStr}"]`);
  
  if (dayCol) {
    const totalMinutes = (h * 60 + m) - (SCHEDULE_START_HOUR * 60);
    const topPx = (totalMinutes / 15) * 20; // 20px per 15 min slot
    
    const line = document.createElement('div');
    line.className = 'current-time-line';
    line.style.top = `${topPx}px`;
    dayCol.appendChild(line);
  }
}

/* ============================================
   6. Drag & Drop Logic
   ============================================ */

let draggedType = null;
let draggedEventId = null;

function handleDragStartTemplate(e) {
  draggedType = e.target.dataset.type;
  draggedEventId = null;
  e.target.classList.add('dragging');
  // Required for Firefox
  e.dataTransfer.setData('text/plain', '');
}

function handleDragStartEvent(e) {
  draggedEventId = e.currentTarget.dataset.id;
  draggedType = null;
  // Delay adding class so the drag image looks right
  const el = e.currentTarget;
  setTimeout(() => el.classList.add('opacity-50'), 0);
  e.dataTransfer.setData('text/plain', '');
}

function handleDragOver(e) {
  e.preventDefault();
  e.target.classList.add('drop-target');
}

function handleDragLeave(e) {
  e.target.classList.remove('drop-target');
}

function handleDrop(e) {
  e.preventDefault();
  e.target.classList.remove('drop-target');
  
  const dateStr = e.target.dataset.date;
  const timeStr = e.target.dataset.time;
  
  processDropAction(dateStr, timeStr, draggedType, draggedEventId);
  
  draggedType = null;
  draggedEventId = null;
}

function processDropAction(dateStr, timeStr, typeId, eventId) {
  if (!dateStr || !timeStr) return;
  
  if (typeId) {
    // Dropped a template -> Open create modal
    openEventModal(null, dateStr, timeStr, typeId);
  } else if (eventId) {
    // Dropped an existing event -> Update time/date
    const event = events.find(ev => ev.id === eventId);
    if (event) {
      const startIndex = timeToSlotIndex(event.startTime);
      const endIndex = timeToSlotIndex(event.endTime);
      const durationSlots = endIndex - startIndex;
      
      event.date = dateStr;
      event.startTime = timeStr;
      
      // Calculate new end time based on duration
      let newEndIndex = timeToSlotIndex(timeStr) + durationSlots;
      if (newEndIndex > TOTAL_SLOTS) newEndIndex = TOTAL_SLOTS;
      event.endTime = slotIndexToTime(newEndIndex);
      
      if (!event.isRecurrence) {
        refreshRecurrences(eventId);
      } else {
        // Sync the newly moved promoted instance
        if (window.Sync) Sync.syncPromotedInstance(event);
      }
      saveData();
      renderCalendar();
      if (selectedEventId === event.id) openDetailPanel(event.id); // Refresh panel if open
    }
  }
}

/* ============================================
   7. Resizing Logic
   ============================================ */
let isResizing = false;
let resizeEventId = null;
let startY = 0;
let startHeight = 0;
let currentBlock = null;

function initResize(e) {
  e.stopPropagation();
  e.preventDefault();
  isResizing = true;
  resizeEventId = e.target.dataset.id;
  currentBlock = e.target.parentElement;
  startY = e.clientY;
  startHeight = parseInt(document.defaultView.getComputedStyle(currentBlock).height, 10);
  
  document.documentElement.addEventListener('mousemove', doResize);
  document.documentElement.addEventListener('mouseup', stopResize);
}

function doResize(e) {
  if (!isResizing) return;
  const dy = e.clientY - startY;
  let newHeight = startHeight + dy;
  
  // Snap to 20px grid (15 mins)
  newHeight = Math.max(20, Math.round(newHeight / 20) * 20);
  currentBlock.style.height = `${newHeight}px`;
}

function stopResize(e) {
  if (!isResizing) return;
  isResizing = false;
  document.documentElement.removeEventListener('mousemove', doResize);
  document.documentElement.removeEventListener('mouseup', stopResize);
  
  const event = events.find(ev => ev.id === resizeEventId);
  if (event) {
    const finalHeight = parseInt(currentBlock.style.height, 10);
    const slotsAdded = (finalHeight - startHeight) / 20;
    
    if (slotsAdded !== 0) {
      const currentEndIndex = timeToSlotIndex(event.endTime);
      let newEndIndex = currentEndIndex + slotsAdded;
      if (newEndIndex > TOTAL_SLOTS) newEndIndex = TOTAL_SLOTS;
      if (newEndIndex <= timeToSlotIndex(event.startTime)) newEndIndex = timeToSlotIndex(event.startTime) + 1;
      
      event.endTime = slotIndexToTime(newEndIndex);
      if (!event.isRecurrence) {
        refreshRecurrences(resizeEventId);
      } else {
        if (window.Sync) Sync.syncPromotedInstance(event);
      }
      saveData();
      updateEventUI(resizeEventId);
      if (selectedEventId === event.id) openDetailPanel(event.id);
    }
  }
  
  resizeEventId = null;
  currentBlock = null;
}

/* ============================================
   8. Detail Panel
   ============================================ */

function openDetailPanel(eventId, keepDirty = false) {
  if (!keepDirty) isDetailPanelDirty = false;
  selectedEventId = eventId;
  const event = events.find(e => e.id === eventId);
  if (!event) return;
  
  const detailPanel = document.getElementById('detail-panel');
  detailPanel.dataset.eventId = eventId;
  
  const body = document.getElementById('detail-body');
  const type = getEventType(event.typeId);
  
  // Build color options
  const colorOptions = COLOR_PALETTE.map(c => `
    <button class="color-swatch-compact ${c.hex === event.color ? 'active' : ''}" 
            style="background-color: ${c.hex}; color: ${c.hex}" 
            onclick="updateEventField('${eventId}', 'color', '${c.hex}'); renderDetailPanelOptions();" 
            title="${c.label}"></button>
  `).join('');
  
  // Build type options
  const typeOptions = EVENT_TYPES.map(t => `
    <option value="${t.id}" ${t.id === event.typeId ? 'selected' : ''}>${t.label}</option>
  `).join('');
  
  // Build Recurrence options
  const recurrenceOptionsHtml = RECURRENCE_OPTIONS.map(r => `
    <option value="${r.id}" ${r.id === event.recurrence ? 'selected' : ''}>${r.label}</option>
  `).join('');
  
  // Build Checklist
  const checklistHtml = event.checklist.map(item => `
    <div class="checklist-item ${item.done ? 'done' : ''}">
      <input type="checkbox" ${item.done ? 'checked' : ''} onchange="toggleChecklistItem('${eventId}', '${item.id}')">
      <input type="text" class="checklist-text" value="${item.text.replace(/"/g, '&quot;')}" onchange="updateChecklistText('${eventId}', '${item.id}', this.value)">
      <button class="checklist-delete" onclick="deleteChecklistItem('${eventId}', '${item.id}')"><i data-lucide="x" class="w-4 h-4"></i></button>
    </div>
  `).join('');
  
  const checklistProgress = event.checklist.length > 0 ? 
    (event.checklist.filter(i => i.done).length / event.checklist.length) * 100 : 0;
  
  body.innerHTML = `
    <!-- SECTION 1: EVENT SCHEDULE -->
    <div class="detail-section-title">
      <i data-lucide="calendar" class="w-3.5 h-3.5"></i>
      Event Schedule
    </div>

    <!-- Name -->
    <div class="mb-4">
      <input type="text" class="panel-input text-lg font-heading" value="${event.name.replace(/"/g, '&quot;')}" onchange="updateEventField('${eventId}', 'name', this.value)" placeholder="Event Name">
    </div>
    
    <!-- Type & Color -->
    <div class="flex items-start gap-4 mb-4">
      <div class="flex-1">
        <label class="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1 px-1">Type</label>
        <select class="panel-input" onchange="updateEventField('${eventId}', 'typeId', this.value)">
          ${typeOptions}
        </select>
      </div>
      <div class="flex-shrink-0">
        <label class="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1 px-1">Color</label>
        <div class="color-picker-compact" id="detail-color-picker">${colorOptions}</div>
      </div>
    </div>
    
    <!-- Date & Room -->
    <div class="grid grid-cols-2 gap-3 mb-3">
      <div>
        <label class="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1 px-1">Date</label>
        <input type="date" class="panel-input" value="${event.date}" onchange="updateEventField('${eventId}', 'date', this.value)">
      </div>
      <div>
        <label class="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1 px-1">Room/Loc</label>
        <input type="text" class="panel-input" value="${event.room.replace(/"/g, '&quot;')}" onchange="updateEventField('${eventId}', 'room', this.value)" placeholder="e.g. Room 204">
      </div>
    </div>

    <!-- Time & Repeat -->
    <div class="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700 mb-6">
      <div class="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label class="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1 px-1">Start</label>
          <input type="time" class="panel-input" value="${event.startTime}" onchange="updateEventField('${eventId}', 'startTime', this.value)" step="900">
        </div>
        <div>
          <label class="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1 px-1">End</label>
          <input type="time" class="panel-input" value="${event.endTime}" onchange="updateEventField('${eventId}', 'endTime', this.value)" step="900">
        </div>
      </div>
      <div>
         <label class="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1 px-1">Repeat</label>
         <select class="panel-input" onchange="updateEventField('${eventId}', 'recurrence', this.value); toggleModalDaySelector(this.value, 'detail-day-selector-container');">
            ${recurrenceOptionsHtml}
         </select>
         <div id="detail-day-selector-container" class="${event.recurrence === 'custom-days' ? '' : 'hidden'} mt-3">
           <label class="block text-[9px] font-bold text-slate-500 mb-1 px-1">Select Days</label>
           ${getDaySelectorHtml(event.recurrenceDays || [])}
         </div>
         ${event.isRecurrence ? `<p class="text-[10px] text-orange mt-2 font-bold"><i data-lucide="info" class="w-3 h-3 inline"></i> Recurring instance — changes apply to all.</p>` : ''}
         
         <!-- Graduation Toggle (Class Only) -->
         ${event.typeId === 'class' ? `
           <div class="mt-4 pt-3 border-t border-slate-200 dark:border-slate-700/50">
             <label class="flex items-center gap-2 cursor-pointer group/grad">
               <div class="chunky-check">
                 <input type="checkbox" ${event.graduationClass ? 'checked' : ''} 
                        onchange="updateEventField('${eventId}', 'graduationClass', this.checked); openDetailPanel('${eventId}', true);">
                 <div class="box"></div>
               </div>
               <span class="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest group-hover/grad:text-pink transition-colors">Graduation Class</span>
             </label>
             ${event.graduationClass ? `
               <div class="mt-2 pl-6 animate-pop-in">
                 <label class="block text-[8px] font-extrabold text-slate-400 uppercase tracking-widest mb-1 px-1">Ends repetition on:</label>
                 <input type="date" class="panel-input py-1 text-[11px]" value="${event.graduationDate || ''}" 
                        onchange="updateEventField('${eventId}', 'graduationDate', this.value)">
               </div>
             ` : ''}
           </div>
         ` : ''}
      </div>
    </div>

    <!-- SECTION 2: ADMIN TRACKER -->
    <div class="detail-section-title">
      <i data-lucide="layout-dashboard" class="w-3.5 h-3.5"></i>
      Admin Tracker
    </div>
    
    <!-- Lesson Tracker -->
    <div class="bg-blue/5 dark:bg-blue/10 p-3 rounded-xl border border-blue/20 dark:border-blue/80/20 mb-4">
      <div class="flex items-center gap-2 mb-3">
        <i data-lucide="book-open" class="w-3.5 h-3.5 text-blue"></i>
        <h4 class="text-[10px] font-extrabold text-blue uppercase tracking-widest">Lesson Status</h4>
      </div>
      
      <div class="grid grid-cols-2 gap-3 mb-3">
        <input type="text" class="panel-input text-[11px] py-1" value="${(event.lessonPlan?.unit || '').replace(/"/g, '&quot;')}" placeholder="Unit/Module" onchange="updateLessonField('${eventId}', 'unit', this.value)">
        <input type="text" class="panel-input text-[11px] py-1" value="${(event.lessonPlan?.lesson || '').replace(/"/g, '&quot;')}" placeholder="Lesson Topic" onchange="updateLessonField('${eventId}', 'lesson', this.value)">
      </div>

      <div class="flex items-center justify-between gap-1 p-1 bg-white/50 dark:bg-slate-900/50 rounded-lg border border-slate-200/50 dark:border-slate-700/50">
        ${LESSON_STATUSES.map(s => `
          <button onclick="setLessonStatus('${eventId}', '${s.id}')" 
                  class="lesson-status-btn flex-1 flex flex-col items-center gap-1 p-1.5 rounded-md transition-all ${event.lessonPlan?.status === s.id ? 'active bg-white dark:bg-slate-800' : 'opacity-40 grayscale hover:opacity-100 hover:grayscale-0'}"
                  title="${s.label}">
            <i data-lucide="${s.icon}" class="w-3.5 h-3.5" style="color: ${s.color}"></i>
            <span class="text-[7px] font-bold uppercase tracking-tighter" style="color: ${event.lessonPlan?.status === s.id ? s.color : 'inherit'}">${s.label}</span>
          </button>
        `).join('')}
      </div>
    </div>

    <!-- Checklist -->
    <div class="mb-6">
      <div class="flex items-center justify-between mb-2 px-1">
        <label class="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Admin Tasks (Lesson)</label>
        <span class="text-[10px] font-bold text-blue">${Math.round(checklistProgress)}%</span>
      </div>
      <div class="checklist-progress mb-3">
        <div class="checklist-progress-fill bg-blue" style="width: ${checklistProgress}%"></div>
      </div>
      <div class="flex flex-col gap-1 mb-2" id="checklist-container">
        ${checklistHtml}
      </div>
      <div class="flex gap-2 mt-2">
        <input type="text" id="new-checklist-input" class="panel-input flex-1 text-[11px] py-1.5" placeholder="Add lesson task..." onkeypress="if(event.key==='Enter') addChecklistItem('${eventId}')">
        <button onclick="addChecklistItem('${eventId}')" class="neo-btn-sm bg-blue text-white px-3 py-1.5 rounded-lg"><i data-lucide="plus" class="w-4 h-4"></i></button>
      </div>
    </div>

    <!-- Class Admin Tracker (Global to Class) -->
    ${event.typeId === 'class' ? `
    <div class="admin-section">
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center gap-2">
          <i data-lucide="users" class="w-3.5 h-3.5 text-pink"></i>
          <h4 class="text-[10px] font-extrabold text-pink uppercase tracking-widest">Class Admin (Global)</h4>
        </div>
        <div class="flex items-center gap-2">
          ${(() => {
            const uData = loadClassUnits()[event.name] || {};
            const units = Object.values(uData);
            const ready = units.filter(u => ['ready', 'taught', 'reviewed'].includes(u.status)).length;
            const total = units.length;
            if (total === 0) return '';
            const isReady = ready === total;
            return `<span class="px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase tracking-wider text-white shadow-sm" style="background:${isReady ? 'var(--color-green)' : 'var(--color-orange)'}">${isReady ? 'Units Ready' : `Units: ${ready}/${total}`}</span>`;
          })()}
        </div>
      </div>

      <div class="segmented-progress">
        ${(() => {
          const tasks = (loadClassAdmin()[event.name]?.tasks || []);
          if (tasks.length === 0) return '<div class="segmented-step opacity-20"></div>';
          return tasks.map(t => {
            const isOverdue = !t.done && t.deadline && t.deadline < getTodayStr();
            return `<div class="segmented-step ${t.done ? 'done' : (isOverdue ? 'overdue' : '')}" title="${t.text.replace(/"/g, '&quot;')}"></div>`;
          }).join('');
        })()}
      </div>

      <div class="space-y-1.5 mb-3">
        ${(loadClassAdmin()[event.name]?.tasks || []).map((task, i) => {
          const isOverdue = !task.done && task.deadline && task.deadline < getTodayStr();
          return `
          <div class="admin-task-item group/task">
            <label class="chunky-check flex-1 min-w-0" onclick="event.stopPropagation()">
              <input type="checkbox" ${task.done ? 'checked' : ''} onchange="toggleClassAdminTask('${event.name.replace(/'/g, "\\'")}', ${i}, this.checked)">
              <div class="box"></div>
              <span class="admin-task-text truncate ${task.done ? 'done' : (isOverdue ? 'text-pink' : '')}">${task.text}</span>
            </label>
            ${task.deadline ? `<span class="text-[8px] font-bold ${isOverdue ? 'text-pink' : 'text-slate-400'} uppercase">${new Date(task.deadline + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>` : ''}
            <button onclick="deleteClassAdminTask('${event.name.replace(/'/g, "\\'")}', ${i})" class="delete-btn opacity-0 group-hover/task:opacity-100 transition-opacity p-1">
              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
            </button>
          </div>
          `;
        }).join('') || '<p class="text-[10px] text-slate-400 italic">No class-wide tasks yet.</p>'}
      </div>

      <div class="flex gap-2">
        <input type="text" class="panel-input text-[11px] py-1.5" placeholder="+ New Class Task..." onkeydown="if(event.key==='Enter') { addClassAdminTask('${event.name.replace(/'/g, "\\'")}', this.value); this.value=''; }">
      </div>
    </div>
    ` : ''}
    
    <!-- Notes -->
    <div class="mb-4">
      <label class="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1 px-1">Notes</label>
      <textarea class="panel-input panel-textarea text-[12px]" onchange="updateEventField('${eventId}', 'notes', this.value)" placeholder="General event notes...">${event.notes}</textarea>
    </div>
  `;
  
  const footer = document.getElementById('detail-footer');
  footer.innerHTML = `
    <button onclick="deleteEvent('${eventId}')" class="neo-btn-sm bg-white dark:bg-slate-800 text-pink hover:bg-pink hover:text-white px-3 py-2 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors" title="Delete">
      <i data-lucide="trash-2" class="w-4 h-4"></i>
    </button>
    <button onclick="duplicateEvent('${eventId}')" class="neo-btn-sm bg-white dark:bg-slate-800 text-dark dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 px-3 py-2 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors" title="Clone">
      <i data-lucide="copy" class="w-4 h-4"></i>
    </button>
    <button id="save-close-btn" onclick="closeDetailPanel()" class="neo-btn bg-blue text-white flex-1 py-2 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-blue/20">
      <i data-lucide="check-circle" class="w-4 h-4"></i> Save & Close
    </button>
  `;
  
  lucide.createIcons({ root: detailPanel });
  detailPanel.classList.add('open');
}

// Re-render color picker to update active state
function renderDetailPanelOptions() {
  const event = events.find(e => e.id === selectedEventId);
  if(!event) return;
  const picker = document.getElementById('detail-color-picker');
  if(picker) {
    picker.innerHTML = COLOR_PALETTE.map(c => `
      <button class="color-swatch-compact ${c.hex === event.color ? 'active' : ''}" 
              style="background-color: ${c.hex}; color: ${c.hex}" 
              onclick="updateEventField('${event.id}', 'color', '${c.hex}'); renderDetailPanelOptions();" 
              title="${c.label}"></button>
    `).join('');
  }
}

function closeDetailPanel() {
  detailPanel.classList.remove('open');
selectedEventId = null;
  isDetailPanelDirty = false;
}

function updateEventField(id, field, value) {
  let event = events.find(e => e.id === id);
  if (!event) return;
  isDetailPanelDirty = true;
  
  // For recurrence-related fields, redirect to the master event
  const recurrenceFields = ['recurrence', 'recurrenceDays', 'graduationClass', 'graduationDate'];
  if (recurrenceFields.includes(field) && event.isRecurrence && event.originalEventId) {
    const masterId = event.originalEventId;
    const master = events.find(e => e.id === masterId);
    if (master) {
      // Apply the change to the master instead
      id = masterId;
      event = master;
    } else {
      showToast('Original event not found', 'warning');
      return;
    }
  }

  if (event) {
    if (field === 'startTime' || field === 'endTime') {
       let start = field === 'startTime' ? value : event.startTime;
       let end = field === 'endTime' ? value : event.endTime;
       
       if (timeToMinutes(start) >= timeToMinutes(end)) {
         showToast('End time must be after start time', 'warning');
         openDetailPanel(id);
         return;
       }
    }
    
    event[field] = value;
    event.updatedAt = new Date().toISOString();
    
    // If type changed and name is default, update name
    if(field === 'typeId') {
      const newType = getEventType(value);
      const oldType = EVENT_TYPES.find(t => event.name === t.label);
      if(oldType) event.name = newType.label;
      event.color = newType.defaultColor;
    }

    // Handle recurrence changes
    if (field === 'recurrence' || field === 'recurrenceDays' || field === 'graduationClass' || field === 'graduationDate') {
      if (!event.isRecurrence) {
        refreshRecurrences(id);
      }
    }
    
    saveData();
    renderCalendar();

    // Sync promoted instance to cloud (fire-and-forget)
    if (window.Sync) Sync.syncPromotedInstance(event);
    
    if (field === 'date') {
      const evtDate = new Date(value);
      const weekStart = getMonday(evtDate);
      if (currentWeekStart.getTime() !== weekStart.getTime()) {
        currentWeekStart = weekStart;
        renderCalendar();
      }
    }
    
    // Re-render detail panel to reflect changes without toggling
    if (field === 'typeId' || field === 'recurrence' || field === 'recurrenceDays' || field === 'graduationClass' || field === 'graduationDate') {
      selectedEventId = null;
      openDetailPanel(id, true);
    }
  }
}

/* ============================================
   9. Checklist Logic
   ============================================ */

function toggleChecklistItem(eventId, itemId) {
  const event = events.find(e => e.id === eventId);
  if (event) {
    isDetailPanelDirty = true;
    const item = event.checklist.find(i => i.id === itemId);
    if (item) {
      item.done = !item.done;
      saveData();

      // Sync promoted instance to cloud (fire-and-forget)
      if (window.Sync) Sync.syncPromotedInstance(event);

      updateEventUI(eventId);
      openDetailPanel(eventId, true);
    }
  }
}

function updateChecklistText(eventId, itemId, text) {
  const event = events.find(e => e.id === eventId);
  if (event) {
    isDetailPanelDirty = true;
    const item = event.checklist.find(i => i.id === itemId);
    if (item) {
      item.text = text;
      saveData();

      // Sync promoted instance to cloud (fire-and-forget)
      if (window.Sync) Sync.syncPromotedInstance(event);
    }
  }
}

function addChecklistItem(eventId) {
  const input = document.getElementById('new-checklist-input');
  const text = input.value.trim();
  if (!text) return;
  
  const event = events.find(e => e.id === eventId);
  if (event) {
    isDetailPanelDirty = true;
    event.checklist.push({
      id: `chk_${Date.now()}`,
      text: text,
      done: false
    });
    saveData();

    // Sync promoted instance to cloud (fire-and-forget)
    if (window.Sync) Sync.syncPromotedInstance(event);

    renderCalendar();
    openDetailPanel(eventId, true);
  }
}

function deleteChecklistItem(eventId, itemId) {
  const event = events.find(e => e.id === eventId);
  if (event) {
    isDetailPanelDirty = true;
    event.checklist = event.checklist.filter(i => i.id !== itemId);
    saveData();

    // Sync promoted instance to cloud (fire-and-forget)
    if (window.Sync) Sync.syncPromotedInstance(event);

    updateEventUI(eventId);
    openDetailPanel(eventId, true);
  }
}

function setLessonStatus(eventId, statusId) {
  const event = events.find(e => e.id === eventId);
  if (event) {
    isDetailPanelDirty = true;
    if (!event.lessonPlan) {
        event.lessonPlan = { unit: '', lesson: '', status: 'draft' };
    }
    event.lessonPlan.status = statusId;
    saveData();

    // Sync promoted instance to cloud (fire-and-forget)
    if (window.Sync) Sync.syncPromotedInstance(event);

    updateEventUI(eventId);
    openDetailPanel(eventId, true);
  }
}

function updateLessonField(eventId, field, value) {
  const event = events.find(e => e.id === eventId);
  if (event) {
    isDetailPanelDirty = true;
    if (!event.lessonPlan) {
        event.lessonPlan = { unit: '', lesson: '', status: 'draft' };
    }
    event.lessonPlan[field] = value;
    saveData();

    // Sync promoted instance to cloud (fire-and-forget)
    if (window.Sync) Sync.syncPromotedInstance(event);
  }
}

/* ============================================
   10. Event CRUD & Modals
   ============================================ */

function openEventModal(eventObj = null, dateStr = null, timeStr = null, typeId = 'class') {
  const modal = document.getElementById('event-modal');
  const type = getEventType(typeId);
  
  // Default values
  let name = type.label;
  let tId = typeId;
  let color = type.defaultColor;
  let date = dateStr || getDayString(new Date());
  let start = timeStr || '08:00';
  let end = timeStr ? slotIndexToTime(timeToSlotIndex(timeStr) + 4) : '09:00'; // 1 hour default
  let room = '';
  let notes = '';
  let isEdit = false;
  
  if (eventObj) {
    isEdit = true;
    name = eventObj.name;
    tId = eventObj.typeId;
    color = eventObj.color;
    date = eventObj.date;
    start = eventObj.startTime;
    end = eventObj.endTime;
    room = eventObj.room;
    notes = eventObj.notes;
  }
  
  const typeOptions = EVENT_TYPES.map(t => `
    <option value="${t.id}" ${t.id === tId ? 'selected' : ''}>${t.label}</option>
  `).join('');

  const recurrenceOptions = `
    <div class="space-y-1">
      <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Repeat</label>
      <select id="modal-recurrence" class="modal-input" onchange="toggleModalDaySelector(this.value)">
        ${RECURRENCE_OPTIONS.map(opt => `<option value="${opt.id}" ${eventObj && eventObj.recurrence === opt.id ? 'selected' : ''}>${opt.label}</option>`).join('')}
      </select>
      <div id="modal-day-selector-container" class="${eventObj && eventObj.recurrence === 'custom-days' ? '' : 'hidden'} mt-2">
        <label class="block text-[9px] font-bold text-slate-500 mb-1">Select Days</label>
        ${getDaySelectorHtml(eventObj ? eventObj.recurrenceDays : [])}
      </div>
    </div>`;
  
  const colorOptions = COLOR_PALETTE.map(c => `
    <button type="button" class="color-swatch ${c.hex === color ? 'active' : ''}" 
            style="background-color: ${c.hex}; color: ${c.hex}" 
            onclick="document.querySelectorAll('#modal-color-picker .color-swatch').forEach(el=>el.classList.remove('active')); this.classList.add('active'); document.getElementById('modal-color').value = '${c.hex}';" 
            title="${c.label}"></button>
  `).join('');

  modal.innerHTML = `
    <div class="modal-backdrop" onclick="if(event.target===this) closeEventModal()">
      <div class="modal-card flex flex-col">
        <div class="p-5 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <h2 class="font-heading font-bold text-xl text-dark dark:text-white flex items-center gap-2">
            <i data-lucide="${isEdit ? 'edit' : 'plus-circle'}" class="w-5 h-5 text-blue"></i> 
            ${isEdit ? 'Edit Event' : 'New Event'}
          </h2>
          <button onclick="closeEventModal()" class="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400">
            <i data-lucide="x" class="w-5 h-5"></i>
          </button>
        </div>
        
        <div class="p-5 overflow-y-auto custom-scrollbar flex flex-col gap-4">
          <input type="hidden" id="modal-color" value="${color}">
          <input type="hidden" id="modal-id" value="${eventObj ? eventObj.id : ''}">
          
          <div>
            <label class="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1">Name</label>
            <input type="text" id="modal-name" class="panel-input text-lg font-heading" value="${name.replace(/"/g, '&quot;')}">
          </div>
          
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1">Type</label>
              <select id="modal-type" class="panel-input" onchange="
                const t = getEventType(this.value); 
                document.getElementById('graduation-container').classList.toggle('hidden', this.value !== 'class');
                document.getElementById('modal-color').value = t.defaultColor;
                document.querySelectorAll('#modal-color-picker .color-swatch').forEach(el=>{
                  el.classList.remove('active');
                  if(el.style.backgroundColor === t.defaultColor || el.style.backgroundColor === t.defaultColor.toLowerCase() || el.style.color === t.defaultColor.toLowerCase()) el.classList.add('active');
                });
                if(document.getElementById('modal-name').value === EVENT_TYPES.find(x=>x.id!==this.value)?.label || !document.getElementById('modal-name').value) {
                  document.getElementById('modal-name').value = t.label;
                }
              ">
                ${typeOptions}
              </select>
            </div>
            <div>
              <label class="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1">Color</label>
              <div class="color-picker-grid" id="modal-color-picker">${colorOptions}</div>
            </div>
          </div>
          
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1">Date</label>
              <input type="date" id="modal-date" class="panel-input" value="${date}">
            </div>
            <div>
              <label class="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1">Room/Location</label>
              <input type="text" id="modal-room" class="panel-input" value="${room.replace(/"/g, '&quot;')}" placeholder="e.g. Lab">
            </div>
          </div>
          
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1">Start Time</label>
              <input type="time" id="modal-start" class="panel-input" value="${start}" step="900">
            </div>
            <div>
              <label class="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1">End Time</label>
              <input type="time" id="modal-end" class="panel-input" value="${end}" step="900">
            </div>
          </div>
          
          <div class="grid grid-cols-2 gap-4">
            ${recurrenceOptions}
            <div id="graduation-container" class="${tId === 'class' ? '' : 'hidden'} flex flex-col gap-2">
              <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Graduation (Ends repetition)</label>
              <div class="flex items-center gap-2">
                <input type="checkbox" id="modal-grad-check" class="w-4 h-4 rounded" ${eventObj && eventObj.graduationClass ? 'checked' : ''} onchange="document.getElementById('modal-grad-date').disabled = !this.checked">
                <input type="date" id="modal-grad-date" class="modal-input flex-1 py-1" value="${eventObj ? eventObj.graduationDate : ''}" ${eventObj && eventObj.graduationClass ? '' : 'disabled'}>
              </div>
            </div>
          </div>

          <div>
            <label class="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1">Notes</label>
            <textarea id="modal-notes" class="panel-input panel-textarea" placeholder="Add descriptions or notes here...">${notes}</textarea>
          </div>
        </div>
        
        <div class="p-5 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3 bg-slate-50 dark:bg-slate-800/50 rounded-b-[1.5rem]">
          <button onclick="closeEventModal()" class="neo-btn bg-white dark:bg-slate-800 text-dark dark:text-white px-6 py-2 rounded-xl">Cancel</button>
          <button onclick="saveEventFromModal()" class="neo-btn bg-blue text-white px-6 py-2 rounded-xl">Save</button>
        </div>
      </div>
    </div>
  `;
  
  lucide.createIcons({ root: modal });
  modal.classList.remove('hidden');
}

function closeEventModal() {
  document.getElementById('event-modal').classList.add('hidden');
}

function saveEventFromModal() {
  const id = document.getElementById('modal-id').value;
  const name = document.getElementById('modal-name').value || 'New Event';
  const typeId = document.getElementById('modal-type').value;
  const color = document.getElementById('modal-color').value;
  const date = document.getElementById('modal-date').value;
  const start = document.getElementById('modal-start').value;
  const end = document.getElementById('modal-end').value;
  const room = document.getElementById('modal-room').value;
  const recurrence = document.getElementById('modal-recurrence').value;
  const notes = document.getElementById('modal-notes').value;
  const graduationClass = document.getElementById('modal-grad-check').checked;
  const graduationDate = document.getElementById('modal-grad-date').value;
  
  const recurrenceDays = [];
  if (recurrence === 'custom-days') {
      document.querySelectorAll('#modal-day-selector-container .day-btn.active').forEach(btn => {
          recurrenceDays.push(parseInt(btn.dataset.day));
      });
  }
  
  if (timeToMinutes(start) >= timeToMinutes(end)) {
    showToast('End time must be after start time', 'warning');
    return;
  }
  
  let targetId = id;
  if (id) {
    // Edit existing
    const evt = events.find(e => e.id === id);
    if (evt) {
      evt.name = name;
      evt.typeId = typeId;
      evt.color = color;
      evt.date = date;
      evt.startTime = start;
      evt.endTime = end;
      evt.room = room;
      evt.recurrence = recurrence;
      evt.recurrenceDays = recurrenceDays;
      evt.notes = notes;
      evt.graduationClass = graduationClass;
      evt.graduationDate = graduationDate;
      evt.updatedAt = new Date().toISOString();
    }
  } else {
    // Create new
    const newEvt = createEventObject({
      name, typeId, colorHex: color, date, startTime: start, endTime: end, room, notes, recurrence, recurrenceDays, graduationClass, graduationDate
    });
    events.push(newEvt);
    targetId = newEvt.id;
  }
  
  refreshRecurrences(targetId);
  saveData();
  
  if (id) {
    updateEventUI(id);
  } else {
    renderCalendar(); // Full render for new events to ensure placement
  }
  closeEventModal();
}

function deleteEvent(id) {
  // Check if it's a recurring instance or original
  const event = events.find(e => e.id === id);
  if (event && event.recurrence !== 'none') {
      if (confirm('Delete this event? It is a recurring event. This will delete the main event and all future occurrences.')) {
           // Delete original and all instances
           events = events.filter(e => e.id !== id && e.originalEventId !== id);
      } else {
          return;
      }
  } else {
      if (!confirm('Are you sure you want to delete this event?')) return;
      events = events.filter(e => e.id !== id);
  }
  
  saveData();
  renderCalendar();
  closeDetailPanel();
  showToast('Event deleted', 'info');
}

function duplicateEvent(id) {
  const source = events.find(e => e.id === id);
  if (!source) return;
  
  const clone = JSON.parse(JSON.stringify(source));
  clone.id = `evt_${Date.now()}`;
  clone.name = `${clone.name} (Copy)`;
  // Offset by 1 day as a simple default
  const d = new Date(clone.date);
  d.setDate(d.getDate() + 1);
  clone.date = getDayString(d);
  
  clone.recurrence = 'none'; // clones don't inherit recurrence
  clone.isRecurrence = false;
  clone.originalEventId = null;
  // reset checklist
  clone.checklist.forEach(i => {
    i.id = `chk_${Date.now()}_${Math.random()}`;
    i.done = false;
  });
  
  events.push(clone);
  saveData();
  
  // Navigate to clone's date
  currentWeekStart = getMonday(d);
  renderCalendar();
  openDetailPanel(clone.id);
  showToast('Event duplicated', 'success');
}

/* ============================================
   11. Navigation & Actions
   ============================================ */

function goToNextWeek() {
  if (viewMode === 'day') {
    currentDayOffset++;
  } else if (viewMode === '3-day') {
    currentDayOffset += 3;
  } else {
    currentWeekStart.setDate(currentWeekStart.getDate() + 7);
  }
  renderCalendar();
  updateStats();
}

function goToPrevWeek() {
  if (viewMode === 'day') {
    currentDayOffset--;
  } else if (viewMode === '3-day') {
    currentDayOffset -= 3;
  } else {
    currentWeekStart.setDate(currentWeekStart.getDate() - 7);
  }
  renderCalendar();
  updateStats();
}

function goToToday() {
  const now = new Date();
  currentWeekStart = getMonday(now);
  
  if (viewMode === 'day' || viewMode === '3-day') {
    currentDayOffset = (now.getDay() + 6) % 7;
  } else {
    currentDayOffset = 0;
  }
  
  renderCalendar();
  updateStats();
  setTimeout(scrollToCurrentTime, 100);
}

function toggleMobileSidebar() {
  const sb = document.getElementById('sidebar');
  if (sb.classList.contains('mobile-open')) {
    sb.classList.remove('mobile-open');
  } else {
    sb.classList.add('mobile-open');
  }
}


function cycleDayCount() {
  if (weekDayCount === 5) weekDayCount = 6;
  else if (weekDayCount === 6) weekDayCount = 7;
  else weekDayCount = 5;
  
  localStorage.setItem('schedule_week_day_count', weekDayCount);
  document.getElementById('day-count-label').textContent = `${weekDayCount} days`;
  renderCalendar();
}

function toggleViewMode() {
  if (viewMode === 'week') viewMode = '3-day';
  else if (viewMode === '3-day') viewMode = 'day';
  else viewMode = 'week';
  
  localStorage.setItem('schedule_view_mode', viewMode);
  updateViewModeUI();
  renderCalendar();
}

function updateViewModeUI() {
  const btn = document.getElementById('view-mode-btn');
  if (!btn) return;
  
  let icon = 'calendar-days';
  let label = 'Week View';
  
  if (viewMode === 'day') {
    icon = 'calendar';
    label = 'Day View';
  } else if (viewMode === '3-day') {
    icon = 'calendar-range';
    label = '3-Day View';
  }
  
  btn.innerHTML = `
    <i data-lucide="${icon}" class="w-3.5 h-3.5"></i>
    <span class="hidden lg:inline">${label}</span>
  `;
  lucide.createIcons({ root: btn });
  
  // Show/hide day count button based on view mode
  const dayCountBtn = document.getElementById('day-count-btn');
  if (dayCountBtn) {
    dayCountBtn.style.display = viewMode === 'week' ? 'flex' : 'none';
    document.getElementById('day-count-label').textContent = `${weekDayCount} days`;
  }
}

function getDaySelectorHtml(selectedDays = []) {
  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  return `
    <div class="day-selector flex gap-1.5">
      ${days.map((d, i) => `
        <button type="button" 
          data-day="${i}"
          onclick="toggleRecurrenceDay(this)"
          class="day-btn w-7 h-7 rounded-full border-2 border-slate-200 dark:border-slate-700 text-[9px] font-bold transition-all ${selectedDays.includes(i) ? 'active bg-blue-500 text-white border-blue-500' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400'}"
        >${d}</button>
      `).join('')}
    </div>
  `;
}

function toggleRecurrenceDay(btn) {
  btn.classList.toggle('active');
  if (btn.classList.contains('active')) {
    btn.classList.remove('bg-white', 'dark:bg-slate-800', 'text-slate-600', 'dark:text-slate-400', 'border-slate-200', 'dark:border-slate-700');
    btn.classList.add('bg-blue-500', 'text-white', 'border-blue-500');
  } else {
    btn.classList.add('bg-white', 'dark:bg-slate-800', 'text-slate-600', 'dark:text-slate-400', 'border-slate-200', 'dark:border-slate-700');
    btn.classList.remove('bg-blue-500', 'text-white', 'border-blue-500');
  }
  
  // If we are in the detail panel, update immediately
  const detailPanel = btn.closest('#detail-panel');
  if (detailPanel && detailPanel.classList.contains('open') && selectedEventId) {
      const activeDays = Array.from(detailPanel.querySelectorAll('.day-btn.active')).map(b => parseInt(b.dataset.day));
      updateEventField(selectedEventId, 'recurrenceDays', activeDays);
  }
}

function toggleModalDaySelector(value, containerId = 'modal-day-selector-container') {
  const container = document.getElementById(containerId);
  if (container) container.classList.toggle('hidden', value !== 'custom-days');
}

function toggleRedDay(dateStr) {
  const index = redDays.indexOf(dateStr);
  if (index === -1) {
    redDays.push(dateStr);
    showToast(`Marked ${dateStr} as a holiday`, 'info');
  } else {
    redDays.splice(index, 1);
    showToast(`Removed holiday status for ${dateStr}`, 'info');
  }
  saveData();
  renderCalendar();
}

function openSettingsModal() {
  const modal = document.getElementById('settings-modal');
  if (!modal.classList.contains('hidden')) {
    closeSettingsModal();
    return;
  }
  
  document.getElementById('setting-start-hour').value = `${String(SCHEDULE_START_HOUR).padStart(2, '0')}:00`;
  document.getElementById('setting-end-hour').value = `${String(SCHEDULE_END_HOUR).padStart(2, '0')}:00`;
  modal.classList.remove('hidden');
}

function closeSettingsModal() {
  document.getElementById('settings-modal').classList.add('hidden');
}

function saveSettings() {
  const startVal = document.getElementById('setting-start-hour').value;
  const endVal = document.getElementById('setting-end-hour').value;
  
  if (!startVal || !endVal) {
    showToast('Please select both start and end times', 'warning');
    return;
  }

  const start = parseInt(startVal.split(':')[0]);
  const end = parseInt(endVal.split(':')[0]);
  
  if (start >= end) {
    showToast('Start time must be before end time', 'warning');
    return;
  }
  
  updateScheduleRange(start, end);
  localStorage.setItem('schedule_start_hour', start);
  localStorage.setItem('schedule_end_hour', end);
  
  renderCalendar();
  closeSettingsModal();
  showToast('Settings saved successfully', 'success');
}

/* ============================================
   12. Holiday / Day Off Manager
   ============================================ */

function openHolidaysModal(isInitial = true) {
  const modal = document.getElementById('holidays-modal');
  const body = document.getElementById('holidays-body');
  
  if (isInitial) {
    // Force hide settings modal
    const settingsModal = document.getElementById('settings-modal');
    if (settingsModal) settingsModal.classList.add('hidden');
    
    tempRedDays = [...redDays];
    isHolidayModalDirty = false;
  }
  
  const now = new Date();
  let html = '';

  for (let i = 0; i < 6; i++) { // Show next 6 months
    const monthDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
    html += renderHolidayMonth(monthDate);
  }

  body.innerHTML = html;
  lucide.createIcons({ root: modal });
  modal.classList.remove('hidden');
}

function buzzSaveButton() {
  const saveBtn = document.getElementById('save-close-btn');
  if (saveBtn) {
    saveBtn.classList.remove('animate-shake');
    void saveBtn.offsetWidth; // Trigger reflow
    saveBtn.classList.add('animate-shake');
    if (window.navigator && window.navigator.vibrate) {
      window.navigator.vibrate(50);
    }
  }
}

function saveHolidays() {
  redDays = [...tempRedDays];
  isHolidayModalDirty = false;
  saveData();
  renderCalendar();
  closeHolidaysModal(true);
  showToast('Holidays updated', 'success');
}

function closeHolidaysModal(force = false) {
  if (!force && isHolidayModalDirty) {
    const saveBtn = document.getElementById('holiday-save-btn');
    if (saveBtn) {
      saveBtn.classList.remove('animate-shake');
      void saveBtn.offsetWidth;
      saveBtn.classList.add('animate-shake');
      if (window.navigator && window.navigator.vibrate) window.navigator.vibrate(100);
    }
    return;
  }
  document.getElementById('holidays-modal').classList.add('hidden');
  isHolidayModalDirty = false;
}

function toggleTempRedDay(dateStr) {
  isHolidayModalDirty = true;
  const index = tempRedDays.indexOf(dateStr);
  if (index === -1) {
    tempRedDays.push(dateStr);
  } else {
    tempRedDays.splice(index, 1);
  }
  openHolidaysModal(false);
}

function renderHolidayMonth(date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const monthName = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  
  const firstDay = new Date(year, month, 1);
  const startDay = (firstDay.getDay() + 6) % 7; // Mon=0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  
  let gridHtml = '<div class="holiday-grid">';
  // Padding
  for (let i = 0; i < startDay; i++) gridHtml += '<div class="holiday-day muted"></div>';
  
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month+1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const isOff = tempRedDays.includes(dateStr);
    gridHtml += `<div class="holiday-day ${isOff ? 'off shadow-neo-sm' : ''}" onclick="toggleTempRedDay('${dateStr}')">${d}</div>`;
  }
  gridHtml += '</div>';
  
  return `
    <div class="month-container">
      <h3 class="holiday-month-title">${monthName}</h3>
      <div class="flex justify-between text-[8px] font-extrabold text-slate-400 uppercase mb-2 px-1 tracking-tighter">
        <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
      </div>
      ${gridHtml}
    </div>
  `;
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  
  const types = {
    info: { icon: 'info', color: 'bg-blue text-white' },
    success: { icon: 'check-circle', color: 'bg-green text-white' },
    warning: { icon: 'alert-triangle', color: 'bg-orange text-white' },
    error: { icon: 'x-circle', color: 'bg-pink text-white' }
  };
  
  const config = types[type] || types.info;
  
  toast.className = `px-4 py-3 rounded-xl shadow-neo font-bold text-sm flex items-center gap-3 transform transition-all duration-300 translate-y-10 opacity-0 ${config.color} border-2 border-[#1e293b]`;
  toast.innerHTML = `
    <i data-lucide="${config.icon}" class="w-5 h-5"></i>
    <span>${message}</span>
  `;
  
  container.appendChild(toast);
  lucide.createIcons({ root: toast });
  
  // Animate in
  setTimeout(() => {
    toast.classList.remove('translate-y-10', 'opacity-0');
    toast.classList.add('translate-y-0', 'opacity-100');
  }, 10);
  
  // Auto remove
  setTimeout(() => {
    toast.classList.remove('translate-y-0', 'opacity-100');
    toast.classList.add('translate-y-10', 'opacity-0');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Expose for sync.js
window.showToast = showToast;

function toggleDarkMode() {
  document.documentElement.classList.toggle('dark');
  const isDark = document.documentElement.classList.contains('dark');
  localStorage.setItem('theme_schedule', isDark ? 'dark' : 'light');
  document.getElementById('darkModeIcon').setAttribute('data-lucide', isDark ? 'sun' : 'moon');
  lucide.createIcons();
}

function exportSchedule() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(events, null, 2));
  const downloadAnchorNode = document.createElement('a');
  downloadAnchorNode.setAttribute("href", dataStr);
  downloadAnchorNode.setAttribute("download", `schedule_backup_${new Date().toISOString().slice(0,10)}.json`);
  document.body.appendChild(downloadAnchorNode); // required for firefox
  downloadAnchorNode.click();
  downloadAnchorNode.remove();
  showToast('Schedule exported', 'success');
}

function triggerImport() {
  document.getElementById('importInput').click();
}

function processImport(input) {
  const file = input.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const importedData = JSON.parse(e.target.result);
      if (Array.isArray(importedData)) {
        events = importedData;
        saveData();
        renderCalendar();
        showToast('Schedule restored successfully', 'success');
      } else {
        showToast('Invalid backup file format', 'error');
      }
    } catch (err) {
      showToast('Error parsing file', 'error');
    }
    input.value = ''; // reset
  };
  reader.readAsText(file);
}

/* ============================================
   13. Event Listeners & Startup
   ============================================ */

function setupEventListeners() {
  // Handle escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (!document.getElementById('holidays-modal').classList.contains('hidden')) {
        closeHolidaysModal();
      } else if (document.getElementById('settings-modal') && !document.getElementById('settings-modal').classList.contains('hidden')) {
        closeSettingsModal();
      } else if (!document.getElementById('event-modal').classList.contains('hidden')) {
        closeEventModal();
      } else {
        closeDetailPanel();
      }
    }
  });

  // Handle click away from detail panel
  document.addEventListener('mousedown', (e) => {
    if (selectedEventId) {
      const panel = document.getElementById('detail-panel');
      const modal = document.getElementById('event-modal');
      const isInsidePanel = panel && panel.contains(e.target);
      const isInsideModal = modal && !modal.classList.contains('hidden') && modal.contains(e.target);
      
      // If clicking away from the open panel
      if (!isInsidePanel && !isInsideModal && !e.target.closest('.event-block')) {
        if (!isDetailPanelDirty) {
          // No changes? Allow clicking away to close
          closeDetailPanel();
        } else {
          // Changes made? Vibrate/shake the save button
          buzzSaveButton();
        }
      }
    }
  });
  
  // Add global drag over prevention for body to allow drops
  document.body.addEventListener('dragover', (e) => {
    e.preventDefault();
  });
  
  // Initialize dark mode icon based on state
  if (document.documentElement.classList.contains('dark')) {
      document.getElementById('darkModeIcon').setAttribute('data-lucide', 'sun');
  }
}

/* ============================================
   CLASS ADMIN ACTIONS
   ============================================ */

function addClassAdminTask(className, text) {
  if (!text.trim()) return;
  isDetailPanelDirty = true;
  const data = loadClassAdmin();
  if (!data[className]) data[className] = { tasks: [] };
  data[className].tasks.push({
    id: `task_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
    text: text.trim(),
    done: false
  });
  saveClassAdmin(data);
  updateStats();
  if (selectedEventId) openDetailPanel(selectedEventId, true);
}

function deleteClassAdminTask(className, index) {
  isDetailPanelDirty = true;
  const data = loadClassAdmin();
  if (!data[className] || !data[className].tasks[index]) return;
  data[className].tasks.splice(index, 1);
  saveClassAdmin(data);
  updateStats();
  if (selectedEventId) openDetailPanel(selectedEventId, true);
}

function toggleClassAdminTask(className, index, checked) {
  isDetailPanelDirty = true;
  const data = loadClassAdmin();
  if (!data[className] || !data[className].tasks[index]) return;
  data[className].tasks[index].done = checked;
  saveClassAdmin(data);
  updateStats();
  if (selectedEventId) openDetailPanel(selectedEventId, true);
}

// Re-render callback for sync.js loadFromCloud
window._syncRerender = function () {
  loadData();
  renderSidebar();
  renderCalendar();
};

// Start
document.addEventListener('DOMContentLoaded', async () => {
  // 1. Render immediately from localStorage
  init();

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
      console.error('[Schedule] Cloud init failed:', err);
      Sync.setSyncBadge('error');
    }
  } else if (window.Sync) {
    Sync.setSyncBadge('local');
  }
});
