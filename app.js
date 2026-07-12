// ============================================
// AI Web Talk - Single-file app logic
// No module dependencies between auth/chat/settings
// ============================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ============================================
// i18n - 国际化
// ============================================
const I18N = {
  en: {
    'auth.title': 'Welcome back',
    'auth.subtitle': 'Sign in to continue to AI Web Talk',
    'auth.email': 'Email',
    'auth.password': 'Password',
    'auth.login': 'Login',
    'auth.signup': 'Sign up',
    'auth.continue': 'Continue',
    'auth.terms': 'By continuing, you agree to our Terms and Privacy Policy.',

    'sidebar.newChat': 'New chat',
    'sidebar.recent': 'Recent',
    'menu.settings': 'Settings',
    'menu.logout': 'Log out',

    'header.budgetTitle': 'Daily budget used',
    'empty.title': 'How can I help today?',
    'empty.start': 'Start a new chat',
    'composer.placeholder': 'Reply to AI Web Talk...',
    'composer.hint': 'AI Web Talk can make mistakes. Consider checking important information.',
    'msg.thinking': 'Thinking',

    'settings.title': 'Settings',
    'settings.thinkingEnable': 'Enable thinking',
    'settings.thinkingHint': 'Let the model think before responding (slower but more accurate)',
    'settings.thinkingLevel': 'Thinking level',
    'settings.thinkingLow': 'Low · fast',
    'settings.thinkingMed': 'Medium · balanced',
    'settings.thinkingHigh': 'High · deep',
    'settings.systemPrompt': 'System prompt',
    'settings.systemPromptPh': 'You are a helpful assistant...',
    'settings.systemPromptHint': 'Sets the behavior of the AI. Leave empty for default.',
    'settings.temperature': 'Temperature',
    'settings.temperatureHint': 'Lower = more focused · Higher = more creative',
    'settings.maxTokens': 'Max tokens',
    'settings.maxTokensHint': 'Maximum length of AI response',
    'settings.topP': 'Top P',
    'settings.topPHint': 'Nucleus sampling threshold',
    'settings.cancel': 'Cancel',
    'settings.save': 'Save',
  },
  zh: {
    'auth.title': '欢迎回来',
    'auth.subtitle': '登录以继续使用 AI Web Talk',
    'auth.email': '邮箱',
    'auth.password': '密码',
    'auth.login': '登录',
    'auth.signup': '注册',
    'auth.continue': '继续',
    'auth.terms': '继续操作即表示您同意我们的条款和隐私政策。',

    'sidebar.newChat': '新对话',
    'sidebar.recent': '最近',
    'menu.settings': '设置',
    'menu.logout': '退出登录',

    'header.budgetTitle': '每日预算',
    'empty.title': '今天我能帮你什么？',
    'empty.start': '开始新对话',
    'composer.placeholder': '回复 AI Web Talk...',
    'composer.hint': 'AI Web Talk 可能会出错，请核实重要信息。',
    'msg.thinking': '思考过程',

    'settings.title': '设置',
    'settings.thinkingEnable': '启用思考',
    'settings.thinkingHint': '让模型先思考再回答（较慢但更准）',
    'settings.thinkingLevel': '思考强度',
    'settings.thinkingLow': '低 · 快速',
    'settings.thinkingMed': '中 · 平衡',
    'settings.thinkingHigh': '高 · 深度',
    'settings.systemPrompt': '系统提示',
    'settings.systemPromptPh': '你是一个有帮助的助手...',
    'settings.systemPromptHint': '设置 AI 的行为。留空使用默认。',
    'settings.temperature': '温度',
    'settings.temperatureHint': '低 = 更专注 · 高 = 更有创意',
    'settings.maxTokens': '最大 Token',
    'settings.maxTokensHint': 'AI 回复的最大长度',
    'settings.topP': 'Top P',
    'settings.topPHint': '核采样阈值',
    'settings.cancel': '取消',
    'settings.save': '保存',
  },
};

let currentLang = localStorage.getItem('lang') || (navigator.language?.startsWith('zh') ? 'zh' : 'en');

