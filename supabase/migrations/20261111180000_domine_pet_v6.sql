-- Apply this entire file in Supabase SQL Editor. Existing v1-v5 objects are untouched.
begin;
do $$ begin
  if pg_catalog.to_regclass('public.domine_pet') is null
     or pg_catalog.to_regclass('public.domine_pet_log') is null
     or pg_catalog.to_regprocedure('public.domine_pet_state_for(integer,text)') is null
     or pg_catalog.to_regprocedure('public.domine_pet_care_for(integer,text,text)') is null
     or not exists (select 1 from information_schema.columns where table_schema='public' and table_name='domine_pet_log' and column_name='pet_id') then
    raise exception 'domine pet v1-v5 required';
  end if;
  if pg_catalog.to_regprocedure('extensions.digest(text,text)') is null then
    raise exception 'pgcrypto must be installed in extensions';
  end if;
end $$;
create schema if not exists domine_pet_v6;
revoke all on schema domine_pet_v6 from public, anon, authenticated;

create table if not exists domine_pet_v6.player (
  id uuid primary key default pg_catalog.gen_random_uuid(), nickname text not null,
  nickname_key text not null unique, secret_hash bytea not null check (octet_length(secret_hash)=32),
  xp int not null default 0 check (xp between 0 and 9280), coins int not null default 0 check (coins>=0),
  version bigint not null default 0, discovery_misses smallint not null default 0 check (discovery_misses between 0 and 4),
  created_at timestamptz not null default now(),
  check (nickname ~ '^[가-힣a-zA-Z0-9]{1,8}$' and nickname_key=lower(nickname))
);
create table if not exists domine_pet_v6.catalog (
  id text primary key check (id ~ '^0[0-9]{2}$' and id between '001' and '096'),
  name text not null, category text not null, rarity text not null,
  acquisition text not null check (acquisition in ('explore','shop','season','device')),
  maps text[] not null, time_bands text[] not null, seasons text[] not null,
  price int, slot text, asset_key text not null, core boolean not null, storage text not null check (storage in ('server','device')),
  check ((acquisition='shop' and price is not null and price>0 and slot is not null and slot in ('wearable','toy')) or (acquisition<>'shop' and price is null and slot is null))
);
create table if not exists domine_pet_v6.inventory (
  player_id uuid references domine_pet_v6.player(id), item_id text references domine_pet_v6.catalog(id),
  purchased_at timestamptz not null default now(), primary key(player_id,item_id)
);
create table if not exists domine_pet_v6.equipment (
  player_id uuid references domine_pet_v6.player(id), pet_id int check (pet_id in (1,2)),
  slot text check (slot in ('wearable','toy')), item_id text,
  primary key(player_id,pet_id,slot), foreign key(player_id,item_id) references domine_pet_v6.inventory(player_id,item_id)
);
create table if not exists domine_pet_v6.album (
  player_id uuid references domine_pet_v6.player(id), entry_id text references domine_pet_v6.catalog(id),
  first_found_at timestamptz not null default now(), find_count int not null default 1 check (find_count>=1),
  primary key(player_id,entry_id), check (entry_id between '001' and '092')
);
create table if not exists domine_pet_v6.achievement (
  player_id uuid references domine_pet_v6.player(id), achievement_id text check (achievement_id ~ '^A(0[1-9]|[12][0-9]|30)$'),
  unlocked_at timestamptz not null default now(), primary key(player_id,achievement_id)
);
create table if not exists domine_pet_v6.counter (
  player_id uuid references domine_pet_v6.player(id), metric text,
  scope text not null default 'all' check (scope='all'), value int not null default 0 check (value>=0),
  primary key(player_id,metric,scope),
  check (metric in ('action_total','explore_total','purchase_total') or metric ~ '^(action:(feed|treat|pet|play|walk|brush|bath|train)|pet:[12]|explore_map:(field|church|street|park|home)|explore_time:(dawn|day|dusk|night)|equipped_item:0(6[1-9]|7[0-2]))$')
);
create table if not exists domine_pet_v6.daily (
  player_id uuid references domine_pet_v6.player(id), kst_date date,
  reward_actions int not null default 0 check (reward_actions between 0 and 40),
  explore_starts int not null default 0 check (explore_starts between 0 and 60),
  explore_finishes int not null default 0 check (explore_finishes between 0 and 30),
  walk_claims int not null default 0 check (walk_claims between 0 and 4), primary key(player_id,kst_date)
);
create table if not exists domine_pet_v6.action_clock (
  player_id uuid references domine_pet_v6.player(id), action text,
  last_reward_at timestamptz, last_submit_at timestamptz, primary key(player_id,action)
);
create table if not exists domine_pet_v6.operation (
  player_id uuid references domine_pet_v6.player(id), request_id uuid, kind text not null,
  payload_hash bytea not null, result jsonb not null, created_at timestamptz not null default now(), primary key(player_id,request_id)
);
create table if not exists domine_pet_v6.exploration (
  id uuid primary key default pg_catalog.gen_random_uuid(), player_id uuid not null references domine_pet_v6.player(id),
  map_id text not null check (map_id in ('church','field','street','park','home')), source text not null check (source in ('map','walk')),
  started_at timestamptz not null default now(), eligible_at timestamptz not null, expires_at timestamptz not null,
  finished_at timestamptz, cancelled_at timestamptz, result jsonb
);
create unique index if not exists exploration_active_v6 on domine_pet_v6.exploration(player_id) where finished_at is null and cancelled_at is null;
create table if not exists domine_pet_v6.walk_session (
  id uuid primary key default pg_catalog.gen_random_uuid(), player_id uuid not null references domine_pet_v6.player(id),
  started_at timestamptz not null default now(), expires_at timestamptz not null, last_claim_at timestamptz not null default now(),
  claims int not null default 0 check (claims>=0), closed_at timestamptz
);
create unique index if not exists walk_active_v6 on domine_pet_v6.walk_session(player_id) where closed_at is null;
create table if not exists domine_pet_v6.rate_bucket (
  bucket_key text, window_start timestamptz, count int not null check (count>=0), primary key(bucket_key,window_start)
);
create index if not exists operation_created_v6 on domine_pet_v6.operation(created_at);
create index if not exists exploration_started_v6 on domine_pet_v6.exploration(player_id,started_at desc);
create index if not exists walk_started_v6 on domine_pet_v6.walk_session(player_id,started_at desc);
create index if not exists rate_window_v6 on domine_pet_v6.rate_bucket(window_start);

