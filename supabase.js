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
const SUPABASE_URL  = 'https://mkarfktuvtllaxpunwtb.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_5Fd483qrg6bEFa_T1oNyLg_gymEgi4P';

const { createClient } = supabase
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

/* ── AUTH HELPERS ── */
async function getUser() {
  const { data: { session } } = await db.auth.getSession()
  return session?.user ?? null
}

async function requireAuth() {
  const user = await getUser()
  if (!user) {
    const target = (window !== window.top) ? window.top : window
    target.localStorage.setItem('after_login', target.location.href)
    target.location.href = '/login.html'
    return new Promise(() => {})
  }
  return user
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
  await db.auth.signOut()
  location.href = '/login.html'
}

/* ── DATA HELPERS (replaces localStorage) ── */
async function saveProgress(toolKey, data) {
  localStorage.setItem(`prog_${toolKey}`, JSON.stringify(data))
  const user = await getUser()
  if (!user) return
  await db.from('user_progress').upsert(
    { user_id: user.id, tool_key: toolKey, data,
      updated_at: new Date().toISOString() },
    { onConflict: 'user_id,tool_key' }
  )
}

async function loadProgress(toolKey) {
  const user = await getUser()
  if (user) {
    const { data } = await db.from('user_progress')
      .select('data').eq('tool_key', toolKey).single()
    if (data) return data.data
  }
  const local = localStorage.getItem(`prog_${toolKey}`)
  return local ? JSON.parse(local) : null
}

async function updateDisplayName(displayName) {
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
  if (localStorage.getItem('migrated_to_cloud')) return
  const user = await getUser()
  if (!user) return

  const keys = Object.keys(localStorage).filter(k => k.startsWith('prog_'))
  for (const key of keys) {
    const toolKey = key.replace('prog_', '')
    const data = JSON.parse(localStorage.getItem(key))
    await saveProgress(toolKey, data)
  }
  localStorage.setItem('migrated_to_cloud', 'true')
}