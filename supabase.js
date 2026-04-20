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
    localStorage.setItem('after_login', location.href)
    location.href = '/login.html'
    // Return a never-resolving promise so downstream code doesn't run
    return new Promise(() => {})
  }
  return user
}

async function signUp(email, pass) {
  return db.auth.signUp({ email, password: pass })
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