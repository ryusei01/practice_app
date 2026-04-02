/**
 * Web 専用 AdBanner
 * - Web: Google AdSense のインライン広告ユニットを表示
 * - is_premium が true のユーザーには何も表示しない
 */
import React, { useEffect, useRef } from "react";
import { useAuth } from "../contexts/AuthContext";

const WEB_ADSENSE_CLIENT = "ca-pub-9679910712332333";
const WEB_AD_SLOT = process.env.EXPO_PUBLIC_AD_SLOT_WEB || "1234567890";

function WebAdBanner() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      // @ts-ignore
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // adsbygoogle が読み込まれる前に呼ばれた場合は無視
    }
  }, []);

  return (
    <div
      ref={containerRef}
      style={{ textAlign: "center", overflow: "hidden", margin: "8px 0" }}
    >
      <ins
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={WEB_ADSENSE_CLIENT}
        data-ad-slot={WEB_AD_SLOT}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}

export default function AdBanner() {
  const { user } = useAuth();
  if (user?.is_premium) return null;
  return <WebAdBanner />;
}

