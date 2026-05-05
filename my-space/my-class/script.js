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

    // Reflection Form
    const reflectionText = document.getElementById('reflectionTextInput');
    if (reflectionText) {
      reflectionText.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
          ReflectionManager.save();
        }
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

    if (!isSandbox() && typeof loadProgress === 'function') {
      const cloud = await loadProgress('my-class');
      if (cloud) {
        this.data = cloud;
      }
    }
  },

  async saveData() {
    if (typeof saveProgress === 'function') {
      await saveProgress('my-class', this.data);
    } else {
      localStorage.setItem('prog_my-class', JSON.stringify(this.data));
    }
    
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
          classMap[evt.name].events.push(evt);
        }
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
          attendance: {} // { "date": ["student_id", ...] }
        };
      }
    }
    
    this.renderClassSelectors();
    this.updateUI();
    if (window.lucide) lucide.createIcons();
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
        <div onclick="ClassManager.selectClass('${c.name.replace(/'/g, "\\'")}')" class="tracker-card group bg-white dark:bg-slate-900/40">
          <div class="flex items-start justify-between mb-6">
            <div class="w-12 h-12 rounded-xl flex items-center justify-center text-white border-2 border-slate-800 shadow-hard-sm group-hover:scale-105 transition-transform" style="background: ${c.color}">
              <span class="font-heading font-bold text-xl uppercase">${c.name.charAt(0)}</span>
            </div>
            <div class="text-right">
              <span class="text-[9px] font-black text-slate-400 uppercase tracking-widest">Enrolled</span>
              <div class="text-lg font-black text-slate-800 dark:text-white leading-none">${studentCount}</div>
            </div>
          </div>
          
          <h3 class="font-heading font-bold text-xl text-slate-900 dark:text-white uppercase tracking-tight mb-4">${c.name}</h3>
          
          <div class="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
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
  current: 'students',

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
      case 'reflections': ReflectionManager.render(); break;
      case 'sessions': SessionManager.render(); break;
      case 'stats': StatsManager.render(); break;
    }
    if (window.lucide) lucide.createIcons();
  }
};

