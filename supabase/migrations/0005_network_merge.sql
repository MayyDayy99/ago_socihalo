-- ============================================================================
-- Network Merge (v1) — two consenting users temporarily co-view their networks.
-- See merge-networks-design.md.
--
-- Security model:
--   * READS  -> RLS SELECT policies (participant by sub or invited email) + realtime.
--   * WRITES -> SECURITY DEFINER RPCs only (no INSERT/UPDATE/DELETE policies), so the
--               rules (only-invitee-can-accept, downgrade-only, etc.) can't be bypassed.
--   * VIEW   -> get_merge_view() SECURITY DEFINER read-only; it enforces the caller is an
--               active participant and applies share-level + relevance (T0/T1) filtering.
-- ============================================================================

-- ── Tables ──────────────────────────────────────────────────────────────────
create table if not exists public.merge_sessions (
  id                    uuid primary key default gen_random_uuid(),
  initiator_id          text not null,
  partner_email         text not null,
  partner_id            text,
  initiator_share_level text not null default 'standard'
                        check (initiator_share_level in ('minimum','match_only','standard','full')),
  partner_share_level   text
                        check (partner_share_level in ('minimum','match_only','standard','full')),
  status                text not null default 'pending'
                        check (status in ('pending','active','declined','expired','revoked')),
  created_at            timestamptz default now(),
  expires_at            timestamptz default (now() + interval '24 hours'),
  revoked_at            timestamptz
);
create index if not exists merge_sessions_initiator_idx     on public.merge_sessions (initiator_id, status);
create index if not exists merge_sessions_partner_email_idx on public.merge_sessions (lower(partner_email), status);
create index if not exists merge_sessions_partner_idx       on public.merge_sessions (partner_id, status);

create table if not exists public.merge_identity_map (
  id                     uuid primary key default gen_random_uuid(),
  session_id             uuid references public.merge_sessions(id) on delete cascade not null,
  initiator_person_id    uuid references public.people(id) on delete cascade not null,
  partner_person_id      uuid references public.people(id) on delete cascade not null,
  match_kind             text not null check (match_kind in ('phone','email','manual','suggested')),
  confirmed_by_initiator boolean default false,
  confirmed_by_partner   boolean default false,
  created_at             timestamptz default now(),
  unique (session_id, initiator_person_id, partner_person_id)
);
create index if not exists merge_identity_session_idx on public.merge_identity_map (session_id);

-- ── RLS (reads only; writes go through RPCs) ────────────────────────────────
alter table public.merge_sessions     enable row level security;
alter table public.merge_identity_map enable row level security;

drop policy if exists "merge_sessions_read" on public.merge_sessions;
create policy "merge_sessions_read" on public.merge_sessions
  for select using (
        (auth.jwt() ->> 'sub')            = initiator_id
     or (auth.jwt() ->> 'sub')            = partner_id
     or lower(auth.jwt() ->> 'email')     = lower(partner_email)
  );

drop policy if exists "merge_identity_read" on public.merge_identity_map;
create policy "merge_identity_read" on public.merge_identity_map
  for select using (
    exists (
      select 1 from public.merge_sessions s
      where s.id = session_id
        and (auth.jwt() ->> 'sub') in (s.initiator_id, s.partner_id)
    )
  );

-- ── Realtime ────────────────────────────────────────────────────────────────
alter table public.merge_sessions     replica identity full;
alter table public.merge_identity_map replica identity full;
do $$
begin
  if exists (select 1 from pg_publication where pubname='supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='merge_sessions') then
      execute 'alter publication supabase_realtime add table public.merge_sessions';
    end if;
    if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='merge_identity_map') then
      execute 'alter publication supabase_realtime add table public.merge_identity_map';
    end if;
  end if;
end $$;

-- ── Helpers ─────────────────────────────────────────────────────────────────
create or replace function public._merge_level_rank(lvl text) returns int
language sql immutable set search_path = '' as $$
  select case lvl
    when 'minimum' then 0 when 'match_only' then 1
    when 'standard' then 2 when 'full' then 3 else -1 end;
$$;

