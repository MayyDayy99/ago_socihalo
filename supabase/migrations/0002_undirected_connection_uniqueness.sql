-- Prevent A-B and B-A duplicates for undirected connections.
-- If duplicates already exist, keep the oldest row before adding the index.
update public.connections
set directed = false
where directed is null;

alter table public.connections
  alter column directed set not null;

with ranked as (
  select
    id,
    row_number() over (
      partition by user_id, least(from_id, to_id), greatest(from_id, to_id)
      order by created_at asc, id asc
    ) as rn
  from public.connections
  where directed = false
)
delete from public.connections c
using ranked r
where c.id = r.id
  and r.rn > 1;

create unique index if not exists connections_user_undirected_pair_idx
  on public.connections (user_id, least(from_id, to_id), greatest(from_id, to_id))
  where directed = false;
