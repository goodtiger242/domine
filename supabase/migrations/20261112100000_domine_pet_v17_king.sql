-- Shared battle progression. Care, cosmetic shop and all v6 commands stay intact.
begin;
create schema if not exists domine_pet_v17;
revoke all on schema domine_pet_v17 from public,anon,authenticated;

create table if not exists domine_pet_v17.config (
  id int primary key check(id=1),
  features jsonb not null,
  ranks jsonb not null default '["resident","chief","lieutenant","boss","gatekeeper","king"]',
  rules_version int not null default 1
);
insert into domine_pet_v17.config(id,features) values(1,
  '{"battles":true,"growth":true,"items":true,"jobs":true,"mastery":true,"encyclopedia":true,"certifications":true,"raids":false,"drops":true}')
on conflict do nothing;

-- No band multipliers were specified in the final reward table. Preserve its values.
-- These rows allow later tuning without installing another function.
create table if not exists domine_pet_v17.reward_scale (
  min_level int primary key check(min_level between 1 and 999),
  multiplier numeric not null check(multiplier>0 and multiplier<=100)
);
insert into domine_pet_v17.reward_scale values(1,1),(20,1),(50,1),(100,1),(200,1),(500,1) on conflict do nothing;

create table if not exists domine_pet_v17.pet_progress (
  pet_id int primary key check(pet_id in (1,2)),
  xp bigint not null default 0 check(xp>=0),
  allocation jsonb not null default '{"hp":0,"attack":0,"defense":0,"speed":0,"focus":0,"calm":0}',
  allocation_mode text not null default 'auto',
  job text, job_tier int not null default 0 check(job_tier between 0 and 3),
  job_changed_at timestamptz,
  moves jsonb not null default '[]', version bigint not null default 0
);
insert into domine_pet_v17.pet_progress(pet_id) values(1),(2) on conflict do nothing;
create table if not exists domine_pet_v17.mastery (
  pet_id int references domine_pet_v17.pet_progress(pet_id), move_id text,
  uses bigint not null default 0 check(uses>=0), primary key(pet_id,move_id)
);
create table if not exists domine_pet_v17.item_price (
  item_id text primary key, price int not null check(price>0), enabled boolean not null default true
);
insert into domine_pet_v17.item_price(item_id,price) values
  ('P01',15),('P02',35),('P03',70),('P04',12),('P05',30),('P06',25),('P07',25),
  ('P08',25),('P09',25),('P10',20),('P11',30),('P12',40),('P13',35),('P14',60)
