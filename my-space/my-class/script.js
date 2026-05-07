/**
 * MY CLASS — Student & Progress Manager
 * ------------------------------------
 * Core logic for tracking students and class reflections.
 */

const ClassManager = {
  activeClass: null,
  classes: [], // List of classes from schedule
  data: {
    classes: {} // Per-class storage { "Class Name": { students: [], reflections: [] } }
  },

  async init() {
    if (typeof requireAuth === 'function') await requireAuth();

    // 1. Fetch Cloud Data if applicable
    if (window.Sync && !isSandbox()) {
      const user = await getUser();
      if (user) {
        console.info('[MyClass] Fetching cloud data...');
        await Sync.loadFromCloud(user.id);
      }
    }

    // 2. Load Data from Local (which now has cloud data if sync worked)
    await this.loadData();
    
    // 2. Fetch Classes from Schedule
    this.fetchClassesFromSchedule();
    
    // 3. Setup UI
    this.renderClassSelectors();
    this.setupSelectorSync();
    
    // 4. Initial state
    const lastClass = localStorage.getItem('kk_myclass_last_selected');
    if (lastClass && this.classes.some(c => c.name === lastClass)) {
      this.selectClass(lastClass);
    } else {
      this.updateUI();
    }

    // 5. Icons
    if (window.lucide) lucide.createIcons();
    
    // 6. Sync Badge
    this.updateSyncBadge();

    // 7. Keyboard Listeners
    this.setupKeyboardShortcuts();

    // 8. Global Listeners
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') ModalManager.closeAll();
    });

    // 9. Sync Listener
    window._syncRerender = () => {
      console.log('[MyClass] Sync re-render triggered');
      this.loadData().then(() => {
        this.fetchClassesFromSchedule();
        this.renderClassSelectors();
        this.updateUI();
      });
    };
  },

  setupKeyboardShortcuts() {
    // Student Form
    const studentInputs = ['studentNameInput', 'studentNickInput'];
    studentInputs.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') StudentManager.save();
        });
      }
    });

    // Skill Form
    const skillInput = document.getElementById('skillNameInput');
    if (skillInput) {
      skillInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') SkillsManager.saveSkill();
      });
    }
  },

  async loadData() {
    const local = localStorage.getItem('prog_my-class');
    if (local) {
      try {
        this.data = JSON.parse(local);
      } catch (e) {
        console.error('[MyClass] Failed to parse local data', e);
      }
    }

    // Structure check
    if (!this.data || !this.data.classes) {
      this.data = { classes: {} };
    }
  },

  async saveData() {
    // Local backup
    localStorage.setItem('prog_my-class', JSON.stringify(this.data));
    
    // Trigger bulk sync if available
    if (window.Sync && !isSandbox()) {
      const user = await getUser();
      if (user) {
        console.info('[MyClass] Triggering cloud sync...');
        await Sync.syncToCloud(user.id);
      }
    }
    
    this.updateSyncBadge();
  },

  fetchClassesFromSchedule() {
    const mastersRaw = localStorage.getItem('schedule_events');
    if (!mastersRaw) return;
    
    try {
      const masters = JSON.parse(mastersRaw);
      const classMap = {};
      
      masters.forEach(evt => {
        if (evt.typeId === 'class' && evt.name) {
          if (!classMap[evt.name]) {
            classMap[evt.name] = {
              name: evt.name,
              color: evt.color || '#1ea7fd',
              events: []
            };
          }
          
          // Add the master event
          classMap[evt.name].events.push(evt);

          // Generate recurrences for the next 30 days to find upcoming sessions
          if (evt.recurrence && evt.recurrence !== 'none' && window.Sync) {
            const rangeStart = new Date();
            const rangeEnd = new Date();
            rangeEnd.setDate(rangeEnd.getDate() + 30); // 1 month ahead
            
            const clones = Sync.generateRecurrences(evt, rangeStart, rangeEnd);
            classMap[evt.name].events.push(...clones);
          }
        }
      });
      
      // Filter out recurrence clones that fall on red days
      const redDays = JSON.parse(localStorage.getItem('schedule_red_days') || '[]');
      Object.values(classMap).forEach(c => {
        c.events = c.events.filter(e => !(e.isRecurrence && redDays.includes(e.date)));
      });

      this.classes = Object.values(classMap).sort((a, b) => a.name.localeCompare(b.name));
    } catch (e) {
      console.error('[MyClass] Failed to fetch classes from schedule', e);
    }
  },

  renderClassSelectors() {
    const selectors = [
      document.getElementById('classSelector'),
      document.getElementById('classSelectorMobile')
    ];

    selectors.forEach(sel => {
      if (!sel) return;
      sel.innerHTML = '<option value="">Select a class...</option>' + 
        this.classes.map(c => `<option value="${c.name}" ${this.activeClass === c.name ? 'selected' : ''}>${c.name}</option>`).join('');
    });
  },

  setupSelectorSync() {
    const desktop = document.getElementById('classSelector');
    const mobile = document.getElementById('classSelectorMobile');
    
    if (desktop && mobile) {
      desktop.addEventListener('change', (e) => {
        mobile.value = e.target.value;
        this.selectClass(e.target.value);
      });
      mobile.addEventListener('change', (e) => {
        desktop.value = e.target.value;
        this.selectClass(e.target.value);
      });
    }
  },

  selectClass(className) {
    if (!className) {
      this.activeClass = null;
      localStorage.removeItem('kk_myclass_last_selected');
    } else {
      this.activeClass = className;
      localStorage.setItem('kk_myclass_last_selected', className);
      
      // Initialize data structure for this class if not exists
      if (!this.data.classes[className]) {
        this.data.classes[className] = {
          students: [],
          reflections: [],
          attendance: {},
          skills: [],
          studentSkills: {}
        };
      }
      // Ensure existing classes have new fields
      const cd = this.data.classes[className];
      if (!cd.attendance) cd.attendance = {};
      if (!cd.skills) cd.skills = [];
      if (!cd.studentSkills) cd.studentSkills = {};
    }
    
    this.renderClassSelectors();
    this.updateUI();
    if (window.lucide) lucide.createIcons();
    
    // Persistence: Trigger save so the cloud remembers our landing state
    this.saveData();
  },

  updateUI() {
    const noClass = document.getElementById('noClassState');
    const workspace = document.getElementById('classWorkspace');
    
    if (!this.activeClass) {
      noClass.classList.remove('hidden');
      workspace.classList.add('hidden');
      document.getElementById('backToGridBtn').classList.add('hidden');
      this.renderClassCards();
      return;
    }

    noClass.classList.add('hidden');
    workspace.classList.remove('hidden');
    document.getElementById('backToGridBtn').classList.remove('hidden');

    // Header Info
    const classInfo = this.classes.find(c => c.name === this.activeClass);
    document.getElementById('classNameDisplay').textContent = this.activeClass;
    document.getElementById('classAvatar').textContent = this.activeClass.charAt(0);
    document.getElementById('classHeaderColor').style.backgroundColor = classInfo?.color || '#1ea7fd';
    
    const classData = this.data.classes[this.activeClass];
    document.getElementById('studentCountBadge').textContent = `${classData.students.length} Students`;
    document.getElementById('reflectionCountBadge').textContent = `${classData.reflections.length} Reflections`;
    
    this.updateNextSession();
    
    // Render current tab
    TabManager.render();
  },

  renderClassCards() {
    const grid = document.getElementById('classGridLanding');
    const empty = document.getElementById('noScheduleState');
    if (!grid) return;

    if (this.classes.length === 0) {
      grid.classList.add('hidden');
      empty.classList.remove('hidden');
      return;
    }

    empty.classList.add('hidden');
    grid.classList.remove('hidden');

    grid.innerHTML = this.classes.map(c => {
      const classData = this.data.classes[c.name] || { students: [], reflections: [] };
      const studentCount = classData.students?.length || 0;
      const reflectionCount = classData.reflections?.length || 0;

      return `
        <div onclick="ClassManager.selectClass('${c.name.replace(/'/g, "\\'")}')" class="group bg-white dark:bg-slate-900/40 border-[var(--border-width-thick)] border-[var(--border-primary)] rounded-3xl p-6 shadow-neo hover:-translate-y-1 hover:shadow-neo dark:hover:shadow-neo transition-all duration-300 ease-out cursor-pointer relative overflow-hidden">
          <div class="flex items-start justify-between mb-6">
            <div class="w-12 h-12 rounded-xl flex items-center justify-center text-white border-[var(--border-width-thick)] border-[var(--border-primary)] shadow-neo-sm group-hover:scale-105 transition-transform" style="background: ${c.color}">
              <span class="font-heading font-bold text-xl uppercase">${c.name.charAt(0)}</span>
            </div>
            <div class="text-right">
              <span class="text-[9px] font-black text-slate-400 uppercase tracking-widest">Enrolled</span>
              <div class="text-lg font-black text-slate-800 dark:text-white leading-none">${studentCount}</div>
            </div>
          </div>
          
          <h3 class="font-heading font-bold text-xl text-slate-900 dark:text-white uppercase tracking-tight mb-4">${c.name}</h3>
          
          <div class="flex items-center justify-between pt-4 border-t-[var(--border-width-thick)] border-[var(--bg-tertiary)] dark:border-slate-800">
            <div class="flex items-center gap-1.5">
              <i data-lucide="message-square" class="w-3.5 h-3.5 text-orange"></i>
              <span class="text-[10px] font-bold text-slate-500">${reflectionCount} Notes</span>
            </div>
            <span class="text-[9px] font-black uppercase text-blue group-hover:translate-x-1 transition-transform">View Class →</span>
          </div>
        </div>
      `;
    }).join('');

    if (window.lucide) lucide.createIcons({ root: grid });
  },

  updateNextSession() {
    const badge = document.getElementById('nextSessionBadge');
    const classInfo = this.classes.find(c => c.name === this.activeClass);
    if (!classInfo) return;

    const today = new Date().toISOString().split('T')[0];
    const upcoming = classInfo.events
      .filter(e => e.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date))[0];

    if (upcoming) {
      const d = new Date(upcoming.date);
      const fmt = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      document.getElementById('nextSessionText').textContent = `${fmt} @ ${upcoming.startTime}`;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  },

  updateSyncBadge() {
    if (window.Sync) {
      const state = isSandbox() ? 'local' : 'synced';
      Sync.setSyncBadge(state);
    }
  },

  openAddStudent() {
    StudentManager.setEntryMode('single');
    ModalManager.open('studentModal');
    setTimeout(() => document.getElementById('studentNameInput').focus(), 100);
  }
};

