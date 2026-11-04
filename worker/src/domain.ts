import { MESSAGES } from "./messages";

// 値は SPEC/api.md・SPEC/er-diagram.md の仕様から。
export const INTERVAL_OPTIONS = [14, 30, 60] as const;
export type IntervalDays = (typeof INTERVAL_OPTIONS)[number];
export const QUANTITY_MIN = 1;
export const QUANTITY_MAX = 5;
export const TAX_RATE = 1.1;

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export function isIntervalOption(value: unknown): value is IntervalDays {
  return typeof value === "number" && (INTERVAL_OPTIONS as readonly number[]).includes(value);
}

export function isQuantity(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= QUANTITY_MIN &&
    value <= QUANTITY_MAX
  );
}

export function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

// 税込金額は小数点以下切り捨て（旧 Flask 版 int(subtotal * 1.10) と同じ）。
export function taxIncluded(amount: number): number {
  return Math.trunc(amount * TAX_RATE);
}

// 旧版の date.today() はサーバー時刻依存だったが、日本向けサービスのため JST の日付で統一する。
export function jstToday(now: Date): string {
  return new Date(now.getTime() + JST_OFFSET_MS).toISOString().slice(0, 10);
}

export function addDays(ymd: string, days: number): string {
  const base = Date.parse(`${ymd}T00:00:00Z`);
  return new Date(base + days * DAY_MS).toISOString().slice(0, 10);
}

export interface OrderFormInput {
  name: string;
  address: string;
  phone: string;
}

// 旧版 models.Order.validate と同じ規則。文字数は Python の len と同じくコードポイント単位で数える。
export function validateOrderForm(input: OrderFormInput): string[] {
  const errors: string[] = [];
  const nameLength = [...input.name].length;
  const addressLength = [...input.address].length;
  if (nameLength < 1 || nameLength > 100) {
    errors.push(MESSAGES.nameLength);
  }
  if (addressLength < 1 || addressLength > 255) {
    errors.push(MESSAGES.addressLength);
  }
  const phoneLength = input.phone.length;
  if (!/^[0-9]+$/.test(input.phone) || phoneLength < 10 || phoneLength > 11) {
    errors.push(MESSAGES.phoneFormat);
  }
  return errors;
}
