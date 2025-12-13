import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, NativeModules } from 'react-native';

type Language = 'en' | 'ja';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => Promise<void>;
  t: (en: string, ja: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

// システムの言語を取得
const getSystemLanguage = (): Language => {
  try {
    let systemLang = 'en';

    if (Platform.OS === 'web') {
      // Web: ブラウザの言語設定を取得
      systemLang = navigator.language || navigator.languages?.[0] || 'en';
    } else if (Platform.OS === 'ios') {
      // iOS: ネイティブモジュールから取得
      systemLang =
        NativeModules.SettingsManager?.settings?.AppleLocale ||
        NativeModules.SettingsManager?.settings?.AppleLanguages?.[0] ||
        'en';
    } else if (Platform.OS === 'android') {
      // Android: ネイティブモジュールから取得
      systemLang = NativeModules.I18nManager?.localeIdentifier || 'en';
    }

    // 言語コードを正規化（例: "ja-JP" -> "ja", "en-US" -> "en"）
    const langCode = systemLang.split('-')[0].toLowerCase();

    // 日本語の場合は 'ja'、それ以外は 'en'
    return langCode === 'ja' ? 'ja' : 'en';
  } catch (error) {
    console.error('Failed to get system language:', error);
    return 'en'; // デフォルトは英語
  }
};

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguageState] = useState<Language>('en');

  useEffect(() => {
    loadLanguage();
  }, []);

  const loadLanguage = async () => {
    try {
      const savedLanguage = await AsyncStorage.getItem('app_language');
      if (savedLanguage === 'en' || savedLanguage === 'ja') {
        // 保存された言語設定がある場合はそれを使用
        setLanguageState(savedLanguage);
      } else {
        // 保存された設定がない場合はシステム言語を検出
        const systemLang = getSystemLanguage();
        console.log('[LanguageContext] Detected system language:', systemLang);
        setLanguageState(systemLang);
      }
    } catch (error) {
      console.error('Failed to load language:', error);
      // エラー時はシステム言語を使用
      setLanguageState(getSystemLanguage());
    }
  };

  const setLanguage = async (lang: Language) => {
    try {
      await AsyncStorage.setItem('app_language', lang);
      setLanguageState(lang);
    } catch (error) {
      console.error('Failed to save language:', error);
    }
  };

  const t = (en: string, ja: string) => {
    return language === 'ja' ? ja : en;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};