function t(key) {
  return I18N[currentLang]?.[key] ?? I18N.en[key] ?? key;
}

function applyI18n() {
  document.documentElement.lang = currentLang === 'zh' ? 'zh-CN' : 'en';
  // 替换所有带 data-i18n 的元素
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    const text = t(key);
    if (text) el.textContent = text;
  });
  // 替换所有带 data-i18n-placeholder 的元素
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.dataset.i18nPlaceholder;
    const text = t(key);
    if (text) el.placeholder = text;
  });
  // 替换所有带 data-i18n-title 的元素
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.dataset.i18nTitle;
    const text = t(key);
    if (text) el.title = text;
  });
  // 更新语言按钮
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.toggle('is-active', btn.dataset.lang === currentLang);
  });
  // 更新 thinking level 文字
  const levelLabels = {
    en: ['Low', 'Medium', 'High'],
    zh: ['低', '中', '高'],
  };
  if (dom.thinkingValue) {
    const v = parseInt(dom.thinkingLevel?.value || '1');
    dom.thinkingValue.textContent = levelLabels[currentLang][v] || levelLabels.en[v];
  }
}

function setLang(lang) {
  if (!I18N[lang]) return;
  currentLang = lang;
  localStorage.setItem('lang', lang);
  applyI18n();
}

// ============================================
// Init
// ============================================
const config = window.__SUPABASE_CONFIG__ || {
  url: 'https://YOUR-PROJECT.supabase.co',
  anonKey: 'YOUR-ANON-KEY',
};

const supabase = createClient(config.url, config.anonKey, {
  auth: { persistSession: true, autoRefreshToken: true },
});

// ============================================
// State
// ============================================
const state = {
  user: null,
  conversationId: null,
  userScrolledUp: false,
  isStreaming: false,
  settings: {
    systemPrompt: '',
    temperature: 0.7,
    maxTokens: 2048,
    topP: 1.0,
    thinkingEnabled: true,
    thinkingLevel: 'medium',  // 'low' | 'medium' | 'high'
  },
  dailyBudget: 0.1,
  usedToday: 0,
};

// ============================================
// DOM refs
// ============================================
const $ = (id) => document.getElementById(id);

const dom = {
  authPage:        $('auth-page'),
  chatPage:        $('chat-page'),
  app:             $('chat-page'),

  // Auth
  authForm:        $('auth-form'),
  authMessage:     $('auth-message'),
  authTabs:        document.querySelectorAll('.auth-tab'),

  // Sidebar
  sidebar:         $('sidebar'),
  sidebarToggle:   $('sidebar-toggle'),
  sidebarBackdrop: $('sidebar-backdrop'),
  newChatBtn:      $('new-chat-btn'),
  convList:        $('conversation-list'),
  userButton:      $('user-button'),
  userMenu:        $('user-menu'),
  userAvatar:      $('user-avatar'),
  userName:        $('user-name'),
  userEmail:       $('user-email'),

  // Topbar
  modelSelect:     $('model-select'),
  budgetText:      $('budget-text'),

  // Chat
  messages:        $('messages'),
  empty:           $('empty'),
  chatForm:        $('chat-form'),
  userInput:       $('user-input'),
  sendBtn:         $('send-btn'),

  // Settings modal
  settingsModal:    $('settings-modal'),
  settingSystem:    $('setting-system'),
  settingTemp:      $('setting-temp'),
  tempValue:        $('temp-value'),
  settingMaxtok:    $('setting-maxtok'),
  maxtokValue:      $('maxtok-value'),
  settingTopp:      $('setting-topp'),
  toppValue:        $('topp-value'),
  settingThinking:  $('setting-thinking'),
  thinkingLevel:    $('setting-thinking-level'),
  thinkingValue:    $('thinking-value'),
  thinkingGroup:    $('thinking-level-group'),
  settingsSave:     $('settings-save'),
};

// ============================================
// State helpers
// ============================================
let authMode = 'login';

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));

const clamp = (v, min, max, def) => {
  const n = Number(v);
  if (!isFinite(n)) return def;
  return Math.max(min, Math.min(max, n));
};

