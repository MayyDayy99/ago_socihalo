-- Enable realtime invalidation for the living map.
alter table public.people replica identity full;
alter table public.connections replica identity full;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'people'
    ) then
      execute 'alter publication supabase_realtime add table public.people';
    end if;

    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'connections'
    ) then
      execute 'alter publication supabase_realtime add table public.connections';
    end if;
  end if;
end $$;
