import { describe, expect, it } from "vitest";
import { addDays, isIntervalOption, isQuantity, jstToday, taxIncluded, validateOrderForm } from "../src/domain";
import { MESSAGES } from "../src/messages";

const VALID_FORM = { name: "山田太郎", address: "東京都渋谷区1-1-1", phone: "09012345678" };

describe("税込計算", () => {
  it("小数点以下を切り捨てる（旧版 int(subtotal * 1.10) と同じ）", () => {
    expect(taxIncluded(198)).toBe(217);
    expect(taxIncluded(596)).toBe(655);
    expect(taxIncluded(0)).toBe(0);
  });
});

describe("JST の日付計算", () => {
  it("UTC 15:00 以降は JST で翌日になる", () => {
    expect(jstToday(new Date("2026-11-03T14:59:59Z"))).toBe("2026-11-03");
    expect(jstToday(new Date("2026-11-03T15:00:00Z"))).toBe("2026-11-04");
  });

  it("月またぎ・うるう年を正しく加算する", () => {
    expect(addDays("2026-01-31", 14)).toBe("2026-02-14");
    expect(addDays("2028-02-20", 14)).toBe("2028-03-05");
    expect(addDays("2026-11-04", 60)).toBe("2027-01-03");
  });
});

describe("入力検証", () => {
  it("正しい入力ならエラーなし", () => {
    expect(validateOrderForm(VALID_FORM)).toEqual([]);
  });

  it("氏名は 1〜100 文字（コードポイント単位）", () => {
    expect(validateOrderForm({ ...VALID_FORM, name: "" })).toEqual([MESSAGES.nameLength]);
    expect(validateOrderForm({ ...VALID_FORM, name: "あ".repeat(100) })).toEqual([]);
    expect(validateOrderForm({ ...VALID_FORM, name: "あ".repeat(101) })).toEqual([MESSAGES.nameLength]);
  });

  it("住所は 1〜255 文字", () => {
    expect(validateOrderForm({ ...VALID_FORM, address: "" })).toEqual([MESSAGES.addressLength]);
    expect(validateOrderForm({ ...VALID_FORM, address: "番".repeat(255) })).toEqual([]);
    expect(validateOrderForm({ ...VALID_FORM, address: "番".repeat(256) })).toEqual([MESSAGES.addressLength]);
  });

  it("電話番号は数字のみ 10〜11 桁", () => {
    expect(validateOrderForm({ ...VALID_FORM, phone: "0901234567" })).toEqual([]);
    expect(validateOrderForm({ ...VALID_FORM, phone: "090123456" })).toEqual([MESSAGES.phoneFormat]);
    expect(validateOrderForm({ ...VALID_FORM, phone: "090123456789" })).toEqual([MESSAGES.phoneFormat]);
    expect(validateOrderForm({ ...VALID_FORM, phone: "090-1234-5678" })).toEqual([MESSAGES.phoneFormat]);
    expect(validateOrderForm({ ...VALID_FORM, phone: "" })).toEqual([MESSAGES.phoneFormat]);
  });

  it("数量・間隔の判定", () => {
    expect(isQuantity(1)).toBe(true);
    expect(isQuantity(5)).toBe(true);
    expect(isQuantity(6)).toBe(false);
    expect(isQuantity(1.5)).toBe(false);
    expect(isIntervalOption(14)).toBe(true);
    expect(isIntervalOption(7)).toBe(false);
    expect(isIntervalOption("30")).toBe(false);
  });
});

