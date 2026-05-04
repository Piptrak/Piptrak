// lib/email.ts
// Piptrak Email System — powered by Resend
// Install: npm install resend
// Sign up free at resend.com — 3,000 emails/month free

import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = "Piptrak <hello@piptrak.com>";
const REPLY_TO = "support@piptrak.com";

// ── Base template ─────────────────────────────────────────────────────────────
const baseTemplate = (content: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width"/>
  <style>
    body { margin: 0; padding: 0; background: #090c12; font-family: 'Times New Roman', Times, serif; }
    .wrapper { max-width: 560px; margin: 0 auto; padding: 40px 24px; }
    .logo { font-size: 24px; font-weight: 700; font-style: italic; color: #e0eaff; margin-bottom: 32px; }
    .logo span { color: #4db8ff; }
    .card { background: #0f1520; border: 1px solid #1e2a40; border-radius: 12px; padding: 28px; margin-bottom: 20px; }
    h1 { font-size: 26px; font-weight: 700; font-style: italic; color: #e0eaff; margin: 0 0 12px; line-height: 1.3; }
    p { font-size: 15px; color: #778; font-style: italic; line-height: 1.8; margin: 0 0 14px; }
    .btn { display: inline-block; background: #1e4d8c; color: #c8d8f0; padding: 13px 28px; border-radius: 8px; font-size: 14px; font-style: italic; text-decoration: none; margin: 8px 0; font-family: 'Times New Roman', Times, serif; }
    .btn-green { background: #0d2a1a; color: #00ff88; border: 1px solid #00ff8833; }
    .stat-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #1a2235; }
    .stat-label { font-size: 13px; color: #556; font-style: italic; }
    .stat-val { font-size: 14px; font-weight: 700; font-style: italic; color: #e0eaff; }
    .footer { text-align: center; font-size: 11px; color: #334; font-style: italic; margin-top: 32px; line-height: 1.8; }
    .footer a { color: #445; }
    .divider { height: 1px; background: #1e2a40; margin: 20px 0; }
    .green { color: #00ff88; }
    .red { color: #ff3b5c; }
    .blue { color: #4db8ff; }
    .gold { color: #f0c040; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="logo">Pip<span>trak</span></div>
    ${content}
    <div class="footer">
      © 2025 Piptrak · <a href="https://piptrak.com">piptrak.com</a><br/>
      <a href="{{unsubscribe_url}}">Unsubscribe</a> · <a href="https://piptrak.com/privacy">Privacy Policy</a><br/>
      Not financial advice. Trade responsibly.
    </div>
  </div>
</body>
</html>`;

// ── Email Templates ───────────────────────────────────────────────────────────

export const templates = {

  // Welcome email
  welcome: (name: string) => ({
    subject: "Welcome to Piptrak — let's get you set up ⬡",
    html: baseTemplate(`
      <div class="card">
        <h1>Welcome, ${name}.</h1>
        <p>You just made a smart move. Most traders fail prop firm challenges not because they can't trade — but because they lose track of their rules at the wrong moment.</p>
        <p>That's what Piptrak fixes.</p>
        <div class="divider"></div>
        <p><strong style="color:#e0eaff">Your first 3 steps:</strong></p>
        <div class="stat-row"><span class="stat-label">1. Add your challenge account</span><span class="stat-val blue">Accounts tab →</span></div>
        <div class="stat-row"><span class="stat-label">2. Import your trades</span><span class="stat-val blue">CSV or MT4/MT5 →</span></div>
        <div class="stat-row" style="border:none"><span class="stat-label">3. Set your breach alerts</span><span class="stat-val green">Most important →</span></div>
        <div class="divider"></div>
        <a href="https://app.piptrak.com" class="btn">Open your dashboard →</a>
      </div>
      <p style="font-size:13px;text-align:center">Questions? Just reply to this email — I read every one.</p>
    `)
  }),

  // Password reset
  passwordReset: (resetUrl: string) => ({
    subject: "Reset your Piptrak password",
    html: baseTemplate(`
      <div class="card">
        <h1>Password reset</h1>
        <p>We received a request to reset your Piptrak password. Click the button below to choose a new one.</p>
        <a href="${resetUrl}" class="btn">Reset my password →</a>
        <div class="divider"></div>
        <p style="font-size:13px;color:#445">This link expires in 1 hour. If you didn't request a password reset, you can safely ignore this email — your account is secure.</p>
      </div>
    `)
  }),

  // Email verification
  verifyEmail: (verifyUrl: string) => ({
    subject: "Confirm your Piptrak email address",
    html: baseTemplate(`
      <div class="card">
        <h1>Confirm your email</h1>
        <p>Click below to verify your email address and activate your Piptrak account.</p>
        <a href="${verifyUrl}" class="btn">Verify email →</a>
        <div class="divider"></div>
        <p style="font-size:13px;color:#445">If you didn't create a Piptrak account, you can ignore this email.</p>
      </div>
    `)
  }),

  // Breach alert
  breachAlert: (name: string, type: "daily" | "maxdd" | "target", data: { pair?: string; current: number; limit: number; accountName: string; pct: number }) => ({
    subject: type === "target"
      ? `🎉 Challenge target reached — ${data.accountName}`
      : `⚠️ ${type === "daily" ? "Daily loss" : "Max drawdown"} warning — ${data.accountName}`,
    html: baseTemplate(`
      <div class="card" style="border-color:${type === "target" ? "#00ff8833" : "#ff3b5c33"}">
        <h1 style="color:${type === "target" ? "#00ff88" : "#ff3b5c"}">
          ${type === "target" ? "🎉 Target reached!" : `⚠️ ${type === "daily" ? "Daily loss" : "Max drawdown"} warning`}
        </h1>
        <p>${name}, your <strong style="color:#e0eaff">${data.accountName}</strong> account needs attention.</p>
        <div style="background:#0a0f1a;border-radius:8px;padding:16px;margin:16px 0">
          <div class="stat-row"><span class="stat-label">${type === "daily" ? "Today's loss" : type === "maxdd" ? "Current drawdown" : "Profit"}</span><span class="stat-val" style="color:${type === "target" ? "#00ff88" : "#ff3b5c"}">$${data.current.toFixed(0)}</span></div>
          <div class="stat-row" style="border:none"><span class="stat-label">${type === "target" ? "Target" : "Limit"}</span><span class="stat-val">$${data.limit.toFixed(0)} (${data.pct.toFixed(0)}%)</span></div>
        </div>
        ${type !== "target" ? `<p style="color:#ff3b5c;font-size:14px"><strong>Recommendation: Stop trading for today.</strong> Come back fresh tomorrow.</p>` : `<p style="color:#00ff88;font-size:14px"><strong>Congratulations! Consider locking in your gains and reviewing your rules.</strong></p>`}
        <a href="https://app.piptrak.com" class="btn ${type === "target" ? "btn-green" : ""}">View dashboard →</a>
      </div>
    `)
  }),

  // Payment success / upgrade
  upgradeSuccess: (name: string, plan: "pro" | "elite", trialDays?: number) => ({
    subject: `You're now on Piptrak ${plan.charAt(0).toUpperCase() + plan.slice(1)} 🎉`,
    html: baseTemplate(`
      <div class="card" style="border-color:#1e4d8c">
        <h1>Welcome to ${plan === "pro" ? "Pro" : "Elite"}, ${name}!</h1>
        ${trialDays ? `<p>Your <strong style="color:#e0eaff">${trialDays}-day free trial</strong> has started. You won't be charged until it ends.</p>` : `<p>Your ${plan} plan is now active. Thank you for subscribing.</p>`}
        <div class="divider"></div>
        <p><strong style="color:#e0eaff">What you've unlocked:</strong></p>
        ${plan === "pro" ? `
          <div class="stat-row"><span class="stat-label">Challenge accounts</span><span class="stat-val green">Up to 5</span></div>
          <div class="stat-row"><span class="stat-label">Real-time breach alerts</span><span class="stat-val green">✓ Active</span></div>
          <div class="stat-row"><span class="stat-label">Broker sync (MT4/MT5)</span><span class="stat-val green">✓ Active</span></div>
          <div class="stat-row" style="border:none"><span class="stat-label">Deep analytics</span><span class="stat-val green">✓ Active</span></div>
        ` : `
          <div class="stat-row"><span class="stat-label">Challenge accounts</span><span class="stat-val green">Unlimited</span></div>
          <div class="stat-row"><span class="stat-label">White-label reports</span><span class="stat-val green">✓ Active</span></div>
          <div class="stat-row"><span class="stat-label">Webhook auto-import</span><span class="stat-val green">✓ Active</span></div>
          <div class="stat-row" style="border:none"><span class="stat-label">Priority support</span><span class="stat-val green">✓ Active</span></div>
        `}
        <div class="divider"></div>
        <a href="https://app.piptrak.com" class="btn">Go to dashboard →</a>
      </div>
      <p style="font-size:13px;text-align:center">Manage your subscription anytime in <a href="https://app.piptrak.com/settings" style="color:#4db8ff">Settings → Billing</a></p>
    `)
  }),

  // Cancellation
  cancellation: (name: string) => ({
    subject: "Your Piptrak Pro has been cancelled",
    html: baseTemplate(`
      <div class="card">
        <h1>Sorry to see you go, ${name}</h1>
        <p>Your Pro subscription has been cancelled. You'll keep Pro access until the end of your current billing period.</p>
        <p>After that, your account moves to the free plan — you won't lose your data.</p>
        <div class="divider"></div>
        <p>Can I ask what made you cancel? Just reply to this email — it takes 30 seconds and helps me build a better product.</p>
        <p style="color:#445;font-size:13px">If price was the issue, reply and I'll see what I can do.</p>
        <a href="https://app.piptrak.com/settings" class="btn">Reactivate Pro →</a>
      </div>
    `)
  }),

  // Weekly digest
  weeklyDigest: (name: string, stats: { trades: number; pnl: number; winRate: number; daysLeft: number; accountName: string }) => ({
    subject: `Your Piptrak week in review — ${stats.accountName}`,
    html: baseTemplate(`
      <div class="card">
        <h1>Week in review, ${name}</h1>
        <p>Here's how your <strong style="color:#e0eaff">${stats.accountName}</strong> challenge performed this week:</p>
        <div style="background:#0a0f1a;border-radius:8px;padding:16px;margin:16px 0">
          <div class="stat-row"><span class="stat-label">Trades taken</span><span class="stat-val">${stats.trades}</span></div>
          <div class="stat-row"><span class="stat-label">Week P&L</span><span class="stat-val" style="color:${stats.pnl >= 0 ? "#00ff88" : "#ff3b5c"}">${stats.pnl >= 0 ? "+" : ""}$${stats.pnl.toFixed(0)}</span></div>
          <div class="stat-row"><span class="stat-label">Win rate</span><span class="stat-val blue">${stats.winRate}%</span></div>
          <div class="stat-row" style="border:none"><span class="stat-label">Days remaining</span><span class="stat-val gold">${stats.daysLeft} days</span></div>
        </div>
        <a href="https://app.piptrak.com" class="btn">View full dashboard →</a>
      </div>
    `)
  }),

};

// ── Send functions ────────────────────────────────────────────────────────────

export async function sendWelcome(email: string, name: string) {
  const t = templates.welcome(name);
  return resend.emails.send({ from: FROM, to: email, replyTo: REPLY_TO, subject: t.subject, html: t.html });
}

export async function sendPasswordReset(email: string, resetUrl: string) {
  const t = templates.passwordReset(resetUrl);
  return resend.emails.send({ from: FROM, to: email, subject: t.subject, html: t.html });
}

export async function sendVerifyEmail(email: string, verifyUrl: string) {
  const t = templates.verifyEmail(verifyUrl);
  return resend.emails.send({ from: FROM, to: email, subject: t.subject, html: t.html });
}

export async function sendBreachAlert(email: string, name: string, type: "daily" | "maxdd" | "target", data: Parameters<typeof templates.breachAlert>[2]) {
  const t = templates.breachAlert(name, type, data);
  return resend.emails.send({ from: "Piptrak Alerts <alerts@piptrak.com>", to: email, subject: t.subject, html: t.html });
}

export async function sendUpgradeSuccess(email: string, name: string, plan: "pro" | "elite", trialDays?: number) {
  const t = templates.upgradeSuccess(name, plan, trialDays);
  return resend.emails.send({ from: FROM, to: email, replyTo: REPLY_TO, subject: t.subject, html: t.html });
}

export async function sendCancellation(email: string, name: string) {
  const t = templates.cancellation(name);
  return resend.emails.send({ from: "Piptrak <founder@piptrak.com>", to: email, replyTo: "founder@piptrak.com", subject: t.subject, html: t.html });
}

export async function sendWeeklyDigest(email: string, name: string, stats: Parameters<typeof templates.weeklyDigest>[1]) {
  const t = templates.weeklyDigest(name, stats);
  return resend.emails.send({ from: FROM, to: email, subject: t.subject, html: t.html });
}
