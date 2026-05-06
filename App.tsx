import { useRef, useState, useEffect } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";
import { t } from "./i18n";

const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? "";
const STORAGE_KEY = "fuda_scan_results_v2";

type ScanResult = {
  id: string;
  name: string;
  price: string;
  time: string;
};

async function callGemini(base64Image: string): Promise<{ name: string; price: string }> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: 'この値札から商品名と価格を読み取って、必ず以下のJSON形式で返してください。マークダウンや他の文字は一切含めず、JSONのみ返してください。\n{"name": "メーカー 商品名", "price": "¥1,280"}\n価格は「¥1,280」の形式。商品名にはメーカー名と商品名を半角スペース区切りで含めてください（メーカー名がない場合は商品名のみ）。商品名内のスペースは全て半角スペースを使用してください。',
              },
              {
                inline_data: { mime_type: "image/jpeg", data: base64Image },
              },
            ],
          },
        ],
      }),
    }
  );
  const data = await res.json();
  console.log("Gemini response:", JSON.stringify(data, null, 2));
  if (data.error) {
    throw new Error(data.error.message ?? "API error");
  }
  let text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  // マークダウンの ```json ... ``` を除去
  text = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
  try {
    const parsed = JSON.parse(text);
    return {
      name: parsed.name ?? t.unknown,
      price: parsed.price ?? "",
    };
  } catch {
    throw new Error(t.parseError);
  }
}

