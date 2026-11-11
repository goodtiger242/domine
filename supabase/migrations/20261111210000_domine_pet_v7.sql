-- Apply after v6; public RPC names and existing response fields stay compatible.
begin;

-- Match the v6 action lock order before freezing the migration source tables.
select pg_catalog.pg_advisory_xact_lock(20261111,120000);
lock table domine_pet_v6.player, domine_pet_v6.inventory, domine_pet_v6.equipment,
  domine_pet_v6.daily, domine_pet_v6.operation in access exclusive mode;
create schema if not exists domine_pet_v7;
revoke all on schema domine_pet_v7 from public,anon,authenticated;

-- A singleton pool avoids a fake login and gives all shared spending/rewards one lock.
create table if not exists domine_pet_v7.pool (
  id int primary key check (id=1),
  xp int not null default 0 check (xp between 0 and 9280),
  coins bigint not null default 0 check (coins>=0), version bigint not null default 0
);
create table if not exists domine_pet_v7.inventory (
  item_id text primary key references domine_pet_v6.catalog(id),
  purchased_at timestamptz not null default now()
);
create table if not exists domine_pet_v7.equipment (
  pet_id int check (pet_id in (1,2)), slot text check (slot in ('wearable','toy')),
  item_id text references domine_pet_v7.inventory(item_id), primary key(pet_id,slot)
);
-- Keep personal limits in a new table so the v6 CHECK (<=40) need not be dropped.
create table if not exists domine_pet_v7.daily (
  player_id uuid references domine_pet_v6.player(id), kst_date date,
  reward_actions int not null default 0 check (reward_actions between 0 and 120),
  explore_starts int not null default 0 check (explore_starts between 0 and 60),
  explore_finishes int not null default 0 check (explore_finishes between 0 and 30),
  walk_claims int not null default 0 check (walk_claims between 0 and 4), primary key(player_id,kst_date)
);

do $$ begin
  -- The pool row is the one-time migration marker; all copies commit together.
  -- Sum existing balances, retaining the v6 Lv.30 XP cap; no retroactive level bonus.
  insert into domine_pet_v7.pool(id,xp,coins,version)
    select 1,least(9280,coalesce(sum(xp),0))::int,coalesce(sum(coins),0),coalesce(max(version),0)+1
    from domine_pet_v6.player
    on conflict(id) do nothing;
  if found then
    insert into domine_pet_v7.inventory(item_id,purchased_at)
      select item_id,min(purchased_at) from domine_pet_v6.inventory group by item_id;
    -- Match the original equip payload hash, including NULL unequips, to date each slot.
    -- shortcut: manually inserted equipment has no operation time; use purchase/creation time until timestamped.
    insert into domine_pet_v7.equipment(pet_id,slot,item_id)
      select distinct on (e.pet_id,e.slot) e.pet_id,e.slot,e.item_id
      from domine_pet_v6.equipment e
      join domine_pet_v6.player p on p.id=e.player_id
      left join domine_pet_v6.inventory i on i.player_id=e.player_id and i.item_id=e.item_id
      left join lateral (
        select max(o.created_at) as changed_at from domine_pet_v6.operation o
        where o.player_id=e.player_id and o.kind='equip' and o.result->>'code'='OK'
          and o.payload_hash=extensions.digest(jsonb_build_object('pet',e.pet_id,'slot',e.slot,'item',e.item_id)::text,'sha256')
      ) latest on true
      order by e.pet_id,e.slot,coalesce(latest.changed_at,i.purchased_at,p.created_at) desc,e.player_id;
    insert into domine_pet_v7.daily select * from domine_pet_v6.daily;
  end if;
end $$;

