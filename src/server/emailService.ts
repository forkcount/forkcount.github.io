import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { safeOutboundFetch } from './ssrfGuard.js';

const RESEND_API_URL = 'https://api.resend.com/emails';
const DEFAULT_FROM = 'Caloriq <onboarding@resend.dev>';
const DEVELOPER_EMAIL = process.env.CONTACT_EMAIL || 'housefly@mail2world.com';

interface VerificationEntry {
  email: string;
  code: string;
  expiresAt: number;
  lastSentAt: number;
  attempts: number;
  locked: boolean;
  verifiedForReset?: boolean;
}

interface PasswordResetEntry {
  email: string;
  token: string;
  expiresAt: number;
  lastSentAt: number;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const VERIFICATION_FILE = path.join(DATA_DIR, 'verification-codes.json');

const verificationStore = new Map<string, VerificationEntry>();
const passwordResetStore = new Map<string, PasswordResetEntry>();
const codeRequestsPerHourStore = new Map<string, number[]>();

const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_VERIFY_ATTEMPTS = 10;
const MAX_CODES_PER_HOUR = 30;
const ONE_HOUR_MS = 60 * 60 * 1000;
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

function loadVerificationStore(): void {
  try {
    if (fs.existsSync(VERIFICATION_FILE)) {
      const raw = fs.readFileSync(VERIFICATION_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as Record<string, VerificationEntry>;
      if (parsed && typeof parsed === 'object') {
        for (const [k, v] of Object.entries(parsed)) {
          if (v && typeof v.email === 'string' && typeof v.code === 'string') {
            verificationStore.set(k.toLowerCase().trim(), v);
          }
        }
      }
    }
  } catch {
    // ignore read errors
  }
}

function saveVerificationStore(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const obj: Record<string, VerificationEntry> = {};
    for (const [k, v] of verificationStore.entries()) {
      obj[k] = v;
    }
    fs.writeFileSync(VERIFICATION_FILE, JSON.stringify(obj, null, 2), 'utf-8');
  } catch {
    // ignore write errors
  }
}

loadVerificationStore();

export function constantTimeStringEqual(a: string, b: string): boolean {
  const strA = String(a);
  const strB = String(b);
  const hashA = crypto.createHash('sha256').update(strA).digest();
  const hashB = crypto.createHash('sha256').update(strB).digest();
  const digestsMatch = crypto.timingSafeEqual(hashA, hashB);
  return digestsMatch && strA.length === strB.length;
}

export interface ResendDetailedResult {
  ok: boolean;
  messageId?: string;
  statusCode?: number;
  response?: any;
  error?: any;
}

async function postResendEmail(
  apiKey: string,
  to: string,
  subject: string,
  text: string,
  html: string
): Promise<{ response: Response; data: any }> {
  const response = await safeOutboundFetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: DEFAULT_FROM,
      to: [to],
      subject,
      text,
      html
    })
  });
  const data = await response.json().catch(() => null);
  return { response, data };
}

export async function sendResendEmailDetailed(payload: {
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<ResendDetailedResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || apiKey === 'MY_RESEND_API_KEY') {
    return {
      ok: false,
      statusCode: 401,
      error: {
        name: 'missing_api_key',
        message: 'RESEND_API_KEY is not configured on the backend.'
      }
    };
  }

  try {
    let { response, data } = await postResendEmail(
      apiKey,
      payload.to,
      payload.subject,
      payload.text,
      payload.html
    );

    // Retry once on Resend 429 rate limit (2 req/sec on free tier)
    if (response.status === 429) {
      await new Promise((r) => setTimeout(r, 750));
      ({ response, data } = await postResendEmail(
        apiKey,
        payload.to,
        payload.subject,
        payload.text,
        payload.html
      ));
    }

    if (response.ok) {
      return {
        ok: true,
        messageId: data?.id,
        statusCode: response.status,
        response: data
      };
    }

    return {
      ok: false,
      statusCode: response.status,
      error: data || { status: response.status, statusText: response.statusText },
      response: data
    };
  } catch (err: any) {
    return {
      ok: false,
      statusCode: 500,
      error: {
        name: err?.name || 'fetch_error',
        message: err?.message || 'Failed to reach Resend API'
      }
    };
  }
}

