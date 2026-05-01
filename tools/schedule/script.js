/* ============================================
   SCRIPT.JS - Main Logic for Schedule Tool
   ============================================ */

// State
let events = [];
let currentWeekStart = getMonday(new Date());
let selectedEventId = null;
let showWeekends = false;

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
  renderSidebar();
  renderCalendar();
  setupEventListeners();
  updateTimeIndicator();
  setInterval(updateTimeIndicator, 60000); // Update every minute
  
  // Wait a bit for layout to settle before scrolling
  setTimeout(scrollToCurrentTime, 300);
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
  if (saved) {
    events = JSON.parse(saved);
  }
}

function saveData() {
  localStorage.setItem('schedule_events', JSON.stringify(events));
  updateStats();
  updateTodayList();
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

function getDisplayWeekRange() {
  const end = new Date(currentWeekStart);
  end.setDate(end.getDate() + (showWeekends ? 6 : 4));
  
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
  const endOfWeek = new Date(currentWeekStart);
  endOfWeek.setDate(endOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);

  let weekEvents = 0;
  let totalTasks = 0;
  let doneTasks = 0;

  events.forEach(evt => {
    const evtDate = new Date(evt.date);
    if (evtDate >= currentWeekStart && evtDate <= endOfWeek) {
      weekEvents++;
      if (evt.checklist) {
        totalTasks += evt.checklist.length;
        doneTasks += evt.checklist.filter(i => i.done).length;
      }
    }
  });

  document.getElementById('stat-events').textContent = weekEvents;
  document.getElementById('stat-tasks').textContent = totalTasks;
  document.getElementById('stat-done').textContent = doneTasks;
  document.getElementById('stat-pending').textContent = totalTasks - doneTasks;
}

function updateTodayList() {
  const container = document.getElementById('today-events-list');
  if (!container) return;
  container.innerHTML = '';
  
  const todayStr = getDayString(new Date());
  const todayEvents = events.filter(e => e.date === todayStr).sort((a, b) => a.startTime.localeCompare(b.startTime));
  
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
  const numDays = showWeekends ? 7 : 5;
  
  // Render Day Headers
  dayHeadersRow.innerHTML = '<div class="time-gutter flex-none"></div>';
  dayHeadersRow.style.display = 'grid';
  dayHeadersRow.style.gridTemplateColumns = `56px repeat(${numDays}, 1fr)`; // 56px matches time-gutter width
  const todayStr = getDayString(new Date());
  
  for (let i = 0; i < numDays; i++) {
    const dayDate = new Date(currentWeekStart);
    dayDate.setDate(dayDate.getDate() + i);
    const isToday = getDayString(dayDate) === todayStr;
    
    const div = document.createElement('div');
    div.className = `day-header flex-1 ${isToday ? 'today' : ''}`;
    div.innerHTML = `
      <div class="day-name">${DAYS_OF_WEEK[i]}<span class="day-name-full hidden md:inline">${DAYS_FULL[i].slice(3)}</span></div>
      <div class="day-number mt-1">${dayDate.getDate()}</div>
    `;
    dayHeadersRow.appendChild(div);
  }
  
  // Render Time Gutter
  timeGutter.innerHTML = '';
  for (let i = 0; i <= TOTAL_SLOTS; i++) {
    const time = slotIndexToTime(i);
    const isHour = time.endsWith(':00');
    if (isHour) {
      const div = document.createElement('div');
      div.className = 'time-label';
      div.style.height = i === TOTAL_SLOTS ? '0' : '80px'; // 4 slots * 20px = 80px per hour
      // Use standard height for consistent calculation, visual spacing can be handled via flex/grid
      div.innerHTML = `<span>${formatTimeDisplay(time).replace(' AM', '').replace(' PM', '')}</span>`;
      timeGutter.appendChild(div);
    }
  }
  // Setup grid CSS variables
  calendarWrapper.style.setProperty('--slot-height', '20px'); // 15 mins = 20px -> 1 hour = 80px
  
  // Render Day Columns and Grid Slots
  dayColumns.innerHTML = '';
  dayColumns.style.display = 'grid';
  dayColumns.style.gridTemplateColumns = `repeat(${numDays}, 1fr)`;
  
  for (let d = 0; d < numDays; d++) {
    const dayDate = new Date(currentWeekStart);
    dayDate.setDate(dayDate.getDate() + d);
    const dayStr = getDayString(dayDate);
    const isToday = dayStr === todayStr;
    
    const col = document.createElement('div');
    col.className = `day-column ${isToday ? 'today-col' : ''}`;
    col.dataset.date = dayStr;
    
    // Draw background grid lines for this column
    for (let i = 0; i < TOTAL_SLOTS; i++) {
      const line = document.createElement('div');
      line.className = `slot-line ${i % 4 === 0 ? 'hour-start' : ''}`;
      line.style.top = `${i * 20}px`; // Match --slot-height
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

  evtBlock.innerHTML = `
    <div class="event-title text-dark dark:text-white">${evt.name}</div>
    <div class="event-time text-dark dark:text-white opacity-70">${formatTimeDisplay(evt.startTime)} - ${formatTimeDisplay(evt.endTime)}</div>
    ${progressHtml}
    ${lessonStatusHtml}
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
  
  if (!dateStr || !timeStr) return;
  
  if (draggedType) {
    // Dropped a template -> Open create modal
    openEventModal(null, dateStr, timeStr, draggedType);
  } else if (draggedEventId) {
    // Dropped an existing event -> Update time/date
    const event = events.find(ev => ev.id === draggedEventId);
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
      
      refreshRecurrences(draggedEventId);
      saveData();
      renderCalendar();
      if (selectedEventId === event.id) openDetailPanel(event.id); // Refresh panel if open
    }
  }
  
  draggedType = null;
  draggedEventId = null;
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
      refreshRecurrences(resizeEventId);
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

function openDetailPanel(eventId) {
  selectedEventId = eventId;
  const event = events.find(e => e.id === eventId);
  if (!event) return;
  
  const body = document.getElementById('detail-body');
  const type = getEventType(event.typeId);
  
  // Build color options
  const colorOptions = COLOR_PALETTE.map(c => `
    <button class="color-swatch ${c.hex === event.color ? 'active' : ''}" 
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
    <!-- Name -->
    <div class="mb-4">
      <input type="text" class="panel-input text-lg font-heading" value="${event.name.replace(/"/g, '&quot;')}" onchange="updateEventField('${eventId}', 'name', this.value)">
    </div>
    
    <!-- Type & Color -->
    <div class="grid grid-cols-2 gap-4 mb-4">
      <div>
        <label class="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1 px-1">Type</label>
        <select class="panel-input" onchange="updateEventField('${eventId}', 'typeId', this.value)">
          ${typeOptions}
        </select>
      </div>
      <div>
        <label class="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1 px-1">Color</label>
        <div class="color-picker-grid" id="detail-color-picker">${colorOptions}</div>
      </div>
    </div>
    
    <!-- Date & Time -->
    <div class="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700 mb-4">
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
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1 px-1">Start</label>
          <input type="time" class="panel-input" value="${event.startTime}" onchange="updateEventField('${eventId}', 'startTime', this.value)" step="900">
        </div>
        <div>
          <label class="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1 px-1">End</label>
          <input type="time" class="panel-input" value="${event.endTime}" onchange="updateEventField('${eventId}', 'endTime', this.value)" step="900">
        </div>
      </div>
    </div>
    
    <!-- Lesson Tracker -->
    <div class="bg-blue/5 dark:bg-blue/10 p-3 rounded-xl border border-blue/20 dark:border-blue/80/20 mb-4">
      <div class="flex items-center gap-2 mb-3">
        <i data-lucide="book-open" class="w-3.5 h-3.5 text-blue"></i>
        <h4 class="text-[10px] font-extrabold text-blue uppercase tracking-widest">Lesson Tracker</h4>
      </div>
      
      <div class="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label class="block text-[8px] font-extrabold text-slate-400 uppercase tracking-widest mb-1 px-1">Unit / Module</label>
          <input type="text" class="panel-input text-[11px] py-1" value="${(event.lessonPlan?.unit || '').replace(/"/g, '&quot;')}" placeholder="e.g. Unit 1" onchange="updateLessonField('${eventId}', 'unit', this.value)">
        </div>
        <div>
          <label class="block text-[8px] font-extrabold text-slate-400 uppercase tracking-widest mb-1 px-1">Lesson Topic</label>
          <input type="text" class="panel-input text-[11px] py-1" value="${(event.lessonPlan?.lesson || '').replace(/"/g, '&quot;')}" placeholder="e.g. Introduction" onchange="updateLessonField('${eventId}', 'lesson', this.value)">
        </div>
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

    <!-- Recurrence -->
    <div class="mb-4">
       <label class="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1 px-1">Repeat</label>
       <select class="panel-input" onchange="updateEventField('${eventId}', 'recurrence', this.value)">
          ${recurrenceOptionsHtml}
       </select>
       ${event.isRecurrence ? `<p class="text-[10px] text-orange mt-1 font-bold"><i data-lucide="info" class="w-3 h-3 inline"></i> This is a recurring instance.</p>` : ''}
    </div>

    <!-- Checklist -->
    <div class="mb-4">
      <div class="flex items-center justify-between mb-2 px-1">
        <label class="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Admin Tasks</label>
        <span class="text-[10px] font-bold text-blue">${Math.round(checklistProgress)}%</span>
      </div>
      <div class="checklist-progress mb-3">
        <div class="checklist-progress-fill bg-blue" style="width: ${checklistProgress}%"></div>
      </div>
      <div class="flex flex-col gap-1 mb-2" id="checklist-container">
        ${checklistHtml}
      </div>
      <div class="flex gap-2 mt-2">
        <input type="text" id="new-checklist-input" class="panel-input flex-1 text-sm py-1.5" placeholder="Add task..." onkeypress="if(event.key==='Enter') addChecklistItem('${eventId}')">
        <button onclick="addChecklistItem('${eventId}')" class="neo-btn-sm bg-blue text-white px-3 py-1.5 rounded-lg"><i data-lucide="plus" class="w-4 h-4"></i></button>
      </div>
    </div>
    
    <!-- Notes -->
    <div class="mb-4">
      <label class="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1 px-1">Notes</label>
      <textarea class="panel-input panel-textarea" onchange="updateEventField('${eventId}', 'notes', this.value)">${event.notes}</textarea>
    </div>
  `;
  
  const footer = document.getElementById('detail-footer');
  footer.innerHTML = `
    <button onclick="deleteEvent('${eventId}')" class="neo-btn-sm bg-white dark:bg-slate-800 text-pink hover:bg-pink hover:text-white flex-1 py-2 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors">
      <i data-lucide="trash-2" class="w-4 h-4"></i> Delete
    </button>
    <button onclick="duplicateEvent('${eventId}')" class="neo-btn-sm bg-white dark:bg-slate-800 text-dark dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 flex-1 py-2 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors">
      <i data-lucide="copy" class="w-4 h-4"></i> Clone
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
      <button class="color-swatch ${c.hex === event.color ? 'active' : ''}" 
              style="background-color: ${c.hex}; color: ${c.hex}" 
              onclick="updateEventField('${event.id}', 'color', '${c.hex}'); renderDetailPanelOptions();" 
              title="${c.label}"></button>
    `).join('');
  }
}

function closeDetailPanel() {
  detailPanel.classList.remove('open');
  selectedEventId = null;
}

function updateEventField(id, field, value) {
  const event = events.find(e => e.id === id);
  if (event) {
    if (field === 'startTime' || field === 'endTime') {
       // Validate times
       let start = field === 'startTime' ? value : event.startTime;
       let end = field === 'endTime' ? value : event.endTime;
       
       if (timeToMinutes(start) >= timeToMinutes(end)) {
         showToast('End time must be after start time', 'warning');
         openDetailPanel(id); // reset UI
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
      event.color = newType.defaultColor; // auto switch color too
    }

    // Handle recurrence changes
    if (field === 'recurrence') {
        if (value === 'none') {
            // Remove future recurrences
            events = events.filter(e => !(e.isRecurrence && e.originalEventId === id));
        } else {
            // Re-generate recurrences (simplified: delete old, generate new)
             events = events.filter(e => !(e.isRecurrence && e.originalEventId === id));
             const endOfYear = new Date(event.date);
             endOfYear.setFullYear(endOfYear.getFullYear() + 1); // generate 1 year out
             const newRecurrences = generateRecurrences(event, new Date(event.date), endOfYear);
             events.push(...newRecurrences);
        }
    }
    
    saveData();
    renderCalendar();
    
    // Check if date changed to a different week, if so navigate
    if (field === 'date') {
      const evtDate = new Date(value);
      const weekStart = getMonday(evtDate);
      if (currentWeekStart.getTime() !== weekStart.getTime()) {
        currentWeekStart = weekStart;
        renderCalendar();
      }
    }
    
    // Re-render detail panel completely to reflect changes (e.g. type change updates UI)
    if(field === 'typeId' || field === 'recurrence' || field === 'checklist') openDetailPanel(id);
  }
}

/* ============================================
   9. Checklist Logic
   ============================================ */

function toggleChecklistItem(eventId, itemId) {
  const event = events.find(e => e.id === eventId);
  if (event) {
    const item = event.checklist.find(i => i.id === itemId);
    if (item) {
      item.done = !item.done;
      saveData();
      updateEventUI(eventId);
      openDetailPanel(eventId);
    }
  }
}

function updateChecklistText(eventId, itemId, text) {
  const event = events.find(e => e.id === eventId);
  if (event) {
    const item = event.checklist.find(i => i.id === itemId);
    if (item) {
      item.text = text;
      saveData();
    }
  }
}

function addChecklistItem(eventId) {
  const input = document.getElementById('new-checklist-input');
  const text = input.value.trim();
  if (!text) return;
  
  const event = events.find(e => e.id === eventId);
  if (event) {
    event.checklist.push({
      id: `chk_${Date.now()}`,
      text: text,
      done: false
    });
    saveData();
    renderCalendar();
    openDetailPanel(eventId);
  }
}

function deleteChecklistItem(eventId, itemId) {
  const event = events.find(e => e.id === eventId);
  if (event) {
    event.checklist = event.checklist.filter(i => i.id !== itemId);
    saveData();
    updateEventUI(eventId);
    openDetailPanel(eventId);
  }
}

function setLessonStatus(eventId, statusId) {
  const event = events.find(e => e.id === eventId);
  if (event) {
    if (!event.lessonPlan) {
        event.lessonPlan = { unit: '', lesson: '', status: 'draft' };
    }
    event.lessonPlan.status = statusId;
    saveData();
    updateEventUI(eventId);
    openDetailPanel(eventId);
  }
}

function updateLessonField(eventId, field, value) {
  const event = events.find(e => e.id === eventId);
  if (event) {
    if (!event.lessonPlan) {
        event.lessonPlan = { unit: '', lesson: '', status: 'draft' };
    }
    event.lessonPlan[field] = value;
    saveData();
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

  const recurrenceOptions = RECURRENCE_OPTIONS.map(r => `
    <option value="${r.id}" ${eventObj && eventObj.recurrence === r.id ? 'selected' : ''}>${r.label}</option>
  `).join('');
  
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
          
          <div>
            <label class="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1">Recurrence</label>
            <select id="modal-recurrence" class="panel-input">
              ${recurrenceOptions}
            </select>
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
      evt.notes = notes;
      evt.updatedAt = new Date().toISOString();
    }
  } else {
    // Create new
    const newEvt = createEventObject({
      name, typeId, colorHex: color, date, startTime: start, endTime: end, room, notes, recurrence
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
  currentWeekStart.setDate(currentWeekStart.getDate() + 7);
  renderCalendar();
  updateStats();
}

function goToPrevWeek() {
  currentWeekStart.setDate(currentWeekStart.getDate() - 7);
  renderCalendar();
  updateStats();
}

function goToToday() {
  currentWeekStart = getMonday(new Date());
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

function showWeekendToggle() {
  showWeekends = !showWeekends;
  document.getElementById('weekend-label').textContent = showWeekends ? '7 days' : '5 days';
  renderCalendar();
}

/* ============================================
   12. Utilities & Toast
   ============================================ */

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
      closeEventModal();
      closeDetailPanel();
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

// Start
document.addEventListener('DOMContentLoaded', init);
