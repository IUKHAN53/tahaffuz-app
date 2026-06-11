import { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Icon, Snackbar, Text, useTheme } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { searchMessages, type SearchResult } from '../api';
import { getDeviceId } from '../deviceId';
import { useLanguage, type AppLanguage } from '../language';
import { brand } from '../theme';
import { TypingDots } from '../components/TypingDots';
import type { RootStackParamList } from '../navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Search'>;

type Strings = {
  title: string;
  placeholder: string;
  hintStart: string;
  noResults: string;
  searchFail: string;
  youBadge: string;
};

const COPY: Record<AppLanguage, Strings> = {
  en: {
    title: 'Search',
    placeholder: 'Search your questions and answers...',
    hintStart: 'Type at least 2 letters to search your chats.',
    noResults: 'No results found. Try different words.',
    searchFail: 'Search failed. Please try again.',
    youBadge: 'You',
  },
  ur: {
    title: 'تلاش',
    placeholder: 'اپنے سوالات اور جوابات تلاش کریں...',
    hintStart: 'تلاش کے لیے کم از کم 2 حروف لکھیں۔',
    noResults: 'کوئی نتیجہ نہیں ملا۔ دوسرے الفاظ آزمائیں۔',
    searchFail: 'تلاش ناکام۔ دوبارہ کوشش کریں۔',
    youBadge: 'آپ',
  },
  rud: {
    title: 'Talash',
    placeholder: 'Apne sawalat aur jawabat talash karein...',
    hintStart: 'Talash ke liye kam az kam 2 huroof likhein.',
    noResults: 'Koi nateeja nahi mila. Dusre alfaz try karein.',
    searchFail: 'Talash nakaam. Dobara koshish karein.',
    youBadge: 'Aap',
  },
  ps: {
    title: 'لټون',
    placeholder: 'خپلې پوښتنې او ځوابونه ولټوئ...',
    hintStart: 'د لټون لپاره لږ تر لږه 2 توري ولیکئ.',
    noResults: 'هیڅ پایله ونه موندل شوه. نور ټکي وازمویئ.',
    searchFail: 'لټون ناکام شو. بیا هڅه وکړئ.',
    youBadge: 'تاسو',
  },
  sd: {
    title: 'ڳولا',
    placeholder: 'پنهنجا سوال ۽ جواب ڳوليو...',
    hintStart: 'ڳولا لاءِ گهٽ ۾ گهٽ 2 اکر لکو.',
    noResults: 'ڪو نتيجو نه مليو. ٻيا لفظ آزمايو.',
    searchFail: 'ڳولا ناڪام. ٻيهر ڪوشش ڪريو.',
    youBadge: 'توهان',
  },
};

const hasArabicScript = (t: string) => /[؀-ۿ]/.test(t);

/** One search hit — memoized so typing doesn't re-render existing rows. */
const ResultCard = memo(function ResultCard({
  item,
  youBadge,
  onOpen,
}: {
  item: SearchResult;
  youBadge: string;
  onOpen: (chatId: number) => void;
}) {
  const isUser = item.role === 'user';
  const rtl = hasArabicScript(item.content);
  const chatTitle = item.chat?.title ?? '';
  return (
    <Pressable
      onPress={() => onOpen(item.chat_id)}
      android_ripple={{ color: 'rgba(7,32,63,0.06)' }}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.92 }]}
      accessibilityRole="button"
    >
      <View style={styles.cardTop}>
        <View style={[styles.roleBadge, isUser ? styles.roleBadgeUser : styles.roleBadgeBot]}>
          <Text style={[styles.roleBadgeText, isUser && { color: brand.cream }]}>
            {isUser ? youBadge : 'Tahaffuz'}
          </Text>
        </View>
        {!!chatTitle && (
          <Text
            numberOfLines={1}
            style={[styles.cardChatTitle, hasArabicScript(chatTitle) ? styles.rtl : null]}
          >
            {chatTitle}
          </Text>
        )}
      </View>
      <Text numberOfLines={3} style={[styles.cardContent, rtl ? styles.rtl : null]}>
        {item.content}
      </Text>
    </Pressable>
  );
});

