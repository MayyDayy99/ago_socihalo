-- Network Merge v1 — fixes from the post-build verification pass.
--   * Exclude archived people everywhere (privacy leak: archived partner contacts leaked
--     via edges / identity_pairs and anchored T1 exposure).
--   * Persist rejected suggested matches (tombstone) so compute doesn't resurrect them.
--   * Suggested matching: only unambiguous unique-name pairs (no N×M cross-join explosion).
--   * Dedup invites (one pending/active session per initiator+partner_email).
--   * Restore the design's no_self_merge invariant.

-- Rejected-match tombstone.
alter table public.merge_identity_map add column if not exists rejected boolean not null default false;

-- One live invite per pair + self-merge guard.
create unique index if not exists merge_sessions_active_pair
  on public.merge_sessions (initiator_id, lower(partner_email))
  where status in ('pending','active');

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'no_self_merge' and conrelid = 'public.merge_sessions'::regclass
  ) then
    alter table public.merge_sessions add constraint no_self_merge check (initiator_id <> coalesce(partner_id, ''));
  end if;
end $$;

-- ── create_merge_invite: dedup ──────────────────────────────────────────────
create or replace function public.create_merge_invite(p_partner_email text, p_share_level text default 'standard')
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_sub text := auth.jwt() ->> 'sub'; v_my_email text := lower(auth.jwt() ->> 'email'); v_id uuid;
begin
  if v_sub is null then raise exception 'not authenticated'; end if;
  if p_share_level not in ('minimum','match_only','standard','full') then raise exception 'invalid share level'; end if;
  if lower(p_partner_email) = v_my_email then raise exception 'cannot merge with yourself'; end if;
  -- Lazily close this initiator's time-expired sessions so they don't block a fresh invite.
  update public.merge_sessions set status = 'expired'
    where initiator_id = v_sub and status in ('pending','active') and expires_at <= now();
  -- Reuse an existing pending/active session for this pair instead of creating a duplicate.
  select id into v_id from public.merge_sessions
    where initiator_id = v_sub and partner_email = lower(p_partner_email) and status in ('pending','active')
    limit 1;
  if v_id is not null then return v_id; end if;
  insert into public.merge_sessions (initiator_id, partner_email, initiator_share_level)
  values (v_sub, lower(p_partner_email), p_share_level) returning id into v_id;
  return v_id;
end; $$;

