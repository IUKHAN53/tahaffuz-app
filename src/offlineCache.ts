import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchQuickAnswers, type QuickAnswer, type ReplyLanguage } from './api';

const CACHE_KEY = 'tahaffuz_quick_answers';
const CACHE_EXPIRY_KEY = 'tahaffuz_quick_answers_expiry';
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

export type CachedQuickAnswers = {
  answers: QuickAnswer[];
  language: ReplyLanguage;
  cachedAt: number;
};

/**
 * Get cached quick answers from local storage.
 */
export async function getCachedQuickAnswers(): Promise<CachedQuickAnswers | null> {
  try {
    const data = await AsyncStorage.getItem(CACHE_KEY);
    const expiry = await AsyncStorage.getItem(CACHE_EXPIRY_KEY);

    if (!data || !expiry) return null;

    const expiryTime = parseInt(expiry, 10);
    if (Date.now() > expiryTime) {
      // Cache expired
      await clearQuickAnswersCache();
      return null;
    }

    return JSON.parse(data) as CachedQuickAnswers;
  } catch {
    return null;
  }
}

/**
 * Save quick answers to local storage.
 */
export async function cacheQuickAnswers(
  answers: QuickAnswer[],
  language: ReplyLanguage
): Promise<void> {
  try {
    const cache: CachedQuickAnswers = {
      answers,
      language,
      cachedAt: Date.now(),
    };
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    await AsyncStorage.setItem(
      CACHE_EXPIRY_KEY,
      String(Date.now() + CACHE_DURATION_MS)
    );
  } catch {
    // Ignore storage errors
  }
}

/**
 * Clear cached quick answers.
 */
export async function clearQuickAnswersCache(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([CACHE_KEY, CACHE_EXPIRY_KEY]);
  } catch {
    // Ignore errors
  }
}

/**
 * Refresh quick answers cache from the server.
 */
export async function refreshQuickAnswersCache(
  language: ReplyLanguage
): Promise<QuickAnswer[]> {
  try {
    const answers = await fetchQuickAnswers(language, 30);
    if (answers.length > 0) {
      await cacheQuickAnswers(answers, language);
    }
    return answers;
  } catch {
    // If fetch fails, return cached data if available
    const cached = await getCachedQuickAnswers();
    return cached?.answers ?? [];
  }
}

/**
 * Search cached quick answers for a matching question.
 */
export function searchQuickAnswers(
  query: string,
  answers: QuickAnswer[]
): QuickAnswer | null {
  if (!query.trim() || answers.length === 0) return null;

  const normalizedQuery = query.toLowerCase().trim();

  // Exact match
  const exact = answers.find(
    (a) => a.question.toLowerCase().trim() === normalizedQuery
  );
  if (exact) return exact;

  // Partial match (query contains or is contained in question)
  const partial = answers.find(
    (a) =>
      a.question.toLowerCase().includes(normalizedQuery) ||
      normalizedQuery.includes(a.question.toLowerCase())
  );
  if (partial) return partial;

  return null;
}
