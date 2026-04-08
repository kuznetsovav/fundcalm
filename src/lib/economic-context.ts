/**
 * High-level economic framing by region — illustrative ranges only,
 * not live data, forecasts, or investment advice.
 */

import { countryMeta } from "./countries";

type RegionKey =
  | "Americas"
  | "Europe"
  | "Asia"
  | "Africa"
  | "Other";

export type MacroIndicatorRow = {
  label: string;
  value: string;
  detail: string;
};

type MacroBlock = {
  headline: string;
  bullets: string[];
  indicators: MacroIndicatorRow[];
};

const COPY: Record<RegionKey, MacroBlock> = {
  Americas: {
    headline: "Americas — growth, inflation, and housing finance",
    bullets: [
      "Policy rates in the U.S. and Canada have been the main dial for mortgage and savings yields; labour markets still drive how fast households refill buffers.",
      "Illustrative inflation in many developed American economies has often printed in roughly the 2–4% annual range in recent years—prints vary widely by city and basket.",
      "Fixed-rate mortgages dominate in some markets, variable in others; renewal or repricing risk matters when you model housing stress alongside cash cushions.",
    ],
    indicators: [
      {
        label: "Recent inflation (illustrative band)",
        value: "≈ 2–4% y/y",
        detail:
          "Typical developed-economy CPI/HICP-style ranges for education only—not your country’s latest print.",
      },
      {
        label: "Medium-term outlook (consensus-style)",
        value: "≈ 2–3% target band",
        detail:
          "Many central banks describe long-run aims near 2%; realised inflation cycles above and below.",
      },
      {
        label: "Mortgage / housing risk themes",
        value: "Rate + renewal",
        detail:
          "Higher policy rates raised stress tests and renewal payments; variable-rate borrowers often feel moves first.",
      },
    ],
  },
  Europe: {
    headline: "Europe — inflation cooling, rates, and housing",
    bullets: [
      "Euro-area and UK inflation moved down from post-shock peaks but services prices can stay sticky; national prints diverge.",
      "ECB/BoE policy paths influence mortgage fixes and tracker spreads; deposit rates have improved but lagged policy.",
      "Energy and labour costs still feed rent and owner costs—buffers help when mortgage or rent jumps coincide with income dips.",
    ],
    indicators: [
      {
        label: "Recent inflation (illustrative band)",
        value: "≈ 2–3% y/y",
        detail:
          "Euro-area HICP has often clustered near target after peaks; UK CPI has been more volatile—illustrative only.",
      },
      {
        label: "Outlook (policy discussion)",
        value: "≈ 2% aim",
        detail:
          "Forward guidance often centres on returning inflation sustainably toward 2%; paths differ by jurisdiction.",
      },
      {
        label: "Mortgage / housing risk themes",
        value: "Fixation + affordability",
        detail:
          "Fixed-rate cliffs, stress tests, and rent growth can squeeze budgets—liquidity offsets timing risk.",
      },
    ],
  },
  Asia: {
    headline: "Asia-Pacific — diverse inflation and property cycles",
    bullets: [
      "Inflation outcomes range from near-zero prints to higher single digits depending on country and energy mix.",
      "Several hubs tie mortgage pricing to policy and property rules; capital-flow and FX regimes affect how savers hold cash.",
      "High household participation in property makes mortgage and rent sensitivity a first-order risk in many cities.",
    ],
    indicators: [
      {
        label: "Recent inflation (illustrative band)",
        value: "≈ 1–5% y/y",
        detail:
          "Wide regional spread; commodity importers often see higher volatility—numbers are educational, not live.",
      },
      {
        label: "Outlook (generic)",
        value: "Country-specific",
        detail:
          "Export vs domestic demand, FX, and food/energy shocks dominate forecasts—use national statistics for decisions.",
      },
      {
        label: "Mortgage / housing risk themes",
        value: "Leverage + policy",
        detail:
          "LTV rules, stamp duties, and rate moves can change affordability quickly; buffers hedge income shocks.",
      },
    ],
  },
  Africa: {
    headline: "Africa — FX, inflation, and mortgage depth",
    bullets: [
      "Inflation and currency moves can dominate real purchasing power; imported inflation matters where FX is volatile.",
      "Formal mortgage markets vary in depth; rent and informal finance often carry the housing burden.",
      "Commodity cycles and fiscal space influence rates and employment—household resilience still starts with cash liquidity.",
    ],
    indicators: [
      {
        label: "Recent inflation (illustrative band)",
        value: "≈ 5–15% y/y",
        detail:
          "Very wide by country; some economies run lower, others much higher—illustrative band only.",
      },
      {
        label: "Outlook",
        value: "FX + fiscal",
        detail:
          "Currency and energy paths often matter as much as domestic demand for near-term price pressure.",
      },
      {
        label: "Mortgage / housing risk themes",
        value: "Rates + access",
        detail:
          "Where mortgages exist, variable pricing and FX-indexed costs can bite; rent shocks are common elsewhere.",
      },
    ],
  },
  Other: {
    headline: "Global context",
    bullets: [
      "Major economies rarely move in lockstep; inflation and rates cycle on different calendars.",
      "Geopolitical shocks can move energy and food prices quickly—personal plans benefit from simple liquidity rules.",
      "Use official statistics and professional advice for any country-specific decision.",
    ],
    indicators: [
      {
        label: "Recent inflation (illustrative band)",
        value: "≈ 2–5% y/y",
        detail:
          "Blended OECD-style ballpark for learning—not a forecast for your location.",
      },
      {
        label: "Outlook",
        value: "Uncertain",
        detail:
          "Consensus inflation paths have revised often post-2020; treat any single number with scepticism.",
      },
      {
        label: "Mortgage / housing risk themes",
        value: "Global tightening cycle",
        detail:
          "Many markets saw higher debt-service costs; fixed-rate expiries and rent growth remain watch items.",
      },
    ],
  },
};

function regionKeyForCode(code: string): RegionKey {
  const r = countryMeta(code).region;
  if (r === "Americas") return "Americas";
  if (r === "Europe") return "Europe";
  if (r === "Asia") return "Asia";
  if (r === "Africa") return "Africa";
  return "Other";
}

export function economicOverviewForCountry(countryCode: string): {
  countryLabel: string;
  headline: string;
  bullets: string[];
  indicators: MacroIndicatorRow[];
} {
  const meta = countryMeta(countryCode);
  const key = regionKeyForCode(countryCode);
  const block = COPY[key];
  return {
    countryLabel: meta.label,
    headline: block.headline,
    bullets: block.bullets,
    indicators: block.indicators,
  };
}
