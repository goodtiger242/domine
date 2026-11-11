-- Names now work from any device: every player's token becomes the one the site derives from the name
-- (sha256 hex of 'domine-pet-v1:' || name). Safe to run more than once. The shared album row is left alone.
begin;
update domine_pet_v6.player
set secret_hash = extensions.digest(encode(extensions.digest(convert_to('domine-pet-v1:' || nickname, 'UTF8'), 'sha256'), 'hex'), 'sha256')
where id <> 'a1b2c3d4-0000-4000-8000-000000000001'::uuid;
commit;