create or replace function domine_pet_v6.snapshot_v6(p_player uuid,p_pet int) returns jsonb
language sql stable set search_path='' as $$
  select domine_pet_v6.result_v6('OK') || jsonb_build_object(
    'version',g.version,'player',jsonb_build_object('xp',g.xp,'coins',g.coins,'level',domine_pet_v6.level_v6(g.xp)),
    'inventory',coalesce((select jsonb_agg(item_id order by item_id) from domine_pet_v7.inventory),'[]'::jsonb),
    'equipment',coalesce((select jsonb_agg(jsonb_build_object('pet_id',pet_id,'slot',slot,'item_id',item_id)) from domine_pet_v7.equipment),'[]'::jsonb),
    'album',coalesce((select jsonb_agg(entry_id order by entry_id) from domine_pet_v6.album where player_id=p.id),'[]'::jsonb),
    'badges',coalesce((select jsonb_agg(achievement_id order by achievement_id) from domine_pet_v6.achievement where player_id=p.id),'[]'::jsonb),
    'daily',coalesce((select jsonb_build_object('reward_actions',reward_actions,'explore_finishes',explore_finishes,'walk_claims',walk_claims) from domine_pet_v7.daily where player_id=p.id and kst_date=(now() at time zone 'Asia/Seoul')::date),'{"reward_actions":0,"explore_finishes":0,"walk_claims":0}'::jsonb),
    'ticket',(select jsonb_build_object('id',id,'map_id',map_id,'eligible_at',eligible_at,'expires_at',expires_at) from domine_pet_v6.exploration where player_id=p.id and finished_at is null and cancelled_at is null and expires_at>now()),
    'season',domine_pet_v6.season_for_date_v6((now() at time zone 'Asia/Seoul')::date),
    'shared',case when p_pet in (1,2) then jsonb_build_object('applied',false,'reason',null,'pet',public.domine_pet_state_for(p_pet,p.nickname)) else null end
  ) from domine_pet_v6.player p cross join domine_pet_v7.pool g where p.id=p_player and g.id=1;
$$;

create or replace function domine_pet_v6.badges_v6(p_player uuid) returns jsonb
language plpgsql set search_path='' as $$
declare flags boolean[]; n int; core_count int; fresh jsonb;
begin
  select count(*) into core_count from domine_pet_v6.album a join domine_pet_v6.catalog c on c.id=a.entry_id where a.player_id=p_player and c.core;
  flags:=array[
    domine_pet_v6.count_v6(p_player,'action_total')>=1, domine_pet_v6.count_v6(p_player,'action_total')>=10,
    domine_pet_v6.count_v6(p_player,'action_total')>=50, domine_pet_v6.count_v6(p_player,'action_total')>=200,
    domine_pet_v6.count_v6(p_player,'pet:1')>=10, domine_pet_v6.count_v6(p_player,'pet:2')>=10,
    least(domine_pet_v6.count_v6(p_player,'pet:1'),domine_pet_v6.count_v6(p_player,'pet:2'))>=20,
    domine_pet_v6.count_v6(p_player,'action:feed')>=10, domine_pet_v6.count_v6(p_player,'action:treat')>=10,
    domine_pet_v6.count_v6(p_player,'action:pet')>=20, domine_pet_v6.count_v6(p_player,'action:brush')>=10,
    domine_pet_v6.count_v6(p_player,'action:bath')>=5, domine_pet_v6.count_v6(p_player,'action:play')>=10,
    domine_pet_v6.count_v6(p_player,'action:train')>=10, domine_pet_v6.count_v6(p_player,'action:walk')>=10,
    (select count(*)=8 from domine_pet_v6.counter where player_id=p_player and metric like 'action:%' and value>=1),
    (select count(*)>=5 from domine_pet_v6.counter where player_id=p_player and metric like 'explore_map:%' and value>=1),
    domine_pet_v6.count_v6(p_player,'explore_total')>=10, domine_pet_v6.count_v6(p_player,'explore_total')>=50,
    domine_pet_v6.count_v6(p_player,'explore_map:church')>=10, domine_pet_v6.count_v6(p_player,'explore_map:street')>=10,
    least(domine_pet_v6.count_v6(p_player,'explore_map:field'),domine_pet_v6.count_v6(p_player,'explore_map:park'),domine_pet_v6.count_v6(p_player,'explore_map:home'))>=5,
    domine_pet_v6.count_v6(p_player,'explore_time:night')>=5,
    core_count>=10,core_count>=30,core_count>=60,domine_pet_v6.count_v6(p_player,'purchase_total')>=1,
    (select count(*)>=3 from domine_pet_v6.counter where player_id=p_player and metric like 'equipped_item:%' and value>=1),
    (select count(*)>=3 from domine_pet_v7.inventory i join domine_pet_v6.catalog c on c.id=i.item_id where c.slot='toy'),
    (select xp=9280 from domine_pet_v7.pool where id=1)
  ];
  with added as (
    insert into domine_pet_v6.achievement(player_id,achievement_id)
    select p_player,'A'||lpad(g::text,2,'0') from generate_series(1,30) g where flags[g]
    on conflict do nothing returning achievement_id
  ) select coalesce(jsonb_agg(achievement_id),'[]'::jsonb) into fresh from added;
  return fresh;
