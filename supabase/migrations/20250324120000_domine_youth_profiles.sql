-- 청년회 멤버 편집 내용 (전원 공유). Supabase SQL Editor에서 한 번 실행하거나 마이그레이션으로 적용하세요.

create table if not exists public.domine_youth_profiles (
  legal_name text primary key,
  birthday text not null default '',
  feast_day text not null default '',
  notes text not null default '',
  talents text not null default '',
  image_src text,
  updated_at timestamptz not null default now()
);

create index if not exists domine_youth_profiles_updated_at_idx
  on public.domine_youth_profiles (updated_at desc);

alter table public.domine_youth_profiles enable row level security;

-- 기존 정책이 있으면 이름 충돌 시 수동으로 조정하세요.
drop policy if exists "domine_youth_profiles_select" on public.domine_youth_profiles;
drop policy if exists "domine_youth_profiles_insert" on public.domine_youth_profiles;
drop policy if exists "domine_youth_profiles_update" on public.domine_youth_profiles;

create policy "domine_youth_profiles_select"
  on public.domine_youth_profiles for select
  using (true);

create policy "domine_youth_profiles_insert"
  on public.domine_youth_profiles for insert
  with check (true);

create policy "domine_youth_profiles_update"
  on public.domine_youth_profiles for update
  using (true);
