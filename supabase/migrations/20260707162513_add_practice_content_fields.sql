alter table public.word_contents
  add column if not exists toefl_example_tr text,
  add column if not exists daily_life_example_tr text,
  add column if not exists fill_blank_sentence text,
  add column if not exists fill_blank_sentence_tr text,
  add column if not exists fill_blank_answer text,
  add column if not exists meaning_distractors text[] not null default '{}'::text[],
  add column if not exists word_distractors text[] not null default '{}'::text[];
