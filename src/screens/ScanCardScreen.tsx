import { useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  View,
} from 'react-native';
import { Icon, Snackbar, Text, TextInput } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { getCardSchedule, scanCard, storeCard, type CardData, type CardVaccine } from '../api';
import { getDeviceId } from '../deviceId';
import { useLanguage, type AppLanguage } from '../language';
import { brand } from '../theme';
import { TypingDots } from '../components/TypingDots';
import type { RootStackParamList } from '../navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'ScanCard'>;

type Strings = {
  title: string;
  intro: string;
  takePhoto: string;
  fromGallery: string;
  reading: string;
  review: string;
  child: string;
  sex: string;
  dob: string;
  father: string;
  mother: string;
  cardNo: string;
  uc: string;
  nextDue: string;
  vaccines: string;
  vaccineName: string;
  givenDate: string;
  addVaccine: string;
  save: string;
  saved: string;
  scanFail: string;
  notCard: string;
  saveFail: string;
  noteSaved: string;
  noteOverdue: string;
  noteNext: string;
  noteUpToDate: string;
  noteNoDob: string;
};

const COPY: Record<AppLanguage, Strings> = {
  en: {
    title: 'Scan Vaccination Card', intro: 'Take a clear photo of the child’s immunization card. The assistant will read it; you can correct anything before saving.',
    takePhoto: 'Take photo', fromGallery: 'Choose from gallery', reading: 'Reading the card…', review: 'Check the details and fix anything, then save.',
    child: 'Child name', sex: 'Sex', dob: 'Date of birth', father: 'Father', mother: 'Mother', cardNo: 'Card number', uc: 'Union Council', nextDue: 'Next due date',
    vaccines: 'Vaccines given', vaccineName: 'Vaccine', givenDate: 'Date', addVaccine: 'Add vaccine', save: 'Save card', saved: 'Card saved.',
    scanFail: 'Could not read the card. Try a clearer photo.',
    notCard: 'This doesn’t look like a vaccination card. Please scan a child’s immunization card.', saveFail: 'Could not save. Please try again.',
    noteSaved: 'Card saved for', noteOverdue: 'Overdue', noteNext: 'Next due', noteUpToDate: 'No overdue vaccines — up to date.', noteNoDob: 'Date of birth unclear — please confirm the child’s age.',
  },
  ur: {
    title: 'ویکسینیشن کارڈ اسکین کریں', intro: 'بچے کے حفاظتی ٹیکوں کے کارڈ کی واضح تصویر لیں۔ معاون اسے پڑھے گا؛ محفوظ کرنے سے پہلے آپ تصحیح کر سکتے ہیں۔',
    takePhoto: 'تصویر لیں', fromGallery: 'گیلری سے منتخب کریں', reading: 'کارڈ پڑھا جا رہا ہے…', review: 'تفصیلات چیک کریں اور درست کریں، پھر محفوظ کریں۔',
    child: 'بچے کا نام', sex: 'جنس', dob: 'تاریخ پیدائش', father: 'والد', mother: 'والدہ', cardNo: 'کارڈ نمبر', uc: 'یونین کونسل', nextDue: 'اگلی تاریخ',
    vaccines: 'لگائے گئے ٹیکے', vaccineName: 'ویکسین', givenDate: 'تاریخ', addVaccine: 'ویکسین شامل کریں', save: 'کارڈ محفوظ کریں', saved: 'کارڈ محفوظ ہو گیا۔',
    scanFail: 'کارڈ پڑھا نہیں جا سکا۔ واضح تصویر لیں۔',
    notCard: 'یہ ویکسینیشن کارڈ نہیں لگتا۔ براہ کرم بچے کا حفاظتی ٹیکوں کا کارڈ اسکین کریں۔', saveFail: 'محفوظ نہیں ہو سکا۔ دوبارہ کوشش کریں۔',
    noteSaved: 'کارڈ محفوظ ہوا —', noteOverdue: 'واجب الادا', noteNext: 'اگلا ٹیکہ', noteUpToDate: 'کوئی ٹیکہ باقی نہیں — اپ ٹو ڈیٹ۔', noteNoDob: 'تاریخ پیدائش واضح نہیں — بچے کی عمر کی تصدیق کریں۔',
  },
  fa: {
    title: 'اسکن کارت واکسیناسیون', intro: 'از کارت واکسیناسیون کودک عکس واضح بگیرید. دستیار آن را می‌خواند؛ پیش از ذخیره می‌توانید اصلاح کنید.',
    takePhoto: 'گرفتن عکس', fromGallery: 'انتخاب از گالری', reading: 'در حال خواندن کارت…', review: 'جزئیات را بررسی و اصلاح کنید، سپس ذخیره کنید.',
    child: 'نام کودک', sex: 'جنسیت', dob: 'تاریخ تولد', father: 'پدر', mother: 'مادر', cardNo: 'شماره کارت', uc: 'شورای اتحادیه', nextDue: 'تاریخ بعدی',
    vaccines: 'واکسن‌های زده‌شده', vaccineName: 'واکسن', givenDate: 'تاریخ', addVaccine: 'افزودن واکسن', save: 'ذخیره کارت', saved: 'کارت ذخیره شد.',
    scanFail: 'کارت خوانده نشد. عکس واضح‌تری بگیرید.',
    notCard: 'این کارت واکسیناسیون به نظر نمی‌رسد. لطفاً کارت واکسیناسیون کودک را اسکن کنید.', saveFail: 'ذخیره نشد. دوباره تلاش کنید.',
    noteSaved: 'کارت ذخیره شد برای', noteOverdue: 'عقب‌افتاده', noteNext: 'نوبت بعدی', noteUpToDate: 'واکسن عقب‌افتاده‌ای نیست — به‌روز است.', noteNoDob: 'تاریخ تولد نامشخص است — سن کودک را تأیید کنید.',
  },
  ps: {
    title: 'د واکسین کارت سکین کړئ', intro: 'د ماشوم د واکسین د کارت روښانه عکس واخلئ. مرستندویه به یې ولولي؛ د خوندي کولو دمخه یې سمولی شئ.',
    takePhoto: 'عکس واخلئ', fromGallery: 'له ګالرۍ وټاکئ', reading: 'کارت لوستل کیږي…', review: 'جزئیات وګورئ او سم کړئ، بیا خوندي کړئ.',
    child: 'د ماشوم نوم', sex: 'جنس', dob: 'د زیږون نیټه', father: 'پلار', mother: 'مور', cardNo: 'د کارت شمیره', uc: 'یونین کونسل', nextDue: 'راتلونکې نیټه',
    vaccines: 'ورکړل شوي واکسینونه', vaccineName: 'واکسین', givenDate: 'نیټه', addVaccine: 'واکسین زیات کړئ', save: 'کارت خوندي کړئ', saved: 'کارت خوندي شو.',
    scanFail: 'کارت لوستل نشو. روښانه عکس واخلئ.',
    notCard: 'دا د واکسین کارت نه ښکاري. مهرباني وکړئ د ماشوم د واکسین کارت سکین کړئ.', saveFail: 'خوندي نشو. بیا هڅه وکړئ.',
    noteSaved: 'کارت خوندي شو د', noteOverdue: 'ناوخته', noteNext: 'راتلونکی', noteUpToDate: 'هیڅ ناوخته واکسین نشته — تازه دی.', noteNoDob: 'د زیږون نېټه روښانه نه ده — د ماشوم عمر تایید کړئ.',
  },
  sd: {
    title: 'ويڪسينيشن ڪارڊ اسڪين ڪريو', intro: 'ٻار جي ويڪسينيشن ڪارڊ جي صاف تصوير وٺو. مددگار اهو پڙهندو؛ محفوظ ڪرڻ کان اڳ توهان درست ڪري سگهو ٿا.',
    takePhoto: 'تصوير وٺو', fromGallery: 'گيلري مان چونڊيو', reading: 'ڪارڊ پڙهجي رهيو آهي…', review: 'تفصيل چيڪ ڪري درست ڪريو، پوءِ محفوظ ڪريو.',
    child: 'ٻار جو نالو', sex: 'جنس', dob: 'ڄم جي تاريخ', father: 'پيءُ', mother: 'ماءُ', cardNo: 'ڪارڊ نمبر', uc: 'يونين ڪائونسل', nextDue: 'ايندڙ تاريخ',
    vaccines: 'لڳل ويڪسين', vaccineName: 'ويڪسين', givenDate: 'تاريخ', addVaccine: 'ويڪسين شامل ڪريو', save: 'ڪارڊ محفوظ ڪريو', saved: 'ڪارڊ محفوظ ٿيو.',
    scanFail: 'ڪارڊ پڙهي نه سگهيو. صاف تصوير وٺو.',
    notCard: 'هي ويڪسينيشن ڪارڊ نٿو لڳي. مهرباني ڪري ٻار جو ويڪسينيشن ڪارڊ اسڪين ڪريو.', saveFail: 'محفوظ نه ٿيو. ٻيهر ڪوشش ڪريو.',
    noteSaved: 'ڪارڊ محفوظ ٿيو', noteOverdue: 'وقت گذري ويل', noteNext: 'ايندڙ', noteUpToDate: 'ڪو به ويڪسين باقي ناهي — اپ ٽو ڊيٽ.', noteNoDob: 'ڄم جي تاريخ واضح ناهي — ٻار جي عمر جي تصديق ڪريو.',
  },
};

