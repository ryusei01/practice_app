import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { getLocales } from 'expo-localization';

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

const getSystemLanguage = (): Language => {
  try {
    const locales = getLocales();
    const langCode = locales[0]?.languageCode ?? 'en';
    return langCode === 'ja' ? 'ja' : 'en';
  } catch (error) {
    console.error('Failed to get system language:', error);
    return 'en';
  }
};

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguageState] = useState<Language>('en');

  useEffect(() => {
    loadLanguage();
  }, []);

  const loadLanguage = async () => {
    try {
      // 1. Web環境でURLの ?lang= パラメータを最優先で確認
      if (Platform.OS === 'web') {
        const urlLang = new URLSearchParams(window.location.search).get('lang');
        if (urlLang === 'en' || urlLang === 'ja') {
          setLanguageState(urlLang);
          return;
        }
      }

      // 2. AsyncStorageの保存済み設定を確認
      const savedLanguage = await AsyncStorage.getItem('app_language');
      if (savedLanguage === 'en' || savedLanguage === 'ja') {
        // 保存された言語設定がある場合はそれを使用
        setLanguageState(savedLanguage);
      } else {
        // 3. 保存された設定がない場合はシステム言語を検出
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
