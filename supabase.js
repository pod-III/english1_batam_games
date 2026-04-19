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

// ── Client ────────────────────────────────────────────────────────────────
const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── Helpers ───────────────────────────────────────────────────────────────

/**
 * Return the currently logged-in user object, or null.
 * @returns {Promise<import('@supabase/supabase-js').User | null>}
 */
async function getUser() {
  const { data: { user } } = await db.auth.getUser();
  return user;
}

/**
 * Redirect to `/login.html` if nobody is signed in.
 * Stores the current page path in localStorage so the login page
 * can send the user back after a successful sign-in.
 * Call at the top of any page that needs authentication.
 * @returns {Promise<import('@supabase/supabase-js').User>}
 */
async function requireAuth() {
  const user = await getUser();
  if (!user) {
    localStorage.setItem('after_login', window.location.pathname + window.location.search);
    window.location.href = '/login.html';
    // Return a never-resolving promise so downstream code doesn't run
    return new Promise(() => {});
  }
  return user;
}

/**
 * Create a new account with email + password.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{ user: object | null, error: object | null }>}
 */
async function signUp(email, password) {
  const { data, error } = await db.auth.signUp({ email, password });
  return { user: data?.user ?? null, error };
}

/**
 * Sign in with email + password.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{ user: object | null, error: object | null }>}
 */
async function signIn(email, password) {
  const { data, error } = await db.auth.signInWithPassword({ email, password });
  return { user: data?.user ?? null, error };
}

/**
 * Sign the current user out and reload the page.
 * @returns {Promise<void>}
 */
async function signOut() {
  await db.auth.signOut();
  window.location.reload();
}
