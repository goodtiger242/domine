begin;
set local lock_timeout = '10s';
set local statement_timeout = '60s';

-- v24: public level ranking per dog. Level 1 means not playing yet, so ranks start at level 2.
-- Read-only, one indexed scan of domine_pet_v22.progress per call; opened by hand, never polled.
create or replace function domine_pet_v22.level_ranking_rows(p_pet int) returns jsonb
language sql stable set search_path='' as $$
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('nickname',r.nickname,'level',r.level,'xp',r.xp)
    order by r.xp desc,r.nickname),'[]'::jsonb)
  from (
    select p.nickname,domine_pet_v17.level_for_xp(g.xp) as level,g.xp
    from domine_pet_v22.progress g join domine_pet_v6.player p on p.id=g.player_id
    where g.pet_id=p_pet and g.xp>=domine_pet_v17.xp_for_level(2)
      and p.id<>'a1b2c3d4-0000-4000-8000-000000000001'::uuid
    order by g.xp desc,p.nickname limit 30
  ) r;
$$;

create or replace function public.domine_pet_level_ranking_v24() returns jsonb
language sql stable security definer set search_path='' as $$
  select pg_catalog.jsonb_build_object('1',domine_pet_v22.level_ranking_rows(1),'2',domine_pet_v22.level_ranking_rows(2));
$$;

revoke all on function domine_pet_v22.level_ranking_rows(int) from public,anon,authenticated;
revoke all on function public.domine_pet_level_ranking_v24() from public;
grant execute on function public.domine_pet_level_ranking_v24() to anon,authenticated;
notify pgrst,'reload schema';
commit;
