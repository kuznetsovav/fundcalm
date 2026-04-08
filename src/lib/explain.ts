import type { FinancialResult, FinancialInput } from "./engine";

interface ExplainResponse {
  explanation: string;
}

const STABILITY_LABEL: Record<FinancialInput["incomeStability"], string> = {
  steady: "fairly steady",
  variable_flat: "variable without a clear trend lately",
  variable_improving: "variable but recently improving",
  variable_worsening: "variable and recently tightening",
  irregular: "hard to predict month to month",
};

const DEBT_LABEL: Record<FinancialInput["debtPressure"], string> = {
  none: "not a noticeable strain",
  light: "light but under control",
  moderate: "moderate and worth watching",
  heavy: "heavy relative to what is comfortable",
};

export function financialResultToContextText(
  result: FinancialResult,
  life?: Pick<FinancialInput, "incomeStability" | "debtPressure"> | null,
  /** Optional facts with real user amounts (cash, spending, runway, cushion). */
  numericFacts?: string,
): string {
  const base = [
    `Diagnosis: ${result.diagnosis}.`,
    `Confidence: ${result.confidence.level}.`,
    result.verdict,
    result.summary,
    result.insight,
    result.projection,
  ].join(" ");

  const lifeBit =
    life &&
    `Their income is ${STABILITY_LABEL[life.incomeStability]}. Housing costs in the budget feel ${DEBT_LABEL[life.debtPressure]}.`;

  const numBit = numericFacts?.trim();

  return [base, lifeBit, numBit].filter(Boolean).join(" ");
}

export async function fetchExplanation(
  result: FinancialResult,
  contextText?: string,
): Promise<string> {
  const context =
    contextText ?? financialResultToContextText(result);

  const res = await fetch("/api/explain", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      status: result.status,
      action: result.action,
      context,
    }),
  });

  if (!res.ok) {
    throw new Error(`Explain API returned ${res.status}`);
  }

  const data: ExplainResponse = await res.json();
  return data.explanation;
}
