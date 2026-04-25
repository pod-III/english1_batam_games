/**
 * KlassKit – Supabase Auth Helper
 * --------------------------------
 * Loads the Supabase JS v2 client (imported via CDN in <head>)
 * and exposes a thin convenience API for auth.
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
    return new Promise(() => { });
  }
  const user = await getUser()
  if (!user) {
    location.href = '/login.html'
    return new Promise(() => { })
  }

  const { data: profile, error } = await db
    .from('profiles')
    .select('role, display_name')
    .eq('id', user.id)
    .single()

  if (error) console.error('[AdminGuard] Profile lookup error:', error)

  if (profile?.role !== 'admin') {
    console.warn('[AdminGuard] Access Denied.')
    location.href = '/hub.html'
    return new Promise(() => { })
  }

  return { user, profile }
}

async function signUp(email, pass, displayName) {
  const confirmationUrl = 'http://klasskit.fun/api/confirmation.html';
  return db.auth.signUp({
    email,
    password: pass,
    options: {
      data: { display_name: displayName },
      emailRedirectTo: confirmationUrl
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

  if (window.Storage && typeof window.Storage.syncWithCloud === 'function') {
    window.Storage.syncWithCloud()
  }
}

function sanitizeCloudPayload(data) {
  if (!data) return data
  const clean = JSON.parse(JSON.stringify(data))

  const traverse = (obj) => {
    for (const key in obj) {
      const val = obj[key]

      if (typeof val === 'string') {
        const isDataUrl = val.startsWith('data:')
        const isTooLong = val.length > 10000

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

async function sendPasswordReset(email) {
  if (isSandbox()) return { error: "Reset not available in Sandbox." };

  const resetUrl = 'https://klasskit.fun/api/reset-password.html';

  return await db.auth.resetPasswordForEmail(email, {
    redirectTo: resetUrl,
  });
}

async function updatePassword(newPassword) {
  if (isSandbox()) return { success: true };
  
  const { data, error } = await db.auth.updateUser({
    password: newPassword
  });
  
  return { data, error };
}

/* ── DATA HELPERS ── */
async function saveProgress(toolKey, data) {
  localStorage.setItem(`prog_${toolKey}`, JSON.stringify(data))

  if (isSandbox()) return;

  const user = await getUser()
  if (!user) return

  const sanitizedData = sanitizeCloudPayload(data)

  await db.from('user_progress').upsert(
    {
      user_id: user.id,
      tool_key: toolKey,
      data: sanitizedData,
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
    // FIX: Explicitly filter by user_id to prevent admin query crashes
    const { data, error } = await db.from('user_progress')
      .select('data')
      .eq('tool_key', toolKey)
      .eq('user_id', user.id)
      .single()

    // Ignore PGRST116 (No rows found) - it just means no progress is saved yet
    if (error && error.code !== 'PGRST116') {
      console.error('[Load] DB Error:', error)
    }

    if (data) {
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

  const { error: authError } = await db.auth.updateUser({
    data: { display_name: displayName }
  })
  if (authError) return { error: authError.message }

  // FIX: Strictly limit the update payload to only the display_name
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

  if (window.Storage && typeof window.Storage.triggerCloudSave === 'function') {
    await window.Storage.triggerCloudSave()
  }

  localStorage.setItem('migrated_to_cloud', 'true')
}

/* ── STORAGE HELPERS ── */
const STORAGE_CONFIG = {
  bucket: 'media',
  defaultLimit: 50 * 1024 * 1024, // 50MB
  quality: 0.8
};

/**
 * Compresses an image file client-side to WebP format.
 */
async function compressImage(file, quality = STORAGE_CONFIG.quality) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      return resolve(file); // Return original if not an image
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Optional: Resize if too large (e.g., max 1920px)
        const maxDim = 1920;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob((blob) => {
          if (blob) {
            // Create a new File object from the blob
            const newFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".webp", {
              type: 'image/webp',
              lastModified: Date.now()
            });
            resolve(newFile);
          } else {
            reject(new Error('Compression failed'));
          }
        }, 'image/webp', quality);
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
  });
}

