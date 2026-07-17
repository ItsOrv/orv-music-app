import React, { useEffect, useState, useCallback } from "react";
import { ActivityIndicator, View, Text, StyleSheet } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";

import * as Linking from "expo-linking";
import { theme } from "./src/theme";
import { getMe, getToken, AuthError, Me } from "./src/api";
import { tokenFromUrl, loginWithToken } from "./src/auth";
import { PlayerProvider } from "./src/player";
import { ToastProvider } from "./src/ui";
import { SheetProvider } from "./src/sheet";
import { PromptProvider } from "./src/prompt";
import PlayerBar from "./src/PlayerBar";
import LoginScreen from "./src/screens/LoginScreen";
import HomeScreen from "./src/screens/HomeScreen";
import LibraryScreen from "./src/screens/LibraryScreen";
import SearchScreen from "./src/screens/SearchScreen";
import SettingsScreen from "./src/screens/SettingsScreen";
import ArtistScreen from "./src/screens/ArtistScreen";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const navTheme = {
  ...DefaultTheme,
  dark: true,
  colors: { ...DefaultTheme.colors, background: theme.bg, card: theme.bg, text: theme.text, border: theme.line, primary: theme.gold },
};

const TABS: { name: string; label: string; icon: string; component: React.ComponentType<any> }[] = [
  { name: "Home", label: "Home", icon: "▲", component: HomeScreen },
  { name: "Search", label: "Search", icon: "⌕", component: SearchScreen },
  { name: "Library", label: "Library", icon: "♪", component: LibraryScreen },
];

function MainTabs() {
  const insets = useSafeAreaInsets();
  const tabH = 56 + insets.bottom;
  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Tab.Navigator
        screenOptions={({ route }) => {
          const t = TABS.find((x) => x.name === route.name)!;
          return {
            headerShown: false,
            tabBarActiveTintColor: theme.gold,
            tabBarInactiveTintColor: theme.muted2,
            tabBarStyle: { backgroundColor: theme.card, borderTopColor: theme.line, height: tabH, paddingTop: 6, paddingBottom: insets.bottom },
            tabBarLabelStyle: { fontSize: 11 },
            tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>{t.icon}</Text>,
            tabBarLabel: t.label,
          };
        }}
      >
        {TABS.map((t) => (
          <Tab.Screen key={t.name} name={t.name} component={t.component} />
        ))}
      </Tab.Navigator>
      <PlayerBar bottomOffset={tabH + 8} />
    </View>
  );
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [me, setMe] = useState<Me | null>(null);

  const boot = useCallback(async () => {
    try {
      const linkToken = tokenFromUrl(await Linking.getInitialURL());
      if (linkToken) {
        setMe(await loginWithToken(linkToken));
        return;
      }
      const t = await getToken();
      if (t) setMe(await getMe());
    } catch (e) {
      if (e instanceof AuthError) setMe(null);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => { boot(); }, [boot]);

  // handle a token deep link while the app is already open
  useEffect(() => {
    const sub = Linking.addEventListener("url", async ({ url }) => {
      const t = tokenFromUrl(url);
      if (t) {
        try { setMe(await loginWithToken(t)); } catch {}
      }
    });
    return () => sub.remove();
  }, []);

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
      <ToastProvider>
        <SheetProvider>
          <PromptProvider>
            <PlayerProvider>
              <NavigationContainer theme={navTheme}>
                <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.bg } }}>
                  {me ? (
                    <>
                      <Stack.Screen name="Main" component={MainTabs} />
                      <Stack.Screen name="Settings">
                        {(props) => <SettingsScreen {...props} me={me} setMe={setMe} />}
                      </Stack.Screen>
                      <Stack.Screen name="Artist" component={ArtistScreen} />
                    </>
                  ) : (
                    <Stack.Screen name="Login">
                      {(props) => <LoginScreen {...props} onSignedIn={setMe} />}
                    </Stack.Screen>
                  )}
                </Stack.Navigator>
              </NavigationContainer>
            </PlayerProvider>
          </PromptProvider>
        </SheetProvider>
      </ToastProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: theme.bg },
});
