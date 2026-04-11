/**
 * Email sending via Resend.
 * All emails are sent server-side only.
 */

const FROM = process.env.RESEND_FROM_EMAIL ?? "FundCalm <digest@fundcalm.com>";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://fundcalm.com";

function dashboardUrl(userId: string) {
  return `${APP_URL}/dashboard?user=${userId}`;
}

function checkinUrl(userId: string) {
  return `${APP_URL}/checkin?user=${userId}`;
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
}

export async function sendWelcomeEmail(params: WelcomeEmailParams) {
  const resend = await getResend();
  const link = dashboardUrl(params.userId);

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
  runway: string;
  target: string;
  gap: string;
  /** Previous snapshot data for delta display — null if first digest. */
  previous?: {
    runwayMonths: number;
    status: string;
    takenAt: string;
  } | null;
  countryLabel: string;
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

export async function sendDigestEmail(params: DigestEmailParams) {
  const resend = await getResend();
  const link = dashboardUrl(params.userId);
  const checkin = checkinUrl(params.userId);

  const deltaHtml = params.previous ? runwayDelta(params.runway, params.previous) : "";

  const body = `
    <h2>Your monthly check-in</h2>
    <p>Here's how your financial picture looks this month:</p>
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
      If anything has changed in your income, savings, or life situation this month,
      it takes about 60 seconds to update your numbers and see a fresh read.
    </p>
    <a class="cta" href="${checkin}">Update my numbers</a>
    &nbsp;&nbsp;
    <a href="${link}" style="font-size:14px;color:#6b7280">View dashboard</a>`;

  const month = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });

  await resend.emails.send({
    from: FROM,
    to: params.to,
    subject: `Your FundCalm check-in — ${month}`,
    html: baseHtml(body),
  });
}
