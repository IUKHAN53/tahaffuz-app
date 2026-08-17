import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { takeCardNote } from '../cardNote';
import {
  Animated,
  Easing,
  FlatList,
  Linking,
  PanResponder,
  Platform,
  Pressable,
  Share,
  StatusBar,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import {
  Snackbar,
  Text,
  TextInput,
} from 'react-native-paper';
import { Feather } from '@expo/vector-icons';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import * as Speech from 'expo-speech';
import * as Clipboard from 'expo-clipboard';
import Markdown from 'react-native-markdown-display';
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import {
  getChat,
  sendAudio,
  sendText,
  sendTextStream,
  submitFeedback,
  toggleBookmark,
  ttsUrl,
  type ReplyLanguage,
  type FeedbackRating,
  type SiteInfo,
} from '../api';
import { getDeviceId } from '../deviceId';
import { getSessionLocation } from '../location';
import type { LatLng } from '../api';
import {
  getCachedQuickAnswers,
  refreshQuickAnswersCache,
  searchQuickAnswers,
} from '../offlineCache';
import { upsertSession } from '../sessions';
import { useLanguage } from '../language';
import { tika, palette } from '../theme';
import { TikaMascot } from '../components/TikaMascot';
import { TypingDots } from '../components/TypingDots';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import type { RootStackParamList } from '../navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Chat'>;

type Msg = {
  id: string;
  serverId?: number; // Backend message ID for feedback/bookmarks
  role: 'user' | 'assistant';
  content: string;
  pending?: boolean;
  status?: string; // Live status label shown while pending (e.g. "Finding sites…")
  feedback?: FeedbackRating; // User's feedback on this message
  bookmarked?: boolean;
  voice?: boolean; // User message that came in as a voice recording
  sites?: SiteInfo[]; // Structured vaccination sites (location answers)
};

// Backend streams status keys (locating/searching/reading_card) before the
// answer; map them to a label in the user's language.
const STATUS: Record<ReplyLanguage, Record<string, string>> = {
  en: { locating: 'Finding your nearest vaccination sites…', searching: 'Searching…', reading_card: 'Reading the card…' },
  ur: { locating: 'آپ کے قریب ترین مراکز تلاش کیے جا رہے ہیں…', searching: 'تلاش کیا جا رہا ہے…', reading_card: 'کارڈ پڑھا جا رہا ہے…' },
  fa: { locating: 'در حال یافتن نزدیک‌ترین مراکز واکسیناسیون…', searching: 'در حال جستجو…', reading_card: 'در حال خواندن کارت…' },
  ps: { locating: 'ستاسو نږدې واکسین مرکزونه لټول کیږي…', searching: 'لټون کیږي…', reading_card: 'کارت لوستل کیږي…' },
  sd: { locating: 'توهان جي ويجهو ويڪسينيشن سينٽر ڳوليا پيا وڃن…', searching: 'ڳولا ٿي رهي آهي…', reading_card: 'ڪارڊ پڙهيو پيو وڃي…' },
};

const statusLabel = (key: string, language: ReplyLanguage): string => {
  const m = STATUS[language] ?? STATUS.en;
  return m[key] ?? m.searching ?? STATUS.en.searching;
};

// The host buffers SSE (Apache mod_proxy_fcgi), so the backend's live status
// events don't arrive until the answer is ready. We therefore show an immediate
// best-guess status label client-side while waiting; onStatus refines it if an
// event does come through. A location-flavoured message → "Finding sites…".
const LOCATION_HINT =
  /\b(near|nearest|location|site|cent(er|re)|clinic|where\b.*\b(get|vaccinat|jab))\b|کہاں|جگہ|لوکیشن|مرکز|قریب|نزدیک|سینٹر|کلینک|جاؤں|لگوا|ٿاڻي|ويجهو|نږدې/iu;

const guessStatusKey = (text: string): 'locating' | 'searching' =>
  LOCATION_HINT.test(text) ? 'locating' : 'searching';

type Strings = {
  newChat: string;
  brandTitle: string;
  helperTag: string;
  todayChip: string;
  greeting: string;
  greetingHint: string;
  suggestions: string[];
  quickReplies: string[];
  scanCard: string;
  tapToSpeak: string;
  slideToCancel: string;
  holdToRecord: string;
  readAloud: string;
  directions: string;
  placeholder: string;
  errorLoad: string;
  errorNet: string;
  errorMic: string;
  errorNoAudio: string;
  errorVoice: string;
  voicePlaceholder: string;
  voiceTranscriptFallback: string;
  snackbarClose: string;
  copied: string;
  retry: string;
  offlineNote: string;
};

const COPY: Record<ReplyLanguage, Strings> = {
  en: {
    newChat: 'New chat',
    brandTitle: 'Tika Dost',
    helperTag: 'Vaccine helper',
    todayChip: 'Today',
    greeting: 'How can I help you today?',
    greetingHint: "Ask me anything about your child's vaccines.",
    suggestions: [
      'Which vaccine is next?',
      'Is fever after a vaccine normal?',
      'Where is the nearest vaccination centre?',
    ],
    quickReplies: [
      'Tell me more',
      'What are the side effects?',
      'When should this be given?',
    ],
    scanCard: 'Scan vaccination card',
    tapToSpeak: 'Hold to speak',
    slideToCancel: 'Slide to cancel',
    holdToRecord: 'Hold to record, release to send',
    readAloud: 'Read aloud',
    directions: 'Directions',
    placeholder: 'Type your question…',
    errorLoad: 'Could not load chat. Please try again.',
    errorNet: 'No internet connection. Please check and try again.',
    errorMic: 'Could not access microphone. Please allow microphone access.',
    errorNoAudio: 'No audio was recorded. Please try again.',
    errorVoice: 'Could not process voice. Please try typing instead.',
    voicePlaceholder: 'Listening…',
    voiceTranscriptFallback: 'Voice message',
    snackbarClose: 'OK',
    copied: 'Answer copied!',
    retry: 'Try Again',
    offlineNote: 'You are offline — showing a saved answer.',
  },
  ur: {
    newChat: 'نیا چیٹ',
    brandTitle: 'ٹیکہ دوست',
    helperTag: 'ٹیکہ مددگار',
    todayChip: 'آج',
    greeting: 'میں آپ کی کیا مدد کر سکتی ہوں؟',
    greetingHint: 'اپنے بچے کے ٹیکوں کے بارے میں کچھ بھی پوچھیں',
    suggestions: [
      'اگلا ٹیکہ کون سا ہے؟',
      'ٹیکے کے بعد بخار — کیا یہ معمول ہے؟',
      'قریبی ٹیکہ مرکز کہاں ہے؟',
    ],
    quickReplies: [
      'مزید بتائیں',
      'اس کے ضمنی اثرات کیا ہیں؟',
      'یہ کب دینی چاہیے؟',
    ],
    scanCard: 'ٹیکہ کارڈ اسکین کریں',
    tapToSpeak: 'بولنے کے لیے دبائے رکھیں',
    slideToCancel: 'منسوخ کے لیے سلائیڈ کریں',
    holdToRecord: 'ریکارڈ کے لیے دبائے رکھیں، بھیجنے کے لیے چھوڑیں',
    readAloud: 'سنیں',
    directions: 'راستہ دیکھیں',
    placeholder: 'اپنا سوال لکھیں…',
    errorLoad: 'چیٹ لوڈ نہیں ہو سکی۔ براہ کرم دوبارہ کوشش کریں۔',
    errorNet: 'انٹرنیٹ کنکشن نہیں۔ براہ کرم چیک کریں اور دوبارہ کوشش کریں۔',
    errorMic: 'مائیکروفون استعمال نہیں ہو سکا۔ براہ کرم اجازت دیں۔',
    errorNoAudio: 'کوئی آڈیو ریکارڈ نہیں ہوئی۔ براہ کرم دوبارہ کوشش کریں۔',
    errorVoice: 'آواز پروسیس نہیں ہو سکی۔ براہ کرم لکھ کر بھیجیں۔',
    voicePlaceholder: 'سن رہی ہوں…',
    voiceTranscriptFallback: 'آواز کا پیغام',
    snackbarClose: 'ٹھیک ہے',
    copied: 'جواب کاپی ہو گیا!',
    retry: 'دوبارہ کوشش',
    offlineNote: 'آپ آف لائن ہیں — محفوظ شدہ جواب دکھایا جا رہا ہے۔',
  },
  fa: {
    newChat: 'گفتگوی جدید',
    brandTitle: 'ٹیکہ دوست',
    helperTag: 'دستیار واکسن',
    todayChip: 'امروز',
    greeting: 'امروز چطور می‌توانم کمکتان کنم؟',
    greetingHint: 'هر سوالی درباره واکسن‌های کودکتان بپرسید.',
    suggestions: [
      'واکسن بعدی کدام است؟',
      'تب بعد از واکسن طبیعی است؟',
      'نزدیک‌ترین مرکز واکسیناسیون کجاست؟',
    ],
    quickReplies: [
      'بیشتر توضیح دهید',
      'عوارض آن چیست؟',
      'چه زمانی باید داده شود؟',
    ],
    scanCard: 'کارت واکسیناسیون را اسکن کنید',
    tapToSpeak: 'برای صحبت نگه دارید',
    slideToCancel: 'برای لغو بکشید',
    holdToRecord: 'برای ضبط نگه دارید، برای ارسال رها کنید',
    readAloud: 'بشنوید',
    directions: 'مسیر',
    placeholder: 'سوال خود را بنویسید…',
    errorLoad: 'گفتگو بارگذاری نشد. لطفاً دوباره تلاش کنید.',
    errorNet: 'اتصال اینترنت نیست. لطفاً بررسی کنید و دوباره تلاش کنید.',
    errorMic: 'دسترسی به میکروفون ممکن نشد. لطفاً اجازه دهید.',
    errorNoAudio: 'هیچ صدایی ضبط نشد. لطفاً دوباره تلاش کنید.',
    errorVoice: 'پردازش صدا ممکن نشد. لطفاً تایپ کنید.',
    voicePlaceholder: 'در حال شنیدن…',
    voiceTranscriptFallback: 'پیام صوتی',
    snackbarClose: 'باشه',
    copied: 'پاسخ کپی شد!',
    retry: 'تلاش دوباره',
    offlineNote: 'شما آفلاین هستید — پاسخ ذخیره‌شده نمایش داده می‌شود.',
  },
  ps: {
    newChat: 'نوې خبرې',
    brandTitle: 'ٹیکہ دوست',
    helperTag: 'د واکسین مرستندوی',
    todayChip: 'نن',
    greeting: 'نن څنګه مرسته وکړم؟',
    greetingHint: 'د خپل ماشوم د واکسینونو په اړه هر څه وپوښتئ.',
    suggestions: [
      'راتلونکی واکسین کوم دی؟',
      'د واکسین وروسته تبه — عادي ده؟',
      'نږدې د واکسین مرکز چیرته دی؟',
    ],
    quickReplies: [
      'نور راته ووایاست',
      'د دې اغیزې څه دي؟',
      'دا کله باید ورکړل شي؟',
    ],
    scanCard: 'د واکسین کارت سکین کړئ',
    tapToSpeak: 'د خبرو لپاره کېکاږلی وساتئ',
    slideToCancel: 'د لغوه لپاره وښویوئ',
    holdToRecord: 'د ثبت لپاره کېکاږلی وساتئ، د لېږلو لپاره پرېږدئ',
    readAloud: 'واورئ',
    directions: 'لار وګورئ',
    placeholder: 'خپله پوښتنه ولیکئ…',
    errorLoad: 'خبرې نه لوډ شوې۔ بیا هڅه وکړئ.',
    errorNet: 'انټرنیټ نشته۔ وګورئ او بیا هڅه وکړئ.',
    errorMic: 'مایکروفون نه کار کوي۔ اجازه ورکړئ.',
    errorNoAudio: 'آډیو ریکارډ نه شو۔ بیا هڅه وکړئ.',
    errorVoice: 'غږ پروسس نه شو۔ لیکلی پوښتنه وکړئ.',
    voicePlaceholder: 'اورم…',
    voiceTranscriptFallback: 'غږیز پیغام',
    snackbarClose: 'سمه ده',
    copied: 'ځواب کاپي شو!',
    retry: 'بیا هڅه وکړئ',
    offlineNote: 'تاسو آفلاین یاست — خوندي شوی ځواب ښودل کیږي.',
  },
  sd: {
    newChat: 'نئين چيٽ',
    brandTitle: 'ٹیکہ دوست',
    helperTag: 'ويڪسين مددگار',
    todayChip: 'اڄ',
    greeting: 'مان ڪيئن مدد ڪري سگهان؟',
    greetingHint: 'پنهنجي ٻار جي ويڪسين بابت ڪجهه به پڇو.',
    suggestions: [
      'اڳيون ويڪسين ڪهڙي آهي؟',
      'ويڪسين کانپوءِ بخار — ڇا معمول آهي؟',
      'ويجهو ويڪسينيشن سينٽر ڪٿي آهي؟',
    ],
    quickReplies: [
      'وڌيڪ ٻڌايو',
      'هن جا ضمني اثر ڇا آهن؟',
      'هي ڪڏهن ڏني وڃي؟',
    ],
    scanCard: 'ويڪسين ڪارڊ اسڪين ڪريو',
    tapToSpeak: 'ڳالهائڻ لاءِ دٻائي رکو',
    slideToCancel: 'منسوخ لاءِ سلائيڊ ڪريو',
    holdToRecord: 'رڪارڊ لاءِ دٻائي رکو، موڪلڻ لاءِ ڇڏيو',
    readAloud: 'ٻڌو',
    directions: 'رستو ڏسو',
    placeholder: 'پنهنجو سوال لکو…',
    errorLoad: 'چيٽ لوڊ نه ٿي سگهي۔ ٻيهر ڪوشش ڪريو.',
    errorNet: 'انٽرنيٽ ڪنيڪشن نه آهي۔ چيڪ ڪريو ۽ ٻيهر ڪوشش ڪريو.',
    errorMic: 'مائڪ استعمال نه ٿي سگهيو۔ اجازت ڏيو.',
    errorNoAudio: 'ڪا آڊيو رڪارڊ نه ٿي۔ ٻيهر ڪوشش ڪريو.',
    errorVoice: 'آواز پروسيس نه ٿي سگهي۔ لکي موڪليو.',
    voicePlaceholder: 'ٻڌي رهي آهيان…',
    voiceTranscriptFallback: 'آواز جو پيغام',
    snackbarClose: 'ٺيڪ آهي',
    copied: 'جواب ڪاپي ٿي ويو!',
    retry: 'ٻيهر ڪوشش',
    offlineNote: 'توهان آف لائين آهيو — محفوظ جواب ڏيکاريو پيو وڃي.',
  },
};

// Roman Urdu has no voice of its own — read it with the Urdu engine.
// Pashto and Sindhi use their respective language codes for server TTS.
const TTS_LANG: Record<ReplyLanguage, string> = {
  en: 'en-US',
  ur: 'ur-PK',
  fa: 'fa-IR',
  ps: 'ps-AF',
  sd: 'sd-PK',
};

/**
 * Strip Markdown so the text-to-speech engine doesn't read "asterisk asterisk"
 * or "hash" aloud. Bullet/number markers, emphasis, headings, links, and code
 * fences are reduced to their spoken content. Safe on whole answers and on the
 * single sentences the progressive speaker queues.
 */
function stripMarkdownForSpeech(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' ') // fenced code blocks
    .replace(/`([^`]+)`/g, '$1') // inline code
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ') // images
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1') // links → link text
    .replace(/^\s{0,3}#{1,6}\s+/gm, '') // ATX headings
    .replace(/(\*\*|__)(.*?)\1/g, '$2') // bold
    .replace(/(\*|_)(.*?)\1/g, '$2') // italics
    .replace(/~~(.*?)~~/g, '$1') // strikethrough
    .replace(/^\s*[-*+]\s+/gm, '') // bullet markers
    .replace(/^\s*\d+[.)]\s+/gm, '') // numbered-list markers
    .replace(/^\s*>\s?/gm, '') // blockquotes
    .replace(/[*_#`>~|]/g, '') // any stray markdown symbols
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

