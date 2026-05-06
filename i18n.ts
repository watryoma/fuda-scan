import * as Localization from "expo-localization";

// 全テキストを言語別にまとめた辞書
const dictionary = {
  ja: {
    // カメラ画面
    cameraGuide: "値札にカメラを向けてボタンをタップ",
    permissionRequired: "カメラの許可が必要です",
    allowPermission: "許可する",
    tapToScan: "タップしてスキャン開始",

    // 履歴
    scanHistory: "スキャン履歴",
    noScansYet: "まだスキャンしていません",
    delete: "削除",
    copyAll: "全てコピー",
    deleteAll: "全て削除",

    // アラート
    confirmDeleteAllTitle: "全て削除",
    confirmDeleteAllMessage: "本当に全て削除しますか？",
    cancel: "キャンセル",
    copied: "コピーしました",
    copiedAll: "全てコピーしました",

    // エラー
    waitTitle: "少し待ってください",
    waitMessage: "30秒ほど待ってから再度お試しください。",
    busyTitle: "混み合っています",
    busyMessage: "サーバーが混み合っています。少し待ってからお試しください。",
    parseFailedTitle: "読み取り失敗",
    parseFailedMessage: "値札がうまく読み取れませんでした。明るい場所で撮り直してください。",
    networkErrorTitle: "エラー",
    networkErrorMessage: "通信エラーが発生しました。電波状況を確認してください。",
    unknownError: "不明なエラー",
    captureFailed: "撮影失敗",
    parseError: "読み取り結果の解析に失敗",
    unknown: "不明",

    // 単位
    itemsCount: (n: number) => `${n}件`,
  },

  en: {
    // Camera
    cameraGuide: "Point camera at price tag and tap the button",
    permissionRequired: "Camera permission required",
    allowPermission: "Allow",
    tapToScan: "Tap to start scanning",

    // History
    scanHistory: "Scan History",
    noScansYet: "No scans yet",
    delete: "Delete",
    copyAll: "Copy All",
    deleteAll: "Delete All",

    // Alerts
    confirmDeleteAllTitle: "Delete All",
    confirmDeleteAllMessage: "Are you sure you want to delete all?",
    cancel: "Cancel",
    copied: "Copied",
    copiedAll: "All Copied",

    // Errors
    waitTitle: "Please Wait",
    waitMessage: "Please try again in 30 seconds.",
    busyTitle: "Server Busy",
    busyMessage: "The server is busy. Please try again shortly.",
    parseFailedTitle: "Reading Failed",
    parseFailedMessage: "Could not read the price tag. Please try again in better lighting.",
    networkErrorTitle: "Error",
    networkErrorMessage: "Network error. Please check your connection.",
    unknownError: "Unknown error",
    captureFailed: "Capture failed",
    parseError: "Failed to parse result",
    unknown: "Unknown",

    // Units
    itemsCount: (n: number) => `${n} items`,
  },
};

// ユーザーのデバイスの言語を判定
const deviceLocale = Localization.getLocales()[0]?.languageCode ?? "en";

// ja以外は全部英語にする（フランス語ユーザーなどへの対応）
const lang: "ja" | "en" = deviceLocale === "ja" ? "ja" : "en";

// 使うときは t.delete のように書く
export const t = dictionary[lang];
