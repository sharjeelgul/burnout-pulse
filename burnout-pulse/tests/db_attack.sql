-- Replays the v12 penetration-test chain against the v13 schema.
-- Every block must end in PASS. Run via tests/db.sh.
\set ON_ERROR_STOP 1
insert into auth.users(id,email,raw_user_meta_data) values
 ('00000000-0000-0000-0000-00000000000a','attacker@x.org','{"first_name":"Mallory"}'),
 ('00000000-0000-0000-0000-00000000000b','resident.b@hospital.org','{"first_name":"Bob"}');

set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000b',false);
insert into public.checkins(answers) values ('{"energy":4,"detach":4,"efficacy":3,"control":4,"rest":4,"dread":4}');
insert into public.coach_messages(role,body) values ('user','private note');

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false);
do $$ begin
  -- C1 read other users' data
  if (select count(*) from public.checkins) <> 0 or (select count(*) from public.coach_messages) <> 0
     or (select count(*) from public.profiles) <> 1 then raise exception 'FAIL C1 cross-user read'; end if;
  raise notice 'PASS C1 cannot read other users';
  -- C2 forged score: client says 0 with all-4 answers
  insert into public.checkins(score,band,answers) values (0,'steady','{"energy":4,"detach":4,"efficacy":4,"control":4,"rest":4,"dread":4}');
  if (select score from public.checkins where user_id = auth.uid()) <> 100 then raise exception 'FAIL C2 score forged'; end if;
  raise notice 'PASS C2 score recomputed by database (client sent 0, stored 100)';
  -- C2b impersonate owner
  insert into public.checkins(user_id,answers) values ('00000000-0000-0000-0000-00000000000b','{"energy":0,"detach":0,"efficacy":0,"control":0,"rest":0,"dread":0}');
  if exists (select 1 from public.checkins where user_id <> auth.uid()) then raise exception 'FAIL C2b'; end if;
  raise notice 'PASS C2b owner forced to caller';
end $$;

\set ON_ERROR_STOP 0
\echo '--- expect errors below (each is a blocked attack) ---'
select public.request_friend('resident.b@hospital.org');                                  -- C3 enumeration: function gone
insert into public.checkins(answers) values ('{"energy":9,"detach":0,"efficacy":0,"control":0,"rest":0,"dread":0}');  -- C2c out of range
insert into public.checkins(answers) values ('{"energy":1}');                              -- C2d missing keys
insert into public.checkins(answers,context) values ('{"energy":0,"detach":0,"efficacy":0,"control":0,"rest":0,"dread":0}','{"hours":999}'); -- bad context
insert into public.coach_messages(role,body) values ('user',repeat('x',5000000));          -- C9 unbounded body
insert into public.profiles(id,first_name) values (gen_random_uuid(),'x');                 -- no client insert
select public.purge_old_coach_messages(0);                                                 -- admin-only
update public.checkins set answers = answers;                                              -- append-only
\set ON_ERROR_STOP 1
do $$ begin
  if (select count(*) from public.checkins where user_id = auth.uid()) <> 2 then raise exception 'FAIL validation let a bad row in'; end if;
  if (select count(*) from public.coach_messages where user_id = auth.uid()) <> 0 then raise exception 'FAIL C9'; end if;
  raise notice 'PASS C2c/C2d/C9 invalid rows rejected';
end $$;
-- C7 self-service deletion
select public.delete_my_account();
reset role;
do $$ begin
  if exists (select 1 from auth.users where id='00000000-0000-0000-0000-00000000000a')
     or exists (select 1 from public.checkins where user_id='00000000-0000-0000-0000-00000000000a')
     or exists (select 1 from public.profiles where id='00000000-0000-0000-0000-00000000000a') then raise exception 'FAIL C7'; end if;
  if (select count(*) from public.checkins where user_id='00000000-0000-0000-0000-00000000000b') <> 1 then raise exception 'FAIL C7 collateral'; end if;
  raise notice 'PASS C7 account deleted with cascade; other user untouched';
end $$;
set role anon;
\set ON_ERROR_STOP 0
select count(*) from public.checkins;  -- anon blocked