const TabManager = {
  current: 'stats',

  switch(tabId) {
    this.current = tabId;
    
    // UI Update
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.id === `tab-${tabId}`);
    });

    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.toggle('hidden', content.id !== `content-${tabId}`);
    });

    this.render();
    if (window.lucide) lucide.createIcons();
  },

  render() {
    switch (this.current) {
      case 'students': StudentManager.render(); break;
      case 'attendance': AttendanceManager.render(); break;
      case 'skills': SkillsManager.render(); break;
      case 'reflections': ReflectionManager.render(); break;
      case 'sessions': SessionManager.render(); break;
      case 'stats': StatsManager.render(); break;
    }
    if (window.lucide) lucide.createIcons();
  }
};

const StudentManager = {
  entryMode: 'single',

  copyToClipboard() {
    const classData = ClassManager.data.classes[ClassManager.activeClass];
    if (!classData || !classData.students || classData.students.length === 0) {
      UI.showToast('No students to copy', 'warning');
      return;
    }
    
    const namesString = classData.students
      .map(s => s.name || '')
      .filter(name => name.trim() !== '')
      .join(',');
    
    navigator.clipboard.writeText(namesString).then(() => {
      UI.showToast('Student names copied as CSV!', 'success');
    }).catch(err => {
      console.error('Failed to copy text: ', err);
      UI.showToast('Failed to copy to clipboard', 'error');
    });
  },

  render() {
    const grid = document.getElementById('studentGrid');
    const empty = document.getElementById('noStudentsState');
    const classData = ClassManager.data.classes[ClassManager.activeClass];
    
    if (!classData || classData.students.length === 0) {
      grid.innerHTML = '';
      empty.classList.remove('hidden');
      return;
    }

    empty.classList.add('hidden');
    grid.innerHTML = classData.students.map(s => {
      // Calculate Attendance stats
      const attendanceEntries = Object.entries(classData.attendance || {});
      const studentAttendance = attendanceEntries.filter(([date, list]) => list.includes(s.id));
      const totalSessions = attendanceEntries.length;
      const attendancePct = totalSessions > 0 ? Math.round((studentAttendance.length / totalSessions) * 100) : 0;
      
      // Calculate Last 4 Weeks Absences
      const fourWeeksAgo = new Date();
      fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
      const recentAbsences = attendanceEntries.filter(([date, list]) => {
        return date >= fourWeeksAgo.toISOString().split('T')[0] && !list.includes(s.id);
      }).length;

      // Calculate Skill stats
      const studentSkills = classData.studentSkills?.[s.id] || {};
      const skillValues = Object.values(studentSkills);
      const avgSkill = skillValues.length > 0 ? (skillValues.reduce((a, b) => a + b, 0) / skillValues.length).toFixed(1) : '—';
      const lowSkills = Object.entries(studentSkills)
        .filter(([id, val]) => val > 0 && val <= 2)
        .map(([id, val]) => classData.skills.find(sk => sk.id === id)?.name)
        .filter(Boolean);

      // Warning Logic
      const warnings = [];
      if (recentAbsences >= 2) warnings.push(`Missed ${recentAbsences} sessions in 4w`);
      if (lowSkills.length > 0) warnings.push(`Low: ${lowSkills.slice(0, 2).join(', ')}${lowSkills.length > 2 ? '...' : ''}`);

      return `
      <div class="student-card border-[var(--border-width-thick)] border-[var(--border-primary)] rounded-2xl p-5 bg-white dark:bg-slate-900/50 shadow-neo-sm hover:-translate-y-1 transition-transform relative overflow-hidden">
        ${warnings.length > 0 ? `
          <div class="absolute top-0 right-0 p-1.5 flex gap-1">
            ${warnings.map(w => `
              <div class="bg-pink text-white text-[8px] font-black px-2 py-0.5 rounded-full uppercase shadow-neo-sm flex items-center gap-1">
                <i data-lucide="alert-triangle" class="w-2.5 h-2.5"></i> ${w}
              </div>
            `).join('')}
          </div>
        ` : ''}
        
        <div class="flex items-center justify-between mb-4 mt-2">
          <div class="flex items-center gap-3">
            <div class="w-12 h-12 bg-blue/10 rounded-xl flex items-center justify-center text-blue font-black text-xl border-[3px] border-blue/20">
              ${(s.nick || s.name).charAt(0)}
            </div>
            <div>
              <h4 class="font-heading font-bold text-lg leading-none text-slate-800 dark:text-white">${s.nick || s.name}</h4>
              <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">${s.nick ? s.name : 'No Nickname'}</p>
            </div>
          </div>
          <div class="flex items-center gap-1">
            <button onclick="StudentManager.edit('${s.id}')" class="p-1.5 text-slate-400 hover:text-blue transition-colors">
              <i data-lucide="edit-3" class="w-4 h-4"></i>
            </button>
            <button onclick="StudentManager.delete('${s.id}')" class="p-1.5 text-slate-400 hover:text-pink transition-colors">
              <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
          </div>
        </div>
        
        <div class="grid grid-cols-2 gap-3 mb-4">
          <div class="bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700">
            <div class="flex items-center gap-1.5 mb-1">
              <i data-lucide="clipboard-check" class="w-3 h-3 text-green"></i>
              <span class="text-[9px] font-black text-slate-400 uppercase tracking-wider">Attendance</span>
            </div>
            <div class="flex items-end justify-between">
              <span class="font-heading font-bold text-lg text-slate-800 dark:text-white leading-none">${attendancePct}%</span>
              <span class="text-[9px] font-bold text-slate-400">${studentAttendance.length}/${totalSessions}</span>
            </div>
          </div>
          <div class="bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700">
            <div class="flex items-center gap-1.5 mb-1">
              <i data-lucide="target" class="w-3 h-3 text-blue"></i>
              <span class="text-[9px] font-black text-slate-400 uppercase tracking-wider">Skills Avg</span>
            </div>
            <div class="flex items-end justify-between">
              <span class="font-heading font-bold text-lg text-slate-800 dark:text-white leading-none">${avgSkill}</span>
              <span class="text-[9px] font-bold text-slate-400">${skillValues.length} Rated</span>
            </div>
          </div>
        </div>

        <div class="space-y-4">
          <div class="flex items-center justify-between">
             <span class="text-[10px] font-black uppercase text-slate-400 tracking-widest">Progress Stars</span>
             <div class="flex items-center gap-1">
               <button onclick="StudentManager.updateStars('${s.id}', -1)" class="w-6 h-6 rounded-md bg-slate-100 dark:bg-slate-800 border border-[var(--border-secondary)] dark:border-slate-600 flex items-center justify-center text-slate-500 hover:bg-slate-200">-</button>
               <span class="w-8 text-center font-black text-blue">${s.stars || 0}</span>
               <button onclick="StudentManager.updateStars('${s.id}', 1)" class="w-6 h-6 rounded-md bg-blue text-white border border-blue/30 flex items-center justify-center hover:brightness-110">+</button>
             </div>
          </div>
          
          <div class="h-px bg-slate-100 dark:bg-slate-800"></div>
          
          <div class="space-y-1">
            <span class="text-[10px] font-black uppercase text-slate-400 tracking-widest">Teacher Notes</span>
            <p class="text-[11px] font-semibold text-slate-600 dark:text-slate-400 line-clamp-2 italic leading-relaxed">
              ${s.notes || 'No notes yet. Click edit to add notes about learning style or progress.'}
            </p>
          </div>
        </div>
      </div>
    `;
    }).join('');
    
    if (window.lucide) lucide.createIcons({ root: grid });
  },

  setEntryMode(mode) {
    this.entryMode = mode;
    const isSingle = mode === 'single';
    
    document.getElementById('form-single').classList.toggle('hidden', !isSingle);
    document.getElementById('form-bulk').classList.toggle('hidden', isSingle);
    
    document.getElementById('mode-single').className = isSingle ? 'flex-1 py-2.5 rounded-xl font-black text-[10px] uppercase transition-all bg-blue text-white shadow-neo-sm' : 'flex-1 py-2.5 rounded-xl font-black text-[10px] uppercase transition-all text-slate-400';
    document.getElementById('mode-bulk').className = !isSingle ? 'flex-1 py-2.5 rounded-xl font-black text-[10px] uppercase transition-all bg-blue text-white shadow-neo-sm' : 'flex-1 py-2.5 rounded-xl font-black text-[10px] uppercase transition-all text-slate-400';
    
    document.getElementById('saveStudentBtn').textContent = isSingle ? 'Add Student' : 'Add Students';
  },

  save() {
    if (this.entryMode === 'bulk') {
      this.saveBulk();
    } else {
      this.saveSingle();
    }
  },

  saveSingle() {
    const name = document.getElementById('studentNameInput').value.trim();
    const nick = document.getElementById('studentNickInput').value.trim();
    
    if (!name) return;
    
    const newStudent = {
      id: crypto.randomUUID(),
      name,
      nick,
      stars: 0,
      notes: '',
      joinedAt: new Date().toISOString()
    };
    
    this.addStudentToData(newStudent);
    
    // Clear inputs
    document.getElementById('studentNameInput').value = '';
    document.getElementById('studentNickInput').value = '';
    
    this.finalizeSave();
  },

  saveBulk() {
    const bulkText = document.getElementById('studentBulkInput').value.trim();
    if (!bulkText) return;

    const names = bulkText.split('\n').map(n => n.trim()).filter(n => n !== '');
    if (names.length === 0) return;

    names.forEach(name => {
      const newStudent = {
        id: crypto.randomUUID(),
        name,
        nick: '',
        stars: 0,
        notes: '',
        joinedAt: new Date().toISOString()
      };
      this.addStudentToData(newStudent);
    });

    // Clear input
    document.getElementById('studentBulkInput').value = '';
    
    this.finalizeSave();
  },

  addStudentToData(student) {
    const classData = ClassManager.data.classes[ClassManager.activeClass];
    if (!classData.students) classData.students = [];
    classData.students.push(student);
  },

  finalizeSave() {
    ClassManager.saveData();
    ModalManager.closeAll();
    ClassManager.updateUI();
    UI.showToast('Students added successfully!', 'success');
  },

  delete(id) {
    if (!confirm('Are you sure you want to remove this student?')) return;
    
    const classData = ClassManager.data.classes[ClassManager.activeClass];
    classData.students = classData.students.filter(s => s.id !== id);
    
    ClassManager.saveData();
    this.render();
    ClassManager.updateUI();
    UI.showToast('Student removed', 'info');
  },

  updateStars(id, delta) {
    const classData = ClassManager.data.classes[ClassManager.activeClass];
    const student = classData.students.find(s => s.id === id);
    if (student) {
      student.stars = Math.max(0, (student.stars || 0) + delta);
      ClassManager.saveData();
      this.render();
    }
  },

  edit(id) {
    const classData = ClassManager.data.classes[ClassManager.activeClass];
    const student = classData.students.find(s => s.id === id);
    if (!student) return;
    
    const newNotes = prompt('Edit notes for ' + (student.nick || student.name), student.notes);
    if (newNotes !== null) {
      student.notes = newNotes;
      ClassManager.saveData();
      this.render();
    }
  }
};

