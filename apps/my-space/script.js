/* ============================================
   DASHBOARD SCRIPT — My Space Landing Page
   ============================================ */

const State = {
  isPro: false,
  schedule: [],
  tasks: [],
  admin: {},
  classData: {},
  redDays: []
};

function init() {
  checkPro();
  loadData();
  renderAll();
  lucide.createIcons();
  
  // Update current date display
  const dateEl = document.getElementById('widget-date');
  if (dateEl) {
    const now = new Date();
    dateEl.textContent = now.toLocaleDateString('en-US', { 
      month: 'long', day: 'numeric', year: 'numeric' 
    });
  }
}

function checkPro() {
  // Try to get pro status from parent
  if (window.parent && window.parent.State) {
    State.isPro = window.parent.State.isPro();
  } else {
    // Fallback/Sandbox check
    const user = JSON.parse(localStorage.getItem('kk_user_profile') || '{}');
    State.isPro = user.role === 'pro' || user.role === 'admin';
  }

  // NOTE: We used to hide things here, but now we keep them visible as requested.
  // document.querySelectorAll('.pro-only-btn, .pro-only-widget').forEach(el => el.classList.remove('hidden'));
}

function loadData() {
  // Load Schedule
  const scheduleRaw = localStorage.getItem('schedule_events');
  if (scheduleRaw) {
    try {
      const masters = JSON.parse(scheduleRaw);
      // We need to generate recurrences to find today's classes
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const rangeStart = new Date(today);
      const rangeEnd = new Date(today);
      rangeEnd.setDate(today.getDate() + 1);

      let allEvents = [...masters];
      masters.forEach(m => {
        if (m.recurrence && m.recurrence !== 'none') {
          // Simplistic recurrence generation for the dashboard
          const clones = generateBasicRecurrences(m, today);
          allEvents = [...allEvents, ...clones];
        }
      });
      State.schedule = allEvents;
    } catch (e) { console.error('Schedule load error', e); }
  }

  // Load Red Days
  const redDaysRaw = localStorage.getItem('schedule_red_days');
  if (redDaysRaw) {
    try { State.redDays = JSON.parse(redDaysRaw); } catch(e) {}
  }

  // Load Tasks
  const tasksRaw = localStorage.getItem('klasskit_tasks');
  if (tasksRaw) {
    try { State.tasks = JSON.parse(tasksRaw); } catch(e) {}
  }

  // Load Admin
  const adminRaw = localStorage.getItem('schedule_class_admin');
  if (adminRaw) {
    try { State.admin = JSON.parse(adminRaw); } catch(e) {}
  }

  // Load Class Data
  const classRaw = localStorage.getItem('prog_my-class');
  if (classRaw) {
    try { State.classData = JSON.parse(classRaw); } catch(e) {}
  }
}

function generateBasicRecurrences(m, today) {
  const mDate = new Date(m.date + 'T00:00:00');
  if (mDate > today) return []; // Master is in the future

  const todayStr = getDayStr(today);
  if (m.date === todayStr) return []; // Master is already for today

  if (m.recurrence === 'weekly') {
    if (mDate.getDay() === today.getDay()) {
      return [{ ...m, date: todayStr, isRecurrence: true }];
    }
  }
  
  if (m.recurrence === 'daily') {
    return [{ ...m, date: todayStr, isRecurrence: true }];
  }

  if (m.recurrence === 'custom-days' && m.recurrenceDays) {
    const day = today.getDay();
    const dayIndex = day === 0 ? 6 : day - 1; // Mon=0, Sun=6
    if (m.recurrenceDays.includes(dayIndex)) {
      return [{ ...m, date: todayStr, isRecurrence: true }];
    }
  }
  
  return [];
}

function getDayStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function renderAll() {
  renderSchedule();
  renderTasks();
  renderAdmin();
  renderClass();
}

