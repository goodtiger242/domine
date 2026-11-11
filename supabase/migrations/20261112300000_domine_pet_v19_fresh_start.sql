-- v19 fresh start: wipes ALL game progress so everything starts again from zero.
-- Keeps: player accounts (names and login hashes), the item catalog, price tables and config.
-- Wipes: levels, xp, coins, items, equipment, album, achievements, counters, battle records,
-- kills, certifications, mastery, history, care logs and the dogs' fullness/mood/clean/growth.
-- Safe to run twice. ASCII only. Versions are bumped (not reset) so open browsers accept the new state.
begin;
set local search_path='';

-- v17 battle growth and records (children first)
delete from domine_pet_v17.raid_contribution;
delete from domine_pet_v17.battle_ticket;
delete from domine_pet_v17.change_history;
delete from domine_pet_v17.operation;
delete from domine_pet_v17.departed;
delete from domine_pet_v17.encounter_record;
delete from domine_pet_v17.certification;
delete from domine_pet_v17.contribution;
delete from domine_pet_v17.mastery;
delete from domine_pet_v17.inventory;
delete from domine_pet_v17.raid_cycle;
delete from domine_pet_v17.pickup_claim;
update domine_pet_v17.pet_progress set
  xp=0,
  allocation='{"hp":0,"attack":0,"defense":0,"speed":0,"focus":0,"calm":0}'::jsonb,
  allocation_mode='auto',
  job=null, job_tier=0, job_changed_at=null,
  moves='[]'::jsonb,
  streak=0,
  version=version+1;

-- busy locks and shared history
delete from domine_pet_v16.busy;
delete from domine_pet_v10.history;
-- v7.equipment points at v10.inventory (equipment_inventory_v10_fkey), so it must go first.
delete from domine_pet_v7.equipment;
delete from domine_pet_v10.inventory;
update domine_pet_v10.pet_xp set xp=0;

-- shared wallet, items and equipment
delete from domine_pet_v7.inventory;
delete from domine_pet_v7.daily;
update domine_pet_v7.pool set xp=0, coins=0, version=version+1 where id=1;

-- per-player records (accounts stay)
delete from domine_pet_v6.equipment;
delete from domine_pet_v6.inventory;
delete from domine_pet_v6.album;
delete from domine_pet_v6.achievement;
delete from domine_pet_v6.counter;
delete from domine_pet_v6.daily;
delete from domine_pet_v6.action_clock;
delete from domine_pet_v6.operation;
delete from domine_pet_v6.exploration;
delete from domine_pet_v6.walk_session;
delete from domine_pet_v6.rate_bucket;
update domine_pet_v6.player set xp=0, coins=0, discovery_misses=0, version=version+1;

-- the dogs themselves: needs and growth stage, plus the care log
delete from public.domine_pet_log;
update public.domine_pet set fullness=70, mood=70, clean=80, care_total=0, updated_at=pg_catalog.now();

notify pgrst,'reload schema';
commit;
