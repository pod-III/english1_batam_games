let allProgress = []
let allNotes = []
let allMyClass = []
let allProfiles = {}
let allAnnouncements = []
let allScheduleEvents = []
let allClassAdmin = []
let allClassUnits = []
let allRedDays = {}
let allNoteFolders = {}
let scheduleClassTab = 'admin'
let charts = {}
let pendingDelete = null
let currentView = 'dashboard'
let sortConfig = {
    users: { col: 'active', dir: 'desc' },
    progress: { col: 'updated_at', dir: 'desc' },
    notes: { col: 'updated_at', dir: 'desc' },
    cloud: { col: 'usage', dir: 'desc' },
    schedule: { col: 'date', dir: 'desc' },
    classes: { col: 'class_name', dir: 'asc' }
}
let pagination = {
    users: 1,
    progress: 1,
    notes: 1,
    cloud: 1,
    schedule: 1,
    classes: 1
}
const PAGE_SIZE = 25
let settingsTimeout = null
let searchTimeout = null

// ── INIT ──
async function init() {
    const { user, profile } = await requireAdmin()
    const name = profile.display_name || user.email?.split('@')[0] || 'Admin'
    document.getElementById('adminName').textContent = name
    document.getElementById('adminAvatar').textContent = name[0].toUpperCase()
    const overlay = document.getElementById('loadingOverlay')
    if (overlay) {
        overlay.style.opacity = '0'
        setTimeout(() => overlay.remove(), 400)
    }
    lucide.createIcons()
    await fetchData()
}


// Register Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('../sw.js')
            .then(reg => console.log('SW Registered!', reg))
            .catch(err => console.log('SW Reg error:', err));
    });
}
// ── FETCH ──
async function fetchData() {
    document.querySelectorAll('.refreshIcon').forEach(i => i.classList.add('animate-spin'))

    const [progressRes, notesRes, profilesRes, quotasRes, schedEventsRes, classAdminRes, classUnitsRes, redDaysRes, noteFoldersRes, myClassRes] = await Promise.all([
        db.from('user_progress').select('*').order('updated_at', { ascending: false }),
        db.from('notes').select('*').order('updated_at', { ascending: false }),
        db.from('profiles').select('*'),
        db.from('storage_quotas').select('*'),
        db.from('myspace_events').select('id,user_id,name,type_id,color,date,recurrence,recurrence_days,graduation_class,is_master,created_at').eq('is_master', true).order('date', { ascending: false }),
        db.from('myspace_class_admin').select('*').order('created_at', { ascending: false }),
        db.from('myspace_class_units').select('*').order('created_at', { ascending: false }),
        db.from('myspace_settings').select('*'),
        db.from('note_folders').select('*'),
        db.from('myspace_my_class').select('*')
    ])

    document.querySelectorAll('.refreshIcon').forEach(i => i.classList.remove('animate-spin'))
    const lastRefreshed = document.getElementById('lastRefreshed')
    if (lastRefreshed) lastRefreshed.textContent = 'Updated ' + new Date().toLocaleTimeString()

    if (progressRes.error) { console.error(progressRes.error); return }

    const quotaMap = {}
    quotasRes.data?.forEach(q => { quotaMap[q.user_id] = q })

    allProfiles = {}
    profilesRes.data?.forEach(p => {
        const quota = quotaMap[p.id] || {}
        allProfiles[p.id] = {
            ...p,
            storage_usage: quota.storage_usage || 0,
            storage_limit: quota.storage_limit || 10485760,
            last_active_ts: p.updated_at ? new Date(p.updated_at).getTime() : (p.created_at ? new Date(p.created_at).getTime() : 0)
        }
    })
    allProgress = progressRes.data || []
    allNotes = notesRes.data || []
    allMyClass = myClassRes.data || []

    allScheduleEvents = schedEventsRes.data || []
    allClassAdmin = classAdminRes.data || []
    allClassUnits = classUnitsRes.data || []
    allRedDays = {}
    redDaysRes.data?.forEach(r => { allRedDays[r.user_id] = r.dates || [] })
    allNoteFolders = {}
    noteFoldersRes.data?.forEach(f => { allNoteFolders[f.user_id] = f.folders || [] })

    // Pre-calculate latest activity from progress
    allProgress.forEach(r => {
        const ts = new Date(r.updated_at).getTime()
        if (allProfiles[r.user_id] && ts > allProfiles[r.user_id].last_active_ts) {
            allProfiles[r.user_id].last_active_ts = ts
        }
    })

    // Fetch Games Registry for categories
    const gamesRes = await fetch('../games.json')
    const gamesData = await gamesRes.json()
    const toolCategoryMap = {}
    const catDisplayNames = {
        'myspace': 'My Space',
        'tool': 'Tools',
        'workshop': 'Workshop',
        'game': 'Games'
    }
    gamesData.games.forEach(g => {
        toolCategoryMap[g.id] = catDisplayNames[g.category] || 'Tools'
    })
    window.toolCategoryMap = toolCategoryMap

    // Fetch Announcements
    const annRes = await db.from('announcements').select('*').order('created_at', { ascending: false })
    allAnnouncements = annRes.data || []

    updateStats()
    populateToolFilter()
    applyFilters()
    renderAnnouncements()
    if (currentView === 'cloud') renderCloudTable()
    showToast('Data refreshed')
}

// ── TOAST SYSTEM ──
function showToast(msg, type = 'success') {
    const container = document.getElementById('toast-container')
    if (!container) return
    const toast = document.createElement('div')
    toast.className = `neo p-4 min-w-[240px] flex items-center gap-3 animate-slide-in pointer-events-auto bg-slate-800 border-2 ${type === 'success' ? 'border-green/40 text-green' : 'border-pink/40 text-pink'}`
    toast.style.boxShadow = '4px 4px 0 #000'
    toast.innerHTML = `
        <i data-lucide="${type === 'success' ? 'check-circle' : 'alert-circle'}" class="w-5 h-5"></i>
        <span class="text-sm font-bold">${msg}</span>
    `
    container.appendChild(toast)
    lucide.createIcons()
    setTimeout(() => {
        toast.classList.add('animate-slide-out')
        setTimeout(() => toast.remove(), 500)
    }, 3000)
}

// ── SEARCH DEBOUNCE ──
function debouncedSearch() {
    clearTimeout(searchTimeout)
    searchTimeout = setTimeout(applyFilters, 300)
}

// ── STATS ──
function updateStats() {
    const uniqueTools = new Set([...allProgress.map(r => r.tool_key), ...allNotes.map(n => 'lesson-note')]).size
    const latestProgress = allProgress[0]?.updated_at ? new Date(allProgress[0].updated_at).getTime() : 0
    const latestNote = allNotes[0]?.updated_at ? new Date(allNotes[0].updated_at).getTime() : 0
    const latest = Math.max(latestProgress, latestNote)
        ? new Date(Math.max(latestProgress, latestNote)).toLocaleDateString()
        : '—'

    const statUsers = document.getElementById('statUsers')
    if (statUsers) statUsers.textContent = Object.keys(allProfiles).length
    const statRows = document.getElementById('statRows')
    if (statRows) statRows.textContent = allProgress.length
    const statNotes = document.getElementById('statNotes')
    if (statNotes) statNotes.textContent = allNotes.length
    const statTools = document.getElementById('statTools')
    if (statTools) statTools.textContent = uniqueTools
    const statLatest = document.getElementById('statLatest')
    if (statLatest) statLatest.textContent = latest
    const statEvents = document.getElementById('statEvents')
    if (statEvents) statEvents.textContent = allScheduleEvents.length
    const statClasses = document.getElementById('statClasses')
    if (statClasses) statClasses.textContent = allClassAdmin.length

    // Global Storage Stat
    const totalUsed = Object.values(allProfiles).reduce((sum, p) => sum + (p.storage_usage || 0), 0)
    const totalUsedMB = (totalUsed / (1024 * 1024)).toFixed(1)
    const statStorage = document.getElementById('statStorage')
    if (statStorage) statStorage.textContent = `${totalUsedMB} MB`

    updateCharts()
}

