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

## Current Known Issue

The correction flow was being changed.

Desired behavior:

- Normal word: add fast, no interruption.

- Suspicious typo: show inline suggestion.

- Suggested word selected: add selected word and optionally generate AI depending on original button.

- “Yazdığım gibi ekle”: add original typed word only, do not generate AI, and treat it as AI-disabled for this user word.

- No hardcoded suggestions like usually/useful/analyze should appear while typing.

## Safety Rules

Before changing code:

1. Run git status.

2. Inspect relevant files.

3. Explain plan.

4. Patch one area at a time.

5. Run npx tsc --noEmit.

6. Show changed files.