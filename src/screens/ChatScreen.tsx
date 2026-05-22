import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  FlatList,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  View,
} from 'react-native';
import {
  Icon,
  IconButton,
  Menu,
  Snackbar,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { LinearGradient } from 'expo-linear-gradient';
import * as Speech from 'expo-speech';
import * as Clipboard from 'expo-clipboard';
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { getChat, sendAudio, sendText, sendTextStream, type ReplyLanguage } from '../api';
import { getDeviceId } from '../deviceId';
import { upsertSession } from '../sessions';
import { useLanguage } from '../language';
import { brand, palette } from '../theme';
import { BrandMark } from '../components/BrandMark';
import { TypingDots } from '../components/TypingDots';
import type { RootStackParamList } from '../navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Chat'>;

type Msg = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  pending?: boolean;
};

type Strings = {
  newChat: string;
  eyebrow: string;
  greeting: string;
  greetingHint: string;
  suggestions: string[];
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
};

const COPY: Record<ReplyLanguage, Strings> = {
  en: {
    newChat: 'New chat',
    eyebrow: 'TRAINING ASSISTANT',
    greeting: 'How can I help today?',
    greetingHint: 'Ask anything about vaccines, cold chain, or immunization sessions.',
    suggestions: [
      'What temperature should the cold chain be?',
      'When is the polio vaccine given?',
      'What does the BCG vaccine prevent?',
    ],
    placeholder: 'Ask a question…',
    errorLoad: 'Failed to load',
    errorNet: 'Network error',
    errorMic: 'Microphone failed',
    errorNoAudio: 'No audio recorded',
    errorVoice: 'Voice request failed',
    voicePlaceholder: 'Voice message…',
    voiceTranscriptFallback: 'Voice message',
    snackbarClose: 'Close',
    micHint: 'Tap to record',
    micHintStop: 'Tap to stop',
    copied: 'Answer copied',
    retry: 'Retry',
  },
  ur: {
    newChat: 'نیا چیٹ',
    eyebrow: 'تربیتی معاون',
    greeting: 'آج میں کیسے مدد کر سکتا ہوں؟',
    greetingHint: 'ویکسی نیشن، کولڈ چین، یا حفاظتی ٹیکوں کے سیشن سے متعلق سوال پوچھیں۔',
    suggestions: [
      'کولڈ چین کا درجہ حرارت کتنا ہونا چاہیے؟',
      'پولیو ویکسین کب لگائی جاتی ہے؟',
      'BCG ویکسین کیا روکتی ہے؟',
    ],
    placeholder: 'سوال یہاں لکھیں…',
    errorLoad: 'لوڈ ناکام',
    errorNet: 'نیٹ ورک کی خرابی',
    errorMic: 'مائیک ناکام',
    errorNoAudio: 'کوئی آڈیو ریکارڈ نہیں ہوئی',
    errorVoice: 'آواز کی درخواست ناکام',
    voicePlaceholder: 'آواز کا پیغام…',
    voiceTranscriptFallback: 'آواز کا پیغام',
    snackbarClose: 'بند',
    micHint: 'ریکارڈ کرنے کے لیے دبائیں',
    micHintStop: 'روکنے کے لیے دبائیں',
    copied: 'جواب کاپی ہو گیا',
    retry: 'دوبارہ کوشش',
  },
  rud: {
    newChat: 'Naya chat',
    eyebrow: 'TARBIYATI MUAVIN',
    greeting: 'Aaj main kaise madad karoon?',
    greetingHint: 'Vaccination, cold chain, ya immunization session ke baare mein sawal poochein.',
    suggestions: [
      'Cold chain ka temperature kitna hona chahiye?',
      'Polio vaccine kab lagai jati hai?',
      'BCG vaccine kya rokti hai?',
    ],
    placeholder: 'Sawal yahan likhein…',
    errorLoad: 'Load nakaam',
    errorNet: 'Network ki kharabi',
    errorMic: 'Mic nakaam',
    errorNoAudio: 'Koi audio record nahi hui',
    errorVoice: 'Awaaz ki darkhwast nakaam',
    voicePlaceholder: 'Awaaz ka paigham…',
    voiceTranscriptFallback: 'Awaaz ka paigham',
    snackbarClose: 'Band karein',
    micHint: 'Record karne ke liye tap karein',
    micHintStop: 'Rokne ke liye tap karein',
    copied: 'Jawab copy ho gaya',
    retry: 'Dobaara koshish',
  },
};

// Roman Urdu has no voice of its own — read it with the Urdu engine.
const TTS_LANG: Record<ReplyLanguage, string> = { en: 'en-US', ur: 'ur-PK', rud: 'ur-PK' };