async function sendResendEmail(payload: {
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<boolean> {
  const res = await sendResendEmailDetailed(payload);
  return res.ok;
}

function checkAndRecordHourlyCodeRequest(email: string, now: number): boolean {
  const timestamps = (codeRequestsPerHourStore.get(email) || []).filter(
    (ts) => now - ts < ONE_HOUR_MS
  );
  if (timestamps.length >= MAX_CODES_PER_HOUR) {
    codeRequestsPerHourStore.set(email, timestamps);
    return false;
  }
  timestamps.push(now);
  codeRequestsPerHourStore.set(email, timestamps);
  return true;
}

export async function createAndSendVerificationCode(
  rawEmail: string,
  purpose: 'signup' | 'new_device' | 'password_reset' | 'manual_dev' = 'signup'
): Promise<{
  sent: boolean;
  resendCooldownSeconds: number;
  messageId?: string;
}> {
  loadVerificationStore();
  const email = rawEmail.toLowerCase().trim();
  const now = Date.now();

  if (!checkAndRecordHourlyCodeRequest(email, now)) {
    const err: any = new Error('Too many verification codes requested. Try again in an hour.');
    err.reason = 'code_rate_limit';
    err.status = 429;
    throw err;
  }

  const code = crypto.randomInt(100000, 1000000).toString();

  // Store the 6-digit code tied to this email with a 10-minute expiry
  verificationStore.set(email, {
    email,
    code,
    expiresAt: now + CODE_TTL_MS,
    lastSentAt: now,
    attempts: 0,
    locked: false,
    verifiedForReset: false
  });
  saveVerificationStore();

  const purposeTitle =
    purpose === 'password_reset'
      ? 'Your Caloriq password reset code'
      : purpose === 'new_device'
      ? 'Your Caloriq sign-in verification code'
      : 'Your Caloriq verification code';

  const text = `${purposeTitle}: ${code}\n\nThis code expires in 10 minutes.`;
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 420px; margin: 0 auto; padding: 24px; background-color: #09090b; color: #f4f4f5; border-radius: 16px; border: 1px solid #27272a;">
      <p style="font-size: 14px; color: #a1a1aa; margin: 0 0 12px 0;">${purposeTitle}</p>
      <div style="font-family: monospace; font-size: 28px; font-weight: 700; letter-spacing: 6px; color: #2dd4bf; background-color: #18181b; padding: 14px 18px; border-radius: 12px; text-align: center; border: 1px solid #27272a; margin-bottom: 16px;">
        ${code}
      </div>
      <p style="font-size: 13px; color: #a1a1aa; margin: 0;">This code expires in 10 minutes.</p>
    </div>
  `.trim();

  const sendResult = await sendResendEmailDetailed({
    to: email,
    subject: purposeTitle,
    text,
    html
  });

  if (!sendResult.ok) {
    verificationStore.delete(email);
    saveVerificationStore();
    const sendErr: any = new Error(
      'Email sending is limited during testing. Use the developer account email to sign up.'
    );
    sendErr.reason = 'resend_failed';
    sendErr.resendError = sendResult.error;
    sendErr.status = 403;
    throw sendErr;
  }

  return {
    sent: true,
    resendCooldownSeconds: 30,
    messageId: sendResult.messageId
  };
}

export function validateVerificationCode(
  rawEmail: string,
  submittedCode: string,
  consume: boolean = true
): void {
  loadVerificationStore();
  const email = rawEmail.toLowerCase().trim();
  const cleanCode = String(submittedCode || '').trim();
  const entry = verificationStore.get(email);

  if (!entry) {
    const err: any = new Error("That code isn't right. Check your email and try again.");
    err.reason = 'invalid_code';
    throw err;
  }

  if (Date.now() > entry.expiresAt) {
    const err: any = new Error('That code has expired. Tap Resend.');
    err.reason = 'expired';
    throw err;
  }

  if (
    !/^\d{6}$/.test(cleanCode) ||
    !/^\d{6}$/.test(entry.code) ||
    !constantTimeStringEqual(entry.code, cleanCode)
  ) {
    entry.attempts += 1;
    verificationStore.set(email, entry);
    saveVerificationStore();
    const wrongErr: any = new Error("That code isn't right. Check your email and try again.");
    wrongErr.reason = 'invalid_code';
    wrongErr.attemptNumber = entry.attempts;
    wrongErr.attemptsRemaining = Math.max(0, MAX_VERIFY_ATTEMPTS - entry.attempts);
    throw wrongErr;
  }

  if (consume) {
    verificationStore.delete(email);
    saveVerificationStore();
  } else {
    entry.verifiedForReset = true;
    entry.expiresAt = Date.now() + CODE_TTL_MS;
    verificationStore.set(email, entry);
    saveVerificationStore();
  }
}

export async function sendWelcomeEmail(rawEmail: string): Promise<void> {
  const email = rawEmail.toLowerCase().trim();
  const line = 'Welcome to Caloriq. Log your first meal to start your streak.';
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 420px; margin: 0 auto; padding: 24px; background-color: #09090b; color: #f4f4f5; border-radius: 16px; border: 1px solid #27272a;">
      <p style="font-size: 14px; color: #f4f4f5; line-height: 1.6; margin: 0;">${line}</p>
    </div>
  `.trim();

  await sendResendEmail({
    to: email,
    subject: 'Welcome to Caloriq',
    text: line,
    html
  });
}

export async function sendSuspiciousLoginAlertEmail(rawEmail: string): Promise<ResendDetailedResult> {
  const email = rawEmail.toLowerCase().trim();
  const line = "Someone tried to sign in to your Caloriq account. If this wasn't you, reset your password.";
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 420px; margin: 0 auto; padding: 24px; background-color: #09090b; color: #f4f4f5; border-radius: 16px; border: 1px solid #27272a;">
      <p style="font-size: 14px; color: #f4f4f5; line-height: 1.6; margin: 0;">${line}</p>
    </div>
  `.trim();

  return sendResendEmailDetailed({
    to: email,
    subject: 'Security Alert: Sign-in attempts on your Caloriq account',
    text: line,
    html
  });
}

export async function sendDevTestEmail(
  rawEmail: string,
  templateType: 'verification_code' | 'password_reset' | 'welcome' | 'weekly_recap' | 'suspicious_login'
): Promise<ResendDetailedResult> {
  const email = rawEmail.toLowerCase().trim();
  if (templateType === 'verification_code') {
    const sampleCode = crypto.randomInt(100000, 1000000).toString();
    const text = `Your Caloriq verification code is: ${sampleCode}\n\nThis code expires in 10 minutes.`;
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 420px; margin: 0 auto; padding: 24px; background-color: #09090b; color: #f4f4f5; border-radius: 16px; border: 1px solid #27272a;">
        <p style="font-size: 14px; color: #a1a1aa; margin: 0 0 12px 0;">Your Caloriq verification code (Test)</p>
        <div style="font-family: monospace; font-size: 28px; font-weight: 700; letter-spacing: 6px; color: #2dd4bf; background-color: #18181b; padding: 14px 18px; border-radius: 12px; text-align: center; border: 1px solid #27272a; margin-bottom: 16px;">
          ${sampleCode}
        </div>
        <p style="font-size: 13px; color: #a1a1aa; margin: 0;">This code expires in 10 minutes.</p>
      </div>
    `.trim();
    return sendResendEmailDetailed({
      to: email,
      subject: '[Test] Your Caloriq verification code',
      text,
      html
    });
  }

  if (templateType === 'password_reset') {
    const sampleCode = crypto.randomInt(100000, 1000000).toString();
    const text = `Your Caloriq password reset code is: ${sampleCode}\n\nThis code expires in 10 minutes.`;
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 420px; margin: 0 auto; padding: 24px; background-color: #09090b; color: #f4f4f5; border-radius: 16px; border: 1px solid #27272a;">
        <p style="font-size: 14px; color: #a1a1aa; margin: 0 0 12px 0;">Reset your Caloriq password (Test)</p>
        <div style="font-family: monospace; font-size: 28px; font-weight: 700; letter-spacing: 6px; color: #2dd4bf; background-color: #18181b; padding: 14px 18px; border-radius: 12px; text-align: center; border: 1px solid #27272a; margin-bottom: 16px;">
          ${sampleCode}
        </div>
        <p style="font-size: 13px; color: #a1a1aa; margin: 0;">This code expires in 10 minutes.</p>
      </div>
    `.trim();
    return sendResendEmailDetailed({
      to: email,
      subject: '[Test] Reset your Caloriq password',
      text,
      html
    });
  }

  if (templateType === 'welcome') {
    const line = 'Welcome to Caloriq. Log your first meal to start your streak.';
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 420px; margin: 0 auto; padding: 24px; background-color: #09090b; color: #f4f4f5; border-radius: 16px; border: 1px solid #27272a;">
        <p style="font-size: 14px; color: #f4f4f5; line-height: 1.6; margin: 0;">${line}</p>
      </div>
    `.trim();
    return sendResendEmailDetailed({
      to: email,
      subject: '[Test] Welcome to Caloriq',
      text: line,
      html
    });
  }

  if (templateType === 'weekly_recap') {
    const text = 'Caloriq Weekly Recap (Test)\nDays Logged: 6/7\nAverage Daily Intake: 1,920 kcal\nAverage Protein: 148g/day';
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; background-color: #09090b; color: #f4f4f5; border-radius: 16px; border: 1px solid #27272a;">
        <p style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #2dd4bf; margin: 0 0 6px 0;">Caloriq Weekly Recap (Test)</p>
        <h2 style="margin: 0 0 12px 0; font-size: 18px; color: #f4f4f5;">Weekly Nutrition Summary</h2>
        <p style="font-size: 13px; color: #e4e4e7; margin: 0;">Days Logged: 6/7 · Avg Intake: 1,920 kcal · Avg Protein: 148g/day</p>
      </div>
    `.trim();
    return sendResendEmailDetailed({
      to: email,
      subject: '[Test] Your Caloriq Weekly Recap',
      text,
      html
    });
  }

  // suspicious_login
  return sendSuspiciousLoginAlertEmail(email);
}

export async function createAndSendPasswordResetEmail(
  rawEmail: string,
  appOrigin: string
): Promise<{ sent: boolean; expiresInMinutes: number }> {
  const email = rawEmail.toLowerCase().trim();
  const now = Date.now();
  const token = crypto.randomBytes(24).toString('hex');
  const baseUrl = (process.env.APP_URL || appOrigin || 'http://localhost:3000').replace(/\/+$/, '');
  const resetLink = `${baseUrl}/?resetToken=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;

  const text = `Reset your Caloriq password using this link:\n\n${resetLink}\n\nThis link expires in 1 hour.`;
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 420px; margin: 0 auto; padding: 24px; background-color: #09090b; color: #f4f4f5; border-radius: 16px; border: 1px solid #27272a;">
      <p style="font-size: 14px; color: #a1a1aa; margin: 0 0 16px 0;">Reset your Caloriq password</p>
      <div style="margin-bottom: 16px;">
        <a href="${resetLink}" style="display: inline-block; background-color: #14b8a6; color: #09090b; font-weight: 600; font-size: 13px; text-decoration: none; padding: 10px 18px; border-radius: 10px;">
          Reset password
        </a>
      </div>
      <p style="font-size: 12px; color: #a1a1aa; word-break: break-all; margin: 0 0 12px 0;">${resetLink}</p>
      <p style="font-size: 13px; color: #a1a1aa; margin: 0;">This link expires in 1 hour.</p>
    </div>
  `.trim();

  await sendResendEmail({
    to: email,
    subject: 'Reset your Caloriq password',
    text,
    html
  });

  passwordResetStore.set(email, {
    email,
    token,
    expiresAt: now + RESET_TOKEN_TTL_MS,
    lastSentAt: now
  });

  return { sent: true, expiresInMinutes: 60 };
}

export function validateAndConsumePasswordResetToken(rawEmail: string, submittedToken: string): void {
  const email = rawEmail.toLowerCase().trim();
  const cleanToken = String(submittedToken || '').trim();
  const entry = passwordResetStore.get(email);

  if (!entry || Date.now() > entry.expiresAt) {
    passwordResetStore.delete(email);
    throw new Error('That reset link has expired (links are valid for 1 hour). Request a new one.');
  }

  if (!constantTimeStringEqual(entry.token, cleanToken)) {
    throw new Error('Invalid password reset link. Request a new one.');
  }

  passwordResetStore.delete(email);
}

// #46 Contact page form emails developer via Resend
export async function sendContactMessageEmail(payload: {
  name: string;
  email: string;
  subject: string;
  message: string;
}): Promise<boolean> {
  const text = `New Caloriq contact message\nFrom: ${payload.name} (${payload.email})\nSubject: ${payload.subject}\n\n${payload.message}`;
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; background-color: #09090b; color: #f4f4f5; border-radius: 16px; border: 1px solid #27272a;">
      <h3 style="margin: 0 0 12px 0; color: #2dd4bf;">Caloriq Contact Form</h3>
      <p style="font-size: 13px; color: #a1a1aa; margin: 0 0 8px 0;"><strong>From:</strong> ${payload.name} (${payload.email})</p>
      <p style="font-size: 13px; color: #a1a1aa; margin: 0 0 16px 0;"><strong>Subject:</strong> ${payload.subject}</p>
      <div style="padding: 14px; background-color: #18181b; border-radius: 12px; border: 1px solid #27272a; font-size: 13px; line-height: 1.6; color: #f4f4f5;">
        ${payload.message}
      </div>
    </div>
  `.trim();

  return sendResendEmail({
    to: DEVELOPER_EMAIL,
    subject: `[Caloriq Contact] ${payload.subject}`,
    text,
    html
  });
}

// #74 Uptime alert email via Resend
export async function sendUptimeAlertEmail(reason: string): Promise<boolean> {
  const text = `Caloriq Uptime Monitor Alert: ${reason} at ${new Date().toISOString()}`;
  const html = `<p><strong>Caloriq Uptime Alert:</strong> ${reason}</p><p>Timestamp: ${new Date().toISOString()}</p>`;
  return sendResendEmail({
    to: DEVELOPER_EMAIL,
    subject: '[Caloriq Alert] Service Health Check Warning',
    text,
    html
  });
}

// Group B: Weekly AI report emailed every Sunday via Resend
export async function sendWeeklySundayAiReportEmail(payload: {
  toEmail: string;
  userName: string;
  weekSummary: {
    avgCalories: number;
    targetCalories: number;
    avgProtein: number;
    daysLogged: number;
    insights: string[];
  };
}): Promise<boolean> {
  const recipient = (payload.toEmail || DEVELOPER_EMAIL).trim();
  const insightsHtml = (payload.weekSummary.insights || [])
    .map((line) => `<li style="margin-bottom: 8px; color: #e4e4e7;">${line}</li>`)
    .join('');
  const text = [
    `Caloriq Sunday Weekly AI Report for ${payload.userName}`,
    `Days Logged: ${payload.weekSummary.daysLogged}/7`,
    `Average Daily Intake: ${payload.weekSummary.avgCalories} kcal (Target: ${payload.weekSummary.targetCalories} kcal)`,
    `Average Protein: ${payload.weekSummary.avgProtein}g/day`,
    '',
    'Key Weekly AI Insights:',
    ...(payload.weekSummary.insights || []).map((l) => `- ${l}`)
  ].join('\n');

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; background-color: #09090b; color: #f4f4f5; border-radius: 16px; border: 1px solid #27272a;">
      <p style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #2dd4bf; margin: 0 0 6px 0;">Caloriq Sunday Digest</p>
      <h2 style="margin: 0 0 16px 0; font-size: 20px; color: #f4f4f5;">Weekly AI Nutrition Report</h2>
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 18px; padding: 12px; background-color: #18181b; border-radius: 12px; border: 1px solid #27272a; font-size: 12px;">
        <div><strong style="color: #2dd4bf;">${payload.weekSummary.daysLogged}/7</strong><br/><span style="color: #a1a1aa;">Days Logged</span></div>
        <div><strong style="color: #2dd4bf;">${payload.weekSummary.avgCalories} kcal</strong><br/><span style="color: #a1a1aa;">Avg Intake</span></div>
        <div><strong style="color: #2dd4bf;">${payload.weekSummary.avgProtein}g</strong><br/><span style="color: #a1a1aa;">Avg Protein</span></div>
      </div>
      <h4 style="margin: 0 0 10px 0; font-size: 13px; color: #a1a1aa;">AI Coaching Observations:</h4>
      <ul style="margin: 0; padding-left: 18px; font-size: 13px; line-height: 1.6;">
        ${insightsHtml}
      </ul>
    </div>
  `.trim();

  return sendResendEmail({
    to: recipient,
    subject: 'Your Caloriq Sunday Weekly AI Report',
    text,
    html
  });
}
