-- Migrate the data layer from Supabase Auth (uuid user_id + FK to auth.users +
-- auth.uid()) to Firebase third-party auth, whose `sub` claim is the Firebase UID
-- — a non-UUID string that has no row in auth.users.
--
-- Without this migration every insert fails (22P02 invalid uuid / 23503 FK) and
-- every RLS-gated select returns zero rows, because auth.uid() coerces the
-- Firebase `sub` to uuid and yields NULL. See src/lib/supabase.ts.

-- 1. Drop the auth.users foreign keys (they can never be satisfied for Firebase users).
alter table public.people        drop constraint if exists people_user_id_fkey;
alter table public.connections   drop constraint if exists connections_user_id_fkey;
alter table public.groups_custom drop constraint if exists groups_custom_user_id_fkey;

-- 2. Store the Firebase UID as text instead of uuid.
alter table public.people        alter column user_id type text using user_id::text;
alter table public.connections   alter column user_id type text using user_id::text;
alter table public.groups_custom alter column user_id type text using user_id::text;

-- 3. Rewrite RLS to compare against the Firebase JWT `sub` claim (text), as the
--    Supabase client documents it should.
drop policy if exists "own_people"      on public.people;
drop policy if exists "own_connections" on public.connections;
drop policy if exists "own_groups"      on public.groups_custom;

create policy "own_people" on public.people
  for all
  using ((auth.jwt() ->> 'sub') = user_id)
  with check ((auth.jwt() ->> 'sub') = user_id);

create policy "own_connections" on public.connections
  for all
  using ((auth.jwt() ->> 'sub') = user_id)
  with check ((auth.jwt() ->> 'sub') = user_id);

create policy "own_groups" on public.groups_custom
  for all
  using ((auth.jwt() ->> 'sub') = user_id)
  with check ((auth.jwt() ->> 'sub') = user_id);