// ============================================
// Auth UI
// ============================================
dom.authTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    dom.authTabs.forEach(t => t.classList.remove('is-active'));
    tab.classList.add('is-active');
    authMode = tab.dataset.tab;
    dom.authMessage.textContent = '';
    dom.authMessage.className = 'form-message';
  });
});

dom.authForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(dom.authForm);
  const email = fd.get('email').trim();
  const password = fd.get('password');

  dom.authMessage.className = 'form-message';
  dom.authMessage.textContent = 'Signing in...';

  try {
    const result = authMode === 'login'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password });
    if (result.error) throw result.error;

    if (authMode === 'signup' && !result.data.session) {
      dom.authMessage.classList.add('success');
      dom.authMessage.textContent = '✓ Check your email to confirm';
    } else {
      dom.authMessage.classList.add('success');
      dom.authMessage.textContent = '✓ Welcome';
    }
  } catch (err) {
    dom.authMessage.classList.add('error');
    dom.authMessage.textContent = err.message || 'Authentication failed';
  }
});

// ============================================
// Auth state
// ===========================================================
// 关键修复：只首次登录 / 明确登录时创建新对话
// token 自动刷新（每 50 分钟一次）不创建
// ===========================================================
let isInitialized = false;

supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_OUT') {
    setUser(null);
    isInitialized = false;
    return;
  }
  if (session?.user) {
    // 只在首次或显式登录时创建新对话
    const shouldCreate = (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') && !isInitialized;
    setUser(session.user, shouldCreate);
    if (shouldCreate) isInitialized = true;
  }
});

(async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) {
    setUser(session.user, true);
    isInitialized = true;
  }
})();

async function setUser(user, createConversation = false) {
  state.user = user;
  if (user) {
    dom.authPage.hidden = true;
    dom.chatPage.hidden = false;
    dom.userEmail.textContent = user.email;
    dom.userName.textContent = user.email.split('@')[0];
    dom.userAvatar.textContent = user.email[0].toUpperCase();

    if (createConversation) {
      await Promise.all([ensureQuota(), loadSettings(), loadConversations()]);
      await refreshBudget();
      // 不自动创建新对话，让用户主动点击 "New chat"
      // 如果有历史会话，加载最近的一个
      const { data } = await supabase
        .from('conversations')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(1);
      if (data && data.length > 0) {
        await switchConversation(data[0].id);
      } else {
        // 没有任何会话，显示空状态
        state.conversationId = null;
        renderMessages([]);
      }
    }
  } else {
    dom.authPage.hidden = false;
    dom.chatPage.hidden = true;
    state.conversationId = null;
    state.isStreaming = false;
    dom.messages.innerHTML = '';
    if (dom.empty) dom.messages.appendChild(dom.empty);
  }
}

// ============================================
// Quota / Budget
// ============================================
async function ensureQuota() {
  await supabase.from('user_quotas').upsert({
    user_id: state.user.id,
    daily_limit: 999,
    used_today: 0,
    daily_budget_usd: 0.1,
    used_today_usd: 0,
    last_reset_date: new Date().toISOString().slice(0, 10),
    plan: 'free',
  }, { onConflict: 'user_id' });
}

async function refreshBudget() {
  const { data, error } = await supabase
    .from('user_quotas')
    .select('*')
    .eq('user_id', state.user.id)
    .single();
  if (error || !data) return;
  state.usedToday = Number(data.used_today_usd) || 0;
  state.dailyBudget = Number(data.daily_budget_usd) || 0.1;
  dom.budgetText.textContent = `$${state.usedToday.toFixed(4)}`;

  // 跨天重置
  const today = new Date().toISOString().slice(0, 10);
  if (data.last_reset_date !== today) {
    await supabase.from('user_quotas')
      .update({ used_today: 0, used_today_usd: 0, last_reset_date: today })
      .eq('user_id', state.user.id);
    state.usedToday = 0;
    dom.budgetText.textContent = '$0.0000';
  }
}

