// 利用者向け文字列は本ファイルに集約する（CLAUDE.md「文字列リテラルは設定ファイルまたは DB に分離する」）。
export const MESSAGES = {
  invalidInput: "入力値が不正です。",
  productUnavailable: "この商品は現在購入できません。",
  itemNotFound: "対象のカートアイテムが見つかりません。",
  subNotFound: "対象のサブスクリプションが見つかりません。",
  invalidInterval: "配送間隔が不正です。",
  subPauseNotAllowed: "有効なサブスクリプションのみ一時停止できます。",
  subResumeNotAllowed: "停止中のサブスクリプションのみ再開できます。",
  subIntervalChangeNotAllowed: "有効なサブスクリプションのみ変更できます。",
  honeypotDetected: "不正なリクエストを検知しました。",
  cartEmpty: "カートに商品がありません。",
  orderValidationFailed: "入力内容を確認してください。",
  nameLength: "氏名は1〜100文字で入力してください。",
  addressLength: "住所は1〜255文字で入力してください。",
  phoneFormat: "電話番号は数字のみ・10〜11桁で入力してください。",
  apiNotFound: "APIが見つかりません。",
  internalError: "サーバーでエラーが発生しました。"
} as const;
