-- Baseline migration: captures the core schema (word_contents, user_words,
-- profiles, add_user_word) that was originally created manually in the
-- Supabase Studio SQL editor and was never versioned as a migration file.
-- Uses `if not exists` / `create or replace` everywhere so it is a safe
-- no-op against the already-provisioned remote database (applied via
-- `supabase migration repair`) while still letting a brand new project be
-- bootstrapped from `supabase db reset` alone.
--
-- Columns added later by dedicated migrations (part_of_speech,
-- ai_content_disabled, practice/distractor fields, etc.) are intentionally
-- left out here so this file matches the schema as it existed at this
-- point in history; the later migrations add them on top.

create table if not exists public.word_contents (
  id uuid primary key default gen_random_uuid(),
  normalized_word text not null unique,
  display_word text not null,
  simple_definition text,
  academic_definition text,
  turkish_meaning text,
  toefl_example text,
  daily_life_example text,
  synonyms jsonb default '[]'::jsonb,
  antonyms jsonb default '[]'::jsonb,
  collocations jsonb default '[]'::jsonb,
  common_mistake text,
  mnemonic text,
  mini_lesson text,
  cefr_level text,
  difficulty_level text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_words (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  word_content_id uuid not null references public.word_contents(id) on delete cascade,
  status text not null default 'new',
  personal_note text,
  ease_factor numeric not null default 2.5,
  interval_days integer not null default 0,
  repetition_count integer not null default 0,
  lapse_count integer not null default 0,
  next_review_at timestamptz,
  last_reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, word_content_id)
);

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  exam_goal text default 'TOEFL',
  english_level text default 'B2',
  daily_minutes integer default 10,
  native_language text default 'Turkish',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_words_user_id_idx
  on public.user_words(user_id);

create index if not exists user_words_word_content_id_idx
  on public.user_words(word_content_id);

alter table public.word_contents enable row level security;
alter table public.user_words enable row level security;
alter table public.profiles enable row level security;

drop policy if exists "Authenticated users can read word contents" on public.word_contents;

create policy "Authenticated users can read word contents"
on public.word_contents
for select
to authenticated
using (true);

drop policy if exists "Users can view their own words" on public.user_words;
drop policy if exists "Users can insert their own words" on public.user_words;
drop policy if exists "Users can update their own words" on public.user_words;
drop policy if exists "Users can delete their own words" on public.user_words;

create policy "Users can view their own words"
on public.user_words
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert their own words"
on public.user_words
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update their own words"
on public.user_words
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete their own words"
on public.user_words
for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can view their own profile" on public.profiles;
drop policy if exists "Users can insert their own profile" on public.profiles;
drop policy if exists "Users can update their own profile" on public.profiles;

create policy "Users can view their own profile"
on public.profiles
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert their own profile"
on public.profiles
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update their own profile"
on public.profiles
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create or replace function public.add_user_word(input_word text)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_normalized_word text;
  v_display_word text;
  v_word_content_id uuid;
  v_user_word_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  v_normalized_word := lower(trim(input_word));
  v_normalized_word := regexp_replace(v_normalized_word, '\s+', ' ', 'g');
  v_display_word := trim(input_word);

  if v_normalized_word is null or char_length(v_normalized_word) < 1 then
    raise exception 'Word cannot be empty';
  end if;

  if char_length(v_normalized_word) > 80 then
    raise exception 'Word is too long';
  end if;

  select id
  into v_word_content_id
  from public.word_contents
  where normalized_word = v_normalized_word;

  if v_word_content_id is null then
    insert into public.word_contents (
      normalized_word,
      display_word
    )
    values (
      v_normalized_word,
      v_display_word
    )
    returning id into v_word_content_id;
  end if;

  insert into public.user_words (
    user_id,
    word_content_id,
    status,
    next_review_at
  )
  values (
    v_user_id,
    v_word_content_id,
    'new',
    now()
  )
  on conflict (user_id, word_content_id)
  do update set
    word_content_id = excluded.word_content_id
  returning id into v_user_word_id;

  return v_user_word_id;
end;
$function$;
