// ============================================
// Supabase Client Initialization
// ============================================
// 配置从 window.__SUPABASE_CONFIG__ 注入（部署时由 CI 注入或本地 .env）
// 也可以在 index.html 注入 <script>window.__SUPABASE_CONFIG__={...}</script>

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const config = window.__SUPABASE_CONFIG__ || {
  url: 'https://YOUR-PROJECT.supabase.co',
  anonKey: 'YOUR-ANON-KEY',
};

export const supabase = createClient(config.url, config.anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

// 监听认证状态
supabase.auth.onAuthStateChange((event, session) => {
  console.log('[auth]', event, session?.user?.email);
  window.dispatchEvent(new CustomEvent('auth-change', { detail: { event, session } }));
});

export default supabase;
