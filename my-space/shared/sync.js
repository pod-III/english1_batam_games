/* ============================================
   SYNC.JS — Dual-mode Data Layer
   Shared by Schedule + Admin Tracker
   ============================================
   Cloud mode:  User is logged in via Supabase (not sandbox)
   Sandbox mode: localStorage only
   
   Exports (on window.Sync):
     isCloudMode()
     syncToCloud(userId)
     loadFromCloud(userId)
     setSyncBadge(state)

     cloudLoadScheduleEvents(userId)
     cloudSaveScheduleEvents(userId, events)
     cloudLoadRedDays(userId)
     cloudSaveRedDays(userId, redDays)
     cloudLoadClassAdmin(userId)
     cloudSaveClassAdmin(userId, data)
     cloudLoadClassUnits(userId)
     cloudSaveClassUnits(userId, data)
   ============================================ */

(function () {
  'use strict';

  // ── Sync badge state ─────────────────────────────────────────────
  const BADGE_STATES = {
    synced:  { icon: 'cloud',     text: 'Synced',     cls: 'bg-green/10 text-green  border-green/30' },
    syncing: { icon: 'loader',    text: 'Syncing…',   cls: 'bg-orange/10 text-orange border-orange/30 animate-pulse' },
    local:   { icon: 'hard-drive', text: 'Local',      cls: 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-[var(--border-primary)]' },
    error:   { icon: 'alert-triangle', text: 'Sync Error', cls: 'bg-pink/10 text-pink border-pink/30' },
  };

  function setSyncBadge(state) {
    const badge = document.getElementById('sync-badge');
    if (!badge) return;
    const s = BADGE_STATES[state] || BADGE_STATES.local;
    badge.className = `flex items-center gap-1.5 px-3 py-1.5 rounded-xl border-[2px] text-xs font-extrabold uppercase tracking-widest ${s.cls}`;
    badge.innerHTML = `<i data-lucide="${s.icon}" class="w-3 h-3"></i> ${s.text}`;
    if (window.lucide) lucide.createIcons({ root: badge });
  }

  // ── Mode detection ───────────────────────────────────────────────
  function isCloudMode() {
    return !isSandbox(); // isSandbox() is global from supabase.js
  }

  // ── Column-mapping helpers ───────────────────────────────────────
  function isPromoted(evt) {
    if (!evt.isRecurrence) return false;
    // Mark recurring instance as modified so it gets promoted
    if (evt._modified) return true;
    // Check for custom notes
    if (evt.notes && evt.notes.trim() !== '') return true;
    // Check for completed checklist items
    if (evt.checklist && evt.checklist.some(item => item.done)) return true;
    // Check for date/time changes
    if (evt.originalDate && evt.date !== evt.originalDate) return true;
    if (evt.originalStartTime && evt.startTime !== evt.originalStartTime) return true;
    if (evt.originalEndTime && evt.endTime !== evt.originalEndTime) return true;

    // Check for lesson plan changes
    if (evt.lessonPlan) {
      const status = evt.lessonPlan.status;
      // Promote if status is anything other than 'not_ready'
      if (status && status !== 'not_ready') return true;
      // Promote if it has a unit (non-default)
      if (evt.lessonPlan.unit && evt.lessonPlan.unit.trim() !== '') return true;
      // Promote if it has a lesson topic
      if (evt.lessonPlan.lesson && evt.lessonPlan.lesson.trim() !== '') return true;
    }
    return false;
  }

  // schedule_events: JS → SQL
  function sanitiseForCloud(evt, userId) {
    // Guard: Skip recurrence clones that haven't been modified (promoted)
    if (evt.id.includes('_recur_') && !isPromoted(evt)) return null;

    return {
      id: evt.id,
      user_id: userId,
      name: evt.name,
      type_id: evt.typeId,
      color: evt.color,
      date: evt.date,
      start_time: evt.startTime,
      end_time: evt.endTime,
      room: evt.room || '',
      notes: evt.notes || '',
      recurrence: evt.recurrence || 'none',
      recurrence_days: evt.recurrenceDays || [],
      checklist: evt.checklist || [],
      lesson_plan: evt.lessonPlan || { unit: '', lesson: '', status: 'not_ready' },
      graduation_class: !!evt.graduationClass,
      graduation_date: evt.graduationDate || null,
      is_master: !evt.isRecurrence,
      master_event_id: evt.isRecurrence ? (evt.originalEventId || null) : null,
      created_at: evt.createdAt || new Date().toISOString(),
      updated_at: evt.updatedAt || new Date().toISOString(),
    };
  }

  // schedule_events: SQL → JS
  function rowToEvent(row) {
    return {
      id: row.id,
      name: row.name,
      typeId: row.type_id,
      color: row.color,
      date: row.date,
      startTime: row.start_time,
      endTime: row.end_time,
      room: row.room || '',
      notes: row.notes || '',
      recurrence: row.recurrence || 'none',
      recurrenceDays: row.recurrence_days || [],
      checklist: row.checklist || [],
      lessonPlan: row.lesson_plan || { unit: '', lesson: '', status: 'not_ready' },
      graduationClass: !!row.graduation_class,
      graduationDate: row.graduation_date || '',
      isRecurrence: !row.is_master,
      originalEventId: row.master_event_id || null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  // Helper: strip recurrence clones — only master events go to cloud
  function mastersOnly(events) {
    return events.filter(e => !e.isRecurrence);
  }

  // schedule_red_days: JS → SQL
  function redDayToRow(dateStr, userId) {
    return { user_id: userId, date: dateStr };
  }

  // schedule_class_admin: JS → SQL
  // localStorage shape: { "ClassName": { tasks: [...] } }
  // Supabase shape: one row per task
  function classAdminToRow(className, task, userId) {
    return {
      id: task.id || ((window.crypto && crypto.randomUUID) ? crypto.randomUUID() : '00000000-0000-4000-8000-' + Date.now().toString(16).padStart(12, '0')),
      user_id: userId,
      class_name: className,
      text: task.text,
      done: !!task.done,
      deadline: task.deadline || null,
    };
  }

  function rowToTask(row) {
    return {
      id: row.id,
      text: row.text,
      done: !!row.done,
      deadline: row.deadline || null,
    };
  }

  // schedule_class_units: JS → SQL
  // localStorage shape: { "ClassName": { "UnitName": { status: "draft" } } }
  // Supabase shape: one row per (class_name, unit_name)
  function classUnitToRow(className, unitName, unitObj, userId) {
    return {
      user_id: userId,
      class_name: className,
      unit_name: unitName,
      status: unitObj.status || 'draft',
    };
  }

  // ── Per-table Cloud CRUD ─────────────────────────────────────────

  // Events
  async function cloudLoadScheduleEvents(userId) {
    const [mastersRes, promotedRes] = await Promise.all([
      db.from('schedule_events').select('*').eq('user_id', userId).eq('is_master', true),
      db.from('schedule_events').select('*').eq('user_id', userId).eq('is_master', false)
    ]);

    if (mastersRes.error) console.error('[Sync] Load masters error:', mastersRes.error);
    if (promotedRes.error) console.error('[Sync] Load promoted error:', promotedRes.error);

    return {
      masters: (mastersRes.data || []).map(rowToEvent),
      promoted: (promotedRes.data || []).map(rowToEvent)
    };
  }

  async function cloudSaveScheduleEvents(userId, events) {
    // Build rows, filter nulls, upsert all
    const rows = events.map(e => sanitiseForCloud(e, userId)).filter(r => r !== null);
    if (rows.length === 0) return;
    const { error } = await db.from('schedule_events')
      .upsert(rows, { onConflict: 'id' });
    if (error) console.error('[Sync] Save events error:', error);
  }

  async function cloudDeleteScheduleEvent(userId, eventId, isMaster = false) {
    let query = db.from('schedule_events').delete().eq('user_id', userId);
    if (isMaster) {
      // Delete master and all its recurrence clones
      query = query.or(`id.eq.${eventId},master_event_id.eq.${eventId}`);
    } else {
      query = query.eq('id', eventId);
    }
    const { error } = await query;
    if (error) console.error('[Sync] Delete event error:', error);
  }

  async function cloudReplaceAllScheduleEvents(userId, events) {
    // Delete all then insert fresh (for full sync)
    await db.from('schedule_events').delete().eq('user_id', userId);
    const rows = events.map(e => sanitiseForCloud(e, userId)).filter(r => r !== null);
    if (rows.length > 0) {
      const { error } = await db.from('schedule_events').insert(rows);
      if (error) console.error('[Sync] Replace events error:', error);
    }
  }

  // Red Days
  async function cloudLoadRedDays(userId) {
    const { data, error } = await db.from('schedule_red_days')
      .select('date').eq('user_id', userId);
    if (error) { console.error('[Sync] Load red days error:', error); return null; }
    return (data || []).map(r => r.date);
  }

  async function cloudSaveRedDays(userId, redDays) {
    // Replace all
    await db.from('schedule_red_days').delete().eq('user_id', userId);
    if (redDays.length > 0) {
      const rows = redDays.map(d => redDayToRow(d, userId));
      const { error } = await db.from('schedule_red_days').insert(rows);
      if (error) console.error('[Sync] Save red days error:', error);
    }
  }

  // Class Admin
  async function cloudLoadClassAdmin(userId) {
    const { data, error } = await db.from('schedule_class_admin')
      .select('*').eq('user_id', userId);
    if (error) { console.error('[Sync] Load class admin error:', error); return null; }
    const result = {};
    (data || []).forEach(row => {
      if (!result[row.class_name]) result[row.class_name] = { tasks: [] };
      result[row.class_name].tasks.push(rowToTask(row));
    });
    return result;
  }

  async function cloudSaveClassAdmin(userId, adminData) {
    // Collect all tasks from all classes
    const rows = [];
    Object.entries(adminData).forEach(([className, obj]) => {
      if (obj.tasks) {
        obj.tasks.forEach(task => {
          rows.push(classAdminToRow(className, task, userId));
        });
      }
    });

    if (rows.length === 0) {
      // If data is empty, clear the table for this user
      await db.from('schedule_class_admin').delete().eq('user_id', userId);
      return;
    }

    // Full replace approach to handle deletions correctly
    await db.from('schedule_class_admin').delete().eq('user_id', userId);
    const { error } = await db.from('schedule_class_admin').insert(rows);
    if (error) console.error('[Sync] Save class admin error:', error);
  }

  // Class Units
  async function cloudLoadClassUnits(userId) {
    const { data, error } = await db.from('schedule_class_units')
      .select('*').eq('user_id', userId);
    if (error) { console.error('[Sync] Load class units error:', error); return null; }
    const result = {};
    (data || []).forEach(row => {
      if (!result[row.class_name]) result[row.class_name] = {};
      result[row.class_name][row.unit_name] = { status: row.status || 'draft' };
    });
    return result;
  }

  async function cloudSaveClassUnits(userId, unitsData) {
    await db.from('schedule_class_units').delete().eq('user_id', userId);
    const rows = [];
    Object.entries(unitsData).forEach(([className, units]) => {
      Object.entries(units).forEach(([unitName, unitObj]) => {
        rows.push(classUnitToRow(className, unitName, unitObj, userId));
      });
    });
    if (rows.length > 0) {
      const { error } = await db.from('schedule_class_units').insert(rows);
      if (error) console.error('[Sync] Save class units error:', error);
    }
  }

  // ── Bulk sync helpers ────────────────────────────────────────────

  async function syncToCloud(userId) {
    console.log('[Sync] Syncing localStorage → Cloud for', userId);
    setSyncBadge('syncing');
    try {
      // Read from localStorage
      const eventsRaw = localStorage.getItem('schedule_events');
      const promotedRaw = localStorage.getItem('schedule_promoted_instances');
      const redDaysRaw = localStorage.getItem('schedule_red_days');
      const adminRaw = localStorage.getItem('schedule_class_admin');
      const unitsRaw = localStorage.getItem('schedule_class_units');

      const evts = eventsRaw ? JSON.parse(eventsRaw) : [];
      const prom = promotedRaw ? JSON.parse(promotedRaw) : [];
      const rds  = redDaysRaw ? JSON.parse(redDaysRaw) : [];
      const adm  = adminRaw ? JSON.parse(adminRaw) : {};
      const uns  = unitsRaw ? JSON.parse(unitsRaw) : {};

      // Requirement: Split into two upserts
      const mastersRows = evts.filter(e => !e.isRecurrence).map(e => sanitiseForCloud(e, userId)).filter(r => r !== null);
      const promotedRows = prom.filter(e => e.isRecurrence && isPromoted(e))
        .map(e => sanitiseForCloud(e, userId))
        .filter(r => r !== null);

      await Promise.all([
        db.from('schedule_events').upsert(mastersRows, { onConflict: 'id' }),
        db.from('schedule_events').upsert(promotedRows, { onConflict: 'id' }),
        cloudSaveRedDays(userId, rds),
        cloudSaveClassAdmin(userId, adm),
        cloudSaveClassUnits(userId, uns),
      ]);

      setSyncBadge('synced');
      console.log('[Sync] Upload complete.');
    } catch (err) {
      console.error('[Sync] syncToCloud failed:', err);
      setSyncBadge('error');
    }
  }

  async function loadFromCloud(userId) {
    console.log('[Sync] Loading Cloud → localStorage for', userId);
    setSyncBadge('syncing');
    try {
      const [evts, rds, adm, uns] = await Promise.all([
        cloudLoadScheduleEvents(userId),
        cloudLoadRedDays(userId),
        cloudLoadClassAdmin(userId),
        cloudLoadClassUnits(userId),
      ]);

      // Write to localStorage
      if (evts !== null) {
        localStorage.setItem('schedule_events', JSON.stringify(evts.masters));
        localStorage.setItem('schedule_promoted_instances', JSON.stringify(evts.promoted));
      }
      if (rds  !== null) localStorage.setItem('schedule_red_days', JSON.stringify(rds));
      if (adm  !== null) localStorage.setItem('schedule_class_admin', JSON.stringify(adm));
      if (uns  !== null) localStorage.setItem('schedule_class_units', JSON.stringify(uns));

      setSyncBadge('synced');
      console.log('[Sync] Download complete. Triggering re-render…');

      // Trigger page-specific re-render
      if (typeof window._syncRerender === 'function') {
        window._syncRerender();
      }
    } catch (err) {
      console.error('[Sync] loadFromCloud failed:', err);
      setSyncBadge('error');
    }
  }

  // ── One-time migration on first cloud login ──────────────────────

  async function handleFirstCloudLogin(userId) {
    const migrationKey = 'kk_schedule_migrated_to_cloud';
    if (localStorage.getItem(migrationKey)) {
      // Already migrated — just load from cloud
      await loadFromCloud(userId);
      return;
    }

    // Check if localStorage has data
    const hasLocal = !!(
      localStorage.getItem('schedule_events') ||
      localStorage.getItem('schedule_class_admin') ||
      localStorage.getItem('schedule_class_units')
    );

    // Check if cloud has data
    const { data: cloudCheck, error } = await db.from('schedule_events')
      .select('id').eq('user_id', userId).limit(1);

    const hasCloud = !error && cloudCheck && cloudCheck.length > 0;

    if (hasLocal && !hasCloud) {
      // First login: push local data to cloud
      await syncToCloud(userId);
      localStorage.setItem(migrationKey, 'true');
      showSyncToast('Your data has been saved to the cloud ☁️');
    } else if (hasCloud) {
      // Cloud has data — pull it down
      await loadFromCloud(userId);
      localStorage.setItem(migrationKey, 'true');
    } else {
      // No data anywhere, just mark as migrated
      localStorage.setItem(migrationKey, 'true');
      setSyncBadge('synced');
    }
  }

  // ── Toast helper (works in both tools) ───────────────────────────

  function showSyncToast(message) {
    // Reuse the tool's own showToast if available
    if (typeof window.showToast === 'function') {
      window.showToast(message, 'success');
      return;
    }

    // Fallback: create a simple toast
    let container = document.getElementById('toastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toastContainer';
      container.className = 'fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] flex flex-col gap-3 items-center pointer-events-none';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = 'px-4 py-3 rounded-xl shadow-neo font-bold text-sm flex items-center gap-3 transform transition-all duration-300 translate-y-10 opacity-0 bg-green text-white border-2 border-[#1e293b]';
    toast.innerHTML = `<i data-lucide="cloud" class="w-5 h-5"></i><span>${message}</span>`;
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
    }, 4000);
  }

  // ── Non-blocking fire-and-forget upsert wrapper ──────────────────

  let _cachedUserId = null;

  async function getCachedUserId() {
    if (_cachedUserId) return _cachedUserId;
    const user = await getUser();
    if (user && !user.is_sandbox) _cachedUserId = user.id;
    return _cachedUserId;
  }

  // Fire a cloud write without blocking UI. Sets badge to syncing/synced.
  function fireCloudSave(saveFn) {
    if (!isCloudMode()) return;
    getCachedUserId().then(userId => {
      if (!userId) return;
      setSyncBadge('syncing');
      saveFn(userId)
        .then(() => setSyncBadge('synced'))
        .catch(err => {
          console.error('[Sync] Background save failed:', err);
          setSyncBadge('error');
        });
    });
  }

  // ── Promoted instance upsert (fire-and-forget) ──────────────────

  function syncPromotedInstance(evt) {
    if (!isCloudMode()) return;
    if (!evt.isRecurrence) return;
    if (!isPromoted(evt)) return;

    getCachedUserId().then(userId => {
      if (!userId) return;
      const row = sanitiseForCloud(evt, userId);
      if (!row) return;

      db.from('schedule_events')
        .upsert(row, { onConflict: 'id' })
        .then(({ error }) => {
          if (error) {
            console.error('[Sync] Promoted upsert failed:', error);
          } else {
            console.log('[Sync] Promoted instance saved:', evt.id);
          }
        })
        .catch(err => console.error('[Sync] Promoted upsert exception:', err));
    });
  }

  // ── Public API ───────────────────────────────────────────────────

  window.Sync = {
    isCloudMode,
    syncToCloud,
    loadFromCloud,
    handleFirstCloudLogin,
    setSyncBadge,

    cloudLoadScheduleEvents,
    cloudSaveScheduleEvents,
    cloudReplaceAllScheduleEvents,
    cloudDeleteScheduleEvent,
    cloudLoadRedDays,
    cloudSaveRedDays,
    cloudLoadClassAdmin,
    cloudSaveClassAdmin,
    cloudLoadClassUnits,
    cloudSaveClassUnits,

    fireCloudSave,
    getCachedUserId,
    isPromoted,
    syncPromotedInstance,
  };

})();
