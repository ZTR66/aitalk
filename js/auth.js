// ============================================
// Auth Module - Login / Signup / Logout
// ============================================
import { supabase } from './supabase-client.js';

const authWindow = document.getElementById('auth-window');
const chatWindow = document.getElementById('chat-window');
const authForm = document.getElementById('auth-form');
const authMessage = document.getElementById('auth-message');
const logoutBtn = document.getElementById('logout-btn');
const tabs = document.querySelectorAll('.tab');

let currentMode = 'login'; // 'login' | 'signup'

// Tab 切换
tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    tabs.forEach(t => t.classList.remove('tab-active'));
    tab.classList.add('tab-active');
    currentMode = tab.dataset.tab;
    authMessage.textContent = '';
  });
});

// 登录 / 注册表单提交
authForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const formData = new FormData(authForm);
  const email = formData.get('email').trim();
  const password = formData.get('password');

  authMessage.className = 'auth-message';
  authMessage.textContent = 'Connecting...';

  try {
    let result;
    if (currentMode === 'login') {
      result = await supabase.auth.signInWithPassword({ email, password });
    } else {
      result = await supabase.auth.signUp({ email, password });
    }

    if (result.error) throw result.error;

    if (currentMode === 'signup' && !result.data.session) {
      authMessage.classList.add('success');
      authMessage.textContent = '✅ Check your email to confirm!';
    } else {
      authMessage.classList.add('success');
      authMessage.textContent = '✅ Welcome!';
      // 触发自定义事件
      window.dispatchEvent(new CustomEvent('login-success', { detail: result.data }));
    }
  } catch (err) {
    authMessage.classList.add('error');
    authMessage.textContent = '❌ ' + (err.message || 'Auth failed');
  }
});

// 登出
logoutBtn?.addEventListener('click', async () => {
  await supabase.auth.signOut();
  window.dispatchEvent(new CustomEvent('logout'));
});

// 监听认证状态变化 -> 切换窗口
window.addEventListener('auth-change', async (e) => {
  const { event, session } = e.detail;
  if (session) {
    authWindow.classList.add('hidden');
    chatWindow.classList.remove('hidden');
    // 居中显示
    centerWindow(chatWindow);
    // 触发 chat 初始化
    window.dispatchEvent(new CustomEvent('chat-init', { detail: { user: session.user } }));
  } else {
    authWindow.classList.remove('hidden');
    chatWindow.classList.add('hidden');
    centerWindow(authWindow);
  }
});

// 初始检查会话
(async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    window.dispatchEvent(new CustomEvent('auth-change', {
      detail: { event: 'INITIAL', session }
    }));
  } else {
    centerWindow(authWindow);
  }
})();

// 工具：窗口居中
function centerWindow(win) {
  const w = 420, h = 480;
  win.style.left = `${(window.innerWidth - w) / 2}px`;
  win.style.top = `${(window.innerHeight - h) / 2}px`;
  win.style.width = `${w}px`;
  win.style.minHeight = `${h}px`;
}

// 拖拽支持
document.querySelectorAll('.window-titlebar').forEach(bar => {
  const win = bar.closest('.window');
  let offsetX, offsetY, dragging = false;

  bar.addEventListener('mousedown', (e) => {
    if (e.target.closest('.window-controls')) return;
    dragging = true;
    const rect = win.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
    win.classList.add('dragging');
    win.style.zIndex = String(Date.now());
  });

  document.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const x = Math.max(0, Math.min(window.innerWidth - 100, e.clientX - offsetX));
    const y = Math.max(28, Math.min(window.innerHeight - 50, e.clientY - offsetY));
    win.style.left = `${x}px`;
    win.style.top = `${y}px`;
  });

  document.addEventListener('mouseup', () => {
    dragging = false;
    win.classList.remove('dragging');
  });
});
