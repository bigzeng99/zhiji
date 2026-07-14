-- ============================================================
-- 知记 Supabase 数据库初始化
-- ============================================================

-- 0. 启用必要扩展
create extension if not exists "pgcrypto";

-- ============================================================
-- 1. 用户资料表
-- ============================================================
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  nickname text,
  avatar_url text,
  is_vip boolean not null default false,
  vip_expires_at timestamptz,
  upload_bonus int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

-- 自动创建 profile
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, nickname)
  values (new.id, coalesce(new.raw_user_meta_data->>'nickname', '知记用户'));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- 2. 小组表
-- ============================================================
create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text default '',
  owner_id uuid not null references public.profiles on delete cascade,
  invite_code text unique default substring(gen_random_uuid()::text, 1, 8),
  max_members int not null default 50,
  created_at timestamptz not null default now()
);

alter table public.teams enable row level security;

create table public.team_members (
  team_id uuid not null references public.teams on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  joined_at timestamptz not null default now(),
  primary key (team_id, user_id)
);

alter table public.team_members enable row level security;

-- 小组成员可见小组
create policy "teams_select_member" on public.teams
  for select using (
    id in (select team_id from public.team_members where user_id = auth.uid())
  );
create policy "teams_insert_vip" on public.teams
  for insert with check (auth.uid() = owner_id);
create policy "teams_update_owner" on public.teams
  for update using (auth.uid() = owner_id);
create policy "teams_delete_owner" on public.teams
  for delete using (auth.uid() = owner_id);

create policy "team_members_select" on public.team_members
  for select using (
    team_id in (select team_id from public.team_members where user_id = auth.uid())
  );
create policy "team_members_insert" on public.team_members
  for insert with check (auth.uid() = user_id);
create policy "team_members_delete_self" on public.team_members
  for delete using (auth.uid() = user_id);
create policy "team_members_delete_owner" on public.team_members
  for delete using (
    team_id in (select id from public.teams where owner_id = auth.uid())
  );

-- ============================================================
-- 3. 科目表
-- ============================================================
create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  icon text not null default '📚',
  color text not null default '#3B82F6',
  owner_id uuid references public.profiles on delete cascade,
  team_id uuid references public.teams on delete cascade,
  is_system boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.subjects enable row level security;

create policy "subjects_select" on public.subjects
  for select using (
    is_system = true
    or owner_id = auth.uid()
    or team_id in (select team_id from public.team_members where user_id = auth.uid())
  );
create policy "subjects_insert" on public.subjects
  for insert with check (auth.uid() = owner_id);
create policy "subjects_update_owner" on public.subjects
  for update using (auth.uid() = owner_id);
create policy "subjects_delete_owner" on public.subjects
  for delete using (auth.uid() = owner_id);

