import { memo, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

import { useLanguage, type AppLanguage } from '../language';
import { brand } from '../theme';

const LANGUAGES: { value: AppLanguage; label: string; native: string }[] = [
  { value: 'en', label: 'English', native: 'English' },
  { value: 'ur', label: 'Urdu', native: 'اردو' },
  { value: 'rud', label: 'Roman Urdu', native: 'Roman' },
  { value: 'ps', label: 'Pashto', native: 'پښتو' },
  { value: 'sd', label: 'Sindhi', native: 'سنڌي' },
];

const SHORT_LABELS: Record<AppLanguage, string> = {
  en: 'EN',
  ur: 'اردو',
  rud: 'Ro',
  ps: 'پښ',
  sd: 'سن',
};

/** Language switcher with full-screen modal for easy selection. */
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
        android_ripple={{ color: 'rgba(244,238,227,0.25)', borderless: false }}
        style={styles.trigger}
        accessibilityRole="button"
        accessibilityLabel="Change language"
        accessibilityHint="Opens language selection"
      >
        <Text style={styles.globeIcon}>🌐</Text>
        <Text style={styles.triggerText}>{SHORT_LABELS[language]}</Text>
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
                    android_ripple={{ color: 'rgba(7,32,63,0.08)' }}
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
                        <Text style={styles.checkmarkText}>✓</Text>
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
    backgroundColor: 'rgba(244,238,227,0.15)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 24,
  },
  globeIcon: {
    fontSize: 16,
  },
  triggerText: {
    color: brand.cream,
    fontSize: 14,
    fontWeight: '700',
  },

  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(7,32,63,0.6)',
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
    shadowColor: brand.ink,
    shadowOpacity: 0.25,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: brand.ink,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 16,
    color: brand.indigoSoft,
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
    backgroundColor: 'rgba(7,32,63,0.03)',
  },
  languageOptionActive: {
    backgroundColor: 'rgba(20,60,108,0.1)',
    borderWidth: 2,
    borderColor: brand.indigo,
  },
  languageInfo: {
    gap: 2,
  },
  languageNative: {
    fontSize: 18,
    fontWeight: '600',
    color: brand.ink,
  },
  languageLabel: {
    fontSize: 13,
    color: brand.indigoSoft,
  },
  languageTextActive: {
    color: brand.indigo,
  },
  languageLabelActive: {
    color: brand.indigo,
  },
  checkmark: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: brand.indigo,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmarkText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