insert into domine_pet_v6.catalog(id,name,category,rarity,acquisition,maps,time_bands,seasons,price,slot,asset_key,core,storage) values
('001','마당의 둥근 돌','물건','일반','explore',array['church']::text[],array['dawn','day','dusk','night']::text[],array[]::text[],null,null,'001',true,'server'),
('002','은행잎 한 장','자연','일반','explore',array['church']::text[],array['dawn','day','dusk','night']::text[],array[]::text[],null,null,'002',true,'server'),
('003','화단 이름표','소품','일반','explore',array['church']::text[],array['dawn','day','dusk','night']::text[],array[]::text[],null,null,'003',true,'server'),
('004','접이식 의자','소품','일반','explore',array['church']::text[],array['dawn','day','dusk','night']::text[],array[]::text[],null,null,'004',true,'server'),
('005','마당 빗자루','소품','일반','explore',array['church']::text[],array['dawn','day','dusk','night']::text[],array[]::text[],null,null,'005',true,'server'),
('006','작은 물뿌리개','소품','일반','explore',array['church']::text[],array['dawn','day','dusk','night']::text[],array[]::text[],null,null,'006',true,'server'),
('007','청년회 이름표','공동체','특별','explore',array['church']::text[],array['dawn','day','dusk','night']::text[],array[]::text[],null,null,'007',true,'server'),
('008','마당의 참새','만남·동물','특별','explore',array['church']::text[],array['dawn','day']::text[],array[]::text[],null,null,'008',true,'server'),
('009','청소 봉사 장갑','공동체','특별','explore',array['church']::text[],array['dawn','day','dusk','night']::text[],array[]::text[],null,null,'009',true,'server'),
('010','성가 연습을 마친 친구','만남·사람','희귀','explore',array['church']::text[],array['dusk','night']::text[],array[]::text[],null,null,'010',true,'server'),
('011','꽃을 돌보는 봉사자','만남·사람','희귀','explore',array['church']::text[],array['dawn','day']::text[],array[]::text[],null,null,'011',true,'server'),
('012','노을에 물든 종탑 풍경','장소 풍경','아주 드묾','explore',array['church']::text[],array['dusk']::text[],array[]::text[],null,null,'012',true,'server'),
('013','민들레','자연','일반','explore',array['field']::text[],array['dawn','day','dusk','night']::text[],array[]::text[],null,null,'013',true,'server'),
('014','토끼풀','자연','일반','explore',array['field']::text[],array['dawn','day','dusk','night']::text[],array[]::text[],null,null,'014',true,'server'),
('015','강아지풀','자연','일반','explore',array['field']::text[],array['dawn','day','dusk','night']::text[],array[]::text[],null,null,'015',true,'server'),
('016','작은 솔방울','자연','일반','explore',array['field']::text[],array['dawn','day','dusk','night']::text[],array[]::text[],null,null,'016',true,'server'),
('017','마른 나뭇가지','자연','일반','explore',array['field']::text[],array['dawn','day','dusk','night']::text[],array[]::text[],null,null,'017',true,'server'),
('018','납작한 자갈','자연','일반','explore',array['field']::text[],array['dawn','day','dusk','night']::text[],array[]::text[],null,null,'018',true,'server'),
('019','노랑나비','만남·동물','특별','explore',array['field']::text[],array['day']::text[],array[]::text[],null,null,'019',true,'server'),
('020','무당벌레','만남·동물','특별','explore',array['field']::text[],array['dawn','day']::text[],array[]::text[],null,null,'020',true,'server'),
('021','풀숲 귀뚜라미','만남·동물','특별','explore',array['field']::text[],array['dusk','night']::text[],array[]::text[],null,null,'021',true,'server'),
('022','들판의 토끼','만남·동물','희귀','explore',array['field']::text[],array['dawn','dusk']::text[],array[]::text[],null,null,'022',true,'server'),
('023','네잎클로버','자연','희귀','explore',array['field']::text[],array['dawn','day','dusk','night']::text[],array[]::text[],null,null,'023',true,'server'),
('024','반딧불이','만남·동물','아주 드묾','explore',array['field']::text[],array['night']::text[],array[]::text[],null,null,'024',true,'server'),
('025','골목의 가로등','장소 요소','일반','explore',array['street']::text[],array['dawn','day','dusk','night']::text[],array[]::text[],null,null,'025',true,'server'),
('026','가게 앞 화분','소품','일반','explore',array['street']::text[],array['dawn','day','dusk','night']::text[],array[]::text[],null,null,'026',true,'server'),
('027','작은 자전거 거치대','장소 요소','일반','explore',array['street']::text[],array['dawn','day','dusk','night']::text[],array[]::text[],null,null,'027',true,'server'),
('028','횡단보도 표지','장소 요소','일반','explore',array['street']::text[],array['dawn','day','dusk','night']::text[],array[]::text[],null,null,'028',true,'server'),
('029','가게 앞 우산꽂이','소품','일반','explore',array['street']::text[],array['dawn','day','dusk','night']::text[],array[]::text[],null,null,'029',true,'server'),
('030','골목 벤치','장소 요소','일반','explore',array['street']::text[],array['dawn','day','dusk','night']::text[],array[]::text[],null,null,'030',true,'server'),
('031','술이 좋아 앞의 저녁 풍경','장소 풍경','특별','explore',array['street']::text[],array['dusk','night']::text[],array[]::text[],null,null,'031',true,'server'),
('032','맥도날드 앞의 포장 봉투','장소 소품','특별','explore',array['street']::text[],array['dawn','day','dusk','night']::text[],array[]::text[],null,null,'032',true,'server'),
('033','쁘니네 앞의 화분 풍경','장소 풍경','특별','explore',array['street']::text[],array['day','dusk']::text[],array[]::text[],null,null,'033',true,'server'),
('034','화락 앞의 저녁 불빛','장소 풍경','희귀','explore',array['street']::text[],array['dusk','night']::text[],array[]::text[],null,null,'034',true,'server'),
('035','산책 중인 이웃','만남·사람','희귀','explore',array['street']::text[],array['dawn','day']::text[],array[]::text[],null,null,'035',true,'server'),
('036','골목 끝 무지개','장소 풍경','아주 드묾','explore',array['street']::text[],array['day']::text[],array[]::text[],null,null,'036',true,'server'),
('037','도토리','자연','일반','explore',array['park']::text[],array['dawn','day','dusk','night']::text[],array[]::text[],null,null,'037',true,'server'),
('038','참나무 잎','자연','일반','explore',array['park']::text[],array['dawn','day','dusk','night']::text[],array[]::text[],null,null,'038',true,'server'),
('039','낙엽 두 장','자연','일반','explore',array['park']::text[],array['dawn','day','dusk','night']::text[],array[]::text[],null,null,'039',true,'server'),
('040','이끼 낀 돌','자연','일반','explore',array['park']::text[],array['dawn','day','dusk','night']::text[],array[]::text[],null,null,'040',true,'server'),
('041','산책로 안내판','장소 요소','일반','explore',array['park']::text[],array['dawn','day','dusk','night']::text[],array[]::text[],null,null,'041',true,'server'),
('042','나무 벤치','장소 요소','일반','explore',array['park']::text[],array['dawn','day','dusk','night']::text[],array[]::text[],null,null,'042',true,'server'),
('043','청설모','만남·동물','특별','explore',array['park']::text[],array['dawn','day']::text[],array[]::text[],null,null,'043',true,'server'),
('044','까치','만남·동물','특별','explore',array['park']::text[],array['day','dusk']::text[],array[]::text[],null,null,'044',true,'server'),
('045','달팽이','만남·동물','특별','explore',array['park']::text[],array['dawn','day','dusk','night']::text[],array[]::text[],null,null,'045',true,'server'),
('046','딱따구리','만남·동물','희귀','explore',array['park']::text[],array['dawn','day']::text[],array[]::text[],null,null,'046',true,'server'),
('047','밤의 고슴도치','만남·동물','희귀','explore',array['park']::text[],array['dusk','night']::text[],array[]::text[],null,null,'047',true,'server'),
('048','나뭇잎 사이 햇살','장소 풍경','아주 드묾','explore',array['park']::text[],array['day']::text[],array[]::text[],null,null,'048',true,'server'),
('049','빈 밥그릇','생활 소품','일반','explore',array['home']::text[],array['dawn','day','dusk','night']::text[],array[]::text[],null,null,'049',true,'server'),
('050','접힌 수건','생활 소품','일반','explore',array['home']::text[],array['dawn','day','dusk','night']::text[],array[]::text[],null,null,'050',true,'server'),
('051','부드러운 빗','생활 소품','일반','explore',array['home']::text[],array['dawn','day','dusk','night']::text[],array[]::text[],null,null,'051',true,'server'),
('052','현관 매트','생활 소품','일반','explore',array['home']::text[],array['dawn','day','dusk','night']::text[],array[]::text[],null,null,'052',true,'server'),
('053','낮잠 쿠션','생활 소품','일반','explore',array['home']::text[],array['dawn','day','dusk','night']::text[],array[]::text[],null,null,'053',true,'server'),
('054','작은 물통','생활 소품','일반','explore',array['home']::text[],array['dawn','day','dusk','night']::text[],array[]::text[],null,null,'054',true,'server'),
('055','마당의 고양이','만남·동물','특별','explore',array['home']::text[],array['dawn','dusk']::text[],array[]::text[],null,null,'055',true,'server'),
('056','빨래집게 바구니','생활 소품','특별','explore',array['home']::text[],array['dawn','day','dusk','night']::text[],array[]::text[],null,null,'056',true,'server'),
('057','택배 상자','생활 소품','특별','explore',array['home']::text[],array['dawn','day','dusk','night']::text[],array[]::text[],null,null,'057',true,'server'),
('058','함께 쉬는 이웃 강아지','만남·동물','희귀','explore',array['home']::text[],array['dawn','day']::text[],array[]::text[],null,null,'058',true,'server'),
('059','창가의 별빛','장소 풍경','희귀','explore',array['home']::text[],array['dusk','night']::text[],array[]::text[],null,null,'059',true,'server'),
('060','무지개 비눗방울','장면 소품','아주 드묾','explore',array['home']::text[],array['day']::text[],array[]::text[],null,null,'060',true,'server'),
('061','노랑 반다나','옷','일반','shop',array['church','field','street','park','home']::text[],array['dawn','day','dusk','night']::text[],array[]::text[],40,'wearable','061',true,'server'),
('062','하늘 반다나','옷','일반','shop',array['church','field','street','park','home']::text[],array['dawn','day','dusk','night']::text[],array[]::text[],60,'wearable','062',true,'server'),
('063','초록 체크 스카프','옷','일반','shop',array['church','field','street','park','home']::text[],array['dawn','day','dusk','night']::text[],array[]::text[],80,'wearable','063',true,'server'),
('064','빨강 나비넥타이','옷','특별','shop',array['church','field','street','park','home']::text[],array['dawn','day','dusk','night']::text[],array[]::text[],100,'wearable','064',true,'server'),
('065','보라 리본','옷','특별','shop',array['church','field','street','park','home']::text[],array['dawn','day','dusk','night']::text[],array[]::text[],120,'wearable','065',true,'server'),
('066','이름 없는 산책 조끼','옷','특별','shop',array['church','field','street','park','home']::text[],array['dawn','day','dusk','night']::text[],array[]::text[],140,'wearable','066',true,'server'),
('067','노랑 우비','옷','특별','shop',array['church','field','street','park','home']::text[],array['dawn','day','dusk','night']::text[],array[]::text[],180,'wearable','067',true,'server'),
('068','줄무늬 티셔츠','옷','특별','shop',array['church','field','street','park','home']::text[],array['dawn','day','dusk','night']::text[],array[]::text[],200,'wearable','068',true,'server'),
('069','겨울 목도리','옷','희귀','shop',array['church','field','street','park','home']::text[],array['dawn','day','dusk','night']::text[],array[]::text[],240,'wearable','069',true,'server'),
('070','밀짚모자','옷','희귀','shop',array['church','field','street','park','home']::text[],array['dawn','day','dusk','night']::text[],array[]::text[],260,'wearable','070',true,'server'),
('071','별무늬 망토','옷','희귀','shop',array['church','field','street','park','home']::text[],array['dawn','day','dusk','night']::text[],array[]::text[],320,'wearable','071',true,'server'),
('072','도미네 산책 재킷','옷','아주 드묾','shop',array['church','field','street','park','home']::text[],array['dawn','day','dusk','night']::text[],array[]::text[],400,'wearable','072',true,'server'),
('073','테니스공','장난감','일반','shop',array['church','field','street','park','home']::text[],array['dawn','day','dusk','night']::text[],array[]::text[],40,'toy','073',true,'server'),
('074','매듭 로프','장난감','일반','shop',array['church','field','street','park','home']::text[],array['dawn','day','dusk','night']::text[],array[]::text[],60,'toy','074',true,'server'),
('075','고무 뼈다귀','장난감','일반','shop',array['church','field','street','park','home']::text[],array['dawn','day','dusk','night']::text[],array[]::text[],80,'toy','075',true,'server'),
('076','천 원반','장난감','특별','shop',array['church','field','street','park','home']::text[],array['dawn','day','dusk','night']::text[],array[]::text[],120,'toy','076',true,'server'),
('077','오리 인형','장난감','특별','shop',array['church','field','street','park','home']::text[],array['dawn','day','dusk','night']::text[],array[]::text[],160,'toy','077',true,'server'),
('078','당근 인형','장난감','특별','shop',array['church','field','street','park','home']::text[],array['dawn','day','dusk','night']::text[],array[]::text[],180,'toy','078',true,'server'),
('079','줄무늬 공','장난감','희귀','shop',array['church','field','street','park','home']::text[],array['dawn','day','dusk','night']::text[],array[]::text[],240,'toy','079',true,'server'),
('080','별 쿠션 인형','장난감','아주 드묾','shop',array['church','field','street','park','home']::text[],array['dawn','day','dusk','night']::text[],array[]::text[],360,'toy','080',true,'server'),
('081','대림환을 본 기록','전례 기록','기념','season',array['church']::text[],array['dawn','day','dusk','night']::text[],array['advent']::text[],null,null,'081',false,'server'),
('082','대림의 기다림 카드','전례 기록','기념','season',array['church']::text[],array['dawn','day','dusk','night']::text[],array['advent']::text[],null,null,'082',false,'server'),
('083','성탄 준비 봉사 풍경','공동체 기록','기념','season',array['church']::text[],array['dawn','day','dusk','night']::text[],array['advent']::text[],null,null,'083',false,'server'),
('084','구유를 본 기록','전례 기록','기념','season',array['church']::text[],array['dawn','day','dusk','night']::text[],array['christmas']::text[],null,null,'084',false,'server'),
('085','성탄 트리 풍경','전례 기록','기념','season',array['church']::text[],array['dawn','day','dusk','night']::text[],array['christmas']::text[],null,null,'085',false,'server'),
('086','성탄 인사 카드','공동체 기록','기념','season',array['church']::text[],array['dawn','day','dusk','night']::text[],array['christmas']::text[],null,null,'086',false,'server'),
('087','사순의 보라색 안내','전례 기록','기념','season',array['church']::text[],array['dawn','day','dusk','night']::text[],array['lent']::text[],null,null,'087',false,'server'),
('088','십자가의 길 안내를 읽은 기록','전례 기록','기념','season',array['church']::text[],array['dawn','day','dusk','night']::text[],array['lent','triduum']::text[],null,null,'088',false,'server'),
('089','나눔 바구니 풍경','공동체 기록','기념','season',array['church']::text[],array['dawn','day','dusk','night']::text[],array['lent']::text[],null,null,'089',false,'server'),
('090','부활초를 본 기록','전례 기록','기념','season',array['church']::text[],array['dawn','day','dusk','night']::text[],array['easter','pentecost']::text[],null,null,'090',false,'server'),
('091','부활 인사 카드','전례 기록','기념','season',array['church']::text[],array['dawn','day','dusk','night']::text[],array['easter','pentecost']::text[],null,null,'091',false,'server'),
('092','성령 강림 안내를 읽은 기록','전례 기록','기념','season',array['church']::text[],array['dawn','day','dusk','night']::text[],array['pentecost']::text[],null,null,'092',false,'server'),
('093','실제 산책 200m 기념','기기 기록','기념','device',array[]::text[],array['dawn','day','dusk','night']::text[],array[]::text[],null,null,'093',false,'device'),
('094','실제 산책 1km 기념','기기 기록','기념','device',array[]::text[],array['dawn','day','dusk','night']::text[],array[]::text[],null,null,'094',false,'device'),
('095','용호성당 근처 산책 기념','장소 기록','기념','device',array[]::text[],array['dawn','day','dusk','night']::text[],array[]::text[],null,null,'095',false,'device'),
('096','아침 산책 기념','기기 기록','기념','device',array[]::text[],array['dawn','day','dusk','night']::text[],array[]::text[],null,null,'096',false,'device')
on conflict(id) do update set name=excluded.name,category=excluded.category,rarity=excluded.rarity,acquisition=excluded.acquisition,maps=excluded.maps,time_bands=excluded.time_bands,seasons=excluded.seasons,price=excluded.price,slot=excluded.slot,asset_key=excluded.asset_key,core=excluded.core,storage=excluded.storage;

