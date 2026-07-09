import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type SuggestionResult = {
  original_word: string;
  should_confirm: boolean;
  primary_suggestion: string;
  alternatives: string[];
  reason_tr: string;
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
    const inputWord = cleanText(body?.input_word);

    if (!inputWord) {
      return jsonResponse({ error: "input_word is required" }, 400);
    }

    if (inputWord.length > 80) {
      return jsonResponse({ error: "input_word is too long" }, 400);
    }

    const suggestion = await suggestWordCorrection({
      openAiApiKey,
      inputWord,
    });

    return jsonResponse({
      ok: true,
      ...suggestion,
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

async function suggestWordCorrection({
  openAiApiKey,
  inputWord,
}: {
  openAiApiKey: string;
  inputWord: string;
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
            "You are an English vocabulary spell-check assistant for Turkish learners. Do not over-correct. Preserve user speed. Only ask for confirmation when the typed word is likely misspelled or ambiguous between multiple common English words. Return only valid JSON matching the schema.",
        },
        {
          role: "user",
          content: `Check this vocabulary input: "${inputWord}".

Rules:
- If the input is already a valid English word or phrase, set should_confirm to false and primary_suggestion to the cleaned input.
- If capitalization is the only issue, set should_confirm to false.
- If the input is likely a typo and there is one clear correction, set should_confirm to true.
- If the input is ambiguous between multiple common words, set should_confirm to true and include alternatives.
- Keep alternatives short. Maximum 3 alternatives.
- Do not invent rare words unless the input strongly points to them.
- For Turkish learners, reason_tr should be a very short Turkish explanation.
- Example: "mesmorasing" may plausibly mean "mesmerizing" or "memorizing", so should_confirm should be true.`,
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "word_correction_suggestion",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              original_word: { type: "string" },
              should_confirm: { type: "boolean" },
              primary_suggestion: { type: "string" },
              alternatives: {
                type: "array",
                items: { type: "string" },
              },
              reason_tr: { type: "string" },
            },
            required: [
              "original_word",
              "should_confirm",
              "primary_suggestion",
              "alternatives",
              "reason_tr",
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

  const parsed = JSON.parse(outputText) as SuggestionResult;

  return normalizeSuggestion(parsed, inputWord);
}

function normalizeSuggestion(
  suggestion: SuggestionResult,
  fallbackInput: string
): SuggestionResult {
  const originalWord = cleanText(suggestion.original_word) || fallbackInput;
  const primarySuggestion =
    cleanText(suggestion.primary_suggestion) || originalWord;

  const alternatives = Array.from(
    new Set(
      suggestion.alternatives
        .map((item) => cleanText(item))
        .filter(Boolean)
        .filter((item) => item.toLowerCase() !== primarySuggestion.toLowerCase())
    )
  ).slice(0, 3);

  return {
    original_word: originalWord,
    should_confirm: Boolean(suggestion.should_confirm),
    primary_suggestion: primarySuggestion,
    alternatives,
    reason_tr:
      cleanText(suggestion.reason_tr) ||
      "Bu kelime için yazım önerisi olabilir.",
  };
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

function cleanText(value: unknown) {
  if (typeof value !== "string") return "";

  return value.trim().replace(/\s+/g, " ");
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
