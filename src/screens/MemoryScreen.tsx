import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Platform, Pressable, StatusBar, StyleSheet, View } from 'react-native';
import { Icon, Snackbar, Text } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { clearMemories, getMemories, type MemoryItem } from '../api';
import { getDeviceId } from '../deviceId';
import { useLanguage, type AppLanguage } from '../language';
import { brand } from '../theme';
import { TypingDots } from '../components/TypingDots';
import type { RootStackParamList } from '../navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Memory'>;

type Strings = {
  title: string;
  subtitle: string;
  child: string;
  facts: string;
  empty: string;
  clear: string;
  confirmTitle: string;
  confirmBody: string;
  cancel: string;
  cleared: string;
  failed: string;
};

const COPY: Record<AppLanguage, Strings> = {
  en: {
    title: 'What I remember', subtitle: 'Details the assistant has learned, to help answer without re-asking.',
    child: 'Current child', facts: 'From your conversations', empty: 'Nothing remembered yet.',
    clear: 'Clear all memory', confirmTitle: 'Clear memory?', confirmBody: 'The assistant will forget everything it has learned. This cannot be undone.',
    cancel: 'Cancel', cleared: 'Memory cleared.', failed: 'Could not load. Check your connection.',
  },
  ur: {
    title: 'مجھے کیا یاد ہے', subtitle: 'معاون نے جو تفصیلات سیکھی ہیں تاکہ بار بار نہ پوچھے۔',
    child: 'موجودہ بچہ', facts: 'آپ کی گفتگو سے', empty: 'ابھی کچھ یاد نہیں۔',
    clear: 'تمام یادداشت صاف کریں', confirmTitle: 'یادداشت صاف کریں؟', confirmBody: 'معاون سب کچھ بھول جائے گا۔ یہ واپس نہیں ہو سکتا۔',
    cancel: 'منسوخ', cleared: 'یادداشت صاف ہو گئی۔', failed: 'لوڈ نہیں ہو سکا۔ کنکشن چیک کریں۔',
  },
  fa: {
    title: 'آنچه به یاد دارم', subtitle: 'جزئیاتی که دستیار آموخته تا بدون پرسش دوباره پاسخ دهد.',
    child: 'کودک فعلی', facts: 'از گفتگوهای شما', empty: 'هنوز چیزی به خاطر سپرده نشده.',
    clear: 'پاک کردن همه حافظه', confirmTitle: 'حافظه پاک شود؟', confirmBody: 'دستیار همه‌چیز را فراموش می‌کند. قابل بازگشت نیست.',
    cancel: 'لغو', cleared: 'حافظه پاک شد.', failed: 'بارگیری نشد. اتصال را بررسی کنید.',
  },
  ps: {
    title: 'څه مې په یاد دي', subtitle: 'هغه جزئیات چې مرستندویه زده کړي ترڅو بیا پوښتنه ونه کړي.',
    child: 'اوسنی ماشوم', facts: 'ستاسو له خبرو اترو', empty: 'تر اوسه څه نه دي یاد.',
    clear: 'ټوله حافظه پاکه کړئ', confirmTitle: 'حافظه پاکه کړئ؟', confirmBody: 'مرستندویه به هرڅه هیر کړي. دا بیرته نشي کیدی.',
    cancel: 'لغوه', cleared: 'حافظه پاکه شوه.', failed: 'بار نشو. پیوستون وګورئ.',
  },
  sd: {
    title: 'مون کي ڇا ياد آهي', subtitle: 'مددگار جيڪي تفصيل سکيا آهن ته جيئن وري نه پڇي.',
    child: 'موجوده ٻار', facts: 'توهان جي ڳالهين مان', empty: 'اڃا ڪجهه ياد ناهي.',
    clear: 'سموري ياد صاف ڪريو', confirmTitle: 'ياد صاف ڪريو؟', confirmBody: 'مددگار سڀ ڪجهه وساري ڇڏيندو. اهو واپس نٿو ٿي سگهي.',
    cancel: 'منسوخ', cleared: 'ياد صاف ٿي وئي.', failed: 'لوڊ نه ٿيو. ڪنيڪشن چيڪ ڪريو.',
  },
};

