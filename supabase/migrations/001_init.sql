-- ============================================
-- AI Web Talk - Initial Database Schema (Idempotent)
-- 可重复执行，不会因已存在对象而失败
-- ============================================

-- ---------- 用户配额表 ----------
create table if not exists public.user_quotas (
  user_id uuid primary key references auth.users(id) on delete cascade,
  daily_limit int default 50,
  used_today int default 0,
  last_reset_date date default current_date,
  plan text default 'free' check (plan in ('free', 'pro'))
);

-- ---------- 对话表 ----------
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'New Chat',
  model text not null default 'gpt-4o-mini',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_conversations_user
  on public.conversations(user_id, updated_at desc);

-- ---------- 消息表 ----------
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  model text,
  tokens int,
  created_at timestamptz default now()
);

create index if not exists idx_messages_conv
  on public.messages(conversation_id, created_at asc);

-- ============================================
-- 触发器函数：自动更新 updated_at
-- ============================================
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_conversations_updated on public.conversations;
create trigger trg_conversations_updated
  before update on public.conversations
  for each row execute function public.touch_updated_at();

-- ============================================
-- 触发器函数：新用户自动创建配额
-- ============================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.user_quotas (user_id, daily_limit, used_today, last_reset_date, plan)
  values (new.id, 50, 0, current_date, 'free')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================
-- RPC: 增加配额
-- ============================================
create or replace function public.increment_quota(uid uuid)
returns void language sql security definer as $$
  update public.user_quotas
  set used_today = used_today + 1
  where user_id = uid;
$$;

-- ============================================
-- RLS
-- ============================================
alter table public.user_quotas enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;

-- 删除可能残留的策略（保证幂等）
drop policy if exists "Users read own quota" on public.user_quotas;
drop policy if exists "Users manage own conversations" on public.conversations;
drop policy if exists "Users manage own messages" on public.messages;

-- 用户只能读自己的配额
create policy "Users read own quota" on public.user_quotas
  for select using (auth.uid() = user_id);

-- 用户可以增删改查自己的对话
create policy "Users manage own conversations" on public.conversations
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 用户可以增删改查自己对话中的消息
create policy "Users manage own messages" on public.messages
  for all using (
    conversation_id in (
      select id from public.conversations where user_id = auth.uid()
    )
  )
  with check (
    conversation_id in (
      select id from public.conversations where user_id = auth.uid()
    )
  );
