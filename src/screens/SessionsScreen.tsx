import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StatusBar,
  StyleSheet,
  View,
} from 'react-native';
import {
  Button,
  Dialog,
  Portal,
  Snackbar,
  Text,
  useTheme,
} from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { deleteChat } from '../api';
import { getDeviceId } from '../deviceId';
import { loadSessions, removeSession, type LocalSession } from '../sessions';
import { useLanguage, type AppLanguage } from '../language';
import { brand } from '../theme';
import { BrandMark } from '../components/BrandMark';
import { TypingDots } from '../components/TypingDots';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import type { RootStackParamList } from '../navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Sessions'>;

type TimeStrings = { now: string; min: string; hr: string; day: string };

type Strings = {
  tag: string;
  statChats: string;
  statToday: string;
  getStarted: string;
  readyHeadline: string;
  readyHint: string;
  startChat: string;
  untitled: string;
  deleteTitle: string;
  deleteBody: (title: string) => string;
  cancel: string;
  delete: string;
  refreshFail: string;
  deleteFail: string;
  time: TimeStrings;
};

const COPY: Record<AppLanguage, Strings> = {
  en: {
    tag: 'VACCINATOR · AI ASSISTANT',
    statChats: 'CHATS',
    statToday: 'TODAY',
    getStarted: 'GET STARTED',
    readyHeadline: 'Your assistant is ready.',
    readyHint: 'Ask about vaccines, cold chain, schedules, or session monitoring.',
    startChat: 'Start a new chat',
    untitled: 'Untitled chat',
    deleteTitle: 'Delete this chat?',
    deleteBody: (t) => `"${t}" will be removed permanently.`,
    cancel: 'Cancel',
    delete: 'Delete',
    refreshFail: 'Could not refresh — showing cached.',
    deleteFail: 'Delete failed on server.',
    time: { now: 'now', min: 'm ago', hr: 'h ago', day: 'd ago' },
  },
  ur: {
    tag: 'ویکسینیٹر · اے آئی معاون',
    statChats: 'گفتگو',
    statToday: 'آج',
    getStarted: 'شروعات',
    readyHeadline: 'آپ کا معاون تیار ہے۔',
    readyHint: 'ویکسین، کولڈ چین، شیڈول، یا سیشن مانیٹرنگ کے بارے میں پوچھیں۔',
    startChat: 'نئی گفتگو شروع کریں',
    untitled: 'بلا عنوان گفتگو',
    deleteTitle: 'یہ گفتگو حذف کریں؟',
    deleteBody: (t) => `"${t}" مستقل طور پر حذف ہو جائے گی۔`,
    cancel: 'منسوخ',
    delete: 'حذف کریں',
    refreshFail: 'ریفریش نہیں ہو سکا — محفوظ شدہ دکھایا جا رہا ہے۔',
    deleteFail: 'سرور پر حذف ناکام۔',
    time: { now: 'ابھی', min: ' منٹ پہلے', hr: ' گھنٹے پہلے', day: ' دن پہلے' },
  },
  rud: {
    tag: 'VACCINATOR · AI MUAVIN',
    statChats: 'CHATS',
    statToday: 'AAJ',
    getStarted: 'SHURUAAT',
    readyHeadline: 'Aap ka muavin tayyar hai.',
    readyHint: 'Vaccine, cold chain, schedule, ya session monitoring ke baare mein poochein.',
    startChat: 'Nayi guftagu shuru karein',
    untitled: 'Be-unwan guftagu',
    deleteTitle: 'Yeh guftagu delete karein?',
    deleteBody: (t) => `"${t}" hamesha ke liye delete ho jayegi.`,
    cancel: 'Mansookh',
    delete: 'Delete karein',
    refreshFail: 'Refresh nahi ho saka — saved dikhaya ja raha hai.',
    deleteFail: 'Server par delete nakaam.',
    time: { now: 'abhi', min: ' min pehle', hr: ' ghante pehle', day: ' din pehle' },
  },
};

function relativeTime(iso: string, t: TimeStrings): string {
  const ms = new Date(iso).getTime();
  if (Number.isNaN(ms)) return '';
  const diff = Date.now() - ms;
  const m = Math.round(diff / 60_000);
  if (m < 1) return t.now;
  if (m < 60) return `${m}${t.min}`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}${t.hr}`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}${t.day}`;
  return new Date(iso).toLocaleDateString();
}

function todayCount(sessions: LocalSession[]): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return sessions.filter((s) => new Date(s.updated_at).getTime() >= today.getTime()).length;
}

