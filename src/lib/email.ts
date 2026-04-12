/**
 * Email sending via Resend.
 * All emails are sent server-side only.
 */

const FROM = process.env.RESEND_FROM_EMAIL ?? "FundCalm <digest@fundcalm.com>";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://fundcalm.com";

function dashboardUrl(userId: string, token?: string) {
  const base = `${APP_URL}/dashboard?user=${userId}`;
  return token ? `${base}&token=${token}` : base;
}

function checkinUrl(userId: string, token?: string) {
  const base = `${APP_URL}/checkin?user=${userId}`;
  return token ? `${base}&token=${token}` : base;
}

// ---------------------------------------------------------------------------
// Resend client (lazy, server-only)
// ---------------------------------------------------------------------------

async function getResend() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is not set");
  const { Resend } = await import("resend");
  return new Resend(apiKey);
}

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

function baseHtml(body: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<style>
  body { margin: 0; padding: 0; background: #f8f9fa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
  .wrap { max-width: 560px; margin: 40px auto; background: #fff; border-radius: 16px; border: 1px solid #e5e7eb; overflow: hidden; }
  .header { background: #f0fdf4; padding: 24px 32px; border-bottom: 1px solid #d1fae5; }
  .logo { font-size: 18px; font-weight: 700; color: #065f46; letter-spacing: -0.02em; }
  .body { padding: 28px 32px; }
  h2 { margin: 0 0 4px; font-size: 20px; font-weight: 700; color: #111827; }
  p { margin: 0 0 16px; font-size: 15px; line-height: 1.6; color: #374151; }
  .metric { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; padding: 12px 16px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center; }
  .metric-label { font-size: 13px; color: #6b7280; }
  .metric-value { font-size: 16px; font-weight: 600; color: #111827; }
  .delta-up { color: #059669; }
  .delta-down { color: #dc2626; }
  .cta { display: inline-block; margin: 8px 0 0; background: #059669; color: #fff; font-size: 15px; font-weight: 600; padding: 13px 28px; border-radius: 10px; text-decoration: none; }
  .footer { padding: 20px 32px; border-top: 1px solid #f3f4f6; font-size: 12px; color: #9ca3af; }
  .footer a { color: #6b7280; text-decoration: underline; }
</style>
</head>
<body>
<div class="wrap">
  <div class="header"><div class="logo">FundCalm</div></div>
  <div class="body">${body}</div>
  <div class="footer">
    This is an automated check-in from FundCalm. All figures are illustrative.<br />
    <a href="${APP_URL}">fundcalm.com</a>
  </div>
</div>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Welcome email (sent after sign-up)
// ---------------------------------------------------------------------------

export interface WelcomeEmailParams {
  to: string;
  userId: string;
  statusBadge: string;  // e.g. "Comfortable"
  runway: string;       // e.g. "4.2 months"
  /** Access token for secure dashboard link. */
  accessToken?: string;
}

export async function sendWelcomeEmail(params: WelcomeEmailParams) {
  const resend = await getResend();
  const link = dashboardUrl(params.userId, params.accessToken);

  const body = `
    <h2>Your financial clarity is saved.</h2>
    <p>Here's where you stand right now:</p>
    <div class="metric">
      <span class="metric-label">Status</span>
      <span class="metric-value">${params.statusBadge}</span>
    </div>
    <div class="metric">
      <span class="metric-label">Cash runway</span>
      <span class="metric-value">${params.runway}</span>
    </div>
    <p style="margin-top:20px">
      Bookmark this link or use the button below to return to your dashboard any time.
      We'll send you a monthly check-in so you can see how things shift over time.
    </p>
    <a class="cta" href="${link}">View my dashboard</a>
    <p style="margin-top:20px;font-size:13px;color:#6b7280">
      Your dashboard link: <a href="${link}" style="color:#059669">${link}</a>
    </p>`;

  await resend.emails.send({
    from: FROM,
    to: params.to,
    subject: "Your FundCalm dashboard is saved",
    html: baseHtml(body),
  });
}

// ---------------------------------------------------------------------------
// Monthly digest email
// ---------------------------------------------------------------------------

export interface DigestEmailParams {
  to: string;
  userId: string;
  statusBadge: string;
  /** Raw status key: ok / warning / risk / critical */
  statusKey: string;
  runway: string;
  /** Numeric runway months for comparison. */
  runwayMonths: number;
  target: string;
  gap: string;
  /** Previous snapshot data for delta display — null if first digest. */
  previous?: {
    runwayMonths: number;
    status: string;
    takenAt: string;
  } | null;
  countryLabel: string;
  /** Days since the user last updated their profile numbers. */
  daysSinceLastUpdate: number;
  /** Access token for secure links. */
  accessToken?: string;
}

function runwayDelta(current: string, prev: { runwayMonths: number; takenAt: string }): string {
  const currentNum = parseFloat(current);
  if (isNaN(currentNum)) return "";
  const diff = currentNum - prev.runwayMonths;
  if (Math.abs(diff) < 0.1) return "";
  const sign = diff > 0 ? "+" : "";
  const cls = diff > 0 ? "delta-up" : "delta-down";
  const label = new Date(prev.takenAt).toLocaleDateString("en-US", { month: "short" });
  return ` <span class="${cls}">(${sign}${diff.toFixed(1)} since ${label})</span>`;
}

function getDigestSubject(params: DigestEmailParams): string {
  const { statusKey, daysSinceLastUpdate, runwayMonths, previous } = params;
  const isImproving = previous != null && runwayMonths > previous.runwayMonths;
  const monthsOld   = Math.round(daysSinceLastUpdate / 30);

  // Very stale — lead with age regardless of status
  if (daysSinceLastUpdate > 60) {
    return `Your FundCalm read is ${monthsOld} months old \u2014 takes 60 seconds to refresh`;
  }

  // Good news: comfortable and runway grew
  if (statusKey === "ok" && isImproving) {
    return "Your buffer probably grew last month \u2014 here\u2019s the estimate";
  }

  // Comfortable but aging
  if (statusKey === "ok" && daysSinceLastUpdate > 45) {
    return `Your FundCalm read is ${monthsOld > 1 ? `${monthsOld} months` : "over a month"} old \u2014 takes 60 seconds to refresh`;
  }

  // Limited — soft nudge with timing
  if (statusKey === "warning") {
    const sinceMonth = previous?.takenAt
      ? new Date(previous.takenAt).toLocaleDateString("en-US", { month: "long" })
      : null;
    return sinceMonth
      ? `Your last check-in was in ${sinceMonth} \u2014 things may have shifted`
      : "Things may have shifted since your last check-in";
  }

  // At risk or critical — direct and specific
  if (statusKey === "risk" || statusKey === "critical") {
    return "A quick check-in would sharpen your read \u2014 3 questions";
  }

  // Default
  const month = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });
  return `Your FundCalm check-in \u2014 ${month}`;
}

export async function sendDigestEmail(params: DigestEmailParams) {
  const resend = await getResend();
  const link = dashboardUrl(params.userId, params.accessToken);
  const checkin = checkinUrl(params.userId, params.accessToken);

  const deltaHtml = params.previous ? runwayDelta(params.runway, params.previous) : "";

  // Body intro varies by staleness
  const introLine = params.daysSinceLastUpdate > 45
    ? `Your numbers are ${Math.round(params.daysSinceLastUpdate / 30)} months old — here's where things stand, and a reminder to do a quick update.`
    : "Here's how your financial picture looks this month:";

  const body = `
    <h2>Your monthly check-in</h2>
    <p>${introLine}</p>
    <div class="metric">
      <span class="metric-label">Status</span>
      <span class="metric-value">${params.statusBadge}</span>
    </div>
    <div class="metric">
      <span class="metric-label">Cash runway</span>
      <span class="metric-value">${params.runway}${deltaHtml}</span>
    </div>
    <div class="metric">
      <span class="metric-label">Target</span>
      <span class="metric-value">${params.target}</span>
    </div>
    <div class="metric">
      <span class="metric-label">Gap to target</span>
      <span class="metric-value">${params.gap}</span>
    </div>
    <p style="margin-top:20px">
      If anything has changed in your income, savings, or life situation,
      it takes about 60 seconds to update your numbers and get a fresh read.
    </p>
    <a class="cta" href="${checkin}">Update my numbers</a>
    &nbsp;&nbsp;
    <a href="${link}" style="font-size:14px;color:#6b7280">View dashboard</a>`;

  await resend.emails.send({
    from: FROM,
    to: params.to,
    subject: getDigestSubject(params),
    html: baseHtml(body),
  });
}

// ---------------------------------------------------------------------------
// Milestone email (sent when user crosses their cash-runway target)
// ---------------------------------------------------------------------------

export interface MilestoneEmailParams {
  to: string;
  userId: string;
  runwayMonths: number;
  targetMonths: number;
  statusBadge: string;
  currency: string;
  locale: string;
  /** Access token for secure links. */
  accessToken?: string;
}

export async function sendMilestoneEmail(params: MilestoneEmailParams) {
  const resend = await getResend();
  const link = dashboardUrl(params.userId, params.accessToken);
  const checkin = checkinUrl(params.userId, params.accessToken);

  const fmtMonths = (n: number) => `${Math.round(n * 10) / 10} months`;

  const body = `
    <h2>You've crossed your buffer target.</h2>
    <p>Your cash runway just hit <strong>${fmtMonths(params.runwayMonths)}</strong> — past the <strong>${fmtMonths(params.targetMonths)}-month target</strong> you set for your situation.</p>
    <div class="metric">
      <span class="metric-label">Cash runway</span>
      <span class="metric-value">${fmtMonths(params.runwayMonths)}</span>
    </div>
    <div class="metric">
      <span class="metric-label">Your target</span>
      <span class="metric-value">${fmtMonths(params.targetMonths)}</span>
    </div>
    <div class="metric">
      <span class="metric-label">Status</span>
      <span class="metric-value">${params.statusBadge}</span>
    </div>
    <p style="margin-top:20px">
      This is worth pausing on. You've built a cushion that covers your target — keep it funded,
      and any money beyond it can work harder in longer-term savings.
    </p>
    <a class="cta" href="${link}">See my full dashboard</a>
    <p style="margin-top:16px;font-size:13px;color:#6b7280">
      Want to update your numbers? <a href="${checkin}" style="color:#059669">Quick check-in here</a>.
    </p>`;

  await resend.emails.send({
    from: FROM,
    to: params.to,
    subject: `You've crossed your ${fmtMonths(params.targetMonths)} buffer target`,
    html: baseHtml(body),
  });
}