function renderSchedule() {
  const container = document.getElementById('schedule-widget-content');
  if (!container) return;

  const todayStr = getDayStr(new Date());
  const isRedDay = State.redDays.includes(todayStr);

  const todayEvents = State.schedule
    .filter(e => e.date === todayStr)
    .filter(e => !(isRedDay && e.isRecurrence)) // Skip recurrences on holidays
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  if (todayEvents.length === 0) {
    container.innerHTML = `
      <div class="flex flex-col items-center justify-center h-full py-12 text-slate-400">
        <i data-lucide="calendar-x" class="w-12 h-12 mb-4 opacity-20"></i>
        <p class="font-bold text-sm uppercase tracking-widest">${isRedDay ? 'Holiday / Off Day' : 'No classes scheduled'}</p>
        <p class="text-[10px] font-bold mt-1">Enjoy your free time!</p>
      </div>
    `;
  } else {
    container.innerHTML = todayEvents.map(evt => `
      <div class="schedule-item group">
        <div class="time-slot">
          <div class="text-[11px]">${formatTime(evt.startTime)}</div>
          <div class="opacity-40 text-[9px] uppercase">${formatTime(evt.endTime)}</div>
        </div>
        <div class="w-1 self-stretch rounded-full" style="background-color: ${evt.color}"></div>
        <div class="class-info">
          <div class="class-name" style="color: ${evt.color}">${evt.name}</div>
          <div class="class-meta">
            <span class="flex items-center gap-1"><i data-lucide="map-pin" class="w-2.5 h-2.5"></i> ${evt.room || 'No Room'}</span>
            <span class="opacity-50">•</span>
            <span class="flex items-center gap-1 uppercase">${evt.typeId || 'class'}</span>
          </div>
        </div>
        <button onclick="window.parent.MySpace.loadApp('schedule')" class="p-2 rounded-lg bg-slate-50 dark:bg-slate-800 opacity-0 group-hover:opacity-100 transition-opacity">
          <i data-lucide="external-link" class="w-3.5 h-3.5 text-slate-400"></i>
        </button>
      </div>
    `).join('');
  }
  lucide.createIcons({ root: container });
}

function renderTasks() {
  const container = document.getElementById('tasks-widget-content');
  if (!container) return;

  const incompleteTasks = State.tasks
    .filter(t => !t.completed)
    .sort((a, b) => {
      const prioOrder = { high: 0, medium: 1, low: 2 };
      return (prioOrder[a.priority] || 1) - (prioOrder[b.priority] || 1);
    })
    .slice(0, 5);

  if (incompleteTasks.length === 0) {
    container.innerHTML = `
      <div class="flex flex-col items-center justify-center py-8 text-slate-400 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-2xl">
        <i data-lucide="check-circle-2" class="w-8 h-8 mb-2 text-green opacity-40"></i>
        <p class="font-bold text-[10px] uppercase tracking-widest">All caught up!</p>
      </div>
    `;
  } else {
    container.innerHTML = incompleteTasks.map(t => {
      const colors = { high: 'bg-pink', medium: 'bg-orange', low: 'bg-blue' };
      const textColors = { high: 'text-pink', medium: 'text-orange', low: 'text-blue' };
      const dotColor = colors[t.priority] || 'bg-slate-400';
      const textColor = textColors[t.priority] || 'text-slate-400';
      
      return `
        <div class="dashboard-task-item group cursor-pointer" onclick="window.parent.MySpace.loadApp('tasks')">
          <div class="task-dot ${dotColor}"></div>
          <div class="task-text text-dark dark:text-slate-200">${t.text}</div>
          <div class="task-prio ${textColor} bg-opacity-10 ${dotColor.replace('bg-', 'bg-')} bg-clip-padding" style="background-color: transparent; border: 1px solid currentColor;">
            ${t.priority}
          </div>
        </div>
      `;
    }).join('');
  }
}

function renderAdmin() {
  const container = document.getElementById('admin-widget-content');
  if (!container) return;

  // Find classes with incomplete tasks or planning
  const alerts = [];
  Object.entries(State.admin).forEach(([className, tasks]) => {
    const pending = tasks.filter(t => !t.done).length;
    if (pending > 0) {
      alerts.push({ name: className, pending });
    }
  });

  if (alerts.length === 0) {
    container.innerHTML = `
      <div class="flex items-center gap-4 p-4 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-800 text-slate-400">
        <i data-lucide="check-circle-2" class="w-6 h-6 text-green"></i>
        <p class="text-sm font-bold">All class planning is up to date!</p>
      </div>
    `;
  } else {
    container.innerHTML = alerts.slice(0, 3).map(a => `
      <div class="flex items-center justify-between p-3 mb-2 rounded-xl bg-blue/5 border-2 border-blue/10 hover:border-blue/30 transition-colors cursor-pointer" onclick="window.parent.MySpace.loadApp('admin-tracker')">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-lg bg-blue text-white flex items-center justify-center">
            <i data-lucide="clipboard-list" class="w-4 h-4"></i>
          </div>
          <div>
            <div class="text-sm font-black text-slate-700 dark:text-slate-200">${a.name}</div>
            <div class="text-[10px] font-bold text-blue uppercase tracking-tight">${a.pending} items pending</div>
          </div>
        </div>
        <i data-lucide="chevron-right" class="w-4 h-4 text-blue"></i>
      </div>
    `).join('');
    lucide.createIcons({ root: container });
  }
}

