import React, { useEffect, useState, useCallback } from "react";
import { ActivityIndicator, View, StyleSheet } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { theme } from "./src/theme";
import { api, getToken, AuthError, Me } from "./src/api";
import { PlayerProvider } from "./src/player";
import LoginScreen from "./src/screens/LoginScreen";
import LibraryScreen from "./src/screens/LibraryScreen";
import SettingsScreen from "./src/screens/SettingsScreen";

export type AppSession = { me: Me | null; setMe: (m: Me | null) => void };

const Stack = createNativeStackNavigator();

const navTheme = {
  ...DefaultTheme,
  dark: true,
  colors: { ...DefaultTheme.colors, background: theme.bg, card: theme.bg, text: theme.text, border: theme.line, primary: theme.gold },
};

export default function App() {
  const [ready, setReady] = useState(false);
  const [me, setMe] = useState<Me | null>(null);

  const boot = useCallback(async () => {
    try {
      const t = await getToken();
      if (t) setMe(await api<Me>("me"));
    } catch (e) {
      if (e instanceof AuthError) setMe(null);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    boot();
  }, [boot]);

  if (!ready) {
    return (
      <View style={styles.center}>
        <StatusBar style="light" />
        <ActivityIndicator color={theme.gold} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <PlayerProvider>
        <NavigationContainer theme={navTheme}>
          <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.bg } }}>
            {me ? (
              <>
                <Stack.Screen name="Library">
                  {(props) => <LibraryScreen {...props} me={me} setMe={setMe} />}
                </Stack.Screen>
                <Stack.Screen name="Settings">
                  {(props) => <SettingsScreen {...props} me={me} setMe={setMe} />}
                </Stack.Screen>
              </>
            ) : (
              <Stack.Screen name="Login">
                {(props) => <LoginScreen {...props} onSignedIn={setMe} />}
              </Stack.Screen>
            )}
          </Stack.Navigator>
        </NavigationContainer>
      </PlayerProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: theme.bg },
});