function updateCharts() {
    const ctxActivity = document.getElementById('activityChart')?.getContext('2d')
    const ctxCategory = document.getElementById('categoryChart')?.getContext('2d')
    const ctxTools = document.getElementById('toolsChart')?.getContext('2d')

    if (!ctxActivity || !ctxCategory || !ctxTools) return

    // Filter out system keys like the Hub landing page
    const filteredProgress = allProgress.filter(r => r.tool_key !== 'klasskit_hub' && r.tool_key !== 'hub')

    // 1. Activity Line Chart
    const days = 14
    const today = new Date()
    const activityLabels = []
    const activityData = []
    for (let i = days - 1; i >= 0; i--) {
        const d = new Date(today)
        d.setDate(d.getDate() - i)
        const dateStr = d.toISOString().split('T')[0]
        activityLabels.push(d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }))
        const count = filteredProgress.filter(r => (r.updated_at ? new Date(r.updated_at) : new Date()).toISOString().split('T')[0] === dateStr).length
        activityData.push(count)
    }

    if (charts.activity) charts.activity.destroy()
    charts.activity = new Chart(ctxActivity, {
        type: 'line',
        data: {
            labels: activityLabels,
            datasets: [{
                label: 'Interactions',
                data: activityData,
                borderColor: '#2979FF',
                backgroundColor: 'rgba(41, 121, 255, 0.1)',
                fill: true,
                tension: 0.4,
                borderWidth: 3,
                pointRadius: 4,
                pointBackgroundColor: '#2979FF'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#64748b' } },
                x: { grid: { display: false }, ticks: { color: '#64748b' } }
            }
        }
    })

    // 2. Tool Counts & Category Mapping
    const toolCounts = {}
    filteredProgress.forEach(r => toolCounts[r.tool_key] = (toolCounts[r.tool_key] || 0) + 1)

    const categories = {
        'My Space': { count: 0, color: '#FF8C42' },
        'Tools': { count: 0, color: '#2979FF' },
        'Workshop': { count: 0, color: '#FF6B95' },
        'Games': { count: 0, color: '#00E676' }
    }

    // 1. Add direct data from specialized tables (My Space)
    categories['My Space'].count += allNotes.length
    categories['My Space'].count += allScheduleEvents.length
    categories['My Space'].count += allClassAdmin.length
    categories['My Space'].count += allMyClass.length

    // 2. Map progress records using the official registry
    const toolMap = window.toolCategoryMap || {}
    Object.entries(toolCounts).forEach(([key, count]) => {
        // Determine category from registry or fallback to tool-key analysis
        let cat = toolMap[key]
        if (!cat) {
            if (key.includes('game') || key.includes('quiz')) cat = 'Games'
            else if (key.includes('note') || key.includes('schedule') || key.includes('admin')) cat = 'My Space'
            else if (key.includes('factory') || key.includes('generator')) cat = 'Workshop'
            else cat = 'Tools'
        }

        if (categories[cat]) {
            categories[cat].count += count
        } else {
            categories['Tools'].count += count
        }
    })

    if (charts.category) charts.category.destroy()
    charts.category = new Chart(ctxCategory, {
        type: 'doughnut',
        data: {
            labels: Object.keys(categories),
            datasets: [{
                data: Object.values(categories).map(c => c.count),
                backgroundColor: Object.values(categories).map(c => c.color),
                borderWidth: 0,
                hoverOffset: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { color: '#94a3b8', font: { weight: 'bold' }, padding: 20 } }
            },
            cutout: '70%'
        }
    })

    // 3. Top Tools Bar Chart
    const sortedTools = Object.entries(toolCounts).sort((a, b) => b[1] - a[1]).slice(0, 10)
    if (charts.tools) charts.tools.destroy()
    charts.tools = new Chart(ctxTools, {
        type: 'bar',
        data: {
            labels: sortedTools.map(t => t[0]),
            datasets: [{
                label: 'Saves',
                data: sortedTools.map(t => t[1]),
                backgroundColor: '#FF8C42',
                borderRadius: 8,
                barThickness: 20
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#64748b' } },
                y: { grid: { display: false }, ticks: { color: '#fff', font: { weight: 'bold' } } }
            }
        }
    })

    // Breakdown List
    const breakdownEl = document.getElementById('toolBreakdown')
    if (breakdownEl) {
        const total = allProgress.length || 1
        breakdownEl.innerHTML = sortedTools.map(([key, count]) => {
            const percent = Math.round((count / total) * 100)
            return `
                <div class="group">
                    <div class="flex items-center justify-between text-xs mb-1">
                        <span class="font-bold text-slate-300 uppercase tracking-wider">${key}</span>
                        <span class="text-slate-500 font-mono">${count} saves</span>
                    </div>
                    <div class="h-2 bg-slate-900 border border-slate-700 rounded-full overflow-hidden">
                        <div class="h-full bg-blue transition-all duration-1000" style="width: ${percent}%"></div>
                    </div>
                </div>`
        }).join('')
    }
}

// ── FILTERS ──
function populateToolFilter() {
    const tools = [...new Set([...allProgress.map(r => r.tool_key), 'lesson-note'])].sort()
    const sel = document.getElementById('toolFilter')
    if (!sel) return
    sel.innerHTML = '<option value="">All tools</option>' +
        tools.map(t => `<option value="${t}">${t}</option>`).join('')
}

function applyFilters() {
    const searchInput = document.getElementById('searchInput')
    const toolFilter = document.getElementById('toolFilter')
    const search = searchInput ? searchInput.value.toLowerCase() : ''
    const tool = toolFilter ? toolFilter.value : ''

    let filteredRows = allProgress.filter(r => {
        const name = (allProfiles[r.user_id]?.display_name || '').toLowerCase()
        const matchSearch = !search
            || name.includes(search)
            || r.user_id.toLowerCase().includes(search)
            || r.tool_key.toLowerCase().includes(search)
        const matchTool = !tool || r.tool_key === tool
        return matchSearch && matchTool
    })

    let filteredUserIds = Object.keys(allProfiles).filter(uid => {
        const name = (allProfiles[uid]?.display_name || '').toLowerCase()
        const matchSearch = !search || name.includes(search) || uid.toLowerCase().includes(search)
        const hasUsedTool = !tool || allProgress.some(r => r.user_id === uid && r.tool_key === tool) || (tool === 'lesson-note' && allNotes.some(n => n.user_id === uid))
        return matchSearch && hasUsedTool
    })

    let filteredNotes = allNotes.filter(n => {
        const name = (allProfiles[n.user_id]?.display_name || '').toLowerCase()
        const matchSearch = !search
            || name.includes(search)
            || n.user_id.toLowerCase().includes(search)
            || (n.title || '').toLowerCase().includes(search)
        const matchTool = !tool || tool === 'lesson-note'
        return matchSearch && matchTool
    })

    // Sort Users
    filteredUserIds.sort((a, b) => {
        const profA = allProfiles[a] || {}
        const profB = allProfiles[b] || {}
        const conf = sortConfig.users
        let valA, valB

        if (conf.col === 'name') {
            valA = (profA.display_name || '').toLowerCase()
            valB = (profB.display_name || '').toLowerCase()
        } else if (conf.col === 'role') {
            valA = profA.role || 'user'
            valB = profB.role || 'user'
        } else if (conf.col === 'storage') {
            valA = profA.storage_usage || 0
            valB = profB.storage_usage || 0
        } else if (conf.col === 'active') {
            valA = profA.last_active_ts || 0
            valB = profB.last_active_ts || 0
        }

        if (valA < valB) return conf.dir === 'asc' ? -1 : 1
        if (valA > valB) return conf.dir === 'asc' ? 1 : -1
        return 0
    })

    // Sort Progress
    filteredRows.sort((a, b) => {
        const conf = sortConfig.progress
        let valA, valB

        if (conf.col === 'user') {
            valA = (allProfiles[a.user_id]?.display_name || '').toLowerCase()
            valB = (allProfiles[b.user_id]?.display_name || '').toLowerCase()
        } else if (conf.col === 'tool') {
            valA = a.tool_key
            valB = b.tool_key
        } else if (conf.col === 'updated_at') {
            valA = new Date(a.updated_at).getTime()
            valB = new Date(b.updated_at).getTime()
        }

        if (valA < valB) return conf.dir === 'asc' ? -1 : 1
        if (valA > valB) return conf.dir === 'asc' ? 1 : -1
        return 0
    })

    // Sort Notes
    filteredNotes.sort((a, b) => {
        const conf = sortConfig.notes
        let valA, valB

        if (conf.col === 'user') {
            valA = (allProfiles[a.user_id]?.display_name || '').toLowerCase()
            valB = (allProfiles[b.user_id]?.display_name || '').toLowerCase()
        } else if (conf.col === 'title') {
            valA = (a.title || '').toLowerCase()
            valB = (b.title || '').toLowerCase()
        } else if (conf.col === 'updated_at') {
            valA = Number(a.updated_at) || 0
            valB = Number(b.updated_at) || 0
        }

        if (valA < valB) return conf.dir === 'asc' ? -1 : 1
        if (valA > valB) return conf.dir === 'asc' ? 1 : -1
        return 0
    })

    // Sort Schedule Events
    allScheduleEvents.sort((a, b) => {
        const conf = sortConfig.schedule
        let valA, valB
        if (conf.col === 'user') {
            valA = (allProfiles[a.user_id]?.display_name || '').toLowerCase()
            valB = (allProfiles[b.user_id]?.display_name || '').toLowerCase()
        } else if (conf.col === 'name') {
            valA = (a.name || '').toLowerCase()
            valB = (b.name || '').toLowerCase()
        } else {
            valA = a.date || ''
            valB = b.date || ''
        }
        if (valA < valB) return conf.dir === 'asc' ? -1 : 1
        if (valA > valB) return conf.dir === 'asc' ? 1 : -1
        return 0
    })

    // Sort Class Admin
    allClassAdmin.sort((a, b) => {
        const conf = sortConfig.classes
        let valA, valB
        if (conf.col === 'user') {
            valA = (allProfiles[a.user_id]?.display_name || '').toLowerCase()
            valB = (allProfiles[b.user_id]?.display_name || '').toLowerCase()
        } else if (conf.col === 'class_name') {
            valA = (a.class_name || '').toLowerCase()
            valB = (b.class_name || '').toLowerCase()
        } else {
            valA = a.created_at || ''
            valB = b.created_at || ''
        }
        if (valA < valB) return conf.dir === 'asc' ? -1 : 1
        if (valA > valB) return conf.dir === 'asc' ? 1 : -1
        return 0
    })

    // Pagination for Users
    const userPages = Math.ceil(filteredUserIds.length / PAGE_SIZE) || 1
    if (pagination.users > userPages) pagination.users = userPages
    const userStart = (pagination.users - 1) * PAGE_SIZE
    const pagedUserIds = filteredUserIds.slice(userStart, userStart + PAGE_SIZE)
    const userPageInfo = document.getElementById('users-page-info')
    if (userPageInfo) userPageInfo.textContent = `Page ${pagination.users} of ${userPages}`

    // Pagination for Progress
    const progPages = Math.ceil(filteredRows.length / PAGE_SIZE) || 1
    if (pagination.progress > progPages) pagination.progress = progPages
    const progStart = (pagination.progress - 1) * PAGE_SIZE
    const pagedRows = filteredRows.slice(progStart, progStart + PAGE_SIZE)
    const progressPageInfo = document.getElementById('progress-page-info')
    if (progressPageInfo) progressPageInfo.textContent = `Page ${pagination.progress} of ${progPages}`

    // Pagination for Notes
    const notesPages = Math.ceil(filteredNotes.length / PAGE_SIZE) || 1
    if (pagination.notes > notesPages) pagination.notes = notesPages
    const notesStart = (pagination.notes - 1) * PAGE_SIZE
    const pagedNotes = filteredNotes.slice(notesStart, notesStart + PAGE_SIZE)
    const notesPageInfo = document.getElementById('notes-page-info')
    if (notesPageInfo) notesPageInfo.textContent = `Page ${pagination.notes} of ${notesPages}`

    // Pagination for Schedule Events
    const schedPages = Math.ceil(allScheduleEvents.length / PAGE_SIZE) || 1
    if (pagination.schedule > schedPages) pagination.schedule = schedPages
    const schedStart = (pagination.schedule - 1) * PAGE_SIZE
    const pagedSched = allScheduleEvents.slice(schedStart, schedStart + PAGE_SIZE)
    const schedulePageInfo = document.getElementById('schedule-page-info')
    if (schedulePageInfo) schedulePageInfo.textContent = `Page ${pagination.schedule} of ${schedPages}`

    // Pagination for Classes
    const classPages = Math.ceil(allClassAdmin.length / PAGE_SIZE) || 1
    if (pagination.classes > classPages) pagination.classes = classPages
    const classStart = (pagination.classes - 1) * PAGE_SIZE
    const pagedClasses = allClassAdmin.slice(classStart, classStart + PAGE_SIZE)
    const classesPageInfo = document.getElementById('classes-page-info')
    if (classesPageInfo) classesPageInfo.textContent = `Page ${pagination.classes} of ${classPages}`

    // Pagination counts for reliable clamping
    pagination.lastFilteredCounts = {
        users: filteredUserIds.length,
        progress: filteredRows.length,
        notes: filteredNotes.length,
        schedule: allScheduleEvents.length,
        classes: allClassAdmin.length
    }

    renderUsersTable(pagedUserIds, filteredRows)
    renderProgressTable(pagedRows)
    renderNotesTable(pagedNotes)
    renderScheduleTable(pagedSched)
    renderClassesView(pagedClasses)
    updateSortIcons()

    const userCount = document.getElementById('userCount')
    if (userCount) userCount.textContent = filteredUserIds.length + ' users'
    const progressCount = document.getElementById('progressCount')
    if (progressCount) progressCount.textContent = filteredRows.length + ' rows'
    const notesCount = document.getElementById('notesCount')
    if (notesCount) notesCount.textContent = filteredNotes.length + ' notes'
    const scheduleCount = document.getElementById('scheduleCount')
    if (scheduleCount) scheduleCount.textContent = allScheduleEvents.length + ' events'
    const classAdminCount = document.getElementById('classAdminCount')
    if (classAdminCount) classAdminCount.textContent = allClassAdmin.length + ' classes'
    const classUnitsCount = document.getElementById('classUnitsCount')
    if (classUnitsCount) classUnitsCount.textContent = allClassUnits.length + ' classes'
}

function clearFilters() {
    const searchInput = document.getElementById('searchInput')
    const toolFilter = document.getElementById('toolFilter')
    if (searchInput) searchInput.value = ''
    if (toolFilter) toolFilter.value = ''
    applyFilters()
}

// ── USERS TABLE ──
function renderUsersTable(userIds, rows) {
    const byUser = {}
    userIds.forEach(uid => { byUser[uid] = { rows: [], latest: 0 } })

    rows.forEach(r => {
        if (byUser[r.user_id]) {
            byUser[r.user_id].rows.push(r)
            const rowTs = r.updated_at ? new Date(r.updated_at).getTime() : 0
            if (rowTs > byUser[r.user_id].latest) byUser[r.user_id].latest = rowTs
        }
    })

    const body = document.getElementById('usersTableBody')
    if (!body) return
    if (!userIds.length) {
        body.innerHTML = '<tr><td colspan="6" class="text-center py-12 text-slate-500 font-bold">No users found</td></tr>'
        return
    }

    body.innerHTML = userIds.map(uid => {
        const info = byUser[uid]
        const profile = allProfiles[uid]
        const name = profile?.display_name || '—'
        const role = profile?.role || 'user'
        const tools = [...new Set(info.rows.map(r => r.tool_key))]
        let activeDate = 'Never'
        let latestTs = profile?.last_active_ts || 0

        if (latestTs > 0) {
            const today = new Date(); today.setHours(0, 0, 0, 0);
            const thatDay = new Date(latestTs); thatDay.setHours(0, 0, 0, 0);
            const diffDays = Math.round((today - thatDay) / (1000 * 60 * 60 * 24));

            if (diffDays === 0) activeDate = 'Today'
            else if (diffDays === 1) activeDate = 'Yesterday'
            else if (diffDays < 7) activeDate = `${diffDays} days ago`
            else activeDate = thatDay.toLocaleDateString()
        }
        const date = activeDate
        const initial = name[0]?.toUpperCase() || '?'
        const isAdmin = role === 'admin'

        return `<tr class="group transition-colors">
          <td class="px-5 py-3">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-lg flex items-center justify-center font-heading text-sm flex-shrink-0 ${isAdmin ? 'bg-pink/20 border-2 border-pink/40 text-pink' : 'bg-blue/20 border-2 border-blue/40 text-blue'}">${initial}</div>
              <span class="font-bold text-white">${name}</span>
            </div>
          </td>
          <td class="hidden md:table-cell px-5 py-3"><span class="font-mono text-xs text-slate-500">${uid.slice(0, 12)}...</span></td>
          <td class="px-5 py-3">
            <select onchange="updateRole('${uid}', this.value)" 
              class="bg-slate-800 border-2 border-slate-700 rounded-lg text-[10px] font-black uppercase px-2 py-1 outline-none focus:border-blue transition-colors cursor-pointer ${isAdmin ? 'text-pink border-pink/40' : 'text-slate-400 border-slate-600'}">
              <option value="user" ${role === 'user' ? 'selected' : ''}>User</option>
              <option value="admin" ${isAdmin ? 'selected' : ''}>Admin</option>
            </select>
          </td>
          <td class="px-5 py-3">
            <div class="flex flex-col gap-1">
                <div class="flex justify-between items-center w-24">
                    <span class="text-[10px] font-bold text-white">${((profile?.storage_usage || 0) / (1024 * 1024)).toFixed(1)} MB</span>
                    <span class="text-[10px] text-slate-500 font-mono">${Math.min(100, Math.round(((profile?.storage_usage || 0) / (profile?.storage_limit || 50 * 1024 * 1024)) * 100))}%</span>
                </div>
                <div class="w-24 h-1 bg-slate-700 rounded-full overflow-hidden">
                    <div class="h-full ${((profile?.storage_usage || 0) / (profile?.storage_limit || 50 * 1024 * 1024)) * 100 < 60 ? 'bg-green' : (((profile?.storage_usage || 0) / (profile?.storage_limit || 50 * 1024 * 1024)) * 100 < 85 ? 'bg-orange' : 'bg-pink')}" 
                        style="width: ${Math.min(100, Math.round(((profile?.storage_usage || 0) / (profile?.storage_limit || 50 * 1024 * 1024)) * 100))}%"></div>
                </div>
            </div>
          </td>
          <td class="hidden lg:table-cell px-5 py-3">
            ${tools.length === 0 ? '<span class="text-xs text-slate-500 italic">No activity yet</span>' :
                `<div class="flex flex-wrap gap-1">
              ${tools.map(t => `<span class="chip bg-blue/10 text-blue border-blue/30">${t}</span>`).join('')}
            </div>`}
          </td>
          <td class="px-5 py-3 text-xs text-slate-500">${date}</td>
        </tr>`
    }).join('')
}

// ── PROGRESS TABLE ──
function renderProgressTable(rows) {
    const body = document.getElementById('progressTableBody')
    if (!body) return
    if (!rows.length) {
        body.innerHTML = '<tr><td colspan="5" class="text-center py-12 text-slate-500 font-bold">No progress rows found</td></tr>'
        return
    }

    body.innerHTML = rows.map(row => {
        const profile = allProfiles[row.user_id]
        const name = profile?.display_name || '—'
        const preview = JSON.stringify(row.data).slice(0, 60) + '…'
        const date = new Date(row.updated_at).toLocaleString()
        const initial = name[0]?.toUpperCase() || '?'

        return `<tr class="group transition-colors">
          <td class="px-5 py-3">
            <div class="flex items-center gap-2">
              <div class="w-7 h-7 rounded-lg bg-blue/20 border-2 border-blue/30 flex items-center justify-center text-blue text-xs font-heading flex-shrink-0">${initial}</div>
              <div>
                <div class="font-bold text-white text-sm">${name}</div>
                <div class="font-mono text-[10px] text-slate-600">${row.user_id.slice(0, 8)}...</div>
              </div>
            </div>
          </td>
          <td class="px-5 py-3">
            <span class="chip bg-orange/10 text-orange border-orange/30">${row.tool_key}</span>
          </td>
          <td class="hidden md:table-cell px-5 py-3 max-w-[200px]">
            <code class="text-[10px] text-slate-500 truncate block">${preview}</code>
          </td>
          <td class="px-5 py-3 text-xs text-slate-500 whitespace-nowrap">${date}</td>
          <td class="px-5 py-3">
            <div class="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onclick="openViewModal('${row.user_id}','${row.tool_key}')"
                class="neo-btn px-3 py-1.5 bg-blue text-white rounded-xl text-xs">
                <i data-lucide="eye" class="w-3 h-3"></i> View
              </button>
              <button onclick="openDeleteModal('${row.user_id}','${row.tool_key}')"
                class="neo-btn px-3 py-1.5 bg-red-500 text-white rounded-xl text-xs">
                <i data-lucide="trash-2" class="w-3 h-3"></i>
              </button>
            </div>
          </td>
        </tr>`
    }).join('')
    lucide.createIcons()
}

// ── NOTES TABLE ──
function renderNotesTable(rows) {
    const body = document.getElementById('notesTableBody')
    if (!body) return
    if (!rows.length) {
        body.innerHTML = '<tr><td colspan="4" class="text-center py-12 text-slate-500 font-bold">No notes found</td></tr>'
        return
    }

    body.innerHTML = rows.map(note => {
        const profile = allProfiles[note.user_id]
        const name = profile?.display_name || '—'
        // updated_at is a bigint (unix ms) in notes table
        const ts = Number(note.updated_at)
        const date = ts ? new Date(ts).toLocaleString() : '—'
        const initial = name[0]?.toUpperCase() || '?'
        // Resolve folder name from allNoteFolders
        let folderName = '—'
        if (note.folder_id) {
            const userFolders = allNoteFolders[note.user_id] || []
            const folder = userFolders.find(f => f.id === note.folder_id)
            if (folder) folderName = folder.name || folder.id
        }

        return `<tr class="group transition-colors">
          <td class="px-5 py-3">
            <div class="flex items-center gap-2">
              <div class="w-7 h-7 rounded-lg bg-orange/20 border-2 border-orange/30 flex items-center justify-center text-orange text-xs font-heading flex-shrink-0">${initial}</div>
              <div>
                <div class="font-bold text-white text-sm">${name}</div>
                <div class="font-mono text-[10px] text-slate-600">${note.user_id.slice(0, 8)}...</div>
              </div>
            </div>
          </td>
          <td class="px-5 py-3">
            <span class="font-bold text-slate-200">${note.title || 'Untitled'}</span>
          </td>
          <td class="hidden md:table-cell px-5 py-3">
            ${note.folder_id ? `<span class="chip bg-orange/10 text-orange border-orange/30">${folderName}</span>` : '<span class="text-xs text-slate-600 italic">Root</span>'}
          </td>
          <td class="hidden sm:table-cell px-5 py-3 text-xs text-slate-500 whitespace-nowrap">${date}</td>
          <td class="px-5 py-3">
            <div class="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onclick="openNoteModal('${note.id}')"
                class="neo-btn px-3 py-1.5 bg-blue text-white rounded-xl text-xs">
                <i data-lucide="eye" class="w-3 h-3"></i> View
              </button>
              <button onclick="openDeleteModal('${note.id}','note')"
                class="neo-btn px-3 py-1.5 bg-red-500 text-white rounded-xl text-xs">
                <i data-lucide="trash-2" class="w-3 h-3"></i>
              </button>
            </div>
          </td>
        </tr>`
    }).join('')
    lucide.createIcons()
}

// ── SCHEDULE EVENTS TABLE ──
function renderScheduleTable(rows) {
    const body = document.getElementById('scheduleTableBody')
    if (!body) return
    if (!rows || !rows.length) {
        body.innerHTML = '<tr><td colspan="6" class="text-center py-12 text-slate-500 font-bold">No schedule events found</td></tr>'
        return
    }
    const recurrenceLabels = { none: 'One-time', weekly: 'Weekly', daily: 'Daily', monthly: 'Monthly' }
    body.innerHTML = rows.map(ev => {
        const profile = allProfiles[ev.user_id]
        const name = profile?.display_name || '—'
        const initial = name[0]?.toUpperCase() || '?'
        const recLabel = recurrenceLabels[ev.recurrence] || ev.recurrence || 'One-time'
        const isRecurring = ev.recurrence && ev.recurrence !== 'none'
        return `<tr class="group transition-colors">
          <td class="px-5 py-3">
            <div class="flex items-center gap-2">
              <div class="w-7 h-7 rounded-lg bg-orange/20 border-2 border-orange/30 flex items-center justify-center text-orange text-xs font-heading flex-shrink-0">${initial}</div>
              <div>
                <div class="font-bold text-white text-sm">${name}</div>
                <div class="font-mono text-[10px] text-slate-600">${ev.user_id.slice(0, 8)}...</div>
              </div>
            </div>
          </td>
          <td class="px-5 py-3">
            <div class="flex items-center gap-2">
              <div class="w-3 h-3 rounded-full flex-shrink-0" style="background:${ev.color || '#FF8C42'}"></div>
              <span class="font-bold text-slate-200">${ev.name}</span>
            </div>
          </td>
          <td class="px-5 py-3">
            <span class="chip bg-blue/10 text-blue border-blue/30">${ev.type_id || 'other'}</span>
          </td>
          <td class="px-5 py-3 text-xs text-slate-300 whitespace-nowrap font-mono">${ev.date || '—'}</td>
          <td class="hidden md:table-cell px-5 py-3">
            <span class="chip ${isRecurring ? 'bg-orange/10 text-orange border-orange/30' : 'bg-slate-700 text-slate-400 border-slate-600'}">${recLabel}</span>
          </td>
        </tr>`
    }).join('')
    lucide.createIcons()
}

// ── SCHEDULE CLASSES VIEW ──
function renderClassesView(pagedClasses) {
    // Admin classes table
    const adminBody = document.getElementById('classAdminTableBody')
    if (adminBody) {
        if (!pagedClasses || !pagedClasses.length) {
            adminBody.innerHTML = '<tr><td colspan="5" class="text-center py-12 text-slate-500 font-bold">No admin classes found</td></tr>'
        } else {
            adminBody.innerHTML = pagedClasses.map(cls => {
                const profile = allProfiles[cls.user_id]
                const name = profile?.display_name || '—'
                const initial = name[0]?.toUpperCase() || '?'

                let tasks = cls.tasks;
                if (typeof tasks === 'string') {
                    try { tasks = JSON.parse(tasks); } catch (e) { tasks = []; }
                }
                const taskCount = Array.isArray(tasks) ? tasks.length : 0;

                const created = new Date(cls.created_at).toLocaleDateString()
                return `<tr class="group transition-colors">
              <td class="px-5 py-3">
                <div class="flex items-center gap-2">
                  <div class="w-7 h-7 rounded-lg bg-orange/20 border-2 border-orange/30 flex items-center justify-center text-orange text-xs font-heading flex-shrink-0">${initial}</div>
                  <span class="font-bold text-white text-sm">${name}</span>
                </div>
              </td>
              <td class="px-5 py-3"><span class="font-bold text-slate-200">${cls.class_name}</span></td>
              <td class="px-5 py-3"><span class="chip bg-orange/10 text-orange border-orange/30">${taskCount} task${taskCount !== 1 ? 's' : ''}</span></td>
              <td class="hidden sm:table-cell px-5 py-3 text-xs text-slate-500">${created}</td>
              <td class="px-5 py-3">
                <div class="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onclick="openClassModal('${cls.id}','admin')" class="neo-btn px-3 py-1.5 bg-blue text-white rounded-xl text-xs">
                    <i data-lucide="eye" class="w-3 h-3"></i> View
                  </button>
                </div>
              </td>
            </tr>`
            }).join('')
        }
    }

    // Units table
    const unitsBody = document.getElementById('classUnitsTableBody')
    if (unitsBody) {
        if (!allClassUnits.length) {
            unitsBody.innerHTML = '<tr><td colspan="5" class="text-center py-12 text-slate-500 font-bold">No class units found</td></tr>'
        } else {
            unitsBody.innerHTML = allClassUnits.map(cls => {
                const profile = allProfiles[cls.user_id]
                const name = profile?.display_name || '—'
                const initial = name[0]?.toUpperCase() || '?'

                let syllabus = cls.syllabus;
                if (typeof syllabus === 'string') {
                    try { syllabus = JSON.parse(syllabus); } catch (e) { syllabus = []; }
                }
                const unitCount = Array.isArray(syllabus) ? syllabus.length : 0;

                const created = new Date(cls.created_at).toLocaleDateString()
                return `<tr class="group transition-colors">
              <td class="px-5 py-3">
                <div class="flex items-center gap-2">
                  <div class="w-7 h-7 rounded-lg bg-orange/20 border-2 border-orange/30 flex items-center justify-center text-orange text-xs font-heading flex-shrink-0">${initial}</div>
                  <span class="font-bold text-white text-sm">${name}</span>
                </div>
              </td>
              <td class="px-5 py-3"><span class="font-bold text-slate-200">${cls.class_name}</span></td>
              <td class="px-5 py-3"><span class="chip bg-orange/10 text-orange border-orange/30">${unitCount} unit${unitCount !== 1 ? 's' : ''}</span></td>
              <td class="hidden sm:table-cell px-5 py-3 text-xs text-slate-500">${created}</td>
              <td class="px-5 py-3">
                <div class="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onclick="openClassModal('${cls.id}','units')" class="neo-btn px-3 py-1.5 bg-blue text-white rounded-xl text-xs">
                    <i data-lucide="eye" class="w-3 h-3"></i> View
                  </button>
                </div>
              </td>
            </tr>`
            }).join('')
        }
    }
    lucide.createIcons()
}

function setClassTab(tab) {
    scheduleClassTab = tab
    document.getElementById('classview-admin').classList.toggle('hidden', tab !== 'admin')
    document.getElementById('classview-units').classList.toggle('hidden', tab !== 'units')
    const adminBtn = document.getElementById('classtab-admin')
    const unitsBtn = document.getElementById('classtab-units')
    adminBtn.className = `neo-btn px-4 py-2 ${tab === 'admin' ? 'bg-orange text-white' : 'bg-slate-700 text-slate-300'} rounded-xl text-sm font-bold`
    unitsBtn.className = `neo-btn px-4 py-2 ${tab === 'units' ? 'bg-orange text-white' : 'bg-slate-700 text-slate-300'} rounded-xl text-sm`
}

function setDataTab(tab) {
    const tabs = ['progress', 'notes', 'schedule', 'classes']
    tabs.forEach(t => {
        const btn = document.getElementById('datatab-' + t)
        const view = document.getElementById('dataview-' + t)
        if (btn) {
            btn.className = `neo-btn px-4 py-2 ${t === tab ? 'bg-blue text-white font-bold' : 'bg-slate-800 text-slate-300'} rounded-xl text-sm`
        }
        if (view) {
            view.classList.toggle('hidden', t !== tab)
        }
    })
    lucide.createIcons()
}

function openClassModal(id, type) {
    const item = type === 'admin'
        ? allClassAdmin.find(c => c.id === id)
        : allClassUnits.find(c => c.id === id)
    if (!item) return
    const profile = allProfiles[item.user_id]
    const label = type === 'admin' ? 'Admin Tasks' : 'Syllabus Units'
    document.getElementById('viewModalTitle').textContent = `${item.class_name} — ${label}`
    document.getElementById('viewModalSub').textContent = (profile?.display_name || item.user_id.slice(0, 8)) + ' · ' + new Date(item.created_at).toLocaleDateString()
    document.getElementById('viewModalContent').textContent = JSON.stringify(type === 'admin' ? item.tasks : item.syllabus, null, 2)
    document.getElementById('viewModalBg').classList.remove('hidden')
}

function openNoteModal(noteId) {
    const note = allNotes.find(n => n.id === noteId)
    if (!note) return
    const profile = allProfiles[note.user_id]

    document.getElementById('viewModalTitle').textContent =
        (profile?.display_name || note.user_id.slice(0, 8)) + ' — ' + (note.title || 'Untitled')
    document.getElementById('viewModalSub').textContent =
        'Updated ' + (Number(note.updated_at) ? new Date(Number(note.updated_at)).toLocaleString() : '—')
    document.getElementById('viewModalContent').textContent = note.content
    document.getElementById('viewModalBg').classList.remove('hidden')
}

// ── VIEW MODAL ──
function openViewModal(userId, toolKey) {
    const row = allProgress.find(r => r.user_id === userId && r.tool_key === toolKey)
    const profile = allProfiles[userId]
    if (!row) return

    document.getElementById('viewModalTitle').textContent =
        (profile?.display_name || userId.slice(0, 8)) + ' — ' + toolKey
    document.getElementById('viewModalSub').textContent =
        'Updated ' + new Date(row.updated_at).toLocaleString()
    document.getElementById('viewModalContent').textContent =
        JSON.stringify(row.data, null, 2)
    document.getElementById('viewModalBg').classList.remove('hidden')
}

function closeViewModal() {
    document.getElementById('viewModalBg').classList.add('hidden')
}

// ── VIEW USER ──
function viewUser(userId) {
    const userRows = allProgress.filter(r => r.user_id === userId)
    const profile = allProfiles[userId]
    const name = profile?.display_name || userId.slice(0, 8)
    const firstTool = userRows[0]?.tool_key || ''
    if (userRows.length === 1) {
        openViewModal(userId, firstTool)
    } else {
        // Show first row; user can use progress table for individual rows
        openViewModal(userId, firstTool)
    }
}

// ── DELETE MODAL ──
function openDeleteModal(idOrUser, toolOrType) {
    let title = "Delete Item?"
    let msg = "This action cannot be undone."

    if (toolOrType === 'announcement') {
        const ann = allAnnouncements.find(a => a.id === idOrUser)
        title = "Delete Announcement?"
        msg = `Permanently delete "${ann?.title || 'this announcement'}"?`
        pendingDelete = { id: idOrUser, type: 'announcement' }
    } else if (toolOrType === 'note') {
        const note = allNotes.find(n => n.id === idOrUser)
        title = "Delete Note?"
        msg = `Permanently delete note "${note?.title || 'Untitled'}"?`
        pendingDelete = { id: idOrUser, type: 'note' }
    } else {
        const profile = allProfiles[idOrUser]
        const name = profile?.display_name || idOrUser.slice(0, 8)
        title = "Delete Progress?"
        msg = `This will permanently delete "${toolOrType}" data for ${name}.`
        pendingDelete = { userId: idOrUser, toolKey: toolOrType, type: 'progress' }
    }

    document.getElementById('deleteModalTitle').textContent = title
    document.getElementById('deleteModalMsg').textContent = msg
    document.getElementById('deleteModalBg').classList.remove('hidden')
    lucide.createIcons()
}

function closeDeleteModal() {
    document.getElementById('deleteModalBg').classList.add('hidden')
    pendingDelete = null
}

async function executeDelete() {
    if (!pendingDelete) return

    if (pendingDelete.type === 'announcement') {
        const { error } = await db.from('announcements').delete().eq('id', pendingDelete.id)
        if (error) showToast('Error: ' + error.message, 'error')
        else {
            showToast('Announcement deleted')
            fetchData()
        }
    } else if (pendingDelete.type === 'note') {
        const { error } = await db.from('notes').delete().eq('id', pendingDelete.id)
        if (error) showToast('Error: ' + error.message, 'error')
        else {
            showToast('Note deleted')
            allNotes = allNotes.filter(n => n.id !== pendingDelete.id)
            updateStats()
            applyFilters()
        }
    } else {
        const { userId, toolKey } = pendingDelete
        const { error } = await db
            .from('user_progress')
            .delete()
            .match({ user_id: userId, tool_key: toolKey })

        if (error) { showToast('Error: ' + error.message, 'error') }
        else {
            showToast('Progress data deleted')
            allProgress = allProgress.filter(r => !(r.user_id === userId && r.tool_key === toolKey))
            updateStats()
            applyFilters()
        }
    }
    closeDeleteModal()
}

// ── LOGS ──
function renderLogsTable() {
    const body = document.getElementById('logsTableBody')
    if (!body) return
    const recent = allProgress.slice(0, 50) // Show last 50 actions

    body.innerHTML = recent.map(row => {
        const profile = allProfiles[row.user_id]
        const name = profile?.display_name || row.user_id.slice(0, 8)
        const date = new Date(row.updated_at).toLocaleString()
        const initial = name[0]?.toUpperCase() || '?'

        return `<tr class="hover:bg-blue/5 transition-colors">
            <td class="hidden md:table-cell px-5 py-3 text-xs text-slate-500 font-mono">${date}</td>
            <td class="px-5 py-3">
              <div class="flex items-center gap-2">
                <div class="w-6 h-6 rounded bg-slate-700 flex items-center justify-center text-[10px] font-bold">${initial}</div>
                <span class="text-white font-medium">${name}</span>
              </div>
            </td>
            <td class="px-5 py-3">
              <span class="text-slate-300 uppercase text-[10px] font-black tracking-widest">Update Progress</span>
            </td>
            <td class="hidden sm:table-cell px-5 py-3">
              <span class="chip bg-blue/10 text-blue border-blue/20">${row.tool_key}</span>
            </td>
          </tr>`
    }).join('')
}

// ── SETTINGS ──
function debouncedSaveSettings() {
    clearTimeout(settingsTimeout)
    settingsTimeout = setTimeout(saveSettings, 500)
}

function saveSettings() {
    const settings = {
        maintenance: document.getElementById('setting-maintenance').checked,
        sync: document.getElementById('setting-sync').checked,
        announcement: document.getElementById('setting-announcement').value
    }
    localStorage.setItem('kk_admin_settings', JSON.stringify(settings))
    // In a real app, you would also save to Supabase here
    console.log('[Admin] Settings saved:', settings)
}

function loadSettings() {
    const saved = localStorage.getItem('kk_admin_settings')
    if (saved) {
        const settings = JSON.parse(saved)
        const maint = document.getElementById('setting-maintenance')
        const sync = document.getElementById('setting-sync')
        const ann = document.getElementById('setting-announcement')
        if (maint) maint.checked = settings.maintenance || false
        if (sync) sync.checked = settings.sync !== false
        if (ann) ann.value = settings.announcement || ''
    }
}

// ── USER MANAGEMENT ──
async function updateRole(userId, newRole) {
    const row = allProfiles[userId]
    if (!row) return

    if (!confirm(`Change role for ${row.display_name || userId} to ${newRole.toUpperCase()}?`)) {
        applyFilters() // Reset dropdown
        return
    }

    const { error } = await db
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId)

    if (error) {
        showToast('Error updating role: ' + error.message, 'error')
    } else {
        allProfiles[userId].role = newRole
        showToast('User role updated')
        applyFilters()
    }
}

