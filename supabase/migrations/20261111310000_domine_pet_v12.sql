-- 친구끼리 쓰는 게임이라 도배 방지 한도를 풀고, 보상 간격·하루 보상 횟수 제한도 없앤다.
-- 기능마다 연출이 끝날 때까지 다른 기능이 막히므로 연타는 자연스럽게 제한된다.
begin;
create or replace function domine_pet_v6.rate_v6(p_key text,p_window timestamptz,p_limit int) returns boolean
language sql set search_path='' as $$ select true $$;
revoke all on function domine_pet_v6.rate_v6(text,timestamptz,int) from public,anon,authenticated;

do $$ declare r record; begin
  for r in select conname from pg_catalog.pg_constraint
    where contype='c' and conrelid='domine_pet_v7.daily'::regclass and pg_catalog.pg_get_constraintdef(oid) like '%reward_actions%'
  loop execute pg_catalog.format('alter table domine_pet_v7.daily drop constraint %I',r.conname); end loop;
  alter table domine_pet_v7.daily add constraint daily_reward_actions_open check (reward_actions between 0 and 1000000);
end $$;

create or replace function domine_pet_v6.command_v6(p_nickname text,p_secret text,p_request_id uuid,p_kind text,p_input jsonb) returns jsonb
language plpgsql set search_path='' as $$
#variable_conflict use_column
<<cmd>>
declare
  p domine_pet_v6.player; wallet domine_pet_v7.pool; op domine_pet_v6.operation; item domine_pet_v6.catalog;
  ticket domine_pet_v6.exploration; session domine_pet_v6.walk_session; day domine_pet_v7.daily;
  payload bytea; result jsonb; shared jsonb; extra jsonb:='{}'; code text:='OK';
  today date:=(now() at time zone 'Asia/Seoul')::date; band text; season text;
  pet int; pet_xp int; action text; map text; entry text; slot text;
  xp_gain int:=0; coin_gain int:=0; level_coins int:=0; old_level int; new_level int;
  new_entries jsonb:='[]'; new_badges jsonb:='[]'; existed boolean; can_find boolean; pity boolean;
  rarity text; roll float; skipped text; retry_seconds int; last_time timestamptz; new_id uuid;