-- ============================================================
-- 4. 知识点表（核心）
-- ============================================================
create table public.points (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects on delete cascade,
  owner_id uuid not null references public.profiles on delete cascade,
  visibility text not null default 'private' check (visibility in ('private', 'public', 'team')),
  team_id uuid references public.teams on delete set null,
  title text not null,
  category text not null default '',
  question text not null,
  answer text not null,
  status text not null default 'active' check (status in ('active', 'reported', 'suspended', 'deleted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_points_subject on public.points(subject_id);
create index idx_points_owner on public.points(owner_id);
create index idx_points_visibility on public.points(visibility);
create index idx_points_team on public.points(team_id);

alter table public.points enable row level security;

create policy "points_select" on public.points
  for select using (
    status = 'active' and (
      owner_id = auth.uid()
      or visibility = 'public'
      or (visibility = 'team' and team_id in (
        select team_id from public.team_members where user_id = auth.uid()
      ))
    )
  );
create policy "points_insert" on public.points
  for insert with check (auth.uid() = owner_id);
create policy "points_update_owner" on public.points
  for update using (auth.uid() = owner_id);
create policy "points_delete_owner" on public.points
  for delete using (auth.uid() = owner_id);

-- ============================================================
-- 5. 用户学习进度表（每人每知识点独立 SRS 状态）
-- ============================================================
create table public.user_points (
  user_id uuid not null references public.profiles on delete cascade,
  point_id uuid not null references public.points on delete cascade,
  ease_factor float not null default 2.5,
  interval_days int not null default 0,
  repetitions int not null default 0,
  next_review date not null default current_date,
  last_review timestamptz,
  favorited boolean not null default false,
  suspended boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, point_id)
);

create index idx_user_points_next_review on public.user_points(user_id, next_review);
create index idx_user_points_favorited on public.user_points(user_id, favorited);

alter table public.user_points enable row level security;

create policy "user_points_select_own" on public.user_points
  for select using (auth.uid() = user_id);
create policy "user_points_insert_own" on public.user_points
  for insert with check (auth.uid() = user_id);
create policy "user_points_update_own" on public.user_points
  for update using (auth.uid() = user_id);
create policy "user_points_delete_own" on public.user_points
  for delete using (auth.uid() = user_id);

-- ============================================================
-- 6. 复习记录表
-- ============================================================
create table public.reviews (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles on delete cascade,
  point_id uuid not null references public.points on delete cascade,
  rating int not null check (rating between 0 and 5),
  ease_factor_before float,
  ease_factor_after float,
  interval_before int,
  interval_after int,
  reviewed_at timestamptz not null default now()
);

create index idx_reviews_user on public.reviews(user_id, reviewed_at);
create index idx_reviews_point on public.reviews(point_id);

alter table public.reviews enable row level security;

create policy "reviews_select_own" on public.reviews
  for select using (auth.uid() = user_id);
create policy "reviews_insert_own" on public.reviews
  for insert with check (auth.uid() = user_id);

-- ============================================================
-- 7. 每日统计表
-- ============================================================
create table public.daily_stats (
  user_id uuid not null references public.profiles on delete cascade,
  date date not null default current_date,
  new_learned int not null default 0,
  reviewed int not null default 0,
  primary key (user_id, date)
);

alter table public.daily_stats enable row level security;

create policy "daily_stats_select_own" on public.daily_stats
  for select using (auth.uid() = user_id);
create policy "daily_stats_insert_own" on public.daily_stats
  for insert with check (auth.uid() = user_id);
create policy "daily_stats_update_own" on public.daily_stats
  for update using (auth.uid() = user_id);

-- ============================================================
-- 8. 每日上传计数表
-- ============================================================
create table public.daily_upload_counts (
  user_id uuid not null references public.profiles on delete cascade,
  date date not null default current_date,
  private_count int not null default 0,
  public_count int not null default 0,
  team_count int not null default 0,
  primary key (user_id, date)
);

alter table public.daily_upload_counts enable row level security;

create policy "upload_counts_select_own" on public.daily_upload_counts
  for select using (auth.uid() = user_id);
create policy "upload_counts_insert_own" on public.daily_upload_counts
  for insert with check (auth.uid() = user_id);
create policy "upload_counts_update_own" on public.daily_upload_counts
  for update using (auth.uid() = user_id);

-- ============================================================
-- 9. 举报表
-- ============================================================
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles on delete cascade,
  point_id uuid not null references public.points on delete cascade,
  reason text not null default '',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references public.profiles,
  reward_given boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.reports enable row level security;

create policy "reports_insert_own" on public.reports
  for insert with check (auth.uid() = reporter_id);
create policy "reports_select_own" on public.reports
  for select using (auth.uid() = reporter_id);

-- ============================================================
-- 10. 分享奖励记录表
-- ============================================================
create table public.share_records (
  id uuid primary key default gen_random_uuid(),
  sharer_id uuid not null references public.profiles on delete cascade,
  invitee_id uuid references public.profiles on delete set null,
  rewarded boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.share_records enable row level security;

create policy "shares_select_own" on public.share_records
  for select using (auth.uid() = sharer_id);
create policy "shares_insert" on public.share_records
  for insert with check (auth.uid() = sharer_id or auth.uid() = invitee_id);

-- ============================================================
-- 11. 数据埋点表
-- ============================================================
create table public.events (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles on delete set null,
  event_type text not null,
  event_data jsonb default '{}',
  created_at timestamptz not null default now()
);

create index idx_events_user on public.events(user_id, created_at);
create index idx_events_type on public.events(event_type, created_at);

alter table public.events enable row level security;

create policy "events_insert" on public.events
  for insert with check (auth.uid() = user_id or user_id is null);

-- ============================================================
-- 12. 用户设置表
-- ============================================================
create table public.user_settings (
  user_id uuid primary key references public.profiles on delete cascade,
  daily_limit int not null default 30,
  feed_algorithm boolean not null default false,
  feed_filter_mode text not null default 'all' check (feed_filter_mode in ('all', 'include', 'exclude')),
  feed_filter_subjects uuid[] default '{}',
  feed_source text not null default 'all' check (feed_source in ('all', 'personal', 'team', 'public')),
  updated_at timestamptz not null default now()
);

alter table public.user_settings enable row level security;

create policy "settings_select_own" on public.user_settings
  for select using (auth.uid() = user_id);
create policy "settings_insert_own" on public.user_settings
  for insert with check (auth.uid() = user_id);
create policy "settings_update_own" on public.user_settings
  for update using (auth.uid() = user_id);

-- ============================================================
-- 13. 辅助函数：检查上传配额
-- ============================================================
create or replace function public.check_upload_quota(
  p_user_id uuid,
  p_visibility text
)
returns jsonb as $$
declare
  v_is_vip boolean;
  v_bonus int;
  v_today_private int;
  v_today_public int;
  v_today_team int;
  v_limit_private int;
  v_limit_public int;
  v_limit_team int;
  v_remaining int;
begin
  select is_vip, upload_bonus into v_is_vip, v_bonus
  from public.profiles where id = p_user_id;

  select coalesce(private_count, 0), coalesce(public_count, 0), coalesce(team_count, 0)
  into v_today_private, v_today_public, v_today_team
  from public.daily_upload_counts
  where user_id = p_user_id and date = current_date;

  if v_is_vip then
    v_limit_private := 500 + v_bonus;
    v_limit_public := 500 + v_bonus;
    v_limit_team := 500 + v_bonus;
  else
    v_limit_private := 10 + v_bonus;
    v_limit_public := 50 + v_bonus;
    v_limit_team := 0;
  end if;

  if p_visibility = 'private' then
    v_remaining := v_limit_private - v_today_private;
  elsif p_visibility = 'public' then
    v_remaining := v_limit_public - v_today_public;
  elsif p_visibility = 'team' then
    if not v_is_vip then
      return jsonb_build_object('allowed', false, 'remaining', 0, 'reason', '小组上传需要会员');
    end if;
    v_remaining := v_limit_team - v_today_team;
  end if;

  if v_remaining <= 0 then
    return jsonb_build_object('allowed', false, 'remaining', 0, 'reason', '今日上传次数已用完');
  end if;

  return jsonb_build_object('allowed', true, 'remaining', v_remaining);
end;
$$ language plpgsql security definer;

-- ============================================================
-- 14. 辅助函数：处理分享奖励
-- ============================================================
create or replace function public.claim_share_reward(
  p_sharer_id uuid,
  p_invitee_id uuid
)
returns boolean as $$
declare
  v_exists boolean;
begin
  select exists(
    select 1 from public.share_records
    where sharer_id = p_sharer_id and invitee_id = p_invitee_id
  ) into v_exists;

  if v_exists then return false; end if;

  insert into public.share_records (sharer_id, invitee_id, rewarded)
  values (p_sharer_id, p_invitee_id, true);

  update public.profiles
  set upload_bonus = upload_bonus + 5
  where id = p_sharer_id;

  return true;
end;
$$ language plpgsql security definer;

-- ============================================================
-- 15. 插入系统预置科目
-- ============================================================
insert into public.subjects (id, name, icon, color, is_system, sort_order) values
  ('00000000-0000-0000-0000-000000000001', '语文', '📖', '#E74C3C', true, 1),
  ('00000000-0000-0000-0000-000000000002', '数学', '📐', '#3498DB', true, 2),
  ('00000000-0000-0000-0000-000000000003', '英语', '🔤', '#2ECC71', true, 3),
  ('00000000-0000-0000-0000-000000000004', '物理', '⚡', '#9B59B6', true, 4),
  ('00000000-0000-0000-0000-000000000005', '化学', '🧪', '#F39C12', true, 5),
  ('00000000-0000-0000-0000-000000000006', '生物', '🧬', '#1ABC9C', true, 6),
  ('00000000-0000-0000-0000-000000000007', '历史', '🏛️', '#E67E22', true, 7),
  ('00000000-0000-0000-0000-000000000008', '地理', '🌍', '#16A085', true, 8),
  ('00000000-0000-0000-0000-000000000009', '政治', '⚖️', '#C0392B', true, 9),
  ('00000000-0000-0000-0000-00000000000a', '中外历史', '📜', '#8E44AD', true, 10),
  ('00000000-0000-0000-0000-00000000000b', 'AI', '🤖', '#3498DB', true, 11)
on conflict (id) do nothing;
