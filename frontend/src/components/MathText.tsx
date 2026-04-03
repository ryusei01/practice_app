import React, { useMemo } from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
import { WebView } from "react-native-webview";

interface MathTextProps {
  text: string;
  style?: any;
  fontSize?: number;
  color?: string;
}

type Segment = { type: "text"; value: string } | { type: "math"; value: string; display: boolean };

const MATH_REGEX = /(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$)/g;

function parseSegments(text: string): Segment[] {
  const segments: Segment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  MATH_REGEX.lastIndex = 0;
  while ((match = MATH_REGEX.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", value: text.slice(lastIndex, match.index) });
    }
    const raw = match[0];
    const isBlock = raw.startsWith("$$");
    const inner = isBlock ? raw.slice(2, -2).trim() : raw.slice(1, -1).trim();
    segments.push({ type: "math", value: inner, display: isBlock });
    lastIndex = match.index + raw.length;
  }
  if (lastIndex < text.length) {
    segments.push({ type: "text", value: text.slice(lastIndex) });
  }
  return segments;
}

function hasMath(text: string): boolean {
  return /\$/.test(text);
}

const KATEX_CSS_CDN = "https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css";
const KATEX_JS_CDN = "https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js";

function buildHtml(segments: Segment[], fontSize: number, color: string): string {
  const body = segments.map(seg => {
    if (seg.type === "text") {
      const escaped = seg.value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br/>");
      return `<span>${escaped}</span>`;
    }
    return `<span class="math-placeholder" data-tex="${seg.value.replace(/"/g, "&quot;")}" data-display="${seg.display}"></span>`;
  }).join("");

  return `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<link rel="stylesheet" href="${KATEX_CSS_CDN}">
<script src="${KATEX_JS_CDN}"></script>
<style>
body{margin:0;padding:4px 0;font-size:${fontSize}px;color:${color};font-family:system-ui,-apple-system,sans-serif;line-height:1.5;background:transparent;}
.katex{font-size:1em;}
.katex-display{margin:8px 0;overflow-x:auto;}
</style></head><body>
<div id="content">${body}</div>
<script>
document.querySelectorAll('.math-placeholder').forEach(function(el){
  var tex=el.getAttribute('data-tex');
  var display=el.getAttribute('data-display')==='true';
  try{katex.render(tex,el,{displayMode:display,throwOnError:false});}
  catch(e){el.textContent=tex;}
});
var h=document.body.scrollHeight;
window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify({height:h}));
</script></body></html>`;
}

export default function MathText({ text, style, fontSize = 15, color = "#333" }: MathTextProps) {
  const segments = useMemo(() => parseSegments(text), [text]);
  const containsMath = useMemo(() => hasMath(text), [text]);

  if (!containsMath) {
    return <Text style={style}>{text}</Text>;
  }

  const [height, setHeight] = React.useState(60);
  const html = useMemo(() => buildHtml(segments, fontSize, color), [segments, fontSize, color]);

  if (Platform.OS === "web") {
    return (
      <View style={[styles.webContainer, style]}>
        {segments.map((seg, i) =>
          seg.type === "text" ? (
            <Text key={i} style={{ fontSize, color }}>{seg.value}</Text>
          ) : (
            <Text key={i} style={{ fontSize, color, fontFamily: "monospace" }}>{seg.value}</Text>
          )
        )}
      </View>
    );
  }

  return (
    <View style={[{ height }, style]}>
      <WebView
        source={{ html }}
        style={{ backgroundColor: "transparent", height }}
        scrollEnabled={false}
        showsVerticalScrollIndicator={false}
        onMessage={(event) => {
          try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.height && data.height !== height) {
              setHeight(Math.ceil(data.height) + 8);
            }
          } catch {}
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  webContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
  },
});
