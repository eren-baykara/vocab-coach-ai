alter table public.word_contents
  add column if not exists part_of_speech text;
