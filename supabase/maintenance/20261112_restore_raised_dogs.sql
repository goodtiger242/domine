-- One-off restore, run by hand on 2026-11-12 at the owner's request: bring back the dog each player
-- had raised before the reset (choi-seonho: pet 2, choi-biho: pet 1) from domine_pet_backup.
-- Growth made after the reset is added on top, never overwritten. Coins and the encyclopedia stay reset.
begin;
set local lock_timeout = '10s';
set local statement_timeout = '60s';

create temp table back on commit drop as
  select p.id as player_id, k.pet_id from domine_pet_v6.player p
  join (values (U&'\CD5C\C120\D638', 2), (U&'\CD5C\BE44\D638', 1)) as k(nickname, pet_id) on p.nickname_key=k.nickname;

do $$ begin
  if (select pg_catalog.count(*) from back) <> 2 then raise exception 'EXPECTED_2_DOGS'; end if;
  if exists(select 1 from domine_pet_v17.battle_ticket t join back b on b.player_id=t.player_id and b.pet_id=t.pet_id where t.status='active') then
    raise exception 'DOG_IN_BATTLE';
  end if;
  if exists(select 1 from back b join domine_pet_backup.r20261112_progress o using (player_id,pet_id)
    join domine_pet_v22.progress g using (player_id,pet_id) where g.xp>=o.xp and o.xp>0) then raise exception 'ALREADY_RESTORED'; end if;
end $$;

update domine_pet_v22.progress g set xp=o.xp+g.xp,allocation=o.allocation,allocation_mode=o.allocation_mode,
  job=o.job,job_tier=o.job_tier,job_changed_at=o.job_changed_at,moves=o.moves,streak=greatest(o.streak,g.streak),version=g.version+1
  from domine_pet_backup.r20261112_progress o, back b
  where g.player_id=b.player_id and g.pet_id=b.pet_id and o.player_id=b.player_id and o.pet_id=b.pet_id;
update domine_pet_v22.pet c set care_total=c.care_total+o.care_total,care_xp=least(9280,c.care_xp+o.care_xp)
  from domine_pet_backup.r20261112_pet o, back b
  where c.player_id=b.player_id and c.pet_id=b.pet_id and o.player_id=b.player_id and o.pet_id=b.pet_id;
insert into domine_pet_v22.mastery as m(player_id,pet_id,move_id,uses)
  select o.player_id,o.pet_id,o.move_id,o.uses from domine_pet_backup.r20261112_mastery o join back b using (player_id,pet_id)
  on conflict(player_id,pet_id,move_id) do update set uses=m.uses+excluded.uses;
insert into domine_pet_v22.battle_inventory as i(player_id,pet_id,item_id,quantity)
  select o.player_id,o.pet_id,o.item_id,o.quantity from domine_pet_backup.r20261112_battle_inventory o join back b using (player_id,pet_id)
  on conflict(player_id,pet_id,item_id) do update set quantity=i.quantity+excluded.quantity;
insert into domine_pet_v22.certification(player_id,pet_id,kind,target,at)
  select o.player_id,o.pet_id,o.kind,o.target,o.at from domine_pet_backup.r20261112_certification o join back b using (player_id,pet_id)
  on conflict do nothing;
insert into domine_pet_v22.cosmetic_inventory(player_id,pet_id,item_id,purchased_at)
  select o.player_id,o.pet_id,o.item_id,o.purchased_at from domine_pet_backup.r20261112_cosmetic_inventory o join back b using (player_id,pet_id)
  on conflict do nothing;
insert into domine_pet_v22.equipment(player_id,pet_id,slot,item_id)
  select o.player_id,o.pet_id,o.slot,o.item_id from domine_pet_backup.r20261112_equipment o join back b using (player_id,pet_id)
  on conflict do nothing;
-- Devices take the new progress when the wallet version moves; levels changed, so recompute today's animal levels.
update domine_pet_v22.wallet w set version=w.version+1 where w.player_id in (select player_id from back);
delete from domine_pet_v22.spawn_profile;
notify pgrst,'reload schema';
commit;
