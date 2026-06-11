import { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  View,
} from 'react-native';
import { Icon, Snackbar, Text, useTheme } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { deleteBookmark, listBookmarks, type Bookmark } from '../api';
import { getDeviceId } from '../deviceId';
import { useLanguage, type AppLanguage } from '../language';
import { brand } from '../theme';
import { TypingDots } from '../components/TypingDots';
import type { RootStackParamList } from '../navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Bookmarks'>;

type Strings = {
  title: string;
  emptyHeadline: string;
  emptyHint: string;
  loadFail: string;
  deleteFail: string;
  removed: string;
  openHint: string;
};

const COPY: Record<AppLanguage, Strings> = {
  en: {
    title: 'Saved Answers',
    emptyHeadline: 'No saved answers yet',
    emptyHint: 'Tap the bookmark icon on any answer to save it here.',
    loadFail: 'Could not load saved answers. Please try again.',
    deleteFail: 'Could not remove. Please try again.',
    removed: 'Removed from saved answers.',
    openHint: 'Tap to open the full chat',
  },
  ur: {
    title: 'محفوظ جوابات',
    emptyHeadline: 'ابھی کوئی محفوظ جواب نہیں',
    emptyHint: 'کسی بھی جواب پر بک مارک کا نشان دبائیں تاکہ وہ یہاں محفوظ ہو جائے۔',
    loadFail: 'محفوظ جوابات لوڈ نہیں ہو سکے۔ دوبارہ کوشش کریں۔',
    deleteFail: 'حذف نہیں ہو سکا۔ دوبارہ کوشش کریں۔',
    removed: 'محفوظ جوابات سے حذف ہو گیا۔',
    openHint: 'پوری گفتگو کھولنے کے لیے دبائیں',
  },
  rud: {
    title: 'Saved Jawabat',
    emptyHeadline: 'Abhi koi saved jawab nahi',
    emptyHint: 'Kisi bhi jawab par bookmark icon dabayen take wo yahan save ho jaye.',
    loadFail: 'Saved jawabat load nahi ho sake. Dobara try karein.',
    deleteFail: 'Remove nahi ho saka. Dobara try karein.',
    removed: 'Saved jawabat se remove ho gaya.',
    openHint: 'Poori guftagu kholne ke liye dabayen',
  },
  ps: {
    title: 'خوندي ځوابونه',
    emptyHeadline: 'تر اوسه هیڅ خوندي ځواب نشته',
    emptyHint: 'د هر ځواب په بک مارک نښه ټچ وکړئ ترڅو دلته خوندي شي.',
    loadFail: 'خوندي ځوابونه لوډ نه شول. بیا هڅه وکړئ.',
    deleteFail: 'لرې نه شو. بیا هڅه وکړئ.',
    removed: 'له خوندي ځوابونو لرې شو.',
    openHint: 'د بشپړو خبرو خلاصولو لپاره ټچ وکړئ',
  },
  sd: {
    title: 'محفوظ جواب',
    emptyHeadline: 'اڃا ڪو محفوظ جواب ناهي',
    emptyHint: 'ڪنهن به جواب تي بڪ مارڪ نشان دٻايو ته جيئن اهو هتي محفوظ ٿئي.',
    loadFail: 'محفوظ جواب لوڊ نه ٿي سگهيا. ٻيهر ڪوشش ڪريو.',
    deleteFail: 'هٽائي نه سگهيو. ٻيهر ڪوشش ڪريو.',
    removed: 'محفوظ جوابن مان هٽايو ويو.',
    openHint: 'مڪمل گفتگو کولڻ لاءِ دٻايو',
  },
};

const hasArabicScript = (t: string) => /[؀-ۿ]/.test(t);

/** A single saved answer card — memoized so deletes don't re-render the rest. */
const BookmarkCard = memo(function BookmarkCard({
  item,
  onOpen,
  onDelete,
}: {
  item: Bookmark;
  onOpen: (item: Bookmark) => void;
  onDelete: (item: Bookmark) => void;
}) {
  const content = item.message?.content ?? '';
  const chatTitle = item.message?.chat?.title ?? '';
  const rtl = hasArabicScript(content);
  return (
    <Pressable
      onPress={() => onOpen(item)}
      android_ripple={{ color: 'rgba(7,32,63,0.06)' }}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.92 }]}
      accessibilityRole="button"
    >
      <View style={styles.cardTop}>
        <View style={styles.cardBookmarkBadge}>
          <Icon source="bookmark" size={16} color={brand.amber} />
        </View>
        {!!chatTitle && (
          <Text
            numberOfLines={1}
            style={[styles.cardChatTitle, hasArabicScript(chatTitle) ? styles.rtl : null]}
          >
            {chatTitle}
          </Text>
        )}
        <Pressable
          onPress={() => onDelete(item)}
          hitSlop={12}
          android_ripple={{ color: 'rgba(7,32,63,0.08)', borderless: true, radius: 18 }}
          style={styles.cardDelete}
          accessibilityRole="button"
          accessibilityLabel="Remove saved answer"
        >
          <Icon source="close" size={18} color={brand.indigoSoft} />
        </Pressable>
      </View>
      <Text numberOfLines={4} style={[styles.cardContent, rtl ? styles.rtl : null]}>
        {content}
      </Text>
      {!!item.note && (
        <Text numberOfLines={2} style={[styles.cardNote, hasArabicScript(item.note) ? styles.rtl : null]}>
          {item.note}
        </Text>
      )}
    </Pressable>
  );
});

