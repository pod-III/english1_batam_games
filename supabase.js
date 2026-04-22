/**
 * KlassKit – Supabase Auth Helper
 * --------------------------------
 * Loads the Supabase JS v2 client (imported via CDN in <head>)
 * and exposes a thin convenience API for auth.
 *
 * Usage:
 *   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
 *   <script src="/supabase.js"></script>
 */

// ── Config ────────────────────────────────────────────────────────────────
const SUPABASE_URL = 'https://mkarfktuvtllaxpunwtb.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_5Fd483qrg6bEFa_T1oNyLg_gymEgi4P';

const { createClient } = supabase
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

/* ── MODE HELPERS ── */
function isSandbox() {
  return localStorage.getItem('kk_mode') === 'sandbox';
}

async function getUser() {
  if (isSandbox()) {
    return { id: 'sandbox_user', is_sandbox: true, email: 'sandbox@local' };
  }
  const { data: { session } } = await db.auth.getSession()
  return session?.user ?? null
}

async function requireAuth() {
  if (isSandbox()) {
    console.log("[Auth] Sandbox Mode Active. Bypassing Auth.");
    return { id: 'sandbox_user', is_sandbox: true };
  }
  const user = await getUser()
  if (!user) {
    const target = (window !== window.top) ? window.top : window
    target.localStorage.setItem('after_login', target.location.href)
    target.location.href = '/login.html'
    return new Promise(() => { })
  }

  // Safety Check: If the user ID has changed, clear the local cache immediately
  const lastUserId = localStorage.getItem('kk_current_user_id')
  if (lastUserId && lastUserId !== user.id) {
    console.warn('[Auth] User ID mismatch. Clearing local cache for safety.')
    clearLocalCache()
  }
  localStorage.setItem('kk_current_user_id', user.id)

  console.log("auth success");
  return user
}

async function requireAdmin() {
  if (isSandbox()) {
    location.href = '/hub.html';
    return new Promise(() => {});
  }
  const user = await getUser()
  if (!user) {
    location.href = '/login.html'
    return new Promise(() => {})
  }

  const { data: profile, error } = await db
    .from('profiles')
    .select('role, display_name')
    .eq('id', user.id)
    .single()

  if (error) console.error('[AdminGuard] Profile lookup error:', error)
  console.log('[AdminGuard] Profile data:', profile)

  if (profile?.role !== 'admin') {
    console.warn('[AdminGuard] Access Denied: Role is', profile?.role)
    location.href = '/hub.html'
    return new Promise(() => {})
  }

  return { user, profile }
}

async function signUp(email, pass, displayName) {
  return db.auth.signUp({
    email,
    password: pass,
    options: {
      data: { display_name: displayName }
    }
  })
}
async function signIn(email, pass) {
  return db.auth.signInWithPassword({ email, password: pass })
}
async function signOut() {
  if (!isSandbox()) {
    await db.auth.signOut()
  }
  clearLocalCache()
  location.href = '/index.html'
}

function clearLocalCache() {
  console.log('[Auth] Clearing local cache...');
  // Clear all tool progress
  const keys = Object.keys(localStorage)
  keys.forEach(key => {
    if (key.startsWith('prog_') ||
      key.startsWith('theme_') ||
      key.startsWith('klasskit_') ||
      key === 'recentGameIds' ||
      key === 'favoriteGames' ||
      key === 'openTabs' ||
      key === 'pinnedGameIds' ||
      key === 'soundMuted' ||
      key === 'migrated_to_cloud' ||
      key === 'kk_current_user_id') {
      localStorage.removeItem(key)
    }
  })

  // Trigger hub state refresh if Storage exists
  if (window.Storage && typeof window.Storage.syncWithCloud === 'function') {
    window.Storage.syncWithCloud()
  }
}

/**
 * Recursively strips potential binary/Base64 data from a payload 
 * to prevent cloud database bloat.
 */
function sanitizeCloudPayload(data) {
  if (!data) return data
  
  // Clone to avoid mutating local storage state
  const clean = JSON.parse(JSON.stringify(data))

  const traverse = (obj) => {
    for (const key in obj) {
      const val = obj[key]
      
      if (typeof val === 'string') {
        // Strip Base64 images or very long strings that look like binary
        const isDataUrl = val.startsWith('data:')
        const isTooLong = val.length > 10000 // 10KB per string limit
        
        if (isDataUrl || isTooLong) {
          obj[key] = `[STRIPPED_FOR_CLOUD_SECURITY: ${isDataUrl ? 'Media' : 'LargePayload'}]`
        }
      } else if (typeof val === 'object' && val !== null) {
        traverse(val)
      }
    }
  }

  traverse(clean)
  return clean
}

/* ── DATA HELPERS (replaces localStorage) ── */
async function saveProgress(toolKey, data) {
  // 1. Always save full data locally first
  localStorage.setItem(`prog_${toolKey}`, JSON.stringify(data))

  if (isSandbox()) return; // Skip cloud sync in sandbox

  const user = await getUser()
  if (!user) return

  // 2. Sanitize data before sending to Cloud DB
  const sanitizedData = sanitizeCloudPayload(data)

  await db.from('user_progress').upsert(
    {
      user_id: user.id, 
      tool_key: toolKey, 
      data: sanitizedData, // Only cloud gets the stripped version
      updated_at: new Date().toISOString()
    },
    { onConflict: 'user_id,tool_key' }
  )
}

async function loadProgress(toolKey) {
  if (isSandbox()) {
    const local = localStorage.getItem(`prog_${toolKey}`);
    return local ? JSON.parse(local) : null;
  }
  const user = await getUser()
  if (user) {
    const { data } = await db.from('user_progress')
      .select('data').eq('tool_key', toolKey).single()
    if (data) {
      // Prioritize cloud and sync to local for seamless usage
      localStorage.setItem(`prog_${toolKey}`, JSON.stringify(data.data))
      return data.data
    }
  }
  const local = localStorage.getItem(`prog_${toolKey}`)
  return local ? JSON.parse(local) : null
}

async function updateDisplayName(displayName) {
  if (isSandbox()) return { success: true };
  const user = await getUser()
  if (!user) return { error: 'Not logged in' }

  // Update in auth metadata (so getUser() reflects it immediately)
  const { error: authError } = await db.auth.updateUser({
    data: { display_name: displayName }
  })
  if (authError) return { error: authError.message }

  // Update in profiles table (for admin queries and leaderboards later)
  const { error: dbError } = await db
    .from('profiles')
    .update({ display_name: displayName })
    .eq('id', user.id)

  if (dbError) return { error: dbError.message }

  return { success: true }
}

async function migrateLocalToCloud() {
  if (isSandbox()) return;
  if (localStorage.getItem('migrated_to_cloud')) return
  const user = await getUser()
  if (!user) return

  const keys = Object.keys(localStorage).filter(k => k.startsWith('prog_'))
  for (const key of keys) {
    const toolKey = key.replace('prog_', '')
    const data = JSON.parse(localStorage.getItem(key))
    await saveProgress(toolKey, data)
  }

  // Also migrate hub state if it exists
  if (window.Storage && typeof window.Storage.triggerCloudSave === 'function') {
    await window.Storage.triggerCloudSave()
  }

  localStorage.setItem('migrated_to_cloud', 'true')
}