const ReflectionManager = {
  currentStep: 0,
  STEPS: ['description', 'feelings', 'evaluation', 'analysis', 'conclusion', 'action'],
  STEP_LABELS: ['Description', 'Feelings', 'Evaluation', 'Analysis', 'Conclusion', 'Action Plan'],
  STEP_COLORS: ['blue', 'pink', 'green', 'orange', 'blue', 'pink'],
  editingId: null,

  render() {
    const list = document.getElementById('reflectionList');
    const empty = document.getElementById('noReflectionsState');
    const classData = ClassManager.data.classes[ClassManager.activeClass];
    
    if (!classData || classData.reflections.length === 0) {
      list.innerHTML = '';
      empty.classList.remove('hidden');
      return;
    }

    empty.classList.add('hidden');
    list.innerHTML = classData.reflections
      .sort((a, b) => b.date.localeCompare(a.date))
      .map(r => {
        // Build Gibbs stages display
        const stages = this.STEPS.map((key, i) => {
          const val = r[key] || r.gibbs?.[key] || '';
          if (!val) return '';
          return `
            <div class="space-y-1">
              <div class="flex items-center gap-2">
                <span class="w-5 h-5 rounded-md bg-${this.STEP_COLORS[i]}/15 text-${this.STEP_COLORS[i]} flex items-center justify-center text-[9px] font-black">${i+1}</span>
                <span class="text-[10px] font-black uppercase tracking-widest text-${this.STEP_COLORS[i]}">${this.STEP_LABELS[i]}</span>
              </div>
              <p class="font-body font-semibold text-xs text-slate-600 dark:text-slate-400 whitespace-pre-wrap leading-relaxed pl-7">${val}</p>
            </div>
          `;
        }).filter(Boolean).join('');

        // Legacy fallback: if reflection has old "text" field
        const legacyText = (!stages && r.text) ? `<p class="font-body font-semibold text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">${r.text}</p>` : '';

        return `
        <div class="border-[var(--border-width-thick)] border-[var(--border-primary)] rounded-3xl p-6 shadow-neo-sm bg-white dark:bg-slate-900/40 relative hover:-translate-y-1 transition-transform">
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-3">
              <span class="px-3 py-1 bg-orange/15 text-orange border border-orange/20 rounded-lg font-black text-[10px] uppercase tracking-widest">Gibbs' Cycle</span>
              <span class="text-xs font-bold text-slate-400">${new Date(r.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span>
            </div>
            <div class="flex items-center gap-2">
              <button onclick="ReflectionManager.edit('${r.id}')" class="text-slate-400 hover:text-blue transition-colors">
                <i data-lucide="edit-3" class="w-4 h-4"></i>
              </button>
              <button onclick="ReflectionManager.delete('${r.id}')" class="text-slate-400 hover:text-pink transition-colors">
                <i data-lucide="trash-2" class="w-4 h-4"></i>
              </button>
            </div>
          </div>
          ${stages ? `<div class="space-y-3">${stages}</div>` : legacyText}
        </div>
      `;
      }).join('');
    
    if (window.lucide) lucide.createIcons({ root: list });
  },

  openNew() {
    this.editingId = null;
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('reflectionDateInput').value = today;
    this.STEPS.forEach(key => {
      const el = document.getElementById(`gibbs-${key}`);
      if (el) el.value = '';
    });
    this.goToStep(0);
    ModalManager.open('reflectionModal');
  },

  openForSession(date) {
    this.editingId = null;
    document.getElementById('reflectionDateInput').value = date;
    this.STEPS.forEach(key => {
      const el = document.getElementById(`gibbs-${key}`);
      if (el) el.value = '';
    });
    this.goToStep(0);
    ModalManager.open('reflectionModal');
  },

  edit(id) {
    const classData = ClassManager.data.classes[ClassManager.activeClass];
    const r = classData.reflections.find(ref => ref.id === id);
    if (!r) return;
    this.editingId = id;
    document.getElementById('reflectionDateInput').value = r.date;
    this.STEPS.forEach(key => {
      const el = document.getElementById(`gibbs-${key}`);
      if (el) el.value = r[key] || r.gibbs?.[key] || '';
    });
    this.goToStep(0);
    ModalManager.open('reflectionModal');
  },

  goToStep(step) {
    this.currentStep = step;
    // Show/hide panels
    for (let i = 0; i < 6; i++) {
      document.getElementById(`gibbs-step-${i}`).classList.toggle('hidden', i !== step);
    }
    // Update stepper buttons
    document.querySelectorAll('.gibbs-step-btn').forEach(btn => {
      const s = parseInt(btn.dataset.step);
      btn.classList.remove('active', 'completed');
      if (s === step) btn.classList.add('active');
      else if (s < step) {
        const key = this.STEPS[s];
        const val = document.getElementById(`gibbs-${key}`)?.value?.trim();
        if (val) btn.classList.add('completed');
      }
    });
    // Update nav buttons
    document.getElementById('gibbsPrevBtn').classList.toggle('hidden', step === 0);
    document.getElementById('gibbsNextBtn').classList.toggle('hidden', step === 5);
    document.getElementById('gibbsSaveBtn').classList.toggle('hidden', step !== 5);
  },

  nextStep() {
    if (this.currentStep < 5) this.goToStep(this.currentStep + 1);
  },

  prevStep() {
    if (this.currentStep > 0) this.goToStep(this.currentStep - 1);
  },

  save() {
    const date = document.getElementById('reflectionDateInput').value;
    if (!date) { UI.showToast('Please set a session date', 'error'); return; }
    
    const data = {};
    let hasContent = false;
    this.STEPS.forEach(key => {
      data[key] = document.getElementById(`gibbs-${key}`)?.value?.trim() || '';
      if (data[key]) hasContent = true;
    });
    
    if (!hasContent) { UI.showToast('Please fill in at least one stage', 'error'); return; }
    
    const classData = ClassManager.data.classes[ClassManager.activeClass];

    if (this.editingId) {
      const existing = classData.reflections.find(r => r.id === this.editingId);
      if (existing) {
        existing.date = date;
        this.STEPS.forEach(key => { existing[key] = data[key]; });
      }
    } else {
      classData.reflections.push({
        id: crypto.randomUUID(),
        date,
        ...data,
        createdAt: new Date().toISOString()
      });
    }
    
    ClassManager.saveData();
    ModalManager.closeAll();
    this.render();
    ClassManager.updateUI();
    UI.showToast(this.editingId ? 'Reflection updated!' : 'Reflection saved!', 'success');
    this.editingId = null;
  },

  delete(id) {
    if (!confirm('Are you sure you want to delete this reflection?')) return;
    
    const classData = ClassManager.data.classes[ClassManager.activeClass];
    classData.reflections = classData.reflections.filter(r => r.id !== id);
    
    ClassManager.saveData();
    this.render();
    ClassManager.updateUI();
    UI.showToast('Reflection deleted', 'info');
  }
};