/**
 * Drop the trailing "📍 [site](maps url)" pin lines from a site answer. Used
 * for speech always (reading map links aloud is noise) and for display when
 * structured site cards are shown instead (the cards carry the Directions
 * buttons, so the raw link list would be a duplicate).
 */
function stripMapsLines(text: string): string {
  return text
    .split('\n')
    .filter((line) => !line.trim().startsWith('📍'))
    .join('\n')
    .trim();
}

/**
 * Choose the voice language from the answer's OWN script, not the app's UI
 * language. A Pashto/Urdu answer must be read with that language's voice — using
 * the English voice (the app setting) makes it skip the Arabic script and read
 * only the stray Latin words. Latin text falls back to the app preference
 * (English vs Roman Urdu).
 */
function ttsLangForText(text: string, appLang: ReplyLanguage): ReplyLanguage {
  if (/[ټډړږښځڅېګڼ]/.test(text)) return 'ps';
  // Sindhi-unique letters ONLY. ھ (U+06BE) is deliberately excluded — it is a
  // very common Urdu letter (تھا، بھی، مجھے، پھر…), and including it made Urdu
  // answers get tagged Sindhi and read by the wrong (Sindhi) voice.
  if (/[ڳڻڪڀٺٽ۾]/.test(text)) return 'sd';
  // Farsi/Urdu/Pashto/Sindhi share the Arabic script and can't always be told
  // apart by letters, so for Arabic-script text trust the selected language
  // (mirrors the backend's resolveLang); default to Urdu when it isn't one of
  // the other Arabic-script tongues.
  if (/[؀-ۿ]/.test(text)) {
    return appLang === 'fa' || appLang === 'ps' || appLang === 'sd' ? appLang : 'ur';
  }
  return 'en';
}

