import AsyncStorage from '@react-native-async-storage/async-storage';
import { listChats, type ChatSummary } from './api';

const KEY = 'tahaffuz.sessions.v1';

export type LocalSession = {
  id: number;
  title: string;
  message_count: number;
  updated_at: string; // ISO
};

async function readCache(): Promise<LocalSession[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

async function writeCache(list: LocalSession[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(list));
}

/** Cache-first: return cached immediately, then refresh from server in background. */
export async function loadSessions(deviceId: string): Promise<{
  cached: LocalSession[];
  refresh: Promise<LocalSession[]>;
}> {
  const cached = await readCache();
  const refresh = (async () => {
    try {
      const remote = await listChats(deviceId);
      const merged = remote.map<LocalSession>((c: ChatSummary) => ({
        id: c.id,
        title: c.title,
        message_count: c.message_count,
        updated_at: c.updated_at,
      }));
      await writeCache(merged);
      return merged;
    } catch {
      return cached;
    }
  })();
  return { cached, refresh };
}

export async function upsertSession(s: LocalSession): Promise<void> {
  const list = await readCache();
  const idx = list.findIndex((x) => x.id === s.id);
  if (idx >= 0) list[idx] = s;
  else list.unshift(s);
  list.sort((a, b) => (b.updated_at > a.updated_at ? 1 : -1));
  await writeCache(list);
}

export async function removeSession(id: number): Promise<void> {
  const list = await readCache();
  await writeCache(list.filter((x) => x.id !== id));
}