create or replace function domine_pet_v6.level_v6(p_xp int) returns int
language sql immutable set search_path='' as $$
  select least(30,greatest(1,floor((sqrt(9+greatest(0,p_xp)*0.4)-1)/2)::int));
$$;
create or replace function domine_pet_v6.season_for_date_v6(p_date date) returns text
language plpgsql immutable set search_path='' as $$
declare
  y int := extract(year from p_date); a int; b int; c int; d int; e int; f int; g int; h int; i int; k int; l int; m int;
  easter date; advent date; epiphany date; baptism date;
begin
  if p_date is null then return null; end if;
  a:=y%19; b:=y/100; c:=y%100; d:=b/4; e:=b%4; f:=(b+8)/25; g:=(b-f+1)/3;
  h:=(19*a+b-d-g+15)%30; i:=c/4; k:=c%4; l:=(32+2*e+2*i-h-k)%7; m:=(a+11*h+22*l)/451;
  easter:=make_date(y,(h+l-7*m+114)/31,(h+l-7*m+114)%31+1);
  advent:=make_date(y,12,25)-(extract(dow from make_date(y,12,25))::int+21);
  if extract(dow from make_date(y,12,25))=0 then advent:=advent-7; end if;
  epiphany:=make_date(y,1,2)+((7-extract(dow from make_date(y,1,2))::int)%7);
  baptism:=epiphany+case when extract(day from epiphany) in (7,8) then 1 else 7 end;
  if p_date=easter+49 then return 'pentecost';
  elsif p_date between easter and easter+48 then return 'easter';
  elsif p_date between easter-3 and easter-1 then return 'triduum';
  elsif p_date between easter-46 and easter-4 then return 'lent';
  elsif p_date between advent and make_date(y,12,24) then return 'advent';
  elsif p_date>=make_date(y,12,25) or p_date<=baptism then return 'christmas';
  else return 'ordinary'; end if;
