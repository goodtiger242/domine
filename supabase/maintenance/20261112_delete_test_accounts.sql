-- One-off cleanup, run by hand on 2026-11-12: remove the three test accounts (names that cannot sign in)
-- and every row that belongs to them. Aborts unless exactly those three exist and none is mid-battle.
begin;
set local lock_timeout = '10s';
set local statement_timeout = '60s';

create temp table gone on commit drop as
  select p.id, p.nickname from domine_pet_v6.player p
  where p.nickname_key in (U&'\C120\D638', U&'\D638\D638', U&'\D655\C778');

do $$ begin
  if (select pg_catalog.count(*) from gone) <> 3 then raise exception 'EXPECTED_3_TEST_ACCOUNTS'; end if;
  if exists(select 1 from domine_pet_v17.battle_ticket t join gone g on g.id=t.player_id where t.status='active') then
    raise exception 'TEST_ACCOUNT_IN_BATTLE';
  end if;
end $$;

-- Children before parents.
delete from domine_pet_v17.raid_contribution where player_id in (select id from gone)
  or ticket_id in (select t.id from domine_pet_v17.battle_ticket t where t.player_id in (select id from gone));
delete from domine_pet_v17.battle_ticket where player_id in (select id from gone);
delete from domine_pet_v17.change_history where player_id in (select id from gone);
delete from domine_pet_v17.operation where player_id in (select id from gone);
delete from domine_pet_v17.contribution where player_id in (select id from gone);
delete from domine_pet_v17.pickup_claim where player_id in (select id from gone);
delete from domine_pet_v22.equipment where player_id in (select id from gone);
delete from domine_pet_v22.cosmetic_inventory where player_id in (select id from gone);
delete from domine_pet_v22.mastery where player_id in (select id from gone);
delete from domine_pet_v22.battle_inventory where player_id in (select id from gone);
delete from domine_pet_v22.certification where player_id in (select id from gone);
delete from domine_pet_v22.encounter_record where player_id in (select id from gone);
delete from domine_pet_v22.progress where player_id in (select id from gone);
delete from domine_pet_v22.pet where player_id in (select id from gone);
delete from domine_pet_v22.wallet where player_id in (select id from gone);
delete from domine_pet_v6.equipment where player_id in (select id from gone);
delete from domine_pet_v6.inventory where player_id in (select id from gone);
delete from domine_pet_v6.album where player_id in (select id from gone);
delete from domine_pet_v6.achievement where player_id in (select id from gone);
delete from domine_pet_v6.counter where player_id in (select id from gone);
delete from domine_pet_v6.daily where player_id in (select id from gone);
delete from domine_pet_v6.action_clock where player_id in (select id from gone);
delete from domine_pet_v6.operation where player_id in (select id from gone);
delete from domine_pet_v6.exploration where player_id in (select id from gone);
delete from domine_pet_v6.walk_session where player_id in (select id from gone);
delete from domine_pet_v7.daily where player_id in (select id from gone);
delete from domine_pet_v10.history where nickname in (select nickname from gone);
delete from domine_pet_v6.player where id in (select id from gone);
commit;
