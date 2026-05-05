import React from "react";
import { View, StyleSheet, Platform } from "react-native";
import { WebView } from "react-native-webview";

export type MapPoint = {
  lat: number;
  lng: number;
  title: string;
  order: number;
};

type Props = {
  points: MapPoint[];
  height?: number | string;
};

function buildHtml(points: MapPoint[]) {
  const valid = points.filter((p) => typeof p.lat === "number" && typeof p.lng === "number");
  const center = valid.length
    ? [valid[0].lat, valid[0].lng]
    : [20, 0];
  const data = JSON.stringify(valid);
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>
  html, body, #map { height: 100%; margin: 0; padding: 0; background:#0A0A0A; }
  .num-pin {
    background: #FF6900;
    color: #fff;
    border-radius: 999px;
    width: 28px; height: 28px;
    display:flex; align-items:center; justify-content:center;
    font-weight: 800; font-family: -apple-system, system-ui, sans-serif;
    box-shadow: 0 0 0 3px rgba(255,105,0,0.30), 0 6px 14px rgba(0,0,0,0.6);
    border: 1px solid #fff2;
  }
  .leaflet-container { background:#0A0A0A; }
</style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  const points = ${data};
  const map = L.map('map', { zoomControl: false, attributionControl: false }).setView([${center[0]}, ${center[1]}], 8);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 19,
  }).addTo(map);
  const latlngs = [];
  points.forEach((p, i) => {
    const icon = L.divIcon({
      className: '',
      html: '<div class="num-pin">' + (i+1) + '</div>',
      iconSize: [28,28],
      iconAnchor: [14,14],
    });
    const m = L.marker([p.lat, p.lng], { icon }).addTo(map);
    m.bindPopup('<b>' + (i+1) + '. ' + (p.title||'') + '</b>');
    latlngs.push([p.lat, p.lng]);
  });
  if (latlngs.length > 1) {
    L.polyline(latlngs, { color: '#FF6900', weight: 3, opacity: 0.9, dashArray: '6 8' }).addTo(map);
    map.fitBounds(L.latLngBounds(latlngs).pad(0.3));
  } else if (latlngs.length === 1) {
    map.setView(latlngs[0], 11);
  }
</script>
</body>
</html>`;
}

export default function QuestMap({ points, height = 280 }: Props) {
  const html = buildHtml(points);
  if (Platform.OS === "web") {
    return (
      <View style={[styles.wrap, { height }]}>
        <iframe
          srcDoc={html}
          style={{ border: 0, width: "100%", height: "100%", borderRadius: 22 }}
          title="map"
        />
      </View>
    );
  }
  return (
    <View style={[styles.wrap, { height }]}>
      <WebView
        originWhitelist={["*"]}
        source={{ html }}
        style={{ backgroundColor: "#0A0A0A", borderRadius: 22 }}
        javaScriptEnabled
        domStorageEnabled
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    borderRadius: 22,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
});
