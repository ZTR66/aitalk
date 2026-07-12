// ============================================
// Chat Module - Main conversation logic
// ============================================
import { supabase } from './supabase-client.js';
import { chatStream } from './streaming.js';

const messagesEl = document.getElementById('messages');
const chatForm = document.getElementById('chat-form');
const userInput = document.getElementById('user-input');
const modelSelect = document.getElementById('model-select');
const newChatBtn = document.getElementById('new-chat-btn');
const convListEl = document.getElementById('conversation-list');
const statusText = document.getElementById('status-text');
const quotaText = document.getElementById('quota-text');

let currentConvId = null;
let currentUser = null;

// 接收初始化
window.addEventListener('chat-init', async (e) => {
  currentUser = e.detail.user;
  statusText.textContent = `🟢 Connected as ${currentUser.email}`;
  await ensureQuota();
  await refreshQuota();
  await loadConversations();
  await newConversation();
});

window.addEventListener('logout', () => {
  currentConvId = null;
  messagesEl.innerHTML = '';
  convListEl.innerHTML = '';
  userInput.value = '';
});

// ============================================
// 数据层：CRUD
// ============================================

async function ensureQuota() {
  const { error } = await supabase.from('user_quotas').upsert({
    user_id: currentUser.id,
    daily_limit: 50,
    used_today: 0,
    last_reset_date: new Date().toISOString().slice(0, 10),
    plan: 'free',
  }, { onConflict: 'user_id' });
  if (error) console.warn('ensureQuota', error);
}

async function refreshQuota() {
  const { data, error } = await supabase
    .from('user_quotas')
    .select('*')
    .eq('user_id', currentUser.id)
    .single();
  if (error) { quotaText.textContent = 'Tokens: ?'; return; }
  quotaText.textContent = `Quota: ${data.used_today} / ${data.daily_limit} (${data.plan})`;

  // 跨天重置
  const today = new Date().toISOString().slice(0, 10);
  if (data.last_reset_date !== today) {
    await supabase.from('user_quotas')
      .update({ used_today: 0, last_reset_date: today })
      .eq('user_id', currentUser.id);
  }
  return data;
}

async function loadConversations() {
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('user_id', currentUser.id)
    .order('updated_at', { ascending: false });
  if (error) { console.error(error); return; }
  renderConversations(data);
}

function renderConversations(list) {
  convListEl.innerHTML = list.map(c => `
    <li class="conversation-item ${c.id === currentConvId ? 'active' : ''}" data-id="${c.id}">
      <span>${escapeHtml(c.title)}</span>
      <span class="delete-conv" data-id="${c.id}">×</span>
    </li>
  `).join('');
  convListEl.querySelectorAll('.conversation-item').forEach(li => {
    li.addEventListener('click', (e) => {
      if (e.target.classList.contains('delete-conv')) {
        e.stopPropagation();
        deleteConversation(e.target.dataset.id);
      } else {
        switchConversation(li.dataset.id);
      }
    });
  });
}

async function newConversation() {
  const title = 'New Chat ' + new Date().toLocaleTimeString();
  const { data, error } = await supabase
    .from('conversations')
    .insert({ user_id: currentUser.id, title, model: modelSelect.value })
    .select()
    .single();
  if (error) { console.error(error); return; }
  currentConvId = data.id;
  messagesEl.innerHTML = '';
  appendSystemMessage('✨ 新的对话开始了...');
  await loadConversations();
}

async function switchConversation(id) {
  currentConvId = id;
  messagesEl.innerHTML = '';
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', id)
    .order('created_at', { ascending: true });
  if (error) { console.error(error); return; }
  for (const m of data) {
    appendMessage(m.role, m.content);
  }
  await loadConversations();
}

async function deleteConversation(id) {
  if (!confirm('Delete this conversation?')) return;
  await supabase.from('conversations').delete().eq('id', id);
  if (currentConvId === id) await newConversation();
  else await loadConversations();
}

async function saveMessage(role, content, model = null, tokens = null) {
  if (!currentConvId) return;
  await supabase.from('messages').insert({
    conversation_id: currentConvId,
    role, content, model, tokens,
  });
  // 更新会话 updated_at
  await supabase.from('conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', currentConvId);
}

// ============================================
// 渲染层
// ============================================

function appendMessage(role, content) {
  const div = document.createElement('div');
  div.className = `message ${role}`;
  div.innerHTML = `
    <div class="msg-role">${role === 'user' ? '🧑 You' : '🤖 AI'}</div>
    <div class="msg-content">${escapeHtml(content)}</div>
  `;
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return div;
}

function appendSystemMessage(text) {
  const div = document.createElement('div');
  div.className = 'message system';
  div.innerHTML = `<div class="msg-content">${escapeHtml(text)}</div>`;
  messagesEl.appendChild(div);
  return div;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

// ============================================
// 事件绑定
// ============================================

newChatBtn.addEventListener('click', newConversation);

userInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    chatForm.requestSubmit();
  }
});

chatForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = userInput.value.trim();
  if (!text || !currentConvId) return;

  // 配额检查
  const quota = await refreshQuota();
  if (quota && quota.used_today >= quota.daily_limit) {
    alert(`🚫 Quota exceeded (${quota.daily_limit}/day). Try again tomorrow!`);
    return;
  }

  // 用户消息
  appendMessage('user', text);
  await saveMessage('user', text);
  userInput.value = '';
  userInput.disabled = true;
  statusText.textContent = '🤖 AI is thinking...';

  // 拉取历史作为上下文
  const { data: history } = await supabase
    .from('messages')
    .select('role, content')
    .eq('conversation_id', currentConvId)
    .order('created_at', { ascending: true })
    .limit(20);

  const messages = (history || []).map(m => ({ role: m.role, content: m.content }));

  // AI 响应（流式）
  const aiDiv = appendMessage('assistant', '');
  aiDiv.classList.add('streaming');
  const contentEl = aiDiv.querySelector('.msg-content');
  let acc = '';

  await chatStream({
    model: modelSelect.value,
    messages,
    onDelta: (delta) => {
      acc += delta;
      contentEl.textContent = acc;
      messagesEl.scrollTop = messagesEl.scrollHeight;
    },
    onDone: async () => {
      aiDiv.classList.remove('streaming');
      await saveMessage('assistant', acc, modelSelect.value);
      // 增加配额计数
      await supabase.rpc('increment_quota', { uid: currentUser.id });
      await refreshQuota();
      statusText.textContent = '🟢 Ready';
      userInput.disabled = false;
      userInput.focus();
    },
    onError: async (err) => {
      aiDiv.classList.remove('streaming');
      contentEl.textContent = `❌ Error: ${err.message}`;
      statusText.textContent = '🔴 Error';
      userInput.disabled = false;
    },
  });
});