export default function SearchScreen({ navigation }: Props) {
  const theme = useTheme();
  const { language } = useLanguage();
  const s = COPY[language];
  const rtl = language === 'ur' || language === 'ps' || language === 'sd';

  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [snack, setSnack] = useState<string | null>(null);
  const requestSeq = useRef(0);

  useEffect(() => {
    getDeviceId().then(setDeviceId);
  }, []);

  // Debounced search as the user types.
  useEffect(() => {
    const trimmed = query.trim();
    if (!deviceId || trimmed.length < 2) {
      setResults([]);
      setSearched(false);
      setSearching(false);
      return;
    }
    const seq = ++requestSeq.current;
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const data = await searchMessages(deviceId, trimmed);
        if (seq !== requestSeq.current) return; // a newer query superseded this one
        setResults(data);
        setSearched(true);
      } catch {
        if (seq !== requestSeq.current) return;
        setSnack(s.searchFail);
      } finally {
        if (seq === requestSeq.current) setSearching(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [deviceId, query, s.searchFail]);

  const openChat = useCallback(
    (chatId: number) => navigation.navigate('Chat', { chatId }),
    [navigation],
  );

  const renderItem = useCallback(
    ({ item }: { item: SearchResult }) => (
      <ResultCard item={item} youBadge={s.youBadge} onOpen={openChat} />
    ),
    [s.youBadge, openChat],
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
          <View style={styles.searchBox}>
            <Icon source="magnify" size={20} color="rgba(7,32,63,0.45)" />
            <TextInput
              autoFocus
              value={query}
              onChangeText={setQuery}
              placeholder={s.placeholder}
              placeholderTextColor="rgba(7,32,63,0.42)"
              style={[styles.searchInput, rtl ? styles.rtl : null]}
              cursorColor={brand.indigo}
              returnKeyType="search"
            />
            {query.length > 0 && (
              <Pressable
                onPress={() => setQuery('')}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Clear search"
              >
                <Icon source="close-circle" size={20} color="rgba(7,32,63,0.35)" />
              </Pressable>
            )}
          </View>
        </View>
      </LinearGradient>

      {searching ? (
        <View style={styles.loading}>
          <TypingDots size={8} />
        </View>
      ) : query.trim().length < 2 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIconRing}>
            <Icon source="magnify" size={48} color={brand.indigoSoft} />
          </View>
          <Text style={[styles.emptyHint, rtl ? styles.rtl : null]}>{s.hintStart}</Text>
        </View>
      ) : searched && results.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIconRing}>
            <Icon source="magnify-close" size={48} color={brand.indigoSoft} />
          </View>
          <Text style={[styles.emptyHint, rtl ? styles.rtl : null]}>{s.noResults}</Text>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => String(item.id)}
          ItemSeparatorComponent={Separator}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
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
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    paddingHorizontal: 14,
    height: 44,
  },
  searchInput: {
    flex: 1,
    color: brand.ink,
    fontSize: 15,
    paddingVertical: 0,
  },

  list: { padding: 18, paddingBottom: 40 },
  itemGap: { height: 12 },

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
  roleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  roleBadgeUser: { backgroundColor: brand.ink },
  roleBadgeBot: { backgroundColor: 'rgba(224,162,74,0.16)' },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: brand.ink,
  },
  cardChatTitle: {
    flex: 1,
    color: brand.indigoSoft,
    fontSize: 13,
    fontWeight: '600',
  },
  cardContent: { color: brand.ink, fontSize: 15, lineHeight: 23 },

  empty: {
    flex: 1,
    paddingHorizontal: 32,
    paddingTop: 60,
    alignItems: 'center',
    gap: 16,
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
  },
  emptyHint: {
    color: brand.indigoSoft,
    fontSize: 15,
    lineHeight: 23,
    textAlign: 'center',
    maxWidth: 300,
  },
});
