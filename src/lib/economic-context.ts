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

/**
 * Illustrative annual inflation rate by country (major economies) or region.
 * Used for real-value projections in the dashboard — not a forecast.
 */
const COUNTRY_INFLATION: Partial<Record<string, number>> = {
  US: 0.03,
  CA: 0.03,
  GB: 0.035,
  DE: 0.025,
  FR: 0.025,
  IT: 0.025,
  ES: 0.03,
  NL: 0.03,
  CH: 0.015,
  SE: 0.025,
  NO: 0.035,
  DK: 0.025,
  JP: 0.025,
  AU: 0.035,
  NZ: 0.035,
  SG: 0.025,
  KR: 0.03,
  IN: 0.055,
  CN: 0.025,
  BR: 0.055,
  MX: 0.05,
  ZA: 0.06,
  NG: 0.22,
  EG: 0.25,
  TR: 0.45,
  AR: 0.80,
};

const REGION_INFLATION: Record<RegionKey, number> = {
  Americas: 0.03,
  Europe: 0.025,
  Asia: 0.03,
  Africa: 0.08,
  Other: 0.03,
};

/**
 * Returns an illustrative annual inflation rate for the given country.
 * Precision is intentionally coarse — used for educational real-value projections only.
 */
export function illustrativeInflationRate(countryCode: string): number {
  if (COUNTRY_INFLATION[countryCode] !== undefined) {
    return COUNTRY_INFLATION[countryCode]!;
  }
  const r = countryMeta(countryCode).region;
  if (r === "Americas") return REGION_INFLATION.Americas;
  if (r === "Europe") return REGION_INFLATION.Europe;
  if (r === "Asia") return REGION_INFLATION.Asia;
  if (r === "Africa") return REGION_INFLATION.Africa;
  return REGION_INFLATION.Other;
}

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

