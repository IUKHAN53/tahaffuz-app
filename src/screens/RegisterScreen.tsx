import { useEffect, useMemo, useState } from 'react';
import {
  Dimensions,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  View,
} from 'react-native';
import { Icon, Snackbar, Text, TextInput } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { getAreas, registerWorker, type AreaDistrict } from '../api';
import { getDeviceId } from '../deviceId';
import { markRegistered } from '../registration';
import { useLanguage, type AppLanguage } from '../language';
import { brand } from '../theme';
import { BrandMark } from '../components/BrandMark';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { TypingDots } from '../components/TypingDots';
import type { RootStackParamList } from '../navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Register'>;

type Strings = {
  title: string;
  subtitle: string;
  name: string;
  namePlaceholder: string;
  phone: string;
  phonePlaceholder: string;
  optional: string;
  district: string;
  town: string;
  uc: string;
  select: string;
  continue: string;
  needName: string;
  needArea: string;
  failed: string;
};

const COPY: Record<AppLanguage, Strings> = {
  en: {
    title: 'Welcome to Tika Dost',
    subtitle: 'Tell us a little about you to get started.',
    name: 'Your name',
    namePlaceholder: 'Enter your name',
    phone: 'Phone number',
    phonePlaceholder: '03XX-XXXXXXX',
    optional: 'optional',
    district: 'District',
    town: 'Town',
    uc: 'Union Council',
    select: 'Select…',
    continue: 'Continue',
    needName: 'Please enter your name.',
    needArea: 'Please select your district and union council.',
    failed: 'Could not save. Please check your connection and try again.',
  },
  ur: {
    title: 'ٹیکہ دوست میں خوش آمدید',
    subtitle: 'شروع کرنے کے لیے ہمیں اپنے بارے میں کچھ بتائیں۔',
    name: 'آپ کا نام',
    namePlaceholder: 'اپنا نام درج کریں',
    phone: 'فون نمبر',
    phonePlaceholder: '03XX-XXXXXXX',
    optional: 'اختیاری',
    district: 'ضلع',
    town: 'ٹاؤن',
    uc: 'یونین کونسل',
    select: 'منتخب کریں…',
    continue: 'جاری رکھیں',
    needName: 'براہ کرم اپنا نام درج کریں۔',
    needArea: 'براہ کرم اپنا ضلع اور یونین کونسل منتخب کریں۔',
    failed: 'محفوظ نہیں ہو سکا۔ کنکشن چیک کریں اور دوبارہ کوشش کریں۔',
  },
  fa: {
    title: 'به ٹیکہ دوست خوش آمدید',
    subtitle: 'برای شروع کمی درباره خودتان بگویید.',
    name: 'نام شما',
    namePlaceholder: 'نام خود را وارد کنید',
    phone: 'شماره تلفن',
    phonePlaceholder: '03XX-XXXXXXX',
    optional: 'اختیاری',
    district: 'منطقه',
    town: 'شهر',
    uc: 'شورای اتحادیه',
    select: 'انتخاب کنید…',
    continue: 'ادامه',
    needName: 'لطفاً نام خود را وارد کنید.',
    needArea: 'لطفاً منطقه و شورای اتحادیه خود را انتخاب کنید.',
    failed: 'ذخیره نشد. اتصال را بررسی کنید و دوباره تلاش کنید.',
  },
  ps: {
    title: 'ٹیکہ دوست ته ښه راغلاست',
    subtitle: 'د پیل لپاره موږ ته د ځان په اړه یو څه ووایاست.',
    name: 'ستاسو نوم',
    namePlaceholder: 'خپل نوم ولیکئ',
    phone: 'د تلیفون شمیره',
    phonePlaceholder: '03XX-XXXXXXX',
    optional: 'اختیاري',
    district: 'ولسوالۍ',
    town: 'ښار',
    uc: 'یونین کونسل',
    select: 'وټاکئ…',
    continue: 'دوام ورکړئ',
    needName: 'مهرباني وکړئ خپل نوم ولیکئ.',
    needArea: 'مهرباني وکړئ خپله ولسوالۍ او یونین کونسل وټاکئ.',
    failed: 'خوندي نه شو. پیوستون وګورئ او بیا هڅه وکړئ.',
  },
  sd: {
    title: 'ٹیکہ دوست ۾ ڀليڪار',
    subtitle: 'شروع ڪرڻ لاءِ اسان کي پنهنجي باري ۾ ٿورو ٻڌايو.',
    name: 'توهان جو نالو',
    namePlaceholder: 'پنهنجو نالو لکو',
    phone: 'فون نمبر',
    phonePlaceholder: '03XX-XXXXXXX',
    optional: 'اختياري',
    district: 'ضلعو',
    town: 'ٽائون',
    uc: 'يونين ڪائونسل',
    select: 'چونڊيو…',
    continue: 'جاري رکيو',
    needName: 'مهرباني ڪري پنهنجو نالو لکو.',
    needArea: 'مهرباني ڪري پنهنجو ضلعو ۽ يونين ڪائونسل چونڊيو.',
    failed: 'محفوظ نه ٿي سگهيو. ڪنيڪشن چيڪ ڪري ٻيهر ڪوشش ڪريو.',
  },
};

