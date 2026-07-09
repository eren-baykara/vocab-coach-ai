import { appAlert } from "./app-alert";

import { supabase } from "./supabase";

export type WordCorrectionSuggestion = {
  original_word: string;
  should_confirm: boolean;
  primary_suggestion: string;
  alternatives: string[];
  reason_tr: string;
};

export type PendingWordCorrection = {
  originalWord: string;
  suggestion: WordCorrectionSuggestion;
  generateAiAfterAdd: boolean;
  setId: string | null;
  userWordId: string;
};

type BasicWordContent = {
  display_word: string | null;
  normalized_word: string | null;
};

type BasicUserWord = {
  id: string;
  created_at: string;
  word_contents: BasicWordContent | BasicWordContent[] | null;
};

function getBasicContent(item: BasicUserWord) {
  return Array.isArray(item.word_contents) ? item.word_contents[0] : item.word_contents;
}

export async function getFunctionErrorMessage(error: unknown) {
  const fallbackMessage =
    error instanceof Error ? error.message : "Unknown function error";

  const maybeError = error as {
    context?: Response;
  };

  if (!maybeError.context) {
    return fallbackMessage;
  }

  try {
    const responseText = await maybeError.context.text();

    if (!responseText) {
      return fallbackMessage;
    }

    try {
      const parsed = JSON.parse(responseText);

      if (parsed?.error) {
        return String(parsed.error);
      }

      return responseText;
    } catch {
      return responseText;
    }
  } catch {
    return fallbackMessage;
  }
}

export async function findUserWordByInput(inputWord: string) {
  const normalizedInput = inputWord.trim().toLowerCase();

  const { data, error } = await supabase
    .from("user_words")
    .select(
      `
      id,
      created_at,
      word_contents (
        display_word,
        normalized_word
      )
    `
    )
    .order("created_at", { ascending: false });

  if (error) {
    appAlert("Could not find word", error.message);
    return null;
  }

  const typedWords = (data ?? []) as BasicUserWord[];

  return (
    typedWords.find((item) => {
      const content = getBasicContent(item);

      const displayWord = content?.display_word?.trim().toLowerCase();
      const normalizedWord = content?.normalized_word?.trim().toLowerCase();

      return displayWord === normalizedInput || normalizedWord === normalizedInput;
    }) ?? null
  );
}

export async function addUserWord(
  cleanWord: string,
  options: {
    generateAi?: boolean;
    setId?: string | null;
    onAiComplete?: () => void;
  } = {}
) {
  const { generateAi = false, setId = null, onAiComplete } = options;

  const { data: userWordId, error } = await supabase.rpc("add_user_word", {
    input_word: cleanWord,
  });

  if (error) {
    appAlert("Kelime eklenemedi", error.message);
    return null;
  }

  if (!userWordId || typeof userWordId !== "string") {
    appAlert("Kelime eklenemedi", "Kelime kaydedildi ama kimliği alınamadı.");
    return null;
  }

  const targetWord = { id: userWordId };

  if (setId) {
    const { error: setError } = await supabase
      .from("word_set_items")
      .insert({
        set_id: setId,
        user_word_id: userWordId,
      });

    if (setError && setError.code !== "23505") {
      appAlert("Kelime eklendi ama sete eklenemedi", setError.message);
    }
  }

  if (generateAi) {
    void supabase.functions
      .invoke("generate-word-content", {
        body: {
          user_word_id: userWordId,
        },
      })
      .then(async ({ error: aiError }) => {
        if (aiError) {
          appAlert(
            "AI içeriği oluşturulamadı",
            await getFunctionErrorMessage(aiError)
          );
        }

        onAiComplete?.();
      });
  }

  return targetWord;
}

export async function replaceUserWord(
  userWordId: string,
  correctedWord: string,
  options: {
    generateAi?: boolean;
    setId?: string | null;
    onAiComplete?: () => void;
  } = {}
) {
  const { error: deleteError } = await supabase
    .from("user_words")
    .delete()
    .eq("id", userWordId);

  if (deleteError) {
    appAlert("Kelime düzeltilemedi", deleteError.message);
    return null;
  }

  return addUserWord(correctedWord, options);
}

export function scheduleWordCorrectionCheck(
  cleanWord: string,
  userWordId: string,
  options: {
    generateAiAfterAdd: boolean;
    setId: string | null;
    onCorrectionNeeded: (correction: PendingWordCorrection) => void;
  }
) {
  void supabase.functions
    .invoke("suggest-word-correction", {
      body: {
        input_word: cleanWord,
      },
    })
    .then(({ data, error }) => {
      if (error) return;

      const suggestion = data as WordCorrectionSuggestion | null;

      if (!suggestion) return;

      const correctionOptions = getCorrectionOptions(suggestion, cleanWord);

      if (suggestion.should_confirm && correctionOptions.length > 0) {
        options.onCorrectionNeeded({
          originalWord: cleanWord,
          suggestion,
          generateAiAfterAdd: options.generateAiAfterAdd,
          setId: options.setId,
          userWordId,
        });
      }
    });
}

export function getCorrectionOptions(
  suggestion: WordCorrectionSuggestion,
  originalWord: string
) {
  const normalizedOriginal = originalWord.trim().toLowerCase();
  const options = [suggestion.primary_suggestion, ...suggestion.alternatives];

  return Array.from(
    new Map(
      options
        .map((item) => item.trim())
        .filter((item) => item.length > 0)
        .filter((item) => item.toLowerCase() !== normalizedOriginal)
        .map((item) => [item.toLowerCase(), item])
    ).values()
  ).slice(0, 3);
}