end $$;

-- Only the typed public wrappers may call this dispatcher; callers never supply reward values.
create or replace function domine_pet_v6.command_v6(p_nickname text,p_secret text,p_request_id uuid,p_kind text,p_input jsonb) returns jsonb
language plpgsql set search_path='' as $$
#variable_conflict use_column
declare
  p domine_pet_v6.player; wallet domine_pet_v7.pool; op domine_pet_v6.operation; item domine_pet_v6.catalog;
  ticket domine_pet_v6.exploration; session domine_pet_v6.walk_session; day domine_pet_v7.daily;
  payload bytea; result jsonb; shared jsonb; extra jsonb:='{}'; code text:='OK';
  today date:=(now() at time zone 'Asia/Seoul')::date; band text; season text;
  pet int; action text; map text; entry text; slot text;
  xp_gain int:=0; coin_gain int:=0; level_coins int:=0; old_level int; new_level int;
  new_entries jsonb:='[]'; new_badges jsonb:='[]'; existed boolean; can_find boolean; pity boolean;
  rarity text; roll float; skipped text; last_time timestamptz; new_id uuid;
begin
  if not domine_pet_v6.valid_identity_v6(p_nickname,p_secret) or p_request_id is null or p_input is null
     or p_kind is null or p_kind not in ('action','purchase','equip','explore_begin','explore_finish','record_season','walk_begin','walk_claim','walk_end') then
    return domine_pet_v6.result_v6('INVALID_INPUT');
  end if;
  if p_kind='action' then perform pg_catalog.pg_advisory_xact_lock(20261111,120000); end if;
  select * into p from domine_pet_v6.player where nickname_key=lower(normalize(btrim(p_nickname),NFC)) for update;
  if not found or p.secret_hash<>extensions.digest(p_secret,'sha256') then return domine_pet_v6.result_v6('AUTH_FAILED'); end if;
  payload:=extensions.digest(p_input::text,'sha256');
  select * into op from domine_pet_v6.operation where player_id=p.id and request_id=p_request_id;
  if found then
    if op.kind<>p_kind or op.payload_hash<>payload then return domine_pet_v6.result_v6('REQUEST_CONFLICT'); end if;
    if not domine_pet_v6.rate_v6('query:'||p.id,date_trunc('minute',now()),12) then return domine_pet_v6.result_v6('RATE_LIMITED'); end if;
    -- Frozen personal versions identify pre-pool cached results; do not replay their private balances.
    if op.created_at<now()-interval '30 days' or (op.result->>'version')::bigint<=p.version then return domine_pet_v6.snapshot_v6(p.id,1)||domine_pet_v6.result_v6('ALREADY_APPLIED')||jsonb_build_object('requestId',p_request_id); end if;
    return op.result;
  end if;
  pet:=(p_input->>'pet')::int; action:=p_input->>'action'; map:=p_input->>'map'; entry:=p_input->>'item'; slot:=p_input->>'slot';
  if (p_kind in ('action','equip') and (pet is null or pet not in (1,2)))
     or (p_kind='action' and (action is null or action not in ('feed','treat','pet','play','walk','brush','bath','train')))
     or (p_kind='purchase' and (entry is null or entry !~ '^0(6[1-9]|7[0-9]|80)$'))
     or (p_kind='equip' and (slot is null or slot not in ('wearable','toy') or (entry is not null and entry !~ '^0(6[1-9]|7[0-9]|80)$')))
     or (p_kind='explore_begin' and (map is null or map not in ('church','field','street','park','home','playground','stream','churchback','alley','market','station','mountain','lake','school','foodstreet','cafestreet','bakery','apartment','bikepath','overlook','garden','bridge','pilgrimpath','farm') or p_input->>'source' is null or p_input->>'source' not in ('map','walk')))
     or (p_kind='explore_finish' and p_input->>'ticket' is null)
     or (p_kind in ('walk_claim','walk_end') and p_input->>'session' is null)
     or (p_kind='record_season' and (p_input->>'entry' is null or p_input->>'entry' !~ '^0(8[1-9]|9[0-2])$')) then
    return domine_pet_v6.result_v6('INVALID_INPUT');
  end if;
  if not domine_pet_v6.rate_v6('change:'||p.id,date_trunc('minute',now()),30)
     or not domine_pet_v6.rate_v6('change:global',date_trunc('minute',now()),300) then
    return domine_pet_v6.result_v6('RATE_LIMITED')||jsonb_build_object('retryAfterSeconds',60);
  end if;
  -- Always lock player first, then pool; check balances and award level coins under this lock.
  select * into strict wallet from domine_pet_v7.pool where id=1 for update;
  insert into domine_pet_v7.daily(player_id,kst_date) values(p.id,today) on conflict do nothing;
  select * into day from domine_pet_v7.daily where player_id=p.id and kst_date=today;
  old_level:=domine_pet_v6.level_v6(wallet.xp);

  if p_kind='action' then
    -- There is no personal submission cooldown. Shared v5 limits never gate visual play or personal eligibility.
    shared:=public.domine_pet_care_for(pet,p.nickname,action);
    if day.reward_actions>=120 then skipped:='DAILY_CAP';
    elsif exists(select 1 from domine_pet_v6.action_clock where player_id=p.id and action='all' and last_reward_at>now()-interval '3 seconds') then skipped:='TOO_FAST';
    end if;
    if skipped is null then
      select x,c into xp_gain,coin_gain from (values ('feed',8,4),('treat',6,3),('pet',5,2),('play',10,5),('walk',10,6),('brush',8,4),('bath',10,5),('train',10,5)) r(a,x,c) where r.a=action;
      insert into domine_pet_v6.action_clock(player_id,action,last_reward_at,last_submit_at) values(p.id,action,now(),now()),(p.id,'all',now(),now())
        on conflict(player_id,action) do update set last_reward_at=excluded.last_reward_at,last_submit_at=excluded.last_submit_at;
      update domine_pet_v7.daily set reward_actions=reward_actions+1 where player_id=p.id and kst_date=today;
      perform domine_pet_v6.increment_v6(p.id,'action_total');
      perform domine_pet_v6.increment_v6(p.id,'action:'||action);
      perform domine_pet_v6.increment_v6(p.id,'pet:'||pet);
    end if;
    extra:=jsonb_build_object('shared',jsonb_build_object('applied',coalesce((shared->>'ok')::boolean,false),'reason',shared->>'message','pet',public.domine_pet_state_for(pet,p.nickname)));
  elsif p_kind='purchase' then
    select * into item from domine_pet_v6.catalog where id=entry and acquisition='shop';
    if not found then code:='INVALID_INPUT';
    elsif exists(select 1 from domine_pet_v7.inventory where item_id=entry) then code:='ALREADY_OWNED';
    elsif wallet.coins<item.price then code:='INSUFFICIENT_COINS';
    else
      update domine_pet_v7.pool set coins=coins-item.price where id=1;
      insert into domine_pet_v7.inventory(item_id) values(entry);
      insert into domine_pet_v6.album(player_id,entry_id) values(p.id,entry) on conflict do nothing;
      new_entries:=jsonb_build_array(entry);
      perform domine_pet_v6.increment_v6(p.id,'purchase_total');
    end if;
  elsif p_kind='equip' then
    if entry is not null and not exists(select 1 from domine_pet_v7.inventory i join domine_pet_v6.catalog c on c.id=i.item_id where i.item_id=entry and c.slot=command_v6.slot) then code:='NOT_OWNED';
    else
      insert into domine_pet_v7.equipment(pet_id,slot,item_id) values(pet,slot,entry)
        on conflict(pet_id,slot) do update set item_id=excluded.item_id;
      if entry is not null and slot='wearable' then perform domine_pet_v6.increment_v6(p.id,'equipped_item:'||entry); end if;
    end if;
  elsif p_kind='explore_begin' then
    -- A move always cancels the old map's ticket, even when the new reward ticket is rate limited.
    update domine_pet_v6.exploration set cancelled_at=now() where player_id=p.id and finished_at is null and cancelled_at is null;
    select max(started_at) into last_time from domine_pet_v6.exploration where player_id=p.id;
    if day.explore_starts>=60 or last_time>now()-interval '30 seconds' then code:='RATE_LIMITED';
    else
      insert into domine_pet_v6.exploration(player_id,map_id,source,eligible_at,expires_at) values(p.id,map,p_input->>'source',now()+interval '15 seconds',now()+interval '10 minutes') returning id into new_id;
      update domine_pet_v7.daily set explore_starts=explore_starts+1 where player_id=p.id and kst_date=today;
    end if;
  elsif p_kind='explore_finish' then
    select * into ticket from domine_pet_v6.exploration where id=(p_input->>'ticket')::uuid and player_id=p.id for update;
    if not found then code:='INVALID_INPUT';
    elsif ticket.finished_at is not null then
      result:=ticket.result;
      if (result->>'version')::bigint<=p.version then
        result:=domine_pet_v6.snapshot_v6(p.id,1)||domine_pet_v6.result_v6('ALREADY_APPLIED')||jsonb_build_object('requestId',p_request_id);
      end if;
      insert into domine_pet_v6.operation(player_id,request_id,kind,payload_hash,result) values(p.id,p_request_id,p_kind,payload,result);
      return result;
    elsif ticket.cancelled_at is not null or now()>=ticket.expires_at then code:='EXPIRED';
    elsif now()<ticket.eligible_at then code:='TOO_EARLY'; extra:=jsonb_build_object('retryAfterSeconds',ceil(extract(epoch from ticket.eligible_at-now())));
    else
      if day.explore_finishes<30 then
        xp_gain:=4; coin_gain:=2;
        band:=case when extract(hour from now() at time zone 'Asia/Seoul') between 5 and 6 then 'dawn' when extract(hour from now() at time zone 'Asia/Seoul') between 7 and 16 then 'day' when extract(hour from now() at time zone 'Asia/Seoul') between 17 and 20 then 'dusk' else 'night' end;
        select exists(select 1 from domine_pet_v6.catalog c where c.acquisition='explore' and ticket.map_id=any(c.maps) and band=any(c.time_bands) and not exists(select 1 from domine_pet_v6.album a where a.player_id=p.id and a.entry_id=c.id)) into can_find;
        pity:=can_find and p.discovery_misses>=4;
        if pity then
          -- Exponential race over rarity groups preserves 65:25:8:2 after filtering missing groups.
          select r.rarity into rarity from (
            select distinct c.rarity from domine_pet_v6.catalog c where c.acquisition='explore' and ticket.map_id=any(c.maps) and band=any(c.time_bands) and not exists(select 1 from domine_pet_v6.album a where a.player_id=p.id and a.entry_id=c.id)
          ) r order by -ln(greatest(random(),0.000000001))/(case r.rarity when '일반' then 65 when '특별' then 25 when '희귀' then 8 else 2 end) limit 1;
        elsif random()<0.75 then
          roll:=random(); rarity:=case when roll<.65 then '일반' when roll<.90 then '특별' when roll<.98 then '희귀' else '아주 드묾' end;
          if not exists(select 1 from domine_pet_v6.catalog c where c.acquisition='explore' and ticket.map_id=any(c.maps) and band=any(c.time_bands) and c.rarity=command_v6.rarity) then rarity:='일반'; end if;
        end if;
        if rarity is not null then
          select c.id into entry from domine_pet_v6.catalog c where c.acquisition='explore' and ticket.map_id=any(c.maps) and band=any(c.time_bands) and c.rarity=command_v6.rarity
            and (not pity or not exists(select 1 from domine_pet_v6.album a where a.player_id=p.id and a.entry_id=c.id)) order by random() limit 1;
        end if;
        if entry is not null then
          select exists(select 1 from domine_pet_v6.album where player_id=p.id and entry_id=entry) into existed;
          insert into domine_pet_v6.album as a(player_id,entry_id) values(p.id,entry) on conflict(player_id,entry_id) do update set find_count=a.find_count+1;
          if existed then coin_gain:=coin_gain+1; else new_entries:=jsonb_build_array(entry); end if;
        end if;
        update domine_pet_v6.player set discovery_misses=case when jsonb_array_length(new_entries)>0 then 0 when can_find then least(4,discovery_misses+1) else discovery_misses end where id=p.id;
        update domine_pet_v7.daily set explore_finishes=explore_finishes+1 where player_id=p.id and kst_date=today;
        perform domine_pet_v6.increment_v6(p.id,'explore_total');
        perform domine_pet_v6.increment_v6(p.id,'explore_map:'||ticket.map_id);
        perform domine_pet_v6.increment_v6(p.id,'explore_time:'||band);
      end if;
      update domine_pet_v6.exploration set finished_at=now() where id=ticket.id;
    end if;
  elsif p_kind='record_season' then
    entry:=p_input->>'entry'; season:=domine_pet_v6.season_for_date_v6(today);
    if not exists(select 1 from domine_pet_v6.catalog where id=entry and acquisition='season' and season=any(seasons)) then code:='INVALID_INPUT';
    else
      insert into domine_pet_v6.album(player_id,entry_id) values(p.id,entry) on conflict do nothing;
      if found then new_entries:=jsonb_build_array(entry); end if;
    end if;
  elsif p_kind='walk_begin' then
    update domine_pet_v6.walk_session set closed_at=now() where player_id=p.id and closed_at is null;
    insert into domine_pet_v6.walk_session(player_id,expires_at) values(p.id,now()+interval '30 minutes') returning id into new_id;
    extra:=jsonb_build_object('session',jsonb_build_object('id',new_id,'expires_at',now()+interval '30 minutes'));
  else
    select * into session from domine_pet_v6.walk_session where id=(p_input->>'session')::uuid and player_id=p.id for update;
    if not found then code:='INVALID_INPUT';
    elsif p_kind='walk_end' then update domine_pet_v6.walk_session set closed_at=coalesce(closed_at,now()) where id=session.id;
    elsif session.closed_at is not null or now()>=session.expires_at then code:='EXPIRED';
    elsif now()<session.last_claim_at+interval '150 seconds' then code:='TOO_EARLY';
    elsif day.walk_claims>=4 then code:='RATE_LIMITED';
    else
      xp_gain:=8; coin_gain:=4;
      update domine_pet_v6.walk_session set claims=claims+1,last_claim_at=now() where id=session.id;
      update domine_pet_v7.daily set walk_claims=walk_claims+1 where player_id=p.id and kst_date=today;
    end if;
  end if;

  new_level:=domine_pet_v6.level_v6(least(9280,wallet.xp+xp_gain));
  select coalesce(sum(10+2*g),0)::int into level_coins from generate_series(old_level+1,new_level) g;
  xp_gain:=least(9280-wallet.xp,xp_gain);
  update domine_pet_v7.pool set xp=xp+xp_gain,coins=coins+coin_gain+level_coins,version=version+1 where id=1;
  new_badges:=domine_pet_v6.badges_v6(p.id);
  result:=domine_pet_v6.snapshot_v6(p.id,coalesce(pet,1))||domine_pet_v6.result_v6(code)||extra||jsonb_build_object(
    'requestId',p_request_id,'reward',jsonb_build_object('xp',xp_gain,'coins',coin_gain,'levelCoins',level_coins,'newEntries',new_entries,'newBadges',new_badges)
      ||case when skipped is null then '{}'::jsonb else jsonb_build_object('skipped',skipped) end);
  if p_kind='explore_finish' and code='OK' then update domine_pet_v6.exploration set result=command_v6.result where id=ticket.id; end if;
  insert into domine_pet_v6.operation(player_id,request_id,kind,payload_hash,result) values(p.id,p_request_id,p_kind,payload,result);
  return result;
