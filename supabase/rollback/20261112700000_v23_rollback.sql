begin;
set local lock_timeout = '10s';
set local statement_timeout = '120s';

create or replace function domine_pet_v22.level_profile() returns jsonb
language plpgsql set search_path='' as $$
declare
  v_day date:=(pg_catalog.now() at time zone 'Asia/Seoul')::date;
  v_profile domine_pet_v22.spawn_profile; v_levels int[]; v_players int;
begin
  select s.* into v_profile from domine_pet_v22.spawn_profile s where s.day=v_day;
  if not found then
    select pg_catalog.array_agg(domine_pet_v17.level_for_xp(p.xp)) into v_levels
      from domine_pet_v17.pet_progress p where exists(select 1 from domine_pet_v17.battle_ticket t
        where t.started_at>=pg_catalog.now()-interval '14 days');
    select pg_catalog.count(distinct t.player_id)::int into v_players from domine_pet_v17.battle_ticket t
      where t.started_at>=pg_catalog.now()-interval '14 days';
    if coalesce(pg_catalog.cardinality(v_levels),0)<3 then
      select pg_catalog.array_agg(domine_pet_v17.level_for_xp(p.xp)) into v_levels
        from domine_pet_v17.pet_progress p where p.xp>0;
      select pg_catalog.count(*)::int into v_players from domine_pet_v6.player p
        where p.id<>'a1b2c3d4-0000-4000-8000-000000000001'::uuid;
    end if;
    if coalesce(pg_catalog.cardinality(v_levels),0)=0 then v_levels:=array[1,2,3,4,5]; v_players:=0;
    else
      select array[greatest(1,pg_catalog.min(s.level)-2),
        pg_catalog.round((pg_catalog.percentile_cont(.25) within group(order by s.level))::numeric)::int,
        pg_catalog.round((pg_catalog.percentile_cont(.50) within group(order by s.level))::numeric)::int,
        pg_catalog.round((pg_catalog.percentile_cont(.75) within group(order by s.level))::numeric)::int,
        least(999,pg_catalog.max(s.level)+2)] into v_levels from pg_catalog.unnest(v_levels) s(level);
    end if;
    insert into domine_pet_v22.spawn_profile(day,levels,players) values(v_day,v_levels,v_players) on conflict do nothing;
    select s.* into strict v_profile from domine_pet_v22.spawn_profile s where s.day=v_day;
  end if;
  return pg_catalog.jsonb_build_object('day',v_profile.day,'levels',v_profile.levels,'players',v_profile.players);
end $$;

create or replace function domine_pet_v17.pet_state(p_pet int) returns jsonb
language sql stable set search_path='' as $$
  select pg_catalog.jsonb_build_object('pet',p.pet_id,'xp',p.xp,'level',domine_pet_v17.level_for_xp(p.xp),
    'allocation',p.allocation,'unspent',3*(domine_pet_v17.level_for_xp(p.xp)-1)
      -(select pg_catalog.sum(e.value::int) from pg_catalog.jsonb_each_text(p.allocation) e),
    'allocationMode',p.allocation_mode,'job',p.job,'jobTier',p.job_tier,'jobChangedAt',p.job_changed_at,
    'moves',p.moves,'version',p.version,'streak',p.streak,
    'mastery',coalesce((select pg_catalog.jsonb_object_agg(m.move_id,m.uses) from domine_pet_v17.mastery m where m.pet_id=p.pet_id),'{}'::jsonb),
    'inventory',coalesce((select pg_catalog.jsonb_object_agg(i.item_id,i.quantity) from domine_pet_v17.inventory i where i.pet_id=p.pet_id),'{}'::jsonb))
  from domine_pet_v17.pet_progress p where p.pet_id=p_pet;
$$;

create or replace function domine_pet_v17.state(p_player uuid) returns jsonb
language sql volatile set search_path='' as $$
  select domine_pet_v17.spawns()||pg_catalog.jsonb_build_object('resetEpoch',c.reset_epoch,'coins',w.coins,'version',w.version,'features',c.features,
    'pets',(select pg_catalog.jsonb_agg(domine_pet_v17.pet_state(p.pet_id) order by p.pet_id) from domine_pet_v17.pet_progress p),
    'watching',domine_pet_v17.watching(),
    'prices',coalesce((select pg_catalog.jsonb_object_agg(i.item_id,i.price) from domine_pet_v17.item_price i where i.enabled),'{}'::jsonb),
    'encyclopedia',coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('individualId',e.individual_id,'name',e.name,
      'encounters',e.encounters,'wins',e.wins,'losses',e.losses,'weaknesses',e.weaknesses,'resistances',e.resistances)
      order by e.individual_id) from domine_pet_v17.encounter_record e),'[]'::jsonb),
    'certifications',coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('pet',a.pet_id,'kind',a.kind,'target',a.target,'at',a.at)
      order by a.pet_id,a.kind,a.target) from domine_pet_v17.certification a),'[]'::jsonb),
    'raids',coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('region',r.region,'week',r.week,
      'target',r.target,'progress',r.progress,'completed',r.completed_at is not null) order by r.region) from domine_pet_v17.raid_cycle r
      where r.week=pg_catalog.date_trunc('week',pg_catalog.now() at time zone 'Asia/Seoul')::date),'[]'::jsonb),
    'tickets',coalesce((select pg_catalog.jsonb_agg(domine_pet_v17.ticket_json(t)||pg_catalog.jsonb_build_object('status',t.status,'result',t.result)
      order by t.started_at,t.id) from domine_pet_v17.battle_ticket t where t.player_id=p_player
      and (t.status='active' or t.started_at>pg_catalog.now()-interval '24 hours')),'[]'::jsonb))
  from domine_pet_v7.pool w cross join domine_pet_v17.config c where w.id=1 and c.id=1;
$$;

create or replace function domine_pet_v17.spawns() returns jsonb
language sql volatile set search_path='' as $$
  select pg_catalog.jsonb_build_object('levelProfile',domine_pet_v22.level_profile(),'slot',pg_catalog.floor(extract(epoch from pg_catalog.now())/1800)::bigint,
    'departed',coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('slot',d.slot,'cell',d.cell,'individualId',d.individual_id)
      order by d.cell,d.individual_id) from domine_pet_v17.departed d
      where d.slot=pg_catalog.floor(extract(epoch from pg_catalog.now())/1800)::bigint),'[]'::jsonb));
$$;

create or replace function domine_pet_v17.watching() returns jsonb
language sql stable set search_path='' as $$
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('ticket',t.id,'nickname',t.nickname,'pet',t.pet_id,
    'opponentName',t.opponent_name,'cell',t.cell,'startedAt',t.started_at) order by t.started_at,t.id),'[]'::jsonb)
  from domine_pet_v17.battle_ticket t where t.status='active' and t.started_at>pg_catalog.now()-interval '3 minutes';
$$;

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

  foreach a in array array['feed', 'treat', 'pet', 'play', 'walk', 'brush', 'bath', 'train'] loop
    cd := cd || jsonb_build_object(a, public.domine_pet_cooldown(nick, a, public.domine_pet_cd_secs(a)));
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

create or replace function domine_pet_v6.snapshot_v6(p_player uuid,p_pet int) returns jsonb
language sql stable set search_path='' as $$
  select domine_pet_v6.result_v6('OK') || jsonb_build_object(
    'busy',(select jsonb_build_object('nickname',b.nickname,'action',b.action,'remainingMs',ceil(extract(epoch from b.until-now())*1000)::int) from domine_pet_v16.busy b where b.pet_id=p_pet and b.until>now()),
    'version',g.version,'pet',p_pet,'coins',g.coins,
    'levels',(select jsonb_object_agg(pet_id,domine_pet_v6.level_v6(xp)) from domine_pet_v10.pet_xp),
    'player',jsonb_build_object('xp',x.xp,'coins',g.coins,'level',domine_pet_v6.level_v6(x.xp)),
    'inventory',coalesce((select jsonb_agg(item_id order by item_id) from domine_pet_v10.inventory where pet_id=p_pet),'[]'::jsonb),
    'equipment',coalesce((select jsonb_agg(jsonb_build_object('pet_id',pet_id,'slot',slot,'item_id',item_id)) from domine_pet_v7.equipment),'[]'::jsonb),
    'album',coalesce((select jsonb_agg(entry_id order by entry_id) from (select entry_id from domine_pet_v6.album where player_id='a1b2c3d4-0000-4000-8000-000000000001'::uuid union select item_id from domine_pet_v10.inventory where item_id between '061' and '080') entries),'[]'::jsonb),
    'badges',coalesce((select jsonb_agg(achievement_id order by achievement_id) from domine_pet_v6.achievement where player_id=p.id),'[]'::jsonb),
    'daily',coalesce((select jsonb_build_object('reward_actions',reward_actions,'explore_finishes',explore_finishes,'walk_claims',walk_claims) from domine_pet_v7.daily where player_id=p.id and kst_date=(now() at time zone 'Asia/Seoul')::date),'{"reward_actions":0,"explore_finishes":0,"walk_claims":0}'::jsonb),
    'ticket',(select jsonb_build_object('id',id,'map_id',map_id,'eligible_at',eligible_at,'expires_at',expires_at) from domine_pet_v6.exploration where player_id=p.id and finished_at is null and cancelled_at is null and expires_at>now()),
    'season',domine_pet_v6.season_for_date_v6((now() at time zone 'Asia/Seoul')::date),
    'shared',case when p_pet in (1,2) then jsonb_build_object('applied',false,'reason',null,'pet',public.domine_pet_state_for(p_pet,p.nickname)) else null end
  ) from domine_pet_v6.player p cross join domine_pet_v7.pool g join domine_pet_v10.pet_xp x on x.pet_id=p_pet where p.id=p_player and g.id=1;
$$;

