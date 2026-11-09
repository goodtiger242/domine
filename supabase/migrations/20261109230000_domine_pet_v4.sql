-- 도미 4차: 행동별 쉬는 시간(쿨다운)을 모두 없앱니다. Supabase SQL Editor에서 한 번 실행하세요.
-- (1~3차 SQL을 먼저 실행한 상태여야 합니다. 이 함수 하나만 바꾸며 기존 기록은 그대로입니다.)
--
-- 남는 제한: 이미 배부름·기분·청결이 가득 찬 경우의 거절, 그리고 도배 방지(전체에서 1분에 20번까지).
-- 쉬는 시간을 다시 두고 싶으면 아래 0 대신 초 단위 값을 넣으면 됩니다. (예: 밥 7200 = 2시간)

create or replace function public.domine_pet_cd_secs(p_action text)
returns int
language sql
immutable
as $$
  select case p_action
    when 'feed' then 0
    when 'treat' then 0
    when 'pet' then 0
    when 'play' then 0
    when 'walk' then 0
    when 'brush' then 0
    when 'bath' then 0
    when 'train' then 0
    else 0
  end;
$$;