const isPlaceholderTitleText = (t: string) =>
  t === COPY.en.newChat || t === COPY.ur.newChat || t === COPY.rud.newChat;

/** A single chat bubble — memoized so streaming only re-renders the live message. */
const MessageBubble = memo(function MessageBubble({
  item,
  isRtl,
  onCopy,
}: {
  item: Msg;
  isRtl: boolean;
  onCopy: (text: string) => void;
}) {
  const isUser = item.role === 'user';
  return (
    <View style={[styles.row, isUser ? styles.rowRight : styles.rowLeft]}>
      {!isUser && (
        <View style={styles.botAvatar}>
          <BrandMark size={20} />
        </View>
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
        ) : (
          <Text
            selectable
            style={[
              styles.bubbleText,
              { color: isUser ? palette.userBubbleText : palette.botBubbleText },
              isRtl ? styles.rtl : null,
            ]}
          >
            {item.content}
          </Text>
        )}
      </Pressable>
    </View>
  );
});

export default function ChatScreen({ route, navigation }: Props) {
  const theme = useTheme();
  const { language, setLanguage } = useLanguage();
  const strings = COPY[language];
  const isRtl = language === 'ur';
  const initialChatId = route.params?.chatId ?? null;

  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [chatId, setChatId] = useState<number | null>(initialChatId);
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const [chatTitle, setChatTitle] = useState<string>(strings.newChat);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryText, setRetryText] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(initialChatId !== null);
  const [muted, setMuted] = useState(false);

  const listRef = useRef<FlatList<Msg>>(null);
  const messagesRef = useRef<Msg[]>([]);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);
  const recordingPulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

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

  useEffect(() => {
    (async () => {
      const id = await getDeviceId();
      setDeviceId(id);
      try {
        const perm = await AudioModule.requestRecordingPermissionsAsync();
        if (perm.granted) {
          await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
        }
      } catch {}

      if (initialChatId) {
        try {
          const detail = await getChat(id, initialChatId);
          if (detail.chat.title) setChatTitle(detail.chat.title);
          setMessages(
            detail.messages.map((m) => ({
              id: `s${m.id}`,
              role: m.role === 'system' ? 'assistant' : (m.role as 'user' | 'assistant'),
              content: m.content,
            })),
          );
        } catch (e: any) {
          setError(e?.message ?? strings.errorLoad);
        } finally {
          setLoadingHistory(false);
        }
      } else {
        setLoadingHistory(false);
      }
    })();
    return () => {
      Speech.stop();
    };
  }, [initialChatId]); // eslint-disable-line react-hooks/exhaustive-deps

  const scroll = useCallback(() => {
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  }, []);

  const speak = useCallback(
    (text: string) => {
      if (muted || !text.trim()) return;
      Speech.stop();
      Speech.speak(text, { language: TTS_LANG[language], pitch: 1.0, rate: 0.95 });
    },
    [language, muted],
  );

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

  const sendTextMessage = useCallback(
    async (retryOf?: string) => {
      const text = (retryOf ?? input).trim();
      if (!deviceId || !text || busy) return;
      if (!retryOf) setInput('');
      setError(null);
      setRetryText(null);

      const placeholderId = `p${Date.now()}`;
      const userMsg: Msg = { id: `u${Date.now()}`, role: 'user', content: text };
      const placeholder: Msg = { id: placeholderId, role: 'assistant', content: '', pending: true };
      setMessages((m) => [...m, userMsg, placeholder]);
      setBusy(true);

      const freshTitle = isPlaceholderTitleText(chatTitle) && !chatId;
      if (freshTitle) setChatTitle(text.slice(0, 60));
      const titleForCache = freshTitle ? text.slice(0, 60) : chatTitle;
      scroll();

      const applyFinal = (content: string) =>
        setMessages((m) => m.map((x) => (x.id === placeholderId ? { ...x, pending: false, content } : x)));

      let sawDelta = false;
      try {
        const res = await sendTextStream(
          { deviceId, message: text, chatId, language },
          {
            onMeta: (id) => setChatId(id),
            onDelta: (delta) => {
              sawDelta = true;
              setMessages((m) =>
                m.map((x) =>
                  x.id === placeholderId ? { ...x, pending: false, content: x.content + delta } : x,
                ),
              );
              scroll();
            },
          },
        );
        setChatId(res.chat_id);
        applyFinal(res.reply.content);
        persistSession(res.chat_id, titleForCache);
        speak(res.reply.content);
      } catch (streamErr: any) {
        if (sawDelta) {
          setError(streamErr?.message ?? strings.errorNet);
          setRetryText(text);
        } else {
          // Streaming unavailable — fall back to the plain request/response endpoint.
          try {
            const res = await sendText({ deviceId, message: text, chatId, language });
            setChatId(res.chat_id);
            applyFinal(res.reply.content);
            persistSession(res.chat_id, titleForCache);
            speak(res.reply.content);
          } catch (e: any) {
            setMessages((m) => m.filter((x) => x.id !== placeholderId));
            setError(e?.message ?? strings.errorNet);
            setRetryText(text);
          }
        }
      } finally {
        setBusy(false);
        scroll();
      }
    },
    [busy, chatId, chatTitle, deviceId, input, language, persistSession, scroll, speak, strings.errorNet],
  );

  const startRecording = useCallback(async () => {
    if (!deviceId || busy || recorderState.isRecording) return;
    setError(null);
    try {
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

      const res = await sendAudio({ deviceId, audioUri: uri, audioMime: 'audio/m4a', chatId, language });
      setChatId(res.chat_id);
      const transcript = res.transcript?.trim() || strings.voiceTranscriptFallback;
      const freshTitle = isPlaceholderTitleText(chatTitle) && !chatId;
      if (freshTitle) setChatTitle(transcript.slice(0, 60));

      setMessages((m) =>
        m.map((x) => {
          if (x.id === userId) return { ...x, pending: false, content: transcript };
          if (x.id === placeholderId) return { ...x, pending: false, content: res.reply.content };
          return x;
        }),
      );
      persistSession(res.chat_id, freshTitle ? transcript.slice(0, 60) : chatTitle);
      speak(res.reply.content);
    } catch (e: any) {
      setMessages((m) => m.filter((x) => !x.pending));
      setError(e?.message ?? strings.errorVoice);
    } finally {
      setBusy(false);
      scroll();
    }
  }, [chatId, chatTitle, deviceId, language, persistSession, recorder, recorderState.isRecording, scroll, speak, strings.errorNoAudio, strings.errorVoice, strings.voicePlaceholder, strings.voiceTranscriptFallback]);

  const toggleRecording = useCallback(() => {
    if (recorderState.isRecording) {
      stopRecordingAndSend();
    } else {
      startRecording();
    }
  }, [recorderState.isRecording, startRecording, stopRecordingAndSend]);

  const renderItem = useCallback(
    ({ item }: { item: Msg }) => <MessageBubble item={item} isRtl={isRtl} onCopy={copyMessage} />,
    [isRtl, copyMessage],
  );

  const empty = useMemo(
    () => (
      <View style={styles.emptyChat}>
        <View style={styles.emptyMarkRing}>
          <BrandMark size={84} />
        </View>
        <Text style={styles.eyebrow}>{strings.eyebrow}</Text>
        <Text style={[styles.emptyHeadline, isRtl ? styles.rtl : null]}>{strings.greeting}</Text>
        <Text style={[styles.emptyHint, isRtl ? styles.rtl : null]}>{strings.greetingHint}</Text>
        <View style={styles.suggestions}>
          {strings.suggestions.map((q) => (
            <Pressable
              key={q}
              onPress={() => setInput(q)}
              android_ripple={{ color: 'rgba(7,32,63,0.08)' }}
              style={({ pressed }) => [styles.suggestionCard, pressed && { opacity: 0.85 }]}
            >
              <View style={styles.suggestionBullet} />
              <Text style={[styles.suggestionText, isRtl ? styles.rtl : null]} numberOfLines={2}>
                {q}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    ),
    [isRtl, strings.eyebrow, strings.greeting, strings.greetingHint, strings.suggestions],
  );

  const hasInput = input.trim().length > 0;

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
          <IconButton
            icon="arrow-left"
            iconColor={brand.cream}
            size={22}
            onPress={() => navigation.goBack()}
            style={styles.headerIcon}
          />
          <View style={styles.headerCenter}>
            <View style={styles.headerBrand}>
              <BrandMark size={22} />
              <Text style={styles.headerBrandText}>Tahaffuz</Text>
            </View>
            <Text style={[styles.headerSubtitle, isRtl ? styles.rtl : null]} numberOfLines={1}>
              {chatTitle}
            </Text>
          </View>
          <Menu
            visible={langMenuOpen}
            onDismiss={() => setLangMenuOpen(false)}
            contentStyle={styles.menuContent}
            anchor={
              <IconButton
                icon="translate"
                iconColor={brand.cream}
                size={22}
                onPress={() => setLangMenuOpen(true)}
                style={styles.headerIcon}
              />
            }
          >
            <Menu.Item
              title="English"
              leadingIcon={language === 'en' ? 'check' : undefined}
              onPress={() => {
                setLanguage('en');
                setLangMenuOpen(false);
                Speech.stop();
              }}
            />
            <Menu.Item
              title="اردو"
              leadingIcon={language === 'ur' ? 'check' : undefined}
              onPress={() => {
                setLanguage('ur');
                setLangMenuOpen(false);
                Speech.stop();
              }}
            />
            <Menu.Item
              title="Roman Urdu"
              leadingIcon={language === 'rud' ? 'check' : undefined}
              onPress={() => {
                setLanguage('rud');
                setLangMenuOpen(false);
                Speech.stop();
              }}
            />
          </Menu>
          <IconButton
            icon={muted ? 'volume-off' : 'volume-high'}
            iconColor={brand.cream}
            size={22}
            onPress={() => {
              setMuted((m) => !m);
              Speech.stop();
            }}
            style={styles.headerIcon}
          />
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
            onContentSizeChange={scroll}
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
                >
                  <Icon source="arrow-up" size={22} color={brand.cream} />
                </Pressable>
              ) : (
                <Animated.View style={{ transform: [{ scale: recordingPulse }] }}>
                  <Pressable
                    onPress={toggleRecording}
                    disabled={busy && !recorderState.isRecording}
                    android_ripple={{ color: 'rgba(224,162,74,0.25)' }}
                    style={({ pressed }) => [
                      styles.micBtn,
                      recorderState.isRecording && styles.micBtnActive,
                      pressed && { opacity: 0.9 },
                    ]}
                  >
                    <Icon
                      source={recorderState.isRecording ? 'stop' : 'microphone'}
                      size={22}
                      color={recorderState.isRecording ? brand.cream : brand.ink}
                    />
                  </Pressable>
                </Animated.View>
              )}
            </View>
            <Text style={styles.composerHint}>
              {recorderState.isRecording ? `●  ${strings.micHintStop}` : strings.micHint}
            </Text>
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

  // Header
  header: {
    paddingTop: Platform.OS === 'ios' ? 50 : (StatusBar.currentHeight ?? 0) + 6,
    paddingBottom: 14,
    paddingHorizontal: 4,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  headerIcon: { margin: 0 },
  headerCenter: { flex: 1, alignItems: 'center', paddingHorizontal: 4 },
  headerBrand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerBrandText: {
    color: brand.cream,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  headerSubtitle: {
    color: 'rgba(244,238,227,0.72)',
    fontSize: 11,
    marginTop: 2,
    letterSpacing: 0.3,
  },
  menuContent: { borderRadius: 14, marginTop: 4 },

  // List
  list: { padding: 14, paddingBottom: 16 },
  listEmpty: { flex: 1, justifyContent: 'center', padding: 24 },

  // Empty state
  emptyChat: { alignItems: 'center', gap: 10 },
  emptyMarkRing: {
    width: 116,
    height: 116,
    borderRadius: 58,
    backgroundColor: brand.paper,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(7,32,63,0.06)',
    marginBottom: 6,
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
    marginTop: 4,
  },
  emptyHint: {
    color: brand.indigoSoft,
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    opacity: 0.85,
    maxWidth: 320,
  },
  suggestions: { gap: 10, marginTop: 18, alignSelf: 'stretch' },
  suggestionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: brand.paper,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(7,32,63,0.07)',
  },
  suggestionBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: brand.amber,
  },
  suggestionText: { flex: 1, color: brand.ink, fontSize: 14, lineHeight: 20 },

  // Bubbles
  row: { marginVertical: 5, flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  rowLeft: { justifyContent: 'flex-start' },
  rowRight: { justifyContent: 'flex-end' },
  botAvatar: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: brand.paper,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(7,32,63,0.06)',
  },
  bubble: {
    maxWidth: '82%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  bubbleUser: {
    backgroundColor: brand.ink,
    borderBottomRightRadius: 6,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  bubbleBot: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 6,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  bubbleText: { fontSize: 15, lineHeight: 22 },
  pendingRow: { paddingVertical: 4 },

  // Composer
  composerWrap: {
    paddingHorizontal: 12,
    paddingBottom: Platform.OS === 'ios' ? 24 : 14,
    paddingTop: 8,
    backgroundColor: 'transparent',
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: brand.paper,
    borderRadius: 26,
    paddingLeft: 6,
    paddingRight: 6,
    paddingVertical: 6,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(7,32,63,0.08)',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  input: {
    flex: 1,
    maxHeight: 140,
    backgroundColor: 'transparent',
    fontSize: 15,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  inputContent: { color: brand.ink },

  micBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(224,162,74,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: brand.amber,
  },
  micBtnActive: { backgroundColor: '#B3261E', borderColor: '#B3261E' },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: brand.ink,
    justifyContent: 'center',
    alignItems: 'center',
  },

  composerHint: {
    color: brand.indigoSoft,
    fontSize: 10,
    letterSpacing: 1.6,
    textAlign: 'center',
    marginTop: 6,
    opacity: 0.7,
    fontWeight: '600',
  },
});