/**
 * Returns user storage usage: { used, limit, percent }
 */
async function getUserStorageUsage() {
  const user = await getUser();
  if (!user || user.is_sandbox) return { used: 0, limit: STORAGE_CONFIG.defaultLimit, percent: 0 };

  const { data, error } = await db
    .from('profiles')
    .select('storage_usage, storage_limit')
    .eq('id', user.id)
    .single();

  if (error) {
    console.error('[Storage] Usage lookup error:', error);
    return { used: 0, limit: STORAGE_CONFIG.defaultLimit, percent: 0 };
  }

  const used = data.storage_usage || 0;
  const limit = data.storage_limit || STORAGE_CONFIG.defaultLimit;
  const percent = Math.min(100, Math.round((used / limit) * 100));

  return { used, limit, percent };
}

/**
 * Uploads a media file with compression and quota checks.
 */
async function uploadMedia(file, activityId) {
  if (isSandbox()) throw new Error('Storage not available in Sandbox.');

  const user = await getUser();
  if (!user) throw new Error('Not authenticated');

  // 1. Compress
  const compressedFile = await compressImage(file);
  const fileSize = compressedFile.size;

  // 2. Check quota
  const usage = await getUserStorageUsage();
  
  // To handle overwrites accurately, check if file exists
  const filename = file.name.replace(/\.[^/.]+$/, "").replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const filePath = `${user.id}/${activityId}/${filename}.webp`;
  
  let oldSize = 0;
  try {
    const { data: existingFiles } = await db.storage.from(STORAGE_CONFIG.bucket).list(`${user.id}/${activityId}`);
    const existing = existingFiles?.find(f => f.name === `${filename}.webp`);
    if (existing) {
      oldSize = existing.metadata.size;
    }
  } catch (e) {
    console.warn('[Storage] Could not check existing file size:', e);
  }

  if (usage.used - oldSize + fileSize > usage.limit) {
    throw new Error('Storage quota exceeded');
  }

  // 3. Upload
  const { error: uploadError } = await db.storage
    .from(STORAGE_CONFIG.bucket)
    .upload(filePath, compressedFile, {
      contentType: 'image/webp',
      upsert: true
    });

  if (uploadError) throw uploadError;

  // 4. Update usage in profile
  const newUsage = usage.used - oldSize + fileSize;
  await db
    .from('profiles')
    .update({ storage_usage: newUsage })
    .eq('id', user.id);

  // 5. Return URL
  const { data: { publicUrl } } = db.storage
    .from(STORAGE_CONFIG.bucket)
    .getPublicUrl(filePath);

  return publicUrl;
}

/**
 * Deletes a media file and updates storage usage.
 */
async function deleteMedia(filePath) {
  if (isSandbox()) return;

  const user = await getUser();
  if (!user) return;

  // 1. Get file size before deletion
  let fileSize = 0;
  try {
    const pathParts = filePath.split('/');
    const filename = pathParts.pop();
    const dir = pathParts.join('/');
    const { data: files } = await db.storage.from(STORAGE_CONFIG.bucket).list(dir);
    const file = files?.find(f => f.name === filename);
    if (file) fileSize = file.metadata.size;
  } catch (e) {
    console.warn('[Storage] Could not get file size for deletion:', e);
  }

  // 2. Delete from Storage
  const { error } = await db.storage.from(STORAGE_CONFIG.bucket).remove([filePath]);
  if (error) throw error;

  // 3. Update usage
  const usage = await getUserStorageUsage();
  const newUsage = Math.max(0, usage.used - fileSize);
  
  await db
    .from('profiles')
    .update({ storage_usage: newUsage })
    .eq('id', user.id);

  return { success: true };
}

/**
 * Replaces an existing media file (overwrites).
 */
async function replaceMedia(oldPath, newFile, activityId) {
  // uploadMedia already handles upsert: true and usage calculation
  return await uploadMedia(newFile, activityId);
}