// ============================================
// Settings
// ============================================
async function loadSettings() {
  const { data, error } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', state.user.id)
    .single();

  if (!data) {
    // 第一次使用：自动创建
    await supabase.from('user_settings').insert({ user_id: state.user.id });
    return;
  }
  state.settings = {
    systemPrompt:    data.system_prompt || '',
    temperature:     Number(data.temperature) || 0.7,
    maxTokens:       Number(data.max_tokens) || 2048,
    topP:            Number(data.top_p) || 1.0,
    thinkingEnabled: data.thinking_enabled !== false,
    thinkingLevel:   data.thinking_level || 'medium',
  };
}

function syncSettingsUI() {
  dom.settingSystem.value = state.settings.systemPrompt;
  dom.settingTemp.value   = state.settings.temperature;
  dom.tempValue.textContent = state.settings.temperature.toFixed(1);
  dom.settingMaxtok.value = state.settings.maxTokens;
  dom.maxtokValue.textContent = state.settings.maxTokens;
  dom.settingTopp.value   = state.settings.topP;
  dom.toppValue.textContent = state.settings.topP.toFixed(2);
  dom.settingThinking.checked = state.settings.thinkingEnabled;

  const levelMap = { low: 0, medium: 1, high: 2 };
  const levelVal = levelMap[state.settings.thinkingLevel] ?? 1;
  dom.thinkingLevel.value = levelVal;
  updateThinkingUI();
}

function updateThinkingUI() {
  const levelMap = ['low', 'medium', 'high'];
  const labels = ['Low', 'Medium', 'High'];
  const levelVal = parseInt(dom.thinkingLevel.value);
  dom.thinkingValue.textContent = labels[levelVal];
  // 高亮当前 label
  document.querySelectorAll('.level-label').forEach(el => {
    el.classList.toggle('is-active', parseInt(el.dataset.level) === levelVal);
  });
  // 禁用思考时灰掉 level 选择
  if (dom.settingThinking.checked) {
    dom.thinkingGroup.classList.remove('is-disabled');
  } else {
    dom.thinkingGroup.classList.add('is-disabled');
  }
}

// 实时更新滑块值
dom.settingTemp?.addEventListener('input', () => {
  dom.tempValue.textContent = parseFloat(dom.settingTemp.value).toFixed(1);
});
dom.settingMaxtok?.addEventListener('input', () => {
  dom.maxtokValue.textContent = dom.settingMaxtok.value;
});
dom.settingTopp?.addEventListener('input', () => {
  dom.toppValue.textContent = parseFloat(dom.settingTopp.value).toFixed(2);
});
dom.settingThinking?.addEventListener('change', updateThinkingUI);
dom.thinkingLevel?.addEventListener('input', updateThinkingUI);

dom.settingsSave?.addEventListener('click', async () => {
  const levelMap = ['low', 'medium', 'high'];
  state.settings = {
    systemPrompt:    dom.settingSystem.value.trim(),
    temperature:     parseFloat(dom.settingTemp.value),
    maxTokens:       parseInt(dom.settingMaxtok.value),
    topP:            parseFloat(dom.settingTopp.value),
    thinkingEnabled: dom.settingThinking.checked,
    thinkingLevel:   levelMap[parseInt(dom.thinkingLevel.value)],
  };
  await supabase.from('user_settings').upsert({
    user_id:          state.user.id,
    system_prompt:    state.settings.systemPrompt,
    temperature:      state.settings.temperature,
    max_tokens:       state.settings.maxTokens,
    top_p:            state.settings.topP,
    thinking_enabled: state.settings.thinkingEnabled,
    thinking_level:   state.settings.thinkingLevel,
  }, { onConflict: 'user_id' });
  closeSettings();
});

function openSettings() {
  syncSettingsUI();
  dom.settingsModal.hidden = false;
  setTimeout(() => dom.settingSystem.focus(), 50);
}
function closeSettings() {
  dom.settingsModal.hidden = true;
}

// 弹窗关闭（多种方式）
dom.settingsModal?.querySelectorAll('[data-close]').forEach(el => {
  el.addEventListener('click', closeSettings);
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !dom.settingsModal.hidden) closeSettings();
});

// ============================================
// User menu
// ============================================
dom.userButton.addEventListener('click', (e) => {
  e.stopPropagation();
  dom.userMenu.hidden = !dom.userMenu.hidden;
});

