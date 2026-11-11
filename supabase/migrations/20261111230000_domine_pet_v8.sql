begin;

-- 기존 발견 장소를 보존하고, 소재가 어울리는 풍경만 추가한다.
with additions(id, maps) as (values
  ('001', array['churchback','pilgrimpath']),
  ('002', array['churchback','school','apartment']),
  ('003', array['churchback','garden','school']),
  ('004', array['churchback','market','farm']),
  ('013', array['garden','farm','bikepath']),
  ('014', array['garden','farm','playground']),
  ('015', array['stream','lake','farm','bikepath']),
  ('016', array['mountain','pilgrimpath','overlook']),
  ('017', array['mountain','pilgrimpath','garden']),
  ('018', array['stream','bridge','lake','bikepath']),
  ('019', array['garden','farm','playground']),
  ('020', array['garden','farm']),
  ('021', array['stream','lake','farm']),
  ('023', array['garden','pilgrimpath']),
  ('024', array['stream','lake']),
  ('025', array['alley','market','station','foodstreet','cafestreet','bakery','apartment']),
  ('026', array['market','foodstreet','cafestreet','bakery']),
  ('027', array['school','playground','station','bikepath','apartment']),
  ('028', array['school','station','market','foodstreet']),
  ('029', array['market','foodstreet','cafestreet','bakery']),
  ('030', array['alley','apartment','cafestreet','station']),
  ('031', array['foodstreet']),
  ('032', array['foodstreet']),
  ('033', array['foodstreet']),
  ('034', array['foodstreet']),
  ('035', array['alley','apartment','bikepath','garden']),
  ('036', array['alley']),
  ('037', array['mountain','pilgrimpath','garden','overlook']),
  ('038', array['mountain','pilgrimpath','garden']),
  ('039', array['churchback','school','apartment','overlook']),
  ('040', array['stream','bridge','lake','mountain']),
  ('041', array['mountain','pilgrimpath','overlook','bikepath','bridge','lake']),
  ('042', array['playground','school','garden','overlook','lake','bikepath']),
  ('043', array['mountain','pilgrimpath','garden']),
  ('044', array['stream','bridge','bikepath','lake','school']),
  ('045', array['stream','garden','farm']),
  ('046', array['mountain','pilgrimpath']),
  ('047', array['mountain','garden']),
  ('048', array['mountain','pilgrimpath','garden','overlook']),
  ('049', array['alley','apartment','farm']),
  ('052', array['alley','apartment']),
  ('054', array['playground','school','farm']),
  ('055', array['alley','apartment','farm']),
  ('056', array['alley','apartment']),
  ('057', array['alley','apartment','market']),
  ('058', array['alley','apartment','playground']),
  ('059', array['apartment']),
  ('060', array['playground'])
)
update domine_pet_v6.catalog c
set maps = array(select distinct theme from unnest(c.maps || a.maps) as t(theme) order by theme)
from additions a
where c.id = a.id and c.acquisition = 'explore';

commit;
