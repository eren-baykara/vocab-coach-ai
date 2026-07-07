create table if not exists public.word_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  description text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.word_set_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  set_id uuid not null references public.word_sets(id) on delete cascade,
  user_word_id uuid not null references public.user_words(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (set_id, user_word_id)
);

create index if not exists word_sets_user_id_idx
  on public.word_sets(user_id);

create index if not exists word_set_items_user_id_idx
  on public.word_set_items(user_id);

create index if not exists word_set_items_set_id_idx
  on public.word_set_items(set_id);

create index if not exists word_set_items_user_word_id_idx
  on public.word_set_items(user_word_id);

alter table public.word_sets enable row level security;
alter table public.word_set_items enable row level security;

drop policy if exists "Users can view own word sets" on public.word_sets;
drop policy if exists "Users can create own word sets" on public.word_sets;
drop policy if exists "Users can update own word sets" on public.word_sets;
drop policy if exists "Users can delete own word sets" on public.word_sets;

create policy "Users can view own word sets"
on public.word_sets
for select
using (user_id = auth.uid());

create policy "Users can create own word sets"
on public.word_sets
for insert
with check (user_id = auth.uid());

create policy "Users can update own word sets"
on public.word_sets
for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Users can delete own word sets"
on public.word_sets
for delete
using (user_id = auth.uid());

drop policy if exists "Users can view own word set items" on public.word_set_items;
drop policy if exists "Users can create own word set items" on public.word_set_items;
drop policy if exists "Users can delete own word set items" on public.word_set_items;

create policy "Users can view own word set items"
on public.word_set_items
for select
using (user_id = auth.uid());

create policy "Users can create own word set items"
on public.word_set_items
for insert
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.word_sets ws
    where ws.id = set_id
      and ws.user_id = auth.uid()
  )
  and exists (
    select 1
    from public.user_words uw
    where uw.id = user_word_id
      and uw.user_id = auth.uid()
  )
);

create policy "Users can delete own word set items"
on public.word_set_items
for delete
using (user_id = auth.uid());
