import { useCallback, useEffect, useState } from 'react';
import { FlatList, Platform, Pressable, StatusBar, StyleSheet, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { getCardSchedule, getDefaulters, type Defaulter } from '../api';
import { getDeviceId } from '../deviceId';
import { useLanguage, type AppLanguage } from '../language';
import { brand } from '../theme';
import { TypingDots } from '../components/TypingDots';
import type { RootStackParamList } from '../navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Schedule'>;
type Row = { code: string; due_date: string | null; status: string };
type Cache = { child: string | null; has_dob: boolean; rows: Row[]; defaulters: Defaulter[] };

const CACHE_KEY = 'tika.schedule.cache.v1';

const COPY: Record<AppLanguage, Record<string, string>> = {
  en: { title: 'Vaccination schedule', child: 'Current child', noChild: 'Scan a vaccination card to see the schedule.', defaulters: 'Children to follow up', none: 'No overdue children 🎉', offline: 'Offline — showing last saved data.', noDob: 'Date of birth unclear — confirm the age.', done: 'Done', overdue: 'Overdue', due_soon: 'Due soon', upcoming: 'Upcoming' },
  ur: { title: 'ٹیکوں کا شیڈول', child: 'موجودہ بچہ', noChild: 'شیڈول دیکھنے کے لیے کارڈ اسکین کریں۔', defaulters: 'فالو اپ والے بچے', none: 'کوئی واجب الادا بچہ نہیں 🎉', offline: 'آف لائن — محفوظ شدہ ڈیٹا۔', noDob: 'تاریخ پیدائش واضح نہیں — عمر کی تصدیق کریں۔', done: 'مکمل', overdue: 'واجب الادا', due_soon: 'جلد', upcoming: 'آئندہ' },
  fa: { title: 'برنامه واکسیناسیون', child: 'کودک فعلی', noChild: 'برای دیدن برنامه، کارت را اسکن کنید.', defaulters: 'کودکان برای پیگیری', none: 'کودک عقب‌افتاده‌ای نیست 🎉', offline: 'آفلاین — داده ذخیره‌شده.', noDob: 'تاریخ تولد نامشخص — سن را تأیید کنید.', done: 'انجام‌شده', overdue: 'عقب‌افتاده', due_soon: 'به‌زودی', upcoming: 'آینده' },
  ps: { title: 'د واکسین مهالویش', child: 'اوسنی ماشوم', noChild: 'مهالویش لیدو لپاره کارت سکین کړئ.', defaulters: 'د تعقیب لپاره ماشومان', none: 'هیڅ ناوخته ماشوم نشته 🎉', offline: 'آفلاین — خوندي شوي معلومات.', noDob: 'د زیږون نېټه روښانه نه ده — عمر تایید کړئ.', done: 'ترسره', overdue: 'ناوخته', due_soon: 'ژر', upcoming: 'راتلونکی' },
  sd: { title: 'ويڪسين شيڊول', child: 'موجوده ٻار', noChild: 'شيڊول ڏسڻ لاءِ ڪارڊ اسڪين ڪريو.', defaulters: 'فالو اپ لاءِ ٻار', none: 'ڪو به وقت گذري ويل ٻار ناهي 🎉', offline: 'آف لائن — محفوظ ڊيٽا.', noDob: 'ڄم جي تاريخ واضح ناهي — عمر جي تصديق ڪريو.', done: 'مڪمل', overdue: 'وقت گذري ويل', due_soon: 'جلد', upcoming: 'ايندڙ' },
};

const STATUS_COLOR: Record<string, string> = {
  done: '#1E7A46',
  overdue: '#B3261E',
  due_soon: brand.amber,
  upcoming: 'rgba(7,32,63,0.35)',
  unknown_dob: 'rgba(7,32,63,0.35)',
};

export default function ScheduleScreen({ navigation }: Props) {
  const { language } = useLanguage();
  const s = COPY[language];
  const rtl = language === 'ur' || language === 'fa' || language === 'ps' || language === 'sd';

  const [data, setData] = useState<Cache | null>(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);

  const load = useCallback(async () => {
    // Show cached first (offline-first), then refresh.
    try {
      const raw = await AsyncStorage.getItem(CACHE_KEY);
      if (raw) setData(JSON.parse(raw));
    } catch {}
    try {
      const deviceId = await getDeviceId();
      const [sched, defaulters] = await Promise.all([getCardSchedule(deviceId), getDefaulters(deviceId)]);
      const fresh: Cache = { child: sched.child, has_dob: sched.has_dob, rows: sched.schedule, defaulters };
      setData(fresh);
      setOffline(false);
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(fresh));
    } catch {
      setOffline(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const rows = data?.rows ?? [];
  const defaulters = data?.defaulters ?? [];

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
      </LinearGradient>

      {loading && !data ? (
        <View style={styles.center}><TypingDots size={9} /></View>
      ) : (
        <FlatList
          data={[0]}
          keyExtractor={() => 'body'}
          contentContainerStyle={styles.body}
          renderItem={() => (
            <>
              {offline ? <Text style={styles.offline}>{s.offline}</Text> : null}

              <Text style={[styles.section, rtl ? styles.rtl : null]}>{s.child}{data?.child ? ` · ${data.child}` : ''}</Text>
              {rows.length === 0 ? (
                <Text style={styles.empty}>{s.noChild}</Text>
              ) : (
                <>
                  {data && !data.has_dob ? <Text style={styles.warn}>⚠️ {s.noDob}</Text> : null}
                  <View style={styles.card}>
                    {rows.map((r) => (
                      <View key={r.code} style={styles.row}>
                        <View style={[styles.dot, { backgroundColor: STATUS_COLOR[r.status] ?? '#999' }]} />
                        <Text style={styles.rowCode}>{r.code}</Text>
                        <Text style={styles.rowDate}>{r.due_date ?? '—'}</Text>
                        <Text style={[styles.rowStatus, { color: STATUS_COLOR[r.status] ?? '#999' }]}>
                          {s[r.status] ?? r.status}
                        </Text>
                      </View>
                    ))}
                  </View>
                </>
              )}

              <Text style={[styles.section, rtl ? styles.rtl : null, { marginTop: 22 }]}>{s.defaulters}</Text>
              {defaulters.length === 0 ? (
                <Text style={styles.empty}>{s.none}</Text>
              ) : (
                defaulters.map((d) => (
                  <View key={d.card_id} style={styles.defCard}>
                    <Icon source="alert-circle-outline" size={20} color="#B3261E" />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.defName}>{d.child}</Text>
                      <Text style={styles.defOverdue}>{d.overdue.join(', ')}</Text>
                    </View>
                  </View>
                ))
              )}
            </>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4EEE3' },
  rtl: { writingDirection: 'rtl', textAlign: 'right' },
  header: { paddingTop: Platform.OS === 'ios' ? 56 : (StatusBar.currentHeight ?? 0) + 12, paddingBottom: 18, paddingHorizontal: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(244,238,227,0.12)', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { flex: 1, color: brand.cream, fontSize: 18, fontWeight: '700', textAlign: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { padding: 20, paddingBottom: 48 },
  offline: { color: brand.amber, fontSize: 13, marginBottom: 12, fontWeight: '600' },
  section: { color: brand.ink, fontSize: 15, fontWeight: '700', marginBottom: 8 },
  empty: { color: brand.indigoSoft, fontSize: 14, paddingVertical: 6 },
  warn: { color: '#B3261E', fontSize: 13, marginBottom: 8 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 12, paddingVertical: 4, borderWidth: 1, borderColor: 'rgba(7,32,63,0.08)' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, paddingHorizontal: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(7,32,63,0.06)' },
  dot: { width: 10, height: 10, borderRadius: 5 },
  rowCode: { flex: 1, color: brand.ink, fontSize: 15, fontWeight: '600' },
  rowDate: { color: brand.indigoSoft, fontSize: 13, width: 96 },
  rowStatus: { fontSize: 12, fontWeight: '700', width: 76, textAlign: 'right' },
  defCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: 'rgba(179,38,30,0.2)' },
  defName: { color: brand.ink, fontSize: 15, fontWeight: '700' },
  defOverdue: { color: '#B3261E', fontSize: 13, marginTop: 2 },
});