export default function MemoryScreen({ navigation }: Props) {
  const { language } = useLanguage();
  const s = COPY[language];
  const rtl = language === 'ur' || language === 'fa' || language === 'ps' || language === 'sd';

  const [items, setItems] = useState<MemoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const deviceId = await getDeviceId();
      const { memories } = await getMemories(deviceId);
      setItems(memories);
    } catch {
      setToast(s.failed);
    } finally {
      setLoading(false);
    }
  }, [s.failed]);

  useEffect(() => {
    load();
  }, [load]);

  const onClear = () => {
    Alert.alert(s.confirmTitle, s.confirmBody, [
      { text: s.cancel, style: 'cancel' },
      {
        text: s.clear,
        style: 'destructive',
        onPress: async () => {
          try {
            const deviceId = await getDeviceId();
            await clearMemories(deviceId);
            setItems([]);
            setToast(s.cleared);
          } catch {
            setToast(s.failed);
          }
        },
      },
    ]);
  };

  const childFacts = items.filter((m) => m.kind === 'child_fact');
  const convoFacts = items.filter((m) => m.kind === 'fact');

  const Section = ({ label, data }: { label: string; data: MemoryItem[] }) =>
    data.length === 0 ? null : (
      <View style={styles.section}>
        <Text style={[styles.sectionLabel, rtl ? styles.rtl : null]}>{label}</Text>
        {data.map((m) => (
          <View key={m.id} style={styles.card}>
            <Icon source="lightbulb-on-outline" size={18} color={brand.amber} />
            <Text style={[styles.cardText, rtl ? styles.rtl : null]}>{m.content}</Text>
          </View>
        ))}
      </View>
    );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={brand.ink} />
      <LinearGradient colors={[brand.ink, brand.indigo]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} accessibilityLabel="Back">
            <Icon source="arrow-left" size={24} color={brand.cream} />
          </Pressable>
          <Text style={[styles.headerTitle, rtl ? styles.rtl : null]}>{s.title}</Text>
          <View style={{ width: 40 }} />
        </View>
        <Text style={[styles.headerSub, rtl ? styles.rtl : null]}>{s.subtitle}</Text>
      </LinearGradient>

      {loading ? (
        <View style={styles.center}>
          <TypingDots size={9} />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <Icon source="brain" size={56} color="rgba(7,32,63,0.2)" />
          <Text style={styles.emptyText}>{s.empty}</Text>
        </View>
      ) : (
        <FlatList
          data={[0]}
          keyExtractor={() => 'body'}
          contentContainerStyle={styles.body}
          renderItem={() => (
            <>
              <Section label={s.child} data={childFacts} />
              <Section label={s.facts} data={convoFacts} />
              <Pressable onPress={onClear} style={({ pressed }) => [styles.clearBtn, pressed && { opacity: 0.85 }]}>
                <Icon source="trash-can-outline" size={20} color="#B3261E" />
                <Text style={styles.clearText}>{s.clear}</Text>
              </Pressable>
            </>
          )}
        />
      )}

      <Snackbar visible={!!toast} onDismiss={() => setToast(null)} duration={2500}>
        {toast ?? ''}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4EEE3' },
  rtl: { writingDirection: 'rtl', textAlign: 'right' },
  header: {
    paddingTop: Platform.OS === 'ios' ? 56 : (StatusBar.currentHeight ?? 0) + 12,
    paddingBottom: 18,
    paddingHorizontal: 16,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(244,238,227,0.12)', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { flex: 1, color: brand.cream, fontSize: 18, fontWeight: '700', textAlign: 'center' },
  headerSub: { color: 'rgba(244,238,227,0.8)', fontSize: 13, lineHeight: 19, marginTop: 10 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 32 },
  emptyText: { color: brand.indigoSoft, fontSize: 15 },

  body: { padding: 20, paddingBottom: 48, gap: 8 },
  section: { marginBottom: 18, gap: 8 },
  sectionLabel: { color: brand.ink, fontSize: 14, fontWeight: '700', marginBottom: 2 },
  card: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: 'rgba(7,32,63,0.08)',
  },
  cardText: { flex: 1, color: brand.ink, fontSize: 15, lineHeight: 21 },

  clearBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: 'rgba(179,38,30,0.08)', borderRadius: 14, paddingVertical: 15, marginTop: 8,
    borderWidth: 1, borderColor: 'rgba(179,38,30,0.25)',
  },
  clearText: { color: '#B3261E', fontSize: 15, fontWeight: '700' },
});
