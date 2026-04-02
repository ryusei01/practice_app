import { useEffect } from "react";
import { Platform } from "react-native";

const GTAG_ID = "G-XT4CVC965E";
const ADSENSE_CLIENT = "ca-pub-9679910712332333";

/**
 * expo-router の Head 経由だと script に data-rh が付き AdSense が警告するため、
 * DOM に直接挿入する。
 */
export function WebThirdPartyScripts() {
  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;

    const gtagSrc = `https://www.googletagmanager.com/gtag/js?id=${GTAG_ID}`;
    if (!document.querySelector(`script[src="${gtagSrc}"]`)) {
      const gtag = document.createElement("script");
      gtag.async = true;
      gtag.src = gtagSrc;
      document.head.appendChild(gtag);
    }

    const inlineId = "app-gtag-inline";
    if (!document.getElementById(inlineId)) {
      const inline = document.createElement("script");
      inline.id = inlineId;
      inline.textContent = `
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', '${GTAG_ID}');
      `;
      document.head.appendChild(inline);
    }

    const adsSrc = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`;
    if (!document.querySelector(`script[src^="${adsSrc.split("?")[0]}"]`)) {
      const ads = document.createElement("script");
      ads.async = true;
      ads.src = adsSrc;
      ads.crossOrigin = "anonymous";
      document.head.appendChild(ads);
    }
  }, []);

  return null;
}
