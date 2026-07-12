# 🚀 AI Web Talk 项目方案

## 一、项目概述

打造一个**多模型 AI 对话平台**，采用 **Y2K 2000 年代复古设计语言**，前端部署在 GitHub Pages，后端由 Supabase 提供全栈服务（BaaS）。

---

## 二、技术架构

```
┌─────────────────────────────────────────────────────────┐
│  GitHub Pages  (静态前端: HTML / CSS / JS)              │
│  - Y2K 复古 UI                                         │
│  - Supabase JS SDK 客户端                              │
└────────────────────┬────────────────────────────────────┘
                     │ HTTPS / WebSocket
                     ▼
┌─────────────────────────────────────────────────────────┐
│  Supabase                                              │
│  ┌───────────────┐  ┌───────────────┐  ┌─────────────┐ │
│  │  Auth         │  │  Postgres DB  │  │ Edge Funcs  │ │
│  │  邮箱/OAuth   │  │ 用户/对话/配额│  │  AI 代理层  │ │
│  └───────────────┘  └───────────────┘  └──────┬──────┘ │
└──────────────────────────────────────────────┼────────┘
                                               │
                       ┌───────────────────────┼────────────┐
                       ▼                       ▼            ▼
                  ┌─────────┐            ┌─────────┐    ┌─────────┐
                  │ OpenAI  │            │ Anthropic│    │  其他   │
                  │ GPT 系  │            │ Claude   │    │ Provider│
                  └─────────┘            └─────────┘    └─────────┘
```

**为什么不让前端直接调 AI API？**

- 🔒 API Key 不能暴露在浏览器
- 📊 需要统一做用户配额、计费、日志
- 🔄 便于切换/扩展模型 Provider

---

## 三、Y2K 2000 复古设计规范

### 🎨 配色方案

| 用途         | 颜色         | 色值                       |
| ------------ | ------------ | -------------------------- |
| 主背景       | 渐变天蓝     | `#5B9BD5 → #2E5C8A`        |
| 窗口底色     | 米白/浅灰    | `#ECE9D8`                  |
| 强调色 1     | 霓虹紫       | `#9B30FF`                  |
| 强调色 2     | 酸性绿       | `#00FF66`                  |
| 强调色 3     | 铬黄         | `#FFCC00`                  |
| 文字主色     | 深海蓝       | `#003399`                  |
| 边框高光     | 白色         | `#FFFFFF`                  |
| 边框阴影     | 深灰         | `#404040`                  |

### 🧩 视觉元素

- **Bevel 边框**：凸起的 3D 立体感（`border-top: 2px solid #fff; border-bottom: 2px solid #404040`）
- **渐变金属按钮**：Chrome / Brushed Metal 质感
- **拟物化图标**：机器人🤖、UFO🛸、卫星📡、星际🚀
- **动画效果**：闪烁文字、Marquee 滚动条、星空背景、`<blink>` 标签
- **字体**：`Comic Sans MS`、`Trebuchet MS`、`Impact`、`MS Sans Serif`
- **音效**：打字机滴答声、按钮点击 beep（可关闭）

### 🖼️ 页面分区（仿 Windows 2000 窗口）

```
┌─[ AI Web Talk - [Online] ]───[_][□][×]─┐
│ File  Edit  Models  Help                │  ← 菜单栏
├──────────────────────────────────────────┤
│ 💬 Conversation Area                     │
│ ┌────────────────────────────────────┐   │
│ │ [User]: 你好                       │   │
│ │ [AI]: 你好！欢迎来到未来~ ✨       │   │
│ │ [User]: 讲个笑话                   │   │
│ │ [AI]: 为什么程序员喜欢黑暗...      │   │
│ └────────────────────────────────────┘   │
├──────────────────────────────────────────┤
│ Model: [▼ GPT-4o    ]  [Send 🚀]        │  ← 模型切换 + 输入
├──────────────────────────────────────────┤
│ 🟢 Connected | Tokens: 1,234 | v1.0     │  ← 状态栏
└──────────────────────────────────────────┘
```

---

## 四、功能模块