const StudentManager = {
  entryMode: 'single',

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
    grid.innerHTML = classData.students.map(s => `
      <div class="student-card glass-panel border-2 border-slate-800 dark:border-slate-700 rounded-2xl p-6 bg-white dark:bg-slate-900/50">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-3">
            <div class="w-12 h-12 bg-blue/10 rounded-xl flex items-center justify-center text-blue font-black text-xl border-2 border-blue/20">
              ${(s.nick || s.name).charAt(0)}
            </div>
            <div>
              <h4 class="font-heading font-bold text-lg leading-none text-slate-800 dark:text-white">${s.nick || s.name}</h4>
              <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">${s.nick ? s.name : 'No Nickname'}</p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <button onclick="StudentManager.edit('${s.id}')" class="p-2 text-slate-400 hover:text-blue transition-colors">
              <i data-lucide="edit-3" class="w-4 h-4"></i>
            </button>
            <button onclick="StudentManager.delete('${s.id}')" class="p-2 text-slate-400 hover:text-pink transition-colors">
              <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
          </div>
        </div>
        
        <div class="space-y-4">
          <div class="flex items-center justify-between">
             <span class="text-[10px] font-black uppercase text-slate-400 tracking-widest">Progress Stars</span>
             <div class="flex items-center gap-1">
               <button onclick="StudentManager.updateStars('${s.id}', -1)" class="w-6 h-6 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 flex items-center justify-center text-slate-500 hover:bg-slate-200">-</button>
               <span class="w-8 text-center font-black text-blue">${s.stars || 0}</span>
               <button onclick="StudentManager.updateStars('${s.id}', 1)" class="w-6 h-6 rounded-md bg-blue text-white border border-blue/30 flex items-center justify-center hover:brightness-110">+</button>
             </div>
          </div>
          
          <div class="h-[2px] bg-slate-100 dark:bg-slate-800 rounded-full"></div>
          
          <div class="space-y-1">
            <span class="text-[10px] font-black uppercase text-slate-400 tracking-widest">Teacher Notes</span>
            <p class="text-xs font-semibold text-slate-600 dark:text-slate-400 line-clamp-2 italic">
              ${s.notes || 'No notes yet. Click edit to add notes about learning style or progress.'}
            </p>
          </div>
        </div>
      </div>
    `).join('');
    
    if (window.lucide) lucide.createIcons({ root: grid });
  },

  setEntryMode(mode) {
    this.entryMode = mode;
    const isSingle = mode === 'single';
    
    document.getElementById('form-single').classList.toggle('hidden', !isSingle);
    document.getElementById('form-bulk').classList.toggle('hidden', isSingle);
    
    document.getElementById('mode-single').className = isSingle ? 'flex-1 py-2.5 rounded-xl font-black text-[10px] uppercase transition-all bg-blue text-white shadow-hard-sm' : 'flex-1 py-2.5 rounded-xl font-black text-[10px] uppercase transition-all text-slate-400';
    document.getElementById('mode-bulk').className = !isSingle ? 'flex-1 py-2.5 rounded-xl font-black text-[10px] uppercase transition-all bg-blue text-white shadow-hard-sm' : 'flex-1 py-2.5 rounded-xl font-black text-[10px] uppercase transition-all text-slate-400';
    
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
      .map(r => `
      <div class="glass-panel border-2 border-slate-800 dark:border-slate-700 rounded-3xl p-6 shadow-hard-sm bg-white dark:bg-slate-900/40 relative">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-3">
            <span class="px-3 py-1 bg-orange/15 text-orange border border-orange/20 rounded-lg font-black text-[10px] uppercase tracking-widest">${r.focus || 'General'}</span>
            <span class="text-xs font-bold text-slate-400">${new Date(r.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span>
          </div>
          <button onclick="ReflectionManager.delete('${r.id}')" class="text-slate-400 hover:text-pink transition-colors">
            <i data-lucide="trash-2" class="w-4 h-4"></i>
          </button>
        </div>
        <p class="font-body font-semibold text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">${r.text}</p>
      </div>
    `).join('');
    
    if (window.lucide) lucide.createIcons({ root: list });
  },

  openNew() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('reflectionDateInput').value = today;
    document.getElementById('reflectionTextInput').value = '';
    ModalManager.open('reflectionModal');
    document.getElementById('reflectionTextInput').focus();
  },

  openForSession(date) {
    document.getElementById('reflectionDateInput').value = date;
    document.getElementById('reflectionTextInput').value = '';
    ModalManager.open('reflectionModal');
    document.getElementById('reflectionTextInput').focus();
  },

  save() {
    const date = document.getElementById('reflectionDateInput').value;
    const focus = document.getElementById('reflectionFocusInput').value;
    const text = document.getElementById('reflectionTextInput').value.trim();
    
    if (!date || !text) return;
    
    const newReflection = {
      id: crypto.randomUUID(),
      date,
      focus,
      text,
      createdAt: new Date().toISOString()
    };
    
    const classData = ClassManager.data.classes[ClassManager.activeClass];
    classData.reflections.push(newReflection);
    
    ClassManager.saveData();
    ModalManager.closeAll();
    this.render();
    ClassManager.updateUI();
    UI.showToast('Reflection saved!', 'success');
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
          <tr class="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors group">
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
          <div class="glass-panel border-2 border-slate-800 dark:border-slate-700 rounded-2xl p-4 shadow-hard-sm">
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
    
    if (!classData || (classData.students.length === 0 && classData.reflections.length === 0)) {
      grid.innerHTML = '';
      empty.classList.remove('hidden');
      return;
    }

    empty.classList.add('hidden');
    
    const stats = [
      { label: 'Total Students', value: classData.students.length, icon: 'users', color: 'blue' },
      { label: 'Reflections', value: classData.reflections.length, icon: 'message-square', color: 'orange' },
      { label: 'Avg Progress', value: this.calculateAvgStars(classData) + ' ★', icon: 'star', color: 'pink' },
      { label: 'Sessions', value: ClassManager.classes.find(c => c.name === ClassManager.activeClass)?.events.length || 0, icon: 'calendar', color: 'green' }
    ];

    grid.innerHTML = stats.map(s => `
      <div class="glass-panel border-[3px] border-slate-800 dark:border-slate-700 rounded-3xl p-6 shadow-hard-sm bg-white dark:bg-slate-900/50">
        <div class="w-10 h-10 rounded-xl flex items-center justify-center bg-${s.color}/10 text-${s.color} mb-4">
          <i data-lucide="${s.icon}" class="w-5 h-5"></i>
        </div>
        <div class="space-y-1">
          <h4 class="text-3xl font-black text-slate-800 dark:text-white">${s.value}</h4>
          <p class="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">${s.label}</p>
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

    toast.className = `glass-panel flex items-center gap-3 px-6 py-4 rounded-2xl border-2 border-slate-800 text-white shadow-hard translate-y-10 opacity-0 transition-all duration-300 pointer-events-auto ${colorClass}`;
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
