-- 도미 2차: 청결 수치 + 행동 7가지(밥·간식·쓰다듬기·공놀이·산책·빗질·목욕). Supabase SQL Editor에서 한 번 실행하세요.
-- (1차 20261109120000_domine_pet.sql 을 먼저 실행한 상태여야 합니다. 기존 기록은 그대로 유지됩니다.)
--
--   수치(0~100)  배부름 시간당 -4 / 기분 -3 / 청결 -2  (방치해도 죽지 않음)
--   행동         효과                              쉬는 시간   거절 조건
--   feed 밥주기   배부름 +30, 기분 +5                3시간       배부름 90 이상
--   treat 간식    배부름 +10, 기분 +15               1시간       기분 95 이상
--   pet 쓰다듬기  기분 +15                          30분        기분 95 이상
--   play 공놀이   기분 +20, 배부름 -5, 청결 -5       2시간       기분 95 이상
--   walk 산책     기분 +25, 배부름 -10, 청결 -10     6시간       -
--   brush 빗질    기분 +10, 청결 +15                 3시간       청결 90 이상
--   bath 목욕     청결 +40, 기분 +5                  12시간      청결 80 이상

alter table public.domine_pet add column if not exists clean int not null default 80
  check (clean between 0 and 100);

alter table public.domine_pet_log drop constraint if exists domine_pet_log_action_check;
alter table public.domine_pet_log add constraint domine_pet_log_action_check
  check (action in ('feed', 'treat', 'pet', 'play', 'walk', 'brush', 'bath'));

create or replace function public.domine_pet_cd_secs(p_action text)
returns int
language sql
immutable
as $$
  select case p_action
    when 'feed' then 10800
    when 'treat' then 3600
    when 'pet' then 1800
    when 'play' then 7200
    when 'walk' then 21600
    when 'brush' then 10800
    when 'bath' then 43200
    else 0
  end;
$$;

create or replace function public.domine_pet_state(p_nickname text default '')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.domine_pet;
  hrs numeric;
  nick text := left(coalesce(p_nickname, ''), 8);
  cd jsonb := '{}'::jsonb;
  a text;
begin
  select * into p from public.domine_pet where id = 1;
  hrs := extract(epoch from (now() - p.updated_at)) / 3600.0;

  foreach a in array array['feed', 'treat', 'pet', 'play', 'walk', 'brush', 'bath'] loop
    cd := cd || jsonb_build_object(a, public.domine_pet_cooldown(nick, a, public.domine_pet_cd_secs(a)));
  end loop;

  return jsonb_build_object(
    'name', p.name,
    'fullness', greatest(0, p.fullness - floor(hrs * 4)::int),
    'mood', greatest(0, p.mood - floor(hrs * 3)::int),
    'clean', greatest(0, p.clean - floor(hrs * 2)::int),
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
    'cooldown', cd
  );
end;
$$;

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
  c int;
  nick text := btrim(coalesce(p_nickname, ''));
  cd int;
begin
  if nick !~ '^[가-힣a-zA-Z0-9]{1,8}$' then
    return jsonb_build_object('ok', false, 'message', '별명은 한글·영문·숫자 1~8자로 입력해 주세요.');
  end if;
  if p_action not in ('feed', 'treat', 'pet', 'play', 'walk', 'brush', 'bath') then
    return jsonb_build_object('ok', false, 'message', '알 수 없는 행동이에요.');
  end if;

  -- 도배 방지: 전체에서 1분에 20번까지
  if (select count(*) from public.domine_pet_log where created_at > now() - interval '1 minute') >= 20 then
    return jsonb_build_object('ok', false, 'message', '지금은 사람이 많아요. 잠시 후 다시 해 주세요.');
  end if;

  cd := public.domine_pet_cooldown(nick, p_action, public.domine_pet_cd_secs(p_action));
  if cd > 0 then
    return jsonb_build_object('ok', false, 'message', '아직 쉬는 중이에요.', 'wait', cd);
  end if;

  select * into p from public.domine_pet where id = 1 for update;
  hrs := extract(epoch from (now() - p.updated_at)) / 3600.0;
  f := greatest(0, p.fullness - floor(hrs * 4)::int);
  m := greatest(0, p.mood - floor(hrs * 3)::int);
  c := greatest(0, p.clean - floor(hrs * 2)::int);

  if p_action = 'feed' then
    if f >= 90 then return jsonb_build_object('ok', false, 'message', '도미는 배가 불러요.'); end if;
    f := least(100, f + 30); m := least(100, m + 5);
  elsif p_action = 'treat' then
    if m >= 95 then return jsonb_build_object('ok', false, 'message', '도미는 이미 기분이 최고예요.'); end if;
    f := least(100, f + 10); m := least(100, m + 15);
  elsif p_action = 'pet' then
    if m >= 95 then return jsonb_build_object('ok', false, 'message', '도미는 이미 기분이 최고예요.'); end if;
    m := least(100, m + 15);
  elsif p_action = 'play' then
    if m >= 95 then return jsonb_build_object('ok', false, 'message', '도미는 이미 기분이 최고예요.'); end if;
    m := least(100, m + 20); f := greatest(0, f - 5); c := greatest(0, c - 5);
  elsif p_action = 'walk' then
    m := least(100, m + 25); f := greatest(0, f - 10); c := greatest(0, c - 10);
  elsif p_action = 'brush' then
    if c >= 90 then return jsonb_build_object('ok', false, 'message', '도미는 이미 반짝반짝해요.'); end if;
    m := least(100, m + 10); c := least(100, c + 15);
  else
    if c >= 80 then return jsonb_build_object('ok', false, 'message', '도미는 이미 깨끗해요.'); end if;
    c := least(100, c + 40); m := least(100, m + 5);
  end if;

  update public.domine_pet
     set fullness = f, mood = m, clean = c, care_total = care_total + 1, updated_at = now()
   where id = 1;
  insert into public.domine_pet_log (nickname, action) values (nick, p_action);

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.domine_pet_state(text) to anon, authenticated;
grant execute on function public.domine_pet_care(text, text) to anon, authenticated;
revoke execute on function public.domine_pet_cd_secs(text) from public, anon, authenticated;