function toggleSidebar() {
    const sb = document.getElementById('sidebar');
    const overlay = document.getElementById('mobileOverlay');
    if (sb) sb.classList.toggle('-translate-x-full');
    if (overlay) overlay.classList.toggle('hidden');
}

// ── NAV ──
function setView(view) {
    const sb = document.getElementById('sidebar');
    if (sb && !sb.classList.contains('-translate-x-full') && window.innerWidth < 1024) {
        toggleSidebar();
    }

    ['dashboard', 'users', 'data-details', 'logs', 'announcements', 'cloud', 'settings'].forEach(v => {
        const viewEl = document.getElementById('view-' + v)
        if (viewEl) viewEl.classList.toggle('hidden', v !== view)

        if (v === view) {
            const titles = {
                dashboard: 'Dashboard',
                users: 'User Management',
                'data-details': 'Data Details',
                logs: 'Audit Logs',
                announcements: 'Announcements',
                cloud: 'Cloud Storage',
                settings: 'Settings'
            }
            const viewTitle = document.getElementById('view-title')
            if (viewTitle) viewTitle.textContent = titles[v] || v
        }

        const btn = document.getElementById('nav-' + v)
        if (btn) {
            btn.classList.toggle('active', v === view)
            btn.classList.toggle('text-slate-400', v !== view)
            btn.classList.toggle('text-slate-300', v === view)
        }
    })
    currentView = view
    if (view === 'logs') renderLogsTable()
    if (view === 'settings') loadSettings()
    if (view === 'announcements') renderAnnouncements()
    if (view === 'cloud') renderCloudTable()
    if (view === 'data-details') applyFilters()
}

