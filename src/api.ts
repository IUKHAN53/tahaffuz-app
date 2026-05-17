import Constants from 'expo-constants';

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

async function jsonOrThrow(res: Response): Promise<any> {
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

export type ReplyLanguage = 'en' | 'ur';

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
