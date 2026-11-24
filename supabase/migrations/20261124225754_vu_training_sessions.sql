create table public.vu_training_sessions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  training_date date not null default current_date,
  category text not null default '' check (char_length(category) <= 80),
  exercises jsonb not null check (jsonb_typeof(exercises) = 'array' and jsonb_array_length(exercises) between 1 and 30 and octet_length(exercises::text) <= 250000),
  updated_at timestamptz not null default now()
);
alter table public.vu_training_sessions enable row level security;
revoke all on public.vu_training_sessions from public, anon, authenticated;
grant select, insert, update, delete on public.vu_training_sessions to authenticated;
create policy "Mister Igea manages own training sessions"
on public.vu_training_sessions for all to authenticated
using (
  owner_id = (select auth.uid())
  and owner_id = '8cabd9a2-8f72-4c0c-8853-5f923836f3f0'::uuid
  and exists (
    select 1 from public.profiles
    where id = owner_id and username = 'misterigea' and role = 'coach' and active
  )
)
with check (
  owner_id = (select auth.uid())
  and owner_id = '8cabd9a2-8f72-4c0c-8853-5f923836f3f0'::uuid
  and exists (
    select 1 from public.profiles
    where id = owner_id and username = 'misterigea' and role = 'coach' and active
  )
);
