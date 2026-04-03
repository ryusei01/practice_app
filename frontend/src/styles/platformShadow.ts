import { Platform, ViewStyle } from "react-native";

export type IosLikeShadow = {
  shadowColor: string;
  shadowOffset: { width: number; height: number };
  shadowOpacity: number;
  shadowRadius: number;
};

function toRgba(color: string, opacity: number): string {
  const c = color.trim();
  if (c.startsWith("rgba(")) return c;
  if (c.startsWith("rgb(")) {
    return c.replace("rgb(", "rgba(").replace(")", `, ${opacity})`);
  }
  let hex = c.replace("#", "");
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  }
  if (hex.length === 6) {
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${opacity})`;
  }
  return `rgba(0,0,0,${opacity})`;
}

/** Web では boxShadow のみ（shadow* 非推奨警告回避）、ネイティブは shadow* + Android elevation */
export function platformShadow(s: IosLikeShadow): ViewStyle {
  const { shadowColor, shadowOffset, shadowOpacity, shadowRadius } = s;
  const rgba = toRgba(shadowColor, shadowOpacity);
  const elevation = Math.max(1, Math.round(shadowRadius / 2));
  return Platform.select<ViewStyle>({
    web: {
      boxShadow: `${shadowOffset.width}px ${shadowOffset.height}px ${shadowRadius}px 0 ${rgba}`,
    },
    default: {
      shadowColor,
      shadowOffset,
      shadowOpacity,
      shadowRadius,
      elevation,
    },
  }) as ViewStyle;
}
