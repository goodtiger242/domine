-- One-off reset, run by hand on 2026-11-12 at the owner's request: every player starts their own
-- dogs from zero, so nothing copied from the shared era (v23) remains in their progress or ranking.
-- Copies every affected row into domine_pet_backup first (restore by inserting them back).
-- Kept: accounts, badges and counters (always personal), history feed, global map state.
begin;
set local lock_timeout = '10s';
set local statement_timeout = '60s';

do $$ begin
  if exists(select 1 from domine_pet_v17.battle_ticket t where t.status='active') then raise exception 'ACTIVE_BATTLE'; end if;
  if exists(select 1 from pg_catalog.pg_namespace n where n.nspname='domine_pet_backup') then raise exception 'ALREADY_RESET'; end if;
end $$;

create schema if not exists domine_pet_backup;
revoke all on schema domine_pet_backup from public,anon,authenticated;
create table domine_pet_backup.r20261112_wallet as select * from domine_pet_v22.wallet;
create table domine_pet_backup.r20261112_pet as select * from domine_pet_v22.pet;
create table domine_pet_backup.r20261112_progress as select * from domine_pet_v22.progress;
create table domine_pet_backup.r20261112_mastery as select * from domine_pet_v22.mastery;
create table domine_pet_backup.r20261112_battle_inventory as select * from domine_pet_v22.battle_inventory;
create table domine_pet_backup.r20261112_certification as select * from domine_pet_v22.certification;
create table domine_pet_backup.r20261112_encounter_record as select * from domine_pet_v22.encounter_record;
create table domine_pet_backup.r20261112_cosmetic_inventory as select * from domine_pet_v22.cosmetic_inventory;
create table domine_pet_backup.r20261112_equipment as select * from domine_pet_v22.equipment;
create table domine_pet_backup.r20261112_album as select a.* from domine_pet_v6.album a
  where a.player_id<>'a1b2c3d4-0000-4000-8000-000000000001'::uuid;
create table domine_pet_backup.r20261112_contribution as select * from domine_pet_v17.contribution;
do $$ declare v_table record; begin
  for v_table in select t.tablename from pg_catalog.pg_tables t where t.schemaname='domine_pet_backup' loop
    execute pg_catalog.format('alter table domine_pet_backup.%I enable row level security',v_table.tablename);
  end loop;
end $$;
revoke all on all tables in schema domine_pet_backup from public,anon,authenticated;

-- Children before parents; the rows that stay are set back to the values a new account gets.
delete from domine_pet_v22.equipment;
delete from domine_pet_v22.cosmetic_inventory;
delete from domine_pet_v22.mastery;
delete from domine_pet_v22.battle_inventory;
delete from domine_pet_v22.certification;
delete from domine_pet_v22.encounter_record;
delete from domine_pet_v17.contribution;
delete from domine_pet_v6.album where player_id<>'a1b2c3d4-0000-4000-8000-000000000001'::uuid;
update domine_pet_v22.progress set xp=0,allocation='{"hp":0,"attack":0,"defense":0,"speed":0,"focus":0,"calm":0}',
  allocation_mode='auto',job=null,job_tier=0,job_changed_at=null,moves='[]',streak=0,version=version+1;
update domine_pet_v22.pet set fullness=70,mood=70,clean=80,care_total=0,care_xp=0,updated_at=pg_catalog.now(),busy_until=null,busy_action=null;
update domine_pet_v22.wallet set coins=0,version=version+1;
-- Animal levels follow every dog's level; recompute today's profile from the fresh dogs.
delete from domine_pet_v22.spawn_profile;
-- Devices drop cached wins and battle state when this changes.
update domine_pet_v17.config set reset_epoch='20261112-reset' where id=1;
notify pgrst,'reload schema';
commit;