end $$;
create or replace function domine_pet_v6.result_v6(p_code text) returns jsonb
language sql stable set search_path='' as $$
  select jsonb_build_object('ok',p_code in ('OK','ALREADY_APPLIED'),'code',p_code,'serverNow',now());
$$;
create or replace function domine_pet_v6.valid_identity_v6(p_nickname text,p_secret text) returns boolean
language sql immutable set search_path='' as $$
  select coalesce(normalize(btrim(p_nickname),NFC) ~ '^[가-힣a-zA-Z0-9]{1,8}$' and p_secret ~ '^[0-9a-f]{64}$',false);
$$;
create or replace function domine_pet_v6.rate_v6(p_key text,p_window timestamptz,p_limit int) returns boolean
language plpgsql set search_path='' as $$
declare n int;
begin
  insert into domine_pet_v6.rate_bucket as b(bucket_key,window_start,count) values(p_key,p_window,1)
  on conflict(bucket_key,window_start) do update set count=b.count+1 where b.count<p_limit returning count into n;
  return n is not null;
end $$;
create or replace function domine_pet_v6.count_v6(p_player uuid,p_metric text) returns int
language sql stable set search_path='' as $$
  select coalesce((select value from domine_pet_v6.counter where player_id=p_player and metric=p_metric and scope='all'),0);