begin
  if not domine_pet_v6.valid_identity_v6(p_nickname,p_secret) or p_request_id is null or p_input is null
     or p_kind is null or p_kind not in ('action','purchase','equip','explore_begin','explore_finish','record_season','walk_begin','walk_claim','walk_end') then
    return domine_pet_v6.result_v6('INVALID_INPUT');
  end if;
  if (p_input ? 'pet' and coalesce(p_input->>'pet','') not in ('1','2'))
     or (p_kind in ('action','equip') and not p_input ? 'pet') then
    return domine_pet_v6.result_v6('INVALID_INPUT');
  end if;
  pet:=coalesce((p_input->>'pet')::int,1);
  if p_kind='action' then perform pg_catalog.pg_advisory_xact_lock(20261111,120000); end if;
  select * into p from domine_pet_v6.player where nickname_key=lower(normalize(btrim(p_nickname),NFC)) for update;
  if not found or p.secret_hash<>extensions.digest(p_secret,'sha256') then return domine_pet_v6.result_v6('AUTH_FAILED'); end if;
  -- Serialize all economy, counters and history writes behind the shared wallet.
  select * into strict wallet from domine_pet_v7.pool where id=1 for update;
  payload:=extensions.digest(p_input::text,'sha256');
  select * into op from domine_pet_v6.operation where player_id=p.id and request_id=p_request_id;
  if found then
    if op.kind<>p_kind or op.payload_hash<>payload then return domine_pet_v6.result_v6('REQUEST_CONFLICT'); end if;
    if not domine_pet_v6.rate_v6('query:'||p.id,date_trunc('minute',now()),12) then return domine_pet_v6.result_v6('RATE_LIMITED'); end if;
    -- Frozen personal versions identify pre-pool cached results; do not replay their private balances.
    if op.created_at<now()-interval '30 days' or not op.result ? 'levels' or (op.result->>'version')::bigint<=p.version then return domine_pet_v6.snapshot_v6(p.id,pet)||domine_pet_v6.result_v6('ALREADY_APPLIED')||jsonb_build_object('requestId',p_request_id); end if;
    return op.result;
  end if;
  action:=p_input->>'action'; map:=p_input->>'map'; entry:=p_input->>'item'; slot:=p_input->>'slot';
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
  insert into domine_pet_v7.daily(player_id,kst_date) values(p.id,today) on conflict do nothing;
  select * into day from domine_pet_v7.daily where player_id=p.id and kst_date=today;
  select xp into strict pet_xp from domine_pet_v10.pet_xp where pet_id=pet;
  old_level:=domine_pet_v6.level_v6(pet_xp);

  if p_kind='action' then
    -- There is no personal submission cooldown. Shared v5 limits never gate visual play or personal eligibility.
    shared:=public.domine_pet_care_for(pet,p.nickname,action);
    select last_reward_at into last_time from domine_pet_v6.action_clock where player_id=p.id and action='all';
    if day.reward_actions>=1000000 then skipped:='DAILY_CAP';
    elsif last_time>now()-interval '0 seconds' then
      skipped:='TOO_FAST'; retry_seconds:=ceil(extract(epoch from last_time+interval '0 seconds'-now()));
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
    perform domine_pet_v10.log_v10(p.nickname,pet,'action',action);
    extra:=jsonb_build_object('shared',jsonb_build_object('applied',coalesce((shared->>'ok')::boolean,false),'reason',shared->>'message','pet',public.domine_pet_state_for(pet,p.nickname)));
  elsif p_kind='purchase' then
    select * into item from domine_pet_v6.catalog where id=entry and acquisition='shop';
    if not found then code:='INVALID_INPUT';
    elsif exists(select 1 from domine_pet_v10.inventory where pet_id=pet and item_id=entry) then code:='ALREADY_OWNED';
    elsif wallet.coins<item.price then code:='INSUFFICIENT_COINS';
    else
      update domine_pet_v7.pool set coins=coins-item.price where id=1;
      insert into domine_pet_v10.inventory(pet_id,item_id) values(pet,entry);
      perform domine_pet_v10.log_v10(p.nickname,pet,'purchase',entry);
      insert into domine_pet_v6.album(player_id,entry_id) values(p.id,entry) on conflict do nothing;
      if found then new_entries:=jsonb_build_array(entry); end if;
      perform domine_pet_v6.increment_v6(p.id,'purchase_total');
    end if;
  elsif p_kind='equip' then
    if entry is not null and not exists(select 1 from domine_pet_v10.inventory i join domine_pet_v6.catalog c on c.id=i.item_id where i.pet_id=pet and i.item_id=entry and c.slot=cmd.slot) then code:='NOT_OWNED';
    else
      insert into domine_pet_v7.equipment(pet_id,slot,item_id) values(pet,slot,entry)
        on conflict(pet_id,slot) do update set item_id=excluded.item_id;
      perform domine_pet_v10.log_v10(p.nickname,pet,'equip',entry);
      if entry is not null and slot='wearable' then perform domine_pet_v6.increment_v6(p.id,'equipped_item:'||entry); end if;
    end if;
  elsif p_kind='explore_begin' then
    -- Reuse the original clock for a live ticket in the same theme.
    if not exists(select 1 from domine_pet_v6.exploration where player_id=p.id and map_id=map
      and finished_at is null and cancelled_at is null and expires_at>now()) then
      update domine_pet_v6.exploration set cancelled_at=now() where player_id=p.id and finished_at is null and cancelled_at is null;
      select max(started_at) into last_time from domine_pet_v6.exploration where player_id=p.id;
      if day.explore_starts>=60 or last_time>now()-interval '10 seconds' then code:='RATE_LIMITED';
      else
        insert into domine_pet_v6.exploration(player_id,map_id,source,eligible_at,expires_at) values(p.id,map,p_input->>'source',now()+interval '15 seconds',now()+interval '10 minutes') returning id into new_id;
        update domine_pet_v7.daily set explore_starts=explore_starts+1 where player_id=p.id and kst_date=today;
      end if;
    end if;
  elsif p_kind='explore_finish' then
    select * into ticket from domine_pet_v6.exploration where id=(p_input->>'ticket')::uuid and player_id=p.id for update;
    if not found then code:='INVALID_INPUT';
    elsif ticket.finished_at is not null then
      result:=ticket.result;
      if not result ? 'levels' or (result->>'version')::bigint<=p.version then
        result:=domine_pet_v6.snapshot_v6(p.id,pet)||domine_pet_v6.result_v6('ALREADY_APPLIED')||jsonb_build_object('requestId',p_request_id);
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
          if not exists(select 1 from domine_pet_v6.catalog c where c.acquisition='explore' and ticket.map_id=any(c.maps) and band=any(c.time_bands) and c.rarity=cmd.rarity) then rarity:='일반'; end if;
        end if;
        if rarity is not null then
          select c.id into entry from domine_pet_v6.catalog c where c.acquisition='explore' and ticket.map_id=any(c.maps) and band=any(c.time_bands) and c.rarity=cmd.rarity
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
      else skipped:='DAILY_CAP';
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

  new_level:=domine_pet_v6.level_v6(least(9280,pet_xp+xp_gain));
  select coalesce(sum(10+2*g),0)::int into level_coins from generate_series(old_level+1,new_level) g;
  xp_gain:=least(9280-pet_xp,xp_gain);
  update domine_pet_v10.pet_xp set xp=xp+xp_gain where pet_id=pet;
  update domine_pet_v7.pool set coins=coins+coin_gain+level_coins,version=version+1 where id=1;
  if new_level>old_level then perform domine_pet_v10.log_v10(p.nickname,pet,'levelup',new_level::text); end if;
  for entry in select jsonb_array_elements_text(new_entries) loop
    perform domine_pet_v10.log_v10(p.nickname,pet,'discover',entry);
  end loop;
  new_badges:=domine_pet_v6.badges_v6(p.id);
  result:=domine_pet_v6.snapshot_v6(p.id,coalesce(pet,1))||domine_pet_v6.result_v6(code)||extra||jsonb_build_object(
    'requestId',p_request_id,'reward',jsonb_build_object('xp',xp_gain,'coins',coin_gain,'levelCoins',level_coins,'newEntries',new_entries,'newBadges',new_badges)
      ||case when skipped is null then '{}'::jsonb else jsonb_build_object('skipped',skipped) end
      ||case when retry_seconds is null then '{}'::jsonb else jsonb_build_object('retryAfterSeconds',retry_seconds) end);
  if p_kind='explore_finish' and code='OK' then update domine_pet_v6.exploration set result=cmd.result where id=ticket.id; end if;
  insert into domine_pet_v6.operation(player_id,request_id,kind,payload_hash,result) values(p.id,p_request_id,p_kind,payload,result);
  return result;
end cmd $$;
revoke all on function domine_pet_v6.command_v6(text,text,uuid,text,jsonb) from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
