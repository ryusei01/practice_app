import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { useLanguage } from "../contexts/LanguageContext";
import type { MediaItem } from "../api/questions";

let ImagePicker: typeof import("expo-image-picker") | null = null;
let Audio: typeof import("expo-av").Audio | null = null;

try { ImagePicker = require("expo-image-picker"); } catch {}
try { Audio = require("expo-av").Audio; } catch {}

interface MediaAttachmentProps {
  position: "question" | "answer";
  existingMedia?: MediaItem[];
  onUpload: (file: { uri: string; name: string; type: string }, position: "question" | "answer") => Promise<void>;
  onDelete: (index: number) => Promise<void>;
  apiBaseUrl?: string;
  disabled?: boolean;
}

export default function MediaAttachment({
  position,
  existingMedia = [],
  onUpload,
  onDelete,
  apiBaseUrl = "",
  disabled = false,
}: MediaAttachmentProps) {
  const { t } = useLanguage();
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState<any>(null);
  const [isRecording, setIsRecording] = useState(false);

  const positionMedia = existingMedia.filter((m) => m.position === position);

  const pickImage = async () => {
    if (!ImagePicker) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(t("Permission required", "権限が必要です"));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
      allowsEditing: true,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    const ext = asset.uri.split(".").pop() || "jpg";
    setUploading(true);
    try {
      await onUpload(
        { uri: asset.uri, name: `photo.${ext}`, type: `image/${ext}` },
        position
      );
    } finally {
      setUploading(false);
    }
  };

  const takePhoto = async () => {
    if (!ImagePicker) return;
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(t("Permission required", "権限が必要です"));
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
      allowsEditing: true,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    const ext = asset.uri.split(".").pop() || "jpg";
    setUploading(true);
    try {
      await onUpload(
        { uri: asset.uri, name: `camera.${ext}`, type: `image/${ext}` },
        position
      );
    } finally {
      setUploading(false);
    }
  };

  const pickAudioFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["audio/*"],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      setUploading(true);
      try {
        await onUpload(
          { uri: asset.uri, name: asset.name || "audio.mp3", type: asset.mimeType || "audio/mpeg" },
          position
        );
      } finally {
        setUploading(false);
      }
    } catch {}
  };

  const startRecording = async () => {
    if (!Audio) return;
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(t("Permission required", "マイク権限が必要です"));
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording: rec } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(rec);
      setIsRecording(true);
    } catch (err) {
      console.error("Recording start failed:", err);
    }
  };

  const stopRecording = async () => {
    if (!recording) return;
    setIsRecording(false);
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);
      if (uri) {
        setUploading(true);
        try {
          await onUpload({ uri, name: "recording.m4a", type: "audio/m4a" }, position);
        } finally {
          setUploading(false);
        }
      }
    } catch (err) {
      console.error("Recording stop failed:", err);
      setRecording(null);
    }
  };

  return (
    <View style={styles.container}>
      {positionMedia.length > 0 && (
        <View style={styles.mediaList}>
          {positionMedia.map((item, idx) => {
            const globalIdx = existingMedia.indexOf(item);
            return (
              <View key={idx} style={styles.mediaItem}>
                {item.type === "image" ? (
                  <Image
                    source={{ uri: apiBaseUrl + item.url }}
                    style={styles.thumbnail}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.audioTag}>
                    <Text style={styles.audioTagText}>
                      {item.caption || t("Audio", "音声")}
                    </Text>
                  </View>
                )}
                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={() => onDelete(globalIdx)}
                  disabled={disabled}
                >
                  <Text style={styles.deleteBtnText}>x</Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      )}

      {uploading ? (
        <ActivityIndicator color="#007AFF" style={{ marginVertical: 8 }} />
      ) : (
        <View style={styles.buttonRow}>
          {Platform.OS !== "web" && ImagePicker && (
            <TouchableOpacity style={styles.actionBtn} onPress={takePhoto} disabled={disabled}>
              <Text style={styles.actionBtnText}>{t("Camera", "撮影")}</Text>
            </TouchableOpacity>
          )}
          {ImagePicker && (
            <TouchableOpacity style={styles.actionBtn} onPress={pickImage} disabled={disabled}>
              <Text style={styles.actionBtnText}>{t("Image", "画像")}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.actionBtn} onPress={pickAudioFile} disabled={disabled}>
            <Text style={styles.actionBtnText}>{t("Audio File", "音声")}</Text>
          </TouchableOpacity>
          {Platform.OS !== "web" && Audio && (
            <TouchableOpacity
              style={[styles.actionBtn, isRecording && styles.recordingBtn]}
              onPress={isRecording ? stopRecording : startRecording}
              disabled={disabled}
            >
              <Text style={[styles.actionBtnText, isRecording && styles.recordingText]}>
                {isRecording ? t("Stop", "停止") : t("Record", "録音")}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 4, marginBottom: 8 },
  mediaList: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  mediaItem: { position: "relative" },
  thumbnail: { width: 64, height: 64, borderRadius: 8, backgroundColor: "#f0f0f0" },
  audioTag: {
    backgroundColor: "#E8F0FE",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    height: 64,
    justifyContent: "center",
  },
  audioTagText: { fontSize: 12, color: "#1a73e8", fontWeight: "500" },
  deleteBtn: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#FF3B30",
    alignItems: "center",
    justifyContent: "center",
  },
  deleteBtnText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  buttonRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  actionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#007AFF",
    backgroundColor: "#fff",
  },
  actionBtnText: { fontSize: 12, color: "#007AFF", fontWeight: "500" },
  recordingBtn: { borderColor: "#FF3B30", backgroundColor: "#FFF0F0" },
  recordingText: { color: "#FF3B30" },
});