// ── CLOUD USAGE LOGIC ──
function renderCloudTable() {
    const body = document.getElementById('cloudTableBody')
    if (!body) return

    let profiles = Object.values(allProfiles)

    // Sort Cloud Usage
    profiles.sort((a, b) => {
        const conf = sortConfig.cloud
        let valA, valB

        if (conf.col === 'user') {
            valA = (a.display_name || '').toLowerCase()
            valB = (b.display_name || '').toLowerCase()
        } else if (conf.col === 'usage') {
            valA = a.storage_usage || 0
            valB = b.storage_usage || 0
        } else if (conf.col === 'limit') {
            valA = a.storage_limit || (50 * 1024 * 1024)
            valB = b.storage_limit || (50 * 1024 * 1024)
        } else if (conf.col === 'percent') {
            valA = (a.storage_usage || 0) / (a.storage_limit || 50 * 1024 * 1024)
            valB = (b.storage_usage || 0) / (b.storage_limit || 50 * 1024 * 1024)
        }

        if (valA < valB) return conf.dir === 'asc' ? -1 : 1
        if (valA > valB) return conf.dir === 'asc' ? 1 : -1
        return 0
    })

    // Pagination for Cloud
    const cloudPages = Math.ceil(profiles.length / PAGE_SIZE) || 1
    if (pagination.cloud > cloudPages) pagination.cloud = cloudPages
    const cloudStart = (pagination.cloud - 1) * PAGE_SIZE
    const pagedProfiles = profiles.slice(cloudStart, cloudStart + PAGE_SIZE)
    const cloudPageInfo = document.getElementById('cloud-page-info')
    if (cloudPageInfo) cloudPageInfo.textContent = `Page ${pagination.cloud} of ${cloudPages}`

    // Pagination counts for reliable clamping
    pagination.lastFilteredCounts.cloud = profiles.length

    let totalUsed = 0
    let totalLimit = 0

    body.innerHTML = pagedProfiles.map(p => {
        const used = p.storage_usage || 0
        const limit = p.storage_limit || (50 * 1024 * 1024)
        const percent = Math.min(100, Math.round((used / limit) * 100))
        const usedMB = (used / (1024 * 1024)).toFixed(1)
        const limitMB = (limit / (1024 * 1024)).toFixed(0)
        const barColor = percent < 60 ? 'bg-green' : (percent < 85 ? 'bg-orange' : 'bg-pink')
        const name = p.display_name || '—'
        const initial = name[0]?.toUpperCase() || '?'

        totalUsed += used
        totalLimit += limit

        return `
            <tr class="group hover:bg-slate-700/20 transition-colors">
                <td class="px-5 py-4">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-lg bg-blue/20 border-2 border-blue/40 flex items-center justify-center font-heading text-blue text-xs flex-shrink-0">${initial}</div>
                        <div>
                            <div class="font-bold text-white text-sm">${name}</div>
                            <div class="hidden md:block text-[10px] text-slate-500 font-mono">${p.id.slice(0, 12)}...</div>
                        </div>
                    </div>
                </td>
                <td class="px-5 py-4 font-mono text-xs text-white">${usedMB} MB</td>
                <td class="hidden md:table-cell px-5 py-4 font-mono text-xs text-slate-400">${limitMB} MB</td>
                <td class="px-5 py-4">
                    <div class="flex flex-col gap-1 w-32">
                        <div class="flex justify-between text-[10px] font-bold">
                            <span class="${percent > 85 ? 'text-pink' : 'text-blue'}">${percent}%</span>
                        </div>
                        <div class="h-2 bg-slate-900 border-2 border-slate-700 rounded-full overflow-hidden">
                            <div class="h-full ${barColor} transition-all duration-500" style="width: ${percent}%"></div>
                        </div>
                    </div>
                </td>
                <td class="px-5 py-4 text-right">
                    <button onclick="syncUserStorage('${p.id}')" id="sync-btn-${p.id}" class="neo-btn px-3 py-1.5 bg-slate-800 text-slate-300 rounded-lg text-[10px] hover:text-white group-hover:border-blue transition-colors">
                        <i data-lucide="refresh-cw" class="w-3 h-3 sync-icon-${p.id}"></i> Sync
                    </button>
                </td>
            </tr>
        `
    }).join('')

    // Update Summary
    const globalUsedMB = (totalUsed / (1024 * 1024)).toFixed(1)
    const globalLimitMB = (totalLimit / (1024 * 1024)).toFixed(0)
    const globalPercent = totalLimit > 0 ? Math.min(100, Math.round((totalUsed / totalLimit) * 100)) : 0

    const globalStorageUsed = document.getElementById('globalStorageUsed')
    const globalStorageBar = document.getElementById('globalStorageBar')
    if (globalStorageUsed) globalStorageUsed.textContent = `${globalUsedMB} MB / ${globalLimitMB} MB`
    if (globalStorageBar) {
        globalStorageBar.style.width = `${globalPercent}%`
        globalStorageBar.className = `h-full transition-all duration-700 ${globalPercent > 90 ? 'bg-pink' : 'bg-blue'}`
    }

    const activeUsers = profiles.filter(p => (p.storage_usage || 0) > 0).length
    const globalActiveUsers = document.getElementById('globalActiveUsers')
    if (globalActiveUsers) globalActiveUsers.textContent = activeUsers

    updateSortIcons()
    lucide.createIcons()
}

