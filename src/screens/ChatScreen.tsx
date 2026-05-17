import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  View,
} from 'react-native';
import {
  Chip,
  IconButton,
  Menu,
  Snackbar,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import * as Speech from 'expo-speech';
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { getChat, sendAudio, sendText, type Citation, type ReplyLanguage } from '../api';
import { getDeviceId } from '../deviceId';
import { upsertSession } from '../sessions';
import { brand, palette } from '../theme';
import { BrandMark } from '../components/BrandMark';
import { TypingDots } from '../components/TypingDots';
import type { RootStackParamList } from '../navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Chat'>;

type Msg = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
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
    micHint: 'Hold to speak',
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
    micHint: 'بولنے کے لیے دبائے رکھیں',
  },
};

const TTS_LANG: Record<ReplyLanguage, string> = { en: 'en-US', ur: 'ur-PK' };

export default function ChatScreen({ route, navigation }: Props) {
  const theme = useTheme();
  const initialChatId = route.params?.chatId ?? null;

  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [chatId, setChatId] = useState<number | null>(initialChatId);
  const [language, setLanguage] = useState<ReplyLanguage>('en');
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const strings = COPY[language];
  const [chatTitle, setChatTitle] = useState<string>(strings.newChat);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(initialChatId !== null);
  const [muted, setMuted] = useState(false);

  const listRef = useRef<FlatList<Msg>>(null);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);
  const recordingPulse = useRef(new Animated.Value(1)).current;
  const recordingRing = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (recorderState.isRecording) {
      const loop = Animated.loop(
        Animated.parallel([
          Animated.sequence([
            Animated.timing(recordingPulse, { toValue: 1.14, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
            Animated.timing(recordingPulse, { toValue: 1.0, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          ]),
          Animated.timing(recordingRing, { toValue: 1, duration: 1200, useNativeDriver: true }),
        ]),
      );
      loop.start();
      return () => loop.stop();
    }
    recordingPulse.setValue(1);
    recordingRing.setValue(0);
  }, [recorderState.isRecording, recordingPulse, recordingRing]);

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
          if (detail.chat.language === 'en' || detail.chat.language === 'ur') {
            setLanguage(detail.chat.language as ReplyLanguage);
          }
          setMessages(
            detail.messages.map((m) => ({
              id: `s${m.id}`,
              role: m.role === 'system' ? 'assistant' : (m.role as 'user' | 'assistant'),
              content: m.content,
              citations: m.citations ?? undefined,
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
      if (muted) return;
      Speech.stop();
      Speech.speak(text, { language: TTS_LANG[language], pitch: 1.0, rate: 0.95 });
    },
    [language, muted],
  );

  const persistSession = useCallback(
    (id: number, title: string, count: number) => {
      upsertSession({
        id,
        title: title || strings.newChat,
        message_count: count,
        updated_at: new Date().toISOString(),
      });
    },
    [strings.newChat],
  );

  const sendTextMessage = useCallback(async () => {
    if (!deviceId || !input.trim() || busy) return;
    const text = input.trim();
    setInput('');
    setError(null);

    const userMsg: Msg = { id: `u${Date.now()}`, role: 'user', content: text };
    const placeholder: Msg = { id: `p${Date.now()}`, role: 'assistant', content: '', pending: true };
    setMessages((m) => [...m, userMsg, placeholder]);
    setBusy(true);
    const isPlaceholderTitle = chatTitle === COPY.en.newChat || chatTitle === COPY.ur.newChat;
    if (isPlaceholderTitle && !chatId) {
      setChatTitle(text.slice(0, 60));
    }
    scroll();

    try {
      const res = await sendText({ deviceId, message: text, chatId, language });
      setChatId(res.chat_id);
      const finalMessages = await new Promise<Msg[]>((resolve) => {
        setMessages((m) => {
          const next = m.map((x) =>
            x.id === placeholder.id
              ? { ...x, pending: false, content: res.reply.content, citations: res.reply.citations }
              : x,
          );
          resolve(next);
          return next;
        });
      });
      persistSession(res.chat_id, isPlaceholderTitle ? text.slice(0, 60) : chatTitle, finalMessages.length);
      speak(res.reply.content);
    } catch (e: any) {
      setMessages((m) => m.filter((x) => x.id !== placeholder.id));
      setError(e?.message ?? strings.errorNet);
    } finally {
      setBusy(false);
      scroll();
    }
  }, [busy, chatId, chatTitle, deviceId, input, language, persistSession, scroll, speak, strings.errorNet]);

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
    try {
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri) {
        setError(strings.errorNoAudio);
        return;
      }

      const userPlaceholder: Msg = { id: `uv${Date.now()}`, role: 'user', content: strings.voicePlaceholder, pending: true };
      const placeholder: Msg = { id: `pv${Date.now()}`, role: 'assistant', content: '', pending: true };
      setMessages((m) => [...m, userPlaceholder, placeholder]);
      scroll();

      const res = await sendAudio({ deviceId, audioUri: uri, audioMime: 'audio/m4a', chatId, language });
      setChatId(res.chat_id);
      const transcript = res.transcript ?? strings.voiceTranscriptFallback;
      const isPlaceholderTitle = chatTitle === COPY.en.newChat || chatTitle === COPY.ur.newChat;
      if (isPlaceholderTitle && !chatId) {
        setChatTitle(transcript.slice(0, 60));
      }
      const finalMessages = await new Promise<Msg[]>((resolve) => {
        setMessages((m) => {
          const next = m.map((x) => {
            if (x.id === userPlaceholder.id) return { ...x, pending: false, content: transcript };
            if (x.id === placeholder.id) {
              return { ...x, pending: false, content: res.reply.content, citations: res.reply.citations };
            }
            return x;
          });
          resolve(next);
          return next;
        });
      });
      persistSession(res.chat_id, isPlaceholderTitle ? transcript.slice(0, 60) : chatTitle, finalMessages.length);
      speak(res.reply.content);
    } catch (e: any) {
      setError(e?.message ?? strings.errorVoice);
      setMessages((m) => m.filter((x) => !x.pending));
    } finally {
      setBusy(false);
      scroll();
    }
  }, [chatId, chatTitle, deviceId, language, persistSession, recorder, recorderState.isRecording, scroll, speak, strings.errorNoAudio, strings.errorVoice, strings.voicePlaceholder, strings.voiceTranscriptFallback]);

  const renderItem = useCallback(
    ({ item }: { item: Msg }) => {
      const isUser = item.role === 'user';
      const isRtl = language === 'ur';
      return (
        <View style={[styles.row, isUser ? styles.rowRight : styles.rowLeft]}>
          {!isUser && (
            <View style={styles.botAvatar}>
              <BrandMark size={20} />
            </View>
          )}
          <View
            style={[
              styles.bubble,
              isUser ? styles.bubbleUser : styles.bubbleBot,
            ]}
          >
            {item.pending ? (
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
            {!!item.citations?.length && (
              <View style={styles.citations}>
                {item.citations.slice(0, 3).map((c) => (
                  <View key={c.chunk_id} style={styles.citationPill}>
                    <View style={styles.citationDot} />
                    <Text style={styles.citationText} numberOfLines={1}>
                      {c.document_title}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>
      );
    },
    [language],
  );

  const empty = useMemo(
    () => (
      <View style={styles.emptyChat}>
        <View style={styles.emptyMarkRing}>
          <BrandMark size={84} />
        </View>
        <Text style={styles.eyebrow}>{strings.eyebrow}</Text>
        <Text style={[styles.emptyHeadline, language === 'ur' ? styles.rtl : null]}>
          {strings.greeting}
        </Text>
        <Text style={[styles.emptyHint, language === 'ur' ? styles.rtl : null]}>
          {strings.greetingHint}
        </Text>
        <View style={styles.suggestions}>
          {strings.suggestions.map((q) => (
            <Pressable
              key={q}
              onPress={() => setInput(q)}
              android_ripple={{ color: 'rgba(7,32,63,0.08)' }}
              style={({ pressed }) => [
                styles.suggestionCard,
                pressed && { opacity: 0.85 },
              ]}
            >
              <View style={styles.suggestionBullet} />
              <Text
                style={[
                  styles.suggestionText,
                  language === 'ur' ? styles.rtl : null,
                ]}
                numberOfLines={2}
              >
                {q}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    ),
    [language, strings.eyebrow, strings.greeting, strings.greetingHint, strings.suggestions],
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
            <Text
              style={[styles.headerSubtitle, language === 'ur' ? styles.rtl : null]}
              numberOfLines={1}
            >
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
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
        >
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            renderItem={renderItem}
            contentContainerStyle={messages.length ? styles.list : styles.listEmpty}
            ListEmptyComponent={empty}
            onContentSizeChange={scroll}
            showsVerticalScrollIndicator={false}
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
                contentStyle={[styles.inputContent, language === 'ur' ? styles.rtl : null]}
                underlineStyle={{ display: 'none' }}
                editable={!busy}
                cursorColor={brand.indigo}
              />

              {hasInput ? (
                <Pressable
                  onPress={sendTextMessage}
                  disabled={busy}
                  android_ripple={{ color: 'rgba(244,238,227,0.25)' }}
                  style={({ pressed }) => [
                    styles.sendBtn,
                    busy && { opacity: 0.5 },
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <IconButton
                    icon="arrow-up"
                    iconColor={brand.cream}
                    size={20}
                    onPress={() => {}}
                    disabled
                    style={styles.btnIconReset}
                  />
                </Pressable>
              ) : (
                <Animated.View style={{ transform: [{ scale: recordingPulse }] }}>
                  <Pressable
                    onPressIn={startRecording}
                    onPressOut={stopRecordingAndSend}
                    disabled={busy && !recorderState.isRecording}
                    android_ripple={{ color: 'rgba(224,162,74,0.25)' }}
                    style={({ pressed }) => [
                      styles.micBtn,
                      recorderState.isRecording && styles.micBtnActive,
                      pressed && { opacity: 0.9 },
                    ]}
                  >
                    <IconButton
                      icon={recorderState.isRecording ? 'stop' : 'microphone'}
                      iconColor={recorderState.isRecording ? brand.cream : brand.ink}
                      size={20}
                      onPress={() => {}}
                      disabled
                      style={styles.btnIconReset}
                    />
                  </Pressable>
                </Animated.View>
              )}
            </View>
            <Text style={styles.composerHint}>
              {recorderState.isRecording ? '●  REC' : strings.micHint}
            </Text>
          </View>
        </KeyboardAvoidingView>
      )}

      <Snackbar
        visible={!!error}
        onDismiss={() => setError(null)}
        duration={3500}
        action={{ label: strings.snackbarClose, onPress: () => setError(null) }}
      >
        {error ?? ''}
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

  // Citations
  citations: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  citationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: 'rgba(191,215,238,0.55)',
    borderRadius: 999,
    maxWidth: '100%',
  },
  citationDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: brand.indigo },
  citationText: { fontSize: 11, color: brand.ink, fontWeight: '600' },

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
  btnIconReset: { margin: 0 },

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