-- ── RPC: create an invite ───────────────────────────────────────────────────
create or replace function public.create_merge_invite(p_partner_email text, p_share_level text default 'standard')
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_sub text := auth.jwt() ->> 'sub';
  v_my_email text := lower(auth.jwt() ->> 'email');
  v_id uuid;
begin
  if v_sub is null then raise exception 'not authenticated'; end if;
  if p_share_level not in ('minimum','match_only','standard','full') then
    raise exception 'invalid share level';
  end if;
  if lower(p_partner_email) = v_my_email then
    raise exception 'cannot merge with yourself';
  end if;
  insert into public.merge_sessions (initiator_id, partner_email, initiator_share_level)
  values (v_sub, lower(p_partner_email), p_share_level)
  returning id into v_id;
  return v_id;
end;
$$;

-- ── RPC: accept / decline an invite ─────────────────────────────────────────
create or replace function public.respond_to_merge_invite(p_session_id uuid, p_accept boolean, p_share_level text default 'standard')
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_sub text := auth.jwt() ->> 'sub';
  v_email text := lower(auth.jwt() ->> 'email');
  s public.merge_sessions;
begin
  select * into s from public.merge_sessions where id = p_session_id;
  if not found then raise exception 'session not found'; end if;
  -- Only the invited email (and not the initiator) may respond, while still pending.
  if v_email is null or v_email <> lower(s.partner_email) or v_sub = s.initiator_id then
    raise exception 'not the invited user';
  end if;
  if s.status <> 'pending' then raise exception 'invite is no longer pending'; end if;
  if now() >= s.expires_at then
    update public.merge_sessions set status='expired' where id = p_session_id;
    raise exception 'invite expired';
  end if;

  if p_accept then
    if p_share_level not in ('minimum','match_only','standard','full') then
      raise exception 'invalid share level';
    end if;
    update public.merge_sessions
      set partner_id = v_sub, partner_share_level = p_share_level, status = 'active'
      where id = p_session_id;
  else
    update public.merge_sessions set status = 'declined' where id = p_session_id;
  end if;
end;
$$;