type Mode = 'capture' | 'loading' | 'review';

export default function ScanCardScreen({ navigation }: Props) {
  const { language } = useLanguage();
  const s = COPY[language];
  const rtl = language === 'ur' || language === 'fa' || language === 'ps' || language === 'sd';

  const [mode, setMode] = useState<Mode>('capture');
  const [imagePath, setImagePath] = useState<string | undefined>();
  const [data, setData] = useState<CardData>({});
  const [vaccines, setVaccines] = useState<CardVaccine[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pickAndScan = async (fromCamera: boolean) => {
    try {
      const perm = fromCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return;

      const result = fromCamera
        ? await ImagePicker.launchCameraAsync({ quality: 0.6, allowsEditing: false })
        : await ImagePicker.launchImageLibraryAsync({ quality: 0.6, mediaTypes: ['images'] });
      if (result.canceled || !result.assets?.[0]?.uri) return;

      setMode('loading');
      const deviceId = await getDeviceId();
      const { imagePath: path, data: extracted } = await scanCard({ deviceId, imageUri: result.assets[0].uri });
      setImagePath(path);
      setData(extracted);
      setVaccines(extracted.vaccines ?? []);
      setMode('review');
    } catch (e: any) {
      setError(e?.message === 'NOT_A_CARD' ? s.notCard : s.scanFail);
      setMode('capture');
    }
  };

  const set = (key: keyof CardData, value: string) => setData((d) => ({ ...d, [key]: value }));

  const setVaccine = (i: number, key: keyof CardVaccine, value: string) =>
    setVaccines((vs) => vs.map((v, idx) => (idx === i ? { ...v, [key]: value } : v)));

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const deviceId = await getDeviceId();
      await storeCard({
        deviceId,
        imagePath,
        data: { ...data, vaccines: vaccines.filter((v) => v.name?.trim()) },
      });

      // Build a summary to surface the fetched details back in the chat.
      const child = data.child_name?.trim() || '';
      let note = `**${s.noteSaved} ${child}**`.trim();
      const recv = vaccines.map((v) => v.name?.trim()).filter(Boolean).join(', ');
      if (recv) note += `\n${s.vaccines}: ${recv}`;
      try {
        const { summary, has_dob } = await getCardSchedule(deviceId);
        if (!has_dob) {
          note += `\n\n⚠️ ${s.noteNoDob}`;
        } else if (summary) {
          note += summary.overdue.length
            ? `\n\n⚠️ **${s.noteOverdue}:** ${summary.overdue.join('; ')}`
            : `\n\n✅ ${s.noteUpToDate}`;
          if (summary.next) {
            note += `\n➡️ **${s.noteNext}:** ${summary.next.code}${summary.next.due_date ? ` (${summary.next.due_date})` : ''}`;
          }
        }
      } catch {
        // schedule is best-effort; still show the saved confirmation
      }

      navigation.navigate({ name: 'Chat', params: { cardNote: note }, merge: true });
    } catch {
      setError(s.saveFail);
      setSaving(false);
    }
  };

  const field = (label: string, key: keyof CardData, keyboardType?: 'default' | 'number-pad') => (
    <View style={styles.field}>
      <Text style={[styles.label, rtl ? styles.rtl : null]}>{label}</Text>
      <TextInput
        mode="outlined"
        dense
        value={(data[key] as string) ?? ''}
        onChangeText={(t) => set(key, t)}
        keyboardType={keyboardType ?? 'default'}
        style={styles.input}
        outlineColor="rgba(7,32,63,0.15)"
        activeOutlineColor={brand.indigo}
        contentStyle={rtl ? styles.rtl : null}
      />
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={brand.ink} />
      <LinearGradient colors={[brand.ink, brand.indigo]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => navigation.goBack()} style={styles.headerBackBtn} accessibilityLabel="Back">
            <Icon source="arrow-left" size={24} color={brand.cream} />
          </Pressable>
          <Text style={[styles.headerTitle, rtl ? styles.rtl : null]}>{s.title}</Text>
          <View style={{ width: 40 }} />
        </View>
      </LinearGradient>

      {mode === 'capture' && (
        <View style={styles.capture}>
          <View style={styles.captureMark}>
            <Icon source="card-account-details-outline" size={64} color={brand.indigo} />
          </View>
          <Text style={[styles.captureIntro, rtl ? styles.rtl : null]}>{s.intro}</Text>
          <Pressable onPress={() => pickAndScan(true)} style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.9 }]}>
            <Icon source="camera" size={22} color={brand.cream} />
            <Text style={styles.primaryBtnText}>{s.takePhoto}</Text>
          </Pressable>
          <Pressable onPress={() => pickAndScan(false)} style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.9 }]}>
            <Icon source="image-outline" size={22} color={brand.indigo} />
            <Text style={styles.secondaryBtnText}>{s.fromGallery}</Text>
          </Pressable>
        </View>
      )}

      {mode === 'loading' && (
        <View style={styles.loading}>
          <TypingDots size={9} />
          <Text style={styles.loadingText}>{s.reading}</Text>
        </View>
      )}

      {mode === 'review' && (
        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          <Text style={[styles.reviewHint, rtl ? styles.rtl : null]}>{s.review}</Text>
          {field(s.child, 'child_name')}
          {field(s.sex, 'sex')}
          {field(s.dob, 'date_of_birth')}
          {field(s.cardNo, 'card_number', 'number-pad')}
          {field(s.father, 'father_name')}
          {field(s.mother, 'mother_name')}
          {field(s.uc, 'union_council')}
          {field(s.nextDue, 'next_due_date')}

          <Text style={[styles.sectionLabel, rtl ? styles.rtl : null]}>{s.vaccines}</Text>
          {vaccines.map((v, i) => (
            <View key={i} style={styles.vaccineRow}>
              <TextInput
                mode="outlined"
                dense
                placeholder={s.vaccineName}
                value={v.name ?? ''}
                onChangeText={(t) => setVaccine(i, 'name', t)}
                style={[styles.input, { flex: 1 }]}
                outlineColor="rgba(7,32,63,0.15)"
                activeOutlineColor={brand.indigo}
              />
              <TextInput
                mode="outlined"
                dense
                placeholder={s.givenDate}
                value={v.given_date ?? ''}
                onChangeText={(t) => setVaccine(i, 'given_date', t)}
                style={[styles.input, { width: 110 }]}
                outlineColor="rgba(7,32,63,0.15)"
                activeOutlineColor={brand.indigo}
              />
              <Pressable onPress={() => setVaccines((vs) => vs.filter((_, idx) => idx !== i))} hitSlop={8} style={styles.removeBtn}>
                <Icon source="close-circle" size={22} color="rgba(7,32,63,0.35)" />
              </Pressable>
            </View>
          ))}
          <Pressable onPress={() => setVaccines((vs) => [...vs, { name: '', given_date: '' }])} style={styles.addBtn}>
            <Icon source="plus" size={18} color={brand.indigo} />
            <Text style={styles.addBtnText}>{s.addVaccine}</Text>
          </Pressable>

          <Pressable onPress={save} disabled={saving} style={({ pressed }) => [styles.primaryBtn, { marginTop: 24 }, saving && { opacity: 0.6 }, pressed && { opacity: 0.9 }]}>
            {saving ? <TypingDots size={7} color={brand.cream} /> : <Text style={styles.primaryBtnText}>{s.save}</Text>}
          </Pressable>
        </ScrollView>
      )}

      <Snackbar visible={!!error} onDismiss={() => setError(null)} duration={3500}>
        {error ?? ''}
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
  headerBackBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(244,238,227,0.12)', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { flex: 1, color: brand.cream, fontSize: 18, fontWeight: '700', textAlign: 'center' },

  capture: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 16 },
  captureMark: {
    width: 110, height: 110, borderRadius: 55, backgroundColor: '#FFFFFF',
    justifyContent: 'center', alignItems: 'center', marginBottom: 6,
    shadowColor: brand.ink, shadowOpacity: 0.08, shadowRadius: 20, shadowOffset: { width: 0, height: 6 }, elevation: 4,
  },
  captureIntro: { color: brand.indigoSoft, fontSize: 15, lineHeight: 22, textAlign: 'center', maxWidth: 320, marginBottom: 8 },

  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  loadingText: { color: brand.indigoSoft, fontSize: 15 },

  form: { padding: 20, paddingBottom: 48, gap: 12 },
  reviewHint: { color: brand.indigoSoft, fontSize: 14, lineHeight: 20, marginBottom: 4 },
  field: { gap: 5 },
  label: { color: brand.ink, fontSize: 13, fontWeight: '600' },
  input: { backgroundColor: '#FFFFFF' },
  sectionLabel: { color: brand.ink, fontSize: 15, fontWeight: '700', marginTop: 14, marginBottom: 2 },
  vaccineRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  removeBtn: { padding: 2 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 4 },
  addBtnText: { color: brand.indigo, fontSize: 14, fontWeight: '600' },

  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: brand.ink, borderRadius: 14, paddingVertical: 16, alignSelf: 'stretch', minHeight: 54,
  },
  primaryBtnText: { color: brand.cream, fontSize: 16, fontWeight: '700' },
  secondaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: '#FFFFFF', borderRadius: 14, paddingVertical: 16, alignSelf: 'stretch',
    borderWidth: 1, borderColor: 'rgba(7,32,63,0.12)',
  },
  secondaryBtnText: { color: brand.indigo, fontSize: 16, fontWeight: '600' },
});