const isPlaceholderTitleText = (t: string) =>
  t === COPY.en.newChat || t === COPY.ur.newChat || t === COPY.fa.newChat ||
  t === COPY.ps.newChat || t === COPY.sd.newChat;

// Markdown styles for bot messages (LTR)
const mdStylesBot = {
  body: { color: palette.botBubbleText, fontSize: 15.5, lineHeight: 24 },
  paragraph: { marginTop: 0, marginBottom: 10 },
  heading1: { fontSize: 19, fontWeight: '800' as const, marginBottom: 10, marginTop: 4, color: tika.ink },
  heading2: { fontSize: 17, fontWeight: '800' as const, marginBottom: 8, marginTop: 2, color: tika.ink },
  heading3: { fontSize: 16, fontWeight: '700' as const, marginBottom: 6, color: tika.ink },
  bullet_list: { marginBottom: 10, marginTop: 4 },
  ordered_list: { marginBottom: 10, marginTop: 4 },
  list_item: { marginBottom: 6 },
  strong: { fontWeight: '800' as const, color: tika.ink },
  em: { fontStyle: 'italic' as const },
  link: { color: tika.teal, textDecorationLine: 'underline' as const },
  code_inline: { backgroundColor: tika.mint, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 14 },
  fence: { backgroundColor: tika.mint, padding: 12, borderRadius: 10, marginVertical: 10 },
  code_block: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 14 },
  blockquote: { borderLeftWidth: 3, borderLeftColor: tika.amber, paddingLeft: 12, marginVertical: 10, opacity: 0.95 },
};

// Markdown styles for bot messages (RTL - Urdu, Farsi, Pashto, Sindhi)
const mdStylesBotRtl = {
  ...mdStylesBot,
  body: { ...mdStylesBot.body, writingDirection: 'rtl' as const, textAlign: 'right' as const, lineHeight: 27 },
  paragraph: { ...mdStylesBot.paragraph, writingDirection: 'rtl' as const, textAlign: 'right' as const },
  list_item: { ...mdStylesBot.list_item, writingDirection: 'rtl' as const },
  blockquote: { ...mdStylesBot.blockquote, borderLeftWidth: 0, borderRightWidth: 3, borderRightColor: tika.amber, paddingLeft: 0, paddingRight: 12 },
};

/** Feather icon per quick-question card, matching the mockup (calendar / thermometer / map-pin). */
const SUGGESTION_ICONS: (keyof typeof Feather.glyphMap)[] = ['calendar', 'thermometer', 'map-pin'];

/**
 * WhatsApp-style live waveform for the recording bar. Bars rise with the mic's
 * metering level when available; a gentle animated ripple keeps it alive when
 * metering isn't reported.
 */
const RecordingWave = memo(function RecordingWave({ level }: { level: number }) {
  const BAR_COUNT = 22;
  const [bars, setBars] = useState<number[]>(() => Array(BAR_COUNT).fill(0.2));

  useEffect(() => {
    // Shift the history left and append the newest level with slight jitter so
    // the wave scrolls like WhatsApp's, even between metering updates.
    const tick = setInterval(() => {
      setBars((prev) => {
        const next = prev.slice(1);
        const jitter = 0.82 + Math.random() * 0.36;
        next.push(Math.min(1, Math.max(0.12, level * jitter)));
        return next;
      });
    }, 120);
    return () => clearInterval(tick);
  }, [level]);

  return (
    <View style={waveStyles.row}>
      {bars.map((h, i) => (
        <View
          key={i}
          style={[
            waveStyles.bar,
            {
              height: 6 + h * 22,
              backgroundColor: h > 0.72 ? tika.amber : tika.tealBright,
              opacity: 0.45 + h * 0.55,
            },
          ]}
        />
      ))}
    </View>
  );
});

const waveStyles = StyleSheet.create({
  row: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 3, height: 34, overflow: 'hidden' },
  bar: { width: 3.5, borderRadius: 99 },
});

/**
 * Structured site cards for a location answer (mockup's "nearest site" card):
 * mint card, map chip, name + distance (+ opening hours once the backend has
 * them), and a full-width teal Directions button per site.
 */
const SiteCards = memo(function SiteCards({
  sites,
  directionsLabel,
  isRtl,
}: {
  sites: SiteInfo[];
  directionsLabel: string;
  isRtl: boolean;
}) {
  return (
    <View style={siteStyles.stack}>
      {sites.map((site, i) => {
        const meta = [
          site.distance_km != null ? `${site.distance_km} km` : site.area || null,
          // Timing (opening hours) is forward-compatible: the backend sends
          // null until site timings exist, and the row simply omits it.
          site.timing || null,
        ]
          .filter(Boolean)
          .join(' · ');
        return (
          <View key={`${site.name}-${i}`} style={siteStyles.card}>
            <View style={[siteStyles.topRow, isRtl && styles.rowReverse]}>
              <View style={siteStyles.mapChip}>
                <Feather name="map-pin" size={22} color={tika.teal} />
              </View>
              <View style={siteStyles.info}>
                <Text style={[siteStyles.name, isRtl ? styles.rtl : null]} numberOfLines={2}>
                  {site.name}
                </Text>
                {meta !== '' && (
                  <Text style={[siteStyles.meta, isRtl ? styles.rtl : null]} numberOfLines={2}>
                    {meta}
                  </Text>
                )}
              </View>
            </View>
            {!!site.maps_url && (
              <Pressable
                onPress={() => Linking.openURL(site.maps_url!).catch(() => {})}
                android_ripple={{ color: 'rgba(255,255,255,0.2)' }}
                style={({ pressed }) => [siteStyles.directionsBtn, pressed && { opacity: 0.9 }]}
                accessibilityRole="button"
                accessibilityLabel={`${directionsLabel}: ${site.name}`}
              >
                <Feather name="map-pin" size={15} color="#fff" />
                <Text style={siteStyles.directionsText}>{directionsLabel}</Text>
              </Pressable>
            )}
          </View>
        );
      })}
    </View>
  );
});

