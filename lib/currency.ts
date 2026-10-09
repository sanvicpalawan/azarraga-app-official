export const CURRENCIES = {
  PHP: { code: "PHP", symbol: "₱", name: "Philippine Peso", locale: "en-PH" },
  USD: { code: "USD", symbol: "$", name: "US Dollar", locale: "en-US" },
  EUR: { code: "EUR", symbol: "€", name: "Euro", locale: "en-IE" },
} as const;

export type CurrencyCode = keyof typeof CURRENCIES;

export const DEFAULT_CURRENCY: CurrencyCode = "PHP";
export const CURRENCY_CODES = Object.keys(CURRENCIES) as CurrencyCode[];

/** All three currencies use 2 decimal places (100 minor units). */
export const MINOR_UNIT = 100;

export const toMinor = (major: number): number => Math.round(major * MINOR_UNIT);
export const toMajor = (minor: number): number => minor / MINOR_UNIT;

export function formatMoney(minor: number, code: CurrencyCode = DEFAULT_CURRENCY): string {
  return new Intl.NumberFormat(CURRENCIES[code].locale, {
    style: "currency",
    currency: code,
  }).format(toMajor(minor));
}

/** Parse a user-typed amount ("1,250.50", "₱1250") into minor units. */
export function parseMoneyInput(input: string): number {
  const cleaned = input.replace(/[^0-9.\-]/g, "");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? toMinor(n) : 0;
}

export function isCurrencyCode(v: string): v is CurrencyCode {
  return v in CURRENCIES;
}
