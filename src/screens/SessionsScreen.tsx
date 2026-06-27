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
  Icon,
  Portal,
  Snackbar,
  Text,
  useTheme,
} from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import Constants from 'expo-constants';
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
  fa: {
    tag: 'واکسیناتور · دستیار هوش مصنوعی',
    statChats: 'گفتگوها',
    statToday: 'امروز',
    getStarted: 'شروع',
    readyHeadline: 'دستیار شما آماده است.',
    readyHint: 'درباره واکسن، زنجیره سرد، برنامه یا نظارت بر جلسه بپرسید.',
    startChat: 'گفتگوی جدید را شروع کنید',
    untitled: 'گفتگوی بدون عنوان',
    deleteTitle: 'این گفتگو حذف شود؟',
    deleteBody: (t) => `«${t}» برای همیشه حذف خواهد شد.`,
    cancel: 'لغو',
    delete: 'حذف',
    refreshFail: 'تازه‌سازی نشد — نسخه ذخیره‌شده نمایش داده می‌شود.',
    deleteFail: 'حذف در سرور ناموفق بود.',
    time: { now: 'اکنون', min: ' دقیقه پیش', hr: ' ساعت پیش', day: ' روز پیش' },
  },
  ps: {
    tag: 'واکسینیټر · اے آئی مرستندویه',
    statChats: 'خبرې',
    statToday: 'نن',
    getStarted: 'پیل کړئ',
    readyHeadline: 'ستاسو مرستندویه چمتو دی.',
    readyHint: 'د واکسینونو، کولډ چین، شیډول، یا سیشن څارنې په اړه پوښتنه وکړئ.',
    startChat: 'نوې خبرې پیل کړئ',
    untitled: 'بې سرلیکه خبرې',
    deleteTitle: 'دا خبرې حذف کړئ؟',
    deleteBody: (t) => `"${t}" به تل لپاره حذف شي.`,
    cancel: 'لغوه',
    delete: 'حذف کړئ',
    refreshFail: 'تازه نه شو — زیرمه شوي ښودل کیږي.',
    deleteFail: 'په سرور کې حذف ناکام شو.',
    time: { now: 'اوس', min: ' دقیقې مخکې', hr: ' ساعتونه مخکې', day: ' ورځې مخکې' },
  },
  sd: {
    tag: 'ويڪسينيٽر · اي آءِ معاون',
    statChats: 'چيٽس',
    statToday: 'اڄ',
    getStarted: 'شروعات',
    readyHeadline: 'توهان جو معاون تيار آهي.',
    readyHint: 'ويڪسين، ڪولڊ چين، شيڊول، يا سيشن مانيٽرنگ بابت پڇو.',
    startChat: 'نئين گفتگو شروع ڪريو',
    untitled: 'بغير عنوان گفتگو',
    deleteTitle: 'هي گفتگو ختم ڪريو؟',
    deleteBody: (t) => `"${t}" هميشه لاءِ ختم ٿي ويندي.`,
    cancel: 'منسوخ',
    delete: 'ختم ڪريو',
    refreshFail: 'ريفريش نه ٿي سگهيو — محفوظ ڏيکاريو پيو وڃي.',
    deleteFail: 'سرور تي ختم ناڪام.',
    time: { now: 'هاڻي', min: ' منٽ اڳ', hr: ' ڪلاڪ اڳ', day: ' ڏينهن اڳ' },
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

/** App version, shown in the header so we can tell which build a user is on. */
const APP_VERSION = Constants.expoConfig?.version ?? '';

export default function SessionsScreen({ navigation }: Props) {
  const theme = useTheme();
  const { language } = useLanguage();
  const s = COPY[language];
  const rtl = language === 'ur' || language === 'fa' || language === 'ps' || language === 'sd';

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
            <Pressable
              onPress={() => navigation.goBack()}
              android_ripple={{ color: 'rgba(244,238,227,0.2)', borderless: true }}
              style={styles.headerBackBtn}
              accessibilityRole="button"
              accessibilityLabel="Back to chat"
            >
              <Icon source="arrow-left" size={24} color={brand.cream} />
            </Pressable>
            <View style={styles.headerBrandRow}>
              <View style={styles.headerBrandText}>
                <View style={styles.headerNameRow}>
                  <Text style={styles.headerBrandName}>Chats</Text>
                  {APP_VERSION !== '' && (
                    <Text style={styles.headerVersion}>v{APP_VERSION}</Text>
                  )}
                </View>
              </View>
            </View>
            <View style={styles.headerActions}>
              <Pressable
                onPress={() => navigation.navigate('Search')}
                android_ripple={{ color: 'rgba(244,238,227,0.2)', borderless: true }}
                style={styles.headerIconBtn}
                accessibilityRole="button"
                accessibilityLabel="Search chats"
              >
                <Icon source="magnify" size={22} color={brand.cream} />
              </Pressable>
              <Pressable
                onPress={() => navigation.navigate('Bookmarks')}
                android_ripple={{ color: 'rgba(244,238,227,0.2)', borderless: true }}
                style={styles.headerIconBtn}
                accessibilityRole="button"
                accessibilityLabel="Saved answers"
              >
                <Icon source="bookmark-outline" size={22} color={brand.cream} />
              </Pressable>
              <Pressable
                onPress={() => navigation.navigate('Schedule')}
                android_ripple={{ color: 'rgba(244,238,227,0.2)', borderless: true }}
                style={styles.headerIconBtn}
                accessibilityRole="button"
                accessibilityLabel="Vaccination schedule"
              >
                <Icon source="calendar-check" size={22} color={brand.cream} />
              </Pressable>
              <Pressable
                onPress={() => navigation.navigate('Memory')}
                android_ripple={{ color: 'rgba(244,238,227,0.2)', borderless: true }}
                style={styles.headerIconBtn}
                accessibilityRole="button"
                accessibilityLabel="What the assistant remembers"
              >
                <Icon source="brain" size={22} color={brand.cream} />
              </Pressable>
              <LanguageSwitcher />
            </View>
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
            onPress={() => navigation.navigate('Chat', { chatId: null, fresh: Date.now() })}
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
          onPress={() => navigation.navigate('Chat', { chatId: null, fresh: Date.now() })}
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

  // Header - polished
  header: {
    paddingTop: Platform.OS === 'ios' ? 58 : (StatusBar.currentHeight ?? 0) + 18,
    paddingBottom: 24,
    paddingHorizontal: 22,
  },
  headerInner: { gap: 20 },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
  },
  headerBrandRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, flexShrink: 1 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerBackBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(244,238,227,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(244,238,227,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerBrandText: { flexShrink: 1 },
  headerNameRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  headerBrandName: {
    color: brand.cream,
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: 0.2,
    lineHeight: 30,
  },
  headerVersion: {
    color: 'rgba(244,238,227,0.5)',
    fontSize: 12,
    fontWeight: '600',
  },
  headerBrandTag: {
    color: 'rgba(244,238,227,0.6)',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1.8,
    marginTop: 4,
  },
  statsRow: { flexDirection: 'row', gap: 24 },
  statBox: { flex: 0 },
  statValue: {
    color: brand.cream,
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  statLabel: {
    color: 'rgba(244,238,227,0.5)',
    fontSize: 10,
    letterSpacing: 1.6,
    fontWeight: '600',
    marginTop: 3,
  },

  // List - cleaner cards
  list: { padding: 18, paddingBottom: 120 },
  itemGap: { height: 12 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingVertical: 16,
    paddingLeft: 16,
    paddingRight: 8,
    shadowColor: brand.ink,
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  cardLeft: { flex: 1, flexDirection: 'row', gap: 14, alignItems: 'center' },
  cardMark: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(20,60,108,0.06)',
    justifyContent: 'center', alignItems: 'center',
  },
  cardText: { flex: 1, gap: 5 },
  cardTitle: { color: brand.ink, fontSize: 16, fontWeight: '600', lineHeight: 22 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardMetaCount: {
    color: brand.indigo,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  cardMetaDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: brand.amber, opacity: 0.7 },
  cardMetaText: { color: brand.indigoSoft, fontSize: 12, opacity: 0.8 },

  cardDelete: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  cardDeleteIcon: { color: brand.indigoSoft, fontSize: 16, opacity: 0.5 },

  // Empty state - cleaner visual hierarchy
  empty: {
    flex: 1,
    paddingHorizontal: 32,
    paddingTop: 52,
    alignItems: 'center',
    gap: 14,
  },
  emptyMarkRing: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: brand.ink,
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
    marginBottom: 6,
  },
  eyebrow: {
    color: brand.amber,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    marginTop: 6,
  },
  emptyHeadline: {
    color: brand.ink,
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 30,
    marginTop: 2,
  },
  emptyHint: {
    color: brand.indigoSoft,
    fontSize: 15,
    lineHeight: 23,
    textAlign: 'center',
    opacity: 0.9,
    maxWidth: 300,
  },
  emptyCta: {
    marginTop: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: brand.ink,
    paddingVertical: 16,
    paddingHorizontal: 26,
    borderRadius: 999,
    shadowColor: brand.ink,
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  emptyCtaText: {
    color: brand.cream,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  emptyCtaArrow: { color: brand.amber, fontSize: 20, fontWeight: '600' },

  // FAB - more prominent
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 28,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: brand.ink,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: brand.ink,
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  fabIcon: { color: brand.cream, fontSize: 32, fontWeight: '300', lineHeight: 32 },

  // Dialog
  dialog: { borderRadius: 20, backgroundColor: '#FFFFFF' },
  dialogTitle: { color: brand.ink, fontWeight: '700' },
  dialogBody: { color: brand.indigoSoft, fontSize: 15, lineHeight: 22 },
});
