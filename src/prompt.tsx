import React, { createContext, useContext, useRef, useState, useCallback } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Modal, Pressable } from "react-native";
import { theme } from "./theme";

type Resolver = (value: string | null) => void;

const PromptCtx = createContext<(title: string, placeholder?: string) => Promise<string | null>>(async () => null);
export const usePrompt = () => useContext(PromptCtx);

export function PromptProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{ title: string; placeholder?: string } | null>(null);
  const [value, setValue] = useState("");
  const resolver = useRef<Resolver | null>(null);

  const ask = useCallback((title: string, placeholder?: string) => {
    setValue("");
    setState({ title, placeholder });
    return new Promise<string | null>((resolve) => { resolver.current = resolve; });
  }, []);

  const done = (result: string | null) => {
    setState(null);
    resolver.current?.(result);
    resolver.current = null;
  };

  return (
    <PromptCtx.Provider value={ask}>
      {children}
      <Modal visible={!!state} transparent animationType="fade" onRequestClose={() => done(null)}>
        <Pressable style={styles.backdrop} onPress={() => done(null)}>
          <Pressable style={styles.box} onPress={() => {}}>
            <Text style={styles.title}>{state?.title}</Text>
            <TextInput
              style={styles.input}
              placeholder={state?.placeholder}
              placeholderTextColor={theme.muted2}
              value={value}
              onChangeText={setValue}
              autoFocus
              textAlign="right"
            />
            <View style={styles.row}>
              <TouchableOpacity style={styles.btn} onPress={() => done(null)}><Text style={styles.btnTxt}>انصراف</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.btn, styles.ok]} onPress={() => done(value.trim() || null)}><Text style={styles.okTxt}>تایید</Text></TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </PromptCtx.Provider>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center", padding: 28 },
  box: { width: "100%", backgroundColor: theme.card, borderRadius: theme.radius, borderWidth: 1, borderColor: theme.line, padding: 18 },
  title: { color: theme.text, fontSize: 15, fontWeight: "700", textAlign: "right", marginBottom: 12 },
  input: { backgroundColor: theme.bg2, borderRadius: theme.radiusSm, borderWidth: 1, borderColor: theme.line, color: theme.text, paddingHorizontal: 12, height: 46 },
  row: { flexDirection: "row", gap: 8, marginTop: 14 },
  btn: { flex: 1, height: 44, borderRadius: theme.radiusSm, alignItems: "center", justifyContent: "center", backgroundColor: theme.card2, borderWidth: 1, borderColor: theme.line },
  btnTxt: { color: theme.text, fontWeight: "700" },
  ok: { backgroundColor: theme.gold, borderColor: theme.gold },
  okTxt: { color: "#17130c", fontWeight: "800" },
});