// The picker sheet caps at ~60% of the screen and scrolls beyond that. Putting
// the height bound on the scroll view (not an auto-height wrapper) is what keeps
// the list from collapsing to zero height.
const SHEET_MAX_HEIGHT = Math.round(Dimensions.get('window').height * 0.6);

type Field = 'district' | 'town' | 'uc';

export default function RegisterScreen({ navigation }: Props) {
  const { language } = useLanguage();
  const s = COPY[language];
  const rtl = language === 'ur' || language === 'fa' || language === 'ps' || language === 'sd';

  const [areas, setAreas] = useState<AreaDistrict[]>([]);
  const [loadingAreas, setLoadingAreas] = useState(true);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [district, setDistrict] = useState('');
  const [town, setTown] = useState('');
  const [uc, setUc] = useState('');
  const [open, setOpen] = useState<Field | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAreas()
      .then(setAreas)
      .catch(() => setError(s.failed))
      .finally(() => setLoadingAreas(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const towns = useMemo(
    () => areas.find((d) => d.name === district)?.towns ?? [],
    [areas, district],
  );
  const ucs = useMemo(
    () => towns.find((t) => t.name === town)?.union_councils ?? [],
    [towns, town],
  );

  const options = open === 'district' ? areas.map((d) => d.name) : open === 'town' ? towns.map((t) => t.name) : ucs;

  const pick = (value: string) => {
    if (open === 'district') {
      setDistrict(value);
      setTown('');
      setUc('');
    } else if (open === 'town') {
      setTown(value);
      setUc('');
    } else if (open === 'uc') {
      setUc(value);
    }
    setOpen(null);
  };

  const submit = async () => {
    if (submitting) return;
    if (!name.trim()) {
      setError(s.needName);
      return;
    }
    if (!district || !uc) {
      setError(s.needArea);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const deviceId = await getDeviceId();
      await registerWorker({
        deviceId,
        name: name.trim(),
        phone: phone.trim() || undefined,
        district,
        town: town || undefined,
        unionCouncil: uc,
      });
      await markRegistered();
      navigation.reset({ index: 0, routes: [{ name: 'Chat', params: { chatId: null } }] });
    } catch {
      setError(s.failed);
      setSubmitting(false);
    }
  };

  const Dropdown = ({ field, label, value, disabled }: { field: Field; label: string; value: string; disabled?: boolean }) => (
    <View style={styles.field}>
      <Text style={[styles.label, rtl ? styles.rtl : null]}>{label}</Text>
      <Pressable
        onPress={() => !disabled && setOpen(field)}
        style={({ pressed }) => [styles.dropdown, disabled && styles.dropdownDisabled, pressed && !disabled && { opacity: 0.85 }]}
        accessibilityRole="button"
      >
        <Text style={[styles.dropdownText, !value && styles.dropdownPlaceholder, rtl ? styles.rtl : null]} numberOfLines={1}>
          {value || s.select}
        </Text>
        <Icon source="chevron-down" size={22} color={brand.indigoSoft} />
      </Pressable>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={brand.ink} />
      <LinearGradient colors={[brand.ink, brand.indigo]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.brandRow}>
            <BrandMark size={30} />
            <Text style={styles.brandName}>Tika Dost</Text>
          </View>
          <LanguageSwitcher />
        </View>
        <Text style={[styles.title, rtl ? styles.rtl : null]}>{s.title}</Text>
        <Text style={[styles.subtitle, rtl ? styles.rtl : null]}>{s.subtitle}</Text>
      </LinearGradient>

      {loadingAreas ? (
        <View style={styles.loading}>
          <TypingDots size={8} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          <View style={styles.field}>
            <Text style={[styles.label, rtl ? styles.rtl : null]}>{s.name}</Text>
            <TextInput
              mode="outlined"
              value={name}
              onChangeText={setName}
              placeholder={s.namePlaceholder}
              style={styles.input}
              outlineColor="rgba(7,32,63,0.15)"
              activeOutlineColor={brand.indigo}
              contentStyle={rtl ? styles.rtl : null}
            />
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, rtl ? styles.rtl : null]}>
              {s.phone} <Text style={styles.optional}>({s.optional})</Text>
            </Text>
            <TextInput
              mode="outlined"
              value={phone}
              onChangeText={setPhone}
              placeholder={s.phonePlaceholder}
              keyboardType="phone-pad"
              style={styles.input}
              outlineColor="rgba(7,32,63,0.15)"
              activeOutlineColor={brand.indigo}
            />
          </View>

          <Dropdown field="district" label={s.district} value={district} />
          <Dropdown field="town" label={s.town} value={town} disabled={!district} />
          <Dropdown field="uc" label={s.uc} value={uc} disabled={!town} />

          <Pressable
            onPress={submit}
            disabled={submitting}
            style={({ pressed }) => [styles.submit, submitting && { opacity: 0.6 }, pressed && { opacity: 0.9 }]}
            accessibilityRole="button"
          >
            {submitting ? (
              <TypingDots size={7} color={brand.cream} />
            ) : (
              <Text style={styles.submitText}>{s.continue}</Text>
            )}
          </Pressable>
        </ScrollView>
      )}

      <Modal visible={open !== null} transparent animationType="fade" onRequestClose={() => setOpen(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setOpen(null)}>
          {/* Tapping the sheet itself must not close the modal. */}
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <ScrollView style={styles.modalList} keyboardShouldPersistTaps="handled">
              {options.length === 0 ? (
                <Text style={styles.optionEmpty}>—</Text>
              ) : (
                options.map((item, i) => (
                  <Pressable
                    key={`${item}-${i}`}
                    onPress={() => pick(item)}
                    android_ripple={{ color: 'rgba(7,32,63,0.06)' }}
                    style={({ pressed }) => [styles.option, pressed && { opacity: 0.85 }]}
                  >
                    <Text style={[styles.optionText, rtl ? styles.rtl : null]}>{item}</Text>
                  </Pressable>
                ))
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Snackbar visible={!!error} onDismiss={() => setError(null)} duration={3500}>
        {error ?? ''}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4EEE3' },
  rtl: { writingDirection: 'rtl', textAlign: 'right' },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    paddingTop: Platform.OS === 'ios' ? 58 : (StatusBar.currentHeight ?? 0) + 18,
    paddingBottom: 24,
    paddingHorizontal: 22,
  },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  brandName: { color: brand.cream, fontSize: 22, fontWeight: '700', letterSpacing: 0.3 },
  title: { color: brand.cream, fontSize: 24, fontWeight: '700', marginTop: 20 },
  subtitle: { color: 'rgba(244,238,227,0.8)', fontSize: 15, lineHeight: 22, marginTop: 6 },

  form: { padding: 22, paddingBottom: 48, gap: 18 },
  field: { gap: 8 },
  label: { color: brand.ink, fontSize: 14, fontWeight: '600' },
  optional: { color: brand.indigoSoft, fontSize: 12, fontWeight: '400' },
  input: { backgroundColor: '#FFFFFF' },

  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(7,32,63,0.15)',
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 15,
  },
  dropdownDisabled: { backgroundColor: 'rgba(7,32,63,0.04)', opacity: 0.7 },
  dropdownText: { flex: 1, color: brand.ink, fontSize: 16 },
  dropdownPlaceholder: { color: 'rgba(7,32,63,0.42)' },

  submit: {
    marginTop: 10,
    backgroundColor: brand.ink,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 54,
  },
  submitText: { color: brand.cream, fontSize: 17, fontWeight: '700', letterSpacing: 0.3 },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(7,32,63,0.55)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingVertical: 8,
  },
  modalList: { maxHeight: SHEET_MAX_HEIGHT },
  option: { paddingVertical: 16, paddingHorizontal: 24, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(7,32,63,0.08)' },
  optionText: { color: brand.ink, fontSize: 16 },
  optionEmpty: { textAlign: 'center', color: brand.indigoSoft, padding: 24 },
});
