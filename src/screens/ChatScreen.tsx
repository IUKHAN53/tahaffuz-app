import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  FlatList,
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
  Icon,
  Snackbar,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { LinearGradient } from 'expo-linear-gradient';
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
import { brand, palette } from '../theme';
import { BrandMark } from '../components/BrandMark';
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
  feedback?: FeedbackRating; // User's feedback on this message
  bookmarked?: boolean;
};

type Strings = {
  newChat: string;
  eyebrow: string;
  greeting: string;
  greetingHint: string;
  voicePrompt: string;
  suggestions: string[];
  quickReplies: string[];
  placeholder: string;
  errorLoad: string;
  errorNet: string;
  errorMic: string;
  errorNoAudio: string;
  errorVoice: string;
  voicePlaceholder: string;
  voiceTranscriptFallback: string;
  snackbarClose: string;
  micHint: string;
  micHintStop: string;
  copied: string;
  retry: string;
  helpfulHint: string;
  notHelpfulHint: string;
  saveHint: string;
  offlineNote: string;
};

const COPY: Record<ReplyLanguage, Strings> = {
  en: {
    newChat: 'New chat',
    eyebrow: 'YOUR VACCINE HELPER',
    greeting: 'Hello! How can I help you today?',
    greetingHint: 'I can answer questions about vaccines, cold chain, and immunization.',
    voicePrompt: 'You can also tap the microphone to speak your question!',
    suggestions: [
      'What temperature should vaccines be stored at?',
      'When is the polio vaccine given?',
      'What does the BCG vaccine prevent?',
    ],
    quickReplies: [
      'Tell me more',
      'What are the side effects?',
      'When should this be given?',
    ],
    placeholder: 'Type your question here...',
    errorLoad: 'Could not load chat. Please try again.',
    errorNet: 'No internet connection. Please check and try again.',
    errorMic: 'Could not access microphone. Please allow microphone access.',
    errorNoAudio: 'No audio was recorded. Please try again.',
    errorVoice: 'Could not process voice. Please try typing instead.',
    voicePlaceholder: 'Listening...',
    voiceTranscriptFallback: 'Voice message',
    snackbarClose: 'OK',
    micHint: 'Tap microphone to speak',
    micHintStop: 'Tap to send your voice message',
    copied: 'Answer copied!',
    retry: 'Try Again',
    helpfulHint: 'This helps us improve',
    notHelpfulHint: 'We will do better',
    saveHint: 'Saved for later',
    offlineNote: 'You are offline — showing a saved answer.',
  },
  ur: {
    newChat: 'نیا چیٹ',
    eyebrow: 'آپ کا ویکسین ہیلپر',
    greeting: 'السلام علیکم! میں آج آپ کی کیسے مدد کر سکتا ہوں؟',
    greetingHint: 'میں ویکسین، کولڈ چین، اور حفاظتی ٹیکوں کے بارے میں سوالات کا جواب دے سکتا ہوں۔',
    voicePrompt: 'آپ اپنا سوال بولنے کے لیے مائیکروفون بھی دبا سکتے ہیں!',
    suggestions: [
      'ویکسین کس درجہ حرارت پر رکھنی چاہیے؟',
      'پولیو ویکسین کب لگائی جاتی ہے؟',
      'BCG ویکسین کیا روکتی ہے؟',
    ],
    quickReplies: [
      'مزید بتائیں',
      'اس کے ضمنی اثرات کیا ہیں؟',
      'یہ کب دینی چاہیے؟',
    ],
    placeholder: 'اپنا سوال یہاں لکھیں...',
    errorLoad: 'چیٹ لوڈ نہیں ہو سکی۔ براہ کرم دوبارہ کوشش کریں۔',
    errorNet: 'انٹرنیٹ کنکشن نہیں۔ براہ کرم چیک کریں اور دوبارہ کوشش کریں۔',
    errorMic: 'مائیکروفون استعمال نہیں ہو سکا۔ براہ کرم اجازت دیں۔',
    errorNoAudio: 'کوئی آڈیو ریکارڈ نہیں ہوئی۔ براہ کرم دوبارہ کوشش کریں۔',
    errorVoice: 'آواز پروسیس نہیں ہو سکی۔ براہ کرم لکھ کر بھیجیں۔',
    voicePlaceholder: 'سن رہا ہوں...',
    voiceTranscriptFallback: 'آواز کا پیغام',
    snackbarClose: 'ٹھیک ہے',
    micHint: 'بولنے کے لیے مائیکروفون دبائیں',
    micHintStop: 'آواز بھیجنے کے لیے دبائیں',
    copied: 'جواب کاپی ہو گیا!',
    retry: 'دوبارہ کوشش',
    helpfulHint: 'اس سے ہمیں بہتر ہونے میں مدد ملتی ہے',
    notHelpfulHint: 'ہم بہتر کریں گے',
    saveHint: 'بعد میں کے لیے محفوظ',
    offlineNote: 'آپ آف لائن ہیں — محفوظ شدہ جواب دکھایا جا رہا ہے۔',
  },
  fa: {
    newChat: 'گفتگوی جدید',
    eyebrow: 'دستیار واکسن شما',
    greeting: 'سلام! امروز چطور می‌توانم کمکتان کنم؟',
    greetingHint: 'می‌توانم به پرسش‌های شما درباره واکسن، زنجیره سرد و واکسیناسیون پاسخ دهم.',
    voicePrompt: 'برای گفتن پرسش‌تان می‌توانید میکروفون را هم لمس کنید!',
    suggestions: [
      'واکسن در چه دمایی باید نگهداری شود؟',
      'واکسن فلج اطفال چه زمانی داده می‌شود؟',
      'واکسن ب‌ث‌ژ از چه بیماری جلوگیری می‌کند؟',
    ],
    quickReplies: [
      'بیشتر توضیح دهید',
      'عوارض آن چیست؟',
      'چه زمانی باید داده شود؟',
    ],
    placeholder: 'پرسش خود را اینجا بنویسید...',
    errorLoad: 'گفتگو بارگذاری نشد. لطفاً دوباره تلاش کنید.',
    errorNet: 'اتصال اینترنت نیست. لطفاً بررسی کنید و دوباره تلاش کنید.',
    errorMic: 'دسترسی به میکروفون ممکن نشد. لطفاً اجازه دهید.',
    errorNoAudio: 'هیچ صدایی ضبط نشد. لطفاً دوباره تلاش کنید.',
    errorVoice: 'پردازش صدا ممکن نشد. لطفاً تایپ کنید.',
    voicePlaceholder: 'در حال شنیدن...',
    voiceTranscriptFallback: 'پیام صوتی',
    snackbarClose: 'باشه',
    micHint: 'برای صحبت میکروفون را لمس کنید',
    micHintStop: 'برای ارسال صدا لمس کنید',
    copied: 'پاسخ کپی شد!',
    retry: 'تلاش دوباره',
    helpfulHint: 'این به بهتر شدن ما کمک می‌کند',
    notHelpfulHint: 'بهتر خواهیم کرد',
    saveHint: 'برای بعد ذخیره شد',
    offlineNote: 'شما آفلاین هستید — پاسخ ذخیره‌شده نمایش داده می‌شود.',
  },
  ps: {
    newChat: 'نوې خبرې',
    eyebrow: 'ستاسو واکسین مرستندویه',
    greeting: 'سلام! نن ورځ زه څنګه مرسته کولی شم؟',
    greetingHint: 'زه د واکسینونو، کولډ چین، او واکسینیشن په اړه پوښتنو ته ځواب ورکولی شم.',
    voicePrompt: 'تاسو کولی شئ خپله پوښتنه ووایاست - مایکروفون ټچ کړئ!',
    suggestions: [
      'واکسین په کومه تودوخه کې ساتل شي؟',
      'د پولیو واکسین کله ورکول کیږي؟',
      'BCG واکسین څه مخنیوی کوي؟',
    ],
    quickReplies: [
      'نور راته ووایاست',
      'د دې اغیزې څه دي؟',
      'دا کله باید ورکړل شي؟',
    ],
    placeholder: 'خپله پوښتنه دلته ولیکئ...',
    errorLoad: 'خبرې نه لوډ شوې۔ بیا هڅه وکړئ.',
    errorNet: 'انټرنیټ نشته۔ وګورئ او بیا هڅه وکړئ.',
    errorMic: 'مایکروفون نه کار کوي۔ اجازه ورکړئ.',
    errorNoAudio: 'آډیو ریکارډ نه شو۔ بیا هڅه وکړئ.',
    errorVoice: 'غږ پروسس نه شو۔ لیکلی پوښتنه وکړئ.',
    voicePlaceholder: 'اورم...',
    voiceTranscriptFallback: 'غږیز پیغام',
    snackbarClose: 'سمه ده',
    micHint: 'د ویلو لپاره مایکروفون ټچ کړئ',
    micHintStop: 'غږ لیږلو لپاره ټچ کړئ',
    copied: 'ځواب کاپي شو!',
    retry: 'بیا هڅه وکړئ',
    helpfulHint: 'دا موږ سره مرسته کوي',
    notHelpfulHint: 'موږ به ښه کړو',
    saveHint: 'د وروسته لپاره خوندي شو',
    offlineNote: 'تاسو آفلاین یاست — خوندي شوی ځواب ښودل کیږي.',
  },
  sd: {
    newChat: 'نئين چيٽ',
    eyebrow: 'توهان جو ويڪسين هيلپر',
    greeting: 'السلام عليڪم! اڄ مان توهان جي ڪيئن مدد ڪري سگهان ٿو؟',
    greetingHint: 'مان ويڪسين، ڪولڊ چين، ۽ واڪسينيشن بابت سوالن جا جواب ڏئي سگهان ٿو.',
    voicePrompt: 'توهان پنهنجو سوال ٻولڻ لاءِ مائڪ به دٻائي سگهو ٿا!',
    suggestions: [
      'ويڪسين ڪهڙي درجي حرارت تي رکڻ گهرجي؟',
      'پوليو ويڪسين ڪڏهن ڏني ويندي آهي؟',
      'BCG ويڪسين ڇا روڪيندي آهي؟',
    ],
    quickReplies: [
      'وڌيڪ ٻڌايو',
      'هن جا ضمني اثر ڇا آهن؟',
      'هي ڪڏهن ڏني وڃي؟',
    ],
    placeholder: 'پنهنجو سوال هتي لکو...',
    errorLoad: 'چيٽ لوڊ نه ٿي سگهي۔ ٻيهر ڪوشش ڪريو.',
    errorNet: 'انٽرنيٽ ڪنيڪشن نه آهي۔ چيڪ ڪريو ۽ ٻيهر ڪوشش ڪريو.',
    errorMic: 'مائڪ استعمال نه ٿي سگهيو۔ اجازت ڏيو.',
    errorNoAudio: 'ڪا آڊيو رڪارڊ نه ٿي۔ ٻيهر ڪوشش ڪريو.',
    errorVoice: 'آواز پروسيس نه ٿي سگهي۔ لکي موڪليو.',
    voicePlaceholder: 'ٻڌي رهيو آهيان...',
    voiceTranscriptFallback: 'آواز جو پيغام',
    snackbarClose: 'ٺيڪ آهي',
    micHint: 'ٻولڻ لاءِ مائڪ دٻايو',
    micHintStop: 'آواز موڪلڻ لاءِ دٻايو',
    copied: 'جواب ڪاپي ٿي ويو!',
    retry: 'ٻيهر ڪوشش',
    helpfulHint: 'اهو اسان کي بهتر ٿيڻ ۾ مدد ڪري ٿو',
    notHelpfulHint: 'اسان بهتر ڪنداسين',
    saveHint: 'پوءِ لاءِ محفوظ',
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
 * Choose the voice language from the answer's OWN script, not the app's UI
 * language. A Pashto/Urdu answer must be read with that language's voice — using
 * the English voice (the app setting) makes it skip the Arabic script and read
 * only the stray Latin words. Latin text falls back to the app preference
 * (English vs Roman Urdu).
 */
function ttsLangForText(text: string, appLang: ReplyLanguage): ReplyLanguage {
  if (/[ټډړږښځڅېګڼ]/.test(text)) return 'ps';
  if (/[ڳڻڪھڀٺٽ۾]/.test(text)) return 'sd';
  // Farsi and Urdu share the Arabic script and can't be told apart by letters,
  // so for Arabic-script text trust the selected language (fa vs ur).
  if (/[؀-ۿ]/.test(text)) return appLang === 'fa' ? 'fa' : 'ur';
  return 'en';
}

const isPlaceholderTitleText = (t: string) =>
  t === COPY.en.newChat || t === COPY.ur.newChat || t === COPY.fa.newChat ||
  t === COPY.ps.newChat || t === COPY.sd.newChat;

// Markdown styles for bot messages (LTR)
const mdStylesBot = {
  body: { color: palette.botBubbleText, fontSize: 16, lineHeight: 25 },
  paragraph: { marginTop: 0, marginBottom: 10 },
  heading1: { fontSize: 19, fontWeight: '700' as const, marginBottom: 10, marginTop: 4, color: brand.ink },
  heading2: { fontSize: 17, fontWeight: '700' as const, marginBottom: 8, marginTop: 2, color: brand.ink },
  heading3: { fontSize: 16, fontWeight: '600' as const, marginBottom: 6, color: brand.ink },
  bullet_list: { marginBottom: 10, marginTop: 4 },
  ordered_list: { marginBottom: 10, marginTop: 4 },
  list_item: { marginBottom: 6 },
  strong: { fontWeight: '700' as const, color: brand.ink },
  em: { fontStyle: 'italic' as const },
  code_inline: { backgroundColor: 'rgba(7,32,63,0.07)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 14 },
  fence: { backgroundColor: 'rgba(7,32,63,0.05)', padding: 12, borderRadius: 10, marginVertical: 10 },
  code_block: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 14 },
  blockquote: { borderLeftWidth: 3, borderLeftColor: brand.amber, paddingLeft: 12, marginVertical: 10, opacity: 0.95 },
};

// Markdown styles for bot messages (RTL - Urdu, Pashto, Sindhi)
const mdStylesBotRtl = {
  ...mdStylesBot,
  body: { ...mdStylesBot.body, writingDirection: 'rtl' as const, textAlign: 'right' as const },
  paragraph: { ...mdStylesBot.paragraph, writingDirection: 'rtl' as const, textAlign: 'right' as const },
  list_item: { ...mdStylesBot.list_item, writingDirection: 'rtl' as const },
  blockquote: { ...mdStylesBot.blockquote, borderLeftWidth: 0, borderRightWidth: 3, borderRightColor: brand.amber, paddingLeft: 0, paddingRight: 12 },
};

/** A single chat bubble — memoized so streaming only re-renders the live message. */
const MessageBubble = memo(function MessageBubble({
  item,
  isRtl,
  onCopy,
  onSpeak,
  onFeedback,
  onBookmark,
  onShare,
}: {
  item: Msg;
  isRtl: boolean;
  onCopy: (text: string) => void;
  onSpeak: (text: string) => void;
  onFeedback: (msg: Msg, rating: FeedbackRating) => void;
  onBookmark: (msg: Msg) => void;
  onShare: (text: string) => void;
}) {
  const isUser = item.role === 'user';
  const canPlay = !item.pending && item.content.trim().length > 0;
  const canInteract = !item.pending && item.serverId && !isUser;

  return (
    <View style={[styles.row, isUser ? styles.rowRight : styles.rowLeft]}>
      {!isUser && (
        <View style={styles.botAvatar}>
          <BrandMark size={20} />
        </View>
      )}
      <View style={[styles.bubbleWrapper, isUser && styles.bubbleWrapperUser]}>
        <View style={[styles.bubbleRow, isUser && styles.bubbleRowUser]}>
          {/* Play button on the left for bot messages */}
          {!isUser && canPlay && (
            <Pressable
              onPress={() => onSpeak(item.content)}
              android_ripple={{ color: 'rgba(7,32,63,0.12)' }}
              style={({ pressed }) => [styles.playBtnInline, styles.playBtnBot, pressed && { opacity: 0.7 }]}
            >
              <Icon source="volume-high" size={18} color={brand.indigo} />
            </Pressable>
          )}
          <Pressable
            onLongPress={() => onCopy(item.content)}
            delayLongPress={320}
            android_ripple={{ color: 'rgba(7,32,63,0.06)' }}
            style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleBot]}
          >
            {item.pending && item.content === '' ? (
              <View style={styles.pendingRow}>
                <TypingDots size={6} color={brand.amber} />
              </View>
            ) : isUser ? (
              <Text
                selectable
                style={[
                  styles.bubbleText,
                  { color: palette.userBubbleText },
                  isRtl ? styles.rtl : null,
                ]}
              >
                {item.content}
              </Text>
            ) : (
              <Markdown style={isRtl ? mdStylesBotRtl : mdStylesBot}>{item.content}</Markdown>
            )}
          </Pressable>
          {/* Play button on the right for user messages */}
          {isUser && canPlay && (
            <Pressable
              onPress={() => onSpeak(item.content)}
              android_ripple={{ color: 'rgba(244,238,227,0.25)' }}
              style={({ pressed }) => [styles.playBtnInline, styles.playBtnUser, pressed && { opacity: 0.7 }]}
            >
              <Icon source="volume-high" size={18} color={brand.cream} />
            </Pressable>
          )}
        </View>
        {/* Feedback & Bookmark actions for assistant messages */}
        {canInteract && (
          <View style={styles.msgActions}>
            <Pressable
              onPress={() => onFeedback(item, 'up')}
              style={({ pressed }) => [
                styles.actionBtn,
                item.feedback === 'up' && styles.actionBtnActive,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Icon
                source={item.feedback === 'up' ? 'thumb-up' : 'thumb-up-outline'}
                size={16}
                color={item.feedback === 'up' ? brand.indigo : 'rgba(7,32,63,0.5)'}
              />
            </Pressable>
            <Pressable
              onPress={() => onFeedback(item, 'down')}
              style={({ pressed }) => [
                styles.actionBtn,
                item.feedback === 'down' && styles.actionBtnActive,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Icon
                source={item.feedback === 'down' ? 'thumb-down' : 'thumb-down-outline'}
                size={16}
                color={item.feedback === 'down' ? '#B3261E' : 'rgba(7,32,63,0.5)'}
              />
            </Pressable>
            <Pressable
              onPress={() => onBookmark(item)}
              style={({ pressed }) => [
                styles.actionBtn,
                item.bookmarked && styles.actionBtnActive,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Icon
                source={item.bookmarked ? 'bookmark' : 'bookmark-outline'}
                size={16}
                color={item.bookmarked ? brand.amber : 'rgba(7,32,63,0.5)'}
              />
            </Pressable>
            <Pressable
              onPress={() => onShare(item.content)}
              style={({ pressed }) => [
                styles.actionBtn,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Icon source="share-variant-outline" size={16} color="rgba(7,32,63,0.5)" />
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
});

export default function ChatScreen({ route, navigation }: Props) {
  const theme = useTheme();
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

  const listRef = useRef<FlatList<Msg>>(null);
  const messagesRef = useRef<Msg[]>([]);
  // Captured once per session; sent with messages so the assistant can answer
  // "where is my nearest site?". Null until granted/fixed (sent omitted then).
  const locationRef = useRef<LatLng | null>(null);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);
  // Plays the server's natural Gemini TTS (reliable for ur/en/rud, where the
  // on-device voice is often missing). Pashto/Sindhi fall back to on-device.
  const ttsPlayer = useAudioPlayer(null);
  const recordingPulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Keep a local stash of popular Q&A pairs so common questions still get an
  // answer when the device has no connection. Never throws.
  useEffect(() => {
    refreshQuickAnswersCache(language);
  }, [language]);

  useEffect(() => {
    if (recorderState.isRecording) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(recordingPulse, { toValue: 1.14, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
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
   * Read an answer aloud. Primary path is the server's natural Gemini voice
   * (reliable across devices); if synthesis is unavailable — a server/quota
   * failure, offline, or an unsupported language like Pashto/Sindhi — we fall
   * back to the on-device voice. Markdown is stripped either way.
   */
  const speak = useCallback(
    async (text: string) => {
      if (muted || !text.trim()) return;
      stopSpeaking();
      const clean = stripMarkdownForSpeech(text);
      if (!clean) return;

      // Voice follows the answer's own language, not the app's UI language.
      // All languages are served now: en/ur/rud/ps via Edge, sd via OpenAI.
      // On any server failure the catch below falls back to the on-device voice.
      const ttsLang = ttsLangForText(clean, language);

      const url = ttsUrl(clean, ttsLang);
      try {
        // Validate synthesis before handing the URL to the player, so a failure
        // cleanly falls back instead of playing silence. The backend caches the
        // WAV, so the player's fetch is cheap.
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
    (placeholderId: string, content: string, serverId?: number): Promise<void> => {
      const reveal = () =>
        setMessages((m) =>
          m.map((x) => (x.id === placeholderId ? { ...x, pending: false, content, serverId } : x)),
        );

      if (muted || !content.trim()) {
        reveal();
        return Promise.resolve();
      }

      const clean = stripMarkdownForSpeech(content);
      const ttsLang = ttsLangForText(clean, language);
      const url = ttsUrl(clean, ttsLang);

      return Promise.race<string | null>([
        fetch(url)
          .then((r) => (r.ok ? url : null))
          .catch(() => null),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000)),
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
      const placeholder: Msg = { id: placeholderId, role: 'assistant', content: '', pending: true };
      setMessages((m) => [...m, userMsg, placeholder]);
      setBusy(true);

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
            onDelta: () => {
              sawDelta = true;
            },
          },
        );
        setChatId(res.chat_id);
        persistSession(res.chat_id, titleForCache);
        await revealWithAudio(placeholderId, res.reply.content, res.reply.id);
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
            await revealWithAudio(placeholderId, res.reply.content, res.reply.id);
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
    if (!deviceId || busy || recorderState.isRecording) return;
    setError(null);
    try {
      // Re-enable the recording session (playback may have switched it off).
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch (e: any) {
      setError(e?.message ?? strings.errorMic);
    }
  }, [busy, deviceId, recorder, recorderState.isRecording, strings.errorMic]);

  const stopRecordingAndSend = useCallback(async () => {
    if (!deviceId || !recorderState.isRecording) return;
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
        { id: userId, role: 'user', content: strings.voicePlaceholder, pending: true },
        { id: placeholderId, role: 'assistant', content: '', pending: true },
      ]);
      scroll();

      const res = await sendAudio({ deviceId, audioUri: uri, audioMime: 'audio/m4a', chatId, language, location: locationRef.current });
      setChatId(res.chat_id);
      const transcript = res.transcript?.trim() || strings.voiceTranscriptFallback;
      const freshTitle = isPlaceholderTitleText(chatTitle) && !chatId;
      if (freshTitle) setChatTitle(transcript.slice(0, 60));

      // Show what they said now; keep the answer as a typing indicator until its
      // voice is ready, then reveal text + audio together.
      setMessages((m) =>
        m.map((x) => (x.id === userId ? { ...x, pending: false, content: transcript } : x)),
      );
      persistSession(res.chat_id, freshTitle ? transcript.slice(0, 60) : chatTitle);
      await revealWithAudio(placeholderId, res.reply.content, res.reply.id);
    } catch (e: any) {
      setMessages((m) => m.filter((x) => !x.pending));
      setError(e?.message ?? strings.errorVoice);
    } finally {
      setBusy(false);
      scroll();
    }
  }, [chatId, chatTitle, deviceId, language, persistSession, recorder, recorderState.isRecording, revealWithAudio, scroll, strings.errorNoAudio, strings.errorVoice, strings.voicePlaceholder, strings.voiceTranscriptFallback]);

  const toggleRecording = useCallback(() => {
    if (recorderState.isRecording) {
      stopRecordingAndSend();
    } else {
      startRecording();
    }
  }, [recorderState.isRecording, startRecording, stopRecordingAndSend]);

  const renderItem = useCallback(
    ({ item }: { item: Msg }) => (
      <MessageBubble
        item={item}
        isRtl={isRtl}
        onCopy={copyMessage}
        onSpeak={speak}
        onFeedback={handleFeedback}
        onBookmark={handleBookmark}
        onShare={handleShare}
      />
    ),
    [isRtl, copyMessage, speak, handleFeedback, handleBookmark, handleShare],
  );

  const empty = useMemo(
    () => (
      <View style={styles.emptyChat}>
        <View style={styles.emptyMarkRing}>
          <BrandMark size={72} />
        </View>
        <Text style={styles.eyebrow}>{strings.eyebrow}</Text>
        <Text style={[styles.emptyHeadline, isRtl ? styles.rtl : null]}>{strings.greeting}</Text>
        <Text style={[styles.emptyHint, isRtl ? styles.rtl : null]}>{strings.greetingHint}</Text>

        {/* Voice prompt with mic icon */}
        <View style={styles.voicePromptContainer}>
          <Text style={styles.voicePromptIcon}>🎤</Text>
          <Text style={[styles.voicePromptText, isRtl ? styles.rtl : null]}>{strings.voicePrompt}</Text>
        </View>

        <Text style={[styles.suggestionsLabel, isRtl ? styles.rtl : null]}>
          {language === 'en' ? 'Try asking:' : language === 'ur' ? 'یہ پوچھیں:' : language === 'fa' ? 'این‌ها را بپرسید:' : language === 'ps' ? 'دا وپوښتئ:' : 'هي پڇو:'}
        </Text>
        <View style={styles.suggestions}>
          {strings.suggestions.map((q, index) => (
            <Pressable
              key={q}
              onPress={() => {
                setInput(q);
                // Auto-send after setting input
                setTimeout(() => sendTextMessage(q), 150);
              }}
              android_ripple={{ color: 'rgba(7,32,63,0.08)' }}
              style={({ pressed }) => [styles.suggestionCard, pressed && { opacity: 0.85 }]}
              accessibilityRole="button"
              accessibilityLabel={q}
              accessibilityHint="Tap to ask this question"
            >
              <View style={[styles.suggestionNumber, { backgroundColor: index === 0 ? brand.amber : index === 1 ? brand.indigo : brand.indigoSoft }]}>
                <Text style={styles.suggestionNumberText}>{index + 1}</Text>
              </View>
              <Text style={[styles.suggestionText, isRtl ? styles.rtl : null]} numberOfLines={2}>
                {q}
              </Text>
              <Text style={styles.suggestionArrow}>→</Text>
            </Pressable>
          ))}
        </View>
      </View>
    ),
    [isRtl, language, sendTextMessage, strings.eyebrow, strings.greeting, strings.greetingHint, strings.suggestions, strings.voicePrompt],
  );

  const hasInput = input.trim().length > 0;

  // Show quick replies after the last assistant message if not busy
  const showQuickReplies = useMemo(() => {
    if (busy || messages.length === 0) return false;
    const lastMsg = messages[messages.length - 1];
    return lastMsg.role === 'assistant' && !lastMsg.pending;
  }, [busy, messages]);

  const handleQuickReply = useCallback((q: string) => {
    setInput(q);
    // Auto-send after a short delay
    setTimeout(() => sendTextMessage(q), 100);
  }, [sendTextMessage]);

  const quickRepliesFooter = useMemo(
    () =>
      showQuickReplies ? (
        <View style={styles.quickReplies}>
          {strings.quickReplies.map((q) => (
            <Pressable
              key={q}
              onPress={() => handleQuickReply(q)}
              android_ripple={{ color: 'rgba(7,32,63,0.08)' }}
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
            onPress={() => navigation.navigate('Sessions')}
            android_ripple={{ color: 'rgba(244,238,227,0.2)', borderless: true }}
            style={styles.headerIconBtn}
            accessibilityRole="button"
            accessibilityLabel="Chat history"
          >
            <Icon source="menu" size={26} color={brand.cream} />
          </Pressable>
          <View style={styles.headerCenter}>
            <View style={styles.headerBrand}>
              <BrandMark size={22} />
              <Text style={styles.headerBrandText}>Tika Dost</Text>
            </View>
          </View>
          <View style={styles.headerActions}>
            <LanguageSwitcher />
            <Pressable
              onPress={() => navigation.navigate('ScanCard')}
              android_ripple={{ color: 'rgba(244,238,227,0.2)', borderless: true }}
              style={styles.headerIconBtn}
              accessibilityRole="button"
              accessibilityLabel="Scan vaccination card"
            >
              <Icon source="card-account-details-outline" size={22} color={brand.cream} />
            </Pressable>
            <Pressable
              onPress={startNewChat}
              android_ripple={{ color: 'rgba(244,238,227,0.2)', borderless: true }}
              style={styles.headerIconBtn}
              accessibilityRole="button"
              accessibilityLabel="New chat"
            >
              <Icon source="plus" size={24} color={brand.cream} />
            </Pressable>
            <Pressable
              onPress={() => {
                setMuted((m) => !m);
                stopSpeaking();
              }}
              android_ripple={{ color: 'rgba(244,238,227,0.2)', borderless: true }}
              style={[styles.headerMuteBtn, muted && styles.headerMuteBtnActive]}
              accessibilityRole="button"
              accessibilityLabel={muted ? 'Unmute audio' : 'Mute audio'}
            >
              <Text style={styles.headerMuteIcon}>{muted ? '🔇' : '🔊'}</Text>
            </Pressable>
          </View>
        </View>
      </LinearGradient>

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

          <View style={styles.composerWrap}>
            <View style={styles.composer}>
              <TextInput
                mode="flat"
                dense
                multiline
                value={input}
                onChangeText={setInput}
                placeholder={strings.placeholder}
                placeholderTextColor="rgba(7,32,63,0.42)"
                style={styles.input}
                contentStyle={[styles.inputContent, isRtl ? styles.rtl : null]}
                underlineStyle={{ display: 'none' }}
                editable={!busy}
                cursorColor={brand.indigo}
              />

              {hasInput ? (
                <Pressable
                  onPress={() => sendTextMessage()}
                  disabled={busy}
                  android_ripple={{ color: 'rgba(244,238,227,0.25)' }}
                  style={({ pressed }) => [
                    styles.sendBtn,
                    busy && { opacity: 0.5 },
                    pressed && { opacity: 0.85 },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Send message"
                >
                  <Icon source="arrow-up" size={24} color={brand.cream} />
                </Pressable>
              ) : (
                <Animated.View style={{ transform: [{ scale: recordingPulse }] }}>
                  <Pressable
                    onPress={toggleRecording}
                    disabled={busy && !recorderState.isRecording}
                    android_ripple={{ color: recorderState.isRecording ? 'rgba(255,255,255,0.25)' : 'rgba(224,162,74,0.25)' }}
                    style={({ pressed }) => [
                      styles.micBtn,
                      recorderState.isRecording && styles.micBtnActive,
                      pressed && { opacity: 0.9 },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={recorderState.isRecording ? 'Stop recording and send' : 'Record voice message'}
                  >
                    <Text style={styles.micBtnIcon}>
                      {recorderState.isRecording ? '⬛' : '🎤'}
                    </Text>
                  </Pressable>
                </Animated.View>
              )}
            </View>
            {/* Voice recording hint with better visual feedback */}
            <View style={styles.composerHintRow}>
              {recorderState.isRecording ? (
                <>
                  <View style={styles.recordingIndicator} />
                  <Text style={styles.composerHintRecording}>{strings.micHintStop}</Text>
                </>
              ) : (
                <Text style={styles.composerHint}>{strings.micHint}</Text>
              )}
            </View>
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
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1 },
  rtl: { writingDirection: 'rtl', textAlign: 'right' },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Header - clean and simple
  header: {
    paddingTop: Platform.OS === 'ios' ? 56 : (StatusBar.currentHeight ?? 0) + 12,
    paddingBottom: 18,
    paddingHorizontal: 16,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(244,238,227,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerCenter: { flex: 1, alignItems: 'flex-start', paddingLeft: 4 },
  headerBrand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerBrandText: {
    color: brand.cream,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  headerMuteBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(244,238,227,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerMuteBtnActive: {
    backgroundColor: 'rgba(179,38,30,0.3)',
  },
  headerMuteIcon: {
    fontSize: 20,
  },

  // List - improved padding
  list: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 20 },
  listEmpty: { flex: 1, justifyContent: 'center', paddingHorizontal: 28, paddingBottom: 40 },

  // Empty state - cleaner visual hierarchy
  emptyChat: { alignItems: 'center', gap: 12 },
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
    marginBottom: 8,
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
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    maxWidth: 300,
  },
  voicePromptContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 16,
    backgroundColor: 'rgba(224,162,74,0.12)',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 24,
  },
  voicePromptIcon: {
    fontSize: 18,
  },
  voicePromptText: {
    color: brand.ink,
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  suggestionsLabel: {
    color: brand.indigoSoft,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginTop: 24,
    marginBottom: 4,
    alignSelf: 'flex-start',
  },
  suggestions: { gap: 10, marginTop: 8, alignSelf: 'stretch' },
  suggestionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 18,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    shadowColor: brand.ink,
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  suggestionNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  suggestionNumberText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  suggestionText: { flex: 1, color: brand.ink, fontSize: 16, lineHeight: 22 },
  suggestionArrow: {
    color: brand.amber,
    fontSize: 18,
    fontWeight: '600',
  },

  // Quick Replies - more refined
  quickReplies: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
  },
  quickReplyChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    shadowColor: brand.ink,
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  quickReplyText: {
    color: brand.indigo,
    fontSize: 14,
    fontWeight: '600',
  },

  // Bubbles - better shadows and spacing
  row: { marginVertical: 6, flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  rowLeft: { justifyContent: 'flex-start' },
  rowRight: { justifyContent: 'flex-end' },
  botAvatar: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: brand.ink,
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  bubble: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
  },
  bubbleUser: {
    backgroundColor: brand.ink,
    borderBottomRightRadius: 6,
    shadowColor: brand.ink,
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  bubbleBot: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 6,
    shadowColor: brand.ink,
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  bubbleText: { fontSize: 16, lineHeight: 24 },
  pendingRow: { paddingVertical: 6 },
  bubbleWrapper: { maxWidth: '82%' },
  bubbleWrapperUser: { alignItems: 'flex-end' },
  bubbleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  bubbleRowUser: { flexDirection: 'row-reverse' },
  playBtnInline: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 3,
  },
  playBtnBot: {
    backgroundColor: 'rgba(7,32,63,0.06)',
  },
  playBtnUser: {
    backgroundColor: 'rgba(244,238,227,0.18)',
  },

  // Message actions (feedback + bookmark) - better alignment
  msgActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    marginLeft: 42, // align with bubble (play button width + gap)
  },
  actionBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(7,32,63,0.04)',
  },
  actionBtnActive: {
    backgroundColor: 'rgba(7,32,63,0.1)',
  },

  // Composer - elevated and polished
  composerWrap: {
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === 'ios' ? 28 : 16,
    paddingTop: 12,
    backgroundColor: 'transparent',
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    paddingLeft: 8,
    paddingRight: 8,
    paddingVertical: 8,
    gap: 8,
    shadowColor: brand.ink,
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    backgroundColor: 'transparent',
    fontSize: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  inputContent: { color: brand.ink },

  micBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(224,162,74,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2.5,
    borderColor: brand.amber,
  },
  micBtnActive: {
    backgroundColor: '#B3261E',
    borderColor: '#B3261E',
  },
  micBtnIcon: {
    fontSize: 24,
  },
  sendBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: brand.ink,
    justifyContent: 'center',
    alignItems: 'center',
  },

  composerHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 10,
  },
  composerHint: {
    color: brand.indigoSoft,
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
  composerHintRecording: {
    color: '#B3261E',
    fontSize: 14,
    fontWeight: '600',
  },
  recordingIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#B3261E',
  },
});
