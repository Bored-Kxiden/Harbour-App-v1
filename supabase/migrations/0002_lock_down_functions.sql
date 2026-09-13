-- Close the function surface Supabase's linter found.
--
-- 1. handle_new_user() is a trigger function. PostgREST exposes every function
--    in `public`, so as it stood anyone could POST /rpc/handle_new_user and run
--    a SECURITY DEFINER insert. Triggers do not check EXECUTE when they fire
--    (only when they are created), so revoking costs nothing.
--
-- 2. harbour_linked() must stay executable by `authenticated`: RLS policy
--    expressions are evaluated as the calling role, so revoking it there would
--    break every cross-account read. It does not need to be reachable by an
--    anonymous caller, or callable as an RPC to probe whether two accounts know
--    each other.
--
-- 3. Both trigger helpers get a pinned search_path, so a role-level search_path
--    cannot decide which `profiles` they write to.

revoke all on function handle_new_user() from public, anon, authenticated;
revoke all on function harbour_new_invite_code() from public, anon, authenticated;
revoke all on function harbour_linked(uuid, uuid) from public, anon;
grant execute on function harbour_linked(uuid, uuid) to authenticated;
revoke all on function redeem_invite(text, text) from public, anon;
grant execute on function redeem_invite(text, text) to authenticated;

alter function harbour_new_invite_code() set search_path = public;
alter function touch_updated_at() set search_path = public;
