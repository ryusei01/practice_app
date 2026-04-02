/**
 * AdBanner - プラットフォーム共通の広告バナーコンポーネント
 *
 * - Web: Google AdSense のインライン広告ユニットを表示
 * - モバイル (iOS / Android): react-native-google-mobile-ads のバナー広告を表示
 * - is_premium が true のユーザーには何も表示しない
 */
import React, { useEffect, useRef } from 'react';
import { Platform, View, StyleSheet } from 'react-native';
import { useAuth } from '../contexts/AuthContext';

// ----- 広告ユニット ID (環境変数で上書き可能) -----
const WEB_ADSENSE_CLIENT = 'ca-pub-9679910712332333';
// AdSense の広告スロット ID（実際のスロット ID に置き換えてください）
const WEB_AD_SLOT = process.env.EXPO_PUBLIC_AD_SLOT_WEB || '1234567890';

// モバイル用広告ユニット ID
const MOBILE_BANNER_ID_ANDROID =
  process.env.EXPO_PUBLIC_AD_UNIT_ANDROID ||
  'ca-app-pub-3940256099942544/6300978111'; // Google テスト用 ID
const MOBILE_BANNER_ID_IOS =
  process.env.EXPO_PUBLIC_AD_UNIT_IOS ||
  'ca-app-pub-3940256099942544/2934735716'; // Google テスト用 ID

// ----- Web 向け AdSense バナー -----
function WebAdBanner() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      // AdSense push
      // @ts-ignore
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (e) {
      // adsbygoogle が読み込まれる前に呼ばれた場合は無視
    }
  }, []);

  return (
    <div ref={containerRef} style={{ textAlign: 'center', overflow: 'hidden', margin: '8px 0' }}>
      <ins
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client={WEB_ADSENSE_CLIENT}
        data-ad-slot={WEB_AD_SLOT}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}

// ----- モバイル向けバナー (動的 import でビルドエラーを回避) -----
let MobileBannerAd: React.ComponentType<{ unitId: string; size: string }> | null = null;
let BannerAdSize: { BANNER: string } | null = null;

if (Platform.OS !== 'web') {
  try {
    // react-native-google-mobile-ads がインストールされている場合のみ使用
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mobileAds = require('react-native-google-mobile-ads');
    MobileBannerAd = mobileAds.BannerAd;
    BannerAdSize = mobileAds.BannerAdSize;
  } catch {
    // パッケージ未インストール時はモバイル広告をスキップ
  }
}

// ----- 公開コンポーネント -----
export default function AdBanner() {
  const { user } = useAuth();

  // プレミアムユーザーには広告を表示しない
  if (user?.is_premium) {
    return null;
  }

  if (Platform.OS === 'web') {
    return <WebAdBanner />;
  }

  // モバイル: パッケージが利用可能な場合のみ表示
  if (MobileBannerAd && BannerAdSize) {
    const unitId =
      Platform.OS === 'ios' ? MOBILE_BANNER_ID_IOS : MOBILE_BANNER_ID_ANDROID;
    return (
      <View style={styles.mobileContainer}>
        <MobileBannerAd unitId={unitId} size={BannerAdSize.BANNER} />
      </View>
    );
  }

  // パッケージ未インストール時はプレースホルダーを表示（開発用）
  if (__DEV__) {
    return (
      <View style={styles.devPlaceholder}>
        {/* 広告プレースホルダー (開発用) */}
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  mobileContainer: {
    alignItems: 'center',
    marginVertical: 8,
  },
  devPlaceholder: {
    height: 50,
    backgroundColor: '#e0e0e0',
    marginVertical: 8,
    borderRadius: 4,
  },
});
