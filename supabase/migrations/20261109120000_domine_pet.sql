-- 도미네 공동 반려견 "도미" (게임). Supabase SQL Editor에서 한 번 실행하세요.
--
-- 규칙(가장 보편적인 다마고치식 기준)
--   배부름 시간당 -4, 기분 시간당 -3 (0~100, 방치해도 죽지 않음)
--   밥주기  +배부름 30, 기분 +5   / 쉬는 시간 3시간  / 배부름 90 이상이면 거절
--   쓰다듬기 +기분 15            / 쉬는 시간 30분   / 기분 95 이상이면 거절
--   산책    +기분 25, 배부름 -10  / 쉬는 시간 6시간
--   돌봄 누적 30 미만 아기, 100 미만 어린, 그 이상 다 큰 강아지
-- 테이블은 직접 읽고 쓸 수 없고(정책 없음), 아래 함수로만 접근합니다.

create table if not exists public.domine_pet (
  id int primary key default 1 check (id = 1),
  name text not null default '도미',
  fullness int not null default 70 check (fullness between 0 and 100),
  mood int not null default 70 check (mood between 0 and 100),
  care_total int not null default 0,
  updated_at timestamptz not null default now()
);

insert into public.domine_pet (id) values (1) on conflict (id) do nothing;

create table if not exists public.domine_pet_log (
  id bigserial primary key,
  nickname text not null,
  action text not null check (action in ('feed', 'pet', 'walk')),
  created_at timestamptz not null default now()
);

create index if not exists domine_pet_log_nick_action_idx
  on public.domine_pet_log (nickname, action, created_at desc);
create index if not exists domine_pet_log_created_idx
  on public.domine_pet_log (created_at desc);

alter table public.domine_pet enable row level security;
alter table public.domine_pet_log enable row level security;

-- 현재 상태 + 오늘의 돌봄 순위 + 최근 기록 + (닉네임을 주면) 행동별 남은 쉬는 시간(초)
create or replace function public.domine_pet_state(p_nickname text default '')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.domine_pet;
  hrs numeric;
  f int;
  m int;
  nick text := left(coalesce(p_nickname, ''), 8);
begin
  select * into p from public.domine_pet where id = 1;
  hrs := extract(epoch from (now() - p.updated_at)) / 3600.0;
  f := greatest(0, p.fullness - floor(hrs * 4)::int);
  m := greatest(0, p.mood - floor(hrs * 3)::int);

  return jsonb_build_object(
    'name', p.name,
    'fullness', f,
    'mood', m,
    'care_total', p.care_total,
    'today_top', coalesce((
      select jsonb_agg(t) from (
        select nickname, count(*)::int as count
        from public.domine_pet_log
        where (created_at at time zone 'Asia/Seoul')::date = (now() at time zone 'Asia/Seoul')::date
        group by nickname
        order by count(*) desc, nickname
        limit 5
      ) t
    ), '[]'::jsonb),
    'recent', coalesce((
      select jsonb_agg(r) from (
        select nickname, action, created_at
        from public.domine_pet_log
        order by created_at desc
        limit 5
      ) r
    ), '[]'::jsonb),
    'cooldown', jsonb_build_object(
      'feed', public.domine_pet_cooldown(nick, 'feed', 10800),
      'pet', public.domine_pet_cooldown(nick, 'pet', 1800),
      'walk', public.domine_pet_cooldown(nick, 'walk', 21600)
    )
  );
end;
$$;

create or replace function public.domine_pet_cooldown(p_nick text, p_action text, p_secs int)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(greatest(0, ceil(p_secs - extract(epoch from (now() - max(created_at))))::int), 0)
  from public.domine_pet_log
  where nickname = p_nick and action = p_action and p_nick <> '';
$$;

-- 돌보기. 규칙 위반이면 ok=false 와 메시지를 돌려줍니다.
create or replace function public.domine_pet_care(p_nickname text, p_action text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.domine_pet;
  hrs numeric;
  f int;
  m int;
  nick text := btrim(coalesce(p_nickname, ''));
  cd int;
  cd_secs int;
begin
  if nick !~ '^[가-힣a-zA-Z0-9]{1,8}$' then
    return jsonb_build_object('ok', false, 'message', '별명은 한글·영문·숫자 1~8자로 입력해 주세요.');
  end if;
  if p_action not in ('feed', 'pet', 'walk') then
    return jsonb_build_object('ok', false, 'message', '알 수 없는 행동이에요.');
  end if;

  -- 도배 방지: 전체에서 1분에 20번까지
  if (select count(*) from public.domine_pet_log where created_at > now() - interval '1 minute') >= 20 then
    return jsonb_build_object('ok', false, 'message', '지금은 사람이 많아요. 잠시 후 다시 해 주세요.');
  end if;

  cd_secs := case p_action when 'feed' then 10800 when 'pet' then 1800 else 21600 end;
  cd := public.domine_pet_cooldown(nick, p_action, cd_secs);
  if cd > 0 then
    return jsonb_build_object('ok', false, 'message', '아직 쉬는 중이에요.', 'wait', cd);
  end if;

  select * into p from public.domine_pet where id = 1 for update;
  hrs := extract(epoch from (now() - p.updated_at)) / 3600.0;
  f := greatest(0, p.fullness - floor(hrs * 4)::int);
  m := greatest(0, p.mood - floor(hrs * 3)::int);

  if p_action = 'feed' then
    if f >= 90 then
      return jsonb_build_object('ok', false, 'message', '도미는 배가 불러요.');
    end if;
    f := least(100, f + 30);
    m := least(100, m + 5);
  elsif p_action = 'pet' then
    if m >= 95 then
      return jsonb_build_object('ok', false, 'message', '도미는 이미 기분이 최고예요.');
    end if;
    m := least(100, m + 15);
  else
    m := least(100, m + 25);
    f := greatest(0, f - 10);
  end if;

  update public.domine_pet
     set fullness = f, mood = m, care_total = care_total + 1, updated_at = now()
   where id = 1;
  insert into public.domine_pet_log (nickname, action) values (nick, p_action);

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.domine_pet_state(text) to anon, authenticated;
grant execute on function public.domine_pet_care(text, text) to anon, authenticated;
revoke execute on function public.domine_pet_cooldown(text, text, int) from public, anon, authenticated;
