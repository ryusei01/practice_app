import React, { useCallback, useEffect, useState } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
} from "react-native";
import { setGlobalApiErrorListener } from "../utils/globalApiErrorBus";
import { useLanguage } from "./LanguageContext";

export function GlobalApiErrorModalProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { t } = useLanguage();
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState("");

  const show = useCallback((msg: string) => {
    setMessage(msg);
    setVisible(true);
  }, []);

  useEffect(() => {
    setGlobalApiErrorListener(show);
    return () => setGlobalApiErrorListener(null);
  }, [show]);

  return (
    <>
      {children}
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => setVisible(false)}
      >
        <View style={styles.backdrop}>
          <Pressable
            style={StyleSheet.absoluteFillObject}
            onPress={() => setVisible(false)}
            accessibilityLabel={t("Close", "閉じる")}
            accessibilityRole="none"
          />
          <View style={styles.sheet} accessibilityViewIsModal>
            <Text style={styles.title}>{t("Error", "エラー")}</Text>
            <Text style={styles.body} selectable>
              {message}
            </Text>
            <TouchableOpacity
              style={styles.btn}
              onPress={() => setVisible(false)}
              accessibilityRole="button"
            >
              <Text style={styles.btnText}>{t("OK", "OK")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    padding: 24,
  },
  sheet: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    maxWidth: 400,
    width: "100%",
    alignSelf: "center",
    zIndex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 12,
  },
  body: {
    fontSize: 15,
    color: "#333",
    lineHeight: 22,
    marginBottom: 20,
  },
  btn: {
    backgroundColor: "#007AFF",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  btnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