export default function BookmarksScreen({ navigation }: Props) {
  const theme = useTheme();
  const { language } = useLanguage();
  const s = COPY[language];
  const rtl = language === 'ur' || language === 'ps' || language === 'sd';

  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [items, setItems] = useState<Bookmark[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [snack, setSnack] = useState<string | null>(null);
  const pageRef = useRef(1);
  const lastPageRef = useRef(1);

  const load = useCallback(
    async (id: string) => {
      setLoading(true);
      try {
        const res = await listBookmarks(id, 1);
        pageRef.current = 1;
        lastPageRef.current = res.lastPage;
        setItems(res.data);
      } catch {
        setSnack(s.loadFail);
      } finally {
        setLoading(false);
      }
    },
    [s.loadFail],
  );

  useEffect(() => {
    (async () => {
      const id = await getDeviceId();
      setDeviceId(id);
      await load(id);
    })();
  }, [load]);

  const loadMore = useCallback(async () => {
    if (!deviceId || loadingMore || pageRef.current >= lastPageRef.current) return;
    setLoadingMore(true);
    try {
      const next = pageRef.current + 1;
      const res = await listBookmarks(deviceId, next);
      pageRef.current = next;
      lastPageRef.current = res.lastPage;
      setItems((prev) => [...prev, ...res.data]);
    } catch {
      // Silently keep what we have; pull-to-refresh isn't needed here.
    } finally {
      setLoadingMore(false);
    }
  }, [deviceId, loadingMore]);

  const handleDelete = useCallback(
    async (item: Bookmark) => {
      if (!deviceId) return;
      setItems((prev) => prev.filter((x) => x.id !== item.id));
      try {
        await deleteBookmark(item.id, deviceId);
        setSnack(s.removed);
      } catch {
        setItems((prev) => [item, ...prev]);
        setSnack(s.deleteFail);
      }
    },
    [deviceId, s.deleteFail, s.removed],
  );

  const handleOpen = useCallback(
    (item: Bookmark) => {
      const chatId = item.message?.chat?.id;
      if (chatId) navigation.navigate('Chat', { chatId });
    },
    [navigation],
  );

  const renderItem = useCallback(
    ({ item }: { item: Bookmark }) => (
      <BookmarkCard item={item} onOpen={handleOpen} onDelete={handleDelete} />
    ),
    [handleOpen, handleDelete],
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
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => navigation.goBack()}
            android_ripple={{ color: 'rgba(244,238,227,0.2)', borderless: true }}
            style={styles.headerBackBtn}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Icon source="arrow-left" size={24} color={brand.cream} />
          </Pressable>
          <Text style={[styles.headerTitle, rtl ? styles.rtl : null]}>{s.title}</Text>
          <View style={styles.headerSpacer} />
        </View>
      </LinearGradient>

      {loading ? (
        <View style={styles.loading}>
          <TypingDots size={8} />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIconRing}>
            <Icon source="bookmark-outline" size={48} color={brand.indigoSoft} />
          </View>
          <Text style={[styles.emptyHeadline, rtl ? styles.rtl : null]}>{s.emptyHeadline}</Text>
          <Text style={[styles.emptyHint, rtl ? styles.rtl : null]}>{s.emptyHint}</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
          ItemSeparatorComponent={Separator}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footerLoading}>
                <TypingDots size={6} />
              </View>
            ) : null
          }
        />
      )}

      <Snackbar visible={!!snack} onDismiss={() => setSnack(null)} duration={2400}>
        {snack ?? ''}
      </Snackbar>
    </View>
  );
}

function Separator() {
  return <View style={styles.itemGap} />;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  rtl: { writingDirection: 'rtl', textAlign: 'right' },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    paddingTop: Platform.OS === 'ios' ? 56 : (StatusBar.currentHeight ?? 0) + 12,
    paddingBottom: 18,
    paddingHorizontal: 16,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerBackBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(244,238,227,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    color: brand.cream,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  headerSpacer: { width: 44 },

  list: { padding: 18, paddingBottom: 40 },
  itemGap: { height: 12 },
  footerLoading: { paddingVertical: 16, alignItems: 'center' },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    gap: 10,
    shadowColor: brand.ink,
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardBookmarkBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(224,162,74,0.14)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardChatTitle: {
    flex: 1,
    color: brand.indigoSoft,
    fontSize: 13,
    fontWeight: '600',
  },
  cardDelete: { width: 32, height: 32, justifyContent: 'center', alignItems: 'center' },
  cardContent: { color: brand.ink, fontSize: 15, lineHeight: 23 },
  cardNote: {
    color: brand.indigoSoft,
    fontSize: 13,
    fontStyle: 'italic',
    lineHeight: 19,
  },

  empty: {
    flex: 1,
    paddingHorizontal: 32,
    paddingTop: 60,
    alignItems: 'center',
    gap: 12,
  },
  emptyIconRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
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
  emptyHeadline: {
    color: brand.ink,
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 28,
  },
  emptyHint: {
    color: brand.indigoSoft,
    fontSize: 15,
    lineHeight: 23,
    textAlign: 'center',
    maxWidth: 300,
  },
});