create or replace function domine_pet_v6.badges_v6(p_player uuid) returns jsonb
language plpgsql set search_path='' as $$
declare v_flags boolean[]; v_core_count int; v_fresh jsonb;
begin
  select pg_catalog.count(*) into v_core_count from domine_pet_v6.catalog c where c.core and
    case when c.id between '061' and '080'
      then exists(select 1 from domine_pet_v10.inventory i where i.item_id=c.id)
      else exists(select 1 from domine_pet_v6.album a where a.player_id='a1b2c3d4-0000-4000-8000-000000000001'::uuid and a.entry_id=c.id) end;
  v_flags:=array[
    domine_pet_v6.count_v6(p_player,'action_total')>=1, domine_pet_v6.count_v6(p_player,'action_total')>=10,
    domine_pet_v6.count_v6(p_player,'action_total')>=50, domine_pet_v6.count_v6(p_player,'action_total')>=200,
    domine_pet_v6.count_v6(p_player,'pet:1')>=10, domine_pet_v6.count_v6(p_player,'pet:2')>=10,
    least(domine_pet_v6.count_v6(p_player,'pet:1'),domine_pet_v6.count_v6(p_player,'pet:2'))>=20,
    domine_pet_v6.count_v6(p_player,'action:feed')>=10, domine_pet_v6.count_v6(p_player,'action:treat')>=10,
    domine_pet_v6.count_v6(p_player,'action:pet')>=20, domine_pet_v6.count_v6(p_player,'action:brush')>=10,
    domine_pet_v6.count_v6(p_player,'action:bath')>=5, domine_pet_v6.count_v6(p_player,'action:play')>=10,
    domine_pet_v6.count_v6(p_player,'action:train')>=10, domine_pet_v6.count_v6(p_player,'action:walk')>=10,
    (select pg_catalog.count(*)=8 from domine_pet_v6.counter where player_id=p_player and metric like 'action:%' and value>=1),
    (select pg_catalog.count(*)>=5 from domine_pet_v6.counter where player_id=p_player and metric like 'explore_map:%' and value>=1),
    domine_pet_v6.count_v6(p_player,'explore_total')>=10, domine_pet_v6.count_v6(p_player,'explore_total')>=50,
    domine_pet_v6.count_v6(p_player,'explore_map:church')>=10, domine_pet_v6.count_v6(p_player,'explore_map:street')>=10,
    least(domine_pet_v6.count_v6(p_player,'explore_map:field'),domine_pet_v6.count_v6(p_player,'explore_map:park'),domine_pet_v6.count_v6(p_player,'explore_map:home'))>=5,
    domine_pet_v6.count_v6(p_player,'explore_time:night')>=5,
    v_core_count>=10,v_core_count>=30,v_core_count>=60,exists(select 1 from domine_pet_v10.inventory where item_id between '061' and '080'),
    (select pg_catalog.count(*)>=3 from domine_pet_v6.counter where player_id=p_player and metric like 'equipped_item:%' and value>=1),
    (select pg_catalog.count(distinct i.item_id)>=3 from domine_pet_v10.inventory i join domine_pet_v6.catalog c on c.id=i.item_id where c.slot='toy'),
    exists(select 1 from domine_pet_v17.pet_progress where domine_pet_v17.level_for_xp(xp)>=30)
  ];
  with added as (
    insert into domine_pet_v6.achievement(player_id,achievement_id)
    select p_player,'A'||pg_catalog.lpad(g::text,2,'0') from pg_catalog.generate_series(1,30) g where v_flags[g]
    on conflict do nothing returning achievement_id
  ) select coalesce(pg_catalog.jsonb_agg(achievement_id),'[]'::jsonb) into v_fresh from added;
  return v_fresh;
end $$;

