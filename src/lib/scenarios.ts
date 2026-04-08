export interface Scenario {
  id: string;
  headline: string;
  detail: string;
  action: string;
}

export const SCENARIOS: Scenario[] = [
  {
    id: "market-drop",
    headline: "Markets dropped ~5% this week",
    detail:
      "Short-term dips happen several times a year. This doesn\u2019t change your plan.",
    action: "Do nothing.",
  },
  {
    id: "inflation-up",
    headline: "Inflation ticked up last month",
    detail:
      "Month-to-month changes are noisy. What matters is the long-term trend.",
    action: "Do nothing.",
  },
  {
    id: "no-changes",
    headline: "No significant changes",
    detail:
      "Everything is within normal ranges. A good time to review, not to react.",
    action: "Stay the course.",
  },
];