function renderClass() {
  const container = document.getElementById('class-widget-content');
  if (!container) return;

  const classes = State.classData.classes || {};
  const classList = Object.keys(classes);

  if (classList.length === 0) {
     container.innerHTML = `
      <div class="p-8 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border-2 border-dashed border-slate-200 dark:border-slate-700 text-center flex flex-col items-center gap-3">
        <i data-lucide="users" class="w-8 h-8 text-slate-300"></i>
        <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-relaxed">No students tracked yet.<br>Start managing your classes!</p>
        <button onclick="window.parent.MySpace.loadApp('my-class')" class="btn-chunky bg-green text-white text-[9px] px-4 py-1.5 rounded-lg mt-2 uppercase font-black">Open My Class</button>
      </div>
     `;
     lucide.createIcons({ root: container });
     return;
  }

  // Find class with most reflections or students
  let totalStudents = 0;
  let totalReflections = 0;
  let topStudent = null;
  let maxStars = -1;

  classList.forEach(c => {
    const data = classes[c];
    totalStudents += data.students?.length || 0;
    totalReflections += data.reflections?.length || 0;
    
    (data.students || []).forEach(s => {
      if ((s.stars || 0) > maxStars) {
        maxStars = s.stars || 0;
        topStudent = { ...s, className: c };
      }
    });
  });

  container.innerHTML = `
    <div class="space-y-4">
      <div class="grid grid-cols-2 gap-3">
        <div class="p-4 rounded-2xl bg-blue/5 border-2 border-blue/10">
          <div class="text-xl font-black text-blue">${totalStudents}</div>
          <div class="text-[9px] font-bold text-slate-400 uppercase tracking-tight">Total Students</div>
        </div>
        <div class="p-4 rounded-2xl bg-pink/5 border-2 border-pink/10">
          <div class="text-xl font-black text-pink">${totalReflections}</div>
          <div class="text-[9px] font-bold text-slate-400 uppercase tracking-tight">Reflections</div>
        </div>
      </div>
      
      ${topStudent ? `
        <div class="p-4 rounded-2xl bg-orange/5 border-2 border-orange/10 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-orange text-white flex items-center justify-center font-black">
              ${(topStudent.nick || topStudent.name).charAt(0)}
            </div>
            <div>
              <div class="text-xs font-black text-slate-700 dark:text-slate-200">${topStudent.nick || topStudent.name}</div>
              <div class="text-[9px] font-bold text-orange uppercase tracking-tight">${topStudent.className}</div>
            </div>
          </div>
          <div class="text-right">
            <div class="text-xs font-black text-orange flex items-center gap-1">
              ${topStudent.stars || 0} <i data-lucide="star" class="w-3 h-3 fill-orange"></i>
            </div>
            <div class="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Top Student</div>
          </div>
        </div>
      ` : ''}

      <div class="p-4 rounded-2xl bg-green/5 border-2 border-green/20 hover:border-green/40 transition-colors cursor-pointer group" onclick="window.parent.MySpace.loadApp('my-class')">
        <div class="flex justify-between items-center mb-3">
          <span class="text-xs font-black text-green uppercase tracking-widest">Recent Classes</span>
          <i data-lucide="arrow-right" class="w-3 h-3 text-green group-hover:translate-x-1 transition-transform"></i>
        </div>
        <div class="space-y-2">
          ${classList.slice(0, 2).map(c => `
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-slate-600 dark:text-slate-400">${c}</span>
              <span class="text-[10px] font-bold text-slate-400">${classes[c].students?.length || 0} Students</span>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
  lucide.createIcons({ root: container });
}

function formatTime(timeStr) {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':');
  let hours = parseInt(h);
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  return `${hours}:${m} ${ampm}`;
}

function toggleDarkMode() {
  const isDark = document.documentElement.classList.toggle('dark');
  localStorage.setItem("theme_myspace-home", isDark ? "dark" : "light");
  const icon = document.getElementById('darkModeIcon');
  if (icon) {
    icon.setAttribute('data-lucide', isDark ? 'sun' : 'moon');
    lucide.createIcons({ nodes: [icon] });
  }
  // Try to toggle parent theme too for consistency
  if (window.parent && window.parent.Theme) {
    const parentDark = document.documentElement.classList.contains('dark');
    const parentIsDark = window.parent.document.documentElement.classList.contains('dark');
    if (parentDark !== parentIsDark) window.parent.Theme.toggle();
  }
}

// Initial Run
window.addEventListener('load', init);
window.addEventListener('storage', () => {
  loadData();
  renderAll();
});
