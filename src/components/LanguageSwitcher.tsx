import { memo, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { Feather } from '@expo/vector-icons';

import { useLanguage, type AppLanguage } from '../language';
import { tika } from '../theme';

const LANGUAGES: { value: AppLanguage; label: string; native: string }[] = [
  { value: 'en', label: 'English', native: 'English' },
  { value: 'ur', label: 'Urdu', native: 'اردو' },
  { value: 'fa', label: 'Farsi', native: 'فارسی' },
  { value: 'ps', label: 'Pashto', native: 'پښتو' },
  { value: 'sd', label: 'Sindhi', native: 'سنڌي' },
];

const SHORT_LABELS: Record<AppLanguage, string> = {
  en: 'English',
  ur: 'اردو',
  fa: 'فارسی',
  ps: 'پښتو',
  sd: 'سنڌي',
};

/**
 * Language pill (mint chip with teal label + chevron, per the mockup header)
 * that opens a full-screen language picker.
 */
function LanguageSwitcherComponent() {
  const { language, setLanguage } = useLanguage();
  const [modalVisible, setModalVisible] = useState(false);

  const selectLanguage = (lang: AppLanguage) => {
    setLanguage(lang);
    setModalVisible(false);
  };

  return (
    <>
      <Pressable
        onPress={() => setModalVisible(true)}
        android_ripple={{ color: 'rgba(14,124,102,0.15)', borderless: false }}
        style={styles.trigger}
        accessibilityRole="button"
        accessibilityLabel="Change language"
        accessibilityHint="Opens language selection"
      >
        <Text style={styles.triggerText}>{SHORT_LABELS[language]}</Text>
        <Feather name="chevron-down" size={14} color={tika.teal} />
      </Pressable>

      <Modal
        visible={modalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setModalVisible(false)}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Select Language</Text>
            <Text style={styles.modalSubtitle}>زبان منتخب کریں</Text>

            <View style={styles.languageList}>
              {LANGUAGES.map((lang) => {
                const isActive = language === lang.value;
                return (
                  <Pressable
                    key={lang.value}
                    onPress={() => selectLanguage(lang.value)}
                    android_ripple={{ color: 'rgba(14,124,102,0.08)' }}
                    style={[styles.languageOption, isActive && styles.languageOptionActive]}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: isActive }}
                    accessibilityLabel={lang.label}
                  >
                    <View style={styles.languageInfo}>
                      <Text style={[styles.languageNative, isActive && styles.languageTextActive]}>
                        {lang.native}
                      </Text>
                      <Text style={[styles.languageLabel, isActive && styles.languageLabelActive]}>
                        {lang.label}
                      </Text>
                    </View>
                    {isActive && (
                      <View style={styles.checkmark}>
                        <Feather name="check" size={16} color="#FFFFFF" />
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

export const LanguageSwitcher = memo(LanguageSwitcherComponent);

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: tika.mint,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
  },
  triggerText: {
    color: tika.teal,
    fontSize: 14,
    fontWeight: '700',
  },

  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(11,36,64,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    shadowColor: tika.shadow,
    shadowOpacity: 0.25,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: tika.ink,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 16,
    color: tika.inkSoft,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 20,
  },

  languageList: {
    gap: 10,
  },
  languageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 16,
    backgroundColor: tika.bg,
  },
  languageOptionActive: {
    backgroundColor: tika.mint,
    borderWidth: 2,
    borderColor: tika.teal,
  },
  languageInfo: {
    gap: 2,
  },
  languageNative: {
    fontSize: 18,
    fontWeight: '700',
    color: tika.ink,
  },
  languageLabel: {
    fontSize: 13,
    color: tika.inkSoft,
  },
  languageTextActive: {
    color: tika.teal,
  },
  languageLabelActive: {
    color: tika.teal,
  },
  checkmark: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: tika.teal,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
