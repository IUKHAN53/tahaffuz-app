import 'react-native-gesture-handler';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme as NavLightTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { KeyboardProvider } from 'react-native-keyboard-controller';

import SessionsScreen from './src/screens/SessionsScreen';
import ChatScreen from './src/screens/ChatScreen';
import BookmarksScreen from './src/screens/BookmarksScreen';
import SearchScreen from './src/screens/SearchScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import { paperTheme } from './src/theme';
import { LanguageProvider } from './src/language';
import { isRegistered } from './src/registration';
import { TypingDots } from './src/components/TypingDots';
import type { RootStackParamList } from './src/navigation';

const Stack = createNativeStackNavigator<RootStackParamList>();

const navTheme = {
  ...NavLightTheme,
  colors: {
    ...NavLightTheme.colors,
    background: paperTheme.colors.background,
    card: paperTheme.colors.surface,
    primary: paperTheme.colors.primary,
    text: paperTheme.colors.onBackground,
    border: paperTheme.colors.outlineVariant,
  },
};

export default function App() {
  // Decide the first screen once: onboarding if this device hasn't registered,
  // otherwise straight into chat. `null` while we check (brief splash).
  const [registered, setRegistered] = useState<boolean | null>(null);

  useEffect(() => {
    isRegistered().then(setRegistered);
  }, []);

  if (registered === null) {
    return (
      <View style={{ flex: 1, backgroundColor: paperTheme.colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <TypingDots size={9} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <KeyboardProvider>
        <LanguageProvider>
          <PaperProvider theme={paperTheme}>
            <NavigationContainer theme={navTheme}>
              <StatusBar style="light" backgroundColor={paperTheme.colors.primary} />
              <Stack.Navigator
                initialRouteName={registered ? 'Chat' : 'Register'}
                screenOptions={{ headerShown: false, animation: 'slide_from_right' }}
              >
                {/* One-time onboarding (name + area). */}
                <Stack.Screen name="Register" component={RegisterScreen} />
                {/* Land directly in a new chat, like other AI chat apps. */}
                <Stack.Screen
                  name="Chat"
                  component={ChatScreen}
                  initialParams={{ chatId: null }}
                />
                {/* Chat history opens as a slide-in panel from the left. */}
                <Stack.Screen
                  name="Sessions"
                  component={SessionsScreen}
                  options={{ animation: 'slide_from_left' }}
                />
                <Stack.Screen name="Bookmarks" component={BookmarksScreen} />
                <Stack.Screen name="Search" component={SearchScreen} />
              </Stack.Navigator>
            </NavigationContainer>
          </PaperProvider>
        </LanguageProvider>
      </KeyboardProvider>
    </SafeAreaProvider>
  );
}
