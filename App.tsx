import 'react-native-gesture-handler';
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
import { paperTheme } from './src/theme';
import { LanguageProvider } from './src/language';
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
  return (
    <SafeAreaProvider>
      <KeyboardProvider>
        <LanguageProvider>
          <PaperProvider theme={paperTheme}>
            <NavigationContainer theme={navTheme}>
              <StatusBar style="light" backgroundColor={paperTheme.colors.primary} />
              <Stack.Navigator
                initialRouteName="Sessions"
                screenOptions={{ headerShown: false, animation: 'slide_from_right' }}
              >
                <Stack.Screen name="Sessions" component={SessionsScreen} />
                <Stack.Screen name="Chat" component={ChatScreen} />
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