on conflict do nothing;
create table if not exists domine_pet_v17.inventory (
  pet_id int references domine_pet_v17.pet_progress(pet_id), item_id text references domine_pet_v17.item_price(item_id),
  quantity bigint not null default 0 check(quantity>=0), primary key(pet_id,item_id)
);
create table if not exists domine_pet_v17.battle_ticket (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  player_id uuid not null references domine_pet_v6.player(id), nickname text not null,
  pet_id int not null references domine_pet_v17.pet_progress(pet_id),
  individual_id text not null, opponent_name text not null, cell text not null, region text not null,
  slot bigint not null, opponent_level int not null check(opponent_level between 1 and 999),
  opponent_rank text not null, mode text not null, week date not null,
  seed int not null, snapshot jsonb not null, reserved jsonb not null, rules_version int not null,
  started_at timestamptz not null default pg_catalog.now(),
  expires_at timestamptz not null default pg_catalog.now()+interval '30 minutes',
  status text not null default 'active', result jsonb
);
create index if not exists king_active_expiry on domine_pet_v17.battle_ticket(expires_at) where status='active';
create index if not exists king_owner_tickets on domine_pet_v17.battle_ticket(player_id,started_at desc);
create index if not exists king_spawn_tickets on domine_pet_v17.battle_ticket(slot,cell,individual_id) where status='active';
create table if not exists domine_pet_v17.departed (
  slot bigint, cell text, individual_id text, primary key(slot,cell,individual_id)
);
create table if not exists domine_pet_v17.encounter_record (
  individual_id text primary key, name text not null,
  encounters bigint not null default 0, wins bigint not null default 0, losses bigint not null default 0,
  weaknesses jsonb not null default '[]', resistances jsonb not null default '[]'
);
create table if not exists domine_pet_v17.certification (
  pet_id int references domine_pet_v17.pet_progress(pet_id), kind text, target text,
  at timestamptz not null default pg_catalog.now(), primary key(pet_id,kind,target)
);
create table if not exists domine_pet_v17.contribution (
  player_id uuid primary key references domine_pet_v6.player(id), wins bigint not null default 0
);
create table if not exists domine_pet_v17.raid_cycle (
  region text, week date, target int not null check(target>0), progress int not null default 0,
  completed_at timestamptz, primary key(region,week), check(progress between 0 and target)
);
create table if not exists domine_pet_v17.raid_contribution (
  ticket_id uuid primary key references domine_pet_v17.battle_ticket(id),
  region text not null, week date not null, player_id uuid not null references domine_pet_v6.player(id),
  pet_id int not null references domine_pet_v17.pet_progress(pet_id), amount int not null check(amount between 0 and 1000),
  foreign key(region,week) references domine_pet_v17.raid_cycle(region,week)
);
create table if not exists domine_pet_v17.change_history (
  id bigint generated always as identity primary key, player_id uuid not null references domine_pet_v6.player(id),
  pet_id int not null references domine_pet_v17.pet_progress(pet_id), kind text not null,
  before_state jsonb not null, after_state jsonb not null, at timestamptz not null default pg_catalog.now()
);
create table if not exists domine_pet_v17.operation (
  player_id uuid references domine_pet_v6.player(id), request_id uuid, kind text not null,
  payload_hash bytea not null, result jsonb not null, primary key(player_id,request_id)
);

-- Replace only CHECKs mentioning kind, found by definition, never by generated name.
-- Keep all existing rows valid and admit battle and future nonempty kinds.
do $$ declare v_constraint record; begin
  for v_constraint in select c.conname from pg_catalog.pg_constraint c
    where c.conrelid='domine_pet_v10.history'::pg_catalog.regclass and c.contype='c'
      and pg_catalog.pg_get_constraintdef(c.oid) ~ '\mkind\M'
  loop
    execute pg_catalog.format('alter table domine_pet_v10.history drop constraint %I',v_constraint.conname);
  end loop;
  alter table domine_pet_v10.history add constraint history_kind_v17 check(pg_catalog.length(kind)>0);
end $$;

create or replace function domine_pet_v17.xp_for_level(p_level int) returns bigint
language sql immutable set search_path='' as $$
  select 6::bigint*(p_level-1)*(p_level+4)+pg_catalog.floor(pg_catalog.power(greatest(0,p_level-10)::numeric,3)/25)::bigint;
$$;
create or replace function domine_pet_v17.level_for_xp(p_xp bigint) returns int
language plpgsql immutable set search_path='' as $$
declare v_low int:=1; v_high int:=999; v_mid int;
begin
  while v_low<v_high loop
    v_mid:=(v_low+v_high+1)/2;
    if domine_pet_v17.xp_for_level(v_mid)<=p_xp then v_low:=v_mid; else v_high:=v_mid-1; end if;
  end loop;
  return v_low;
end $$;
create or replace function domine_pet_v17.auto_allocate(p_pet int,p_level int,p_allocation jsonb) returns jsonb
language plpgsql immutable set search_path='' as $$
declare
  v_result jsonb:=p_allocation; v_total int:=3*(p_level-1); v_spent int; v_key text;
  v_weights jsonb:=case when p_pet=1 then '{"hp":20,"attack":12,"defense":18,"speed":12,"focus":23,"calm":15}'::jsonb
    else '{"hp":16,"attack":20,"defense":14,"speed":24,"focus":16,"calm":10}'::jsonb end;