const siteStyles = StyleSheet.create({
  stack: { gap: 10, marginTop: 8, maxWidth: '88%' },
  card: {
    backgroundColor: tika.mint,
    borderRadius: 20,
    padding: 14,
    gap: 12,
    shadowColor: tika.shadow,
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  mapChip: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: '#DCE9E3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: { flex: 1, gap: 3 },
  name: { fontSize: 15, fontWeight: '800', color: tika.ink, lineHeight: 20 },
  meta: { fontSize: 13, color: tika.inkSoft },
  directionsBtn: {
    minHeight: 48,
    borderRadius: 999,
    backgroundColor: tika.teal,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  directionsText: { color: '#fff', fontSize: 14.5, fontWeight: '800' },
});

/** A single chat bubble — memoized so streaming only re-renders the live message. */
const MessageBubble = memo(function MessageBubble({
  item,
  isRtl,
  readAloudLabel,
  directionsLabel,
  onCopy,
  onSpeak,
  onFeedback,
  onBookmark,
  onShare,
}: {
  item: Msg;
  isRtl: boolean;
  readAloudLabel: string;
  directionsLabel: string;
  onCopy: (text: string) => void;
  onSpeak: (text: string) => void;
  onFeedback: (msg: Msg, rating: FeedbackRating) => void;
  onBookmark: (msg: Msg) => void;
  onShare: (text: string) => void;
}) {
  const isUser = item.role === 'user';
  const canPlay = !item.pending && item.content.trim().length > 0;
  const canInteract = !item.pending && item.serverId && !isUser;
  const hasSites = !isUser && !!item.sites?.length;
  // With site cards shown, the raw 📍 link list in the text is a duplicate.
  const displayContent = hasSites ? stripMapsLines(item.content) : item.content;

  // Chat mirrors in RTL (mockup 1d): user on the left, assistant on the right,
  // with the bubble "tail" corner flipped to match.
  const userSelf = isRtl ? styles.rowLeft : styles.rowRight;
  const botSelf = isRtl ? styles.rowRight : styles.rowLeft;

  // Status pill while the answer is being prepared (mockup's typing pill).
  if (item.pending && !isUser && item.content === '') {
    return (
      <View style={[styles.row, botSelf]}>
        <View style={[styles.statusPill, isRtl && styles.rowReverse]}>
          <TypingDots size={7} />
          {item.status ? (
            <Text style={[styles.statusText, isRtl ? styles.rtl : null]} numberOfLines={2}>
              {item.status}
            </Text>
          ) : null}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.row, isUser ? userSelf : botSelf]}>
      <View style={styles.bubbleWrapper}>
        <Pressable
          onLongPress={() => onCopy(item.content)}
          delayLongPress={320}
          android_ripple={{ color: 'rgba(11,36,64,0.05)' }}
          style={[
            styles.bubble,
            isUser ? styles.bubbleUser : styles.bubbleBot,
            isUser
              ? (isRtl ? styles.tailBottomLeft : styles.tailBottomRight)
              : (isRtl ? styles.tailBottomRight : styles.tailBottomLeft),
          ]}
        >
          {isUser ? (
            <View style={[styles.userContent, isRtl && styles.rowReverse]}>
              {item.voice && (
                <Feather name="mic" size={15} color="rgba(255,255,255,0.85)" style={styles.voiceBadge} />
              )}
              <Text
                selectable
                style={[styles.bubbleText, { color: palette.userBubbleText, flexShrink: 1 }, isRtl ? styles.rtl : null]}
              >
                {item.content}
              </Text>
            </View>
          ) : (
            <Markdown
              style={isRtl ? mdStylesBotRtl : mdStylesBot}
              onLinkPress={(url) => {
                // Open Google Maps pins (and any other links) in the maps/browser app.
                Linking.openURL(url).catch(() => {});
                return false;
              }}
            >
              {displayContent}
            </Markdown>
          )}
        </Pressable>

        {/* Structured site cards for location answers */}
        {hasSites && (
          <SiteCards sites={item.sites!} directionsLabel={directionsLabel} isRtl={isRtl} />
        )}

        {/* Read-aloud pill + feedback actions under assistant answers */}
        {!isUser && canPlay && !item.pending && (
          <View style={[styles.msgActions, isRtl && styles.rowReverse]}>
            <Pressable
              onPress={() => onSpeak(displayContent)}
              android_ripple={{ color: 'rgba(14,124,102,0.12)' }}
              style={({ pressed }) => [styles.readAloudPill, isRtl && styles.rowReverse, pressed && { opacity: 0.8 }]}
              accessibilityRole="button"
              accessibilityLabel={readAloudLabel}
            >
              <Feather name="volume-2" size={15} color={tika.teal} />
              <Text style={styles.readAloudText}>{readAloudLabel}</Text>
            </Pressable>
            {canInteract && (
              <>
                <Pressable
                  onPress={() => onFeedback(item, 'up')}
                  style={({ pressed }) => [styles.actionBtn, item.feedback === 'up' && styles.actionBtnActive, pressed && { opacity: 0.7 }]}
                >
                  <Feather name="thumbs-up" size={15} color={item.feedback === 'up' ? tika.teal : tika.inkFaint} />
                </Pressable>
                <Pressable
                  onPress={() => onFeedback(item, 'down')}
                  style={({ pressed }) => [styles.actionBtn, item.feedback === 'down' && styles.actionBtnActive, pressed && { opacity: 0.7 }]}
                >
                  <Feather name="thumbs-down" size={15} color={item.feedback === 'down' ? tika.coral : tika.inkFaint} />
                </Pressable>
                <Pressable
                  onPress={() => onBookmark(item)}
                  style={({ pressed }) => [styles.actionBtn, item.bookmarked && styles.actionBtnActive, pressed && { opacity: 0.7 }]}
                >
                  <Feather name="bookmark" size={15} color={item.bookmarked ? tika.amber : tika.inkFaint} />
                </Pressable>
                <Pressable
                  onPress={() => onShare(item.content)}
                  style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.7 }]}
                >
                  <Feather name="share-2" size={15} color={tika.inkFaint} />
                </Pressable>
              </>
            )}
          </View>
        )}
      </View>
    </View>
  );
});

