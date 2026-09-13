-- Two faults in how a day crossed the link, found by testing it rather than
-- reading it.
--
-- FAULT 1 -- the sharing check could never be true. The policy asked
--   exists (select 1 from user_settings s where s.user_id = busy_blocks.user_id and s.sharing)
-- but a policy expression runs as the CALLING user, so that subquery hit
-- user_settings' own RLS, which only lets you read your own row. Reading
-- somebody else's sharing flag therefore always returned false and the parent
-- saw an empty week no matter what the child had turned on.
--
-- FAULT 2 -- and had it worked, it would have shared too much. RLS grants
-- access to WHOLE ROWS; there is no column-level clause. "linked can read busy
-- times" on the base table would have handed over `label` as well, so a parent
-- could read "Therapy appointment" off a row the UI only ever draws as a grey
-- block. The interface promises "they see the gaps, never what is in them",
-- and a promise the database does not keep is not a promise.
--
-- The fix for both: the base table goes back to owner-only, and the counterpart
-- reads a view that selects the five safe columns and does its own
-- authorisation. The view is deliberately NOT security_invoker -- it runs as
-- its owner so it can check the sharing flag -- which means its WHERE clause is
-- the whole of the access control and has to be read as such.

drop policy if exists "linked can read busy times" on busy_blocks;

create function harbour_shares_day(viewer uuid, subject uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select harbour_linked(viewer, subject)
     and exists (select 1 from user_settings s where s.user_id = subject and s.sharing);
$$;

revoke all on function harbour_shares_day(uuid, uuid) from public, anon;
grant execute on function harbour_shares_day(uuid, uuid) to authenticated;

create or replace view shared_busy
  with (security_invoker = false) as
  select b.id, b.user_id, b.day, b.starts_at, b.ends_at
    from busy_blocks b
   where b.user_id = (select auth.uid())
      or harbour_shares_day((select auth.uid()), b.user_id);

drop policy if exists "read own profile" on profiles;
create policy "read own profile" on profiles for select
  using ((select auth.uid()) = id);

create or replace view shared_profiles
  with (security_invoker = false) as
  select p.id, p.display_name, p.weather, p.weather_at
    from profiles p
   where p.id = (select auth.uid())
      or harbour_linked((select auth.uid()), p.id);

revoke all on shared_busy, shared_profiles from public, anon;
grant select on shared_busy, shared_profiles to authenticated;