/** Per-country overrides for major economies; others fall back to regional copy. */
const COUNTRY_COPY: Partial<Record<string, MacroBlock>> = {
  US: {
    headline: "United States — rates, housing, and labour",
    bullets: [
      "The Fed's rate cycle heavily influences mortgage costs, savings yields, and credit-card rates—policy moves filter through household budgets quickly.",
      "U.S. inflation has often run at roughly 2–4% in recent years; shelter and services have been stickiest.",
      "The 30-year fixed mortgage is common, so existing homeowners are often insulated from rate moves unless refinancing or buying.",
    ],
    indicators: [
      {
        label: "Recent inflation (illustrative)",
        value: "≈ 3% y/y",
        detail:
          "CPI has trended down from post-pandemic peaks; shelter costs often lead the index — educational only.",
      },
      {
        label: "Policy target",
        value: "2% long-run aim",
        detail:
          "The Fed targets 2% PCE inflation over the long run; realised prints can deviate meaningfully.",
      },
      {
        label: "Mortgage / housing risk",
        value: "Rate lock-in effect",
        detail:
          "Most existing owners hold low fixed rates; buyers face affordability stress at current rates.",
      },
    ],
  },
  GB: {
    headline: "United Kingdom — cost of living and mortgage resets",
    bullets: [
      "UK inflation has been stickier than Europe's peers, driven by services and food; the BoE has moved rates significantly.",
      "A large share of UK mortgages fix for 2–5 years, creating wave-like repricing risk as fixed terms expire.",
      "Wages have been growing but purchasing power recovery varies by sector and region.",
    ],
    indicators: [
      {
        label: "Recent inflation (illustrative)",
        value: "≈ 3.5% y/y",
        detail:
          "CPI peaked sharply and has since fallen; services inflation has remained elevated — illustrative.",
      },
      {
        label: "Policy target",
        value: "2% BoE aim",
        detail:
          "The Bank of England targets 2% CPI; recent prints have been well above target.",
      },
      {
        label: "Mortgage / housing risk",
        value: "Fixed-term expiry waves",
        detail:
          "2 and 5-year fixes create large cohorts of borrowers resetting to higher rates each year.",
      },
    ],
  },
  DE: {
    headline: "Germany — energy transition and ECB rates",
    bullets: [
      "Germany's manufacturing-heavy economy has felt energy price shocks acutely; household energy costs remain a budget item to watch.",
      "ECB rate moves flow through variable-rate and tracker mortgages quickly; fixed-rate uptake has grown.",
      "German inflation has cooled closer to the ECB's 2% aim from post-shock highs.",
    ],
    indicators: [
      {
        label: "Recent inflation (illustrative)",
        value: "≈ 2.5% y/y",
        detail:
          "HICP has normalised from energy-shock peaks; food and services remain slightly elevated — illustrative.",
      },
      {
        label: "Policy target",
        value: "2% ECB aim",
        detail:
          "The ECB targets 2% HICP for the euro area; German prints often track close to this.",
      },
      {
        label: "Mortgage / housing risk",
        value: "Variable-rate exposure",
        detail:
          "Tracker mortgages common; fixed-rate borrowers have more certainty but face cliff risk at expiry.",
      },
    ],
  },
  JP: {
    headline: "Japan — rates rising, yen, and housing",
    bullets: [
      "After decades of near-zero rates, the Bank of Japan has begun normalising; mortgage rates have edged higher for the first time in a generation.",
      "Yen weakness has lifted import costs, pushing Japanese inflation above its long dormant norms.",
      "Japanese household savings rates have historically been high; the transition to positive real rates changes the calculus for cash holders.",
    ],
    indicators: [
      {
        label: "Recent inflation (illustrative)",
        value: "≈ 2.5% y/y",
        detail:
          "CPI has exceeded the BoJ's 2% target; import-price and food pressures are key drivers — illustrative.",
      },
      {
        label: "Policy target",
        value: "2% BoJ aim",
        detail:
          "The Bank of Japan targets 2% CPI sustainably; recent normalisation marks a historic shift.",
      },
      {
        label: "Mortgage / housing risk",
        value: "Variable-rate dominance",
        detail:
          "Most Japanese mortgages are variable-rate; rising policy rates add cost to many household budgets.",
      },
    ],
  },
  AU: {
    headline: "Australia — property, rates, and income",
    bullets: [
      "Australian property prices are among the most elevated relative to income globally; mortgage stress can be acute when rates rise.",
      "The RBA's rate cycle has meaningfully increased monthly repayments for variable-rate borrowers.",
      "Inflation has been driven by services, insurance, and rents — areas that are slow to reverse.",
    ],
    indicators: [
      {
        label: "Recent inflation (illustrative)",
        value: "≈ 3.5% y/y",
        detail:
          "Trimmed-mean CPI has been above the RBA's 2–3% target band; non-tradable inflation sticky — illustrative.",
      },
      {
        label: "Policy target",
        value: "2–3% RBA band",
        detail:
          "The RBA targets 2–3% CPI on average; achieving sustained return to band has been the challenge.",
      },
      {
        label: "Mortgage / housing risk",
        value: "High LTV + variable resets",
        detail:
          "High property prices mean large loan balances; most mortgages are variable, so rate moves hit quickly.",
      },
    ],
  },
  IN: {
    headline: "India — growth, inflation, and income variety",
    bullets: [
      "India's economy is among the fastest growing globally, but inflation — especially food and energy — can erode household purchasing power.",
      "RBI policy targets 4% CPI with ±2% tolerance; food price volatility often pushes prints higher.",
      "Income distribution is wide; the cash-cushion logic here applies mainly to formal-sector earners with predictable income.",
    ],
    indicators: [
      {
        label: "Recent inflation (illustrative)",
        value: "≈ 5.5% y/y",
        detail:
          "CPI driven by food and fuel components; core inflation is lower — illustrative range only.",
      },
      {
        label: "Policy target",
        value: "4% ± 2% RBI",
        detail:
          "The Reserve Bank of India targets 4% CPI; spikes above 6% can trigger policy responses.",
      },
      {
        label: "Mortgage / housing risk",
        value: "Variable-rate linked",
        detail:
          "Home loans typically link to repo rate; RBI rate changes pass through quickly to EMIs.",
      },
    ],
  },
  BR: {
    headline: "Brazil — Selic rate, inflation, and currency",
    bullets: [
      "Brazil's Selic rate is one of the world's highest; high nominal yields on fixed income compete strongly with other savings options.",
      "Inflation has often run above the BCB's target; food and fuel are key drivers.",
      "FX volatility can affect import prices and purchasing power — a factor for savings held in local currency.",
    ],
    indicators: [
      {
        label: "Recent inflation (illustrative)",
        value: "≈ 5.5% y/y",
        detail:
          "IPCA has cycled above the BCB's 3% centre target; energy and food are volatile components — illustrative.",
      },
      {
        label: "Policy target",
        value: "3% BCB centre",
        detail:
          "The Banco Central do Brasil targets 3% IPCA; tolerance bands allow ±1.5pp before formal breach.",
      },
      {
        label: "Mortgage / housing risk",
        value: "High rates + FX",
        detail:
          "Mortgage credit is expensive relative to many peers; FX moves can affect real wealth for internationally minded savers.",
      },
    ],
  },
  TR: {
    headline: "Turkey — high inflation and lira dynamics",
    bullets: [
      "Turkish inflation has been exceptionally high in recent years; the real value of lira-denominated cash erodes rapidly.",
      "Monetary policy has been unconventional at times; savers in Turkey often seek FX or hard-asset protection.",
      "Building a cash buffer in a high-inflation currency means the 'months of spending' logic still holds, but nominal targets need frequent reassessment.",
    ],
    indicators: [
      {
        label: "Recent inflation (illustrative)",
        value: "≈ 45–70% y/y",
        detail:
          "TUIK CPI has been highly elevated; real rates have often been deeply negative — illustrative, not current.",
      },
      {
        label: "Policy context",
        value: "High & volatile",
        detail:
          "Rates have swung sharply; saving in local currency requires regular reassessment of real returns.",
      },
      {
        label: "Mortgage / housing risk",
        value: "Inflation erosion",
        detail:
          "Fixed lira mortgages lose real value with inflation; variable-rate loans can spike unpredictably.",
      },
    ],
  },
  NG: {
    headline: "Nigeria — FX, inflation, and liquidity",
    bullets: [
      "Nigerian inflation has been high and driven by FX depreciation and food prices; naira purchasing power has fallen significantly.",
      "Formal mortgage markets are shallow; most Nigerians rent or own without bank financing.",
      "Dollar-saving or FX hedging is common among higher-income households managing long-term purchasing power.",
    ],
    indicators: [
      {
        label: "Recent inflation (illustrative)",
        value: "≈ 20–30% y/y",
        detail:
          "CPI driven by food, energy, and naira weakness — very wide band, figures change rapidly — illustrative.",
      },
      {
        label: "Policy context",
        value: "FX + fiscal driven",
        detail:
          "Monetary policy often balances FX stability with growth; inflation expectations are weakly anchored.",
      },
      {
        label: "Mortgage / housing risk",
        value: "Limited formal credit",
        detail:
          "Mortgage penetration is low; rent shocks and currency depreciation are the primary housing risks.",
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
  const countryOverride = COUNTRY_COPY[countryCode];
  if (countryOverride) {
    return {
      countryLabel: meta.label,
      headline: countryOverride.headline,
      bullets: countryOverride.bullets,
      indicators: countryOverride.indicators,
    };
  }
  const key = regionKeyForCode(countryCode);
  const block = COPY[key];
  return {
    countryLabel: meta.label,
    headline: block.headline,
    bullets: block.bullets,
    indicators: block.indicators,
  };
}
