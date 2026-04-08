import React, { ReactNode } from "react";
import { platformShadow } from "@/src/styles/platformShadow";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal as RNModal,
  ScrollView,
  useWindowDimensions,
  Platform,
  Pressable,
} from "react-native";

interface ModalProps {
  visible: boolean;
  title: string;
  message?: string;
  children?: ReactNode;
  footer?: ReactNode;
  buttons?: Array<{
    text: string;
    onPress?: () => void;
    style?: "default" | "cancel" | "destructive";
  }>;
  onClose?: () => void;
  /** Webで背面スクロールを許可したい場合にtrue（ネイティブはRN Modal仕様で背面操作不可） */
  allowBackgroundScroll?: boolean;
}

export default function Modal({
  visible,
  title,
  message,
  children,
  footer,
  buttons,
  onClose,
  allowBackgroundScroll = false,
}: ModalProps) {
  const defaultButtons = buttons || [{ text: "OK", onPress: onClose }];
  const { width } = useWindowDimensions();
  const isSmallScreen = width < 600;

  const content = (
    <View style={styles.overlay} pointerEvents="box-none">
      {/* 背面スクロールを許可する場合は backdrop を掴まない */}
      {!(allowBackgroundScroll && Platform.OS === "web") && (
        <Pressable
          style={StyleSheet.absoluteFillObject}
          onPress={onClose}
          accessibilityLabel="Close"
          accessibilityRole="none"
        />
      )}
      <View
        style={[
          styles.modalContainer,
          {
            width: isSmallScreen ? "95%" : "90%",
            maxWidth: isSmallScreen ? 400 : 500,
            zIndex: 1,
          },
        ]}
        pointerEvents="auto"
      >
        <View
          style={[
            styles.modalContent,
            {
              padding: isSmallScreen ? 20 : 24,
            },
          ]}
        >
          <View style={styles.titleRow}>
            <Text
              style={[styles.modalTitle, { fontSize: isSmallScreen ? 18 : 20 }]}
            >
              {title}
            </Text>
            {(allowBackgroundScroll && Platform.OS === "web") && (
              <TouchableOpacity
                onPress={onClose}
                style={styles.closeButton}
                accessibilityLabel="Close"
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {message && <Text style={styles.modalMessage}>{message}</Text>}
            {children}
          </ScrollView>

          {footer ? <View style={styles.footer}>{footer}</View> : null}

          {!children && (
            <View style={styles.buttonContainer}>
              {defaultButtons.map((button, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.button,
                    button.style === "cancel" && styles.cancelButton,
                    button.style === "destructive" && styles.destructiveButton,
                  ]}
                  onPress={() => {
                    button.onPress?.();
                    onClose?.();
                  }}
                >
                  <Text
                    style={[
                      styles.buttonText,
                      button.style === "cancel" && styles.cancelButtonText,
                      button.style === "destructive" &&
                        styles.destructiveButtonText,
                    ]}
                  >
                    {button.text}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </View>
    </View>
  );

  return (
    (allowBackgroundScroll && Platform.OS === "web") ? (
      // Web: RN Modal を使わず、背面スクロールを許可する
      visible ? content : null
    ) : (
      <RNModal
        visible={visible}
        transparent={true}
        animationType="fade"
        onRequestClose={onClose}
      >
        {content}
      </RNModal>
    )
  );
}

const styles = StyleSheet.create({
  overlay: {
    // RN Modal(transparent) 配下で、Web/ScrollViewの影響を受けず
    // 常にビューポート全体を覆う
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: "100%",
    height: "100%",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalContainer: {
    width: "90%",
    maxWidth: 500,
    alignSelf: "center",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    ...platformShadow({
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
    }),
    elevation: 8,
    maxHeight: "90%",
    // 内側全体を TouchableOpacity で包んでいるため Web では親が pointer になりがち。
    // 本文は矢印のままにし、子の TouchableOpacity だけ手のポインタにする。
    ...Platform.select({
      web: { cursor: "default" },
      default: {},
    }),
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#333",
    marginBottom: 12,
    textAlign: "center",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  closeButton: {
    position: "absolute",
    right: 0,
    top: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f0f0f0",
  },
  closeButtonText: {
    fontSize: 18,
    fontWeight: "800",
    color: "#333",
  },
  modalMessage: {
    fontSize: 16,
    color: "#666",
    lineHeight: 24,
    marginBottom: 24,
    textAlign: "center",
  },
  scrollView: {
    maxHeight: 500,
  },
  scrollContent: {
    alignItems: "stretch",
    width: "100%",
  },
  footer: {
    marginTop: 12,
  },
  buttonContainer: {
    flexDirection: "row",
    gap: 12,
  },
  button: {
    flex: 1,
    backgroundColor: "#007AFF",
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
  },
  cancelButton: {
    backgroundColor: "#E0E0E0",
  },
  destructiveButton: {
    backgroundColor: "#FF3B30",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  cancelButtonText: {
    color: "#333",
  },
  destructiveButtonText: {
    color: "#fff",
  },
});