-- ── RPC: change my share level (downgrade only) ─────────────────────────────
create or replace function public.set_merge_share_level(p_session_id uuid, p_level text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_sub text := auth.jwt() ->> 'sub';
  s public.merge_sessions;
begin
  if p_level not in ('minimum','match_only','standard','full') then raise exception 'invalid level'; end if;
  select * into s from public.merge_sessions where id = p_session_id;
  if not found then raise exception 'session not found'; end if;
  if s.status <> 'active' then raise exception 'session not active'; end if;

  if v_sub = s.initiator_id then
    if public._merge_level_rank(p_level) > public._merge_level_rank(s.initiator_share_level) then
      raise exception 'cannot upgrade share level mid-session';
    end if;
    update public.merge_sessions set initiator_share_level = p_level where id = p_session_id;
  elsif v_sub = s.partner_id then
    if public._merge_level_rank(p_level) > public._merge_level_rank(s.partner_share_level) then
      raise exception 'cannot upgrade share level mid-session';
    end if;
    update public.merge_sessions set partner_share_level = p_level where id = p_session_id;
  else
    raise exception 'not a participant';
  end if;
end;
$$;

-- ── RPC: revoke ─────────────────────────────────────────────────────────────
create or replace function public.revoke_merge(p_session_id uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_sub text := auth.jwt() ->> 'sub';
  s public.merge_sessions;
begin
  select * into s from public.merge_sessions where id = p_session_id;
  if not found then raise exception 'session not found'; end if;
  if v_sub not in (s.initiator_id, coalesce(s.partner_id,'')) then raise exception 'not a participant'; end if;
  update public.merge_sessions set status='revoked', revoked_at=now() where id = p_session_id;
end;
$$;

-- ── RPC: compute identity-match candidates ──────────────────────────────────
-- Auto-matches on shared phone/email (confirmed by both); fuzzy name matches as 'suggested'.
create or replace function public.compute_match_candidates(p_session_id uuid)
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_sub text := auth.jwt() ->> 'sub';
  s public.merge_sessions;
  v_count int;
begin
  select * into s from public.merge_sessions where id = p_session_id;
  if not found then raise exception 'session not found'; end if;
  if v_sub not in (s.initiator_id, coalesce(s.partner_id,'')) then raise exception 'not a participant'; end if;
  if s.status <> 'active' or now() >= s.expires_at then raise exception 'session not active'; end if;

  -- Phone / email exact intersection → auto-confirmed.
  insert into public.merge_identity_map
    (session_id, initiator_person_id, partner_person_id, match_kind, confirmed_by_initiator, confirmed_by_partner)
  select p_session_id, pi.id, pp.id,
         case when pi.phone_numbers && pp.phone_numbers then 'phone' else 'email' end,
         true, true
  from public.people pi
  join public.people pp
    on pp.user_id = s.partner_id
   and (pi.phone_numbers && pp.phone_numbers or pi.emails && pp.emails)
  where pi.user_id = s.initiator_id
  on conflict (session_id, initiator_person_id, partner_person_id) do nothing;

  -- Case-insensitive exact name matches (not already auto-matched) → 'suggested'.
  -- (Levenshtein fuzzy matching can be layered on later once fuzzystrmatch is provisioned.)
  insert into public.merge_identity_map
    (session_id, initiator_person_id, partner_person_id, match_kind, confirmed_by_initiator, confirmed_by_partner)
  select p_session_id, pi.id, pp.id, 'suggested', false, false
  from public.people pi
  join public.people pp
    on pp.user_id = s.partner_id
   and lower(btrim(pi.display_name)) = lower(btrim(pp.display_name))
  where pi.user_id = s.initiator_id
  on conflict (session_id, initiator_person_id, partner_person_id) do nothing;

  select count(*) into v_count from public.merge_identity_map where session_id = p_session_id;
  return v_count;
end;
$$;

-- ── RPC: confirm / reject a suggested identity match ────────────────────────
create or replace function public.confirm_identity_match(p_map_id uuid, p_confirm boolean)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_sub text := auth.jwt() ->> 'sub';
  s public.merge_sessions;
  m public.merge_identity_map;
begin
  select * into m from public.merge_identity_map where id = p_map_id;
  if not found then raise exception 'match not found'; end if;
  select * into s from public.merge_sessions where id = m.session_id;
  if v_sub not in (s.initiator_id, coalesce(s.partner_id,'')) then raise exception 'not a participant'; end if;
  if s.status <> 'active' then raise exception 'session not active'; end if;

  if not p_confirm then
    delete from public.merge_identity_map where id = p_map_id;  -- rejecting removes the candidate
    return;
  end if;
  if v_sub = s.initiator_id then
    update public.merge_identity_map set confirmed_by_initiator = true where id = p_map_id;
  else
    update public.merge_identity_map set confirmed_by_partner = true where id = p_map_id;
  end if;
end;
$$;

-- ── The merge view (read-only, share-level + relevance filtered) ────────────
create or replace function public.get_merge_view(p_session_id uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_sub text := auth.jwt() ->> 'sub';
  s public.merge_sessions;
  v_other_id text;
  v_other_level text;
  v_iam_initiator boolean;
  result jsonb;
begin
  select * into s from public.merge_sessions where id = p_session_id;
  if not found then raise exception 'session not found'; end if;
  if v_sub is null or v_sub not in (s.initiator_id, coalesce(s.partner_id,'')) then
    raise exception 'not a participant';
  end if;
  if s.status <> 'active' or now() >= s.expires_at then
    raise exception 'session not active';
  end if;

  v_iam_initiator := (v_sub = s.initiator_id);
  v_other_id      := case when v_iam_initiator then s.partner_id else s.initiator_id end;
  v_other_level   := case when v_iam_initiator then s.partner_share_level else s.initiator_share_level end;

  with
  -- Confirmed identity pairs (both sides), oriented so "mine"/"theirs" is caller-relative.
  pairs as (
    select
      case when v_iam_initiator then initiator_person_id else partner_person_id end as mine_id,
      case when v_iam_initiator then partner_person_id   else initiator_person_id end as theirs_id
    from public.merge_identity_map
    where session_id = p_session_id
      and confirmed_by_initiator and confirmed_by_partner
  ),
  t0 as ( select theirs_id as pid from pairs ),                     -- partner people in the overlap
  -- T1: partner people (not T0) directly connected to a T0 partner person.
  t1 as (
    select distinct p.id as pid
    from public.people p
    join public.connections c
      on c.user_id = v_other_id and (c.from_id = p.id or c.to_id = p.id)
    where p.user_id = v_other_id
      and p.id not in (select pid from t0)
      and (
        (c.from_id in (select pid from t0)) or (c.to_id in (select pid from t0))
      )
      and public._merge_level_rank(v_other_level) >= 2   -- only standard/full expose the frontier
  ),
  visible as ( select pid from t0 union select pid from t1 ),
  nodes as (
    select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
      'id', p.id,
      'display_name', p.display_name,
      'group_key', p.group_key,
      'role_key',   case when public._merge_level_rank(v_other_level) >= 2 then p.role_key end,
      'strength',   case when public._merge_level_rank(v_other_level) >= 2 then p.strength end,
      'emails',     case when public._merge_level_rank(v_other_level) >= 3 then to_jsonb(p.emails) end,
      'phone_numbers', case when public._merge_level_rank(v_other_level) >= 3 then to_jsonb(p.phone_numbers) end,
      'notes',      case when public._merge_level_rank(v_other_level) >= 3 then p.notes end,
      'in_overlap', (p.id in (select pid from t0))
    ))) as arr
    from public.people p
    where p.user_id = v_other_id and p.id in (select pid from visible)
      and not p.archived
  ),
  edges as (
    select jsonb_agg(jsonb_build_object(
      'from_id', c.from_id, 'to_id', c.to_id,
      'type', c.type,
      'strength', case when public._merge_level_rank(v_other_level) >= 2 then c.strength end
    )) as arr
    from public.connections c
    where c.user_id = v_other_id
      and c.from_id in (select pid from visible)
      and c.to_id   in (select pid from visible)
  ),
  ident as (
    select jsonb_agg(jsonb_build_object('mine', mine_id, 'theirs', theirs_id)) as arr from pairs
  ),
  hidden as (
    select count(*) as n from public.people p
    where p.user_id = v_other_id and not p.archived
      and p.id not in (select pid from visible)
  )
  select jsonb_build_object(
    'session', jsonb_build_object(
      'id', s.id, 'status', s.status, 'expires_at', s.expires_at,
      'my_role', case when v_iam_initiator then 'initiator' else 'partner' end,
      'other_share_level', v_other_level
    ),
    'partner_people',      coalesce((select arr from nodes), '[]'::jsonb),
    'partner_connections', coalesce((select arr from edges), '[]'::jsonb),
    'identity_pairs',      coalesce((select arr from ident), '[]'::jsonb),
    'hidden_partner_count', (select n from hidden)
  ) into result;

  return result;
end;
$$;

-- Expose RPCs to signed-in users only. Functions default to EXECUTE for PUBLIC, so revoke
-- that first (Firebase third-party auth maps signed-in users to the `authenticated` role).
revoke execute on function public.create_merge_invite(text, text)             from public;
revoke execute on function public.respond_to_merge_invite(uuid, boolean, text) from public;
revoke execute on function public.set_merge_share_level(uuid, text)           from public;
revoke execute on function public.revoke_merge(uuid)                          from public;
revoke execute on function public.compute_match_candidates(uuid)              from public;
revoke execute on function public.confirm_identity_match(uuid, boolean)       from public;
revoke execute on function public.get_merge_view(uuid)                        from public;

grant execute on function public.create_merge_invite(text, text)          to authenticated;
grant execute on function public.respond_to_merge_invite(uuid, boolean, text) to authenticated;
grant execute on function public.set_merge_share_level(uuid, text)         to authenticated;
grant execute on function public.revoke_merge(uuid)                        to authenticated;
grant execute on function public.compute_match_candidates(uuid)            to authenticated;
grant execute on function public.confirm_identity_match(uuid, boolean)     to authenticated;
grant execute on function public.get_merge_view(uuid)                      to authenticated;