end $$;

create or replace function public.domine_pet_operation_v6(p_nickname text,p_secret text,p_request_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare p domine_pet_v6.player; op domine_pet_v6.operation;
begin
  if not domine_pet_v6.valid_identity_v6(p_nickname,p_secret) or p_request_id is null then return domine_pet_v6.result_v6('INVALID_INPUT'); end if;
  select * into p from domine_pet_v6.player where nickname_key=lower(normalize(btrim(p_nickname),NFC)) for update;
  if not found or p.secret_hash<>extensions.digest(p_secret,'sha256') then return domine_pet_v6.result_v6('AUTH_FAILED'); end if;
  if not domine_pet_v6.rate_v6('query:'||p.id,date_trunc('minute',now()),12) then return domine_pet_v6.result_v6('RATE_LIMITED'); end if;
  select * into op from domine_pet_v6.operation where player_id=p.id and request_id=p_request_id;
  if not found then return domine_pet_v6.result_v6('NOT_FOUND'); end if;
  if op.created_at<now()-interval '30 days' or (op.result->>'version')::bigint<=p.version then return domine_pet_v6.snapshot_v6(p.id,1)||domine_pet_v6.result_v6('ALREADY_APPLIED')||jsonb_build_object('requestId',p_request_id); end if;
  return op.result;
end $$;

alter table domine_pet_v7.pool enable row level security;
alter table domine_pet_v7.inventory enable row level security;
alter table domine_pet_v7.equipment enable row level security;
alter table domine_pet_v7.daily enable row level security;
revoke all on all tables in schema domine_pet_v7 from public,anon,authenticated;
revoke all on all sequences in schema domine_pet_v7 from public,anon,authenticated;
revoke all on all functions in schema domine_pet_v7 from public,anon,authenticated;
revoke all on all tables in schema domine_pet_v6 from public,anon,authenticated;
revoke all on all sequences in schema domine_pet_v6 from public,anon,authenticated;
revoke all on all functions in schema domine_pet_v6 from public,anon,authenticated;
revoke all on function public.domine_pet_capabilities_v6() from public,anon,authenticated;
grant execute on function public.domine_pet_capabilities_v6() to anon,authenticated;
revoke all on function public.domine_pet_register_v6(text,text) from public,anon,authenticated;
grant execute on function public.domine_pet_register_v6(text,text) to anon,authenticated;
revoke all on function public.domine_pet_state_v6(text,text,int) from public,anon,authenticated;
grant execute on function public.domine_pet_state_v6(text,text,int) to anon,authenticated;
revoke all on function public.domine_pet_operation_v6(text,text,uuid) from public,anon,authenticated;
grant execute on function public.domine_pet_operation_v6(text,text,uuid) to anon,authenticated;
revoke all on function public.domine_pet_action_v6(text,text,uuid,int,text) from public,anon,authenticated;
grant execute on function public.domine_pet_action_v6(text,text,uuid,int,text) to anon,authenticated;
revoke all on function public.domine_pet_purchase_v6(text,text,uuid,text) from public,anon,authenticated;
grant execute on function public.domine_pet_purchase_v6(text,text,uuid,text) to anon,authenticated;
revoke all on function public.domine_pet_equip_v6(text,text,uuid,int,text,text) from public,anon,authenticated;
grant execute on function public.domine_pet_equip_v6(text,text,uuid,int,text,text) to anon,authenticated;
revoke all on function public.domine_pet_explore_begin_v6(text,text,uuid,text,text) from public,anon,authenticated;
grant execute on function public.domine_pet_explore_begin_v6(text,text,uuid,text,text) to anon,authenticated;
revoke all on function public.domine_pet_explore_finish_v6(text,text,uuid,uuid) from public,anon,authenticated;
grant execute on function public.domine_pet_explore_finish_v6(text,text,uuid,uuid) to anon,authenticated;
revoke all on function public.domine_pet_record_season_v6(text,text,uuid,text) from public,anon,authenticated;
grant execute on function public.domine_pet_record_season_v6(text,text,uuid,text) to anon,authenticated;
revoke all on function public.domine_pet_walk_begin_v6(text,text,uuid) from public,anon,authenticated;
grant execute on function public.domine_pet_walk_begin_v6(text,text,uuid) to anon,authenticated;
revoke all on function public.domine_pet_walk_claim_v6(text,text,uuid,uuid) from public,anon,authenticated;
grant execute on function public.domine_pet_walk_claim_v6(text,text,uuid,uuid) to anon,authenticated;
revoke all on function public.domine_pet_walk_end_v6(text,text,uuid,uuid) from public,anon,authenticated;
grant execute on function public.domine_pet_walk_end_v6(text,text,uuid,uuid) to anon,authenticated;
notify pgrst,'reload schema';
commit;