dom.userMenu.querySelectorAll('.menu-item').forEach(item => {
  item.addEventListener('click', async () => {
    const action = item.dataset.action;
    dom.userMenu.hidden = true;
    if (action === 'logout') {
      await supabase.auth.signOut();
    } else if (action === 'settings') {
      openSettings();
    }
  });
});

document.addEventListener('click', (e) => {
  if (!dom.userButton.contains(e.target) && !dom.userMenu.contains(e.target)) {
    dom.userMenu.hidden = true;
  }
});

// ============================================
// Language switcher
// ============================================
document.querySelectorAll('.lang-btn').forEach(btn => {
  btn.addEventListener('click', () => setLang(btn.dataset.lang));
});
applyI18n();  // 初始化翻译

// ============================================
// Sidebar
// ============================================
dom.sidebarToggle.addEventListener('click', () => {
  const isOpen = dom.app.classList.toggle('is-sidebar-open');
  dom.sidebarBackdrop.hidden = !isOpen;
});
dom.sidebarBackdrop.addEventListener('click', () => {
  dom.app.classList.remove('is-sidebar-open');
  dom.sidebarBackdrop.hidden = true;
});

// ============================================
// Conversations
// ============================================
async function loadConversations() {
  const { data } = await supabase
    .from('conversations')
    .select('*')
    .eq('user_id', state.user.id)
    .order('updated_at', { ascending: false });
  renderConversations(data || []);
}

function renderConversations(list) {
  dom.convList.innerHTML = list.map(c => `
    <li class="conversation-item ${c.id === state.conversationId ? 'is-active' : ''}" data-id="${c.id}">
      <span class="conv-title">${escapeHtml(c.title)}</span>
      <span class="delete-conv" data-id="${c.id}">×</span>
    </li>
  `).join('');

  dom.convList.querySelectorAll('.conversation-item').forEach(li => {
    li.addEventListener('click', (e) => {
      if (e.target.classList.contains('delete-conv')) {
        e.stopPropagation();
        deleteConversation(e.target.dataset.id);
        return;
      }
      switchConversation(li.dataset.id);
    });
  });
}

async function newConversation() {
  const { data, error } = await supabase
    .from('conversations')
    .insert({
      user_id: state.user.id,
      title: 'New chat',
      model: dom.modelSelect.value,
    })
    .select()
    .single();
  if (error) return;
  state.conversationId = data.id;
  state.userScrolledUp = false;
  renderMessages([]);
  await loadConversations();
  // 移动端创建后自动收起侧边栏
  if (window.innerWidth <= 768) closeSidebar();
}

async function switchConversation(id) {
  state.conversationId = id;
  const { data } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', id)
    .order('created_at', { ascending: true });
  renderMessages(data || []);
  state.userScrolledUp = false;
  scrollToBottom();
  await loadConversations();
  if (window.innerWidth <= 768) closeSidebar();
}

async function deleteConversation(id) {
  await supabase.from('conversations').delete().eq('id', id);
  if (state.conversationId === id) {
    state.conversationId = null;
    renderMessages([]);
    await loadConversations();
  } else {
    await loadConversations();
  }
}

dom.newChatBtn.addEventListener('click', newConversation);

// 空状态里的 "Start a new chat" 按钮
$('empty-new-chat')?.addEventListener('click', newConversation);

function closeSidebar() {
  dom.app.classList.remove('is-sidebar-open');
  dom.sidebarBackdrop.hidden = true;
}

// ============================================
// Messages rendering
// ============================================
function renderMessages(messages) {
  if (!messages || messages.length === 0) {
    dom.messages.innerHTML = '';
    dom.messages.appendChild(dom.empty);
    return;
  }
  dom.messages.innerHTML = '';
  for (const m of messages) {
    if (m.role === 'system') {
      appendSystemMessage(m.content);
    } else {
      appendMessage(m.role, m.content, false);
    }
  }
  scrollToBottom();
}

