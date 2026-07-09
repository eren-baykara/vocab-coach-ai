alter table public.word_contents
  add column if not exists phonetic text;