export default function App() {
  const [permission, requestPermission] = useCameraPermissions();
  const [results, setResults] = useState<ScanResult[]>([]);
  const [scanCount, setScanCount] = useState(0);
  const [showHistory, setShowHistory] = useState(false);
  const [isRateLimited, setIsRateLimited] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  useEffect(() => {
    const load = async ()=>{
      const json = await AsyncStorage.getItem(STORAGE_KEY);
      if (json) setResults(JSON.parse(json));
  };
    load();
  },[]);

  useEffect(() => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(results));
  },[results]);

  const handleScan = async () => {
    if (scanCount >= 3 || isRateLimited || !cameraRef.current) return;
    setScanCount((c) => c + 1);

    try {
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.7,
      });
      if (!photo?.base64) throw new Error(t.captureFailed);
      const result = await callGemini(photo.base64);
      setResults((prev) => [
        {
          id: Date.now().toString() + Math.random().toString().slice(2, 8),
          name: result.name,
          price: result.price,
          time: new Date().toLocaleTimeString("ja-JP"),
        },
        ...prev,
      ]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : t.unknownError;
      if (msg.includes("quota") || msg.includes("rate") || msg.includes("retry")) {
        setIsRateLimited(true);
        setTimeout(() => setIsRateLimited(false), 30000);
        Alert.alert(t.waitTitle, t.waitMessage);
      } else if (msg.includes("high demand") || msg.includes("overloaded") || msg.includes("503")) {
        setIsRateLimited(true);
        setTimeout(() => setIsRateLimited(false), 15000);
        Alert.alert(t.busyTitle, t.busyMessage);
      } else if (msg.includes(t.parseError) || msg.includes("解析に失敗") || msg.includes("parse")) {
        Alert.alert(t.parseFailedTitle, t.parseFailedMessage);
      } else {
        Alert.alert(t.networkErrorTitle, t.networkErrorMessage);
      }
    } finally {
      setScanCount((c) => c - 1);
    }
  };

  const handleDelete = (id: string) => {
    setResults((prev) => prev.filter((r) => r.id !== id));
  };

  const handleCopy = async (text: string) => {
    await Clipboard.setStringAsync(text);
    Alert.alert(t.copied, text);
  };

  const handleCopyAll = async () => {
    if (results.length === 0) return;
    const text = results.map((r) => `${r.name} ${r.price}`).join("\n");
    await Clipboard.setStringAsync(text);
    Alert.alert(t.copiedAll, t.itemsCount(results.length));
  };

  const handleDeleteAll = () => {
    Alert.alert(t.confirmDeleteAllTitle, t.confirmDeleteAllMessage, [
      { text: t.cancel, style: "cancel" },
      { text: t.delete, style: "destructive", onPress: () => setResults([]) },
    ]);
  };

  if (!permission) return <View style={styles.container} />;

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.permText}>{t.permissionRequired}</Text>
        <TouchableOpacity style={styles.permButton} onPress={requestPermission}>
          <Text style={styles.permButtonText}>{t.allowPermission}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* カメラ（画面の大部分） */}
      <View style={styles.camera}>
        <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />

        {/* 上部ガイドテキスト */}
        <View style={styles.topBar}>
          <Text style={styles.topBarText}>{t.cameraGuide}</Text>
        </View>

        {/* シャッターボタン */}
        <View style={styles.shutterArea}>
          <TouchableOpacity
            style={[
              styles.shutterButton,
              (scanCount >= 3 || isRateLimited) && styles.shutterButtonDisabled,
            ]}
            onPress={handleScan}
            disabled={scanCount >= 3 || isRateLimited}
            activeOpacity={0.7}
          >
            {scanCount >= 3 || isRateLimited ? (
              <ActivityIndicator size="large" color="#bbb" />
            ) : (
              <View style={styles.shutterInner} />
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* 下部パネル */}
      <View style={styles.bottomPanel}>
        {/* 履歴を開閉するハンドル */}
        <TouchableOpacity
          style={styles.dragHandle}
          onPress={() => setShowHistory((v) => !v)}
        >
          <View style={styles.dragBar} />
          <Text style={styles.historyLabel}>
            {t.scanHistory}（{t.itemsCount(results.length)}）{showHistory ? " ▼" : " ▲"}
          </Text>
        </TouchableOpacity>

        {/* 最新の結果（履歴を閉じているとき） */}
        {!showHistory && (
          <View style={styles.latestArea}>
            {results.length > 0 ? (
              <View style={styles.resultRow}>
                <TouchableOpacity
                  style={{ flex: 1 }}
                  onPress={() => handleCopy(results[0].name)}
                >
                  <Text style={styles.latestText} numberOfLines={2}>
                    {results[0].name} {results[0].price}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.shareButton}
                  onPress={() => handleDelete(results[0].id)}
                >
                  <Text style={styles.shareButtonText}>{t.delete}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={styles.emptyText}>{t.tapToScan}</Text>
            )}
          </View>
        )}

        {/* 履歴一覧（履歴を開いているとき） */}
        {showHistory && (
          <ScrollView style={styles.historyList}>
            {/* 全コピー・全削除ボタン */}
            {results.length > 0 && (
              <View style={styles.bulkActions}>
                <TouchableOpacity style={styles.bulkButton} onPress={handleCopyAll}>
                  <Text style={styles.bulkButtonText}>{t.copyAll}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.bulkButtonDanger} onPress={handleDeleteAll}>
                  <Text style={styles.bulkButtonText}>{t.deleteAll}</Text>
                </TouchableOpacity>
              </View>
            )}

            {results.length === 0 ? (
              <Text style={styles.emptyText}>{t.noScansYet}</Text>
            ) : (
              results.map((r) => (
                <View key={r.id} style={styles.historyItem}>
                  <TouchableOpacity
                    style={styles.historyLeft}
                    onPress={() => handleCopy(r.name)}
                  >
                    <Text style={styles.historyTime}>{r.time}</Text>
                    <Text style={styles.historyText}>
                      {r.name}
                    </Text>
                    <Text style={styles.historyText}>
                      {r.price}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.shareButton}
                    onPress={() => handleDelete(r.id)}
                  >
                    <Text style={styles.shareButtonText}>{t.delete}</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </ScrollView>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#000",
  },
  permText: { color: "#fff", fontSize: 16, marginBottom: 16 },
  permButton: {
    backgroundColor: "#1976d2",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  permButtonText: { color: "#fff", fontSize: 16, fontWeight: "bold" },

  camera: { flex: 1 },
  topBar: {
    position: "absolute",
    top: 60,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  shutterArea: {
    position: "absolute",
    bottom: 30,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  shutterButton: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "rgba(255,255,255,0.3)",
    borderWidth: 4,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  shutterInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#fff",
  },
  shutterButtonDisabled: {
    backgroundColor: "rgba(120,120,120,0.3)",
    borderColor: "#888",
  },
  topBarText: {
    color: "#fff",
    fontSize: 14,
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },

  bottomPanel: { backgroundColor: "#1a1a1a" },
  dragHandle: { alignItems: "center", paddingVertical: 12 },
  dragBar: {
    width: 40,
    height: 4,
    backgroundColor: "#555",
    borderRadius: 2,
    marginBottom: 6,
  },
  historyLabel: { color: "#aaa", fontSize: 13 },

  latestArea: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    minHeight: 80,
    justifyContent: "center",
  },
  resultRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  latestText: { flex: 1, color: "#fff", fontSize: 18, fontWeight: "bold" },
  emptyText: {
    color: "#555",
    fontSize: 14,
    textAlign: "center",
    paddingVertical: 24,
  },

  shareButton: {
    backgroundColor: "#1976d2",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  shareButtonText: { color: "#fff", fontSize: 13, fontWeight: "bold" },

  historyList: { maxHeight: 300, paddingHorizontal: 16 },
  bulkActions: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#333",
    marginBottom: 4,
  },
  bulkButton: {
    flex: 1,
    backgroundColor: "#1976d2",
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  bulkButtonDanger: {
    flex: 1,
    backgroundColor: "#c62828",
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  bulkButtonText: { color: "#fff", fontSize: 14, fontWeight: "bold" },
  historyItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#333",
    gap: 12,
  },
  historyLeft: { flex: 1 },
  historyTime: { color: "#666", fontSize: 11, marginBottom: 4 },
  historyText: { color: "#fff", fontSize: 15 },
});
