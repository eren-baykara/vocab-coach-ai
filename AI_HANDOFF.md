# Kelimelik AI Handoff

## Current Project

Path:

~/Desktop/vocab-coach-ai

App:

Kelimelik AI — vocabulary learning app for English learners.

Stack:

Expo React Native, TypeScript, Expo Router, Supabase, Supabase Edge Functions, OpenAI through backend only.

## Important Files

- src/app/(tabs)/index.tsx — Today / quick add / study entry

- src/app/(tabs)/library.tsx — Library

- src/app/(tabs)/sets.tsx — Sets

- src/app/(tabs)/profile.tsx — Profile

- src/app/word/[id].tsx — Word Detail

- src/app/review.tsx — Quiz / practice

- src/app/card-sort.tsx — Card sort

- supabase/functions/generate-word-content/index.ts — AI content generation

- supabase/functions/suggest-word-correction/index.ts — Word correction suggestion

- supabase/migrations/ — DB migrations

## Correction Flow (implemented)

- Normal word: `suggest-word-correction` is called before insert (fast, low-effort check). If it does not flag the word, the word is added immediately with no popup.

- Suspicious typo: before the word is inserted, a blocking popup (Modal) appears with the suggested correction(s). The word is NOT added yet.

- Suggested word selected in the popup: the suggested (corrected) word is added, and AI is generated only if the original button pressed was “Ekle + AI Oluştur”.

- “... yazdığım gibi ekle (AI'sız)” in the popup: adds the original typed word only, never calls `generate-word-content` for it, and immediately sets `ai_content_disabled = true` on it.

- `ai_content_disabled` words must never show AI-generated meaning/example content anywhere: Word Detail, Library, Sets, Card Sort, and Quiz/Review all filter or blank this out. Practice screens (card-sort, review) also exclude these words from being served as practice cards.

- No hardcoded suggestions like usually/useful/analyze appear while typing; quick-add suggestions are derived only from the user's own existing words.

## Safety Rules

Before changing code:

1. Run git status.

2. Inspect relevant files.

3. Explain plan.

4. Patch one area at a time.

5. Run npx tsc --noEmit.

6. Show changed files.