$$;
create or replace function domine_pet_v6.increment_v6(p_player uuid,p_metric text) returns void
language sql set search_path='' as $$
  insert into domine_pet_v6.counter as c(player_id,metric,value) values(p_player,p_metric,1)
  on conflict(player_id,metric,scope) do update set value=c.value+1;
$$;
create or replace function domine_pet_v6.snapshot_v6(p_player uuid,p_pet int) returns jsonb
language sql stable set search_path='' as $$
  select domine_pet_v6.result_v6('OK') || jsonb_build_object(
    'version',p.version,'player',jsonb_build_object('xp',p.xp,'coins',p.coins,'level',domine_pet_v6.level_v6(p.xp)),
    'inventory',coalesce((select jsonb_agg(item_id order by item_id) from domine_pet_v6.inventory where player_id=p.id),'[]'::jsonb),
    'equipment',coalesce((select jsonb_agg(jsonb_build_object('pet_id',pet_id,'slot',slot,'item_id',item_id)) from domine_pet_v6.equipment where player_id=p.id),'[]'::jsonb),
    'album',coalesce((select jsonb_agg(entry_id order by entry_id) from domine_pet_v6.album where player_id=p.id),'[]'::jsonb),
    'badges',coalesce((select jsonb_agg(achievement_id order by achievement_id) from domine_pet_v6.achievement where player_id=p.id),'[]'::jsonb),
    'daily',coalesce((select jsonb_build_object('reward_actions',reward_actions,'explore_finishes',explore_finishes,'walk_claims',walk_claims) from domine_pet_v6.daily where player_id=p.id and kst_date=(now() at time zone 'Asia/Seoul')::date),'{"reward_actions":0,"explore_finishes":0,"walk_claims":0}'::jsonb),
    'ticket',(select jsonb_build_object('id',id,'map_id',map_id,'eligible_at',eligible_at,'expires_at',expires_at) from domine_pet_v6.exploration where player_id=p.id and finished_at is null and cancelled_at is null and expires_at>now()),
    'season',domine_pet_v6.season_for_date_v6((now() at time zone 'Asia/Seoul')::date),
    'shared',case when p_pet in (1,2) then jsonb_build_object('applied',false,'reason',null,'pet',public.domine_pet_state_for(p_pet,p.nickname)) else null end
  ) from domine_pet_v6.player p where p.id=p_player;
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
    (select count(*)=5 from domine_pet_v6.counter where player_id=p_player and metric like 'explore_map:%' and value>=1),
    domine_pet_v6.count_v6(p_player,'explore_total')>=10, domine_pet_v6.count_v6(p_player,'explore_total')>=50,
    domine_pet_v6.count_v6(p_player,'explore_map:church')>=10, domine_pet_v6.count_v6(p_player,'explore_map:street')>=10,
    least(domine_pet_v6.count_v6(p_player,'explore_map:field'),domine_pet_v6.count_v6(p_player,'explore_map:park'),domine_pet_v6.count_v6(p_player,'explore_map:home'))>=5,
    domine_pet_v6.count_v6(p_player,'explore_time:night')>=5,
    core_count>=10,core_count>=30,core_count>=60,domine_pet_v6.count_v6(p_player,'purchase_total')>=1,
    (select count(*)>=3 from domine_pet_v6.counter where player_id=p_player and metric like 'equipped_item:%' and value>=1),
    (select count(*)>=3 from domine_pet_v6.inventory i join domine_pet_v6.catalog c on c.id=i.item_id where i.player_id=p_player and c.slot='toy'),
    (select xp=9280 from domine_pet_v6.player where id=p_player)
  ];
  with added as (
    insert into domine_pet_v6.achievement(player_id,achievement_id)
    select p_player,'A'||lpad(g::text,2,'0') from generate_series(1,30) g where flags[g]
    on conflict do nothing returning achievement_id
  ) select coalesce(jsonb_agg(achievement_id),'[]'::jsonb) into fresh from added;
  return fresh;
