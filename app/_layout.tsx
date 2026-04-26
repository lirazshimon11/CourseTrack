import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { I18nManager, View, Platform, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  useFonts,
  Heebo_400Regular,
  Heebo_500Medium,
  Heebo_600SemiBold,
  Heebo_700Bold,
} from '@expo-google-fonts/heebo';
import { Colors } from '../constants/theme';

// Force RTL for Hebrew
I18nManager.forceRTL(true);

if (Platform.OS === 'web') {
  if (typeof document !== 'undefined') {
    document.documentElement.dir = 'rtl';
    document.documentElement.style.backgroundColor = Colors.background;
    document.body.style.backgroundColor = Colors.background;

    // Hide scrollbars globally on web
    const style = document.createElement('style');
    style.textContent = `
      ::-webkit-scrollbar {
        display: none;
      }
      * {
        -ms-overflow-style: none;
        scrollbar-width: none;
      }
    `;
    document.head.appendChild(style);
  }
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Heebo_400Regular,
    Heebo_500Medium,
    Heebo_600SemiBold,
    Heebo_700Bold,
  });

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: Colors.background }} />;
  }

  return (
    <SafeAreaProvider style={{ flex: 1, backgroundColor: Colors.background }}>
      <View style={styles.root}>
        <View style={styles.container}>
          <StatusBar style="light" backgroundColor={Colors.background} />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: Colors.background },
              animation: Platform.OS === 'web' ? 'fade' : 'slide_from_right',
            }}
          />
        </View>
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    flex: 1,
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 480 : undefined,
    backgroundColor: Colors.background,
    paddingTop: 22, // Move everything down as requested
    ...Platform.select({
      web: {
        marginVertical: 0,
        borderRadius: 0,
        overflow: 'hidden',
      }
    })
  }
});
