/**
 * Display currency.
 *
 * The model costs entirely in INR — that is the manufacturing reality and the
 * only currency any rate master is quoted in. This module converts for DISPLAY
 * only, at the variant's own FX rate, so a buyer-facing USD figure and the
 * internal INR figure can never drift: there is one number, formatted twice.
 *
 * Nothing here writes back into the model.
 */

export type DisplayCurrency = "INR" | "USD";

export type MoneyFormatter = {
  currency: DisplayCurrency;
  /** format an INR amount in the display currency */
  (amountInr: number, decimals?: number): string;
  /** the symbol alone, for column headers and unit suffixes */
  symbol: string;
  /** convert without formatting — for sorting or further math */
  convert: (amountInr: number) => number;
};

const SYMBOL: Record<DisplayCurrency, string> = { INR: "₹", USD: "$" };

/**
 * Build a formatter bound to one currency and FX rate.
 *
 * `fxRate` is ₹ per $. A rate of 0 or less would produce Infinity, so it falls
 * back to 1 — an obviously wrong number is better than a blank cell.
 */
export function createMoney(currency: DisplayCurrency, fxRate: number): MoneyFormatter {
  const rate = currency === "USD" ? (fxRate > 0 ? fxRate : 1) : 1;
  const convert = (amountInr: number) => amountInr / rate;

  const fmt = ((amountInr: number, decimals = 2) => {
    const value = convert(amountInr);
    const locale = currency === "INR" ? "en-IN" : "en-US";
    return `${SYMBOL[currency]}${value.toLocaleString(locale, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })}`;
  }) as MoneyFormatter;

  fmt.currency = currency;
  fmt.symbol = SYMBOL[currency];
  fmt.convert = convert;
  return fmt;
}
