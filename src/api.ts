import Constants from 'expo-constants';
import { fetch as expoFetch } from 'expo/fetch';

const apiBase: string =
  (Constants.expoConfig?.extra as { apiBase?: string } | undefined)?.apiBase ??
  'http://10.0.2.2:8000';

export type Citation = {
  chunk_id: number;
  document_id: number;
  document_title: string;
  ordinal: number;
  score: number;
  snippet: string;
};

export type ChatReply = {
  chat_id: number;
  reply: {
    id: number;
    content: string;
    citations: Citation[];
    latency_ms: number;
  };
  transcript?: string;
};

export type ChatSummary = {
  id: number;
  title: string;
  language: string;
  message_count: number;
  updated_at: string;
};

export type ChatDetail = {
  chat: {
    id: number;
    title: string | null;
    language: string;
    knowledge_base_id: number;
    created_at: string;
    updated_at: string;
  };
  messages: Array<{
    id: number;
    role: 'user' | 'assistant' | 'system';
    content: string;
    citations: Citation[] | null;
    latency_ms: number | null;
    created_at: string;
  }>;
};

/** Parse a response, surfacing the backend's localized {error} message on failure. */
async function jsonOrThrow(res: Response): Promise<any> {
  const text = await res.text().catch(() => '');
  let json: any = {};
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = {};
    }
  }
  if (!res.ok) {
    const msg =
      (typeof json?.error === 'string' && json.error) ||
      (typeof json?.message === 'string' && json.message) ||
      `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return json;
}

export type ReplyLanguage = 'en' | 'ur' | 'rud' | 'ps' | 'sd';

export async function sendText(params: {
  deviceId: string;
  message: string;
  chatId?: number | null;
  language?: ReplyLanguage;
}): Promise<ChatReply> {
  const res = await fetch(`${apiBase}/api/chat/text`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      device_id: params.deviceId,
      message: params.message,
      chat_id: params.chatId ?? null,
      language: params.language,
    }),
  });
  return jsonOrThrow(res);
}

export type StreamHandlers = {
  /** Fired once with the chat id as soon as the turn is registered. */
  onMeta?: (chatId: number) => void;
  /** Fired for each text chunk as the answer is generated. */
  onDelta?: (text: string) => void;
};

/**
 * Streamed text turn over Server-Sent Events. Resolves with the final reply.
 * Throwing here is expected to be recoverable — callers fall back to sendText().
 */
export async function sendTextStream(
  params: {
    deviceId: string;
    message: string;
    chatId?: number | null;
    language?: ReplyLanguage;
  },
  handlers: StreamHandlers = {},
): Promise<ChatReply> {
  const res = await expoFetch(`${apiBase}/api/chat/text/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify({
      device_id: params.deviceId,
      message: params.message,
      chat_id: params.chatId ?? null,
      language: params.language,
    }),
  });

  if (!res.ok) {
    throw new Error(`Stream request failed (${res.status})`);
  }
  const body = res.body;
  if (!body) {
    throw new Error('Streaming not available');
  }

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let result: ChatReply | null = null;
  let streamError: string | null = null;

  const handleEvent = (raw: string) => {
    let event = 'message';
    const data: string[] = [];
    for (const line of raw.split('\n')) {
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) data.push(line.slice(5).trim());
    }
    if (data.length === 0) return;
    let payload: any;
    try {
      payload = JSON.parse(data.join(''));
    } catch {
      return;
    }
    if (event === 'meta' && typeof payload?.chat_id === 'number') {
      handlers.onMeta?.(payload.chat_id);
    } else if (event === 'delta' && typeof payload?.text === 'string') {
      handlers.onDelta?.(payload.text);
    } else if (event === 'done' && payload?.reply) {
      result = payload as ChatReply;
    } else if (event === 'error') {
      streamError = typeof payload?.error === 'string' ? payload.error : 'Stream error';
    }
  };

  for (;;) {
    const { value, done } = await reader.read();
    if (value) {
      buffer += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buffer.indexOf('\n\n')) !== -1) {
        handleEvent(buffer.slice(0, idx));
        buffer = buffer.slice(idx + 2);
      }
    }
    if (done) break;
  }
  if (buffer.trim()) handleEvent(buffer);

  if (streamError) throw new Error(streamError);
  if (!result) throw new Error('Stream ended without a result');
  return result;
}

export async function sendAudio(params: {
  deviceId: string;
  audioUri: string;
  audioMime: string;
  chatId?: number | null;
  language?: ReplyLanguage;
}): Promise<ChatReply> {
  const form = new FormData();
  form.append('device_id', params.deviceId);
  if (params.chatId) form.append('chat_id', String(params.chatId));
  if (params.language) form.append('language', params.language);
  // RN's FormData accepts a {uri, name, type} object; TS types lag behind the runtime.
  form.append('audio', {
    uri: params.audioUri,
    name: 'voice.m4a',
    type: params.audioMime || 'audio/m4a',
  } as unknown as Blob);
  const res = await fetch(`${apiBase}/api/chat/audio`, {
    method: 'POST',
    headers: { Accept: 'application/json' },
    body: form,
  });
  return jsonOrThrow(res);
}

/**
 * URL for the server-side TTS audio (audio/wav). An audio player can stream
 * this directly. `lang` is a hint the backend uses to decide whether Latin text
 * is English or Roman Urdu (Roman Urdu is transliterated to Urdu script before
 * synthesis); Urdu-script text is always voiced as Urdu regardless.
 */
export function ttsUrl(text: string, lang: ReplyLanguage): string {
  const q = new URLSearchParams({ text, lang });
  return `${apiBase}/api/tts?${q.toString()}`;
}

export async function ping(): Promise<boolean> {
  try {
    const res = await fetch(`${apiBase}/api/health`);
    return res.ok;
  } catch {
    return false;
  }
}

