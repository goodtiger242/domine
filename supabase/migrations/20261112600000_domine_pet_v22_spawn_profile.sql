begin;
set local lock_timeout = '10s';
set local statement_timeout = '120s';

create schema if not exists domine_pet_v22;
revoke all on schema domine_pet_v22 from public,anon,authenticated;
create table if not exists domine_pet_v22.spawn_profile (
  day date primary key, levels int[] not null check(pg_catalog.array_length(levels,1)=5),
  players int not null, created_at timestamptz not null default pg_catalog.now()
);
alter table domine_pet_v22.spawn_profile enable row level security;
revoke all on table domine_pet_v22.spawn_profile from public,anon,authenticated;

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

create or replace function domine_pet_v17.valid_opponent(p_id text,p_level int,p_rank text,p_player_level int)
-- shortcut: pool membership and bounds only; verify placement when server spawn replay is introduced.
returns boolean language plpgsql stable set search_path='' as $$
declare v_seed int; v_breeds text[]:=array['B001','B002','B003','B004','B005','B007','B009','B015','B017','B018','B020','B022','B101','B102','B103','B104','B105','B106','B107','B108','B109','B110','B111','B112','B113','B114','B115','B116','B117','B118','B119','B120','C01','C02','C03','C04','C05','C06','C07','C08','C09','C10','C11','C12','V01','V02','V03','V04','V05','V06','V07','V08','V09','V10','V11','V12','V13','V14','V15','V16','V17','V18','V19','V20','G01','G03','G05'];
begin
  if p_id is null or p_level is null or p_player_level is null or p_rank is null
    or p_level not between 1 and 999
    or p_rank not in ('resident','veteran','guest','chief','lieutenant','boss','gatekeeper','king') then return false; end if;
  if p_id ~ '^N(0[1-9]|[12][0-9]|3[0-5])$' then return p_level<=least(999,p_player_level+10); end if;
  if p_level>least(999,greatest(coalesce((select s.levels[5] from domine_pet_v22.spawn_profile s order by s.day desc limit 1),5)+5,p_player_level+10)) then return false; end if;
  if p_id !~ '^resident:[A-Za-z0-9]+:[0-9]{3,6}$' then return false; end if;
  v_seed:=pg_catalog.split_part(p_id,':',3)::int;
  return coalesce(v_breeds[v_seed/8+1]=pg_catalog.split_part(p_id,':',2)
    and pg_catalog.split_part(p_id,':',3)=pg_catalog.lpad(v_seed::text,greatest(3,pg_catalog.length(v_seed::text)),'0'),false);
end $$;

create or replace function domine_pet_v17.spawns() returns jsonb
language sql volatile set search_path='' as $$
  select pg_catalog.jsonb_build_object('levelProfile',domine_pet_v22.level_profile(),'slot',pg_catalog.floor(extract(epoch from pg_catalog.now())/1800)::bigint,
    'departed',coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('slot',d.slot,'cell',d.cell,'individualId',d.individual_id)
      order by d.cell,d.individual_id) from domine_pet_v17.departed d
      where d.slot=pg_catalog.floor(extract(epoch from pg_catalog.now())/1800)::bigint),'[]'::jsonb));
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
revoke all on all functions in schema domine_pet_v22 from public,anon,authenticated;

notify pgrst,'reload schema';
commit;