// ── SORTING HELPERS ──
function toggleSort(tableView, col) {
    const conf = sortConfig[tableView]
    if (conf.col === col) {
        conf.dir = conf.dir === 'asc' ? 'desc' : 'asc'
    } else {
        conf.col = col
        conf.dir = 'asc'
    }

    pagination[tableView] = 1 // Reset to first page
    if (tableView === 'cloud') renderCloudTable()
    else applyFilters()
}

function changePage(tableView, delta) {
    const count = pagination.lastFilteredCounts?.[tableView] || 0
    const maxPages = Math.ceil(count / PAGE_SIZE) || 1

    pagination[tableView] += delta
    if (pagination[tableView] < 1) pagination[tableView] = 1
    if (pagination[tableView] > maxPages) pagination[tableView] = maxPages

    if (tableView === 'cloud') renderCloudTable()
    else applyFilters()
}

function updateSortIcons() {
    // Clear all sort indicators
    document.querySelectorAll('[id^="sort-"]').forEach(el => el.innerHTML = '')

    // Add current indicator
    Object.entries(sortConfig).forEach(([view, conf]) => {
        const el = document.getElementById(`sort-${view}-${conf.col}`)
        if (el) {
            const icon = conf.dir === 'asc' ? 'chevron-up' : 'chevron-down'
            el.innerHTML = `<i data-lucide="${icon}" class="w-3 h-3 text-blue"></i>`
        }
    })
    lucide.createIcons()
}

