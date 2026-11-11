-- v3/v4 이후 사용자가 실행. 기존 RPC는 그대로 두고 강아지별 RPC만 추가한다.
begin;
alter table public.domine_pet drop constraint domine_pet_id_check;
alter table public.domine_pet add constraint domine_pet_id_check check (id in (1, 2));
insert into public.domine_pet (id, name) values (2, '미네') on conflict (id) do nothing;
alter table public.domine_pet_log add column pet_id int not null default 1
  references public.domine_pet(id);
create index domine_pet_log_pet_created_idx on public.domine_pet_log (pet_id, created_at desc);

create or replace function public.domine_pet_state_for(p_pet int, p_nickname text default '')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.domine_pet;
  hrs numeric;
  cd jsonb := '{}'::jsonb;
  a text;
begin
  if p_pet is null or p_pet not in (1, 2) then
    raise exception 'Unknown pet' using errcode = '22023';
  end if;
  select * into p from public.domine_pet where id = p_pet;
  hrs := extract(epoch from (now() - p.updated_at)) / 3600.0;

  foreach a in array array['feed', 'treat', 'pet', 'play', 'walk', 'brush', 'bath', 'train'] loop
    cd := cd || jsonb_build_object(a, 0);
  end loop;

  return jsonb_build_object(
    'name', p.name,
    'fullness', greatest(0, p.fullness - floor(hrs * 6)::int),
    'mood', greatest(0, p.mood - floor(hrs * 5)::int),
    'clean', greatest(0, p.clean - floor(hrs * 3)::int),
    'care_total', p.care_total,
    'today_top', coalesce((
      select jsonb_agg(t) from (
        select nickname, count(*)::int as count
        from public.domine_pet_log
        where pet_id = p_pet and (created_at at time zone 'Asia/Seoul')::date = (now() at time zone 'Asia/Seoul')::date
        group by nickname
        order by count(*) desc, nickname
        limit 5
      ) t
    ), '[]'::jsonb),
    'recent', coalesce((
      select jsonb_agg(r) from (
        select nickname, action, created_at
        from public.domine_pet_log
        where pet_id = p_pet
        order by created_at desc
        limit 5
      ) r
    ), '[]'::jsonb),
    'cooldown', cd
  );
end;
$$;

create or replace function public.domine_pet_care_for(p_pet int, p_nickname text, p_action text)
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
begin
  if p_pet is null or p_pet not in (1, 2) then
    raise exception 'Unknown pet' using errcode = '22023';
  end if;
  if nick !~ '^[가-힣a-zA-Z0-9]{1,8}$' then
    return jsonb_build_object('ok', false, 'message', '별명은 한글·영문·숫자 1~8자로 입력해 주세요.');
  end if;
  if p_action is null or p_action not in ('feed', 'treat', 'pet', 'play', 'walk', 'brush', 'bath', 'train') then
    return jsonb_build_object('ok', false, 'message', '알 수 없는 행동이에요.');
  end if;

  perform pg_advisory_xact_lock(20261111, 120000);

  -- 도배 방지: 전체에서 1분에 20번까지
  if (select count(*) from public.domine_pet_log where created_at > now() - interval '1 minute') >= 20 then
    return jsonb_build_object('ok', false, 'message', '지금은 사람이 많아요. 잠시 후 다시 해 주세요.');
  end if;

  select * into p from public.domine_pet where id = p_pet for update;
  hrs := extract(epoch from (now() - p.updated_at)) / 3600.0;
  f := greatest(0, p.fullness - floor(hrs * 6)::int);
  m := greatest(0, p.mood - floor(hrs * 5)::int);
  c := greatest(0, p.clean - floor(hrs * 3)::int);

  if p_action = 'feed' then
    if f >= 90 then return jsonb_build_object('ok', false, 'message', p.name || '는 배가 불러요.'); end if;
    f := least(100, f + 30); m := least(100, m + 5);
  elsif p_action = 'treat' then
    if m >= 95 then return jsonb_build_object('ok', false, 'message', p.name || '는 이미 기분이 최고예요.'); end if;
    f := least(100, f + 10); m := least(100, m + 15);
  elsif p_action = 'pet' then
    if m >= 95 then return jsonb_build_object('ok', false, 'message', p.name || '는 이미 기분이 최고예요.'); end if;
    m := least(100, m + 15);
  elsif p_action = 'play' then
    if m >= 95 then return jsonb_build_object('ok', false, 'message', p.name || '는 이미 기분이 최고예요.'); end if;
    m := least(100, m + 20); f := greatest(0, f - 5); c := greatest(0, c - 5);
  elsif p_action = 'walk' then
    m := least(100, m + 25); f := greatest(0, f - 10); c := greatest(0, c - 10);
  elsif p_action = 'brush' then
    if c >= 90 then return jsonb_build_object('ok', false, 'message', p.name || '는 이미 반짝반짝해요.'); end if;
    m := least(100, m + 10); c := least(100, c + 15);
  elsif p_action = 'train' then
    if m >= 95 then return jsonb_build_object('ok', false, 'message', p.name || '는 이미 기분이 최고예요.'); end if;
    m := least(100, m + 15); f := greatest(0, f - 5);
  else
    if c >= 80 then return jsonb_build_object('ok', false, 'message', p.name || '는 이미 깨끗해요.'); end if;
    c := least(100, c + 40); m := least(100, m + 5);
  end if;

  update public.domine_pet
     set fullness = f, mood = m, clean = c, care_total = care_total + 1, updated_at = now()
   where id = p_pet;
  insert into public.domine_pet_log (pet_id, nickname, action) values (p_pet, nick, p_action);

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.domine_pet_state_for(int, text) from public;
revoke all on function public.domine_pet_care_for(int, text, text) from public;
grant execute on function public.domine_pet_state_for(int, text) to anon, authenticated;
grant execute on function public.domine_pet_care_for(int, text, text) to anon, authenticated;
notify pgrst, 'reload schema';
commit;