export async function listChats(deviceId: string): Promise<ChatSummary[]> {
  const res = await fetch(`${apiBase}/api/chats?device_id=${encodeURIComponent(deviceId)}`);
  const json = await jsonOrThrow(res);
  return json.chats ?? [];
}

export async function getChat(deviceId: string, chatId: number): Promise<ChatDetail> {
  const res = await fetch(`${apiBase}/api/chat/${chatId}?device_id=${encodeURIComponent(deviceId)}`);
  return jsonOrThrow(res);
}

export async function deleteChat(deviceId: string, chatId: number): Promise<void> {
  const res = await fetch(`${apiBase}/api/chat/${chatId}?device_id=${encodeURIComponent(deviceId)}`, {
    method: 'DELETE',
  });
  await jsonOrThrow(res);
}

export const API_BASE = apiBase;

// Feedback API
export type FeedbackRating = 'up' | 'down';

export type FeedbackStats = {
  up: number;
  down: number;
};

export async function submitFeedback(params: {
  messageId: number;
  deviceId: string;
  rating: FeedbackRating;
  comment?: string;
}): Promise<{ success: boolean; stats: FeedbackStats }> {
  const res = await fetch(`${apiBase}/api/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      message_id: params.messageId,
      device_id: params.deviceId,
      rating: params.rating,
      comment: params.comment,
    }),
  });
  const json = await jsonOrThrow(res);
  return { success: json.success, stats: json.data?.stats ?? { up: 0, down: 0 } };
}

export async function checkFeedback(
  messageId: number,
  deviceId: string
): Promise<{ hasRated: boolean; rating?: FeedbackRating }> {
  const res = await fetch(
    `${apiBase}/api/feedback/${messageId}/check?device_id=${encodeURIComponent(deviceId)}`
  );
  const json = await jsonOrThrow(res);
  return { hasRated: json.data?.has_rated ?? false, rating: json.data?.rating };
}

// Bookmark API
export type Bookmark = {
  id: number;
  message_id: number;
  device_id: string;
  note: string | null;
  created_at: string;
  message?: {
    id: number;
    content: string;
    chat?: { id: number; title: string };
  };
};

export async function toggleBookmark(params: {
  messageId: number;
  deviceId: string;
  note?: string;
}): Promise<{ isBookmarked: boolean }> {
  const res = await fetch(`${apiBase}/api/bookmarks/toggle`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      message_id: params.messageId,
      device_id: params.deviceId,
      note: params.note,
    }),
  });
  const json = await jsonOrThrow(res);
  return { isBookmarked: json.data?.is_bookmarked ?? false };
}

export async function checkBookmark(
  messageId: number,
  deviceId: string
): Promise<{ isBookmarked: boolean }> {
  const res = await fetch(
    `${apiBase}/api/bookmarks/${messageId}/check?device_id=${encodeURIComponent(deviceId)}`
  );
  const json = await jsonOrThrow(res);
  return { isBookmarked: json.data?.is_bookmarked ?? false };
}

export async function listBookmarks(
  deviceId: string,
  page: number = 1
): Promise<{ data: Bookmark[]; lastPage: number }> {
  const res = await fetch(
    `${apiBase}/api/bookmarks?device_id=${encodeURIComponent(deviceId)}&page=${page}`
  );
  const json = await jsonOrThrow(res);
  return {
    data: json.data?.data ?? [],
    lastPage: json.data?.last_page ?? 1,
  };
}

export async function deleteBookmark(bookmarkId: number, deviceId: string): Promise<void> {
  const res = await fetch(
    `${apiBase}/api/bookmarks/${bookmarkId}?device_id=${encodeURIComponent(deviceId)}`,
    { method: 'DELETE' }
  );
  await jsonOrThrow(res);
}

// Search API
export type SearchResult = {
  id: number;
  chat_id: number;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  chat?: { id: number; title: string };
};

export async function searchMessages(
  deviceId: string,
  query: string
): Promise<SearchResult[]> {
  const res = await fetch(
    `${apiBase}/api/search/messages?device_id=${encodeURIComponent(deviceId)}&query=${encodeURIComponent(query)}`
  );
  const json = await jsonOrThrow(res);
  return json.data ?? [];
}

// Quick Answers (Offline Cache) API
export type QuickAnswer = {
  id: string;
  question: string;
  answer: string;
  popularity: number;
};

export async function fetchQuickAnswers(
  language: ReplyLanguage,
  limit: number = 20
): Promise<QuickAnswer[]> {
  const res = await fetch(
    `${apiBase}/api/quick-answers?language=${language}&limit=${limit}`
  );
  const json = await jsonOrThrow(res);
  return json.data ?? [];
}

// Push Notification API
export async function registerPushToken(params: {
  deviceId: string;
  token: string;
  platform?: 'expo' | 'fcm' | 'apns';
  language?: ReplyLanguage;
}): Promise<{ success: boolean; tipsEnabled: boolean }> {
  const res = await fetch(`${apiBase}/api/push/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      device_id: params.deviceId,
      token: params.token,
      platform: params.platform ?? 'expo',
      language: params.language ?? 'ur',
    }),
  });
  const json = await jsonOrThrow(res);
  return { success: json.success, tipsEnabled: json.data?.tips_enabled ?? true };
}

export async function updatePushPreferences(params: {
  deviceId: string;
  tipsEnabled: boolean;
  language?: ReplyLanguage;
}): Promise<{ success: boolean }> {
  const res = await fetch(`${apiBase}/api/push/preferences`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      device_id: params.deviceId,
      tips_enabled: params.tipsEnabled,
      language: params.language,
    }),
  });
  const json = await jsonOrThrow(res);
  return { success: json.success };
}