async function syncUserStorage(userId) {
    const btn = document.getElementById(`sync-btn-${userId}`)
    const icon = document.querySelector(`.sync-icon-${userId}`)
    if (icon) icon.classList.add('animate-spin')
    if (btn) btn.disabled = true

    try {
        const result = await recalculateUserStorage(userId)

        // Update local state
        if (allProfiles[userId]) {
            allProfiles[userId].storage_usage = result.used
        }

        if (currentView === 'cloud') renderCloudTable()
        if (currentView === 'users') applyFilters()
        updateStats()

    } catch (err) {
        console.error('[Sync] Error:', err)
        showToast(`Failed to sync storage: ${err.message}`, 'error')
    } finally {
        if (icon) icon.classList.remove('animate-spin')
        if (btn) btn.disabled = false
    }
}

async function syncAllStorage() {
    const btn = document.getElementById('syncAllBtn')
    const icon = btn ? btn.querySelector('i') : null
    if (icon) icon.classList.add('animate-spin')
    if (btn) btn.disabled = true

    const userIds = Object.keys(allProfiles)
    let successCount = 0

    for (const uid of userIds) {
        try {
            await syncUserStorage(uid)
            successCount++
        } catch (e) {
            console.warn(`[SyncAll] Failed for ${uid}:`, e)
        }
    }

    if (icon) icon.classList.remove('animate-spin')
    if (btn) btn.disabled = false
    showToast(`Sync complete! Updated ${successCount} users.`)
}