create or replace function public.domine_pet_register_v6(p_nickname text,p_secret text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare p domine_pet_v6.player; nick text:=normalize(btrim(p_nickname),NFC);
begin
  if not domine_pet_v6.valid_identity_v6(p_nickname,p_secret) then return domine_pet_v6.result_v6('INVALID_INPUT'); end if;
  perform pg_catalog.pg_advisory_xact_lock(20261111,120006);
  select * into p from domine_pet_v6.player where nickname_key=lower(nick) for update;
  if found then
    if p.secret_hash<>extensions.digest(p_secret,'sha256') then return domine_pet_v6.result_v6('NICKNAME_TAKEN'); end if;
    return domine_pet_v6.snapshot_v6(p.id,1);
  end if;
  if not domine_pet_v6.rate_v6('register:hour',date_trunc('hour',now()),60)
     or not domine_pet_v6.rate_v6('register:day',date_trunc('day',now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul',300) then
    return domine_pet_v6.result_v6('RATE_LIMITED');
  end if;
  insert into domine_pet_v6.player(nickname,nickname_key,secret_hash) values(nick,lower(nick),extensions.digest(p_secret,'sha256')) returning * into p;
  return domine_pet_v6.snapshot_v6(p.id,1);
end $$;

create or replace function public.domine_pet_state_v6(p_nickname text,p_secret text,p_pet int) returns jsonb
language plpgsql security definer set search_path='' as $$
declare p domine_pet_v6.player;
begin
  if not domine_pet_v6.valid_identity_v6(p_nickname,p_secret) or p_pet is null or p_pet not in (1,2) then return domine_pet_v6.result_v6('INVALID_INPUT'); end if;
  select * into p from domine_pet_v6.player where nickname_key=lower(normalize(btrim(p_nickname),NFC)) for update;
  if not found or p.secret_hash<>extensions.digest(p_secret,'sha256') then return domine_pet_v6.result_v6('AUTH_FAILED'); end if;
  if not domine_pet_v6.rate_v6('state:'||p.id,date_trunc('minute',now()),12) then return domine_pet_v6.result_v6('RATE_LIMITED'); end if;
  return domine_pet_v6.snapshot_v6(p.id,p_pet);
end $$;

create or replace function public.domine_pet_operation_v6(p_nickname text,p_secret text,p_request_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare p domine_pet_v6.player; op domine_pet_v6.operation;
begin
  if not domine_pet_v6.valid_identity_v6(p_nickname,p_secret) or p_request_id is null then return domine_pet_v6.result_v6('INVALID_INPUT'); end if;
  select * into p from domine_pet_v6.player where nickname_key=lower(normalize(btrim(p_nickname),NFC)) for update;
  if not found or p.secret_hash<>extensions.digest(p_secret,'sha256') then return domine_pet_v6.result_v6('AUTH_FAILED'); end if;
  perform 1 from domine_pet_v7.pool where id=1 for update;
  if not domine_pet_v6.rate_v6('query:'||p.id,date_trunc('minute',now()),12) then return domine_pet_v6.result_v6('RATE_LIMITED'); end if;
  select * into op from domine_pet_v6.operation where player_id=p.id and request_id=p_request_id;
  if not found then return domine_pet_v6.result_v6('NOT_FOUND'); end if;
  if op.result->>'code'='BUSY' then return op.result; end if;
  if op.created_at<now()-interval '30 days' or not op.result ? 'levels' or (op.result->>'version')::bigint<=p.version then return domine_pet_v6.snapshot_v6(p.id,coalesce((op.result->>'pet')::int,1))||domine_pet_v6.result_v6('ALREADY_APPLIED')||jsonb_build_object('requestId',p_request_id); end if;
  return op.result;
end $$;

create or replace function domine_pet_v17.expire_tickets() returns void
language plpgsql set search_path='' as $$
declare v_ticket domine_pet_v17.battle_ticket; v_item record;
begin
  for v_ticket in select t.* from domine_pet_v17.battle_ticket t
    where t.status='active' and t.expires_at<=pg_catalog.now() order by t.id for update
  loop
    for v_item in select e.key,e.value::int as quantity from pg_catalog.jsonb_each_text(v_ticket.reserved) e loop
      insert into domine_pet_v17.inventory as i(pet_id,item_id,quantity) values(v_ticket.pet_id,v_item.key,v_item.quantity)
        on conflict(pet_id,item_id) do update set quantity=i.quantity+excluded.quantity;
    end loop;
    update domine_pet_v17.battle_ticket set status='expired' where id=v_ticket.id;
    update domine_pet_v17.pet_progress set version=version+1 where pet_id=v_ticket.pet_id;
  end loop;
  -- Keep one previous interval while its already-started tickets can still settle.
  delete from domine_pet_v17.departed where slot<pg_catalog.floor(extract(epoch from pg_catalog.now())/1800)::bigint-1;
end $$;

create or replace function domine_pet_v6.command_v6(p_nickname text,p_secret text,p_request_id uuid,p_kind text,p_input jsonb) returns jsonb
language plpgsql set search_path='' as $$
declare
  v_p domine_pet_v6.player; v_wallet domine_pet_v7.pool; v_op domine_pet_v6.operation; v_item domine_pet_v6.catalog;
  v_ticket domine_pet_v6.exploration; v_session domine_pet_v6.walk_session; v_day domine_pet_v7.daily;
  v_payload bytea; v_result jsonb; v_shared jsonb; v_extra jsonb:='{}'; v_code text:='OK';
  v_today date:=(pg_catalog.now() at time zone 'Asia/Seoul')::date; v_band text; v_season text;
  v_busy_row domine_pet_v16.busy; v_duration_ms int;
  v_pet int; v_pet_xp int; v_action text; v_map text; v_entry text; v_slot text;
  v_xp_gain int:=0; v_coin_gain int:=0; v_level_coins int:=0; v_old_level int; v_new_level int;
  v_new_entries jsonb:='[]'; v_new_badges jsonb:='[]'; v_existed boolean; v_can_find boolean; v_pity boolean;
  v_rarity text; v_roll float; v_skipped text; v_retry_seconds int; v_last_time timestamptz; v_new_id uuid;
begin
  if not domine_pet_v6.valid_identity_v6(p_nickname,p_secret) or p_request_id is null or p_input is null
     or p_kind is null or p_kind not in ('action','purchase','equip','explore_begin','explore_finish','record_season','walk_begin','walk_claim','walk_end') then
    return domine_pet_v6.result_v6('INVALID_INPUT');
  end if;
  if (p_input ? 'pet' and coalesce(p_input->>'pet','') not in ('1','2'))
     or (p_kind in ('action','equip') and not p_input ? 'pet') then
    return domine_pet_v6.result_v6('INVALID_INPUT');
  end if;
  v_pet:=coalesce((p_input->>'pet')::int,1);
  if p_kind='action' then perform pg_catalog.pg_advisory_xact_lock(20261111,120000); end if;
  select * into v_p from domine_pet_v6.player where nickname_key=pg_catalog.lower(pg_catalog.normalize(pg_catalog.btrim(p_nickname),'NFC')) for update;
  if not found or v_p.secret_hash<>extensions.digest(p_secret,'sha256') then return domine_pet_v6.result_v6('AUTH_FAILED'); end if;
  -- Serialize all economy, counters and history writes behind the shared wallet.
  select * into strict v_wallet from domine_pet_v7.pool where id=1 for update;
  v_payload:=extensions.digest(p_input::text,'sha256');
  select * into v_op from domine_pet_v6.operation where player_id=v_p.id and request_id=p_request_id;
  if found then
    if v_op.kind<>p_kind or v_op.payload_hash<>v_payload then return domine_pet_v6.result_v6('REQUEST_CONFLICT'); end if;
    if not domine_pet_v6.rate_v6('query:'||v_p.id,pg_catalog.date_trunc('minute',pg_catalog.now()),12) then return domine_pet_v6.result_v6('RATE_LIMITED'); end if;
    if v_op.result->>'code'='BUSY' then return v_op.result; end if;
    -- Frozen personal versions identify pre-pool cached results; do not replay their private balances.
    if v_op.created_at<pg_catalog.now()-interval '30 days' or not v_op.result ? 'levels' or (v_op.result->>'version')::bigint<=v_p.version then return domine_pet_v6.snapshot_v6(v_p.id,v_pet)||domine_pet_v6.result_v6('ALREADY_APPLIED')||pg_catalog.jsonb_build_object('requestId',p_request_id); end if;
    return v_op.result;
  end if;
  v_action:=p_input->>'action'; v_map:=p_input->>'map'; v_entry:=p_input->>'item'; v_slot:=p_input->>'slot';
  if (p_kind in ('action','equip') and (v_pet is null or v_pet not in (1,2)))
     or (p_kind='action' and (v_action is null or v_action not in ('feed','treat','pet','play','walk','brush','bath','train')))
     or (p_kind='purchase' and (v_entry is null or v_entry !~ '^0(6[1-9]|7[0-9]|80)$'))
     or (p_kind='equip' and (v_slot is null or v_slot not in ('wearable','toy') or (v_entry is not null and v_entry !~ '^0(6[1-9]|7[0-9]|80)$')))
     or (p_kind='explore_begin' and (v_map is null or v_map not in ('church','field','street','park','home','playground','stream','churchback','alley','market','station','mountain','lake','school','foodstreet','cafestreet','bakery','apartment','bikepath','overlook','garden','bridge','pilgrimpath','farm') or p_input->>'source' is null or p_input->>'source' not in ('map','walk')))
     or (p_kind='explore_finish' and p_input->>'ticket' is null)
     or (p_kind in ('walk_claim','walk_end') and p_input->>'session' is null)
     or (p_kind='record_season' and (p_input->>'entry' is null or p_input->>'entry' !~ '^0(8[1-9]|9[0-2])$')) then
    return domine_pet_v6.result_v6('INVALID_INPUT');
  end if;
  if p_kind='action' then
    if p_input->>'durationMs' is not null and p_input->>'durationMs' !~ '^-?[0-9]+$' then
      return domine_pet_v6.result_v6('INVALID_INPUT');
    end if;
    v_duration_ms:=least(20000,greatest(500,coalesce((p_input->>'durationMs')::numeric,6000)))::int;
    -- The shared wallet lock serializes the check and reservation, including the first insert.
    select * into v_busy_row from domine_pet_v16.busy where pet_id=v_pet;
    if found and v_busy_row.until>pg_catalog.now() then
      v_result:=domine_pet_v6.snapshot_v6(v_p.id,v_pet)||domine_pet_v6.result_v6('BUSY')||pg_catalog.jsonb_build_object('requestId',p_request_id);
      insert into domine_pet_v6.operation(player_id,request_id,kind,payload_hash,result) values(v_p.id,p_request_id,p_kind,v_payload,v_result);
      return v_result;
    end if;
  end if;
  if not domine_pet_v6.rate_v6('change:'||v_p.id,pg_catalog.date_trunc('minute',pg_catalog.now()),30)
     or not domine_pet_v6.rate_v6('change:global',pg_catalog.date_trunc('minute',pg_catalog.now()),300) then
    return domine_pet_v6.result_v6('RATE_LIMITED')||pg_catalog.jsonb_build_object('retryAfterSeconds',60);
  end if;
  if p_kind='action' then
    insert into domine_pet_v16.busy(pet_id,until,nickname,action) values(v_pet,pg_catalog.now()+v_duration_ms*interval '1 millisecond',v_p.nickname,v_action)
      on conflict(pet_id) do update set until=excluded.until,nickname=excluded.nickname,action=excluded.action;
  end if;
  insert into domine_pet_v7.daily(player_id,kst_date) values(v_p.id,v_today) on conflict do nothing;
  select * into v_day from domine_pet_v7.daily where player_id=v_p.id and kst_date=v_today;
  select xp into strict v_pet_xp from domine_pet_v10.pet_xp where pet_id=v_pet;
  v_old_level:=domine_pet_v6.level_v6(v_pet_xp);

  if p_kind='action' then
    -- Care and rewards run only after reserving this pet.
    v_shared:=public.domine_pet_care_for(v_pet,v_p.nickname,v_action);
    select last_reward_at into v_last_time from domine_pet_v6.action_clock where player_id=v_p.id and action='all';
    if v_day.reward_actions>=1000000 then v_skipped:='DAILY_CAP';
    elsif v_last_time>pg_catalog.now()-interval '0 seconds' then
      v_skipped:='TOO_FAST'; v_retry_seconds:=pg_catalog.ceil(extract(epoch from v_last_time+interval '0 seconds'-pg_catalog.now()));
    end if;
    if v_skipped is null then
      v_xp_gain:=0; v_coin_gain:=0;
      insert into domine_pet_v6.action_clock(player_id,action,last_reward_at,last_submit_at) values(v_p.id,v_action,pg_catalog.now(),pg_catalog.now()),(v_p.id,'all',pg_catalog.now(),pg_catalog.now())
        on conflict(player_id,action) do update set last_reward_at=excluded.last_reward_at,last_submit_at=excluded.last_submit_at;
      update domine_pet_v7.daily set reward_actions=reward_actions+1 where player_id=v_p.id and kst_date=v_today;
      perform domine_pet_v6.increment_v6(v_p.id,'action_total');
      perform domine_pet_v6.increment_v6(v_p.id,'action:'||v_action);
      perform domine_pet_v6.increment_v6(v_p.id,'pet:'||v_pet);
    end if;
    perform domine_pet_v10.log_v10(v_p.nickname,v_pet,'action',v_action);
    v_extra:=pg_catalog.jsonb_build_object('shared',pg_catalog.jsonb_build_object('applied',coalesce((v_shared->>'ok')::boolean,false),'reason',v_shared->>'message','pet',public.domine_pet_state_for(v_pet,v_p.nickname)));
  elsif p_kind='purchase' then
    select * into v_item from domine_pet_v6.catalog where id=v_entry and acquisition='shop';
    if not found then v_code:='INVALID_INPUT';
    elsif exists(select 1 from domine_pet_v10.inventory where pet_id=v_pet and item_id=v_entry) then v_code:='ALREADY_OWNED';
    elsif v_wallet.coins<v_item.price then v_code:='INSUFFICIENT_COINS';
    else
      update domine_pet_v7.pool set coins=coins-v_item.price where id=1;
      insert into domine_pet_v10.inventory(pet_id,item_id) values(v_pet,v_entry);
      perform domine_pet_v10.log_v10(v_p.nickname,v_pet,'purchase',v_entry);
      insert into domine_pet_v6.album(player_id,entry_id) values('a1b2c3d4-0000-4000-8000-000000000001'::uuid,v_entry) on conflict do nothing;
      if found then v_new_entries:=pg_catalog.jsonb_build_array(v_entry); end if;
      perform domine_pet_v6.increment_v6(v_p.id,'purchase_total');
    end if;
  elsif p_kind='equip' then
    if v_entry is not null and not exists(select 1 from domine_pet_v10.inventory i join domine_pet_v6.catalog c on c.id=i.item_id where i.pet_id=v_pet and i.item_id=v_entry and c.slot=v_slot) then v_code:='NOT_OWNED';
    else
      insert into domine_pet_v7.equipment(pet_id,slot,item_id) values(v_pet,v_slot,v_entry)
        on conflict(pet_id,slot) do update set item_id=excluded.item_id;
      perform domine_pet_v10.log_v10(v_p.nickname,v_pet,'equip',v_entry);
      if v_entry is not null and v_slot='wearable' then perform domine_pet_v6.increment_v6(v_p.id,'equipped_item:'||v_entry); end if;
    end if;
  elsif p_kind='explore_begin' then
    -- Reuse the original clock for a live ticket in the same theme.
    if not exists(select 1 from domine_pet_v6.exploration where player_id=v_p.id and map_id=v_map
      and finished_at is null and cancelled_at is null and expires_at>pg_catalog.now()) then
      update domine_pet_v6.exploration set cancelled_at=pg_catalog.now() where player_id=v_p.id and finished_at is null and cancelled_at is null;
      select pg_catalog.max(started_at) into v_last_time from domine_pet_v6.exploration where player_id=v_p.id;
      if v_day.explore_starts>=60 or v_last_time>pg_catalog.now()-interval '10 seconds' then v_code:='RATE_LIMITED';
      else
        insert into domine_pet_v6.exploration(player_id,map_id,source,eligible_at,expires_at) values(v_p.id,v_map,p_input->>'source',pg_catalog.now()+interval '15 seconds',pg_catalog.now()+interval '10 minutes') returning id into v_new_id;
        update domine_pet_v7.daily set explore_starts=explore_starts+1 where player_id=v_p.id and kst_date=v_today;
      end if;
    end if;
  elsif p_kind='explore_finish' then
    select * into v_ticket from domine_pet_v6.exploration where id=(p_input->>'ticket')::uuid and player_id=v_p.id for update;
    if not found then v_code:='INVALID_INPUT';
    elsif v_ticket.finished_at is not null then
      v_result:=v_ticket.result;
      if not v_result ? 'levels' or (v_result->>'version')::bigint<=v_p.version then
        v_result:=domine_pet_v6.snapshot_v6(v_p.id,v_pet)||domine_pet_v6.result_v6('ALREADY_APPLIED')||pg_catalog.jsonb_build_object('requestId',p_request_id);
      end if;
      insert into domine_pet_v6.operation(player_id,request_id,kind,payload_hash,result) values(v_p.id,p_request_id,p_kind,v_payload,v_result);
      return v_result;
    elsif v_ticket.cancelled_at is not null or pg_catalog.now()>=v_ticket.expires_at then v_code:='EXPIRED';
    elsif pg_catalog.now()<v_ticket.eligible_at then v_code:='TOO_EARLY'; v_extra:=pg_catalog.jsonb_build_object('retryAfterSeconds',pg_catalog.ceil(extract(epoch from v_ticket.eligible_at-pg_catalog.now())));
    else
      if v_day.explore_finishes<30 then
        v_xp_gain:=0; v_coin_gain:=0;
        v_band:=case when extract(hour from pg_catalog.now() at time zone 'Asia/Seoul') between 5 and 6 then 'dawn' when extract(hour from pg_catalog.now() at time zone 'Asia/Seoul') between 7 and 16 then 'day' when extract(hour from pg_catalog.now() at time zone 'Asia/Seoul') between 17 and 20 then 'dusk' else 'night' end;
        select exists(select 1 from domine_pet_v6.catalog c where c.acquisition='explore' and v_ticket.map_id=any(c.maps) and v_band=any(c.time_bands) and not exists(select 1 from domine_pet_v6.album a where a.player_id='a1b2c3d4-0000-4000-8000-000000000001'::uuid and a.entry_id=c.id)) into v_can_find;
        v_pity:=v_can_find and v_p.discovery_misses>=4;
        if v_pity then
          -- Exponential race over rarity groups preserves 65:25:8:2 after filtering missing groups.
          select r.rarity into v_rarity from (
            select distinct c.rarity from domine_pet_v6.catalog c where c.acquisition='explore' and v_ticket.map_id=any(c.maps) and v_band=any(c.time_bands) and not exists(select 1 from domine_pet_v6.album a where a.player_id='a1b2c3d4-0000-4000-8000-000000000001'::uuid and a.entry_id=c.id)
          ) r order by -pg_catalog.ln(greatest(pg_catalog.random(),0.000000001))/(case r.rarity when U&'\C77C\BC18' then 65 when U&'\D2B9\BCC4' then 25 when U&'\D76C\ADC0' then 8 else 2 end) limit 1;
        elsif pg_catalog.random()<0.75 then
          v_roll:=pg_catalog.random(); v_rarity:=case when v_roll<.65 then U&'\C77C\BC18' when v_roll<.90 then U&'\D2B9\BCC4' when v_roll<.98 then U&'\D76C\ADC0' else U&'\C544\C8FC \B4DC\BB3E' end;
          if not exists(select 1 from domine_pet_v6.catalog c where c.acquisition='explore' and v_ticket.map_id=any(c.maps) and v_band=any(c.time_bands) and c.rarity=v_rarity) then v_rarity:=U&'\C77C\BC18'; end if;
        end if;
        if v_rarity is not null then
          select c.id into v_entry from domine_pet_v6.catalog c where c.acquisition='explore' and v_ticket.map_id=any(c.maps) and v_band=any(c.time_bands) and c.rarity=v_rarity
            and (not v_pity or not exists(select 1 from domine_pet_v6.album a where a.player_id='a1b2c3d4-0000-4000-8000-000000000001'::uuid and a.entry_id=c.id)) order by pg_catalog.random() limit 1;
        end if;
        if v_entry is not null then
          select exists(select 1 from domine_pet_v6.album where player_id='a1b2c3d4-0000-4000-8000-000000000001'::uuid and entry_id=v_entry) into v_existed;
          insert into domine_pet_v6.album as a(player_id,entry_id) values('a1b2c3d4-0000-4000-8000-000000000001'::uuid,v_entry) on conflict(player_id,entry_id) do update set find_count=a.find_count+1;
          if not v_existed then v_new_entries:=pg_catalog.jsonb_build_array(v_entry); end if;
        end if;
        update domine_pet_v6.player set discovery_misses=case when pg_catalog.jsonb_array_length(v_new_entries)>0 then 0 when v_can_find then least(4,discovery_misses+1) else discovery_misses end where id=v_p.id;
        update domine_pet_v7.daily set explore_finishes=explore_finishes+1 where player_id=v_p.id and kst_date=v_today;
        perform domine_pet_v6.increment_v6(v_p.id,'explore_total');
        perform domine_pet_v6.increment_v6(v_p.id,'explore_map:'||v_ticket.map_id);
        perform domine_pet_v6.increment_v6(v_p.id,'explore_time:'||v_band);
      else v_skipped:='DAILY_CAP';
      end if;
      update domine_pet_v6.exploration set finished_at=pg_catalog.now() where id=v_ticket.id;
    end if;
  elsif p_kind='record_season' then
    v_entry:=p_input->>'entry'; v_season:=domine_pet_v6.season_for_date_v6(v_today);
    if not exists(select 1 from domine_pet_v6.catalog where id=v_entry and acquisition='season' and v_season=any(seasons)) then v_code:='INVALID_INPUT';
    else
      insert into domine_pet_v6.album(player_id,entry_id) values('a1b2c3d4-0000-4000-8000-000000000001'::uuid,v_entry) on conflict do nothing;
      if found then v_new_entries:=pg_catalog.jsonb_build_array(v_entry); end if;
    end if;
  elsif p_kind='walk_begin' then
    update domine_pet_v6.walk_session set closed_at=pg_catalog.now() where player_id=v_p.id and closed_at is null;
    insert into domine_pet_v6.walk_session(player_id,expires_at) values(v_p.id,pg_catalog.now()+interval '30 minutes') returning id into v_new_id;
    v_extra:=pg_catalog.jsonb_build_object('session',pg_catalog.jsonb_build_object('id',v_new_id,'expires_at',pg_catalog.now()+interval '30 minutes'));
  else
    select * into v_session from domine_pet_v6.walk_session where id=(p_input->>'session')::uuid and player_id=v_p.id for update;
    if not found then v_code:='INVALID_INPUT';
    elsif p_kind='walk_end' then update domine_pet_v6.walk_session set closed_at=coalesce(closed_at,pg_catalog.now()) where id=v_session.id;
    elsif v_session.closed_at is not null or pg_catalog.now()>=v_session.expires_at then v_code:='EXPIRED';
    elsif pg_catalog.now()<v_session.last_claim_at+interval '150 seconds' then v_code:='TOO_EARLY';
    elsif v_day.walk_claims>=4 then v_code:='RATE_LIMITED';
    else
      v_xp_gain:=0; v_coin_gain:=0;
      update domine_pet_v6.walk_session set claims=claims+1,last_claim_at=pg_catalog.now() where id=v_session.id;
      update domine_pet_v7.daily set walk_claims=walk_claims+1 where player_id=v_p.id and kst_date=v_today;
    end if;
  end if;

  v_new_level:=domine_pet_v6.level_v6(least(9280,v_pet_xp+v_xp_gain));
  v_level_coins:=0;
  v_xp_gain:=least(9280-v_pet_xp,v_xp_gain);
  update domine_pet_v10.pet_xp set xp=xp+v_xp_gain where pet_id=v_pet;
  update domine_pet_v7.pool set coins=coins+v_coin_gain+v_level_coins,version=version+1 where id=1;
  if v_new_level>v_old_level then perform domine_pet_v10.log_v10(v_p.nickname,v_pet,'levelup',v_new_level::text); end if;
  for v_entry in select pg_catalog.jsonb_array_elements_text(v_new_entries) loop
    perform domine_pet_v10.log_v10(v_p.nickname,v_pet,'discover',v_entry);
  end loop;
  v_new_badges:=domine_pet_v6.badges_v6(v_p.id);
  v_result:=domine_pet_v6.snapshot_v6(v_p.id,coalesce(v_pet,1))||domine_pet_v6.result_v6(v_code)||v_extra||pg_catalog.jsonb_build_object(
    'requestId',p_request_id,'reward',pg_catalog.jsonb_build_object('xp',v_xp_gain,'coins',v_coin_gain,'levelCoins',v_level_coins,'newEntries',v_new_entries,'newBadges',v_new_badges)
      ||case when v_skipped is null then '{}'::jsonb else pg_catalog.jsonb_build_object('skipped',v_skipped) end
      ||case when v_retry_seconds is null then '{}'::jsonb else pg_catalog.jsonb_build_object('retryAfterSeconds',v_retry_seconds) end);
  if p_kind='explore_finish' and v_code='OK' then update domine_pet_v6.exploration set result=v_result where id=v_ticket.id; end if;
  insert into domine_pet_v6.operation(player_id,request_id,kind,payload_hash,result) values(v_p.id,p_request_id,p_kind,v_payload,v_result);
  return v_result;
end $$;

create or replace function public.domine_pet_king_v17(
  p_nickname text,p_secret text,p_request_id uuid,p_kind text,p_input jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_player domine_pet_v6.player; v_wallet domine_pet_v7.pool; v_op domine_pet_v17.operation;
  v_progress domine_pet_v17.pet_progress; v_ticket domine_pet_v17.battle_ticket; v_raid domine_pet_v17.raid_cycle;
  v_config domine_pet_v17.config; v_hash bytea; v_data jsonb; v_result jsonb; v_before jsonb;
  v_code text:='OK'; v_pet int; v_item record; v_count int; v_total int;
  v_level int; v_new_level int; v_xp int:=0; v_coins bigint:=0; v_cost bigint:=0; v_scale numeric;
  v_difference int; v_first boolean; v_streak bigint; v_streak_scale numeric;
  v_pickup_slot bigint; v_digest bytea; v_found boolean:=false; v_pouch boolean:=false;
  v_allocation jsonb; v_items jsonb; v_used jsonb; v_moves jsonb; v_weak jsonb; v_resist jsonb;
  v_cell text; v_individual text; v_name text; v_rank text; v_region text; v_mode text;
  v_slot bigint:=pg_catalog.floor(extract(epoch from pg_catalog.now())/1800)::bigint;
  v_week date:=pg_catalog.date_trunc('week',pg_catalog.now() at time zone 'Asia/Seoul')::date;
  v_outcome text; v_rounds int; v_eligible boolean; v_amount int:=0; v_drop text; v_price int;
  v_job text; v_tier int; v_marks int; v_new_allocation jsonb;
begin
  if not coalesce(domine_pet_v6.valid_identity_v6(p_nickname,p_secret),false) or p_request_id is null then
    return pg_catalog.jsonb_build_object('ok',false,'code','INVALID_INPUT','requestId',p_request_id,'serverNow',pg_catalog.now());
  end if;
  -- Read snapshots do not lock rows, expire reservations, or append operations.
  if p_kind in ('state','spawns','watching','ranking') then
    select p.* into v_player from domine_pet_v6.player p
      where p.nickname_key=pg_catalog.lower(pg_catalog.normalize(pg_catalog.btrim(p_nickname),'NFC'));
    if not found or v_player.secret_hash<>extensions.digest(p_secret,'sha256') then
      return pg_catalog.jsonb_build_object('ok',false,'code','AUTH_FAILED','requestId',p_request_id,'serverNow',pg_catalog.now());
    end if;
    if p_kind='ranking' then
      select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('nickname',r.nickname,'wins',r.wins,'raidContribution',r.amount)
        order by r.wins desc,r.amount desc,r.nickname),'[]'::jsonb) into v_data
      from (select p.nickname,coalesce(c.wins,0) as wins,
        coalesce((select pg_catalog.sum(a.amount) from domine_pet_v17.raid_contribution a where a.player_id=p.id and a.week=v_week),0) as amount
        from domine_pet_v6.player p left join domine_pet_v17.contribution c on c.player_id=p.id
        where c.wins>0 or exists(select 1 from domine_pet_v17.raid_contribution a where a.player_id=p.id and a.week=v_week)) r;
    else
    v_data:=case p_kind when 'state' then domine_pet_v17.state(v_player.id)
      when 'spawns' then domine_pet_v17.spawns() else domine_pet_v17.watching() end;
    end if;
    return pg_catalog.jsonb_build_object('ok',true,'code','OK','requestId',p_request_id,'serverNow',pg_catalog.now(),'data',v_data);
  end if;
  select p.* into v_player from domine_pet_v6.player p
    where p.nickname_key=pg_catalog.lower(pg_catalog.normalize(pg_catalog.btrim(p_nickname),'NFC')) for update;
  if not found or v_player.secret_hash<>extensions.digest(p_secret,'sha256') then
    return pg_catalog.jsonb_build_object('ok',false,'code','AUTH_FAILED','requestId',p_request_id,'serverNow',pg_catalog.now());
  end if;
  select w.* into strict v_wallet from domine_pet_v7.pool w where w.id=1 for update;
  v_hash:=extensions.digest(coalesce(p_input::text,'null'),'sha256');
  select o.* into v_op from domine_pet_v17.operation o where o.player_id=v_player.id and o.request_id=p_request_id;
  if found then
    if v_op.kind is distinct from coalesce(p_kind,'') or v_op.payload_hash<>v_hash then
      return pg_catalog.jsonb_build_object('ok',false,'code','REQUEST_CONFLICT','requestId',p_request_id,'serverNow',pg_catalog.now());
    end if;
    return v_op.result;
  end if;
  perform p.pet_id from domine_pet_v17.pet_progress p order by p.pet_id for update;
  perform domine_pet_v17.expire_tickets();
  select c.* into strict v_config from domine_pet_v17.config c where c.id=1;

  -- A rejected request rolls back its own partial writes, then caches the rejection.
  begin
    if p_kind is null or p_kind not in ('state','start','finish','allocate','chooseJob','equipMoves','buyItem','spawns','watching','ranking','pickup')
      or p_input is null or pg_catalog.jsonb_typeof(p_input)<>'object' then raise exception 'INVALID_INPUT'; end if;
    if p_kind in ('start','allocate','chooseJob','equipMoves','buyItem') then
      if coalesce(p_input->>'pet','') not in ('1','2') then raise exception 'INVALID_INPUT'; end if;
      v_pet:=(p_input->>'pet')::int;
      select p.* into strict v_progress from domine_pet_v17.pet_progress p where p.pet_id=v_pet;
      v_level:=domine_pet_v17.level_for_xp(v_progress.xp);
      v_before:=domine_pet_v17.pet_state(v_pet);
    end if;
    if p_kind in ('allocate','chooseJob','equipMoves') then
      if coalesce(p_input->>'expectedVersion','') !~ '^[0-9]+$' then raise exception 'INVALID_INPUT'; end if;
      if (p_input->>'expectedVersion')::bigint<>v_progress.version then raise exception 'VERSION_CONFLICT'; end if;
    end if;

    if p_kind='state' then v_data:=domine_pet_v17.state(v_player.id);
    elsif p_kind='spawns' then v_data:=domine_pet_v17.spawns();
    elsif p_kind='watching' then v_data:=domine_pet_v17.watching();
    elsif p_kind='ranking' then
      select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('nickname',r.nickname,'wins',r.wins,'raidContribution',r.amount)
        order by r.wins desc,r.amount desc,r.nickname),'[]'::jsonb) into v_data
      from (select p.nickname,coalesce(c.wins,0) as wins,
        coalesce((select pg_catalog.sum(a.amount) from domine_pet_v17.raid_contribution a where a.player_id=p.id and a.week=v_week),0) as amount
        from domine_pet_v6.player p left join domine_pet_v17.contribution c on c.player_id=p.id
        where c.wins>0 or exists(select 1 from domine_pet_v17.raid_contribution a where a.player_id=p.id and a.week=v_week)) r;

    elsif p_kind='pickup' then
      v_cell:=p_input->>'cell';
      if coalesce(v_cell,'') !~ '^[A-J](10|[1-9])$'
        or coalesce(p_input->>'slot','') !~ '^[0-9]+$' then raise exception 'INVALID_INPUT'; end if;
      v_pickup_slot:=(p_input->>'slot')::bigint;
      if v_pickup_slot<v_slot-1 or v_pickup_slot>v_slot+1 then raise exception 'PICKUP_EXPIRED'; end if;
      insert into domine_pet_v17.pickup_claim(slot,cell,player_id) values(v_pickup_slot,v_cell,v_player.id)
        on conflict(slot,cell) do nothing;
      if found then
        v_digest:=extensions.digest(v_pickup_slot::text||':'||v_cell,'sha256');
        v_found:=(pg_catalog.get_byte(v_digest,0)*256+pg_catalog.get_byte(v_digest,1))<7864;
        if v_found then
          v_pouch:=(pg_catalog.get_byte(v_digest,2)*256+pg_catalog.get_byte(v_digest,3))<1311;
          v_coins:=case when v_pouch then 10+(pg_catalog.get_byte(v_digest,4)*256+pg_catalog.get_byte(v_digest,5))%11
            else 1+(pg_catalog.get_byte(v_digest,4)*256+pg_catalog.get_byte(v_digest,5))%5 end;
          update domine_pet_v7.pool set coins=coins+v_coins,version=version+1 where id=1;
        end if;
      end if;
      v_data:=pg_catalog.jsonb_build_object('found',v_found,'coins',v_coins,'pouch',v_pouch);
      -- Pickup has no pet input; pet 1 is the history schema's shared-wallet anchor.
      perform domine_pet_v10.log_v10(v_player.nickname,1,'pickup',
        (v_data||pg_catalog.jsonb_build_object('cell',v_cell,'slot',v_pickup_slot))::text);

    elsif p_kind='allocate' then
      if not coalesce((v_config.features->>'growth')::boolean,false) then raise exception 'FEATURE_DISABLED'; end if;
      v_allocation:=p_input->'allocation'; v_total:=3*(v_level-1);
      if pg_catalog.jsonb_typeof(v_allocation) is distinct from 'object'
        or coalesce(p_input->>'mode','manual') not in ('auto','manual') then raise exception 'INVALID_INPUT'; end if;
      select pg_catalog.count(*) into v_count from pg_catalog.jsonb_each(v_allocation);
      if v_count<>6 then raise exception 'INVALID_INPUT'; end if;
      for v_item in select e.key,e.value from pg_catalog.jsonb_each_text(v_allocation) e loop
        if v_item.key not in ('hp','attack','defense','speed','focus','calm')
          or coalesce(v_item.value,'') !~ '^[0-9]+$' then raise exception 'INVALID_INPUT'; end if;
        if v_item.value::int<(v_progress.allocation->>v_item.key)::int then raise exception 'ALLOCATION_IRREVERSIBLE'; end if;
        if v_item.value::int>greatest(1,pg_catalog.floor(v_total*.4)::int) then raise exception 'ALLOCATION_CAP'; end if;
      end loop;
      select pg_catalog.sum(e.value::int) into v_count from pg_catalog.jsonb_each_text(v_allocation) e;
      if v_count>v_total then raise exception 'INSUFFICIENT_POINTS'; end if;
      if p_input->>'mode'='auto' then v_allocation:=domine_pet_v17.auto_allocate(v_pet,v_level,v_allocation); end if;
      update domine_pet_v17.pet_progress set allocation=v_allocation,allocation_mode=coalesce(p_input->>'mode','manual'),version=version+1 where pet_id=v_pet;
      v_data:=domine_pet_v17.pet_state(v_pet);

    elsif p_kind='chooseJob' then
      if not coalesce((v_config.features->>'jobs')::boolean,false) then raise exception 'FEATURE_DISABLED'; end if;
      v_job:=p_input->>'job';
      if coalesce(v_job,'') not in ('striker','defender','trickster','tracker','empath')
        or coalesce(p_input->>'tier','') not in ('1','2','3') then raise exception 'INVALID_INPUT'; end if;
      v_tier:=(p_input->>'tier')::int;
      if v_progress.job is null or v_job=v_progress.job then
        if v_tier<>v_progress.job_tier+1 then raise exception 'INVALID_TIER'; end if;
        select pg_catalog.count(*) into v_marks from domine_pet_v17.certification c where c.pet_id=v_pet and c.kind='region';
        if v_level<(case v_tier when 1 then 10 when 2 then 30 else 60 end)
          or (v_tier=1 and not exists(select 1 from domine_pet_v17.certification c where c.pet_id=v_pet and c.kind='region' and c.target='R01'))
          or (v_tier=2 and v_marks<3) or (v_tier=3 and v_marks<6) then raise exception 'PROMOTION_LOCKED'; end if;
        v_cost:=case v_tier when 1 then 0 when 2 then 120 else 300 end;
      else
        if v_tier<>v_progress.job_tier then raise exception 'INVALID_TIER'; end if;
        if v_progress.job_changed_at>pg_catalog.now()-interval '24 hours' then raise exception 'JOB_COOLDOWN'; end if;
        v_cost:=300;
      end if;
      if v_wallet.coins<v_cost then raise exception 'INSUFFICIENT_COINS'; end if;
      update domine_pet_v7.pool set coins=coins-v_cost,version=version+1 where id=1;
      update domine_pet_v17.pet_progress set job=v_job,job_tier=v_tier,
        job_changed_at=case when job is distinct from v_job then pg_catalog.now() else job_changed_at end,version=version+1 where pet_id=v_pet;
      v_data:=domine_pet_v17.pet_state(v_pet);

    elsif p_kind='equipMoves' then
      v_moves:=p_input->'moves';
      if pg_catalog.jsonb_typeof(v_moves) is distinct from 'array' then raise exception 'INVALID_INPUT'; end if;
      if pg_catalog.jsonb_array_length(v_moves)>24 then raise exception 'INVALID_INPUT'; end if;
      select pg_catalog.count(distinct e.value) into v_count from pg_catalog.jsonb_array_elements_text(v_moves) e;
      if v_count<>pg_catalog.jsonb_array_length(v_moves) or exists(select 1 from pg_catalog.jsonb_array_elements(v_moves) e
        where pg_catalog.jsonb_typeof(e.value)<>'string' or (e.value#>>'{}') !~ '^[A-Za-z0-9_:-]{1,64}$') then raise exception 'INVALID_INPUT'; end if;
      if exists(select 1 from domine_pet_v17.battle_ticket t where t.pet_id=v_pet and t.status='active') then raise exception 'BATTLE_ACTIVE'; end if;
      update domine_pet_v17.pet_progress set moves=v_moves,version=version+1 where pet_id=v_pet;
      v_data:=domine_pet_v17.pet_state(v_pet);

    elsif p_kind='buyItem' then
      if not coalesce((v_config.features->>'items')::boolean,false) then raise exception 'FEATURE_DISABLED'; end if;
      if coalesce(p_input->>'quantity','') !~ '^[0-9]+$' then raise exception 'INVALID_INPUT'; end if;
      v_count:=(p_input->>'quantity')::int;
      if v_count<1 or v_count>9 then raise exception 'INVALID_INPUT'; end if;
      select coalesce(pg_catalog.sum((t.reserved->>(p_input->>'item'))::int),0)::int into v_total
        from domine_pet_v17.battle_ticket t where t.pet_id=v_pet and t.status='active';
      if coalesce((select i.quantity from domine_pet_v17.inventory i where i.pet_id=v_pet and i.item_id=p_input->>'item'),0)+v_total+v_count>9
        then raise exception 'INVENTORY_CAP'; end if;
      select i.price into v_price from domine_pet_v17.item_price i where i.item_id=p_input->>'item' and i.enabled;
      if not found then raise exception 'INVALID_ITEM'; end if;
      v_cost:=v_price::bigint*v_count;
      if v_wallet.coins<v_cost then raise exception 'INSUFFICIENT_COINS'; end if;
      update domine_pet_v7.pool set coins=coins-v_cost,version=version+1 where id=1;
      insert into domine_pet_v17.inventory as i(pet_id,item_id,quantity) values(v_pet,p_input->>'item',v_count)
        on conflict(pet_id,item_id) do update set quantity=i.quantity+excluded.quantity;
      update domine_pet_v17.pet_progress set version=version+1 where pet_id=v_pet;
      v_data:=domine_pet_v17.pet_state(v_pet)||pg_catalog.jsonb_build_object('wallet',
        (select pg_catalog.jsonb_build_object('coins',w.coins,'version',w.version) from domine_pet_v7.pool w where w.id=1));

    elsif p_kind='start' then
      if not coalesce((v_config.features->>'battles')::boolean,false) then raise exception 'FEATURE_DISABLED'; end if;
      v_cell:=p_input->>'cell'; v_individual:=p_input->>'individualId'; v_name:=p_input->>'opponentName'; v_rank:=p_input->>'opponentRank';
      v_mode:=coalesce(p_input->>'mode','normal'); v_items:=coalesce(p_input->'items','{}'::jsonb);
      if coalesce(v_cell,'') !~ '^[A-J](10|[1-9])$' or coalesce(v_individual,'') !~ '^[A-Za-z0-9_:-]{1,96}$'
        or coalesce(pg_catalog.length(pg_catalog.btrim(v_name)),0) not between 1 and 80 or v_name ~ '[[:cntrl:]]'
        or not coalesce(v_config.ranks ? v_rank,false) or v_mode not in ('normal','raid')
        or coalesce(p_input->>'opponentLevel','') !~ '^[0-9]+$' or coalesce(p_input->>'slot','') !~ '^[0-9]+$'
        or pg_catalog.jsonb_typeof(v_items)<>'object' then raise exception 'INVALID_INPUT'; end if;
      if (p_input->>'opponentLevel')::int not between 1 and 999 then raise exception 'INVALID_INPUT'; end if;
      if not domine_pet_v17.valid_opponent(v_individual,(p_input->>'opponentLevel')::int,v_rank,v_level) then raise exception 'INVALID_OPPONENT'; end if;
      if (p_input->>'slot')::bigint not between v_slot-1 and v_slot+1 then raise exception 'SPAWN_EXPIRED'; end if;
      v_slot:=(p_input->>'slot')::bigint;
      if v_mode='raid' and not coalesce((v_config.features->>'raids')::boolean,false) then raise exception 'FEATURE_DISABLED'; end if;
      if v_mode='raid' and v_rank<>'boss' then raise exception 'INVALID_INPUT'; end if;
      v_region:=domine_pet_v17.region_for_cell(v_cell);
      if v_mode='normal' and exists(select 1 from domine_pet_v17.departed d where d.slot=v_slot and d.cell=v_cell and d.individual_id=v_individual) then raise exception 'SPAWN_DEPARTED'; end if;
      -- One live claim per shared spawn, across pets and friends; unrelated fights remain independent.
      if v_mode='normal' and exists(select 1 from domine_pet_v17.battle_ticket t where t.slot=v_slot and t.cell=v_cell
        and t.individual_id=v_individual and t.mode='normal' and t.status='active') then raise exception 'SPAWN_BUSY'; end if;
      v_total:=0;
      for v_item in select e.key,e.value from pg_catalog.jsonb_each_text(v_items) e loop
        if coalesce(v_item.value,'') !~ '^[1-3]$' then raise exception 'INVALID_INPUT'; end if;
        v_total:=v_total+v_item.value::int;
        if not exists(select 1 from domine_pet_v17.item_price i where i.item_id=v_item.key and i.enabled) then raise exception 'INVALID_ITEM'; end if;
        if coalesce((select i.quantity from domine_pet_v17.inventory i where i.pet_id=v_pet and i.item_id=v_item.key),0)<v_item.value::int then raise exception 'INSUFFICIENT_ITEMS'; end if;
      end loop;
      if v_total>3 then raise exception 'ITEM_LIMIT'; end if;
      if v_total>0 and not coalesce((v_config.features->>'items')::boolean,false) then raise exception 'FEATURE_DISABLED'; end if;
      for v_item in select e.key,e.value from pg_catalog.jsonb_each_text(v_items) e loop
        update domine_pet_v17.inventory set quantity=quantity-v_item.value::int where pet_id=v_pet and item_id=v_item.key;
      end loop;
      if v_mode='raid' then
        insert into domine_pet_v17.raid_cycle(region,week,target) values(v_region,v_week,4000+1000*pg_catalog.substr(v_region,2)::int) on conflict do nothing;
        select r.* into strict v_raid from domine_pet_v17.raid_cycle r where r.region=v_region and r.week=v_week for update;
        if v_raid.completed_at is not null then raise exception 'RAID_COMPLETE'; end if;
      end if;
      insert into domine_pet_v17.battle_ticket(player_id,nickname,pet_id,individual_id,opponent_name,cell,region,slot,
        opponent_level,opponent_rank,mode,week,seed,snapshot,reserved,rules_version)
      values(v_player.id,v_player.nickname,v_pet,v_individual,v_name,v_cell,v_region,v_slot,(p_input->>'opponentLevel')::int,
        v_rank,v_mode,v_week,pg_catalog.floor(pg_catalog.random()*2147483647)::int,v_before,v_items,v_config.rules_version)
      returning * into v_ticket;
      update domine_pet_v17.pet_progress set version=version+1 where pet_id=v_pet;
      insert into domine_pet_v17.encounter_record as e(individual_id,name,encounters) values(v_individual,v_name,1)
          on conflict(individual_id) do update set encounters=e.encounters+1;
      v_data:=domine_pet_v17.ticket_json(v_ticket);

    elsif p_kind='finish' then
      select t.* into v_ticket from domine_pet_v17.battle_ticket t where t.id=(p_input->>'ticket')::uuid and t.player_id=v_player.id for update;
      if not found then raise exception 'TICKET_NOT_FOUND'; end if;
      if v_ticket.status in ('settled','cancelled') then v_data:=v_ticket.result;
      elsif v_ticket.status='expired' then raise exception 'EXPIRED';
      else
        v_pet:=v_ticket.pet_id; v_outcome:=p_input->>'outcome';
        v_used:=coalesce(p_input->'usedItems','{}'::jsonb); v_moves:=coalesce(p_input->'moveCounts','{}'::jsonb);
        v_weak:=coalesce(p_input->'weaknesses','[]'::jsonb); v_resist:=coalesce(p_input->'resistances','[]'::jsonb);
        if coalesce(v_outcome,'') not in ('win','lose','draw','quit') or coalesce(p_input->>'rounds','') !~ '^[0-9]+$'
          or pg_catalog.jsonb_typeof(v_used)<>'object' or pg_catalog.jsonb_typeof(v_moves)<>'object'
          or pg_catalog.jsonb_typeof(v_weak)<>'array' or pg_catalog.jsonb_typeof(v_resist)<>'array' then raise exception 'INVALID_INPUT'; end if;
        -- Persisted tickets issued before v21 must pass the same bounds.
        if v_outcome<>'quit' and (not domine_pet_v17.valid_opponent(v_ticket.individual_id,v_ticket.opponent_level,
          v_ticket.opponent_rank,(v_ticket.snapshot->>'level')::int)
          or v_ticket.cell !~ '^[A-J](10|[1-9])$'
          or v_ticket.slot not between pg_catalog.floor(extract(epoch from v_ticket.started_at)/1800)::bigint-1
            and pg_catalog.floor(extract(epoch from v_ticket.started_at)/1800)::bigint+1) then raise exception 'INVALID_OPPONENT'; end if;
        v_rounds:=(p_input->>'rounds')::int;
        if v_rounds not between 0 and 60 or (v_outcome<>'quit' and v_rounds=0) then raise exception 'INVALID_INPUT'; end if;
        if pg_catalog.now()<v_ticket.started_at+v_rounds*interval '1 second' then raise exception 'TOO_EARLY'; end if;
        v_total:=0;
        for v_item in select e.key,e.value from pg_catalog.jsonb_each_text(v_used) e loop
          if coalesce(v_item.value,'') !~ '^[0-3]$' then raise exception 'INVALID_INPUT'; end if;
          if v_item.value::int>coalesce((v_ticket.reserved->>v_item.key)::int,0) then raise exception 'ITEM_NOT_RESERVED'; end if;
          v_total:=v_total+v_item.value::int;
        end loop;
        for v_item in select e.key,e.value from pg_catalog.jsonb_each_text(v_moves) e loop
          if coalesce(v_item.value,'') !~ '^[0-9]+$' or v_item.value::int>v_rounds then raise exception 'INVALID_INPUT'; end if;
          if v_item.key !~ '^[A-Za-z0-9_:-]{1,64}$' then raise exception 'INVALID_INPUT'; end if;
          v_total:=v_total+v_item.value::int;
        end loop;
        if v_total>v_rounds then raise exception 'INVALID_ACTION_COUNT'; end if;
        if pg_catalog.jsonb_array_length(v_weak)>1 or pg_catalog.jsonb_array_length(v_resist)>1
          or exists(select 1 from pg_catalog.jsonb_array_elements_text(v_weak||v_resist) e where e.value is null
            or e.value not in ('contact','sound','scent','trick','combo','charge','gaze'))
          or (v_weak<>'[]'::jsonb and v_weak=v_resist) then raise exception 'INVALID_TAGS'; end if;
        if (v_weak||v_resist)<>'[]'::jsonb and not exists(select 1 from pg_catalog.jsonb_each_text(v_moves) e where e.value::int>0) then raise exception 'INVALID_TAGS'; end if;
        if exists(select 1 from domine_pet_v17.encounter_record e where e.individual_id=v_ticket.individual_id and (
          (e.weaknesses<>'[]'::jsonb and v_weak<>'[]'::jsonb and e.weaknesses<>v_weak)
          or (e.resistances<>'[]'::jsonb and v_resist<>'[]'::jsonb and e.resistances<>v_resist)
          or (e.weaknesses ? (v_resist->>0)) or (e.resistances ? (v_weak->>0)))) then raise exception 'TAG_CONFLICT'; end if;
        select p.* into strict v_progress from domine_pet_v17.pet_progress p where p.pet_id=v_pet;
        v_before:=domine_pet_v17.pet_state(v_pet); v_level:=domine_pet_v17.level_for_xp(v_progress.xp);
        v_difference:=v_ticket.opponent_level-(v_ticket.snapshot->>'level')::int;
        v_eligible:=v_outcome<>'quit' and v_difference> -4;
        v_first:=v_outcome='win' and not exists(select 1 from domine_pet_v17.encounter_record e
          where e.individual_id=v_ticket.individual_id and e.wins>0);
        v_streak:=case when v_outcome in ('lose','quit') then 0
          when v_outcome='win' then v_progress.streak+1 else v_progress.streak end;
        -- Draws preserve streaks; five wins reach the design cap.
        v_streak_scale:=case when v_streak>=5 then 1.25 else 1+greatest(0,v_streak-1)*.05 end;
        if v_eligible then
          v_scale:=case when v_difference>=0 then 1+least(6,v_difference)*.1 else 1+v_difference*.15 end;
          if coalesce((v_config.features->>'growth')::boolean,false) then
            -- Legacy lieutenant tickets use the veteran scale.
            v_xp:=greatest(1,pg_catalog.floor((12+2*v_ticket.opponent_level)
              *case v_outcome when 'win' then 1 when 'draw' then .4 else .3 end
              *v_scale*case v_ticket.opponent_rank when 'veteran' then 1.2 when 'lieutenant' then 1.2
                when 'chief' then 1.5 when 'boss' then 3 when 'gatekeeper' then 4 when 'king' then 6 when 'guest' then 1.5 else 1 end
              *case when v_first then 1.5 else 1 end*v_streak_scale)::int);
          end if;
          if v_outcome='win' then
            v_coins:=pg_catalog.floor((2+v_ticket.opponent_level/5)
              *case v_ticket.opponent_rank when 'veteran' then 1.2 when 'lieutenant' then 1.2
                when 'chief' then 2 when 'boss' then 5 when 'gatekeeper' then 8 when 'king' then 15 when 'guest' then 2 else 1 end
              *case when v_first then 1.5 else 1 end)::bigint;
          end if;
          if coalesce((v_config.features->>'mastery')::boolean,false) then
            for v_item in select e.key,e.value from pg_catalog.jsonb_each_text(v_moves) e loop
              insert into domine_pet_v17.mastery as m(pet_id,move_id,uses) values(v_pet,v_item.key,least(3,v_item.value::int))
                on conflict(pet_id,move_id) do update set uses=m.uses+excluded.uses;
            end loop;
          end if;
        end if;
        -- Absolute ceilings use the starting level, never client reward fields.
        v_xp:=least(v_xp,pg_catalog.floor((12+2*least(999,(v_ticket.snapshot->>'level')::int+10))*6*1.6*1.5*1.25)::int);
        v_coins:=least(v_coins,pg_catalog.floor((2+least(999,(v_ticket.snapshot->>'level')::int+10)/5)*15*1.5)::bigint);
        for v_item in select e.key,e.value from pg_catalog.jsonb_each_text(v_ticket.reserved) e loop
          insert into domine_pet_v17.inventory as i(pet_id,item_id,quantity)
            values(v_pet,v_item.key,v_item.value::int-coalesce((v_used->>v_item.key)::int,0))
            on conflict(pet_id,item_id) do update set quantity=i.quantity+excluded.quantity;
        end loop;
        if v_ticket.mode='normal' and v_outcome='win' then
          insert into domine_pet_v17.departed(slot,cell,individual_id) values(v_ticket.slot,v_ticket.cell,v_ticket.individual_id) on conflict do nothing;
          if coalesce((v_config.features->>'certifications')::boolean,false) and v_ticket.opponent_rank<>'resident' then
            insert into domine_pet_v17.certification(pet_id,kind,target) values(v_pet,
              case v_ticket.opponent_rank when 'chief' then 'cell' when 'boss' then 'region' else v_ticket.opponent_rank end,
              case v_ticket.opponent_rank when 'chief' then v_ticket.cell when 'boss' then v_ticket.region else v_ticket.individual_id end) on conflict do nothing;
          end if;
          if v_eligible then
            insert into domine_pet_v17.contribution as c(player_id,wins) values(v_player.id,1)
              on conflict(player_id) do update set wins=c.wins+1;
            if coalesce((v_config.features->>'items')::boolean,false) and coalesce((v_config.features->>'drops')::boolean,false) and v_ticket.seed%20=0 then
              select i.item_id into v_drop from domine_pet_v17.item_price i where i.enabled order by i.item_id
                offset ((v_ticket.seed/20)%greatest(1,(select pg_catalog.count(*)::int from domine_pet_v17.item_price i where i.enabled))) limit 1;
              if v_drop is not null and coalesce((select i.quantity from domine_pet_v17.inventory i where i.pet_id=v_pet and i.item_id=v_drop),0)
                +coalesce((select pg_catalog.sum((t.reserved->>v_drop)::int) from domine_pet_v17.battle_ticket t where t.pet_id=v_pet and t.status='active' and t.id<>v_ticket.id),0)<9 then
                insert into domine_pet_v17.inventory as i(pet_id,item_id,quantity) values(v_pet,v_drop,1)
                  on conflict(pet_id,item_id) do update set quantity=i.quantity+1;
              else v_drop:=null;
              end if;
            end if;
          end if;
        end if;
        insert into domine_pet_v17.encounter_record(individual_id,name)
          values(v_ticket.individual_id,v_ticket.opponent_name) on conflict do nothing;
        update domine_pet_v17.encounter_record e set wins=e.wins+case when v_outcome='win' then 1 else 0 end,
            losses=e.losses+case when v_outcome='lose' then 1 else 0 end,
            weaknesses=(select coalesce(pg_catalog.jsonb_agg(s.tag order by s.tag),'[]'::jsonb) from
              (select distinct x.value as tag from pg_catalog.jsonb_array_elements_text(e.weaknesses||v_weak) x) s),
            resistances=(select coalesce(pg_catalog.jsonb_agg(s.tag order by s.tag),'[]'::jsonb) from
              (select distinct x.value as tag from pg_catalog.jsonb_array_elements_text(e.resistances||v_resist) x) s)
          where e.individual_id=v_ticket.individual_id;
        if v_ticket.mode='raid' and v_outcome<>'quit' then
          if coalesce(p_input->>'remainingHp','') !~ '^[0-9]+$' or coalesce(p_input->>'maxHp','') !~ '^[0-9]+$' then raise exception 'INVALID_INPUT'; end if;
          if (p_input->>'maxHp')::bigint<=0 or (p_input->>'remainingHp')::bigint>(p_input->>'maxHp')::bigint
            or (v_outcome='win' and (p_input->>'remainingHp')::bigint<>0) then raise exception 'INVALID_INPUT'; end if;
          select r.* into strict v_raid from domine_pet_v17.raid_cycle r where r.region=v_ticket.region and r.week=v_ticket.week for update;
          if v_ticket.week=v_week then
            v_amount:=least(v_raid.target-v_raid.progress,pg_catalog.floor(1000*(1-(p_input->>'remainingHp')::numeric/(p_input->>'maxHp')::numeric))::int);
          end if;
          insert into domine_pet_v17.raid_contribution(ticket_id,region,week,player_id,pet_id,amount)
            values(v_ticket.id,v_ticket.region,v_ticket.week,v_player.id,v_pet,v_amount);
          update domine_pet_v17.raid_cycle set progress=progress+v_amount,
            completed_at=case when progress+v_amount=target then coalesce(completed_at,pg_catalog.now()) else completed_at end
            where region=v_ticket.region and week=v_ticket.week;
          -- Raid completion changes progress only; rewards use the same finish formula.
        end if;
        v_new_level:=domine_pet_v17.level_for_xp(v_progress.xp+v_xp);
        v_new_allocation:=case when v_progress.allocation_mode='auto'
          then domine_pet_v17.auto_allocate(v_pet,v_new_level,v_progress.allocation) else v_progress.allocation end;
        update domine_pet_v17.pet_progress set xp=xp+v_xp,allocation=v_new_allocation,streak=v_streak,version=version+1 where pet_id=v_pet;
        update domine_pet_v7.pool set coins=coins+v_coins,version=version+1 where id=1;
        if v_new_level>v_level then
          insert into domine_pet_v17.change_history(player_id,pet_id,kind,before_state,after_state)
            values(v_player.id,v_pet,'levelup',v_before,domine_pet_v17.pet_state(v_pet));
          perform domine_pet_v10.log_v10(v_player.nickname,v_pet,'levelup',v_new_level::text);
        end if;
        perform domine_pet_v6.badges_v6(v_player.id);
        perform domine_pet_v10.log_v10(v_player.nickname,v_pet,'battle',v_ticket.opponent_name||' - '||v_outcome);
        v_data:=pg_catalog.jsonb_build_object('ticket',v_ticket.id,'outcome',v_outcome,'xp',v_xp,'coins',v_coins,'streak',v_streak,
          'levelBefore',v_level,'levelAfter',v_new_level,'eligible',v_eligible,'contribution',v_amount,'drop',v_drop,'progress',domine_pet_v17.pet_state(v_pet),
          'wallet',(select pg_catalog.jsonb_build_object('coins',w.coins,'version',w.version) from domine_pet_v7.pool w where w.id=1));
        update domine_pet_v17.battle_ticket set status=case when v_outcome='quit' then 'cancelled' else 'settled' end,result=v_data where id=v_ticket.id;
      end if;
    end if;
    if p_kind in ('allocate','chooseJob','equipMoves','buyItem') then
      insert into domine_pet_v17.change_history(player_id,pet_id,kind,before_state,after_state) values(v_player.id,v_pet,p_kind,v_before,v_data);
    end if;
  exception
    when raise_exception then v_code:=sqlerrm; v_data:=null;
    when invalid_text_representation or numeric_value_out_of_range or invalid_parameter_value then v_code:='INVALID_INPUT'; v_data:=null;
  end;
  v_result:=pg_catalog.jsonb_build_object('ok',v_code='OK','code',v_code,'requestId',p_request_id,'serverNow',pg_catalog.now(),'data',v_data);
  insert into domine_pet_v17.operation(player_id,request_id,kind,payload_hash,result) values(v_player.id,p_request_id,coalesce(p_kind,''),v_hash,v_result);
  return v_result;
end $$;

create or replace function public.domine_pet_capabilities_v6() returns jsonb
language sql security definer set search_path='' as $$
  select '{"version":6,"sharedEconomy":true,"explorationThemes":24,"v9":true,"v10":true,"perPetShop":true,"history":true,"busyLock":true,"king":true,"rewardsV18":true,"spawnProfile":true}'::jsonb
    ||pg_catalog.jsonb_build_object('kingFeatures',c.features) from domine_pet_v17.config c where c.id=1;
$$;

-- Decode the verbatim pre-v23 definition.
do $restore$ begin execute U&'create or replace function public.domine_pet_care_for(p_pet int, p_nickname text, p_action text)
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
  nick text := btrim(coalesce(p_nickname, ''''));
begin
  if p_pet is null or p_pet not in (1, 2) then
    raise exception ''Unknown pet'' using errcode = ''22023'';
  end if;
  if nick !~ ''^[\AC00-\D7A3a-zA-Z0-9]{1,8}$'' then
    return jsonb_build_object(''ok'', false, ''message'', ''\BCC4\BA85\C740 \D55C\AE00\00B7\C601\BB38\00B7\C22B\C790 1~8\C790\B85C \C785\B825\D574 \C8FC\C138\C694.'');
  end if;
  if p_action is null or p_action not in (''feed'', ''treat'', ''pet'', ''play'', ''walk'', ''brush'', ''bath'', ''train'') then
    return jsonb_build_object(''ok'', false, ''message'', ''\C54C \C218 \C5C6\B294 \D589\B3D9\C774\C5D0\C694.'');
  end if;

  perform pg_advisory_xact_lock(20261111, 120000);

  -- \B3C4\BC30 \BC29\C9C0: \C804\CCB4\C5D0\C11C 1\BD84\C5D0 20\BC88\AE4C\C9C0
  if (select count(*) from public.domine_pet_log where created_at > now() - interval ''1 minute'') >= 20 then
    return jsonb_build_object(''ok'', false, ''message'', ''\C9C0\AE08\C740 \C0AC\B78C\C774 \B9CE\C544\C694. \C7A0\C2DC \D6C4 \B2E4\C2DC \D574 \C8FC\C138\C694.'');
  end if;

  select * into p from public.domine_pet where id = p_pet for update;
  hrs := extract(epoch from (now() - p.updated_at)) / 3600.0;
  f := greatest(0, p.fullness - floor(hrs * 6)::int);
  m := greatest(0, p.mood - floor(hrs * 5)::int);
  c := greatest(0, p.clean - floor(hrs * 3)::int);

  if p_action = ''feed'' then
    if f >= 90 then return jsonb_build_object(''ok'', false, ''message'', p.name || ''\B294 \BC30\AC00 \BD88\B7EC\C694.''); end if;
    f := least(100, f + 30); m := least(100, m + 5);
  elsif p_action = ''treat'' then
    if m >= 95 then return jsonb_build_object(''ok'', false, ''message'', p.name || ''\B294 \C774\BBF8 \AE30\BD84\C774 \CD5C\ACE0\C608\C694.''); end if;
    f := least(100, f + 10); m := least(100, m + 15);
  elsif p_action = ''pet'' then
    if m >= 95 then return jsonb_build_object(''ok'', false, ''message'', p.name || ''\B294 \C774\BBF8 \AE30\BD84\C774 \CD5C\ACE0\C608\C694.''); end if;
    m := least(100, m + 15);
  elsif p_action = ''play'' then
    if m >= 95 then return jsonb_build_object(''ok'', false, ''message'', p.name || ''\B294 \C774\BBF8 \AE30\BD84\C774 \CD5C\ACE0\C608\C694.''); end if;
    m := least(100, m + 20); f := greatest(0, f - 5); c := greatest(0, c - 5);
  elsif p_action = ''walk'' then
    m := least(100, m + 25); f := greatest(0, f - 10); c := greatest(0, c - 10);
  elsif p_action = ''brush'' then
    if c >= 90 then return jsonb_build_object(''ok'', false, ''message'', p.name || ''\B294 \C774\BBF8 \BC18\C9DD\BC18\C9DD\D574\C694.''); end if;
    m := least(100, m + 10); c := least(100, c + 15);
  elsif p_action = ''train'' then
    if m >= 95 then return jsonb_build_object(''ok'', false, ''message'', p.name || ''\B294 \C774\BBF8 \AE30\BD84\C774 \CD5C\ACE0\C608\C694.''); end if;
    m := least(100, m + 15); f := greatest(0, f - 5);
  else
    if c >= 80 then return jsonb_build_object(''ok'', false, ''message'', p.name || ''\B294 \C774\BBF8 \AE68\B057\D574\C694.''); end if;
    c := least(100, c + 40); m := least(100, m + 5);
  end if;

  update public.domine_pet
     set fullness = f, mood = m, clean = c, care_total = care_total + 1, updated_at = now()
   where id = p_pet;
  insert into public.domine_pet_log (pet_id, nickname, action) values (p_pet, nick, p_action);

  return jsonb_build_object(''ok'', true);
end;
$$;'; end $restore$;

-- Decode the verbatim pre-v23 definition.
do $restore$ begin execute U&'create or replace function public.domine_pet_care(p_nickname text, p_action text)
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
  nick text := btrim(coalesce(p_nickname, ''''));
  cd int;
begin
  if nick !~ ''^[\AC00-\D7A3a-zA-Z0-9]{1,8}$'' then
    return jsonb_build_object(''ok'', false, ''message'', ''\BCC4\BA85\C740 \D55C\AE00\00B7\C601\BB38\00B7\C22B\C790 1~8\C790\B85C \C785\B825\D574 \C8FC\C138\C694.'');
  end if;
  if p_action not in (''feed'', ''treat'', ''pet'', ''play'', ''walk'', ''brush'', ''bath'', ''train'') then
    return jsonb_build_object(''ok'', false, ''message'', ''\C54C \C218 \C5C6\B294 \D589\B3D9\C774\C5D0\C694.'');
  end if;

  -- \B3C4\BC30 \BC29\C9C0: \C804\CCB4\C5D0\C11C 1\BD84\C5D0 20\BC88\AE4C\C9C0
  if (select count(*) from public.domine_pet_log where created_at > now() - interval ''1 minute'') >= 20 then
    return jsonb_build_object(''ok'', false, ''message'', ''\C9C0\AE08\C740 \C0AC\B78C\C774 \B9CE\C544\C694. \C7A0\C2DC \D6C4 \B2E4\C2DC \D574 \C8FC\C138\C694.'');
  end if;

  cd := public.domine_pet_cooldown(nick, p_action, public.domine_pet_cd_secs(p_action));
  if cd > 0 then
    return jsonb_build_object(''ok'', false, ''message'', ''\C544\C9C1 \C26C\B294 \C911\C774\C5D0\C694.'', ''wait'', cd);
  end if;

  select * into p from public.domine_pet where id = 1 for update;
  hrs := extract(epoch from (now() - p.updated_at)) / 3600.0;
  f := greatest(0, p.fullness - floor(hrs * 6)::int);
  m := greatest(0, p.mood - floor(hrs * 5)::int);
  c := greatest(0, p.clean - floor(hrs * 3)::int);

  if p_action = ''feed'' then
    if f >= 90 then return jsonb_build_object(''ok'', false, ''message'', ''\B3C4\BBF8\B294 \BC30\AC00 \BD88\B7EC\C694.''); end if;
    f := least(100, f + 30); m := least(100, m + 5);
  elsif p_action = ''treat'' then
    if m >= 95 then return jsonb_build_object(''ok'', false, ''message'', ''\B3C4\BBF8\B294 \C774\BBF8 \AE30\BD84\C774 \CD5C\ACE0\C608\C694.''); end if;
    f := least(100, f + 10); m := least(100, m + 15);
  elsif p_action = ''pet'' then
    if m >= 95 then return jsonb_build_object(''ok'', false, ''message'', ''\B3C4\BBF8\B294 \C774\BBF8 \AE30\BD84\C774 \CD5C\ACE0\C608\C694.''); end if;
    m := least(100, m + 15);
  elsif p_action = ''play'' then
    if m >= 95 then return jsonb_build_object(''ok'', false, ''message'', ''\B3C4\BBF8\B294 \C774\BBF8 \AE30\BD84\C774 \CD5C\ACE0\C608\C694.''); end if;
    m := least(100, m + 20); f := greatest(0, f - 5); c := greatest(0, c - 5);
  elsif p_action = ''walk'' then
    m := least(100, m + 25); f := greatest(0, f - 10); c := greatest(0, c - 10);
  elsif p_action = ''brush'' then
    if c >= 90 then return jsonb_build_object(''ok'', false, ''message'', ''\B3C4\BBF8\B294 \C774\BBF8 \BC18\C9DD\BC18\C9DD\D574\C694.''); end if;
    m := least(100, m + 10); c := least(100, c + 15);
  elsif p_action = ''train'' then
    if m >= 95 then return jsonb_build_object(''ok'', false, ''message'', ''\B3C4\BBF8\B294 \C774\BBF8 \AE30\BD84\C774 \CD5C\ACE0\C608\C694.''); end if;
    m := least(100, m + 15); f := greatest(0, f - 5);
  else
    if c >= 80 then return jsonb_build_object(''ok'', false, ''message'', ''\B3C4\BBF8\B294 \C774\BBF8 \AE68\B057\D574\C694.''); end if;
    c := least(100, c + 40); m := least(100, m + 5);
  end if;

  update public.domine_pet
     set fullness = f, mood = m, clean = c, care_total = care_total + 1, updated_at = now()
   where id = 1;
  insert into public.domine_pet_log (nickname, action) values (nick, p_action);

  return jsonb_build_object(''ok'', true);
end;
$$;'; end $restore$;

revoke all on function domine_pet_v22.level_profile() from public,anon,authenticated;
revoke all on function domine_pet_v17.pet_state(int) from public,anon,authenticated;
revoke all on function domine_pet_v17.state(uuid) from public,anon,authenticated;
revoke all on function domine_pet_v17.spawns() from public,anon,authenticated;
revoke all on function domine_pet_v17.watching() from public,anon,authenticated;
revoke all on function public.domine_pet_state_for(int,text) from public,anon,authenticated;
grant execute on function public.domine_pet_state_for(int,text) to anon,authenticated;
revoke all on function public.domine_pet_state(text) from public,anon,authenticated;
grant execute on function public.domine_pet_state(text) to anon,authenticated;
revoke all on function domine_pet_v6.snapshot_v6(uuid,int) from public,anon,authenticated;
revoke all on function domine_pet_v6.badges_v6(uuid) from public,anon,authenticated;
revoke all on function public.domine_pet_register_v6(text,text) from public,anon,authenticated;
grant execute on function public.domine_pet_register_v6(text,text) to anon,authenticated;
revoke all on function public.domine_pet_state_v6(text,text,int) from public,anon,authenticated;
grant execute on function public.domine_pet_state_v6(text,text,int) to anon,authenticated;
revoke all on function public.domine_pet_operation_v6(text,text,uuid) from public,anon,authenticated;
grant execute on function public.domine_pet_operation_v6(text,text,uuid) to anon,authenticated;
revoke all on function domine_pet_v17.expire_tickets() from public,anon,authenticated;
revoke all on function domine_pet_v6.command_v6(text,text,uuid,text,jsonb) from public,anon,authenticated;
revoke all on function public.domine_pet_king_v17(text,text,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.domine_pet_king_v17(text,text,uuid,text,jsonb) to anon,authenticated;
revoke all on function public.domine_pet_capabilities_v6() from public,anon,authenticated;
grant execute on function public.domine_pet_capabilities_v6() to anon,authenticated;
revoke all on function public.domine_pet_care_for(int,text,text) from public,anon,authenticated;
grant execute on function public.domine_pet_care_for(int,text,text) to anon,authenticated;
revoke all on function public.domine_pet_care(text,text) from public,anon,authenticated;
grant execute on function public.domine_pet_care(text,text) to anon,authenticated;
grant execute on function public.domine_pet_care(text,text) to public;
grant execute on function public.domine_pet_state(text) to public;
update domine_pet_v17.config set reset_epoch='20261112-v23r' where id=1;
notify pgrst,'reload schema';
commit;
