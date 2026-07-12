# 🤖 AI Web Talk

> **Multi-model AI chat platform with Y2K 2000s retro vibes** ✨
> 前端 GitHub Pages · 后端 Supabase

![Y2K](https://img.shields.io/badge/style-Y2K-ff00aa?style=flat-square)
![Powered by Supabase](https://img.shields.io/badge/powered%20by-Supabase-3FCF8E?style=flat-square)
![GitHub Pages](https://img.shields.io/badge/deploy-GitHub%20Pages-222?style=flat-square)

## ✨ 特性

- 🎨 **Y2K 2000 复古 UI** — Bevel 边框、跑马灯、星空背景、机器人图标
- 🤖 **多模型切换** — GPT-4o / Claude 3.5 / Gemini 1.5 / DeepSeek
- 🔐 **Supabase Auth** — 邮箱注册 / GitHub OAuth
- 💬 **流式对话** — SSE 实时打字机效果
- 📜 **对话历史** — Postgres 持久化，支持多会话
- 🎫 **配额系统** — 免费用户 50 条/天
- 🌙 **三套主题** — Y2K 经典 / 终端绿 / Vaporwave
- 📱 **响应式** — 桌面 + 移动端

## 🛠️ 技术栈

| 层       | 技术                                  |
| -------- | ------------------------------------- |
| 前端     | 原生 HTML / CSS / JS（零依赖构建）    |
| 后端     | Supabase（BaaS）                      |
| 数据库   | Supabase Postgres + RLS               |
| 鉴权     | Supabase Auth                         |
| AI 代理  | Supabase Edge Functions (Deno)        |
| 部署     | GitHub Pages                          |
| CI/CD    | GitHub Actions                        |

## 🚀 快速开始

### 1. 克隆仓库

```bash
git clone https://github.com/YOUR-USER/aiwebtalk.git
cd aiwebtalk
```

### 2. 创建 Supabase 项目

1. 访问 [supabase.com](https://supabase.com) 新建项目
2. 在 **SQL Editor** 中执行 `supabase/migrations/001_init.sql`
3. 部署 Edge Function：
   ```bash
   # 安装 CLI
   npm install -g supabase
   supabase login
   supabase link --project-ref YOUR-PROJECT-REF
   supabase functions deploy chat
   ```
4. 在 **Settings → Edge Functions → Secrets** 配置 API Keys：
   - `OPENAI_API_KEY`
   - `ANTHROPIC_API_KEY`
   - `GOOGLE_API_KEY`
   - `DEEPSEEK_API_KEY`
5. 在 **Authentication → Providers** 启用 Email / GitHub OAuth
6. 复制 **Project URL** 和 **anon public key**

### 3. 配置 GitHub Secrets

在仓库 **Settings → Secrets and variables → Actions** 添加：

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

### 4. 启用 GitHub Pages

**Settings → Pages → Source → GitHub Actions**

### 5. 推送代码触发部署

```bash
git add .
git commit -m "🎉 Initial commit"
git push origin main
```

几分钟后访问 `https://YOUR-USER.github.io/aiwebtalk/` 🎉

## 📁 目录结构

```
aiwebtalk/
├── index.html                    # 入口
├── css/                          # 样式
│   ├── y2k-base.css
│   ├── window.css
│   └── themes.css
├── js/                           # 业务逻辑
│   ├── supabase-client.js
│   ├── auth.js
│   ├── chat.js
│   ├── streaming.js
│   └── y2k-effects.js
├── assets/                       # 静态资源
│   ├── sounds/
│   └── images/
├── supabase/                     # Supabase 配置
│   ├── migrations/001_init.sql
│   └── functions/chat/index.ts
├── .github/workflows/deploy.yml
└── README.md
```

## 🎮 使用说明

| 快捷键        | 功能             |
| ------------- | ---------------- |
| `Enter`       | 发送消息         |
| `Shift+Enter` | 换行             |
| 双击桌面图标  | 打开对应功能     |
| Konami Code   | 🌈 彩虹特效彩蛋 |

## 🐛 故障排除

<details>
<summary>Edge Function 返回 401</summary>

检查 `SUPABASE_URL` 和 `SUPABASE_ANON_KEY` 是否正确，以及请求头是否带上 `Authorization: Bearer <token>`。

</details>

<details>
<summary>流式响应不工作</summary>

1. 检查浏览器是否支持 `ReadableStream`（Chrome / Edge / Firefox 都支持）
2. 在 Edge Function 日志查看 Provider 返回的错误
3. 确认 Provider API Key 有效

</details>

## 📜 License

MIT © 2000-style

## 🙏 致谢

- Y2K 灵感来自 [Y2K aesthetic wiki](https://aesthetics.fandom.com/wiki/Y2K)
- Supabase 团队打造的神奇 BaaS
- 所有开源贡献者
