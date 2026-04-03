import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Dimensions,
} from "react-native";
import { useLanguage } from "../contexts/LanguageContext";
import type { MediaItem } from "../api/questions";

let AudioModule: typeof import("expo-av").Audio | null = null;
try { AudioModule = require("expo-av").Audio; } catch {}

interface MediaPlayerProps {
  media: MediaItem[];
  position: "question" | "answer";
  apiBaseUrl?: string;
  autoPlayAudio?: boolean;
}

export default function MediaPlayer({
  media,
  position,
  apiBaseUrl = "",
  autoPlayAudio = false,
}: MediaPlayerProps) {
  const { t } = useLanguage();
  const items = media.filter((m) => m.position === position);
  const soundRef = useRef<any>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (autoPlayAudio && AudioModule) {
      const audioItem = items.find((m) => m.type === "audio");
      if (audioItem) {
        playAudio(apiBaseUrl + audioItem.url);
      }
    }
  }, [items.map(i => i.url).join(","), autoPlayAudio]);

  const playAudio = async (uri: string) => {
    if (!AudioModule) return;
    try {
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
      const { sound } = await AudioModule.Sound.createAsync(
        { uri },
        { shouldPlay: true }
      );
      soundRef.current = sound;
      setPlaying(true);
      sound.setOnPlaybackStatusUpdate((status: any) => {
        if (status.didJustFinish) {
          setPlaying(false);
          sound.unloadAsync().catch(() => {});
          soundRef.current = null;
        }
      });
    } catch (err) {
      console.error("Audio play error:", err);
      setPlaying(false);
    }
  };

  const stopAudio = async () => {
    if (soundRef.current) {
      await soundRef.current.stopAsync();
      await soundRef.current.unloadAsync();
      soundRef.current = null;
      setPlaying(false);
    }
  };

  if (items.length === 0) return null;

  const screenWidth = Dimensions.get("window").width;
  const imageWidth = Math.min(screenWidth - 64, 400);

  return (
    <View style={styles.container}>
      {items.map((item, idx) => (
        <View key={idx} style={styles.mediaItem}>
          {item.type === "image" ? (
            <View>
              <Image
                source={{ uri: apiBaseUrl + item.url }}
                style={[styles.image, { width: imageWidth, height: imageWidth * 0.6 }]}
                resizeMode="contain"
              />
              {item.caption && (
                <Text style={styles.caption}>{item.caption}</Text>
              )}
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.audioBtn, playing && styles.audioBtnPlaying]}
              onPress={() => playing ? stopAudio() : playAudio(apiBaseUrl + item.url)}
            >
              <Text style={styles.audioBtnText}>
                {playing ? t("Stop", "停止") : t("Play Audio", "音声を再生")}
                {item.caption ? ` - ${item.caption}` : ""}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginVertical: 8 },
  mediaItem: { marginBottom: 8 },
  image: {
    borderRadius: 8,
    backgroundColor: "#f0f0f0",
    alignSelf: "center",
  },
  caption: {
    fontSize: 12,
    color: "#888",
    textAlign: "center",
    marginTop: 4,
  },
  audioBtn: {
    backgroundColor: "#E8F0FE",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  audioBtnPlaying: {
    backgroundColor: "#FFE8E8",
  },
  audioBtnText: {
    fontSize: 14,
    color: "#1a73e8",
    fontWeight: "500",
  },
});