function appendMessage(role, content, autoScroll = true) {
  // 移除空状态
  if (dom.empty.parentNode === dom.messages) {
    dom.messages.removeChild(dom.empty);
  }

  const div = document.createElement('div');
  div.className = `message ${role}`;
  const roleLabel = role === 'user' ? 'You' : 'Assistant';
  div.innerHTML = `<div class="message-content">
    <div class="message-role">${roleLabel}</div>
    <details class="thinking-block" hidden>
      <summary>
        <span class="thinking-icon">🧠</span>
        <span class="thinking-label" data-i18n="msg.thinking">Thinking</span>
        <span class="thinking-spinner"></span>
      </summary>
      <div class="thinking-text"></div>
    </details>
    <div class="message-text"></div>
  </div>`;
  const textEl = div.querySelector('.message-text');
  textEl.textContent = content;
  dom.messages.appendChild(div);
  if (autoScroll) scrollToBottom();
  return div;
}

function appendSystemMessage(text) {
  if (dom.empty.parentNode === dom.messages) {
    dom.messages.removeChild(dom.empty);
  }
  const div = document.createElement('div');
  div.className = 'message system';
  div.innerHTML = `<div class="message-content">${escapeHtml(text)}</div>`;
  dom.messages.appendChild(div);
  return div;
}

function updateMessageText(div, text) {
  const el = div.querySelector('.message-text');
  if (el) el.textContent = text;
  // 隐藏 spinner
  const spinner = div.querySelector('.thinking-spinner');
  if (spinner) spinner.style.display = 'none';
  smartScroll();
}

function updateThinkingText(div, text) {
  const block = div.querySelector('.thinking-block');
  const textEl = div.querySelector('.thinking-text');
  if (!block || !textEl) return;
  block.hidden = false;
  textEl.textContent = text;
  smartScroll();
}

// ============================================
// Scroll
// ============================================
function scrollToBottom() {
  requestAnimationFrame(() => {
    dom.messages.scrollTop = dom.messages.scrollHeight;
  });
}

function smartScroll() {
  if (!state.userScrolledUp) scrollToBottom();
}

dom.messages.addEventListener('scroll', () => {
  const distFromBottom = dom.messages.scrollHeight - dom.messages.scrollTop - dom.messages.clientHeight;
  state.userScrolledUp = distFromBottom > 80;
});

// ============================================
// Save messages
// ============================================
async function saveMessage(role, content, model = null) {
  if (!state.conversationId) return;
  await supabase.from('messages').insert({
    conversation_id: state.conversationId,
    role, content, model,
  });
  await supabase.from('conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', state.conversationId);
}