| 模块            | 描述                                       |
| --------------- | ------------------------------------------ |
| 🔐 **用户系统** | Supabase Auth（邮箱+OTP / GitHub OAuth）   |
| 🤖 **多模型切换** | 下拉菜单选择 GPT-4o / Claude / Gemini / DeepSeek 等 |
| 💬 **对话管理** | 多会话、新建、删除、历史列表（左侧树）     |
| 📜 **历史记录** | 持久化到 Postgres，可回看                  |
| 🎫 **配额系统** | 免费 N 次/天，超限提示                     |
| 💾 **数据导出** | 对话导出为 Markdown / JSON                 |
| 🌙 **主题切换** | Y2K 经典 / 暗黑 / 星空三种                 |
| 📱 **响应式**   | 桌面优先，移动端兼容                       |

---

## 五、数据库设计（Supabase Postgres）

```sql
-- 用户配额表
create table public.user_quotas (
  user_id uuid primary key references auth.users(id) on delete cascade,
  daily_limit int default 50,
  used_today int default 0,
  last_reset_date date default current_date,
  plan text default 'free'  -- 'free' | 'pro'
);

-- 对话表
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  title text not null,
  model text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 消息表
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  model text,
  tokens int,
  created_at timestamptz default now()
);

-- 启用 RLS
alter table conversations enable row level security;
alter table messages enable row level security;
alter table user_quotas enable row level security;

-- RLS 策略：用户只能访问自己的数据
create policy "Users see own conversations" on conversations
  for all using (auth.uid() = user_id);
-- (类似的策略应用于其他表)
```

---

## 六、Supabase Edge Function 关键代码

**`supabase/functions/chat/index.ts`**

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MODEL_MAP: Record<string, { provider: string; model: string }> = {
  "gpt-4o":       { provider: "openai",    model: "gpt-4o" },
  "gpt-4o-mini":  { provider: "openai",    model: "gpt-4o-mini" },
  "claude-3.5":   { provider: "anthropic", model: "claude-3-5-sonnet-20241022" },
  "gemini-1.5":   { provider: "google",    model: "gemini-1.5-pro" },
  "deepseek":     { provider: "deepseek",  model: "deepseek-chat" },
};

serve(async (req) => {
  const { model, messages } = await req.json();
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
  // 1. 鉴权 & 配额检查
  // 2. 路由到对应 Provider
  // 3. 流式返回 (SSE)
  // 4. 写回 messages 表
});
```

---

## 七、目录结构

```
aiwebtalk/
├── index.html                  # 入口
├── css/
│   ├── y2k-base.css           # 复古基础样式
│   ├── window.css             # 窗口样式
│   └── themes.css             # 主题
├── js/
│   ├── supabase-client.js     # Supabase 初始化
│   ├── auth.js                # 登录注册
│   ├── chat.js                # 对话主逻辑
│   ├── streaming.js           # SSE 流式渲染
│   └── y2k-effects.js         # 闪烁/音效/动画
├── assets/
│   ├── sounds/                # 滴答声、beep
│   └── images/                # 机器人、星空背景
├── supabase/
│   ├── migrations/            # SQL 迁移
│   └── functions/chat/        # Edge Function
├── .github/workflows/
│   └── deploy.yml             # 部署到 GH Pages
└── README.md
```

---

## 八、部署流程

| 步骤 | 操作                                                       |
| ---- | ---------------------------------------------------------- |
| 1️⃣   | GitHub 创建 `aiwebtalk` 仓库，开启 Pages                   |
| 2️⃣   | Supabase 创建项目，配置 Auth + DB + Edge Function          |
| 3️⃣   | GitHub Secrets 写入 `SUPABASE_URL` / `SUPABASE_ANON_KEY`   |
| 4️⃣   | 推送代码 → Actions 自动部署前端到 Pages                    |
| 5️⃣   | `supabase functions deploy chat` 部署后端                 |

---

## 九、迭代路线

- **Phase 1（MVP）**：Y2K UI + Auth + 单模型 + 流式对话
- **Phase 2**：多模型切换 + 对话历史 + 配额系统
- **Phase 3**：语音输入/输出 + 主题切换 + 数据导出
- **Phase 4**：插件市场、自定义 System Prompt、分享对话

---

## 十、预估成本

| 服务            | 免费额度                                | 说明                |
| --------------- | --------------------------------------- | ------------------- |
| GitHub Pages    | 无限（公开仓库）                        | 静态托管            |
| Supabase        | 500MB DB + 50万 Edge Function 调用/月   | 足够个人项目        |
| OpenAI API      | 按 token 计费                           | ~$0.005/1K tokens   |
| **月成本**      | **约 $5-20**                            | 视使用量            |