const SessionManager = {
  render() {
    const body = document.getElementById('sessionTableBody');
    const mobileList = document.getElementById('sessionMobileList');
    const classInfo = ClassManager.classes.find(c => c.name === ClassManager.activeClass);
    if (!classInfo) return;

    // Get syllabus info if available
    const syllabusRaw = localStorage.getItem('schedule_class_units');
    let syllabus = [];
    if (syllabusRaw) {
      try {
        const parsed = JSON.parse(syllabusRaw);
        syllabus = parsed[ClassManager.activeClass] || [];
      } catch (e) {}
    }

    const events = classInfo.events.sort((a, b) => b.date.localeCompare(a.date));

    // Desktop Table Rows
    if (body) {
      body.innerHTML = events.map((e, idx) => {
        const lesson = syllabus[idx]?.lesson || 'No Lesson Plan';
        const isPast = e.date < new Date().toISOString().split('T')[0];
        
        return `
          <tr class="border-b border-[var(--bg-tertiary)] dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors group">
            <td class="py-4">
              <div class="flex flex-col px-4">
                <span class="text-sm font-bold">${new Date(e.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                <span class="text-[10px] text-slate-400 uppercase tracking-widest">${e.startTime}</span>
              </div>
            </td>
            <td class="py-4">
              <div class="text-sm font-semibold truncate max-w-xs">${lesson}</div>
            </td>
            <td class="py-4">
              <span class="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-widest ${isPast ? 'bg-green/10 text-green border border-green/20' : 'bg-blue/10 text-blue border border-blue/20'}">
                ${isPast ? 'Completed' : 'Upcoming'}
              </span>
            </td>
            <td class="py-4 text-right px-4">
               <button onclick="ReflectionManager.openForSession('${e.date}')" class="p-2 text-blue opacity-0 group-hover:opacity-100 transition-all" title="Add reflection for this session">
                 <i data-lucide="message-square-plus" class="w-5 h-5"></i>
               </button>
            </td>
          </tr>
        `;
      }).join('');
    }

    // Mobile List Cards
    if (mobileList) {
      mobileList.innerHTML = events.map((e, idx) => {
        const lesson = syllabus[idx]?.lesson || 'No Lesson Plan';
        const isPast = e.date < new Date().toISOString().split('T')[0];
        const dateStr = new Date(e.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', weekday: 'short' });

        return `
          <div class="glass-panel border-[var(--border-width-thick)] border-[var(--border-primary)] rounded-2xl p-4 shadow-neo-sm hover:-translate-y-1 transition-transform">
            <div class="flex items-center justify-between mb-3">
              <div class="flex items-center gap-2">
                <span class="text-[10px] font-black uppercase tracking-widest ${isPast ? 'text-green' : 'text-blue'}">${isPast ? 'Session Ended' : 'Upcoming'}</span>
                <span class="w-1 h-1 bg-slate-300 rounded-full"></span>
                <span class="text-[10px] font-black text-slate-400 uppercase tracking-widest">${e.startTime}</span>
              </div>
              <button onclick="ReflectionManager.openForSession('${e.date}')" class="w-8 h-8 flex items-center justify-center bg-blue/10 rounded-lg text-blue">
                <i data-lucide="message-square-plus" class="w-4 h-4"></i>
              </button>
            </div>
            <h4 class="font-heading font-bold text-lg text-slate-900 dark:text-white uppercase leading-tight">${dateStr}</h4>
            <div class="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <span class="text-[11px] font-semibold text-slate-500 dark:text-slate-400 truncate max-w-[200px]">${lesson}</span>
              <i data-lucide="chevron-right" class="w-4 h-4 text-slate-300"></i>
            </div>
          </div>
        `;
      }).join('');
    }
    
    if (window.lucide) lucide.createIcons();
  }
};

const StatsManager = {
  render() {
    const grid = document.getElementById('statsGrid');
    const empty = document.getElementById('noStatsState');
    const classData = ClassManager.data.classes[ClassManager.activeClass];
    const classInfo = ClassManager.classes.find(c => c.name === ClassManager.activeClass);
    
    if (!classData || (classData.students.length === 0 && classData.reflections.length === 0)) {
      grid.innerHTML = '';
      empty.classList.remove('hidden');
      return;
    }

    empty.classList.add('hidden');

    // Calculate Attendance Average
    const attendanceEntries = Object.entries(classData.attendance || {});
    let totalAttendancePct = 0;
    if (attendanceEntries.length > 0 && classData.students.length > 0) {
      const sum = attendanceEntries.reduce((acc, [date, list]) => {
        return acc + (list.length / classData.students.length);
      }, 0);
      totalAttendancePct = Math.round((sum / attendanceEntries.length) * 100);
    }

    // Calculate Skill Stats
    const inputSkillsCount = (classData.skills || []).filter(s => s.type === 'input').length;
    const outputSkillsCount = (classData.skills || []).filter(s => s.type === 'output').length;

    const stats = [
      { label: 'Class Size', value: classData.students.length, sub: 'Active Students', icon: 'users', color: 'blue' },
      { label: 'Attendance', value: totalAttendancePct + '%', sub: `${attendanceEntries.length} Sessions`, icon: 'clipboard-check', color: 'green' },
      { label: 'Skills', value: inputSkillsCount + outputSkillsCount, sub: `${inputSkillsCount} In / ${outputSkillsCount} Out`, icon: 'target', color: 'pink' },
      { label: 'Reflections', value: classData.reflections.length, sub: 'Gibbs Cycle', icon: 'message-square', color: 'orange' },
      { label: 'Avg Progress', value: this.calculateAvgStars(classData) + ' ★', sub: 'Star Rating', icon: 'star', color: 'blue' },
      { label: 'Curriculum', value: classInfo?.events.length || 0, sub: 'Planned Sessions', icon: 'calendar', color: 'pink' }
    ];

    grid.innerHTML = stats.map(s => `
      <div class="glass-panel border-[var(--border-width-thick)] border-[var(--border-primary)] rounded-3xl p-6 shadow-neo-sm bg-white dark:bg-slate-900/50 hover:scale-[1.02] transition-transform cursor-default">
        <div class="flex items-start justify-between mb-4">
          <div class="w-12 h-12 rounded-2xl flex items-center justify-center bg-${s.color}/10 text-${s.color} border-2 border-${s.color}/20">
            <i data-lucide="${s.icon}" class="w-6 h-6"></i>
          </div>
          <span class="text-[10px] font-black text-slate-300 uppercase tracking-widest">Live</span>
        </div>
        <div class="space-y-1">
          <h4 class="text-3xl font-black text-slate-800 dark:text-white tracking-tight">${s.value}</h4>
          <p class="text-[10px] font-black text-slate-400 uppercase tracking-[0.1em]">${s.label}</p>
          <p class="text-[9px] font-bold text-slate-300 italic mt-1">${s.sub}</p>
        </div>
      </div>
    `).join('');

    if (window.lucide) lucide.createIcons({ root: grid });
  },

  calculateAvgStars(classData) {
    if (!classData.students || classData.students.length === 0) return 0;
    const total = classData.students.reduce((sum, s) => sum + (s.stars || 0), 0);
    return (total / classData.students.length).toFixed(1);
  }
};

const AttendanceManager = {
  selectedDate: null,

  render() {
    const grid = document.getElementById('attendanceGrid');
    const empty = document.getElementById('noAttendanceState');
    const summary = document.getElementById('attendanceSummary');
    const select = document.getElementById('attendanceDateSelect');
    const classData = ClassManager.data.classes[ClassManager.activeClass];
    const classInfo = ClassManager.classes.find(c => c.name === ClassManager.activeClass);

    if (!classData || !classInfo) return;

    // Populate date select from sessions
    const today = new Date().toISOString().split('T')[0];
    const pastEvents = classInfo.events
      .filter(e => e.date <= today)
      .sort((a, b) => b.date.localeCompare(a.date));

    select.innerHTML = '<option value="">Select session...</option>' +
      pastEvents.map(e => {
        const d = new Date(e.date);
        const fmt = d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
        return `<option value="${e.date}" ${this.selectedDate === e.date ? 'selected' : ''}>${fmt} — ${e.startTime}</option>`;
      }).join('');

    if (!this.selectedDate || classData.students.length === 0) {
      grid.innerHTML = '';
      empty.classList.remove('hidden');
      summary.classList.add('hidden');
      if (classData.students.length === 0) {
        empty.querySelector('h3').textContent = 'No Students Yet';
        empty.querySelector('p').textContent = 'Add students first to record attendance.';
      }
      return;
    }

    empty.classList.add('hidden');
    if (!classData.attendance) classData.attendance = {};
    const dateAttendance = classData.attendance[this.selectedDate] || [];

    grid.innerHTML = classData.students.map(s => {
      const isPresent = dateAttendance.includes(s.id);
      return `
        <div class="attendance-row ${isPresent ? 'present' : 'absent'}">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 bg-${isPresent ? 'green' : 'pink'}/10 rounded-xl flex items-center justify-center text-${isPresent ? 'green' : 'pink'} font-black text-lg border-[2px] border-${isPresent ? 'green' : 'pink'}/20">
              ${(s.nick || s.name).charAt(0)}
            </div>
            <div>
              <h4 class="font-heading font-bold text-sm leading-none text-slate-800 dark:text-white">${s.nick || s.name}</h4>
              <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">${s.nick ? s.name : ''}</p>
            </div>
          </div>
          <button onclick="AttendanceManager.toggle('${s.id}')" class="btn-chunky px-4 py-2 rounded-xl border-[var(--border-width-medium)] border-[var(--border-primary)] text-[10px] font-black uppercase shadow-neo-sm ${isPresent ? 'bg-green text-white' : 'bg-[var(--bg-tertiary)] dark:bg-slate-800 text-slate-500'}">
            <i data-lucide="${isPresent ? 'check' : 'x'}" class="w-4 h-4 inline"></i>
            ${isPresent ? 'Present' : 'Absent'}
          </button>
        </div>
      `;
    }).join('');

    // Summary
    const presentCount = dateAttendance.filter(id => classData.students.some(s => s.id === id)).length;
    const totalCount = classData.students.length;
    const pct = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;

    summary.classList.remove('hidden');
    summary.innerHTML = `
      <div class="glass-panel border-[var(--border-width-thick)] border-[var(--border-primary)] rounded-2xl p-4 shadow-neo-sm flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-green/10 flex items-center justify-center text-green">
            <i data-lucide="users" class="w-5 h-5"></i>
          </div>
          <div>
            <span class="text-[10px] font-black uppercase tracking-widest text-slate-400">Attendance Rate</span>
            <div class="font-heading font-bold text-2xl text-slate-800 dark:text-white leading-none">${pct}%</div>
          </div>
        </div>
        <div class="text-right">
          <span class="text-lg font-black text-green">${presentCount}</span>
          <span class="text-sm text-slate-400 font-bold">/ ${totalCount}</span>
        </div>
      </div>
    `;

    if (window.lucide) lucide.createIcons();
  },

  selectDate(date) {
    this.selectedDate = date;
    this.render();
  },

  toggle(studentId) {
    const classData = ClassManager.data.classes[ClassManager.activeClass];
    if (!classData.attendance) classData.attendance = {};
    if (!classData.attendance[this.selectedDate]) classData.attendance[this.selectedDate] = [];

    const arr = classData.attendance[this.selectedDate];
    const idx = arr.indexOf(studentId);
    if (idx >= 0) {
      arr.splice(idx, 1);
    } else {
      arr.push(studentId);
    }

    ClassManager.saveData();
    this.render();
    if (window.lucide) lucide.createIcons();
  }
};

const SkillsManager = {
  skillType: 'input',

  render() {
    const content = document.getElementById('skillsContent');
    const empty = document.getElementById('noSkillsState');
    const classData = ClassManager.data.classes[ClassManager.activeClass];

    if (!classData) return;
    if (!classData.skills) classData.skills = [];
    if (!classData.studentSkills) classData.studentSkills = {};

    if (classData.skills.length === 0) {
      content.innerHTML = '';
      empty.classList.remove('hidden');
      return;
    }

    empty.classList.add('hidden');

    const inputSkills = classData.skills.filter(s => s.type === 'input');
    const outputSkills = classData.skills.filter(s => s.type === 'output');

    const renderSkillSection = (title, skills, typeClass, icon) => {
      if (skills.length === 0) return '';
      return `
        <div class="glass-panel border-[var(--border-width-thick)] border-[var(--border-primary)] rounded-[var(--radius-2xl)] overflow-hidden p-4 space-y-4">
          <div class="flex items-center gap-2">
            <i data-lucide="${icon}" class="w-4 h-4 text-${typeClass === 'input' ? 'blue' : 'pink'}"></i>
            <h4 class="font-heading font-bold text-sm uppercase tracking-tight text-slate-800 dark:text-white">${title}</h4>
            <span class="skill-badge ${typeClass}">${skills.length} skills</span>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full border-collapse">
              <thead>
                <tr class="bg-slate-50 dark:bg-slate-800/50">
                  <th class="text-left !text-[9px] !py-2 !px-3 min-w-[120px]">Student</th>
                  ${skills.map(sk => `
                    <th class="text-center !text-[9px] !py-2 !px-3 min-w-[80px]">
                      <div class="flex flex-col items-center gap-0.5">
                        <span>${sk.name}</span>
                        <button onclick="SkillsManager.deleteSkill('${sk.id}')" class="text-slate-300 hover:text-pink transition-colors">
                          <i data-lucide="x" class="w-3 h-3"></i>
                        </button>
                      </div>
                    </th>
                  `).join('')}
                </tr>
              </thead>
              <tbody>
                ${classData.students.map(student => `
                  <tr class="border-b border-[var(--bg-tertiary)] dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td class="!py-2 !px-3">
                      <span class="text-xs font-bold text-slate-700 dark:text-slate-300">${student.nick || student.name}</span>
                    </td>
                    ${skills.map(sk => {
                      const level = classData.studentSkills[student.id]?.[sk.id] || 0;
                      return `
                        <td class="!py-2 !px-3 text-center">
                          <div class="flex items-center justify-center gap-0.5">
                            ${[1,2,3,4,5].map(n => `
                              <button onclick="SkillsManager.setLevel('${student.id}','${sk.id}',${n})"
                                class="w-5 h-5 rounded-md text-[9px] font-black transition-all
                                ${n <= level
                                  ? `bg-${typeClass === 'input' ? 'blue' : 'pink'} text-white border border-${typeClass === 'input' ? 'blue' : 'pink'}/30`
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
                                }">${n}</button>
                            `).join('')}
                          </div>
                        </td>
                      `;
                    }).join('')}
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    };

    content.innerHTML = 
      renderSkillSection('Input Skills (Receptive)', inputSkills, 'input', 'ear') +
      renderSkillSection('Output Skills (Productive)', outputSkills, 'output', 'megaphone');

    if (window.lucide) lucide.createIcons();
  },

  setSkillType(type) {
    this.skillType = type;
    const isInput = type === 'input';
    document.getElementById('skillType-input').className = isInput
      ? 'flex-1 py-2.5 rounded-xl font-black text-[10px] uppercase transition-all bg-blue text-white shadow-neo-sm'
      : 'flex-1 py-2.5 rounded-xl font-black text-[10px] uppercase transition-all text-slate-400';
    document.getElementById('skillType-output').className = !isInput
      ? 'flex-1 py-2.5 rounded-xl font-black text-[10px] uppercase transition-all bg-pink text-white shadow-neo-sm'
      : 'flex-1 py-2.5 rounded-xl font-black text-[10px] uppercase transition-all text-slate-400';
  },

  openAddSkill() {
    this.skillType = 'input';
    this.setSkillType('input');
    document.getElementById('skillNameInput').value = '';
    ModalManager.open('skillModal');
    setTimeout(() => document.getElementById('skillNameInput').focus(), 100);
  },

  saveSkill() {
    const name = document.getElementById('skillNameInput').value.trim();
    if (!name) return;

    const classData = ClassManager.data.classes[ClassManager.activeClass];
    if (!classData.skills) classData.skills = [];

    classData.skills.push({
      id: crypto.randomUUID(),
      name,
      type: this.skillType,
      createdAt: new Date().toISOString()
    });

    ClassManager.saveData();
    ModalManager.closeAll();
    this.render();
    UI.showToast(`${this.skillType === 'input' ? 'Input' : 'Output'} skill added!`, 'success');
  },

  deleteSkill(skillId) {
    if (!confirm('Delete this skill? All student ratings will be lost.')) return;
    const classData = ClassManager.data.classes[ClassManager.activeClass];
    classData.skills = classData.skills.filter(s => s.id !== skillId);
    // Clean up student skill data
    if (classData.studentSkills) {
      Object.keys(classData.studentSkills).forEach(sid => {
        delete classData.studentSkills[sid][skillId];
      });
    }
    ClassManager.saveData();
    this.render();
    UI.showToast('Skill removed', 'info');
  },

  setLevel(studentId, skillId, level) {
    const classData = ClassManager.data.classes[ClassManager.activeClass];
    if (!classData.studentSkills) classData.studentSkills = {};
    if (!classData.studentSkills[studentId]) classData.studentSkills[studentId] = {};

    // Toggle off if same level clicked
    if (classData.studentSkills[studentId][skillId] === level) {
      classData.studentSkills[studentId][skillId] = 0;
    } else {
      classData.studentSkills[studentId][skillId] = level;
    }

    ClassManager.saveData();
    this.render();
  }
};

const ModalManager = {
  open(id) {
    const modal = document.getElementById(id);
    const backdrop = document.getElementById('modalBackdrop');
    
    modal.classList.remove('hidden');
    backdrop.classList.remove('hidden');
    
    setTimeout(() => {
      modal.classList.remove('opacity-0', 'scale-95');
      modal.classList.add('opacity-100', 'scale-100');
      backdrop.classList.remove('opacity-0');
      backdrop.classList.add('opacity-100');
    }, 10);
    
    document.body.style.overflow = 'hidden';
  },

  closeAll() {
    const backdrop = document.getElementById('modalBackdrop');
    const modals = document.querySelectorAll('[id$="Modal"]');
    
    modals.forEach(modal => {
      modal.classList.remove('opacity-100', 'scale-100');
      modal.classList.add('opacity-0', 'scale-95');
      setTimeout(() => modal.classList.add('hidden'), 300);
    });
    
    backdrop.classList.remove('opacity-100');
    backdrop.classList.add('opacity-0');
    setTimeout(() => backdrop.classList.add('hidden'), 300);
    
    document.body.style.overflow = '';
  }
};

const Theme = {
  toggle() {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('theme_my-class', isDark ? 'dark' : 'light');
    
    // Save to cloud if possible
    if (window.Sync && !isSandbox()) {
      getUser().then(user => {
        if (user) {
          Sync.cloudSaveSettings(user.id, {
            class: { theme: isDark ? 'dark' : 'light' }
          });
        }
      });
    }
  }
};

const UI = {
  showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    const colorClass = type === 'success' ? 'bg-green' : (type === 'error' ? 'bg-pink' : 'bg-blue');
    const icon = type === 'success' ? 'check-circle' : (type === 'error' ? 'alert-circle' : 'info');

    toast.className = `flex items-center gap-3 px-6 py-4 rounded-2xl border-[var(--border-width-thick)] border-[var(--border-primary)] text-white shadow-neo translate-y-10 opacity-0 transition-all duration-300 pointer-events-auto ${colorClass}`;
    toast.innerHTML = `
      <i data-lucide="${icon}" class="w-5 h-5"></i>
      <span class="font-heading font-bold text-sm uppercase tracking-tight">${message}</span>
    `;

    container.appendChild(toast);
    if (window.lucide) lucide.createIcons({ root: toast });

    // Animate In
    setTimeout(() => {
      toast.classList.remove('translate-y-10', 'opacity-0');
    }, 10);

    // Animate Out
    setTimeout(() => {
      toast.classList.add('translate-y-10', 'opacity-0');
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }
};

// Start
document.addEventListener('DOMContentLoaded', () => ClassManager.init());