-- ── confirm_identity_match: reject = tombstone (keep the row) ────────────────
create or replace function public.confirm_identity_match(p_map_id uuid, p_confirm boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare v_sub text := auth.jwt() ->> 'sub'; s public.merge_sessions; m public.merge_identity_map;
begin
  select * into m from public.merge_identity_map where id = p_map_id;
  if not found then raise exception 'match not found'; end if;
  select * into s from public.merge_sessions where id = m.session_id;
  if v_sub not in (s.initiator_id, coalesce(s.partner_id,'')) then raise exception 'not a participant'; end if;
  if s.status <> 'active' then raise exception 'session not active'; end if;
  if not p_confirm then
    update public.merge_identity_map
      set rejected = true, confirmed_by_initiator = false, confirmed_by_partner = false
      where id = p_map_id;
    return;
  end if;
  if v_sub = s.initiator_id then
    update public.merge_identity_map set confirmed_by_initiator = true, rejected = false where id = p_map_id;
  else
    update public.merge_identity_map set confirmed_by_partner = true, rejected = false where id = p_map_id;
  end if;
end; $$;

-- ── compute_match_candidates: archived-safe, unique-name only, no re-add ─────
create or replace function public.compute_match_candidates(p_session_id uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_sub text := auth.jwt() ->> 'sub'; s public.merge_sessions; v_count int;
begin
  select * into s from public.merge_sessions where id = p_session_id;
  if not found then raise exception 'session not found'; end if;
  if v_sub not in (s.initiator_id, coalesce(s.partner_id,'')) then raise exception 'not a participant'; end if;
  if s.status <> 'active' or now() >= s.expires_at then raise exception 'session not active'; end if;

  -- Phone / email exact intersection → auto-confirmed. Skip archived; skip pairs that already
  -- exist in any state (so rejected tombstones aren't resurrected).
  insert into public.merge_identity_map
    (session_id, initiator_person_id, partner_person_id, match_kind, confirmed_by_initiator, confirmed_by_partner)
  select p_session_id, pi.id, pp.id,
         case when pi.phone_numbers && pp.phone_numbers then 'phone' else 'email' end, true, true
  from public.people pi
  join public.people pp
    on pp.user_id = s.partner_id
   and (pi.phone_numbers && pp.phone_numbers or pi.emails && pp.emails)
  where pi.user_id = s.initiator_id
    and coalesce(pi.archived,false) = false and coalesce(pp.archived,false) = false
    and not exists (select 1 from public.merge_identity_map m
                    where m.session_id = p_session_id and m.initiator_person_id = pi.id and m.partner_person_id = pp.id)
  on conflict (session_id, initiator_person_id, partner_person_id) do nothing;

  -- Suggested: only UNAMBIGUOUS unique names on both sides (avoids N×M explosion + noise).
  with iu as (
    select lower(btrim(display_name)) nm, (array_agg(id))[1] id
    from public.people where user_id = s.initiator_id and coalesce(archived,false) = false
    group by lower(btrim(display_name)) having count(*) = 1
  ),
  pu as (
    select lower(btrim(display_name)) nm, (array_agg(id))[1] id
    from public.people where user_id = s.partner_id and coalesce(archived,false) = false
    group by lower(btrim(display_name)) having count(*) = 1
  )
  insert into public.merge_identity_map
    (session_id, initiator_person_id, partner_person_id, match_kind, confirmed_by_initiator, confirmed_by_partner)
  select p_session_id, iu.id, pu.id, 'suggested', false, false
  from iu join pu on iu.nm = pu.nm
  where not exists (select 1 from public.merge_identity_map m
                    where m.session_id = p_session_id and m.initiator_person_id = iu.id and m.partner_person_id = pu.id)
  on conflict (session_id, initiator_person_id, partner_person_id) do nothing;

  select count(*) into v_count from public.merge_identity_map where session_id = p_session_id;
  return v_count;
end; $$;

-- ── get_merge_view: exclude archived from overlap/bridges/edges/identity_pairs ─
create or replace function public.get_merge_view(p_session_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_sub text := auth.jwt() ->> 'sub'; s public.merge_sessions; v_other_id text; v_other_level text; v_iam_initiator boolean; result jsonb;
begin
  select * into s from public.merge_sessions where id = p_session_id;
  if not found then raise exception 'session not found'; end if;
  if v_sub is null or v_sub not in (s.initiator_id, coalesce(s.partner_id,'')) then raise exception 'not a participant'; end if;
  if s.status <> 'active' or now() >= s.expires_at then raise exception 'session not active'; end if;
  v_iam_initiator := (v_sub = s.initiator_id);
  v_other_id    := case when v_iam_initiator then s.partner_id else s.initiator_id end;
  v_other_level := case when v_iam_initiator then s.partner_share_level else s.initiator_share_level end;
  with
  pairs as (
    select case when v_iam_initiator then initiator_person_id else partner_person_id end as mine_id,
           case when v_iam_initiator then partner_person_id   else initiator_person_id end as theirs_id
    from public.merge_identity_map
    where session_id = p_session_id and confirmed_by_initiator and confirmed_by_partner and not coalesce(rejected,false)
  ),
  -- overlap partner people that are NOT archived
  t0 as (
    select pr.mine_id, pr.theirs_id
    from pairs pr
    join public.people pe on pe.id = pr.theirs_id and pe.user_id = v_other_id and coalesce(pe.archived,false) = false
  ),
  t1 as (
    select distinct p.id as pid from public.people p
    join public.connections c on c.user_id = v_other_id and (c.from_id = p.id or c.to_id = p.id)
    where p.user_id = v_other_id and coalesce(p.archived,false) = false
      and p.id not in (select theirs_id from t0)
      and ((c.from_id in (select theirs_id from t0)) or (c.to_id in (select theirs_id from t0)))
      and public._merge_level_rank(v_other_level) >= 2
  ),
  visible as ( select theirs_id as pid from t0 union select pid from t1 ),
  nodes as (
    select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
      'id', p.id, 'display_name', p.display_name, 'group_key', p.group_key,
      'role_key', case when public._merge_level_rank(v_other_level) >= 2 then p.role_key end,
      'strength', case when public._merge_level_rank(v_other_level) >= 2 then p.strength end,
      'emails', case when public._merge_level_rank(v_other_level) >= 3 then to_jsonb(p.emails) end,
      'phone_numbers', case when public._merge_level_rank(v_other_level) >= 3 then to_jsonb(p.phone_numbers) end,
      'notes', case when public._merge_level_rank(v_other_level) >= 3 then p.notes end,
      'in_overlap', (p.id in (select theirs_id from t0))
    ))) as arr
    from public.people p where p.user_id = v_other_id and p.id in (select pid from visible) and coalesce(p.archived,false) = false
  ),
  edges as (
    select jsonb_agg(jsonb_build_object('from_id', c.from_id, 'to_id', c.to_id, 'type', c.type,
      'strength', case when public._merge_level_rank(v_other_level) >= 2 then c.strength end)) as arr
    from public.connections c where c.user_id = v_other_id
      and c.from_id in (select pid from visible) and c.to_id in (select pid from visible)
  ),
  ident as ( select jsonb_agg(jsonb_build_object('mine', mine_id, 'theirs', theirs_id)) as arr from t0 ),
  hidden as ( select count(*) as n from public.people p where p.user_id = v_other_id and coalesce(p.archived,false) = false and p.id not in (select pid from visible) )
  select jsonb_build_object(
    'session', jsonb_build_object('id', s.id, 'status', s.status, 'expires_at', s.expires_at,
      'my_role', case when v_iam_initiator then 'initiator' else 'partner' end, 'other_share_level', v_other_level),
    'partner_people', coalesce((select arr from nodes), '[]'::jsonb),
    'partner_connections', coalesce((select arr from edges), '[]'::jsonb),
    'identity_pairs', coalesce((select arr from ident), '[]'::jsonb),
    'hidden_partner_count', (select n from hidden)
  ) into result;
  return result;
end; $$;
