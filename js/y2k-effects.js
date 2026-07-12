// ============================================
// Y2K Effects - Blinking, Sounds, Animations
// ============================================

let sfxEnabled = true;
let audioCtx = null;

// 获取 AudioContext（首次用户交互后初始化）
function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

// ============================================
// Web Audio API 生成复古音效
// ============================================
function playBeep(freq = 800, duration = 0.05, type = 'square', volume = 0.05) {
  if (!sfxEnabled) return;
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch {}
}

function playTypeSound() {
  playBeep(1200 + Math.random() * 200, 0.03, 'square', 0.02);
}

// ============================================
// 按钮点击音效
// ============================================
document.addEventListener('click', (e) => {
  if (e.target.matches('button, .desktop-icon, .tab, .menu-item, .conversation-item')) {
    playBeep(900, 0.04, 'square', 0.04);
  }
});

// ============================================
// 打字机音效
// ============================================
const userInput = document.getElementById('user-input');
let typeTimer = null;
userInput?.addEventListener('keydown', () => {
  if (typeTimer) return;
  playTypeSound();
  typeTimer = setTimeout(() => { typeTimer = null; }, 60);
});

// ============================================
// 标题栏闪烁文字（连接中状态）
// ============================================
function blinkElement(el) {
  if (!el) return;
  setInterval(() => {
    if (el.dataset.blink === 'on') {
      el.style.visibility = el.style.visibility === 'hidden' ? 'visible' : 'hidden';
    }
  }, 600);
}

const statusText = document.getElementById('status-text');
statusText?.addEventListener('click', () => {
  statusText.dataset.blink = statusText.dataset.blink === 'on' ? 'off' : 'on';
});

// ============================================
// 主题切换器（注入到 body）
// ============================================
function injectThemeSwitcher() {
  const switcher = document.createElement('div');
  switcher.className = 'theme-switcher';
  switcher.innerHTML = `
    <button class="theme-btn theme-y2k active"      data-theme="y2k-classic"  title="Y2K Classic"></button>
    <button class="theme-btn theme-matrix"          data-theme="matrix"       title="Matrix"></button>
    <button class="theme-btn theme-vapor"           data-theme="vaporwave"    title="Vaporwave"></button>
    <button class="theme-btn" id="sfx-toggle"       title="Toggle SFX" style="background:#fff;font-size:14px;">🔊</button>
  `;
  document.body.appendChild(switcher);

  switcher.querySelectorAll('.theme-btn[data-theme]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.body.dataset.theme = btn.dataset.theme;
      switcher.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  document.getElementById('sfx-toggle').addEventListener('click', (e) => {
    sfxEnabled = !sfxEnabled;
    e.target.textContent = sfxEnabled ? '🔊' : '🔇';
  });
}
injectThemeSwitcher();

// ============================================
// 桌面图标点击：打开窗口
// ============================================
document.querySelectorAll('.desktop-icon').forEach(icon => {
  icon.addEventListener('dblclick', () => {
    const app = icon.dataset.app;
    if (app === 'chat') {
      document.getElementById('auth-window')?.classList.add('hidden');
      document.getElementById('chat-window')?.classList.remove('hidden');
    } else if (app === 'settings') {
      alert('⚙️ Settings panel coming soon!');
    } else if (app === 'about') {
      alert('📡 AI Web Talk v1.0\n✨ Y2K Style\nPowered by Supabase & GitHub Pages');
    }
  });
});

// ============================================
// Easter Egg: Konami Code
// ============================================
const konami = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
let konamiIdx = 0;
document.addEventListener('keydown', (e) => {
  if (e.key === konami[konamiIdx]) {
    konamiIdx++;
    if (konamiIdx === konami.length) {
      document.body.style.animation = 'rainbow 3s linear infinite';
      konamiIdx = 0;
    }
  } else {
    konamiIdx = 0;
  }
});

// 注入 rainbow keyframes
const style = document.createElement('style');
style.textContent = `
  @keyframes rainbow {
    0%   { filter: hue-rotate(0deg); }
    100% { filter: hue-rotate(360deg); }
  }
`;
document.head.appendChild(style);