// ── ANNOUNCEMENTS LOGIC ──
async function saveAnnouncement(e) {
    e.preventDefault()
    const id = document.getElementById('announcementId').value
    const payload = {
        title: document.getElementById('annTitle').value,
        type: document.getElementById('annType').value,
        content: document.getElementById('annContent').value,
        is_active: document.getElementById('annActive').checked
    }

    let res
    if (id) {
        res = await db.from('announcements').update(payload).eq('id', id)
    } else {
        res = await db.from('announcements').insert([payload])
    }

    if (res.error) {
        showToast('Error saving: ' + res.error.message, 'error')
    } else {
        showToast('Announcement saved')
        resetAnnForm()
        fetchData()
    }
}

function renderAnnouncements() {
    const list = document.getElementById('annList')
    const count = document.getElementById('annCount')
    if (!list) return

    if (count) count.textContent = allAnnouncements.length + ' items'

    if (!allAnnouncements.length) {
        list.innerHTML = '<div class="p-12 text-center text-slate-500 font-bold">No announcements created yet.</div>'
        return
    }

    list.innerHTML = allAnnouncements.map(ann => {
        const date = new Date(ann.created_at).toLocaleDateString()
        const typeColors = {
            info: 'blue',
            update: 'green',
            alert: 'orange'
        }
        const color = typeColors[ann.type] || 'blue'

        return `
            <div class="p-5 hover:bg-slate-700/30 transition-colors group">
                <div class="flex items-start justify-between mb-2">
                    <div class="flex items-center gap-3">
                        <span class="chip bg-${color}/10 text-${color} border-${color}/30 uppercase">${ann.type}</span>
                        <h3 class="font-bold text-white">${ann.title}</h3>
                    </div>
                    <div class="flex items-center gap-2">
                        <span class="text-[10px] font-mono text-slate-500">${date}</span>
                        ${!ann.is_active ? '<span class="chip bg-slate-700 text-slate-400 border-slate-600">DRAFT</span>' : ''}
                    </div>
                </div>
                <p class="text-sm text-slate-400 mb-4 whitespace-pre-wrap">${ann.content}</p>
                <div class="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onclick="editAnnouncement('${ann.id}')" class="neo-btn px-3 py-1.5 bg-blue/20 text-blue border-blue/30 rounded-lg text-xs">Edit</button>
                    <button onclick="openDeleteModal('${ann.id}', 'announcement')" class="neo-btn px-3 py-1.5 bg-red-500/20 text-red-400 border-red-500/30 rounded-lg text-xs">Delete</button>
                </div>
            </div>
        `
    }).join('')
}

function editAnnouncement(id) {
    const ann = allAnnouncements.find(a => a.id === id)
    if (!ann) return
    document.getElementById('announcementId').value = ann.id
    document.getElementById('annTitle').value = ann.title
    document.getElementById('annType').value = ann.type
    document.getElementById('annContent').value = ann.content
    document.getElementById('annActive').checked = ann.is_active
    window.scrollTo({ top: 0, behavior: 'smooth' })
}


function resetAnnForm() {
    const form = document.getElementById('announcementForm')
    const id = document.getElementById('announcementId')
    if (form) form.reset()
    if (id) id.value = ''
}

// Keyboard shortcuts
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeViewModal(); closeDeleteModal() }
})

init()