/** A single chat row — memoized so list refreshes don't re-render every card. */
const SessionCard = memo(function SessionCard({
  item,
  untitled,
  time,
  onOpen,
  onDelete,
}: {
  item: LocalSession;
  untitled: string;
  time: TimeStrings;
  onOpen: (id: number) => void;
  onDelete: (item: LocalSession) => void;
}) {
  const titleIsUrdu = !!item.title && /[؀-ۿ]/.test(item.title);
  return (
    <Pressable
      onPress={() => onOpen(item.id)}
      onLongPress={() => onDelete(item)}
      android_ripple={{ color: 'rgba(7,32,63,0.06)' }}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.92 }]}
    >
      <View style={styles.cardLeft}>
        <View style={styles.cardMark}>
          <BrandMark size={20} />
        </View>
        <View style={styles.cardText}>
          <Text numberOfLines={2} style={[styles.cardTitle, titleIsUrdu ? styles.rtl : null]}>
            {item.title || untitled}
          </Text>
          <View style={styles.cardMeta}>
            <Text style={styles.cardMetaCount}>{item.message_count}</Text>
            <View style={styles.cardMetaDot} />
            <Text style={styles.cardMetaText}>{relativeTime(item.updated_at, time)}</Text>
          </View>
        </View>
      </View>
      <Pressable
        onPress={() => onDelete(item)}
        hitSlop={12}
        android_ripple={{ color: 'rgba(7,32,63,0.08)', borderless: true, radius: 18 }}
        style={styles.cardDelete}
      >
        <Text style={styles.cardDeleteIcon}>✕</Text>
      </Pressable>
    </Pressable>
  );
});

export default function SessionsScreen({ navigation }: Props) {
  const theme = useTheme();
  const { language } = useLanguage();
  const s = COPY[language];
  const rtl = language === 'ur';

  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<LocalSession[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingFirst, setLoadingFirst] = useState(true);
  const [snack, setSnack] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<LocalSession | null>(null);

  const refresh = useCallback(
    async (id: string) => {
      setRefreshing(true);
      try {
        const { cached, refresh: r } = await loadSessions(id);
        setSessions(cached);
        setSessions(await r);
      } catch {
        setSnack(s.refreshFail);
      } finally {
        setRefreshing(false);
        setLoadingFirst(false);
      }
    },
    [s.refreshFail],
  );

  useEffect(() => {
    (async () => {
      const id = await getDeviceId();
      setDeviceId(id);
      await refresh(id);
    })();
  }, [refresh]);

  useEffect(() => {
    const unsub = navigation.addListener('focus', () => {
      if (deviceId) refresh(deviceId);
    });
    return unsub;
  }, [deviceId, navigation, refresh]);

  const onConfirmDelete = useCallback(async () => {
    if (!confirmDelete || !deviceId) return;
    const id = confirmDelete.id;
    setConfirmDelete(null);
    setSessions((prev) => prev.filter((x) => x.id !== id));
    await removeSession(id);
    try {
      await deleteChat(deviceId, id);
    } catch {
      setSnack(s.deleteFail);
    }
  }, [confirmDelete, deviceId, s.deleteFail]);

  const openChat = useCallback(
    (id: number) => navigation.navigate('Chat', { chatId: id }),
    [navigation],
  );
  const requestDelete = useCallback((item: LocalSession) => setConfirmDelete(item), []);

  const stats = useMemo(
    () => ({ total: sessions.length, today: todayCount(sessions) }),
    [sessions],
  );

  const renderItem = useCallback(
    ({ item }: { item: LocalSession }) => (
      <SessionCard
        item={item}
        untitled={s.untitled}
        time={s.time}
        onOpen={openChat}
        onDelete={requestDelete}
      />
    ),
    [s.untitled, s.time, openChat, requestDelete],
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar barStyle="light-content" backgroundColor={brand.ink} />

      <LinearGradient
        colors={[brand.ink, brand.indigo]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.headerInner}>
          <View style={styles.headerTopRow}>
            <View style={styles.headerBrandRow}>
              <BrandMark size={36} />
              <View style={styles.headerBrandText}>
                <Text style={styles.headerBrandName}>Tahaffuz</Text>
                <Text style={[styles.headerBrandTag, rtl ? styles.rtl : null]} numberOfLines={1}>
                  {s.tag}
                </Text>
              </View>
            </View>
            <LanguageSwitcher />
          </View>
          {sessions.length > 0 && (
            <View style={styles.statsRow}>
              <Stat label={s.statChats} value={String(stats.total)} />
              <Stat label={s.statToday} value={String(stats.today)} accent />
            </View>
          )}
        </View>
      </LinearGradient>

      {loadingFirst ? (
        <View style={styles.loading}>
          <TypingDots size={8} />
        </View>
      ) : sessions.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyMarkRing}>
            <BrandMark size={84} />
          </View>
          <Text style={styles.eyebrow}>{s.getStarted}</Text>
          <Text style={[styles.emptyHeadline, rtl ? styles.rtl : null]}>{s.readyHeadline}</Text>
          <Text style={[styles.emptyHint, rtl ? styles.rtl : null]}>{s.readyHint}</Text>
          <Pressable
            onPress={() => navigation.navigate('Chat', { chatId: null })}
            android_ripple={{ color: 'rgba(244,238,227,0.18)' }}
            style={({ pressed }) => [styles.emptyCta, pressed && { opacity: 0.92 }]}
          >
            <Text style={styles.emptyCtaText}>{s.startChat}</Text>
            <Text style={styles.emptyCtaArrow}>→</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={sessions}
          keyExtractor={(item) => String(item.id)}
          ItemSeparatorComponent={Separator}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => deviceId && refresh(deviceId)}
              tintColor={brand.indigo}
              colors={[brand.indigo]}
            />
          }
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={9}
        />
      )}

      {sessions.length > 0 && (
        <Pressable
          onPress={() => navigation.navigate('Chat', { chatId: null })}
          android_ripple={{ color: 'rgba(244,238,227,0.25)', borderless: true, radius: 30 }}
          style={({ pressed }) => [styles.fab, pressed && { opacity: 0.94 }]}
        >
          <Text style={styles.fabIcon}>+</Text>
        </Pressable>
      )}

      <Portal>
        <Dialog visible={!!confirmDelete} onDismiss={() => setConfirmDelete(null)} style={styles.dialog}>
          <Dialog.Title style={[styles.dialogTitle, rtl ? styles.rtl : null]}>
            {s.deleteTitle}
          </Dialog.Title>
          <Dialog.Content>
            <Text style={[styles.dialogBody, rtl ? styles.rtl : null]} numberOfLines={3}>
              {s.deleteBody(confirmDelete?.title || s.untitled)}
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setConfirmDelete(null)} textColor={brand.indigoSoft}>
              {s.cancel}
            </Button>
            <Button onPress={onConfirmDelete} textColor="#B3261E">
              {s.delete}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Snackbar visible={!!snack} onDismiss={() => setSnack(null)} duration={2400}>
        {snack ?? ''}
      </Snackbar>
    </View>
  );
}

