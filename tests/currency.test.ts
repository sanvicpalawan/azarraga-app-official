import { describe, expect, it } from "vitest";
import {
  CURRENCIES,
  CURRENCY_CODES,
  DEFAULT_CURRENCY,
  MINOR_UNIT,
  formatMoney,
  isCurrencyCode,
  parseMoneyInput,
  toMajor,
  toMinor,
} from "../lib/currency";

describe("money is integer centavos", () => {
  it("uses 100 minor units for every supported currency", () => {
    expect(MINOR_UNIT).toBe(100);
    expect(CURRENCY_CODES).toEqual(["PHP", "USD", "EUR"]);
    expect(DEFAULT_CURRENCY).toBe("PHP");
  });

  it("converts without losing precision", () => {
    expect(toMinor(1250.5)).toBe(125050);
    expect(toMinor(0.01)).toBe(1);
    expect(toMajor(125050)).toBe(1250.5);
    // The classic float trap: 0.1 + 0.2 !== 0.3 in floats, but centavos are exact.
    expect(toMinor(0.1) + toMinor(0.2)).toBe(toMinor(0.3));
  });
});

describe("formatMoney", () => {
  it("groups thousands and always shows two decimals", () => {
    expect(formatMoney(30129000, "PHP")).toContain("301,290.00");
    expect(formatMoney(125050, "PHP")).toContain("1,250.50");
    expect(formatMoney(125050, "USD")).toContain("1,250.50");
    expect(formatMoney(125050, "EUR")).toContain("1,250.50");
  });

  it("knows each currency's symbol and locale", () => {
    expect(CURRENCIES.PHP.symbol).toBe("₱");
    expect(CURRENCIES.USD.symbol).toBe("$");
    expect(CURRENCIES.EUR.symbol).toBe("€");
    expect(formatMoney(100000, "USD")).toContain("$");
  });

  it("formats zero cleanly", () => {
    expect(formatMoney(0, "PHP")).toContain("0.00");
  });
});

describe("parseMoneyInput", () => {
  it("accepts what a person types on a phone", () => {
    expect(parseMoneyInput("1,250.50")).toBe(125050);
    expect(parseMoneyInput("₱1250")).toBe(125000);
    expect(parseMoneyInput("1250")).toBe(125000);
    expect(parseMoneyInput("  99 ")).toBe(9900);
    expect(parseMoneyInput("$1,000.00")).toBe(100000);
  });

  it("returns zero for junk rather than NaN", () => {
    expect(parseMoneyInput("")).toBe(0);
    expect(parseMoneyInput("abc")).toBe(0);
    expect(parseMoneyInput("₱")).toBe(0);
  });
});

describe("isCurrencyCode", () => {
  it("accepts the three supported codes only", () => {
    expect(isCurrencyCode("PHP")).toBe(true);
    expect(isCurrencyCode("USD")).toBe(true);
    expect(isCurrencyCode("EUR")).toBe(true);
    expect(isCurrencyCode("GBP")).toBe(false);
    expect(isCurrencyCode("")).toBe(false);
  });
});