begin
  select coalesce(pg_catalog.sum(e.value::int),0) into v_spent from pg_catalog.jsonb_each_text(v_result) e;
  while v_spent<v_total loop
    select e.key into v_key from pg_catalog.jsonb_each_text(v_weights) e
      where (v_result->>e.key)::int<greatest(1,pg_catalog.floor(v_total*.4)::int)
      order by v_total*e.value::numeric/100-(v_result->>e.key)::int desc,e.key limit 1;
    v_result:=pg_catalog.jsonb_set(v_result,array[v_key],pg_catalog.to_jsonb((v_result->>v_key)::int+1));
    v_spent:=v_spent+1;
  end loop;
  return v_result;
end $$;
create or replace function domine_pet_v17.region_for_cell(p_cell text) returns text
language sql immutable set search_path='' as $$
  select 'R'||pg_catalog.lpad((case pg_catalog.left(p_cell,1)
    when 'A' then 5 when 'B' then 5 when 'C' then 2 when 'D' then 2
    when 'E' then 1 when 'F' then 1 when 'G' then 3 when 'H' then 3 else 4 end
    +case when pg_catalog.substr(p_cell,2)::int>5 then
      case when pg_catalog.left(p_cell,1) in ('C','D') then 4 when pg_catalog.left(p_cell,1) in ('E','F') then 6 else 5 end
      else 0 end)::text,2,'0');
$$;
create or replace function domine_pet_v17.pet_state(p_pet int) returns jsonb
language sql stable set search_path='' as $$
  select pg_catalog.jsonb_build_object('pet',p.pet_id,'xp',p.xp,'level',domine_pet_v17.level_for_xp(p.xp),
    'allocation',p.allocation,'unspent',3*(domine_pet_v17.level_for_xp(p.xp)-1)
      -(select pg_catalog.sum(e.value::int) from pg_catalog.jsonb_each_text(p.allocation) e),
    'allocationMode',p.allocation_mode,'job',p.job,'jobTier',p.job_tier,'jobChangedAt',p.job_changed_at,
    'moves',p.moves,'version',p.version,
    'mastery',coalesce((select pg_catalog.jsonb_object_agg(m.move_id,m.uses) from domine_pet_v17.mastery m where m.pet_id=p.pet_id),'{}'::jsonb),
    'inventory',coalesce((select pg_catalog.jsonb_object_agg(i.item_id,i.quantity) from domine_pet_v17.inventory i where i.pet_id=p.pet_id),'{}'::jsonb))
  from domine_pet_v17.pet_progress p where p.pet_id=p_pet;
$$;
create or replace function domine_pet_v17.ticket_json(p_ticket domine_pet_v17.battle_ticket) returns jsonb
language sql stable set search_path='' as $$
  select pg_catalog.jsonb_build_object('id',(p_ticket).id,'pet',(p_ticket).pet_id,'seed',(p_ticket).seed,
    'startedAt',(p_ticket).started_at,'expiresAt',(p_ticket).expires_at,'snapshot',(p_ticket).snapshot,'reserved',(p_ticket).reserved);
$$;
create or replace function domine_pet_v17.watching() returns jsonb
language sql stable set search_path='' as $$
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('ticket',t.id,'nickname',t.nickname,'pet',t.pet_id,
    'opponentName',t.opponent_name,'cell',t.cell,'startedAt',t.started_at) order by t.started_at,t.id),'[]'::jsonb)
  from domine_pet_v17.battle_ticket t where t.status='active' and t.started_at>pg_catalog.now()-interval '3 minutes';
$$;
create or replace function domine_pet_v17.spawns() returns jsonb
language sql stable set search_path='' as $$
  select pg_catalog.jsonb_build_object('slot',pg_catalog.floor(extract(epoch from pg_catalog.now())/1800)::bigint,
    'departed',coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('slot',d.slot,'cell',d.cell,'individualId',d.individual_id)
      order by d.cell,d.individual_id) from domine_pet_v17.departed d
      where d.slot=pg_catalog.floor(extract(epoch from pg_catalog.now())/1800)::bigint),'[]'::jsonb));
