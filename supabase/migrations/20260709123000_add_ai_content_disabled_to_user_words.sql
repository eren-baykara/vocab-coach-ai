alter table public.user_words
  add column if not exists ai_content_disabled boolean not null default false;
