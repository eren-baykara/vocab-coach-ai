import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type GeneratedWordContent = {
  simple_definition: string;
  academic_definition: string;
  turkish_meaning: string;
  part_of_speech: string;
  phonetic: string;
  toefl_example: string;
  toefl_example_tr: string;
  daily_life_example: string;
  daily_life_example_tr: string;
  fill_blank_sentence: string;
  fill_blank_sentence_tr: string;
  fill_blank_answer: string;
  meaning_distractors: string[];
  word_distractors: string[];
  synonyms: string[];
  antonyms: string[];
  collocations: string[];
  common_mistake: string;
  mnemonic: string;
  mini_lesson: string;
  cefr_level: string;
  difficulty_level: number;
};

type WordContentRecord = {
  id: string;
  display_word: string | null;
  normalized_word: string | null;
  simple_definition: string | null;
  mini_lesson: string | null;
  daily_life_example_tr: string | null;
  fill_blank_sentence: string | null;
};

type UserWordRecord = {
  id: string;
  user_id: string;
  word_content_id: string;
  ai_content_disabled: boolean | null;
  word_contents: WordContentRecord | WordContentRecord[] | null;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    const openAiApiKey = Deno.env.get("OPENAI_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAdminKey = getSupabaseAdminKey();

    if (!openAiApiKey) {
      return jsonResponse({ error: "OPENAI_API_KEY is not set" }, 500);
    }

    if (!supabaseUrl || !supabaseAdminKey) {
      return jsonResponse({ error: "Supabase server env is missing" }, 500);
    }

    const authHeader = req.headers.get("Authorization");
    const accessToken = authHeader?.replace("Bearer ", "");

    if (!accessToken) {
      return jsonResponse({ error: "Missing user access token" }, 401);
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseAdminKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(accessToken);

    if (userError || !user) {
      return jsonResponse({ error: "Invalid user session" }, 401);
    }

    const body = await req.json().catch(() => null);
    const userWordId = body?.user_word_id;

    if (!userWordId || typeof userWordId !== "string") {
      return jsonResponse({ error: "user_word_id is required" }, 400);
    }

    const { data: userWord, error: userWordError } = await supabaseAdmin
      .from("user_words")
      .select(
        `
        id,
        user_id,
        word_content_id,
        ai_content_disabled,
        word_contents (
          id,
          display_word,
          normalized_word,
          simple_definition,
          mini_lesson,
          daily_life_example_tr,
          fill_blank_sentence
        )
      `
      )
      .eq("id", userWordId)
      .eq("user_id", user.id)
      .single();

    if (userWordError || !userWord) {
      return jsonResponse({ error: "Word not found for this user" }, 404);
    }

    const typedUserWord = userWord as UserWordRecord;

    if (typedUserWord.ai_content_disabled) {
      return jsonResponse(
        { error: "AI content is disabled for this word" },
        403
      );
    }

    const content = Array.isArray(typedUserWord.word_contents)
      ? typedUserWord.word_contents[0]
      : typedUserWord.word_contents;

    if (!content) {
      return jsonResponse({ error: "Word content not found" }, 404);
    }

    const word = content.display_word ?? content.normalized_word;

    if (!word) {
      return jsonResponse({ error: "Word text is missing" }, 400);
    }

    const alreadyGenerated = Boolean(
      content.simple_definition &&
        content.mini_lesson &&
        content.daily_life_example_tr &&
        content.fill_blank_sentence
    );

    if (alreadyGenerated) {
      return jsonResponse({
        ok: true,
        cached: true,
        message: "AI practice content already exists.",
      });
    }

    const generatedContent = await generateWordContent({
      openAiApiKey,
      word,
    });

    const { error: updateError } = await supabaseAdmin
      .from("word_contents")
      .update({
        simple_definition: cleanText(generatedContent.simple_definition),
        academic_definition: cleanText(generatedContent.academic_definition),
        turkish_meaning: cleanText(generatedContent.turkish_meaning),
        part_of_speech: cleanText(generatedContent.part_of_speech),
        phonetic: cleanText(generatedContent.phonetic),
        toefl_example: cleanText(generatedContent.toefl_example),
        toefl_example_tr: cleanText(generatedContent.toefl_example_tr),
        daily_life_example: cleanText(generatedContent.daily_life_example),
        daily_life_example_tr: cleanText(generatedContent.daily_life_example_tr),
        fill_blank_sentence: cleanText(generatedContent.fill_blank_sentence),
        fill_blank_sentence_tr: cleanText(generatedContent.fill_blank_sentence_tr),
        fill_blank_answer: cleanText(generatedContent.fill_blank_answer),
        meaning_distractors: cleanStringArray(generatedContent.meaning_distractors),
        word_distractors: cleanStringArray(generatedContent.word_distractors),
        synonyms: cleanStringArray(generatedContent.synonyms),
        antonyms: cleanStringArray(generatedContent.antonyms),
        collocations: cleanStringArray(generatedContent.collocations),
        common_mistake: cleanText(generatedContent.common_mistake),
        mnemonic: cleanText(generatedContent.mnemonic),
        mini_lesson: cleanText(generatedContent.mini_lesson),
        cefr_level: cleanText(generatedContent.cefr_level),
        difficulty_level: generatedContent.difficulty_level,
        updated_at: new Date().toISOString(),
      })
      .eq("id", typedUserWord.word_content_id);

    if (updateError) {
      return jsonResponse({ error: updateError.message }, 500);
    }

    return jsonResponse({
      ok: true,
      cached: false,
      message: "AI practice content generated.",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected server error";

    return jsonResponse({ error: message }, 500);
  }
});

function getSupabaseAdminKey() {
  const legacyServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (legacyServiceRoleKey) {
    return legacyServiceRoleKey;
  }

  const secretKeysJson = Deno.env.get("SUPABASE_SECRET_KEYS");

  if (!secretKeysJson) {
    return null;
  }

  const secretKeys = JSON.parse(secretKeysJson);
  return secretKeys.default as string | null;
}

async function generateWordContent({
  openAiApiKey,
  word,
}: {
  openAiApiKey: string;
  word: string;
}) {
  const model = Deno.env.get("OPENAI_MODEL") ?? "gpt-5-mini";

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openAiApiKey}`,
    },
    body: JSON.stringify({
      model,
      reasoning: {
        effort: "low",
      },
      input: [
        {
          role: "developer",
          content:
            "You are an expert English vocabulary coach for Turkish-speaking TOEFL, IELTS, and GRE learners. Create accurate, practical, beginner-friendly learning and quiz content. Return only valid JSON that matches the schema.",
        },
        {
          role: "user",
          content: `Create vocabulary learning and practice content for this English word: "${word}".

Requirements:
- Keep definitions clear and useful.
- Turkish meaning should be natural, short Turkish. Prefer 1-6 words when possible. Do not include English in parentheses.
- part_of_speech should be the word's main grammatical role in this context. Use exactly one of: noun, verb, adjective, adverb, phrase, phrasal verb, preposition, conjunction, interjection, determiner, pronoun.
- phonetic should be the standard IPA phonetic transcription of the word using General American English pronunciation, wrapped in forward slashes (e.g. /kəmˈpjuːtər/). Use accurate IPA symbols, not a simplified respelling.
- TOEFL / IELTS example should be academic.
- Daily life example should be natural spoken English.
- Provide Turkish translations for both example sentences.
- fill_blank_sentence must be a natural English sentence that uses the exact target word or phrase. It will be used only in practice screens, not in the word detail page. It will be used only in practice screens, not in the word detail page.
- fill_blank_answer should be the exact target word or phrase to fill in the sentence.
- meaning_distractors should be 4 short Turkish wrong meanings. They must NOT be synonyms or near-synonyms of the correct Turkish meaning, and must not be plausible alternate correct answers — a learner who knows the word should be able to rule them out confidently. Do not include English translations or parentheses.
- word_distractors should be 4 English wrong answer choices for a "which word matches this meaning" quiz. They must be real, common English words of the same part of speech as the target word, but must NOT be synonyms, near-synonyms, or otherwise defensible as correct — only the target word should correctly match the meaning. Return only words or short phrases, no explanations.
- Common mistake should warn about a real usage problem.
- Mini lesson should teach how to use the word, not just memorize it.
- CEFR level should be one of: A1, A2, B1, B2, C1, C2.
- Difficulty level should be 1 to 5.`,
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "vocab_word_content",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              simple_definition: { type: "string" },
              academic_definition: { type: "string" },
              turkish_meaning: { type: "string" },
              part_of_speech: {
                type: "string",
                enum: [
                  "noun",
                  "verb",
                  "adjective",
                  "adverb",
                  "phrase",
                  "phrasal verb",
                  "preposition",
                  "conjunction",
                  "interjection",
                  "determiner",
                  "pronoun",
                ],
              },
              phonetic: { type: "string" },
              toefl_example: { type: "string" },
              toefl_example_tr: { type: "string" },
              daily_life_example: { type: "string" },
              daily_life_example_tr: { type: "string" },
              fill_blank_sentence: { type: "string" },
              fill_blank_sentence_tr: { type: "string" },
              fill_blank_answer: { type: "string" },
              meaning_distractors: {
                type: "array",
                items: { type: "string" },
              },
              word_distractors: {
                type: "array",
                items: { type: "string" },
              },
              synonyms: {
                type: "array",
                items: { type: "string" },
              },
              antonyms: {
                type: "array",
                items: { type: "string" },
              },
              collocations: {
                type: "array",
                items: { type: "string" },
              },
              common_mistake: { type: "string" },
              mnemonic: { type: "string" },
              mini_lesson: { type: "string" },
              cefr_level: {
                type: "string",
                enum: ["A1", "A2", "B1", "B2", "C1", "C2"],
              },
              difficulty_level: {
                type: "integer",
                minimum: 1,
                maximum: 5,
              },
            },
            required: [
              "simple_definition",
              "academic_definition",
              "turkish_meaning",
              "part_of_speech",
              "phonetic",
              "toefl_example",
              "toefl_example_tr",
              "daily_life_example",
              "daily_life_example_tr",
              "fill_blank_sentence",
              "fill_blank_sentence_tr",
              "fill_blank_answer",
              "meaning_distractors",
              "word_distractors",
              "synonyms",
              "antonyms",
              "collocations",
              "common_mistake",
              "mnemonic",
              "mini_lesson",
              "cefr_level",
              "difficulty_level",
            ],
          },
        },
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const outputText = extractOutputText(data);

  if (!outputText) {
    throw new Error("OpenAI response did not include text output.");
  }

  return JSON.parse(outputText) as GeneratedWordContent;
}

function extractOutputText(data: any) {
  const output = data?.output;

  if (!Array.isArray(output)) {
    return "";
  }

  const textParts: string[] = [];

  for (const item of output) {
    const content = item?.content;

    if (!Array.isArray(content)) {
      continue;
    }

    for (const contentItem of content) {
      if (contentItem?.type === "output_text" && contentItem?.text) {
        textParts.push(contentItem.text);
      }
    }
  }

  return textParts.join("\n").trim();
}

function cleanText(value: string) {
  const cleaned = value.trim();
  return cleaned.length > 0 ? cleaned : null;
}

function cleanStringArray(value: string[]) {
  return value
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .slice(0, 8);
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}
