-- AI 指导英语阅读 · Supabase 多用户后端初始化脚本
-- 用法：Supabase 控制台 → SQL Editor → 粘贴本文件全部内容 → Run
-- 另需在 Authentication → Providers → Email 中关闭 "Confirm email"
-- （或保持开启，用户注册后需点确认邮件才能登录）

-- ══ 文章表：每行一篇文章，payload 为完整导读 JSON（沿用原 schema） ══
create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references auth.users(id) on delete cascade,
  slug text not null,
  visibility text not null default 'private' check (visibility in ('private', 'public')),
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner, slug)
);

alter table public.articles enable row level security;

-- 公开文章所有人可读；私密文章仅本人可读
create policy "articles_select" on public.articles for select
  using (visibility = 'public' or owner = auth.uid());
create policy "articles_insert" on public.articles for insert
  with check (owner = auth.uid());
create policy "articles_update" on public.articles for update
  using (owner = auth.uid()) with check (owner = auth.uid());
create policy "articles_delete" on public.articles for delete
  using (owner = auth.uid());

-- ══ 知识库手动条目：每用户一行，data 为四类词条的 JSON ══
create table if not exists public.kb_extra (
  owner uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.kb_extra enable row level security;

-- 知识库为个人数据，仅本人可读写
create policy "kb_select" on public.kb_extra for select
  using (owner = auth.uid());
create policy "kb_insert" on public.kb_extra for insert
  with check (owner = auth.uid());
create policy "kb_update" on public.kb_extra for update
  using (owner = auth.uid()) with check (owner = auth.uid());