function Separator() {
  return <View style={styles.itemGap} />;
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <View style={styles.statBox}>
      <Text style={[styles.statValue, accent && { color: brand.amber }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  rtl: { writingDirection: 'rtl', textAlign: 'right' },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Header
  header: {
    paddingTop: Platform.OS === 'ios' ? 56 : (StatusBar.currentHeight ?? 0) + 16,
    paddingBottom: 22,
    paddingHorizontal: 20,
  },
  headerInner: { gap: 18 },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerBrandRow: { flexDirection: 'row', alignItems: 'center', gap: 14, flexShrink: 1 },
  headerBrandText: { flexShrink: 1 },
  headerBrandName: {
    color: brand.cream,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.3,
    lineHeight: 28,
  },
  headerBrandTag: {
    color: 'rgba(244,238,227,0.62)',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2.2,
    marginTop: 2,
  },
  statsRow: { flexDirection: 'row', gap: 18 },
  statBox: { flex: 0 },
  statValue: {
    color: brand.cream,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  statLabel: {
    color: 'rgba(244,238,227,0.52)',
    fontSize: 10,
    letterSpacing: 1.8,
    fontWeight: '700',
    marginTop: 2,
  },

  // List
  list: { padding: 16, paddingBottom: 120 },
  itemGap: { height: 10 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: brand.paper,
    borderRadius: 16,
    paddingVertical: 14,
    paddingLeft: 14,
    paddingRight: 6,
    borderWidth: 1,
    borderColor: 'rgba(7,32,63,0.06)',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  cardLeft: { flex: 1, flexDirection: 'row', gap: 12, alignItems: 'center' },
  cardMark: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(20,60,108,0.07)',
    justifyContent: 'center', alignItems: 'center',
  },
  cardText: { flex: 1, gap: 4 },
  cardTitle: { color: brand.ink, fontSize: 15, fontWeight: '600', lineHeight: 20 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardMetaCount: {
    color: brand.indigo,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  cardMetaDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: brand.indigoSoft, opacity: 0.5 },
  cardMetaText: { color: brand.indigoSoft, fontSize: 11, opacity: 0.78 },

  cardDelete: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  cardDeleteIcon: { color: brand.indigoSoft, fontSize: 16, opacity: 0.55 },

  // Empty state
  empty: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 48,
    alignItems: 'center',
    gap: 12,
  },
  emptyMarkRing: {
    width: 116,
    height: 116,
    borderRadius: 58,
    backgroundColor: brand.paper,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(7,32,63,0.06)',
    marginBottom: 4,
  },
  eyebrow: {
    color: brand.indigoSoft,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2.5,
    marginTop: 4,
  },
  emptyHeadline: {
    color: brand.ink,
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
    textAlign: 'center',
    lineHeight: 32,
  },
  emptyHint: {
    color: brand.indigoSoft,
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    opacity: 0.85,
    maxWidth: 320,
  },
  emptyCta: {
    marginTop: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: brand.ink,
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderRadius: 999,
    shadowColor: brand.ink,
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  emptyCtaText: {
    color: brand.cream,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  emptyCtaArrow: { color: brand.amber, fontSize: 18, fontWeight: '700' },

  // FAB
  fab: {
    position: 'absolute',
    right: 18,
    bottom: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: brand.ink,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: brand.ink,
    shadowOpacity: 0.3,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  fabIcon: { color: brand.cream, fontSize: 28, fontWeight: '300', lineHeight: 28 },

  // Dialog
  dialog: { borderRadius: 18, backgroundColor: brand.paper },
  dialogTitle: { color: brand.ink, fontWeight: '700' },
  dialogBody: { color: brand.indigoSoft, fontSize: 14, lineHeight: 20 },
});
