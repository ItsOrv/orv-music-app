import React, { createContext, useContext, useState, useCallback } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Modal, Pressable, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { theme } from "./theme";

export type SheetAction = { label: string; danger?: boolean; onPress: () => void };

const SheetCtx = createContext<(title: string, actions: SheetAction[]) => void>(() => {});
export const useSheet = () => useContext(SheetCtx);

export function SheetProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{ title: string; actions: SheetAction[] } | null>(null);
  const insets = useSafeAreaInsets();

  const open = useCallback((title: string, actions: SheetAction[]) => setState({ title, actions }), []);
  const close = () => setState(null);

  return (
    <SheetCtx.Provider value={open}>
      {children}
      <Modal visible={!!state} transparent animationType="fade" onRequestClose={close}>
        <Pressable style={styles.backdrop} onPress={close}>
          <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]} onPress={() => {}}>
            <View style={styles.grab} />
            {!!state?.title && <Text style={styles.title}>{state.title}</Text>}
            <ScrollView style={{ maxHeight: 380 }}>
              {state?.actions.map((a, i) => (
                <TouchableOpacity
                  key={i}
                  style={styles.btn}
                  onPress={() => { close(); a.onPress(); }}
                >
                  <Text style={[styles.btnTxt, a.danger && styles.danger]}>{a.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.cancel} onPress={close}><Text style={styles.cancelTxt}>Cancel</Text></TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </SheetCtx.Provider>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: { backgroundColor: theme.card, borderTopLeftRadius: theme.radiusLg, borderTopRightRadius: theme.radiusLg, borderWidth: 1, borderColor: theme.line, paddingHorizontal: 14, paddingTop: 8 },
  grab: { width: 38, height: 4, borderRadius: 2, backgroundColor: theme.line, alignSelf: "center", marginBottom: 12 },
  title: { color: theme.muted, fontSize: 12.5, fontWeight: "600", textAlign: "center", paddingBottom: 12 },
  btn: { backgroundColor: theme.card2, borderWidth: 1, borderColor: theme.line, borderRadius: theme.radius, paddingVertical: 15, paddingHorizontal: 16, marginBottom: 7 },
  btnTxt: { color: theme.text, fontSize: 14.5, fontWeight: "600", textAlign: "left" },
  danger: { color: theme.danger },
  cancel: { paddingVertical: 14, alignItems: "center", marginTop: 4 },
  cancelTxt: { color: theme.muted, fontSize: 14, fontWeight: "600" },
});
