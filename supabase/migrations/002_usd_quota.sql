-- ============================================
-- Migration 002: USD-based quota
-- 每个用户每天 $0.1 预算（可调整）
-- ============================================

-- 添加 USD 预算字段
alter table public.user_quotas
  add column if not exists daily_budget_usd numeric(10, 4) default 0.1,
  add column if not exists used_today_usd  numeric(10, 6) default 0;

-- 改 RPC：支持增量 USD
create or replace function public.increment_quota(uid uuid, amount_usd numeric default 0)
returns void language sql security definer as $$
  update public.user_quotas
  set
    used_today = used_today + 1,
    used_today_usd = used_today_usd + amount_usd
  where user_id = uid;
$$;

-- 用户设置表（每个用户一套默认 AI 参数）
create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  system_prompt text default '',
  temperature numeric(3, 2) default 0.7 check (temperature >= 0 and temperature <= 2),
  max_tokens int default 2048 check (max_tokens >= 64 and max_tokens <= 32768),
  top_p numeric(3, 2) default 1.0 check (top_p >= 0 and top_p <= 1),
  updated_at timestamptz default now()
);

alter table public.user_settings enable row level security;

drop policy if exists "Users manage own settings" on public.user_settings;
create policy "Users manage own settings" on public.user_settings
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 触发器：新用户自动创建 settings
create or replace function public.handle_new_user_settings()
returns trigger language plpgsql security definer as $$
begin
  insert into public.user_settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_settings on auth.users;
create trigger on_auth_user_created_settings
  after insert on auth.users
  for each row execute function public.handle_new_user_settings();

-- 手动为已有用户补建
insert into public.user_settings (user_id)
select id from auth.users
on conflict (user_id) do nothing;