end $$;

create or replace function public.domine_pet_capabilities_v6() returns jsonb
language sql security definer set search_path='' as $$ select '{"version":6}'::jsonb; $$;
create or replace function public.domine_pet_register_v6(p_nickname text,p_secret text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare p domine_pet_v6.player; nick text:=normalize(btrim(p_nickname),NFC);
begin
  if not domine_pet_v6.valid_identity_v6(p_nickname,p_secret) then return domine_pet_v6.result_v6('INVALID_INPUT'); end if;
  perform pg_catalog.pg_advisory_xact_lock(20261111,120006);
  select * into p from domine_pet_v6.player where nickname_key=lower(nick) for update;
  if found then
    if p.secret_hash<>extensions.digest(p_secret,'sha256') then return domine_pet_v6.result_v6('NICKNAME_TAKEN'); end if;
    return domine_pet_v6.snapshot_v6(p.id,1);
  end if;
  if not domine_pet_v6.rate_v6('register:hour',date_trunc('hour',now()),60)
     or not domine_pet_v6.rate_v6('register:day',date_trunc('day',now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul',300) then
    return domine_pet_v6.result_v6('RATE_LIMITED');
  end if;
  insert into domine_pet_v6.player(nickname,nickname_key,secret_hash) values(nick,lower(nick),extensions.digest(p_secret,'sha256')) returning * into p;
  return domine_pet_v6.snapshot_v6(p.id,1);
end $$;
create or replace function public.domine_pet_state_v6(p_nickname text,p_secret text,p_pet int) returns jsonb
language plpgsql security definer set search_path='' as $$
declare p domine_pet_v6.player;
begin
  if not domine_pet_v6.valid_identity_v6(p_nickname,p_secret) or p_pet is null or p_pet not in (1,2) then return domine_pet_v6.result_v6('INVALID_INPUT'); end if;
  select * into p from domine_pet_v6.player where nickname_key=lower(normalize(btrim(p_nickname),NFC)) for update;
  if not found or p.secret_hash<>extensions.digest(p_secret,'sha256') then return domine_pet_v6.result_v6('AUTH_FAILED'); end if;
  if not domine_pet_v6.rate_v6('state:'||p.id,date_trunc('minute',now()),12) then return domine_pet_v6.result_v6('RATE_LIMITED'); end if;
  return domine_pet_v6.snapshot_v6(p.id,p_pet);
end $$;

-- Only the typed public wrappers may call this dispatcher; callers never supply reward values.
create or replace function domine_pet_v6.command_v6(p_nickname text,p_secret text,p_request_id uuid,p_kind text,p_input jsonb) returns jsonb
language plpgsql set search_path='' as $$
#variable_conflict use_column
declare
  p domine_pet_v6.player; op domine_pet_v6.operation; item domine_pet_v6.catalog;
  ticket domine_pet_v6.exploration; session domine_pet_v6.walk_session; day domine_pet_v6.daily;
  payload bytea; result jsonb; shared jsonb; extra jsonb:='{}'; code text:='OK';
  today date:=(now() at time zone 'Asia/Seoul')::date; band text; season text;
  pet int; action text; map text; entry text; slot text;
  xp_gain int:=0; coin_gain int:=0; level_coins int:=0; old_level int; new_level int;
  new_entries jsonb:='[]'; new_badges jsonb:='[]'; existed boolean; can_find boolean; pity boolean;
  rarity text; roll float; eligible boolean; last_time timestamptz; new_id uuid;
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
    if op.created_at<now()-interval '30 days' then return domine_pet_v6.snapshot_v6(p.id,1)||domine_pet_v6.result_v6('ALREADY_APPLIED')||jsonb_build_object('requestId',p_request_id); end if;
    return op.result;
  end if;
  pet:=(p_input->>'pet')::int; action:=p_input->>'action'; map:=p_input->>'map'; entry:=p_input->>'item'; slot:=p_input->>'slot';
  if (p_kind in ('action','equip') and (pet is null or pet not in (1,2)))
     or (p_kind='action' and (action is null or action not in ('feed','treat','pet','play','walk','brush','bath','train')))
     or (p_kind='purchase' and (entry is null or entry !~ '^0(6[1-9]|7[0-9]|80)$'))
     or (p_kind='equip' and (slot is null or slot not in ('wearable','toy') or (entry is not null and entry !~ '^0(6[1-9]|7[0-9]|80)$')))
     or (p_kind='explore_begin' and (map is null or map not in ('church','field','street','park','home') or p_input->>'source' is null or p_input->>'source' not in ('map','walk')))
     or (p_kind='explore_finish' and p_input->>'ticket' is null)
     or (p_kind in ('walk_claim','walk_end') and p_input->>'session' is null)
     or (p_kind='record_season' and (p_input->>'entry' is null or p_input->>'entry' !~ '^0(8[1-9]|9[0-2])$')) then
    return domine_pet_v6.result_v6('INVALID_INPUT');
  end if;
  if not domine_pet_v6.rate_v6('change:'||p.id,date_trunc('minute',now()),30)
     or not domine_pet_v6.rate_v6('change:global',date_trunc('minute',now()),300) then
    return domine_pet_v6.result_v6('RATE_LIMITED')||jsonb_build_object('retryAfterSeconds',60);
  end if;
  insert into domine_pet_v6.daily(player_id,kst_date) values(p.id,today) on conflict do nothing;
  select * into day from domine_pet_v6.daily where player_id=p.id and kst_date=today;
  old_level:=domine_pet_v6.level_v6(p.xp);

  if p_kind='action' then
    -- There is no personal submission cooldown. Shared v5 limits never gate visual play or personal eligibility.
    shared:=public.domine_pet_care_for(pet,p.nickname,action);
    eligible:=day.reward_actions<40
      and not exists(select 1 from domine_pet_v6.action_clock where player_id=p.id and action='all' and last_reward_at>now()-interval '10 seconds')
      and not exists(select 1 from domine_pet_v6.action_clock c where c.player_id=p.id and c.action=command_v6.action and c.last_reward_at>now()-interval '60 seconds');
    if eligible then
      select x,c into xp_gain,coin_gain from (values ('feed',8,4),('treat',6,3),('pet',5,2),('play',10,5),('walk',10,6),('brush',8,4),('bath',10,5),('train',10,5)) r(a,x,c) where r.a=action;
      insert into domine_pet_v6.action_clock(player_id,action,last_reward_at,last_submit_at) values(p.id,action,now(),now()),(p.id,'all',now(),now())
        on conflict(player_id,action) do update set last_reward_at=excluded.last_reward_at,last_submit_at=excluded.last_submit_at;
      update domine_pet_v6.daily set reward_actions=reward_actions+1 where player_id=p.id and kst_date=today;
      perform domine_pet_v6.increment_v6(p.id,'action_total');
      perform domine_pet_v6.increment_v6(p.id,'action:'||action);
      perform domine_pet_v6.increment_v6(p.id,'pet:'||pet);
    end if;
    extra:=jsonb_build_object('shared',jsonb_build_object('applied',coalesce((shared->>'ok')::boolean,false),'reason',shared->>'message','pet',public.domine_pet_state_for(pet,p.nickname)));
  elsif p_kind='purchase' then
    select * into item from domine_pet_v6.catalog where id=entry and acquisition='shop';
    if not found then code:='INVALID_INPUT';
    elsif exists(select 1 from domine_pet_v6.inventory where player_id=p.id and item_id=entry) then code:='ALREADY_OWNED';
    elsif p.coins<item.price then code:='INSUFFICIENT_COINS';
    else
      update domine_pet_v6.player set coins=coins-item.price where id=p.id;
      insert into domine_pet_v6.inventory(player_id,item_id) values(p.id,entry);
      insert into domine_pet_v6.album(player_id,entry_id) values(p.id,entry) on conflict do nothing;
      new_entries:=jsonb_build_array(entry);
      perform domine_pet_v6.increment_v6(p.id,'purchase_total');
    end if;
  elsif p_kind='equip' then
    if entry is not null and not exists(select 1 from domine_pet_v6.inventory i join domine_pet_v6.catalog c on c.id=i.item_id where i.player_id=p.id and i.item_id=entry and c.slot=command_v6.slot) then code:='NOT_OWNED';
    else
      insert into domine_pet_v6.equipment(player_id,pet_id,slot,item_id) values(p.id,pet,slot,entry)
        on conflict(player_id,pet_id,slot) do update set item_id=excluded.item_id;
      if entry is not null and slot='wearable' then perform domine_pet_v6.increment_v6(p.id,'equipped_item:'||entry); end if;
    end if;
  elsif p_kind='explore_begin' then
    -- A move always cancels the old map's ticket, even when the new reward ticket is rate limited.
    update domine_pet_v6.exploration set cancelled_at=now() where player_id=p.id and finished_at is null and cancelled_at is null;
    select max(started_at) into last_time from domine_pet_v6.exploration where player_id=p.id;
    if day.explore_starts>=60 or last_time>now()-interval '30 seconds' then code:='RATE_LIMITED';
    else
      insert into domine_pet_v6.exploration(player_id,map_id,source,eligible_at,expires_at) values(p.id,map,p_input->>'source',now()+interval '15 seconds',now()+interval '10 minutes') returning id into new_id;
      update domine_pet_v6.daily set explore_starts=explore_starts+1 where player_id=p.id and kst_date=today;
    end if;
  elsif p_kind='explore_finish' then
    select * into ticket from domine_pet_v6.exploration where id=(p_input->>'ticket')::uuid and player_id=p.id for update;
    if not found then code:='INVALID_INPUT';
    elsif ticket.finished_at is not null then
      result:=ticket.result;
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
        update domine_pet_v6.daily set explore_finishes=explore_finishes+1 where player_id=p.id and kst_date=today;
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
      update domine_pet_v6.daily set walk_claims=walk_claims+1 where player_id=p.id and kst_date=today;
    end if;
  end if;

  new_level:=domine_pet_v6.level_v6(least(9280,p.xp+xp_gain));
  select coalesce(sum(10+2*g),0)::int into level_coins from generate_series(old_level+1,new_level) g;
  xp_gain:=least(9280-p.xp,xp_gain);
  update domine_pet_v6.player set xp=xp+xp_gain,coins=coins+coin_gain+level_coins,version=version+1 where id=p.id;
  new_badges:=domine_pet_v6.badges_v6(p.id);
  result:=domine_pet_v6.snapshot_v6(p.id,coalesce(pet,1))||domine_pet_v6.result_v6(code)||extra||jsonb_build_object(
    'requestId',p_request_id,'reward',jsonb_build_object('xp',xp_gain,'coins',coin_gain,'levelCoins',level_coins,'newEntries',new_entries,'newBadges',new_badges));
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
  if op.created_at<now()-interval '30 days' then return domine_pet_v6.snapshot_v6(p.id,1)||domine_pet_v6.result_v6('ALREADY_APPLIED')||jsonb_build_object('requestId',p_request_id); end if;
  return op.result;
end $$;

create or replace function public.domine_pet_action_v6(p_nickname text,p_secret text,p_request_id uuid,p_pet int,p_action text) returns jsonb
language sql security definer set search_path='' as $$
  select domine_pet_v6.command_v6(p_nickname,p_secret,p_request_id,'action',jsonb_build_object('pet',p_pet,'action',p_action));
$$;
create or replace function public.domine_pet_purchase_v6(p_nickname text,p_secret text,p_request_id uuid,p_item text) returns jsonb
language sql security definer set search_path='' as $$
  select domine_pet_v6.command_v6(p_nickname,p_secret,p_request_id,'purchase',jsonb_build_object('item',p_item));
$$;
create or replace function public.domine_pet_equip_v6(p_nickname text,p_secret text,p_request_id uuid,p_pet int,p_slot text,p_item text) returns jsonb
language sql security definer set search_path='' as $$
  select domine_pet_v6.command_v6(p_nickname,p_secret,p_request_id,'equip',jsonb_build_object('pet',p_pet,'slot',p_slot,'item',p_item));
$$;
create or replace function public.domine_pet_explore_begin_v6(p_nickname text,p_secret text,p_request_id uuid,p_map text,p_source text) returns jsonb
language sql security definer set search_path='' as $$
  select domine_pet_v6.command_v6(p_nickname,p_secret,p_request_id,'explore_begin',jsonb_build_object('map',p_map,'source',p_source));
$$;
create or replace function public.domine_pet_explore_finish_v6(p_nickname text,p_secret text,p_request_id uuid,p_ticket uuid) returns jsonb
language sql security definer set search_path='' as $$
  select domine_pet_v6.command_v6(p_nickname,p_secret,p_request_id,'explore_finish',jsonb_build_object('ticket',p_ticket));
$$;
create or replace function public.domine_pet_record_season_v6(p_nickname text,p_secret text,p_request_id uuid,p_entry text) returns jsonb
language sql security definer set search_path='' as $$
  select domine_pet_v6.command_v6(p_nickname,p_secret,p_request_id,'record_season',jsonb_build_object('entry',p_entry));
$$;
create or replace function public.domine_pet_walk_begin_v6(p_nickname text,p_secret text,p_request_id uuid) returns jsonb
language sql security definer set search_path='' as $$
  select domine_pet_v6.command_v6(p_nickname,p_secret,p_request_id,'walk_begin','{}'::jsonb);
$$;
create or replace function public.domine_pet_walk_claim_v6(p_nickname text,p_secret text,p_request_id uuid,p_session uuid) returns jsonb
language sql security definer set search_path='' as $$
  select domine_pet_v6.command_v6(p_nickname,p_secret,p_request_id,'walk_claim',jsonb_build_object('session',p_session));
$$;
create or replace function public.domine_pet_walk_end_v6(p_nickname text,p_secret text,p_request_id uuid,p_session uuid) returns jsonb
language sql security definer set search_path='' as $$
  select domine_pet_v6.command_v6(p_nickname,p_secret,p_request_id,'walk_end',jsonb_build_object('session',p_session));
$$;
alter table domine_pet_v6.player enable row level security;
alter table domine_pet_v6.catalog enable row level security;
alter table domine_pet_v6.inventory enable row level security;
alter table domine_pet_v6.equipment enable row level security;
alter table domine_pet_v6.album enable row level security;
alter table domine_pet_v6.achievement enable row level security;
alter table domine_pet_v6.counter enable row level security;
alter table domine_pet_v6.daily enable row level security;
alter table domine_pet_v6.action_clock enable row level security;
alter table domine_pet_v6.operation enable row level security;
alter table domine_pet_v6.exploration enable row level security;
alter table domine_pet_v6.walk_session enable row level security;
alter table domine_pet_v6.rate_bucket enable row level security;
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

