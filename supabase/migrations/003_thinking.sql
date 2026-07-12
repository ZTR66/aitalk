-- ============================================
-- Migration 003: Thinking settings
-- ============================================

alter table public.user_settings
  add column if not exists thinking_enabled boolean default true,
  add column if not exists thinking_level   text    default 'medium'
    check (thinking_level in ('low', 'medium', 'high'));

-- 给已存在用户补默认
update public.user_settings
set thinking_enabled = true, thinking_level = 'medium'
where thinking_enabled is null or thinking_level is null;