// ============================================
// Streaming chat
// ============================================
async function streamPost({ model, messages, onDelta, onThinking, onDone, onError }) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) {
    onError(new Error('Not signed in'));
    return;
  }

  console.log('[chat] request', { model, msgCount: messages.length });

  let resp;
  try {
    resp = await fetch(`${config.url}/functions/v1/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        model,
        messages,
        systemPrompt:    state.settings.systemPrompt,
        temperature:     state.settings.temperature,
        maxTokens:       state.settings.maxTokens,
        topP:            state.settings.topP,
        thinkingEnabled: state.settings.thinkingEnabled,
        thinkingLevel:   state.settings.thinkingLevel,
      }),
    });
  } catch (err) {
    onError(new Error(`Network error: ${err.message}`));
    return;
  }

  if (!resp.ok) {
    const text = await resp.text();
    let msg = `HTTP ${resp.status}`;
    try { msg = JSON.parse(text).error || msg; } catch {}
    console.error('[chat] HTTP', resp.status, text);
    onError(new Error(msg));
    return;
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let receivedAny = false;
  let lineCount = 0;

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() || '';
      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        lineCount++;
        const payload = line.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;
        try {
          const json = JSON.parse(payload);

          // === OpenAI 格式 ===
          // 可能是 choices[0].delta.content（文本）或 choices[0].delta.reasoning_content（思考）
          const choice = json.choices?.[0]?.delta;
          if (choice) {
            if (choice.content) {
              receivedAny = true;
              onDelta(choice.content);
            }
            if (choice.reasoning_content || choice.reasoning) {
              onThinking(choice.reasoning_content || choice.reasoning);
            }
            continue;
          }

          // === Anthropic 格式 ===
          // content_block_delta: delta.type === 'text_delta' | 'thinking_delta'
          if (json.type === 'content_block_delta' && json.delta) {
            if (json.delta.type === 'text_delta' && json.delta.text) {
              receivedAny = true;
              onDelta(json.delta.text);
            } else if (json.delta.type === 'thinking_delta' && json.delta.thinking) {
              onThinking(json.delta.thinking);
            }
            continue;
          }

          // 错误
          if (json.error) {
            onError(new Error(typeof json.error === 'string' ? json.error : (json.error.message || 'Unknown error')));
            return;
          }
        } catch (e) {
          // 静默忽略非 JSON 行
        }
      }
    }
    console.log(`[chat] stream done, lines=${lineCount}, received=${receivedAny}`);
    if (!receivedAny) {
      onError(new Error('No response from server (received 0 deltas)'));
      return;
    }
    onDone();
  } catch (err) {
    onError(new Error(`Stream error: ${err.message}`));
  }
}

// ============================================
// Composer
// ============================================
dom.userInput.addEventListener('input', () => {
  dom.userInput.style.height = 'auto';
  dom.userInput.style.height = Math.min(dom.userInput.scrollHeight, 200) + 'px';
});

dom.userInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    dom.chatForm.requestSubmit();
  }
});

dom.chatForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (state.isStreaming) return;
  const text = dom.userInput.value.trim();
  if (!text || !state.conversationId) return;

  // 预算检查
  await refreshBudget();
  if (state.usedToday >= state.dailyBudget) {
    alert(`Daily budget exceeded ($${state.usedToday.toFixed(4)} / $${state.dailyBudget.toFixed(4)}).\nResets at midnight UTC.`);
    return;
  }

  appendMessage('user', text);
  await saveMessage('user', text);
  dom.userInput.value = '';
  dom.userInput.style.height = 'auto';
  state.isStreaming = true;
  state.userScrolledUp = false;
  dom.userInput.disabled = true;
  dom.sendBtn.disabled = true;

  // 拉取历史
  const { data: history } = await supabase
    .from('messages')
    .select('role, content')
    .eq('conversation_id', state.conversationId)
    .order('created_at', { ascending: true })
    .limit(20);
  const messages = (history || []).map(m => ({ role: m.role, content: m.content }));

  // 创建 AI 消息占位
  const aiDiv = appendMessage('assistant', '', true);
  aiDiv.classList.add('is-streaming');
  let acc = '';
  let thinkingAcc = '';

  await streamPost({
    model: dom.modelSelect.value,
    messages,
    onDelta: (delta) => {
      acc += delta;
      updateMessageText(aiDiv, acc);
    },
    onThinking: (thinking) => {
      thinkingAcc += thinking;
      updateThinkingText(aiDiv, thinkingAcc);
    },
    onDone: async () => {
      aiDiv.classList.remove('is-streaming');
      await saveMessage('assistant', acc, dom.modelSelect.value);
      // 后端已计费，刷新预算
      await refreshBudget();
      state.isStreaming = false;
      dom.userInput.disabled = false;
      dom.sendBtn.disabled = false;
      dom.userInput.focus();
    },
    onError: (err) => {
      console.error('[chat] error', err);
      aiDiv.classList.remove('is-streaming');
      updateMessageText(aiDiv, `Error: ${err.message}`);
      state.isStreaming = false;
      dom.userInput.disabled = false;
      dom.sendBtn.disabled = false;
    },
  });
});

// ============================================
// Konami Code easter egg
// ============================================
const konami = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
let konamiIdx = 0;
document.addEventListener('keydown', (e) => {
  if (e.key === konami[konamiIdx]) {
    konamiIdx++;
    if (konamiIdx === konami.length) {
      let h = 0;
      const tick = () => {
        h = (h + 5) % 360;
        document.body.style.filter = `hue-rotate(${h}deg)`;
        if (h > 0) requestAnimationFrame(tick);
      };
      tick();
      konamiIdx = 0;
    }
  } else {
    konamiIdx = 0;
  }
});
