-- ============================================================
-- Burnout Pulse v13: optional server schema (Supabase / Postgres 15+)
-- ============================================================
-- STATUS: Phase 2. The v13 app does NOT call this schema; it runs
-- local-first with encrypted browser storage. This file is the hardened
-- server design for a later, institution-hosted phase. It has been tested
-- against Postgres 16 with a Supabase auth shim (tests/db.sh), not against
-- a live Supabase project.
--
-- Changes from v12 (all found in the v12 penetration test):
--   * Friendships, messages and the leaderboard are removed. v12 let any
--     user confirm whether a colleague had an account (user enumeration),
--     self-accept a friendship without the other person's consent, and
--     message anyone. The leaderboard re-identified people in small teams.
--   * Scores are computed by the database from the answers. Clients can
--     no longer store a score that contradicts its answers.
--   * Field sizes are bounded.
--   * Users can delete their own account (v12 claimed this but had no path).
--   * Row-level security is forced, and policies are scoped to the
--     authenticated role only.
-- ============================================================

-- ---------- retire v12 objects ----------
drop function if exists public.get_leaderboard();
drop function if exists public.request_friend(text);
drop table if exists public.messages;
drop table if exists public.friendships;
alter table if exists public.profiles drop column if exists handle;
alter table if exists public.profiles drop column if exists on_board;

-- ---------- profiles ----------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  first_name  text not null check (char_length(first_name) between 1 and 40),
  created_at  timestamptz not null default now()
);
alter table public.profiles enable row level security;
alter table public.profiles force row level security;

drop policy if exists "read own profile" on public.profiles;
drop policy if exists "update own profile" on public.profiles;
drop policy if exists "insert own profile" on public.profiles;
create policy "read own profile"   on public.profiles for select to authenticated using (auth.uid() = id);
create policy "update own profile" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
-- Profiles are created by the sign-up trigger only; no client insert policy.

-- ---------- checkins ----------
create table if not exists public.checkins (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  score       int  not null check (score between 0 and 100),
  band        text not null check (band in ('steady','strained','heavy','depleted')),
  answers     jsonb not null,
  context     jsonb,
  created_at  timestamptz not null default now()
);
create or replace function public.bp_valid_answers(a jsonb)
returns boolean language sql immutable set search_path = pg_catalog as $$
  select jsonb_typeof(a) = 'object'
    and (select count(*) from jsonb_object_keys(a)) = 6
    and a ?& array['energy','detach','efficacy','control','rest','dread']
    and (select bool_and(jsonb_typeof(v) = 'number' and (v::text)::numeric in (0,1,2,3,4))
         from jsonb_each(a) as e(k, v))
$$;
create or replace function public.bp_valid_context(c jsonb)
returns boolean language sql immutable set search_path = pg_catalog as $$
  select c is null or (
    jsonb_typeof(c) = 'object'
    and not exists (select 1 from jsonb_object_keys(c) k where k not in ('hours','callNights','adverseEvent'))
    and (not c ? 'hours' or (jsonb_typeof(c->'hours') = 'number' and (c->>'hours')::numeric between 0 and 168))
    and (not c ? 'callNights' or (jsonb_typeof(c->'callNights') = 'number' and (c->>'callNights')::numeric between 0 and 7))
    and (not c ? 'adverseEvent' or jsonb_typeof(c->'adverseEvent') = 'boolean')
  )
$$;
alter table public.checkins drop constraint if exists answers_shape;
alter table public.checkins add constraint answers_shape check (public.bp_valid_answers(answers));
alter table public.checkins drop constraint if exists context_shape;
alter table public.checkins add constraint context_shape check (public.bp_valid_context(context));

-- The database, not the client, decides score and band.
create or replace function public.checkins_compute_score()
returns trigger language plpgsql as $$
declare raw int;
begin
  select sum((v::text)::int) into raw from jsonb_each(new.answers) as e(k, v);
  new.score := round(raw::numeric / 24 * 100);
  new.band := case when new.score <= 24 then 'steady' when new.score <= 49 then 'strained'
                   when new.score <= 74 then 'heavy' else 'depleted' end;
  new.user_id := auth.uid();       -- never trust a client-supplied owner
  new.created_at := now();
  return new;
end $$;
drop trigger if exists checkins_score on public.checkins;
create trigger checkins_score before insert on public.checkins
  for each row execute function public.checkins_compute_score();

alter table public.checkins enable row level security;
alter table public.checkins force row level security;
drop policy if exists "read own checkins" on public.checkins;
drop policy if exists "insert own checkins" on public.checkins;
drop policy if exists "delete own checkins" on public.checkins;
create policy "read own checkins"   on public.checkins for select to authenticated using (auth.uid() = user_id);
create policy "insert own checkins" on public.checkins for insert to authenticated with check (auth.uid() = user_id);
create policy "delete own checkins" on public.checkins for delete to authenticated using (auth.uid() = user_id);
-- No update policy: check-ins are append-only.

-- ---------- coach_messages ----------
create table if not exists public.coach_messages (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  role        text not null check (role in ('user','coach','care','note')),
  body        text not null check (char_length(body) <= 4000),
  created_at  timestamptz not null default now()
);
alter table public.coach_messages drop constraint if exists coach_messages_body_check;
alter table public.coach_messages add constraint coach_messages_body_check check (char_length(body) <= 4000);
alter table public.coach_messages drop constraint if exists coach_messages_role_check;
alter table public.coach_messages add constraint coach_messages_role_check check (role in ('user','coach','care','note'));
alter table public.coach_messages enable row level security;
alter table public.coach_messages force row level security;
drop policy if exists "read own coach messages" on public.coach_messages;
drop policy if exists "insert own coach messages" on public.coach_messages;
drop policy if exists "delete own coach messages" on public.coach_messages;
create policy "read own coach messages"   on public.coach_messages for select to authenticated using (auth.uid() = user_id);
create policy "insert own coach messages" on public.coach_messages for insert to authenticated with check (auth.uid() = user_id);
create policy "delete own coach messages" on public.coach_messages for delete to authenticated using (auth.uid() = user_id);

-- ---------- privileges ----------
revoke all on public.profiles, public.checkins, public.coach_messages from anon;
revoke all on public.profiles, public.checkins, public.coach_messages from public;
revoke all on public.profiles, public.checkins, public.coach_messages from authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, delete on public.checkins, public.coach_messages to authenticated;

-- ---------- account deletion (self-service) ----------
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  delete from auth.users where id = auth.uid();   -- cascades to every table above
end $$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- ---------- retention ----------
-- Coach messages older than the retention window are purged. Schedule with
-- pg_cron, e.g.: select cron.schedule('bp-retention','17 3 * * *',
--   $$select public.purge_old_coach_messages(180)$$);
create or replace function public.purge_old_coach_messages(days int default 180)
returns int language sql security definer set search_path = public, pg_temp as $$
  with d as (delete from public.coach_messages where created_at < now() - make_interval(days => days) returning 1)
  select count(*)::int from d;
$$;
revoke all on function public.purge_old_coach_messages(int) from public, anon, authenticated;

-- ---------- profile on sign-up ----------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.profiles (id, first_name)
  values (new.id, left(coalesce(nullif(trim(new.raw_user_meta_data->>'first_name'), ''), 'there'), 40));
  return new;
end $$;
revoke all on function public.handle_new_user() from public, anon, authenticated;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
