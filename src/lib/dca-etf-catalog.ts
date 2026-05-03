/**
 * ETF whitelist for Revolut Trading (Poland).
 *
 * Scope: US-listed ETFs, fractional-share friendly. Revolut handles PLN→USD FX
 * automatically on purchase, so amounts on this app stay in user currency.
 *
 * Expense ratios are decimals (0.0003 = 0.03%). Verify against current Revolut
 * availability before relying on this in production.
 */

export type AssetClass = "equity" | "bond";
export type Region = "global" | "us" | "ex_us" | "emerging" | "developed_ex_us";

export interface EtfMeta {
  ticker: string;
  name: string;
  isin: string;
  asset_class: AssetClass;
  region: Region;
  expense_ratio: number;
  description: string;
}

export const ETF_CATALOG: readonly EtfMeta[] = [
  {
    ticker: "VT",
    name: "Vanguard Total World Stock ETF",
    isin: "US9220427424",
    asset_class: "equity",
    region: "global",
    expense_ratio: 0.0007,
    description:
      "Single-fund global equity exposure across developed and emerging markets.",
  },
  {
    ticker: "VTI",
    name: "Vanguard Total Stock Market ETF",
    isin: "US9229087690",
    asset_class: "equity",
    region: "us",
    expense_ratio: 0.0003,
    description:
      "Broad US equity market — every listed US stock, weighted by market cap.",
  },
  {
    ticker: "VXUS",
    name: "Vanguard Total International Stock ETF",
    isin: "US9219097683",
    asset_class: "equity",
    region: "ex_us",
    expense_ratio: 0.0007,
    description:
      "Non-US equity, both developed and emerging markets. Pairs with VTI.",
  },
  {
    ticker: "VOO",
    name: "Vanguard S&P 500 ETF",
    isin: "US9229083632",
    asset_class: "equity",
    region: "us",
    expense_ratio: 0.0003,
    description: "Tracks the S&P 500 — 500 largest US companies by market cap.",
  },
  {
    ticker: "QQQ",
    name: "Invesco QQQ Trust",
    isin: "US46090E1038",
    asset_class: "equity",
    region: "us",
    expense_ratio: 0.002,
    description:
      "Nasdaq-100. Tech-heavy, more volatile than broad-market funds.",
  },
  {
    ticker: "VWO",
    name: "Vanguard FTSE Emerging Markets ETF",
    isin: "US9220428588",
    asset_class: "equity",
    region: "emerging",
    expense_ratio: 0.0008,
    description: "Emerging-market equities across multiple regions.",
  },
  {
    ticker: "BND",
    name: "Vanguard Total Bond Market ETF",
    isin: "US9219378356",
    asset_class: "bond",
    region: "us",
    expense_ratio: 0.0003,
    description: "Broad US investment-grade bond market.",
  },
  {
    ticker: "BNDW",
    name: "Vanguard Total World Bond ETF",
    isin: "US92206C8146",
    asset_class: "bond",
    region: "global",
    expense_ratio: 0.0005,
    description: "Global investment-grade bonds, currency-hedged.",
  },
  {
    ticker: "SCHD",
    name: "Schwab US Dividend Equity ETF",
    isin: "US8085247497",
    asset_class: "equity",
    region: "us",
    expense_ratio: 0.0006,
    description: "US large-cap dividend payers — yield-tilted equity.",
  },
];

const ETF_BY_TICKER: Record<string, EtfMeta> = Object.fromEntries(
  ETF_CATALOG.map((e) => [e.ticker, e]),
);

export function etfByTicker(ticker: string): EtfMeta | null {
  return ETF_BY_TICKER[ticker] ?? null;
}