export default function ChatScreen({ route, navigation }: Props) {
  const { language } = useLanguage();
  const strings = COPY[language];
  const isRtl = language === 'ur' || language === 'fa' || language === 'ps' || language === 'sd';
  // The chat to show is driven by route params: a chatId to open an existing
  // chat, or null + a `fresh` nonce to force a brand-new chat.
  const paramChatId = route.params?.chatId ?? null;
  const paramFresh = route.params?.fresh;

  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [chatId, setChatId] = useState<number | null>(paramChatId);
  const [chatTitle, setChatTitle] = useState<string>(strings.newChat);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryText, setRetryText] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(paramChatId !== null);
  const [muted, setMuted] = useState(false);
  // WhatsApp-style recording gesture: 'held' while the finger is down on the
  // mic (release = send, slide sideways = cancel, slide up = lock), 'locked'
  // once locked (hands-free until trash/send is tapped).
  const [recMode, setRecMode] = useState<'idle' | 'held' | 'locked'>('idle');
  const [hint, setHint] = useState<string | null>(null);

  const listRef = useRef<FlatList<Msg>>(null);
  const messagesRef = useRef<Msg[]>([]);
  // Captured once per session; sent with messages so the assistant can answer
  // "where is my nearest site?". Null until granted/fixed (sent omitted then).
  const locationRef = useRef<LatLng | null>(null);
  // Speaker gender detected from the most recent voice message. Drives the TTS
  // voice so a male speaker is answered in a male voice (female is the default).
  const voiceGenderRef = useRef<'male' | 'female' | null>(null);
  // Metering needs to be requested explicitly — it powers the recording wave.
  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true });
  const recorderState = useAudioRecorderState(recorder);
  // Plays the server's natural TTS voice (reliable across devices); languages
  // without a server voice fall back to the on-device engine.
  const ttsPlayer = useAudioPlayer(null);
  const recordingPulse = useRef(new Animated.Value(1)).current;

  // Push-to-talk gesture plumbing. The PanResponder is created once, so it
  // reaches the LATEST handlers through a ref (a directly captured callback
  // would be frozen at first render with stale state).
  const recStartAtRef = useRef(0);
  const lockedRef = useRef(false);
  const cancelledRef = useRef(false);
  const holdHandlersRef = useRef<{
    canStart: () => boolean;
    start: () => void;
    move: (dx: number, dy: number) => void;
    release: () => void;
    terminate: () => void;
  }>({ canStart: () => false, start: () => {}, move: () => {}, release: () => {}, terminate: () => {} });
  const micScale = useRef(new Animated.Value(1)).current;
  const micShiftX = useRef(new Animated.Value(0)).current;
  const micShiftY = useRef(new Animated.Value(0)).current;
  const lockHintY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // After a card scan, ScanCardScreen stashes a summary note; show it as an
  // assistant bubble when this screen regains focus.
  useFocusEffect(
    useCallback(() => {
      const note = takeCardNote();
      if (note) {
        setMessages((m) => [...m, { id: `card-${Date.now()}`, role: 'assistant', content: note }]);
      }
    }, []),
  );

  // Keep a local stash of popular Q&A pairs so common questions still get an
  // answer when the device has no connection. Never throws.
  useEffect(() => {
    refreshQuickAnswersCache(language);
  }, [language]);

  // Soft pulse on the recording dot (WhatsApp-style).
  useEffect(() => {
    if (recorderState.isRecording) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(recordingPulse, { toValue: 0.25, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(recordingPulse, { toValue: 1.0, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
      );
      loop.start();
      return () => loop.stop();
    }
    recordingPulse.setValue(1);
  }, [recorderState.isRecording, recordingPulse]);

  // Device id + audio permissions: once.
  useEffect(() => {
    (async () => {
      const id = await getDeviceId();
      setDeviceId(id);
      // Grab a location fix in the background so it's ready by the time the
      // user asks about a site. Never blocks; stays null if denied.
      getSessionLocation().then((loc) => {
        locationRef.current = loc;
      });
      try {
        const perm = await AudioModule.requestRecordingPermissionsAsync();
        if (perm.granted) {
          await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
        }
      } catch {}
    })();
    return () => {
      Speech.stop();
      try {
        ttsPlayer.pause();
      } catch {}
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load the requested chat — or reset to a blank new chat — whenever the route
  // asks for a different one (opening from history, or tapping "new chat").
  useEffect(() => {
    if (!deviceId) return;
    Speech.stop();
    try {
      ttsPlayer.pause();
    } catch {}
    setInput('');
    setError(null);
    setRetryText(null);
    setChatId(paramChatId);
    setChatTitle(strings.newChat);

    if (paramChatId) {
      setLoadingHistory(true);
      getChat(deviceId, paramChatId)
        .then((detail) => {
          if (detail.chat.title) setChatTitle(detail.chat.title);
          setMessages(
            detail.messages.map((m) => ({
              id: `s${m.id}`,
              serverId: m.id,
              role: m.role === 'system' ? 'assistant' : (m.role as 'user' | 'assistant'),
              content: m.content,
            })),
          );
        })
        .catch((e: any) => setError(e?.message ?? strings.errorLoad))
        .finally(() => setLoadingHistory(false));
    } else {
      setMessages([]);
      setLoadingHistory(false);
    }
  }, [deviceId, paramChatId, paramFresh]); // eslint-disable-line react-hooks/exhaustive-deps

  // True while the user is at (or near) the bottom of the list. We only
  // auto-follow new content when this is true, so scrolling up to read earlier
  // messages doesn't keep yanking the view back down.
  const atBottomRef = useRef(true);

  const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
    atBottomRef.current =
      contentSize.height - (contentOffset.y + layoutMeasurement.height) < 80;
  }, []);

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  }, []);

  // After the user sends — always pin to the bottom.
  const scroll = useCallback(() => {
    atBottomRef.current = true;
    scrollToEnd();
  }, [scrollToEnd]);

  // On content growth — follow only if the user is already at the bottom.
  const followIfAtBottom = useCallback(() => {
    if (atBottomRef.current) scrollToEnd();
  }, [scrollToEnd]);

  const stopSpeaking = useCallback(() => {
    Speech.stop();
    try {
      ttsPlayer.pause();
    } catch {}
  }, [ttsPlayer]);

  /**
   * Read an answer aloud. Primary path is the server's natural voice (reliable
   * across devices); if synthesis is unavailable — a server/quota failure,
   * offline, or an unsupported language — we fall back to the on-device voice.
   * Markdown (and map-pin link lines) are stripped either way.
   */
  const speak = useCallback(
    async (text: string) => {
      if (muted || !text.trim()) return;
      stopSpeaking();
      const clean = stripMarkdownForSpeech(stripMapsLines(text));
      if (!clean) return;

      // Voice follows the answer's own language, not the app's UI language.
      const ttsLang = ttsLangForText(clean, language);

      const url = ttsUrl(clean, ttsLang, voiceGenderRef.current);
      try {
        // Validate synthesis before handing the URL to the player, so a failure
        // cleanly falls back instead of playing silence. The backend caches the
        // audio, so the player's fetch is cheap.
        const res = await fetch(url);
        if (!res.ok) throw new Error('tts unavailable');
        // Route audio to the loudspeaker — recording mode can otherwise pin
        // playback to the earpiece on Android.
        await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
        ttsPlayer.replace({ uri: url });
        ttsPlayer.play();
      } catch {
        Speech.speak(clean, { language: TTS_LANG[ttsLang], pitch: 1.0, rate: 1.0 });
      }
    },
    [language, muted, stopSpeaking, ttsPlayer],
  );

  /**
   * Reveal a finished answer and its voice TOGETHER. We briefly wait for the
   * server audio to be synthesized, then show the text and start playback at
   * the same moment — instead of showing text immediately and playing audio
   * ~15s later. If audio is slow (cap) or fails, the text shows and the
   * on-device voice covers it so nothing stalls.
   */
  const revealWithAudio = useCallback(
    (placeholderId: string, content: string, serverId?: number, sites?: SiteInfo[]): Promise<void> => {
      const reveal = () =>
        setMessages((m) =>
          m.map((x) =>
            x.id === placeholderId
              ? { ...x, pending: false, content, serverId, sites: sites?.length ? sites : undefined }
              : x,
          ),
        );

      if (muted || !content.trim()) {
        reveal();
        return Promise.resolve();
      }

      const clean = stripMarkdownForSpeech(stripMapsLines(content));
      const ttsLang = ttsLangForText(clean, language);
      const url = ttsUrl(clean, ttsLang, voiceGenderRef.current);

      return Promise.race<string | null>([
        fetch(url)
          .then((r) => (r.ok ? url : null))
          .catch(() => null),
        // 4s cap (was 8s): if server TTS is slower than this, show the text and
        // let the on-device voice cover it — answers should never feel stuck.
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000)),
      ]).then(async (ready) => {
        reveal();
        scroll();
        if (ready) {
          try {
            await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
            ttsPlayer.replace({ uri: ready });
            ttsPlayer.play();
          } catch {}
        } else {
          Speech.speak(clean, { language: TTS_LANG[ttsLang], pitch: 1.0, rate: 1.0 });
        }
      });
    },
    [muted, language, ttsPlayer, scroll],
  );

  const startNewChat = useCallback(() => {
    navigation.navigate('Chat', { chatId: null, fresh: Date.now() });
  }, [navigation]);

  const persistSession = useCallback(
    (id: number, title: string) => {
      upsertSession({
        id,
        title: title || strings.newChat,
        message_count: messagesRef.current.length,
        updated_at: new Date().toISOString(),
      });
    },
    [strings.newChat],
  );

  const copyMessage = useCallback(async (text: string) => {
    if (!text.trim()) return;
    try {
      await Clipboard.setStringAsync(text);
      setCopied(true);
    } catch {}
  }, []);

  const handleFeedback = useCallback(
    async (msg: Msg, rating: FeedbackRating) => {
      if (!deviceId || !msg.serverId || msg.feedback) return;
      try {
        await submitFeedback({ messageId: msg.serverId, deviceId, rating });
        setMessages((m) =>
          m.map((x) => (x.id === msg.id ? { ...x, feedback: rating } : x))
        );
      } catch {}
    },
    [deviceId]
  );

  const handleBookmark = useCallback(
    async (msg: Msg) => {
      if (!deviceId || !msg.serverId) return;
      try {
        const res = await toggleBookmark({ messageId: msg.serverId, deviceId });
        setMessages((m) =>
          m.map((x) => (x.id === msg.id ? { ...x, bookmarked: res.isBookmarked } : x))
        );
      } catch {}
    },
    [deviceId]
  );

  const handleShare = useCallback(async (text: string) => {
    if (!text.trim()) return;
    try {
      await Share.share({
        message: text,
        title: 'Tika Dost',
      });
    } catch {}
  }, []);

  const sendTextMessage = useCallback(
    async (retryOf?: string) => {
      const text = (retryOf ?? input).trim();
      if (!deviceId || !text || busy) return;
      if (!retryOf) setInput('');
      setError(null);
      setRetryText(null);
      stopSpeaking();

      const placeholderId = `p${Date.now()}`;
      const userMsg: Msg = { id: `u${Date.now()}`, role: 'user', content: text };
      const placeholder: Msg = {
        id: placeholderId,
        role: 'assistant',
        content: '',
        pending: true,
        status: statusLabel(guessStatusKey(text), language),
      };
      setMessages((m) => [...m, userMsg, placeholder]);
      setBusy(true);

      // Refresh the GPS fix when it has gone stale (user traveled since app
      // start) so "nearest site" answers match where they are NOW. Capped at
      // 2.5s inside getSessionLocation — never stalls the message.
      const loc = await getSessionLocation();
      if (loc) locationRef.current = loc;

      const freshTitle = isPlaceholderTitleText(chatTitle) && !chatId;
      if (freshTitle) setChatTitle(text.slice(0, 60));
      const titleForCache = freshTitle ? text.slice(0, 60) : chatTitle;
      scroll();

      // The answer streams server-side, but we keep the typing indicator until
      // the reply (and its voice) are ready, then reveal text + audio together.
      let sawDelta = false;
      try {
        const res = await sendTextStream(
          { deviceId, message: text, chatId, language, location: locationRef.current },
          {
            onMeta: (id) => setChatId(id),
            onStatus: (key) =>
              setMessages((m) =>
                m.map((x) =>
                  x.id === placeholderId ? { ...x, status: statusLabel(key, language) } : x,
                ),
              ),
            onDelta: () => {
              sawDelta = true;
            },
          },
        );
        setChatId(res.chat_id);
        persistSession(res.chat_id, titleForCache);
        await revealWithAudio(placeholderId, res.reply.content, res.reply.id, res.reply.sites);
      } catch (streamErr: any) {
        if (sawDelta) {
          setError(streamErr?.message ?? strings.errorNet);
          setRetryText(text);
        } else {
          // Streaming unavailable — fall back to the plain request/response endpoint.
          try {
            const res = await sendText({ deviceId, message: text, chatId, language, location: locationRef.current });
            setChatId(res.chat_id);
            persistSession(res.chat_id, titleForCache);
            await revealWithAudio(placeholderId, res.reply.content, res.reply.id, res.reply.sites);
          } catch (e: any) {
            // Last resort: answer from the offline quick-answers cache.
            const cached = await getCachedQuickAnswers();
            const hit = cached ? searchQuickAnswers(text, cached.answers) : null;
            if (hit) {
              setError(strings.offlineNote);
              await revealWithAudio(placeholderId, hit.answer);
            } else {
              setMessages((m) => m.filter((x) => x.id !== placeholderId));
              setError(e?.message ?? strings.errorNet);
              setRetryText(text);
            }
          }
        }
      } finally {
        setBusy(false);
        scroll();
      }
    },
    [busy, chatId, chatTitle, deviceId, input, language, persistSession, revealWithAudio, scroll, stopSpeaking, strings.errorNet, strings.offlineNote],
  );

  const startRecording = useCallback(async () => {
    // recorder.isRecording is the LIVE recorder flag (recorderState polls and
    // can lag by an interval — too stale for gesture races).
    if (!deviceId || busy || recorder.isRecording) return;
    setError(null);
    stopSpeaking();
    try {
      // Re-enable the recording session (playback may have switched it off).
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      // The finger may have lifted or slid to cancel while prepare was in
      // flight — starting now would leave a headless recording running.
      if (cancelledRef.current) return;
      recorder.record();
    } catch (e: any) {
      setRecMode('idle');
      setError(e?.message ?? strings.errorMic);
    }
  }, [busy, deviceId, recorder, stopSpeaking, strings.errorMic]);

  /** WhatsApp-style cancel: stop the recorder and throw the clip away. */
  const cancelRecording = useCallback(async () => {
    if (!recorder.isRecording) return;
    try {
      await recorder.stop();
    } catch {}
  }, [recorder]);

  const stopRecordingAndSend = useCallback(async () => {
    if (!deviceId || !recorder.isRecording) return;
    setBusy(true);
    setError(null);
    setRetryText(null);
    try {
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri) {
        setError(strings.errorNoAudio);
        return;
      }

      const userId = `uv${Date.now()}`;
      const placeholderId = `pv${Date.now()}`;
      setMessages((m) => [
        ...m,
        { id: userId, role: 'user', content: strings.voicePlaceholder, pending: true, voice: true },
        { id: placeholderId, role: 'assistant', content: '', pending: true, status: statusLabel('searching', language) },
      ]);
      scroll();

      // Same stale-GPS refresh as the text path (see sendTextMessage).
      const loc = await getSessionLocation();
      if (loc) locationRef.current = loc;

      const res = await sendAudio({ deviceId, audioUri: uri, audioMime: 'audio/m4a', chatId, language, location: locationRef.current });
      setChatId(res.chat_id);
      // Remember the speaker's gender so this reply (and later replies in the
      // chat) are read back in a matching voice. Unknown keeps the default.
      if (res.voice_gender === 'male' || res.voice_gender === 'female') {
        voiceGenderRef.current = res.voice_gender;
      }
      const transcript = res.transcript?.trim() || strings.voiceTranscriptFallback;
      const freshTitle = isPlaceholderTitleText(chatTitle) && !chatId;
      if (freshTitle) setChatTitle(transcript.slice(0, 60));

      // Show what they said now; keep the answer as a typing indicator until its
      // voice is ready, then reveal text + audio together.
      setMessages((m) =>
        m.map((x) => (x.id === userId ? { ...x, pending: false, content: transcript } : x)),
      );
      persistSession(res.chat_id, freshTitle ? transcript.slice(0, 60) : chatTitle);
      await revealWithAudio(placeholderId, res.reply.content, res.reply.id, res.reply.sites);
    } catch (e: any) {
      setMessages((m) => m.filter((x) => !x.pending));
      setError(e?.message ?? strings.errorVoice);
    } finally {
      setBusy(false);
      scroll();
    }
  }, [chatId, chatTitle, deviceId, language, persistSession, recorder, revealWithAudio, scroll, strings.errorNoAudio, strings.errorVoice, strings.voicePlaceholder, strings.voiceTranscriptFallback]);

  // ── WhatsApp push-to-talk gesture ─────────────────────────────────────────
  // Hold the mic to record; release to send; slide sideways to cancel; slide
  // up to lock (hands-free — then the locked bar's trash/send buttons apply).
  const LOCK_DISTANCE = 70;
  const CANCEL_DISTANCE = 90;

  // Snap the mic back instantly (like WhatsApp). A spring here proved
  // unreliable: the values are native-driven and shared by the hero + composer
  // mics, and an in-flight spring can be dropped when one of them unmounts
  // (message sent → empty state gone), leaving the mic big and displaced.
  const resetMicAnim = useCallback(() => {
    micScale.stopAnimation(() => micScale.setValue(1));
    micShiftX.stopAnimation(() => micShiftX.setValue(0));
    micShiftY.stopAnimation(() => micShiftY.setValue(0));
  }, [micScale, micShiftX, micShiftY]);

  // The PanResponder is created once, so it reaches the latest state through
  // this ref — refreshed every render.
  useEffect(() => {
    holdHandlersRef.current = {
      canStart: () => !!deviceId && !busy && !recorder.isRecording,
      start: () => {
        lockedRef.current = false;
        cancelledRef.current = false;
        recStartAtRef.current = Date.now();
        setRecMode('held');
        Animated.spring(micScale, { toValue: 1.45, useNativeDriver: true }).start();
        startRecording();
      },
      move: (dx, dy) => {
        if (lockedRef.current || cancelledRef.current) return;
        // Cancel is an inward slide: left in LTR, right in RTL.
        const cancelDist = isRtl ? Math.max(0, dx) : Math.max(0, -dx);
        micShiftX.setValue(isRtl ? Math.max(0, dx) : Math.min(0, dx));
        micShiftY.setValue(Math.min(0, Math.max(-LOCK_DISTANCE, dy)));
        if (dy < -LOCK_DISTANCE) {
          lockedRef.current = true;
          setRecMode('locked');
          resetMicAnim();
        } else if (cancelDist > CANCEL_DISTANCE) {
          cancelledRef.current = true;
          setRecMode('idle');
          resetMicAnim();
          cancelRecording();
        }
      },
      release: () => {
        if (lockedRef.current || cancelledRef.current) return;
        resetMicAnim();
        setRecMode('idle');
        const heldMs = Date.now() - recStartAtRef.current;
        if (heldMs < 700 || !recorder.isRecording) {
          // Too quick — WhatsApp shows a hint instead of sending a blip.
          cancelledRef.current = true;
          cancelRecording();
          setHint(strings.holdToRecord);
        } else {
          stopRecordingAndSend();
        }
      },
      terminate: () => {
        if (lockedRef.current) return;
        resetMicAnim();
        if (!cancelledRef.current) {
          cancelledRef.current = true;
          setRecMode('idle');
          cancelRecording();
        }
      },
    };
  });

  const micPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => holdHandlersRef.current.canStart(),
      onMoveShouldSetPanResponder: () => false,
      onPanResponderGrant: () => holdHandlersRef.current.start(),
      onPanResponderMove: (_e, g) => holdHandlersRef.current.move(g.dx, g.dy),
      onPanResponderRelease: () => holdHandlersRef.current.release(),
      onPanResponderTerminate: () => holdHandlersRef.current.terminate(),
      onPanResponderTerminationRequest: () => false,
    }),
  ).current;

  // Belt-and-suspenders: whatever path leads back to idle (send, cancel,
  // too-short tap, lock-bar buttons, mic error), the mic MUST end at its
  // resting size and position.
  useEffect(() => {
    if (recMode === 'idle') resetMicAnim();
  }, [recMode, resetMicAnim]);

  // Gentle bounce on the lock hint's chevron while holding.
  useEffect(() => {
    if (recMode !== 'held') {
      lockHintY.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(lockHintY, { toValue: -5, duration: 450, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(lockHintY, { toValue: 0, duration: 450, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [recMode, lockHintY]);

  const renderItem = useCallback(
    ({ item }: { item: Msg }) => (
      <MessageBubble
        item={item}
        isRtl={isRtl}
        readAloudLabel={strings.readAloud}
        directionsLabel={strings.directions}
        onCopy={copyMessage}
        onSpeak={speak}
        onFeedback={handleFeedback}
        onBookmark={handleBookmark}
        onShare={handleShare}
      />
    ),
    [isRtl, strings.readAloud, strings.directions, copyMessage, speak, handleFeedback, handleBookmark, handleShare],
  );

  /** Home (empty chat) — the mockup's Home screen: greeting, quick-question
   *  cards, scan pill and the big amber "tap to speak" button. */
  const empty = useMemo(
    () => (
      <View style={styles.home}>
        <View style={styles.homeGreeting}>
          <Text style={[styles.homeHeadline, isRtl ? styles.rtlCenterless : null]}>{strings.greeting}</Text>
          <Text style={[styles.homeHint, isRtl ? styles.rtlCenterless : null]}>{strings.greetingHint}</Text>
        </View>

        <View style={styles.quickCards}>
          {strings.suggestions.map((q, index) => (
            <Pressable
              key={q}
              onPress={() => sendTextMessage(q)}
              android_ripple={{ color: 'rgba(14,124,102,0.08)' }}
              style={({ pressed }) => [styles.quickCard, isRtl && styles.rowReverse, pressed && { opacity: 0.88 }]}
              accessibilityRole="button"
              accessibilityLabel={q}
              accessibilityHint="Tap to ask this question"
            >
              <View style={styles.quickCardIcon}>
                <Feather name={SUGGESTION_ICONS[index] ?? 'help-circle'} size={22} color={tika.teal} />
              </View>
              <Text style={[styles.quickCardText, isRtl ? styles.rtl : null]} numberOfLines={2}>
                {q}
              </Text>
              <Feather
                name={isRtl ? 'chevron-left' : 'chevron-right'}
                size={16}
                color={tika.inkFaint}
              />
            </Pressable>
          ))}
        </View>

        <Pressable
          onPress={() => navigation.navigate('ScanCard')}
          android_ripple={{ color: 'rgba(14,124,102,0.08)' }}
          style={({ pressed }) => [styles.scanPill, isRtl && styles.rowReverse, pressed && { opacity: 0.85 }]}
          accessibilityRole="button"
          accessibilityLabel={strings.scanCard}
        >
          <Feather name="camera" size={18} color={tika.teal} />
          <Text style={styles.scanPillText}>{strings.scanCard}</Text>
        </Pressable>

        <View style={styles.homeMicWrap}>
          {/* Push-to-talk, same gesture as the composer mic: hold to record,
              release to send, slide sideways to cancel, slide up to lock. */}
          <Animated.View {...micPan.panHandlers} style={{ transform: [{ scale: micScale }] }}>
            <View
              style={styles.homeMic}
              accessible
              accessibilityRole="button"
              accessibilityLabel={strings.tapToSpeak}
            >
              <Feather name="mic" size={32} color="#fff" />
            </View>
          </Animated.View>
          <Text style={styles.homeMicLabel}>{strings.tapToSpeak}</Text>
        </View>
      </View>
    ),
    [isRtl, micPan.panHandlers, micScale, navigation, sendTextMessage, strings.greeting, strings.greetingHint, strings.scanCard, strings.suggestions, strings.tapToSpeak],
  );

  const hasInput = input.trim().length > 0;

  // Normalized 0..1 mic level for the recording wave (metering is dBFS ≤ 0).
  const meterLevel = useMemo(() => {
    const m = recorderState.metering;
    if (typeof m !== 'number' || Number.isNaN(m)) return 0.5;
    return Math.min(1, Math.max(0, (m + 50) / 50));
  }, [recorderState.metering]);

  const recSeconds = Math.floor((recorderState.durationMillis ?? 0) / 1000);
  const recTimer = `${String(Math.floor(recSeconds / 60)).padStart(1, '0')}:${String(recSeconds % 60).padStart(2, '0')}`;

  // Show quick replies after the last assistant message if not busy
  const showQuickReplies = useMemo(() => {
    if (busy || messages.length === 0) return false;
    const lastMsg = messages[messages.length - 1];
    return lastMsg.role === 'assistant' && !lastMsg.pending;
  }, [busy, messages]);

  const handleQuickReply = useCallback((q: string) => {
    sendTextMessage(q);
  }, [sendTextMessage]);

  const quickRepliesFooter = useMemo(
    () =>
      showQuickReplies ? (
        <View style={[styles.quickReplies, isRtl && styles.rowReverse]}>
          {strings.quickReplies.map((q) => (
            <Pressable
              key={q}
              onPress={() => handleQuickReply(q)}
              android_ripple={{ color: 'rgba(14,124,102,0.1)' }}
              style={({ pressed }) => [styles.quickReplyChip, pressed && { opacity: 0.85 }]}
            >
              <Text style={[styles.quickReplyText, isRtl ? styles.rtl : null]} numberOfLines={1}>
                {q}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null,
    [showQuickReplies, strings.quickReplies, isRtl, handleQuickReply]
  );

  const dateChipHeader = useMemo(
    () =>
      messages.length > 0 ? (
        <View style={styles.dateChipWrap}>
          <Text style={styles.dateChipText}>{strings.todayChip}</Text>
        </View>
      ) : null,
    [messages.length, strings.todayChip],
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={tika.card} />

      {/* Header — white bar with the animated mascot (mockup chat header) */}
      <View style={[styles.header, isRtl && styles.rowReverse]}>
        <Pressable
          onPress={() => navigation.navigate('Sessions')}
          android_ripple={{ color: 'rgba(14,124,102,0.12)', borderless: true }}
          style={styles.headerIconBtn}
          accessibilityRole="button"
          accessibilityLabel="Chat history"
        >
          <Feather name="menu" size={20} color={tika.teal} />
        </Pressable>

        <TikaMascot size={34} />

        <View style={styles.headerTitleCol}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {strings.brandTitle}
          </Text>
          <View style={[styles.headerTagRow, isRtl && styles.rowReverse]}>
            <View style={styles.onlineDot} />
            <Text style={styles.headerTag} numberOfLines={1}>
              {strings.helperTag}
            </Text>
          </View>
        </View>

        <View style={styles.headerSpacer} />

        <LanguageSwitcher />

        <Pressable
          onPress={() => {
            setMuted((m) => !m);
            stopSpeaking();
          }}
          android_ripple={{ color: 'rgba(14,124,102,0.12)', borderless: true }}
          style={[styles.headerIconBtn, muted && styles.headerIconBtnMuted]}
          accessibilityRole="button"
          accessibilityLabel={muted ? 'Unmute audio' : 'Mute audio'}
        >
          <Feather name={muted ? 'volume-x' : 'volume-2'} size={19} color={muted ? tika.coral : tika.teal} />
        </Pressable>

        <Pressable
          onPress={startNewChat}
          android_ripple={{ color: 'rgba(14,124,102,0.12)', borderless: true }}
          style={styles.headerIconBtn}
          accessibilityRole="button"
          accessibilityLabel="New chat"
        >
          <Feather name="plus" size={20} color={tika.teal} />
        </Pressable>
      </View>

      {loadingHistory ? (
        <View style={styles.loading}>
          <TypingDots size={8} />
        </View>
      ) : (
        <KeyboardAvoidingView style={styles.flex} behavior="padding" keyboardVerticalOffset={0}>
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            renderItem={renderItem}
            contentContainerStyle={messages.length ? styles.list : styles.listEmpty}
            ListHeaderComponent={dateChipHeader}
            ListEmptyComponent={empty}
            ListFooterComponent={quickRepliesFooter}
            onContentSizeChange={followIfAtBottom}
            onScroll={handleScroll}
            scrollEventThrottle={64}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            initialNumToRender={14}
            maxToRenderPerBatch={10}
            windowSize={11}
          />

          {/* Composer — WhatsApp push-to-talk: hold the amber mic to record
              (release = send, slide sideways = cancel, slide up = lock). The
              locked mode shows the trash/timer/wave/send bar. */}
          <View style={styles.composerWrap}>
            {/* Floating lock hint above the mic while the finger is down */}
            {recMode === 'held' && (
              <View style={[styles.lockPillWrap, isRtl ? styles.lockPillRtl : styles.lockPillLtr]} pointerEvents="none">
                <View style={styles.lockPill}>
                  <Feather name="lock" size={16} color={tika.teal} />
                  <Animated.View style={{ transform: [{ translateY: lockHintY }] }}>
                    <Feather name="chevron-up" size={18} color={tika.inkFaint} />
                  </Animated.View>
                </View>
              </View>
            )}

            {recMode === 'locked' ? (
              <View style={[styles.composer, isRtl && styles.rowReverse]}>
                <Pressable
                  onPress={() => {
                    setRecMode('idle');
                    cancelRecording();
                  }}
                  android_ripple={{ color: 'rgba(229,103,75,0.15)', borderless: true }}
                  style={styles.recCancelBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel recording"
                >
                  <Feather name="trash-2" size={22} color={tika.coral} />
                </Pressable>
                <View style={[styles.recordingBar, isRtl && styles.rowReverse]}>
                  <Animated.View style={[styles.recDot, { opacity: recordingPulse }]} />
                  <Text style={styles.recTimer}>{recTimer}</Text>
                  <RecordingWave level={meterLevel} />
                </View>
                <Pressable
                  onPress={() => {
                    setRecMode('idle');
                    stopRecordingAndSend();
                  }}
                  android_ripple={{ color: 'rgba(255,255,255,0.25)' }}
                  style={({ pressed }) => [styles.recSendBtn, pressed && { opacity: 0.9 }]}
                  accessibilityRole="button"
                  accessibilityLabel="Send voice message"
                >
                  <Feather name="send" size={22} color="#fff" />
                </Pressable>
              </View>
            ) : (
              <View style={[styles.composer, isRtl && styles.rowReverse]}>
                {/* ONE persistent mic view for idle AND held: unmounting the
                    view that captured the pan gesture would fire
                    onPanResponderTerminate and cancel the recording mid-hold.
                    It follows the finger (slide to cancel / lift to lock). */}
                <Animated.View
                  {...micPan.panHandlers}
                  style={{
                    transform: [{ translateX: micShiftX }, { translateY: micShiftY }, { scale: micScale }],
                    zIndex: 2,
                  }}
                >
                  <View
                    style={[styles.micBtn, busy && recMode === 'idle' && { opacity: 0.5 }]}
                    accessible
                    accessibilityRole="button"
                    accessibilityLabel={strings.tapToSpeak}
                  >
                    <Feather name="mic" size={24} color="#fff" />
                  </View>
                </Animated.View>

                {recMode === 'held' ? (
                  <View style={[styles.heldBar, isRtl && styles.rowReverse]}>
                    <Animated.View style={{ opacity: recordingPulse }}>
                      <Feather name="mic" size={20} color={tika.coral} />
                    </Animated.View>
                    <Text style={styles.recTimer}>{recTimer}</Text>
                    <View style={styles.flex} />
                    <Animated.View
                      style={[
                        styles.slideHint,
                        isRtl && styles.rowReverse,
                        { transform: [{ translateX: micShiftX }] },
                      ]}
                    >
                      <Feather name={isRtl ? 'chevron-right' : 'chevron-left'} size={16} color={tika.inkFaint} />
                      <Text style={styles.slideHintText}>{strings.slideToCancel}</Text>
                    </Animated.View>
                  </View>
                ) : (

                <View style={[styles.inputPill, isRtl && styles.rowReverse]}>
                  <Pressable
                    onPress={() => navigation.navigate('ScanCard')}
                    disabled={busy}
                    android_ripple={{ color: 'rgba(14,124,102,0.1)', borderless: true }}
                    style={({ pressed }) => [styles.scanBtn, pressed && { opacity: 0.6 }]}
                    accessibilityRole="button"
                    accessibilityLabel={strings.scanCard}
                  >
                    <Feather name="camera" size={20} color={tika.inkFaint} />
                  </Pressable>
                  <TextInput
                    mode="flat"
                    dense
                    multiline
                    value={input}
                    onChangeText={setInput}
                    placeholder={strings.placeholder}
                    placeholderTextColor={tika.inkFaint}
                    style={styles.input}
                    contentStyle={[styles.inputContent, isRtl ? styles.rtl : null]}
                    underlineStyle={{ display: 'none' }}
                    editable={!busy}
                    cursorColor={tika.teal}
                  />
                  <Pressable
                    onPress={() => sendTextMessage()}
                    disabled={busy || !hasInput}
                    android_ripple={{ color: 'rgba(255,255,255,0.25)' }}
                    style={({ pressed }) => [
                      styles.sendBtn,
                      (!hasInput || busy) && styles.sendBtnIdle,
                      pressed && { opacity: 0.85 },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Send message"
                  >
                    <Feather
                      name="send"
                      size={17}
                      color={hasInput && !busy ? '#fff' : tika.inkFaint}
                      style={isRtl ? styles.flipX : undefined}
                    />
                  </Pressable>
                </View>
                )}
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      )}

      <Snackbar
        visible={!!error}
        onDismiss={() => {
          setError(null);
          setRetryText(null);
        }}
        duration={5000}
        action={
          retryText
            ? {
                label: strings.retry,
                onPress: () => {
                  const t = retryText;
                  setError(null);
                  setRetryText(null);
                  sendTextMessage(t);
                },
              }
            : { label: strings.snackbarClose, onPress: () => setError(null) }
        }
      >
        {error ?? ''}
      </Snackbar>

      <Snackbar visible={copied} onDismiss={() => setCopied(false)} duration={1400}>
        {strings.copied}
      </Snackbar>

      {/* WhatsApp-style "hold to record" toast after a too-short tap */}
      <Snackbar visible={!!hint} onDismiss={() => setHint(null)} duration={1600}>
        {hint ?? ''}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: tika.bg },
  rtl: { writingDirection: 'rtl', textAlign: 'right' },
  rtlCenterless: { writingDirection: 'rtl' },
  rowReverse: { flexDirection: 'row-reverse' },
  flipX: { transform: [{ scaleX: -1 }] },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Header — white with hairline shadow (mockup chat header)
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: tika.card,
    paddingTop: Platform.OS === 'ios' ? 56 : (StatusBar.currentHeight ?? 0) + 12,
    paddingBottom: 12,
    paddingHorizontal: 14,
    shadowColor: tika.shadow,
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
    zIndex: 2,
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: tika.mint,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerIconBtnMuted: {
    backgroundColor: 'rgba(229,103,75,0.12)',
  },
  headerTitleCol: { justifyContent: 'center', flexShrink: 1 },
  headerTitle: {
    color: tika.ink,
    fontSize: 17,
    fontWeight: '800',
  },
  headerTagRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 1 },
  onlineDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: tika.tealBright },
  headerTag: { color: tika.teal, fontSize: 12, fontWeight: '700' },
  headerSpacer: { flex: 1 },

  // List
  list: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 20 },
  listEmpty: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12 },

  // Date chip (mockup "Today")
  dateChipWrap: {
    alignSelf: 'center',
    backgroundColor: 'rgba(11,36,64,0.05)',
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  dateChipText: { fontSize: 12, fontWeight: '700', color: 'rgba(11,36,64,0.45)' },

  // Home (empty state) — the mockup Home screen
  home: { flex: 1 },
  homeGreeting: { marginTop: 8 },
  homeHeadline: {
    color: tika.ink,
    fontSize: 26,
    fontWeight: '800',
    lineHeight: 34,
    letterSpacing: -0.3,
  },
  homeHint: {
    color: tika.inkSoft,
    fontSize: 15,
    marginTop: 6,
    lineHeight: 22,
  },
  quickCards: { gap: 12, marginTop: 22 },
  quickCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: tika.card,
    borderRadius: 20,
    paddingVertical: 15,
    paddingHorizontal: 18,
    minHeight: 48,
    shadowColor: tika.shadow,
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  quickCardIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: tika.mint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickCardText: { flex: 1, fontSize: 16, fontWeight: '700', color: tika.ink, lineHeight: 22 },
  scanPill: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(14,124,102,0.4)',
    borderRadius: 999,
    paddingVertical: 11,
    paddingHorizontal: 20,
    minHeight: 48,
    marginTop: 18,
  },
  scanPillText: { fontSize: 14, fontWeight: '700', color: tika.teal },
  homeMicWrap: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 8, paddingBottom: 8, minHeight: 120 },
  homeMic: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: tika.amber,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: tika.amber,
    shadowOpacity: 0.4,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  homeMicLabel: { fontSize: 13, fontWeight: '700', color: 'rgba(11,36,64,0.55)' },

  // Bubbles (mockup radii: sharp corner on the tail side)
  row: { marginBottom: 14, maxWidth: '100%' },
  rowRight: { alignItems: 'flex-end' },
  rowLeft: { alignItems: 'flex-start' },
  bubbleWrapper: { maxWidth: '85%' },
  bubble: {
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  tailBottomRight: { borderBottomRightRadius: 6 },
  tailBottomLeft: { borderBottomLeftRadius: 6 },
  bubbleUser: {
    backgroundColor: palette.userBubble,
    shadowColor: tika.teal,
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  bubbleBot: {
    backgroundColor: palette.botBubble,
    shadowColor: tika.shadow,
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  bubbleText: { fontSize: 15.5, lineHeight: 23 },
  userContent: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  voiceBadge: { marginTop: 4 },

  // Status pill (mockup's "finding your nearest site…" pill)
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: tika.card,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 16,
    shadowColor: tika.shadow,
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  statusText: { fontSize: 13, fontWeight: '700', color: 'rgba(11,36,64,0.55)', maxWidth: 240 },

  // Under-answer actions: read-aloud pill + icon buttons
  msgActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 2,
  },
  readAloudPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: tika.card,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
    minHeight: 36,
    shadowColor: tika.shadow,
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  readAloudText: { fontSize: 12.5, fontWeight: '800', color: tika.teal },
  actionBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionBtnActive: {
    backgroundColor: tika.mint,
  },

  // Quick replies (follow-up chips)
  quickReplies: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingTop: 2,
    paddingBottom: 8,
  },
  quickReplyChip: {
    backgroundColor: tika.mint,
    borderRadius: 999,
    paddingVertical: 9,
    paddingHorizontal: 16,
    minHeight: 38,
    justifyContent: 'center',
  },
  quickReplyText: { fontSize: 13.5, fontWeight: '700', color: tika.teal },

  // Composer (mockup bottom bar)
  composerWrap: {
    backgroundColor: tika.card,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 26 : 14,
    shadowColor: tika.shadow,
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: -1 },
    elevation: 8,
  },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  micBtn: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: tika.amber,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: tika.amber,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4,
  },
  inputPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: tika.inputPill,
    borderRadius: 27,
    paddingLeft: 6,
    paddingRight: 7,
    paddingVertical: 7,
    minHeight: 54,
  },
  scanBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: 'transparent',
    maxHeight: 120,
    fontSize: 15,
  },
  inputContent: {
    paddingTop: 8,
    paddingBottom: 8,
    paddingHorizontal: 4,
    color: tika.ink,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: tika.teal,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnIdle: {
    backgroundColor: 'rgba(11,36,64,0.06)',
  },

  // WhatsApp push-to-talk: floating lock hint above the mic while holding
  lockPillWrap: {
    position: 'absolute',
    top: -78,
    zIndex: 5,
  },
  lockPillLtr: { left: 18 },
  lockPillRtl: { right: 18 },
  lockPill: {
    width: 46,
    borderRadius: 23,
    backgroundColor: tika.card,
    alignItems: 'center',
    paddingVertical: 12,
    gap: 6,
    shadowColor: tika.shadow,
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },

  // Held (finger-down) bar: red mic + timer + "slide to cancel"
  heldBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: tika.inputPill,
    borderRadius: 27,
    paddingHorizontal: 16,
    minHeight: 54,
  },
  slideHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  slideHintText: { fontSize: 13.5, fontWeight: '600', color: tika.inkFaint },

  // WhatsApp-style recording bar
  recCancelBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordingBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: tika.inputPill,
    borderRadius: 27,
    paddingHorizontal: 16,
    minHeight: 54,
  },
  recDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: tika.coral,
  },
  recTimer: {
    fontSize: 15,
    fontWeight: '800',
    color: tika.ink,
    fontVariant: ['tabular-nums'],
    minWidth: 42,
  },
  recSendBtn: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: tika.teal,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: tika.teal,
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
});