$$;
create or replace function domine_pet_v17.state(p_player uuid) returns jsonb
language sql stable set search_path='' as $$
  select domine_pet_v17.spawns()||pg_catalog.jsonb_build_object('coins',w.coins,'version',w.version,'features',c.features,
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
      and t.started_at>pg_catalog.now()-interval '30 minutes'),'[]'::jsonb))
  from domine_pet_v7.pool w cross join domine_pet_v17.config c where w.id=1 and c.id=1;
$$;

-- Caller holds player, wallet, then both pet rows. All returns are one-way ticket transitions.
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

create or replace function public.domine_pet_king_v17(
  p_nickname text,p_secret text,p_request_id uuid,p_kind text,p_input jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_player domine_pet_v6.player; v_wallet domine_pet_v7.pool; v_op domine_pet_v17.operation;
  v_progress domine_pet_v17.pet_progress; v_ticket domine_pet_v17.battle_ticket; v_raid domine_pet_v17.raid_cycle;
  v_config domine_pet_v17.config; v_hash bytea; v_data jsonb; v_result jsonb; v_before jsonb;
  v_code text:='OK'; v_pet int; v_item record; v_count int; v_total int;
  v_level int; v_new_level int; v_xp int:=0; v_coins bigint:=0; v_cost bigint:=0; v_scale numeric;
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
    if p_kind is null or p_kind not in ('state','start','finish','allocate','chooseJob','equipMoves','buyItem','spawns','watching','ranking')
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
      if v_count<1 then raise exception 'INVALID_INPUT'; end if;
      select i.price into v_price from domine_pet_v17.item_price i where i.item_id=p_input->>'item' and i.enabled;
      if not found then raise exception 'INVALID_ITEM'; end if;
      v_cost:=v_price::bigint*v_count;
      if v_wallet.coins<v_cost then raise exception 'INSUFFICIENT_COINS'; end if;
      update domine_pet_v7.pool set coins=coins-v_cost,version=version+1 where id=1;
      insert into domine_pet_v17.inventory as i(pet_id,item_id,quantity) values(v_pet,p_input->>'item',v_count)
        on conflict(pet_id,item_id) do update set quantity=i.quantity+excluded.quantity;
      update domine_pet_v17.pet_progress set version=version+1 where pet_id=v_pet;
      v_data:=domine_pet_v17.pet_state(v_pet);

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
      if (p_input->>'slot')::bigint<>v_slot then raise exception 'SPAWN_EXPIRED'; end if;
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
      if coalesce((v_config.features->>'encyclopedia')::boolean,false) then
        insert into domine_pet_v17.encounter_record as e(individual_id,name,encounters) values(v_individual,v_name,1)
          on conflict(individual_id) do update set encounters=e.encounters+1;
      end if;
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
        v_eligible:=v_ticket.mode='normal' and v_outcome<>'quit' and v_ticket.opponent_level>(v_ticket.snapshot->>'level')::int-4;
        if v_eligible then
          select s.multiplier into strict v_scale from domine_pet_v17.reward_scale s
            where s.min_level<=(v_ticket.snapshot->>'level')::int order by s.min_level desc limit 1;
          if coalesce((v_config.features->>'growth')::boolean,false) then
            v_xp:=pg_catalog.floor((case v_outcome when 'win' then 12+2*v_ticket.opponent_level when 'draw' then 6 else 4 end)*v_scale)::int;
          end if;
          if v_outcome='win' then v_coins:=least(6,2+(pg_catalog.substr(v_ticket.region,2)::int-1)/2); end if;
          if coalesce((v_config.features->>'mastery')::boolean,false) then
            for v_item in select e.key,e.value from pg_catalog.jsonb_each_text(v_moves) e loop
              insert into domine_pet_v17.mastery as m(pet_id,move_id,uses) values(v_pet,v_item.key,least(3,v_item.value::int))
                on conflict(pet_id,move_id) do update set uses=m.uses+excluded.uses;
            end loop;
          end if;
        end if;
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
              if v_drop is not null then
                insert into domine_pet_v17.inventory as i(pet_id,item_id,quantity) values(v_pet,v_drop,1)
                  on conflict(pet_id,item_id) do update set quantity=i.quantity+1;
              end if;
            end if;
          end if;
        end if;
        if coalesce((v_config.features->>'encyclopedia')::boolean,false) then
          update domine_pet_v17.encounter_record e set wins=e.wins+case when v_outcome='win' then 1 else 0 end,
            losses=e.losses+case when v_outcome='lose' then 1 else 0 end,
            weaknesses=(select coalesce(pg_catalog.jsonb_agg(s.tag order by s.tag),'[]'::jsonb) from
              (select distinct x.value as tag from pg_catalog.jsonb_array_elements_text(e.weaknesses||v_weak) x) s),
            resistances=(select coalesce(pg_catalog.jsonb_agg(s.tag order by s.tag),'[]'::jsonb) from
              (select distinct x.value as tag from pg_catalog.jsonb_array_elements_text(e.resistances||v_resist) x) s)
          where e.individual_id=v_ticket.individual_id;
        end if;
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
          if v_amount>0 and v_raid.completed_at is null and v_raid.progress+v_amount=v_raid.target then
            v_coins:=40+10*pg_catalog.substr(v_ticket.region,2)::int;
          end if;
        end if;
        v_new_level:=domine_pet_v17.level_for_xp(v_progress.xp+v_xp);
        v_new_allocation:=case when v_progress.allocation_mode='auto'
          then domine_pet_v17.auto_allocate(v_pet,v_new_level,v_progress.allocation) else v_progress.allocation end;
        update domine_pet_v17.pet_progress set xp=xp+v_xp,allocation=v_new_allocation,version=version+1 where pet_id=v_pet;
        update domine_pet_v7.pool set coins=coins+v_coins,version=version+1 where id=1;
        if v_new_level>v_level then
          insert into domine_pet_v17.change_history(player_id,pet_id,kind,before_state,after_state)
            values(v_player.id,v_pet,'levelup',v_before,domine_pet_v17.pet_state(v_pet));
          perform domine_pet_v10.log_v10(v_player.nickname,v_pet,'levelup',v_new_level::text);
        end if;
        perform domine_pet_v10.log_v10(v_player.nickname,v_pet,'battle',v_ticket.opponent_name||' - '||v_outcome);
        v_data:=pg_catalog.jsonb_build_object('ticket',v_ticket.id,'outcome',v_outcome,'xp',v_xp,'coins',v_coins,
          'levelBefore',v_level,'levelAfter',v_new_level,'eligible',v_eligible,'contribution',v_amount,'drop',v_drop);
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
  select '{"version":6,"sharedEconomy":true,"explorationThemes":24,"v9":true,"v10":true,"perPetShop":true,"history":true,"busyLock":true,"king":true}'::jsonb
    ||pg_catalog.jsonb_build_object('kingFeatures',c.features) from domine_pet_v17.config c where c.id=1;
$$;

do $$ declare v_table record; begin
  for v_table in select t.tablename from pg_catalog.pg_tables t where t.schemaname='domine_pet_v17' loop
    execute pg_catalog.format('alter table domine_pet_v17.%I enable row level security',v_table.tablename);
  end loop;
end $$;
revoke all on all tables in schema domine_pet_v17 from public,anon,authenticated;
revoke all on all sequences in schema domine_pet_v17 from public,anon,authenticated;
revoke all on all functions in schema domine_pet_v17 from public,anon,authenticated;
revoke all on function public.domine_pet_king_v17(text,text,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.domine_pet_king_v17(text,text,uuid,text,jsonb) to anon,authenticated;
revoke all on function public.domine_pet_capabilities_v6() from public,anon,authenticated;
grant execute on function public.domine_pet_capabilities_v6() to anon,authenticated;
notify pgrst,'reload schema';
commit;
