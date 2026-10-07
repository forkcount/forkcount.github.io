import 'dotenv/config';
import crypto from 'crypto';
import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import dotenv from 'dotenv';

function timingSafeEqualString(a: string | undefined | null, b: string | undefined | null): boolean {
  if (a === undefined || a === null || b === undefined || b === null) {
    return false;
  }
  const strA = String(a);
  const strB = String(b);
  const bufA = crypto.createHash('sha256').update(strA).digest();
  const bufB = crypto.createHash('sha256').update(strB).digest();
  const digestsMatch = crypto.timingSafeEqual(bufA, bufB);
  return digestsMatch && strA.length === strB.length;
}
import path from 'path';
import { validateOutboundUrl } from './src/server/ssrfGuard.js';
import {
  createGuestUser,
  findUserById,
  findUserByUsername,
  findUserByEmail,
  DEV_USERNAME,
  isUsernameTaken,
  fixDuplicateHouseflyAccounts,
  getDevSetupStatus,
  setupDevAccount,
  autoLoginDevAccount,
  signupUser,
  resetUserPassword,
  loginUser,
  registerSseClient,
  getProfile,
  updateProfile,
  getUserStats,
  getDiaryEntries,
  getAllDiaryEntries,
  addDiaryEntry,
  updateDiaryEntry,
  deleteDiaryEntry,
  copyYesterdayMeals,
  getWaterGlasses,
  setWaterGlasses,
  getExerciseEntries,
  getAllExerciseEntries,
  addExerciseEntry,
  deleteExerciseEntry,
  getWeightEntries,
  addWeightEntry,
  deleteWeightEntry,
  getBodyMeasurements,
  addBodyMeasurement,
  deleteBodyMeasurement,
  getProgressPhotos,
  addProgressPhoto,
  deleteProgressPhoto,
  getDailyHabitLog,
  getAllDailyHabitLogs,
  upsertDailyHabitLog,
  getCravings,
  addCraving,
  deleteCraving,
  getNonScaleVictories,
  addNonScaleVictory,
  deleteNonScaleVictory,
  getPantryItems,
  addPantryItem,
  deletePantryItem,
  getFriends,
  addFriend,
  removeFriend,
  shareRecipeToFriend,
  getSharedRecipes,
  getSavedFoods,
  addSavedFood,
  deleteSavedFood,
  getSavedRecipes,
  findSavedRecipeByName,
  saveRecipe,
  deleteSavedRecipe,
  getMealTemplates,
  saveMealTemplate,
  applyMealTemplate,
  deleteMealTemplate,
  restoreMealTemplate,
  getPlan,
  savePlan,
  setUsdaApiKey,
  hasUsdaApiKey,
  exportUserData,
  clearUserData,
  deleteUserAccount,
  sanitizeObjectStrings,
  sanitizeString,
  recordUserSession,
  getUserSessions,
  revokeUserSession,
  revokeAllUserSessions,
  verifyUserPassword,
  changeUserPassword,
  changeUsername,
  changeUserEmail,
  loginOrSignupWithGoogle,
  createDemoAccount,
  logCookieConsent,
  getCookieConsentLogs,
  recordPrivacyAnalyticsEvent,
  getPrivacyAnalyticsSummary,
  saveContactMessage,
  getContactMessages,
  saveBugReport,
  getBugReports,
  getMaintenanceStatus,
  setMaintenanceStatus,
  importUserBackupData,
  verifyUserCredentials,
  computeServerDeviceFingerprint,
  isTrustedDeviceForUser,
  trustDeviceForUser,
  checkAndTouchUserSessionActivity,
  logSecurityEvent,
  getSecurityEvents,
  logBackendError,
  getRecentBackendErrors,
  inspectAccountByEmail,
  seedFullWeekDemoAccount,
  resolveIpGeo,
  getCommunityPosts,
  getCommunityPostDetail,
  createCommunityPost,
  toggleLikeCommunityPost,
  addCommunityReply,
  reportCommunityPost,
  blockCommunityUser,
  toggleFollowCommunityUser,
  getReportedCommunityPosts,
  moderateDeleteCommunityPost,
  moderateDismissPostReport
} from './src/server/db.js';
import {
  createAndSendVerificationCode,
  validateVerificationCode,
  sendWelcomeEmail,
  createAndSendPasswordResetEmail,
  validateAndConsumePasswordResetToken,
  sendContactMessageEmail,
  sendUptimeAlertEmail,
  sendWeeklySundayAiReportEmail,
  sendSuspiciousLoginAlertEmail,
  sendDevTestEmail,
  constantTimeStringEqual
} from './src/server/emailService.js';
import { validateUsername, validatePasswordRules, getPasswordStrength } from './src/utils/validation.js';
import { formatLocalDate, addDaysLocal } from './src/utils/dateUtils.js';
import { parseIngredientLine } from './src/server/foodData.js';
import { searchUsdaFoods } from './src/server/usda.js';
import { generateWeekPlanWithGemini } from './src/server/aiPlanner.js';
import {
  parseVoiceMealWithGemini,
  analyzePlatePhotoWithGemini,
  analyzeFridgePhotoWithGemini,
  scanReceiptWithGemini,
  estimateRestaurantDishWithGemini,
  suggestFixMyDayWithGemini,
  suggestPantryMealsWithGemini,
  estimatePortionWithGemini,
  generateCravingPatternWithGemini,
  generateWeeklyInsightsWithGemini,
  rateExerciseWithGemini,
  recommendDailyWorkoutWithGemini,
  generateCoachSuggestionWithGemini,
  scanMenuWithGemini
} from './src/server/aiFeatures.js';

dotenv.config({ path: ['.env.local', '.env'], quiet: true });

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Remove X-Powered-By header
app.disable('x-powered-by');

// Apply Helmet security headers and Content Security Policy
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "'unsafe-eval'",
          "https://*.firebaseio.com",
          "https://*.googleapis.com",
          "https://*.gstatic.com",
          "https://apis.google.com",
          "https://generativelanguage.googleapis.com"
        ],
        connectSrc: [
          "'self'",
          "ws:",
          "wss:",
          "https://*.firebaseio.com",
          "https://*.googleapis.com",
          "https://generativelanguage.googleapis.com",
          "https://api.nal.usda.gov",
          "https://world.openfoodfacts.org"
        ],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "blob:", "https:"],
        frameAncestors: ["*"]
      }
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    frameguard: false
  })
);

app.use(express.json({ limit: '15mb' }));

// #24 Enforce HTTPS (redirect http to https in production)
app.use((req: Request, res: Response, next: NextFunction) => {
  if (
    process.env.NODE_ENV === 'production' &&
    req.headers['x-forwarded-proto'] === 'http'
  ) {
    const hostHeader = String(req.headers.host || '').replace(/[^a-zA-Z0-9.-:]/g, '');
    const rawUrl = String(req.url || '/');
    const safeUrl = rawUrl.startsWith('/') && !rawUrl.startsWith('//') && !rawUrl.startsWith('/\\') ? rawUrl : '/';
    res.redirect(301, `https://${hostHeader || 'localhost'}${safeUrl}`);
    return;
  }

  // #26 Sanitize every user input before storing
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObjectStrings(req.body);
  }

  // Record last 50 backend errors automatically
  if (req.path.startsWith('/api/')) {
    const origJson = res.json.bind(res);
    res.json = (body: any) => {
      if (res.statusCode >= 400 && body && typeof body === 'object' && body.error) {
        const userEmail =
          (req as any).user?.email ||
          (typeof req.body?.email === 'string' ? req.body.email : '');
        logBackendError(req.path, String(body.error), userEmail);
      }
      return origJson(body);
    };
  }
  next();
});

// #27 & Section 5: Rate limit signup, login, password reset, and AI calls per IP and per account
const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = rateLimitBuckets.get(key);
  if (!bucket || now > bucket.resetAt) {
    rateLimitBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= maxRequests) {
    return false;
  }
  bucket.count += 1;
  return true;
}

// 5.A & 5.G: Login rate limiting (max 5 failed attempts per email in 15 minutes -> lock for 15 minutes)
const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;
const failedLoginStore = new Map<
  string,
  { failedTimestamps: number[]; lockedUntil: number }
>();

function getEmailLockoutStatus(email: string): { locked: boolean; unlocksAt?: number } {
  const norm = email.toLowerCase().trim();
  const entry = failedLoginStore.get(norm);
  if (!entry) return { locked: false };
  const now = Date.now();
  if (entry.lockedUntil > now) {
    return { locked: true, unlocksAt: entry.lockedUntil };
  }
  return { locked: false };
}

function recordFailedLoginForEmail(email: string): {
  justLocked: boolean;
  unlocksAt?: number;
  failuresCount: number;
} {
  const norm = email.toLowerCase().trim();
  const now = Date.now();
  const existing = failedLoginStore.get(norm) || { failedTimestamps: [], lockedUntil: 0 };
  const recentFailures = existing.failedTimestamps.filter((ts) => now - ts <= FIFTEEN_MINUTES_MS);
  recentFailures.push(now);

  if (recentFailures.length >= 5) {
    const unlocksAt = now + FIFTEEN_MINUTES_MS;
    failedLoginStore.set(norm, { failedTimestamps: recentFailures, lockedUntil: unlocksAt });
    return { justLocked: true, unlocksAt, failuresCount: recentFailures.length };
  }

  failedLoginStore.set(norm, { failedTimestamps: recentFailures, lockedUntil: 0 });
  return { justLocked: false, failuresCount: recentFailures.length };
}

function clearFailedLoginsForEmail(email: string): void {
  failedLoginStore.delete(email.toLowerCase().trim());
}

function getClientIp(req: Request): string {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string') return xff.split(',')[0].trim();
  return req.socket.remoteAddress || '127.0.0.1';
}

function extractRequestDeviceFingerprint(req: Request): {
  fingerprintHash: string;
  rawFingerprint: string;
  deviceName: string;
  userAgent: string;
} {
  const ua = String(req.headers['user-agent'] || '');
  const metaHeader = req.headers['x-device-meta'];
  let meta: any = req.body?.deviceMeta || {};
  if (typeof metaHeader === 'string' && metaHeader.trim()) {
    try {
      meta = { ...meta, ...JSON.parse(metaHeader) };
    } catch {
      // ignore
    }
  }
  const computed = computeServerDeviceFingerprint(ua, meta);
  return {
    ...computed,
    userAgent: ua
  };
}

function rateLimitAuth(req: Request, res: Response, next: NextFunction) {
  const ip = getClientIp(req);
  const email = String(req.body?.email || '').toLowerCase().trim();
  const fp = extractRequestDeviceFingerprint(req);
  if (!checkRateLimit(`auth_ip:${ip}`, 40, 60_000)) {
    logSecurityEvent({
      eventType: 'rate_limit_hit',
      userEmail: email,
      ip,
      headers: req.headers,
      deviceFingerprint: fp.rawFingerprint,
      deviceName: fp.deviceName,
      userAgent: fp.userAgent,
      requestPath: req.path,
      summary: `Auth burst rate limit hit for IP ${ip} on ${req.path}`,
      metadata: { limit: 'per IP (burst)', endpoint: req.path, throttledIp: ip }
    }).catch(() => {});
    res.status(429).json({ error: 'Too many requests. Please wait a minute and try again.' });
    return;
  }
  if (email && !checkRateLimit(`auth_acct:${email}`, 20, 60_000)) {
    logSecurityEvent({
      eventType: 'rate_limit_hit',
      userEmail: email,
      ip,
      headers: req.headers,
      deviceFingerprint: fp.rawFingerprint,
      deviceName: fp.deviceName,
      userAgent: fp.userAgent,
      requestPath: req.path,
      summary: `Auth burst rate limit hit for email ${email} on ${req.path}`,
      metadata: { limit: 'per email (burst)', endpoint: req.path, throttledEmail: email }
    }).catch(() => {});
    res.status(429).json({ error: 'Too many requests. Please wait a minute and try again.' });
    return;
  }
  next();
}

app.use('/api/ai', (req: Request, res: Response, next: NextFunction) => {
  const ip = getClientIp(req);
  const authHeader = req.headers.authorization || '';
  if (!checkRateLimit(`ai_ip:${ip}`, 40, 60_000) || (authHeader && !checkRateLimit(`ai_acct:${authHeader}`, 30, 60_000))) {
    res.status(429).json({ error: 'AI rate limit reached. Please wait a minute before trying again.' });
    return;
  }
  next();
});

// Simple Auth & Row-Level Security Middleware (re-validates session & 30-day inactivity on every action)
function authenticateUser(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : (req.query.token as string);

  if (!token) {
    res.status(401).json({ error: 'Unauthorized: Missing authentication token' });
    return;
  }

  const emailHint = typeof req.headers['x-user-email'] === 'string' ? req.headers['x-user-email'] : undefined;
  const user = findUserById(token, emailHint);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized: Invalid user session' });
    return;
  }

  const activity = checkAndTouchUserSessionActivity(user.id);
  if (!activity.valid) {
    if (activity.expired) {
      const fp = extractRequestDeviceFingerprint(req);
      logSecurityEvent({
        eventType: 'session_revoked',
        userEmail: user.email || '',
        ip: getClientIp(req),
        headers: req.headers,
        deviceFingerprint: fp.rawFingerprint,
        deviceName: fp.deviceName,
        userAgent: fp.userAgent,
        requestPath: req.path,
        summary: `Session expired after 30 days of inactivity for ${user.email || user.id}`,
        metadata: { reason: 'Session expired' }
      }).catch(() => {});
    }
    res.status(401).json({ error: 'Session expired. Please sign in again.' });
    return;
  }

  if (!user.isGuest) {
    const existingSessions = getUserSessions(user.id, req.headers['user-agent'] || '');
    if (existingSessions.length === 0) {
      recordUserSession(user.id, req.headers['user-agent'] || '', 'Active Session', getClientIp(req));
    }
  }

  (req as any).user = user;
  (req as any).userId = user.id;
  next();
}

const DEV_EMAIL = 'housefly@mail2world.com';

function isDevAccountUser(user: any): boolean {
  if (!user || user.isGuest) return false;
  if (user.isDev === true && String(user.username || '').toLowerCase().trim() === DEV_USERNAME) {
    return true;
  }
  return false;
}

function authenticateDev(req: Request, res: Response, next: NextFunction) {
  authenticateUser(req, res, () => {
    const user = (req as any).user;
    if (!isDevAccountUser(user)) {
      res.status(403).json({ error: 'Forbidden: Dev Tools access restricted.' });
      return;
    }
    next();
  });
}

// ------------------- AUTH ROUTES -------------------
app.get('/api/auth/dev-status', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.json(getDevSetupStatus());
});

app.post('/api/auth/dev-setup', rateLimitAuth, async (req, res) => {
  const ip = getClientIp(req);
  const fp = extractRequestDeviceFingerprint(req);
  const { password, deviceToken, browserSig, guestId } = req.body || {};

  try {
    if (!password || String(password).length === 0) {
      res.status(400).json({ error: 'Please enter a password.' });
      return;
    }
    if (!deviceToken || typeof deviceToken !== 'string') {
      res.status(400).json({ error: 'Device lock token is required.' });
      return;
    }

    const user = setupDevAccount(
      String(password),
      String(deviceToken),
      String(browserSig || fp.rawFingerprint || ''),
      guestId
    );
    const geo = await resolveIpGeo(ip, req.headers);
    trustDeviceForUser(user.id, {
      fingerprintHash: fp.fingerprintHash,
      rawFingerprint: fp.rawFingerprint,
      deviceName: fp.deviceName,
      userAgent: fp.userAgent,
      ip,
      city: geo.city
    });
    const session = recordUserSession(user.id, fp.userAgent, `${geo.city}, ${geo.country}`, ip);

    await logSecurityEvent({
      eventType: 'dev_action',
      userEmail: DEV_USERNAME,
      ip,
      headers: req.headers,
      deviceFingerprint: fp.rawFingerprint,
      deviceName: fp.deviceName,
      userAgent: fp.userAgent,
      requestPath: req.path,
      summary: `Dev account @${DEV_USERNAME} set up and locked to device (${fp.deviceName})`,
      metadata: { action: 'dev_account_setup', userId: user.id }
    });

    res.json({
      userId: user.id,
      username: DEV_USERNAME,
      email: user.email || DEV_USERNAME,
      isGuest: false,
      isDev: true,
      token: user.id,
      deviceToken: user.devDeviceToken,
      sessionId: session.id
    });
  } catch (err: any) {
    res.status(err.status || 400).json({
      error: err.message || 'Could not set up dev account.',
      reason: err.reason
    });
  }
});

app.post('/api/auth/dev-auto-login', async (req, res) => {
  const ip = getClientIp(req);
  const fp = extractRequestDeviceFingerprint(req);
  const { deviceToken, browserSig } = req.body || {};

  try {
    const user = autoLoginDevAccount(
      String(deviceToken || ''),
      String(browserSig || '')
    );
    if (!user) {
      res.status(403).json({ error: 'Device lock does not match.' });
      return;
    }

    const geo = await resolveIpGeo(ip, req.headers);
    const session = recordUserSession(user.id, fp.userAgent, `${geo.city}, ${geo.country}`, ip);

    res.json({
      userId: user.id,
      username: DEV_USERNAME,
      email: user.email || DEV_USERNAME,
      isGuest: false,
      isDev: true,
      token: user.id,
      sessionId: session.id
    });
  } catch (err: any) {
    res.status(403).json({ error: err.message || 'Auto-login failed.' });
  }
});
app.post('/api/auth/guest', (req, res) => {
  try {
    const user = createGuestUser();
    res.json({
      userId: user.id,
      isGuest: true,
      token: user.id
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to create guest session' });
  }
});

app.post('/api/auth/send-verification-code', rateLimitAuth, async (req, res) => {
  const ip = getClientIp(req);
  const fp = extractRequestDeviceFingerprint(req);
  const { email, password, honeypot, websiteUrl, isResend, purpose } = req.body || {};
  const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  const resolvedPurpose =
    purpose === 'login_device' || purpose === 'new_device' || purpose === 'login'
      ? 'new_device'
      : purpose === 'password_reset'
      ? 'password_reset'
      : 'signup';

  try {
    // 5.I & 6.H Hidden honeypot field check to catch bots — reject silently and log
    if (honeypot || websiteUrl) {
      const filledField = honeypot ? 'company_website_hp' : 'websiteUrl';
      await logSecurityEvent({
        eventType: 'honeypot_triggered',
        userEmail: cleanEmail,
        ip,
        headers: req.headers,
        deviceFingerprint: fp.rawFingerprint,
        deviceName: fp.deviceName,
        userAgent: fp.userAgent,
        requestPath: req.path,
        summary: `Honeypot field "${filledField}" triggered during signup from ${ip}`,
        metadata: { filledField, honeypotValue: String(honeypot || websiteUrl).slice(0, 100) }
      });
      // Reject silently
      res.status(200).json({
        sent: true,
        resendCooldownSeconds: 30
      });
      return;
    }

    if (!isResend && !checkRateLimit(`signup_ip_hr:${ip}`, 30, ONE_HOUR_MS)) {
      await logSecurityEvent({
        eventType: 'rate_limit_hit',
        userEmail: cleanEmail,
        ip,
        headers: req.headers,
        deviceFingerprint: fp.rawFingerprint,
        deviceName: fp.deviceName,
        userAgent: fp.userAgent,
        requestPath: req.path,
        summary: `Signup IP rate limit hit (30/hr) for IP ${ip}`,
        metadata: { limit: 'per IP (30 signup attempts/hr)', endpoint: req.path, throttledIp: ip, email: cleanEmail }
      });
      res.status(429).json({ error: 'Too many signup attempts from this IP. Try again in an hour.' });
      return;
    }

    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      await logSecurityEvent({
        eventType: 'signup_attempt',
        userEmail: cleanEmail,
        ip,
        headers: req.headers,
        deviceFingerprint: fp.rawFingerprint,
        deviceName: fp.deviceName,
        userAgent: fp.userAgent,
        requestPath: req.path,
        summary: `Signup attempt failed: invalid email (${cleanEmail || 'empty'})`,
        metadata: { outcome: 'failure', reason: 'invalid_email' }
      });
      res.status(400).json({ error: 'Please enter a valid email address.' });
      return;
    }

    if (resolvedPurpose === 'signup' && password !== undefined && String(password).length > 0) {
      const pwError = validatePasswordRules(String(password || ''), cleanEmail);
      if (pwError || getPasswordStrength(String(password || ''), cleanEmail).score < 2) {
        await logSecurityEvent({
          eventType: 'signup_attempt',
          userEmail: cleanEmail,
          ip,
          headers: req.headers,
          deviceFingerprint: fp.rawFingerprint,
          deviceName: fp.deviceName,
          userAgent: fp.userAgent,
          requestPath: req.path,
          summary: `Signup attempt failed for ${cleanEmail}: password policy not met`,
          metadata: { outcome: 'failure', reason: pwError || 'weak_password' }
        });
        res.status(400).json({ error: pwError || 'Password must be at least Fair strength.' });
        return;
      }
    }

    const result = await createAndSendVerificationCode(cleanEmail, resolvedPurpose);
    await logSecurityEvent({
      eventType: 'code_requested',
      userEmail: cleanEmail,
      ip,
      headers: req.headers,
      deviceFingerprint: fp.rawFingerprint,
      deviceName: fp.deviceName,
      userAgent: fp.userAgent,
      requestPath: req.path,
      summary: `Verification code (${resolvedPurpose}) requested for ${cleanEmail} from ${ip}`,
      metadata: { purpose: resolvedPurpose }
    });

    res.json({
      sent: result.sent,
      resendCooldownSeconds: result.resendCooldownSeconds
    });
  } catch (err: any) {
    if (err.reason === 'code_rate_limit') {
      await logSecurityEvent({
        eventType: 'code_rate_limit',
        userEmail: cleanEmail,
        ip,
        headers: req.headers,
        deviceFingerprint: fp.rawFingerprint,
        deviceName: fp.deviceName,
        userAgent: fp.userAgent,
        requestPath: req.path,
        summary: `Too many verification codes requested (>5/hr) for ${cleanEmail}`,
        metadata: { limit: '5 codes per email per hour', throttledEmail: cleanEmail }
      });
      await logSecurityEvent({
        eventType: 'rate_limit_hit',
        userEmail: cleanEmail,
        ip,
        headers: req.headers,
        deviceFingerprint: fp.rawFingerprint,
        deviceName: fp.deviceName,
        userAgent: fp.userAgent,
        requestPath: req.path,
        summary: `Code rate limit hit (5/hr) for email ${cleanEmail}`,
        metadata: { limit: 'per email (5 codes/hr)', endpoint: req.path, throttledEmail: cleanEmail }
      });
    }
    const status = err.status || 400;
    res.status(status).json({
      error: err.message || 'Email sending is limited during testing. Use the developer account email to sign up.',
      retryAfterSeconds: err.retryAfterSeconds
    });
  }
});

async function logCodeValidationFailure(
  err: any,
  cleanEmail: string,
  ip: string,
  req: Request,
  fp: { rawFingerprint: string; deviceName: string; userAgent: string }
) {
  if (err.reason === 'expired') {
    await logSecurityEvent({
      eventType: 'code_expired',
      userEmail: cleanEmail,
      ip,
      headers: req.headers,
      deviceFingerprint: fp.rawFingerprint,
      deviceName: fp.deviceName,
      userAgent: fp.userAgent,
      requestPath: req.path,
      summary: `Expired verification code submitted for ${cleanEmail}`
    });
  } else if (err.reason === 'locked') {
    await logSecurityEvent({
      eventType: 'code_locked',
      userEmail: cleanEmail,
      ip,
      headers: req.headers,
      deviceFingerprint: fp.rawFingerprint,
      deviceName: fp.deviceName,
      userAgent: fp.userAgent,
      requestPath: req.path,
      summary: `Verification code locked after 5 wrong attempts for ${cleanEmail}`,
      metadata: { attempts: err.attemptNumber || 5 }
    });
  } else if (err.reason === 'invalid_code') {
    await logSecurityEvent({
      eventType: 'code_wrong',
      userEmail: cleanEmail,
      ip,
      headers: req.headers,
      deviceFingerprint: fp.rawFingerprint,
      deviceName: fp.deviceName,
      userAgent: fp.userAgent,
      requestPath: req.path,
      summary: `Wrong verification code entered for ${cleanEmail} (attempt ${err.attemptNumber}/5)`,
      metadata: { attemptNumber: err.attemptNumber, attemptsRemaining: err.attemptsRemaining }
    });
  }
}

app.post('/api/auth/verify-signup', async (req, res) => {
  const ip = getClientIp(req);
  const fp = extractRequestDeviceFingerprint(req);
  const { email, password, code, guestId } = req.body || {};
  const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

  try {
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      res.status(400).json({ error: 'Please enter a valid email address.' });
      return;
    }
    const pwError = validatePasswordRules(String(password || ''), cleanEmail);
    if (pwError) {
      res.status(400).json({ error: pwError });
      return;
    }
    if (!code || String(code).trim().length === 0) {
      res.status(400).json({ error: "That code isn't right. Check your email and try again." });
      return;
    }

    validateVerificationCode(cleanEmail, String(code), true);

    await logSecurityEvent({
      eventType: 'code_correct',
      userEmail: cleanEmail,
      ip,
      headers: req.headers,
      deviceFingerprint: fp.rawFingerprint,
      deviceName: fp.deviceName,
      userAgent: fp.userAgent,
      requestPath: req.path,
      summary: `Verification code verified for signup (${cleanEmail})`
    });

    const user = signupUser(cleanEmail, String(password), guestId);
    const geo = await resolveIpGeo(ip, req.headers);
    trustDeviceForUser(user.id, {
      fingerprintHash: fp.fingerprintHash,
      rawFingerprint: fp.rawFingerprint,
      deviceName: fp.deviceName,
      userAgent: fp.userAgent,
      ip,
      city: geo.city
    });
    recordUserSession(user.id, fp.userAgent, `${geo.city}, ${geo.country}`, ip);

    await logSecurityEvent({
      eventType: 'signup_attempt',
      userEmail: cleanEmail,
      ip,
      headers: req.headers,
      deviceFingerprint: fp.rawFingerprint,
      deviceName: fp.deviceName,
      userAgent: fp.userAgent,
      requestPath: req.path,
      summary: `Signup succeeded for ${cleanEmail} from ${ip} (${geo.city})`,
      metadata: { outcome: 'success', userId: user.id }
    });

    sendWelcomeEmail(cleanEmail).catch(() => {});

    res.json({
      userId: user.id,
      email: user.email,
      isGuest: false,
      token: user.id
    });
  } catch (err: any) {
    await logCodeValidationFailure(err, cleanEmail, ip, req, fp);
    res.status(400).json({
      error: err.message || "That code isn't right. Check your email and try again.",
      reason: err.reason,
      locked: Boolean(err.locked),
      attemptsRemaining: err.attemptsRemaining
    });
  }
});

// Password reset Step 1: Request 6-digit code (never reveal whether email exists)
app.post('/api/auth/forgot-password', rateLimitAuth, async (req, res) => {
  const ip = getClientIp(req);
  const fp = extractRequestDeviceFingerprint(req);
  const { email, isResend } = req.body || {};
  const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

  try {
    // 5.B IP rate limiting: 10 password reset requests per IP per hour
    if (!isResend && !checkRateLimit(`pwreset_ip_hr:${ip}`, 10, ONE_HOUR_MS)) {
      await logSecurityEvent({
        eventType: 'rate_limit_hit',
        userEmail: cleanEmail,
        ip,
        headers: req.headers,
        deviceFingerprint: fp.rawFingerprint,
        deviceName: fp.deviceName,
        userAgent: fp.userAgent,
        requestPath: req.path,
        summary: `Password reset IP rate limit hit (10/hr) for IP ${ip}`,
        metadata: { limit: 'per IP (10 password resets/hr)', endpoint: req.path, throttledIp: ip }
      });
      res.status(429).json({ error: 'Too many password reset requests. Please try again later.' });
      return;
    }

    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      res.status(400).json({ error: 'Please enter a valid email address.' });
      return;
    }

    await logSecurityEvent({
      eventType: 'password_reset_requested',
      userEmail: cleanEmail,
      ip,
      headers: req.headers,
      deviceFingerprint: fp.rawFingerprint,
      deviceName: fp.deviceName,
      userAgent: fp.userAgent,
      requestPath: req.path,
      summary: `Password reset requested for ${cleanEmail} from ${ip}`
    });

    await createAndSendVerificationCode(cleanEmail, 'password_reset');
    await logSecurityEvent({
      eventType: 'code_requested',
      userEmail: cleanEmail,
      ip,
      headers: req.headers,
      deviceFingerprint: fp.rawFingerprint,
      deviceName: fp.deviceName,
      userAgent: fp.userAgent,
      requestPath: req.path,
      summary: `Password reset 6-digit code sent to ${cleanEmail} from ${ip}`,
      metadata: { purpose: 'password_reset' }
    });

    // 5.F Never reveal whether an email exists
    res.json({
      sent: true,
      resendCooldownSeconds: 30,
      message: 'If that email is registered, a code has been sent.'
    });
  } catch (err: any) {
    if (err.reason === 'code_rate_limit') {
      await logSecurityEvent({
        eventType: 'code_rate_limit',
        userEmail: cleanEmail,
        ip,
        headers: req.headers,
        deviceFingerprint: fp.rawFingerprint,
        deviceName: fp.deviceName,
        userAgent: fp.userAgent,
        requestPath: req.path,
        summary: `Too many password reset codes requested (>5/hr) for ${cleanEmail}`,
        metadata: { limit: '5 codes per email per hour', throttledEmail: cleanEmail }
      });
      await logSecurityEvent({
        eventType: 'rate_limit_hit',
        userEmail: cleanEmail,
        ip,
        headers: req.headers,
        deviceFingerprint: fp.rawFingerprint,
        deviceName: fp.deviceName,
        userAgent: fp.userAgent,
        requestPath: req.path,
        summary: `Password reset code rate limit hit (5/hr) for ${cleanEmail}`,
        metadata: { limit: 'per email (5 codes/hr)', endpoint: req.path, throttledEmail: cleanEmail }
      });
    }
    const status = err.status || 400;
    res.status(status).json({
      error: err.message || 'Email sending is limited during testing. Use the developer account email to sign up.',
      retryAfterSeconds: err.retryAfterSeconds
    });
  }
});

// Password reset Step 2: Verify 6-digit code before setting new password
app.post('/api/auth/verify-reset-code', rateLimitAuth, async (req, res) => {
  const ip = getClientIp(req);
  const fp = extractRequestDeviceFingerprint(req);
  const { email, code } = req.body || {};
  const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

  try {
    if (!cleanEmail || !code) {
      res.status(400).json({ error: "That code isn't right. Check your email and try again." });
      return;
    }

    validateVerificationCode(cleanEmail, String(code), false);

    await logSecurityEvent({
      eventType: 'code_correct',
      userEmail: cleanEmail,
      ip,
      headers: req.headers,
      deviceFingerprint: fp.rawFingerprint,
      deviceName: fp.deviceName,
      userAgent: fp.userAgent,
      requestPath: req.path,
      summary: `Password reset 6-digit code verified for ${cleanEmail}`
    });

    res.json({ verified: true });
  } catch (err: any) {
    await logCodeValidationFailure(err, cleanEmail, ip, req, fp);
    res.status(400).json({
      error: err.message || "That code isn't right. Check your email and try again.",
      reason: err.reason,
      locked: Boolean(err.locked),
      attemptsRemaining: err.attemptsRemaining
    });
  }
});

// Password reset Step 3: Set new password & sign in
app.post('/api/auth/reset-password', rateLimitAuth, async (req, res) => {
  const ip = getClientIp(req);
  const fp = extractRequestDeviceFingerprint(req);
  const { email, code, token, newPassword, guestId } = req.body || {};
  const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

  try {
    if (!cleanEmail || (!code && !token)) {
      res.status(400).json({ error: 'Invalid password reset request.' });
      return;
    }
    const pwError = validatePasswordRules(String(newPassword || ''), cleanEmail);
    if (pwError || getPasswordStrength(String(newPassword || ''), cleanEmail).score < 2) {
      res.status(400).json({ error: pwError || 'Password must be at least Fair strength.' });
      return;
    }

    if (code) {
      validateVerificationCode(cleanEmail, String(code), true);
    } else {
      validateAndConsumePasswordResetToken(cleanEmail, String(token));
    }

    const existingUser = findUserByEmail(cleanEmail);
    const wasKnownDevice = existingUser
      ? isTrustedDeviceForUser(existingUser.id, fp.fingerprintHash)
      : false;

    const user = resetUserPassword(cleanEmail, String(newPassword), guestId);
    clearFailedLoginsForEmail(cleanEmail);

    const geo = await resolveIpGeo(ip, req.headers);
    trustDeviceForUser(user.id, {
      fingerprintHash: fp.fingerprintHash,
      rawFingerprint: fp.rawFingerprint,
      deviceName: fp.deviceName,
      userAgent: fp.userAgent,
      ip,
      city: geo.city
    });
    const session = recordUserSession(user.id, fp.userAgent, `${geo.city}, ${geo.country}`, ip);

    if (!wasKnownDevice) {
      await logSecurityEvent({
        eventType: 'password_reset_new_device',
        userEmail: cleanEmail,
        ip,
        headers: req.headers,
        deviceFingerprint: fp.rawFingerprint,
        deviceName: fp.deviceName,
        userAgent: fp.userAgent,
        requestPath: req.path,
        summary: `Password reset completed from a new device for ${cleanEmail} (${ip}, ${geo.city})`
      });
    }

    await logSecurityEvent({
      eventType: 'password_reset_completed',
      userEmail: cleanEmail,
      ip,
      headers: req.headers,
      deviceFingerprint: fp.rawFingerprint,
      deviceName: fp.deviceName,
      userAgent: fp.userAgent,
      requestPath: req.path,
      summary: `Password reset completed for ${cleanEmail} from ${ip}`
    });

    res.json({
      userId: user.id,
      email: user.email,
      isGuest: false,
      token: user.id,
      sessionId: session.id
    });
  } catch (err: any) {
    await logCodeValidationFailure(err, cleanEmail, ip, req, fp);
    res.status(400).json({
      error: err.message || 'Could not reset password.',
      reason: err.reason,
      locked: Boolean(err.locked),
      attemptsRemaining: err.attemptsRemaining
    });
  }
});

app.post('/api/auth/signup', rateLimitAuth, async (req, res) => {
  const ip = getClientIp(req);
  const fp = extractRequestDeviceFingerprint(req);
  const { username, password, confirmPassword, honeypot, websiteUrl, guestId } = req.body || {};
  const cleanUsername = typeof username === 'string' ? username.trim() : '';

  try {
    if (honeypot || websiteUrl) {
      const filledField = honeypot ? 'company_website_hp' : 'websiteUrl';
      await logSecurityEvent({
        eventType: 'honeypot_triggered',
        userEmail: cleanUsername,
        ip,
        headers: req.headers,
        deviceFingerprint: fp.rawFingerprint,
        deviceName: fp.deviceName,
        userAgent: fp.userAgent,
        requestPath: req.path,
        summary: `Honeypot field "${filledField}" triggered during signup from ${ip}`,
        metadata: { filledField, honeypotValue: String(honeypot || websiteUrl).slice(0, 100) }
      });
      res.status(400).json({ error: 'Could not create account.' });
      return;
    }

    const usernameErr = validateUsername(cleanUsername);
    if (usernameErr) {
      res.status(400).json({ error: usernameErr });
      return;
    }

    if (!password || String(password).length === 0) {
      res.status(400).json({ error: 'Please enter a password.' });
      return;
    }

    if (confirmPassword !== undefined && !timingSafeEqualString(String(password), String(confirmPassword))) {
      res.status(400).json({ error: 'Passwords do not match.' });
      return;
    }

    if (cleanUsername.toLowerCase() === DEV_USERNAME || isUsernameTaken(cleanUsername) || findUserByUsername(cleanUsername)) {
      res.status(400).json({ error: 'That username is taken. Try another.' });
      return;
    }

    const user = signupUser(cleanUsername, String(password), guestId);
    const geo = await resolveIpGeo(ip, req.headers);
    trustDeviceForUser(user.id, {
      fingerprintHash: fp.fingerprintHash,
      rawFingerprint: fp.rawFingerprint,
      deviceName: fp.deviceName,
      userAgent: fp.userAgent,
      ip,
      city: geo.city
    });
    const session = recordUserSession(user.id, fp.userAgent, `${geo.city}, ${geo.country}`, ip);

    await logSecurityEvent({
      eventType: 'signup_attempt',
      userEmail: cleanUsername,
      ip,
      headers: req.headers,
      deviceFingerprint: fp.rawFingerprint,
      deviceName: fp.deviceName,
      userAgent: fp.userAgent,
      requestPath: req.path,
      summary: `Signup succeeded for @${cleanUsername} from ${ip} (${geo.city})`,
      metadata: { outcome: 'success', userId: user.id, username: cleanUsername }
    });

    res.json({
      userId: user.id,
      username: user.username || cleanUsername,
      email: user.email,
      isGuest: false,
      token: user.id,
      sessionId: session.id
    });
  } catch (err: any) {
    res.status(400).json({
      error: err.message || 'Failed to create account.',
      reason: err.reason
    });
  }
});

app.post('/api/auth/login', rateLimitAuth, async (req, res) => {
  const ip = getClientIp(req);
  const fp = extractRequestDeviceFingerprint(req);
  const { username, email, password, guestId } = req.body || {};
  const identifier =
    typeof username === 'string' && username.trim()
      ? username.trim()
      : typeof email === 'string'
      ? email.trim()
      : '';

  try {
    if (!identifier || !password || String(password).length === 0) {
      await logSecurityEvent({
        eventType: 'failed_login',
        userEmail: identifier,
        ip,
        headers: req.headers,
        deviceFingerprint: fp.rawFingerprint,
        deviceName: fp.deviceName,
        userAgent: fp.userAgent,
        requestPath: req.path,
        summary: `Failed login: missing username or password from ${ip}`,
        metadata: { reason: 'missing_fields' }
      });
      res.status(400).json({ error: 'Wrong username or password.' });
      return;
    }

    const credCheck = verifyUserCredentials(identifier, String(password));
    if (!credCheck.valid || !credCheck.user) {
      await logSecurityEvent({
        eventType: 'failed_login',
        userEmail: identifier,
        ip,
        headers: req.headers,
        deviceFingerprint: fp.rawFingerprint,
        deviceName: fp.deviceName,
        userAgent: fp.userAgent,
        requestPath: req.path,
        summary: `Failed login for ${identifier} from ${ip}`,
        metadata: { reason: credCheck.reason || 'invalid_credentials' }
      });
      res.status(400).json({ error: 'Wrong username or password.' });
      return;
    }

    clearFailedLoginsForEmail(identifier);

    const previousLoginAt = credCheck.user.lastLoginAt;
    const user = loginUser(identifier, String(password), guestId);
    const geo = await resolveIpGeo(ip, req.headers);
    trustDeviceForUser(user.id, {
      fingerprintHash: fp.fingerprintHash,
      rawFingerprint: fp.rawFingerprint,
      deviceName: fp.deviceName,
      userAgent: fp.userAgent,
      ip,
      city: geo.city
    });
    const session = recordUserSession(user.id, fp.userAgent, `${geo.city}, ${geo.country}`, ip);

    await logSecurityEvent({
      eventType: 'login_known_device',
      userEmail: user.username || user.email || identifier,
      ip,
      headers: req.headers,
      deviceFingerprint: fp.rawFingerprint,
      deviceName: fp.deviceName,
      userAgent: fp.userAgent,
      requestPath: req.path,
      summary: `Successful login (${fp.deviceName}) for ${user.username || user.email || identifier} in ${geo.city}, ${geo.country} (${ip})`,
      metadata: {
        fingerprintHash: fp.fingerprintHash,
        city: geo.city,
        country: geo.country
      }
    });

    res.json({
      userId: user.id,
      username: user.username,
      email: user.email || user.username,
      isGuest: false,
      isDev: Boolean(user.isDev),
      token: user.id,
      lastLoginAt: previousLoginAt || user.lastLoginAt,
      sessionId: session.id,
      requiresVerification: false
    });
  } catch (err: any) {
    res.status(400).json({
      error: 'Wrong username or password.'
    });
  }
});

// Verify 6-digit code for sign-in
app.post('/api/auth/verify-login-device', rateLimitAuth, async (req, res) => {
  const ip = getClientIp(req);
  const fp = extractRequestDeviceFingerprint(req);
  const { email, password, code, guestId } = req.body || {};
  const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

  try {
    if (!cleanEmail || !code || String(code).trim().length === 0) {
      res.status(400).json({ error: "That code isn't right. Check your email and try again." });
      return;
    }

    validateVerificationCode(cleanEmail, String(code), true);

    await logSecurityEvent({
      eventType: 'code_correct',
      userEmail: cleanEmail,
      ip,
      headers: req.headers,
      deviceFingerprint: fp.rawFingerprint,
      deviceName: fp.deviceName,
      userAgent: fp.userAgent,
      requestPath: req.path,
      summary: `Sign-in verification code confirmed for ${cleanEmail}`
    });

    const existing = findUserByEmail(cleanEmail);
    const previousLoginAt = existing?.lastLoginAt;
    const user = existing
      ? loginUser(cleanEmail, String(password || ''), guestId)
      : signupUser(cleanEmail, String(password || ''), guestId);
    const geo = await resolveIpGeo(ip, req.headers);

    trustDeviceForUser(user.id, {
      fingerprintHash: fp.fingerprintHash,
      rawFingerprint: fp.rawFingerprint,
      deviceName: fp.deviceName,
      userAgent: fp.userAgent,
      ip,
      city: geo.city
    });

    const session = recordUserSession(user.id, fp.userAgent, `${geo.city}, ${geo.country}`, ip);

    await logSecurityEvent({
      eventType: 'login_new_device',
      userEmail: cleanEmail,
      ip,
      headers: req.headers,
      deviceFingerprint: fp.rawFingerprint,
      deviceName: fp.deviceName,
      userAgent: fp.userAgent,
      requestPath: req.path,
      summary: `Successful login (${fp.deviceName}) for ${cleanEmail} in ${geo.city}, ${geo.country} (${ip})`,
      metadata: {
        fingerprintHash: fp.fingerprintHash,
        fullFingerprint: fp.rawFingerprint,
        city: geo.city,
        country: geo.country
      }
    });

    res.json({
      userId: user.id,
      email: user.email,
      isGuest: false,
      token: user.id,
      lastLoginAt: previousLoginAt || user.lastLoginAt,
      sessionId: session.id
    });
  } catch (err: any) {
    await logCodeValidationFailure(err, cleanEmail, ip, req, fp);
    res.status(400).json({
      error: err.message || "That code isn't right. Check your email and try again.",
      reason: err.reason,
      locked: Boolean(err.locked),
      attemptsRemaining: err.attemptsRemaining
    });
  }
});

// Resend code for sign-in
app.post('/api/auth/resend-login-code', rateLimitAuth, async (req, res) => {
  const ip = getClientIp(req);
  const fp = extractRequestDeviceFingerprint(req);
  const { email } = req.body || {};
  const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

  try {
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      res.status(400).json({ error: 'Please enter a valid email address.' });
      return;
    }
    const result = await createAndSendVerificationCode(cleanEmail, 'new_device');
    await logSecurityEvent({
      eventType: 'code_requested',
      userEmail: cleanEmail,
      ip,
      headers: req.headers,
      deviceFingerprint: fp.rawFingerprint,
      deviceName: fp.deviceName,
      userAgent: fp.userAgent,
      requestPath: req.path,
      summary: `Resent sign-in verification code to ${cleanEmail} from ${ip}`,
      metadata: { purpose: 'new_device_login_resend' }
    });
    res.json({
      sent: result.sent,
      resendCooldownSeconds: result.resendCooldownSeconds
    });
  } catch (err: any) {
    if (err.reason === 'code_rate_limit') {
      await logSecurityEvent({
        eventType: 'code_rate_limit',
        userEmail: cleanEmail,
        ip,
        headers: req.headers,
        deviceFingerprint: fp.rawFingerprint,
        deviceName: fp.deviceName,
        userAgent: fp.userAgent,
        requestPath: req.path,
        summary: `Too many login verification codes requested for ${cleanEmail}`
      });
    }
    res.status(err.status || 400).json({
      error: err.message || 'Email sending is limited during testing. Use the developer account email to sign up.',
      retryAfterSeconds: err.retryAfterSeconds
    });
  }
});

// Manual sign out endpoint (invalidates immediately & logs session_revoked)
app.post('/api/auth/logout', authenticateUser, async (req, res) => {
  const user = (req as any).user;
  const ip = getClientIp(req);
  const fp = extractRequestDeviceFingerprint(req);
  revokeAllUserSessions(user.id);
  if (!user.isGuest) {
    await logSecurityEvent({
      eventType: 'session_revoked',
      userEmail: user.email || '',
      ip,
      headers: req.headers,
      deviceFingerprint: fp.rawFingerprint,
      deviceName: fp.deviceName,
      userAgent: fp.userAgent,
      requestPath: req.path,
      summary: `Session revoked: Signed out manually by ${user.email || user.id}`,
      metadata: { reason: 'Signed out manually' }
    });
  }
  res.json({ success: true });
});

// #54 Allow login with Google sign-in as an alternative to email
app.post('/api/auth/google', rateLimitAuth, (req, res) => {
  try {
    const { email, name, guestId } = req.body;
    const cleanEmail = typeof email === 'string' && email.includes('@') ? email.trim().toLowerCase() : 'google.user@gmail.com';
    const user = loginOrSignupWithGoogle(cleanEmail, String(name || 'Google Member'), guestId);
    const session = recordUserSession(user.id, req.headers['user-agent'] || '', 'Local Region', getClientIp(req));
    res.json({
      userId: user.id,
      email: user.email,
      isGuest: false,
      token: user.id,
      lastLoginAt: user.lastLoginAt,
      sessionId: session.id
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Google sign-in failed.' });
  }
});

// #58 Demo mode button on the landing page: loads a temporary account with sample data
app.post('/api/auth/demo', (req, res) => {
  try {
    const user = createDemoAccount();
    res.json({
      userId: user.id,
      email: user.email,
      isGuest: true,
      isDemo: true,
      token: user.id
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Could not start demo mode.' });
  }
});

// #52 Session list in the Me tab & #31 Sign out all devices
app.get('/api/auth/sessions', authenticateUser, (req, res) => {
  const userId = (req as any).userId;
  const sessions = getUserSessions(userId, req.headers['user-agent'] || '');
  res.json({ sessions });
});

app.delete('/api/auth/sessions/:id', authenticateUser, async (req, res) => {
  const userId = (req as any).userId;
  const user = (req as any).user;
  const ok = revokeUserSession(userId, req.params.id);
  if (ok) {
    const fp = extractRequestDeviceFingerprint(req);
    await logSecurityEvent({
      eventType: 'session_revoked',
      userEmail: user?.email || '',
      ip: getClientIp(req),
      headers: req.headers,
      deviceFingerprint: fp.rawFingerprint,
      deviceName: fp.deviceName,
      userAgent: fp.userAgent,
      requestPath: req.path,
      summary: `Session ${req.params.id} revoked manually by ${user?.email || userId}`,
      metadata: { reason: 'Signed out manually', sessionId: req.params.id }
    });
  }
  res.json({ success: ok });
});

app.post('/api/auth/signout-all', authenticateUser, async (req, res) => {
  const userId = (req as any).userId;
  const user = (req as any).user;
  const count = revokeAllUserSessions(userId);
  const fp = extractRequestDeviceFingerprint(req);
  await logSecurityEvent({
    eventType: 'session_revoked',
    userEmail: user?.email || '',
    ip: getClientIp(req),
    headers: req.headers,
    deviceFingerprint: fp.rawFingerprint,
    deviceName: fp.deviceName,
    userAgent: fp.userAgent,
    requestPath: req.path,
    summary: `Signed out all devices (${count} sessions revoked) for ${user?.email || userId}`,
    metadata: { reason: 'Signed out all devices', revokedCount: count }
  });
  res.json({ success: true, revokedCount: count });
});

// #50 Password change flow: require current password, then new password twice
app.post('/api/auth/change-password', authenticateUser, rateLimitAuth, (req, res) => {
  try {
    const userId = (req as any).userId;
    const { currentPassword, newPassword, confirmNewPassword } = req.body;
    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: 'Current password and new password are required.' });
      return;
    }
    if (confirmNewPassword !== undefined && !timingSafeEqualString(String(newPassword), String(confirmNewPassword))) {
      res.status(400).json({ error: 'New passwords do not match.' });
      return;
    }
    if (String(newPassword).length < 4) {
      res.status(400).json({ error: 'New password must be at least 4 characters.' });
      return;
    }
    changeUserPassword(userId, String(currentPassword), String(newPassword));
    res.json({ success: true, message: 'Password updated.' });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Could not change password.' });
  }
});

app.post('/api/auth/change-username', authenticateUser, rateLimitAuth, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { newUsername, password } = req.body || {};
    if (!newUsername || !String(newUsername).trim()) {
      res.status(400).json({ error: 'New username is required.' });
      return;
    }
    if (password && !verifyUserPassword(userId, String(password))) {
      res.status(400).json({ error: 'Current password is incorrect.' });
      return;
    }
    const updatedUser = changeUsername(userId, String(newUsername));
    res.json({
      success: true,
      username: updatedUser.username,
      message: `Username updated to @${updatedUser.username}.`
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Could not update username.' });
  }
});

// #49 Email change flow: verify old email, then new email, then update
app.post('/api/auth/change-email', authenticateUser, rateLimitAuth, async (req, res) => {
  const ip = getClientIp(req);
  const fp = extractRequestDeviceFingerprint(req);
  try {
    const userId = (req as any).userId;
    const { oldEmail, newEmail, password } = req.body;
    if (!oldEmail || !newEmail) {
      res.status(400).json({ error: 'Both current and new email addresses are required.' });
      return;
    }
    if (password && !verifyUserPassword(userId, String(password))) {
      res.status(400).json({ error: 'Current password is incorrect.' });
      return;
    }
    await logSecurityEvent({
      eventType: 'email_change_requested',
      userEmail: String(oldEmail).toLowerCase().trim(),
      ip,
      headers: req.headers,
      deviceFingerprint: fp.rawFingerprint,
      deviceName: fp.deviceName,
      userAgent: fp.userAgent,
      requestPath: req.path,
      summary: `Email change requested from ${oldEmail} to ${newEmail} (IP: ${ip})`,
      metadata: {
        oldEmail: String(oldEmail).toLowerCase().trim(),
        newEmail: String(newEmail).toLowerCase().trim(),
        ip
      }
    });
    const updatedUser = changeUserEmail(userId, String(oldEmail), String(newEmail));
    res.json({ success: true, email: updatedUser.email });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Could not update email.' });
  }
});

// ------------------- DEV TOOLS ROUTES (RESTRICTED TO housefly@mail2world.com) -------------------
// A. Send test email
app.post('/api/dev/send-test-email', authenticateDev, async (req, res) => {
  const ip = getClientIp(req);
  const fp = extractRequestDeviceFingerprint(req);
  const devEmail = (req as any).user?.username || DEV_USERNAME;
  const { toEmail, recipientEmail, templateType } = req.body || {};
  const cleanTo = String(toEmail || recipientEmail || '').trim().toLowerCase();

  if (!cleanTo || !cleanTo.includes('@')) {
    res.status(400).json({ error: 'Enter a valid recipient email address.' });
    return;
  }

  const allowedTypes = new Set([
    'verification_code',
    'password_reset',
    'welcome',
    'weekly_recap',
    'suspicious_login',
    'suspicious_login_alert'
  ]);
  const rawType = templateType === 'suspicious_login_alert' ? 'suspicious_login' : templateType;
  const selectedType = allowedTypes.has(rawType) ? rawType : 'verification_code';

  const result = await sendDevTestEmail(cleanTo, selectedType);

  await logSecurityEvent({
    eventType: 'dev_action',
    userEmail: devEmail,
    ip,
    headers: req.headers,
    deviceFingerprint: fp.rawFingerprint,
    deviceName: fp.deviceName,
    userAgent: fp.userAgent,
    requestPath: req.path,
    summary: `Dev action: Sent test email (${selectedType}) to ${cleanTo}`,
    metadata: { action: 'send_test_email', toEmail: cleanTo, templateType: selectedType, ok: result.ok }
  });

  res.json({
    success: Boolean(result.ok),
    recipientEmail: cleanTo,
    templateType: selectedType,
    resendResult: result,
    ...result
  });
});

// B. Account inspector
app.get('/api/dev/inspect-account', authenticateDev, async (req, res) => {
  const ip = getClientIp(req);
  const fp = extractRequestDeviceFingerprint(req);
  const devEmail = (req as any).user?.email || DEV_EMAIL;
  const targetEmail = String(req.query.email || '').trim().toLowerCase();
  const silent = req.query.silent === '1';

  if (!targetEmail) {
    res.status(400).json({ error: 'Email parameter is required.' });
    return;
  }

  const inspected = inspectAccountByEmail(targetEmail);

  if (!silent) {
    await logSecurityEvent({
      eventType: 'dev_action',
      userEmail: devEmail,
      ip,
      headers: req.headers,
      deviceFingerprint: fp.rawFingerprint,
      deviceName: fp.deviceName,
      userAgent: fp.userAgent,
      requestPath: req.path,
      summary: `Dev action: Inspected account ${targetEmail} (${inspected ? 'found' : 'not found'})`,
      metadata: { action: 'account_inspector', targetEmail, found: Boolean(inspected) }
    });
  }

  if (!inspected) {
    res.status(404).json({ found: false, error: 'No account found for that username or email.' });
    return;
  }

  res.json({ found: true, account: inspected });
});

// C. Send verification code manually
app.post('/api/dev/send-verification-code', authenticateDev, async (req, res) => {
  const ip = getClientIp(req);
  const fp = extractRequestDeviceFingerprint(req);
  const devEmail = (req as any).user?.email || DEV_EMAIL;
  const targetEmail = String(req.body?.email || '').trim().toLowerCase();

  if (!targetEmail || !targetEmail.includes('@')) {
    res.status(400).json({ error: 'Enter a valid email address.' });
    return;
  }

  try {
    const result = await createAndSendVerificationCode(targetEmail, 'manual_dev');
    await logSecurityEvent({
      eventType: 'dev_action',
      userEmail: devEmail,
      ip,
      headers: req.headers,
      deviceFingerprint: fp.rawFingerprint,
      deviceName: fp.deviceName,
      userAgent: fp.userAgent,
      requestPath: req.path,
      summary: `Dev action: Sent manual verification code to ${targetEmail}`,
      metadata: { action: 'manual_verification_code', targetEmail, messageId: result.messageId }
    });
    res.json({
      sent: true,
      messageId: result.messageId,
      resendCooldownSeconds: result.resendCooldownSeconds
    });
  } catch (err: any) {
    res.status(err.status || 400).json({
      error: err.message || 'Email sending is limited during testing. Use the developer account email to sign up.',
      resendError: err.resendError
    });
  }
});

// D. Delete a single user account
app.post('/api/dev/delete-user', authenticateDev, async (req, res) => {
  const ip = getClientIp(req);
  const fp = extractRequestDeviceFingerprint(req);
  const devEmail = (req as any).user?.email || DEV_EMAIL;
  const email = String(req.body?.email || '').trim().toLowerCase();
  const confirmEmail = String(req.body?.confirmEmail || '').trim().toLowerCase();

  if (!email || !confirmEmail || !constantTimeStringEqual(email, confirmEmail)) {
    res.status(400).json({ error: 'Both email fields must match exactly.' });
    return;
  }

  if (email === DEV_EMAIL || email === DEV_USERNAME) {
    res.status(400).json({ error: "The developer's own account cannot be deleted." });
    return;
  }

  const targetUser = findUserByUsername(email) || findUserByEmail(email);
  if (!targetUser) {
    res.status(404).json({ error: 'No account found with that username or email.' });
    return;
  }
  if (targetUser.isDev) {
    res.status(400).json({ error: "The developer's own account cannot be deleted." });
    return;
  }

  const deletedUserId = targetUser.id;
  deleteUserAccount(deletedUserId);

  await logSecurityEvent({
    eventType: 'dev_action',
    userEmail: devEmail,
    ip,
    headers: req.headers,
    deviceFingerprint: fp.rawFingerprint,
    deviceName: fp.deviceName,
    userAgent: fp.userAgent,
    requestPath: req.path,
    summary: `Dev action: Single-account delete executed for ${email} (ID: ${deletedUserId})`,
    metadata: { action: 'delete_single_user', deletedEmail: email, deletedUserId }
  });

  res.json({
    success: true,
    deletedEmail: email,
    deletedUserId
  });
});

// E. Seed demo account
app.post('/api/dev/seed-demo-account', authenticateDev, async (req, res) => {
  const ip = getClientIp(req);
  const fp = extractRequestDeviceFingerprint(req);
  const devEmail = (req as any).user?.email || DEV_EMAIL;

  const seeded = seedFullWeekDemoAccount();

  await logSecurityEvent({
    eventType: 'dev_action',
    userEmail: devEmail,
    ip,
    headers: req.headers,
    deviceFingerprint: fp.rawFingerprint,
    deviceName: fp.deviceName,
    userAgent: fp.userAgent,
    requestPath: req.path,
    summary: `Dev action: Seeded demo account ${seeded.email} with 7 days of logs`,
    metadata: { action: 'seed_demo_account', ...seeded }
  });

  res.json({
    success: true,
    ...seeded
  });
});

// F. View recent errors
app.get('/api/dev/recent-errors', authenticateDev, (_req, res) => {
  res.json({
    errors: getRecentBackendErrors()
  });
});

// G. Suspicious activity log
app.get('/api/dev/security-events', authenticateDev, (req, res) => {
  const search = typeof req.query.search === 'string' ? req.query.search : '';
  const eventType = typeof req.query.eventType === 'string' ? req.query.eventType : 'all';
  const limit = Number(req.query.limit) || 500;
  const data = getSecurityEvents({ search, eventType, limit });
  res.json(data);
});

// H. Community Moderation (Reported Posts)
app.get('/api/dev/reported-posts', authenticateDev, (_req, res) => {
  res.json({
    reports: getReportedCommunityPosts()
  });
});

app.post('/api/dev/moderation/delete-post', authenticateDev, async (req, res) => {
  const ip = getClientIp(req);
  const fp = extractRequestDeviceFingerprint(req);
  const devEmail = (req as any).user?.username || DEV_USERNAME;
  const postId = String(req.body?.postId || '').trim();
  if (!postId) {
    res.status(400).json({ error: 'postId is required.' });
    return;
  }
  const deleted = moderateDeleteCommunityPost(postId);
  await logSecurityEvent({
    eventType: 'dev_action',
    userEmail: devEmail,
    ip,
    headers: req.headers,
    deviceFingerprint: fp.rawFingerprint,
    deviceName: fp.deviceName,
    userAgent: fp.userAgent,
    requestPath: req.path,
    summary: `Dev action: Deleted reported community post ${postId}`,
    metadata: { action: 'moderate_delete_post', postId, deleted }
  });
  res.json({
    success: true,
    deleted,
    reports: getReportedCommunityPosts()
  });
});

app.post('/api/dev/moderation/dismiss-report', authenticateDev, async (req, res) => {
  const ip = getClientIp(req);
  const fp = extractRequestDeviceFingerprint(req);
  const devEmail = (req as any).user?.username || DEV_USERNAME;
  const targetId = String(req.body?.reportId || req.body?.postId || '').trim();
  if (!targetId) {
    res.status(400).json({ error: 'reportId or postId is required.' });
    return;
  }
  const dismissed = moderateDismissPostReport(targetId);
  await logSecurityEvent({
    eventType: 'dev_action',
    userEmail: devEmail,
    ip,
    headers: req.headers,
    deviceFingerprint: fp.rawFingerprint,
    deviceName: fp.deviceName,
    userAgent: fp.userAgent,
    requestPath: req.path,
    summary: `Dev action: Dismissed community report ${targetId}`,
    metadata: { action: 'moderate_dismiss_report', targetId, dismissed }
  });
  res.json({
    success: true,
    dismissed,
    reports: getReportedCommunityPosts()
  });
});

app.get('/api/auth/me', authenticateUser, (req, res) => {
  const user = (req as any).user;
  const profile = getProfile(user.id);
  const stats = getUserStats(user.id);
  const isDev = isDevAccountUser(user);
  res.json({
    userId: user.id,
    username: user.username || profile.username,
    email: user.email || user.username || profile.username,
    isGuest: user.isGuest,
    isDev,
    lastSignedInAt: user.lastLoginAt || null,
    createdAt: user.createdAt || null,
    profile: { ...profile, isDev },
    stats
  });
});

// ------------------- REAL-TIME SYNC (SSE) -------------------
app.get('/api/sync/events', (req, res) => {
  const token = req.query.token as string;
  if (!token) {
    res.status(401).send('Missing token');
    return;
  }
  const user = findUserById(token);
  if (!user) {
    res.status(401).send('Invalid user');
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const unregister = registerSseClient(user.id, res);

  req.on('close', () => {
    unregister();
  });
});

// ------------------- DIARY FOOD -------------------
app.get('/api/diary', authenticateUser, (req, res) => {
  const userId = (req as any).userId;
  const date = (req.query.date as string) || formatLocalDate();
  const items = getDiaryEntries(userId, date);
  res.json({ date, items });
});

app.get('/api/diary/all', authenticateUser, (req, res) => {
  const userId = (req as any).userId;
  const items = getAllDiaryEntries(userId);
  res.json({ items });
});

app.post('/api/diary', authenticateUser, (req, res) => {
  try {
    const userId = (req as any).userId;
    const {
      date,
      mealType,
      name,
      calories,
      carbs,
      fat,
      protein,
      fiber,
      sugar,
      sodium,
      iron,
      calcium,
      vitaminD,
      caffeineMg,
      standardDrinks,
      serving,
      note,
      unusualQuantity,
      loggedHour,
      costEstimate,
      source
    } = req.body;
    if (!name || calories === undefined || !date || !mealType) {
      res.status(400).json({ error: 'Missing required food fields' });
      return;
    }

    const item = addDiaryEntry(userId, {
      date,
      mealType,
      name: name.trim(),
      calories: Math.round(Number(calories)),
      carbs: Math.round(Number(carbs || 0) * 10) / 10,
      fat: Math.round(Number(fat || 0) * 10) / 10,
      protein: Math.round(Number(protein || 0) * 10) / 10,
      fiber: fiber !== undefined ? Number(fiber) : undefined,
      sugar: sugar !== undefined ? Number(sugar) : undefined,
      sodium: sodium !== undefined ? Number(sodium) : undefined,
      iron: iron !== undefined ? Number(iron) : undefined,
      calcium: calcium !== undefined ? Number(calcium) : undefined,
      vitaminD: vitaminD !== undefined ? Number(vitaminD) : undefined,
      caffeineMg: caffeineMg !== undefined ? Math.round(Number(caffeineMg)) : undefined,
      standardDrinks: standardDrinks !== undefined ? Math.round(Number(standardDrinks) * 10) / 10 : undefined,
      serving: serving || '1 serving',
      note: note ? String(note).trim() : undefined,
      unusualQuantity: Boolean(unusualQuantity),
      loggedHour: loggedHour !== undefined ? Number(loggedHour) : undefined,
      costEstimate: costEstimate !== undefined ? Number(costEstimate) : undefined,
      source: source || 'manual'
    });

    res.json(item);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/diary/:id', authenticateUser, (req, res) => {
  const userId = (req as any).userId;
  const updated = updateDiaryEntry(userId, req.params.id, req.body);
  if (updated) {
    res.json(updated);
  } else {
    res.status(404).json({ error: 'Food entry not found' });
  }
});

app.delete('/api/diary/:id', authenticateUser, (req, res) => {
  const userId = (req as any).userId;
  const success = deleteDiaryEntry(userId, req.params.id);
  if (success) {
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Food entry not found' });
  }
});

app.post('/api/diary/copy-yesterday', authenticateUser, (req, res) => {
  const userId = (req as any).userId;
  const targetDate = req.body.date || formatLocalDate();
  const mealType = req.body.mealType;
  const items = copyYesterdayMeals(userId, targetDate, mealType);
  res.json({ success: true, count: items.length, items });
});

// ------------------- WATER TRACKER -------------------
app.get('/api/water', authenticateUser, (req, res) => {
  const userId = (req as any).userId;
  const date = (req.query.date as string) || formatLocalDate();
  const glasses = getWaterGlasses(userId, date);
  res.json({ date, glasses });
});

app.post('/api/water', authenticateUser, (req, res) => {
  const userId = (req as any).userId;
  const { date, glasses } = req.body;
  if (!date || glasses === undefined) {
    res.status(400).json({ error: 'Date and glasses count required' });
    return;
  }
  const result = setWaterGlasses(userId, date, Number(glasses));
  res.json({ date, glasses: result });
});

// ------------------- FITNESS / EXERCISE -------------------
app.get('/api/exercise', authenticateUser, (req, res) => {
  const userId = (req as any).userId;
  const date = (req.query.date as string) || formatLocalDate();
  const items = getExerciseEntries(userId, date);
  res.json({ date, items });
});

app.get('/api/exercise/all', authenticateUser, (req, res) => {
  const userId = (req as any).userId;
  const items = getAllExerciseEntries(userId);
  res.json({ items });
});

app.post('/api/exercise', authenticateUser, (req, res) => {
  try {
    const userId = (req as any).userId;
    const {
      date,
      activityName,
      met,
      minutes,
      caloriesBurned,
      intensity,
      weightKg,
      reps,
      sets,
      distanceKm,
      plankSeconds
    } = req.body;
    if (!activityName || !minutes || caloriesBurned === undefined || !date) {
      res.status(400).json({ error: 'Missing required exercise fields' });
      return;
    }

    const item = addExerciseEntry(userId, {
      date,
      activityName: activityName.trim(),
      met: Number(met) || 5,
      minutes: Number(minutes),
      caloriesBurned: Math.round(Number(caloriesBurned)),
      intensity: intensity || 'Moderate',
      weightKg: weightKg !== undefined ? Number(weightKg) : undefined,
      reps: reps !== undefined ? Number(reps) : undefined,
      sets: sets !== undefined ? Number(sets) : undefined,
      distanceKm: distanceKm !== undefined ? Number(distanceKm) : undefined,
      plankSeconds: plankSeconds !== undefined ? Number(plankSeconds) : undefined
    });

    res.json(item);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/exercise/:id', authenticateUser, (req, res) => {
  const userId = (req as any).userId;
  const success = deleteExerciseEntry(userId, req.params.id);
  if (success) {
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Exercise entry not found' });
  }
});

// ------------------- WEIGHT TRACKER -------------------
app.get('/api/weight', authenticateUser, (req, res) => {
  const userId = (req as any).userId;
  const items = getWeightEntries(userId);
  res.json({ items });
});

app.post('/api/weight', authenticateUser, (req, res) => {
  try {
    const userId = (req as any).userId;
    const { date, weightKg } = req.body;
    if (!date || !weightKg) {
      res.status(400).json({ error: 'Date and weight are required' });
      return;
    }

    const record = addWeightEntry(userId, date, Number(weightKg));
    res.json(record);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/weight/:id', authenticateUser, (req, res) => {
  const userId = (req as any).userId;
  const success = deleteWeightEntry(userId, req.params.id);
  if (success) {
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Weight entry not found' });
  }
});

// ------------------- BODY MEASUREMENTS & PHOTOS -------------------
app.get('/api/measurements', authenticateUser, (req, res) => {
  const userId = (req as any).userId;
  res.json({ items: getBodyMeasurements(userId) });
});

app.post('/api/measurements', authenticateUser, (req, res) => {
  const userId = (req as any).userId;
  const item = addBodyMeasurement(userId, req.body);
  res.json(item);
});

app.delete('/api/measurements/:id', authenticateUser, (req, res) => {
  const userId = (req as any).userId;
  const success = deleteBodyMeasurement(userId, req.params.id);
  res.json({ success });
});

app.get('/api/progress-photos', authenticateUser, (req, res) => {
  const userId = (req as any).userId;
  res.json({ items: getProgressPhotos(userId) });
});

app.post('/api/progress-photos', authenticateUser, (req, res) => {
  const userId = (req as any).userId;
  const item = addProgressPhoto(userId, req.body);
  res.json(item);
});

app.delete('/api/progress-photos/:id', authenticateUser, (req, res) => {
  const userId = (req as any).userId;
  const success = deleteProgressPhoto(userId, req.params.id);
  res.json({ success });
});

// ------------------- HABITS, CRAVINGS & VICTORIES -------------------
app.get('/api/habits', authenticateUser, (req, res) => {
  const userId = (req as any).userId;
  const date = (req.query.date as string) || formatLocalDate();
  res.json({ habit: getDailyHabitLog(userId, date), allHabits: getAllDailyHabitLogs(userId) });
});

app.post('/api/habits', authenticateUser, (req, res) => {
  const userId = (req as any).userId;
  const { date, ...updates } = req.body;
  const targetDate = date || formatLocalDate();
  const habit = upsertDailyHabitLog(userId, targetDate, updates);
  res.json(habit);
});

app.get('/api/cravings', authenticateUser, (req, res) => {
  const userId = (req as any).userId;
  res.json({ items: getCravings(userId) });
});

app.post('/api/cravings', authenticateUser, (req, res) => {
  const userId = (req as any).userId;
  const item = addCraving(userId, req.body);
  res.json(item);
});

app.delete('/api/cravings/:id', authenticateUser, (req, res) => {
  const userId = (req as any).userId;
  res.json({ success: deleteCraving(userId, req.params.id) });
});

app.get('/api/victories', authenticateUser, (req, res) => {
  const userId = (req as any).userId;
  res.json({ items: getNonScaleVictories(userId) });
});

app.post('/api/victories', authenticateUser, (req, res) => {
  const userId = (req as any).userId;
  const { date, text } = req.body;
  if (!text || !text.trim()) {
    res.status(400).json({ error: 'Victory text required' });
    return;
  }
  const item = addNonScaleVictory(userId, date || formatLocalDate(), text);
  res.json(item);
});

app.delete('/api/victories/:id', authenticateUser, (req, res) => {
  const userId = (req as any).userId;
  res.json({ success: deleteNonScaleVictory(userId, req.params.id) });
});

// ------------------- PANTRY & LEFTOVERS -------------------
app.get('/api/pantry', authenticateUser, (req, res) => {
  const userId = (req as any).userId;
  res.json({ items: getPantryItems(userId) });
});

app.post('/api/pantry', authenticateUser, (req, res) => {
  const userId = (req as any).userId;
  const item = addPantryItem(userId, req.body);
  res.json(item);
});

app.delete('/api/pantry/:id', authenticateUser, (req, res) => {
  const userId = (req as any).userId;
  res.json({ success: deletePantryItem(userId, req.params.id) });
});

// ------------------- SOCIAL & FRIENDS -------------------
app.get('/api/social', authenticateUser, (req, res) => {
  const userId = (req as any).userId;
  res.json({
    friends: getFriends(userId),
    sharedRecipes: getSharedRecipes(userId)
  });
});

app.post('/api/social/friends', authenticateUser, (req, res) => {
  const userId = (req as any).userId;
  const { username, isPartner } = req.body;
  if (!username || !username.trim()) {
    res.status(400).json({ error: 'Username required' });
    return;
  }
  const friend = addFriend(userId, username, isPartner);
  res.json(friend);
});

app.delete('/api/social/friends/:id', authenticateUser, (req, res) => {
  const userId = (req as any).userId;
  res.json({ success: removeFriend(userId, req.params.id) });
});

app.post('/api/social/share-recipe', authenticateUser, (req, res) => {
  const userId = (req as any).userId;
  const shared = shareRecipeToFriend(userId, req.body);
  res.json(shared);
});

// ------------------- COMMUNITY FEED (POSTS & REPLIES) -------------------
function resolveOptionalViewerId(req: Request): string | undefined {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : (req.query.token as string | undefined);
  if (!token) return undefined;
  const emailHint =
    typeof req.headers['x-user-email'] === 'string' ? req.headers['x-user-email'] : undefined;
  const user = findUserById(token, emailHint);
  return user?.id;
}

app.get('/api/community/posts', (req, res) => {
  const viewerId = resolveOptionalViewerId(req);
  const rawFilter = String(req.query.filter || 'all').toLowerCase();
  const filter: 'all' | 'following' | 'mine' =
    rawFilter === 'following' ? 'following' : rawFilter === 'mine' ? 'mine' : 'all';
  const posts = getCommunityPosts(viewerId, filter);
  res.json({ posts });
});

app.get('/api/community/posts/:id', (req, res) => {
  const viewerId = resolveOptionalViewerId(req);
  const detail = getCommunityPostDetail(req.params.id, viewerId);
  if (!detail.post) {
    res.status(404).json({ error: 'Post not found.' });
    return;
  }
  res.json(detail);
});

app.post('/api/community/posts', authenticateUser, (req, res) => {
  try {
    const user = (req as any).user;
    const headerHint = typeof req.headers['x-user-email'] === 'string' ? req.headers['x-user-email'].trim() : '';
    const bodyUsername = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
    const usernameHint = bodyUsername || headerHint || undefined;
    const { text, imageUrl } = req.body || {};
    if (imageUrl && typeof imageUrl === 'string' && imageUrl.trim()) {
      const urlCheck = validateOutboundUrl(imageUrl, { allowListOnly: false });
      if (!urlCheck.valid) {
        res.status(400).json({ error: `Invalid or unsafe image URL.` });
        return;
      }
    }
    const post = createCommunityPost(
      user?.id || '',
      String(text || ''),
      imageUrl ? String(imageUrl) : undefined,
      usernameHint
    );
    res.json({ post });
  } catch (err: any) {
    res.status(err.status || 400).json({ error: err.message || 'Could not publish post.' });
  }
});

app.post('/api/community/posts/:id/like', authenticateUser, (req, res) => {
  try {
    const userId = (req as any).userId;
    const result = toggleLikeCommunityPost(userId, req.params.id);
    res.json(result);
  } catch (err: any) {
    res.status(err.status || 400).json({ error: err.message || 'Could not update like.' });
  }
});

app.post('/api/community/posts/:id/replies', authenticateUser, (req, res) => {
  try {
    const user = (req as any).user;
    const headerHint = typeof req.headers['x-user-email'] === 'string' ? req.headers['x-user-email'].trim() : '';
    const bodyUsername = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
    const usernameHint = bodyUsername || headerHint || undefined;
    const { text } = req.body || {};
    const reply = addCommunityReply(user?.id || '', req.params.id, String(text || ''), usernameHint);
    res.json({ reply });
  } catch (err: any) {
    res.status(err.status || 400).json({ error: err.message || 'Could not post reply.' });
  }
});

app.post('/api/community/posts/:id/report', authenticateUser, (req, res) => {
  try {
    const userId = (req as any).userId;
    const report = reportCommunityPost(userId, req.params.id, req.body?.reason);
    res.json({ reported: true, report });
  } catch (err: any) {
    res.status(err.status || 400).json({ error: err.message || 'Could not report post.' });
  }
});

app.post('/api/community/block', authenticateUser, (req, res) => {
  try {
    const userId = (req as any).userId;
    const target = String(req.body?.targetUserId || req.body?.username || '').trim();
    if (!target) {
      res.status(400).json({ error: 'Target user is required.' });
      return;
    }
    const result = blockCommunityUser(userId, target);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Could not block user.' });
  }
});

app.post('/api/community/follow', authenticateUser, (req, res) => {
  try {
    const userId = (req as any).userId;
    const username = String(req.body?.username || '').trim();
    if (!username) {
      res.status(400).json({ error: 'Username is required.' });
      return;
    }
    const result = toggleFollowCommunityUser(userId, username);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Could not update follow status.' });
  }
});

// ------------------- GEMINI AI ENDPOINTS -------------------
app.post('/api/ai/voice-log', authenticateUser, async (req, res) => {
  try {
    const result = await parseVoiceMealWithGemini(req.body.transcript || '');
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/ai/plate-photo', authenticateUser, async (req, res) => {
  try {
    const result = await analyzePlatePhotoWithGemini(req.body.image, req.body.mimeType);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/ai/fridge-photo', authenticateUser, async (req, res) => {
  try {
    const result = await analyzeFridgePhotoWithGemini(
      req.body.image,
      req.body.mimeType,
      req.body.remainingMacros || { calories: 600, protein: 45, carbs: 60, fat: 20 }
    );
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/ai/receipt-scan', authenticateUser, async (req, res) => {
  try {
    const result = await scanReceiptWithGemini(req.body.image, req.body.mimeType);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/ai/scan-menu', async (req, res) => {
  try {
    const images = Array.isArray(req.body.images)
      ? req.body.images
      : req.body.image
        ? [{ base64Image: req.body.image, mimeType: req.body.mimeType }]
        : [];
    const result = await scanMenuWithGemini(images, req.body.userGoal, req.body.remainingMacros);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/ai/restaurant-estimate', authenticateUser, async (req, res) => {
  try {
    const result = await estimateRestaurantDishWithGemini(req.body.restaurant || '', req.body.dish || '');
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/ai/fix-my-day', authenticateUser, async (req, res) => {
  try {
    const result = await suggestFixMyDayWithGemini(req.body.overByKcal || 200, req.body.loggedFoods || []);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/ai/what-can-i-make', authenticateUser, async (req, res) => {
  try {
    const result = await suggestPantryMealsWithGemini(
      req.body.pantryItems || [],
      req.body.remainingMacros || { calories: 600, protein: 40, carbs: 50, fat: 20 }
    );
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/ai/portion-estimator', authenticateUser, async (req, res) => {
  try {
    const result = await estimatePortionWithGemini(req.body);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/ai/craving-pattern', authenticateUser, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const cravings = Array.isArray(req.body?.cravings) ? req.body.cravings : getCravings(userId);
    const result = await generateCravingPatternWithGemini(cravings);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/ai/weekly-insights', authenticateUser, async (req, res) => {
  try {
    const result = await generateWeeklyInsightsWithGemini(req.body);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/ai/exercise-rating', authenticateUser, async (req, res) => {
  try {
    const result = await rateExerciseWithGemini(req.body || {});
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/ai/exercise-recommendation', authenticateUser, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const result = await recommendDailyWorkoutWithGemini({
      ...(req.body || {}),
      userId: req.body?.userId || userId
    });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/ai/coach-suggestion', authenticateUser, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const rawDays = Array.isArray(req.body?.days) ? req.body.days : [];
    const enrichedDays = rawDays.map((d: any) => {
      const dbWater = d?.date ? getWaterGlasses(userId, String(d.date)) : 0;
      const waterGlasses = Math.max(Number(d?.waterGlasses) || 0, dbWater);
      const hasAnyLog = Boolean(d?.hasAnyLog || waterGlasses > 0);
      return {
        ...d,
        waterGlasses,
        hasAnyLog
      };
    });
    const result = await generateCoachSuggestionWithGemini({
      ...(req.body || {}),
      userId: req.body?.userId || userId,
      days: enrichedDays
    });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ------------------- SAVED FOODS -------------------
app.get('/api/saved-foods', authenticateUser, (req, res) => {
  const userId = (req as any).userId;
  const foods = getSavedFoods(userId);
  res.json({ foods });
});

app.post('/api/saved-foods', authenticateUser, (req, res) => {
  const userId = (req as any).userId;
  const item = addSavedFood(userId, req.body);
  res.json(item);
});

app.delete('/api/saved-foods/:id', authenticateUser, (req, res) => {
  const userId = (req as any).userId;
  const success = deleteSavedFood(userId, req.params.id);
  if (success) {
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Saved food not found' });
  }
});

// ------------------- RECIPES & PARSING -------------------
app.get('/api/recipes', authenticateUser, (req, res) => {
  const userId = (req as any).userId;
  const recipes = getSavedRecipes(userId);
  res.json({ recipes });
});

app.get('/api/recipes/search', authenticateUser, (req, res) => {
  const userId = (req as any).userId;
  const name = (req.query.name as string) || '';
  const recipe = findSavedRecipeByName(userId, name);
  res.json({ recipe });
});

app.post('/api/recipes', authenticateUser, (req, res) => {
  const userId = (req as any).userId;
  const recipe = saveRecipe(userId, req.body);
  res.json(recipe);
});

app.delete('/api/recipes/:id', authenticateUser, (req, res) => {
  const userId = (req as any).userId;
  const success = deleteSavedRecipe(userId, req.params.id);
  if (success) {
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Recipe not found' });
  }
});

app.post('/api/recipes/parse-line', authenticateUser, async (req, res) => {
  try {
    const { line } = req.body;
    const parsed = parseIngredientLine(line || '');

    if (parsed.needsUsdaLookup && hasUsdaApiKey() && !parsed.isVague) {
      const usda = await searchUsdaFoods(parsed.name);
      if (usda.foods && usda.foods.length > 0) {
        const best = usda.foods[0];
        const factor = parsed.calculatedGrams / 100;
        parsed.calories = Math.round(best.calories * factor);
        parsed.protein = Math.round(best.protein * factor * 10) / 10;
        parsed.fat = Math.round(best.fat * factor * 10) / 10;
        parsed.carbs = Math.round(best.carbs * factor * 10) / 10;
      }
    }

    res.json(parsed);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ------------------- MEAL TEMPLATES -------------------
app.get('/api/meal-templates', authenticateUser, (req, res) => {
  const userId = (req as any).userId;
  const templates = getMealTemplates(userId);
  res.json({ templates });
});

app.post('/api/meal-templates', authenticateUser, (req, res) => {
  const userId = (req as any).userId;
  const { name, date } = req.body;
  if (!name || !date) {
    res.status(400).json({ error: 'Name and date are required' });
    return;
  }
  const tmpl = saveMealTemplate(userId, name.trim(), date);
  res.json(tmpl);
});

app.post('/api/meal-templates/apply', authenticateUser, (req, res) => {
  const userId = (req as any).userId;
  const { templateId, date } = req.body;
  const items = applyMealTemplate(userId, templateId, date);
  res.json({ success: true, count: items.length, items });
});

app.delete('/api/meal-templates/:id', authenticateUser, (req, res) => {
  const userId = (req as any).userId;
  const success = deleteMealTemplate(userId, req.params.id);
  if (success) {
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Template not found' });
  }
});

app.post('/api/meal-templates/restore', authenticateUser, (req, res) => {
  const userId = (req as any).userId;
  const { name, items } = req.body;
  if (!name) {
    res.status(400).json({ error: 'Template name required' });
    return;
  }
  const tmpl = restoreMealTemplate(userId, { name, items: items || [] });
  res.json(tmpl);
});

// ------------------- PLAN GENERATION (GEMINI) -------------------
app.get('/api/plan', authenticateUser, (req, res) => {
  const userId = (req as any).userId;
  const plan = getPlan(userId);
  res.json({ plan });
});

app.post('/api/plan/generate', authenticateUser, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { type, dailyTargetCalories, dailyTargetCarbs, dailyTargetFat, dailyTargetProtein, preferences } = req.body;

    const plan = await generateWeekPlanWithGemini(userId, {
      type: type || 'both',
      dailyTargetCalories: Number(dailyTargetCalories) || 2000,
      dailyTargetCarbs: Number(dailyTargetCarbs) || 200,
      dailyTargetFat: Number(dailyTargetFat) || 67,
      dailyTargetProtein: Number(dailyTargetProtein) || 150,
      preferences: preferences || {
        restrictions: [],
        allergies: [],
        dislikes: '',
        cookTime: 'Any',
        mealsPerDay: 3,
        budget: 'Moderate',
        workoutDaysPerWeek: 3,
        equipment: 'Dumbbells',
        injuries: ''
      }
    });

    savePlan(userId, plan);
    res.json({ success: true, plan });
  } catch (err: any) {
    console.error('Plan generation route error:', err);
    res.status(500).json({ error: err.message || 'Failed to generate plan' });
  }
});

app.post('/api/plan/save', authenticateUser, (req, res) => {
  const userId = (req as any).userId;
  const { plan } = req.body;
  if (!plan) {
    res.status(400).json({ error: 'Plan data required' });
    return;
  }
  savePlan(userId, plan);
  res.json({ success: true, plan });
});

// ------------------- PROFILE & ME -------------------
app.get('/api/profile', authenticateUser, (req, res) => {
  const userId = (req as any).userId;
  const profile = getProfile(userId);
  const stats = getUserStats(userId);
  res.json({ profile, stats });
});

app.put('/api/profile', authenticateUser, (req, res) => {
  const userId = (req as any).userId;
  const profile = updateProfile(userId, req.body);
  res.json(profile);
});

app.post('/api/profile', authenticateUser, (req, res) => {
  const userId = (req as any).userId;
  const profile = updateProfile(userId, req.body);
  res.json(profile);
});

app.patch('/api/profile', authenticateUser, (req, res) => {
  const userId = (req as any).userId;
  const profile = updateProfile(userId, req.body);
  res.json(profile);
});

app.get('/api/stats', authenticateUser, (req, res) => {
  const userId = (req as any).userId;
  const stats = getUserStats(userId);
  res.json(stats);
});

app.get('/api/export', authenticateUser, (req, res) => {
  const userId = (req as any).userId;
  const data = exportUserData(userId);
  res.setHeader('Content-Disposition', 'attachment; filename="caloriq-backup.json"');
  res.setHeader('Content-Type', 'application/json');
  res.json(data);
});

app.post('/api/clear', authenticateUser, (req, res) => {
  const userId = (req as any).userId;
  clearUserData(userId);
  res.json({ success: true, message: 'All user data has been cleared.' });
});

app.post('/api/delete-account', authenticateUser, (req, res) => {
  const userId = (req as any).userId;
  const user = (req as any).user;
  const { password } = req.body || {};
  // #32 Require password re-entry before account deletion for registered accounts
  if (user && !user.isGuest && user.passwordHash) {
    if (!password || !verifyUserPassword(userId, String(password))) {
      res.status(400).json({ error: 'Please enter your current password to confirm account deletion.' });
      return;
    }
  }
  deleteUserAccount(userId);
  res.json({ success: true, message: 'Account deleted.' });
});

// #79 & #80 Restore from backup JSON
app.post('/api/import', authenticateUser, (req, res) => {
  try {
    const userId = (req as any).userId;
    const result = importUserBackupData(userId, req.body);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Could not restore backup.' });
  }
});

// ------------------- COMPLIANCE, ANALYTICS, SUPPORT & SYSTEM (#33-48, #74-77) -------------------
app.post('/api/compliance/cookie-consent', (req, res) => {
  const choice = req.body?.choice === 'accepted' ? 'accepted' : 'declined';
  const rec = logCookieConsent(choice, getClientIp(req), req.headers['user-agent'] || '');
  res.json({ success: true, consentId: rec.id, timestamp: rec.timestamp });
});

app.post('/api/analytics/event', (req, res) => {
  const { event, path: evtPath } = req.body || {};
  recordPrivacyAnalyticsEvent(String(event || ''), String(evtPath || '/'));
  res.json({ ok: true });
});

app.get('/api/admin/analytics', (req, res) => {
  const password = (req.headers['x-admin-password'] as string) || (req.query.password as string);
  if (!timingSafeEqualString(password, process.env.ADMIN_PASSWORD || 'caloriq-admin-2026')) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  res.json({
    summary: getPrivacyAnalyticsSummary(),
    bugReports: getBugReports(),
    contactMessages: getContactMessages(),
    consentLogs: getCookieConsentLogs(),
    maintenance: getMaintenanceStatus()
  });
});

app.post('/api/contact', async (req, res) => {
  const { name, email, subject, message } = req.body || {};
  if (!email || !message) {
    res.status(400).json({ error: 'Email and message are required.' });
    return;
  }
  const saved = saveContactMessage({
    name: String(name || 'Visitor'),
    email: String(email),
    subject: String(subject || 'Caloriq Inquiry'),
    message: String(message)
  });
  const emailed = await sendContactMessageEmail({
    name: saved.name,
    email: saved.email,
    subject: saved.subject,
    message: saved.message
  });
  res.json({ success: true, id: saved.id, emailed });
});

app.post('/api/bug-report', authenticateUser, (req, res) => {
  const userId = (req as any).userId;
  const { whatHappened, whatExpected } = req.body || {};
  if (!whatHappened || !String(whatHappened).trim()) {
    res.status(400).json({ error: 'Please describe what happened.' });
    return;
  }
  const rec = saveBugReport(userId, String(whatHappened), String(whatExpected || ''));
  res.json({ success: true, id: rec.id });
});

// Group B: Weekly AI report emailed every Sunday via Resend
app.post('/api/ai/send-weekly-sunday-report', authenticateUser, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const user = findUserById(userId);
    const profile = getProfile(userId);
    const allEntries = getAllDiaryEntries(userId);
    const allWorkouts = getAllExerciseEntries(userId);

    const last7Dates = new Set<string>();
    for (let i = 0; i < 7; i++) {
      const d = addDaysLocal(new Date(), -i);
      last7Dates.add(d);
    }

    const weekEntries = allEntries.filter((e) => last7Dates.has(e.date));
    const loggedDaysSet = new Set(weekEntries.map((e) => e.date));
    const daysLogged = Math.max(1, loggedDaysSet.size);
    const totalCal = weekEntries.reduce((s, e) => s + (e.calories || 0), 0);
    const totalProt = weekEntries.reduce((s, e) => s + (e.protein || 0), 0);
    const avgCalories = Math.round(totalCal / daysLogged);
    const avgProtein = Math.round(totalProt / daysLogged);
    const targetCalories = Number(req.body?.targetCalories) || 2000;

    const insightRes = await generateWeeklyInsightsWithGemini({
      avgCalories,
      targetCalories,
      avgProtein,
      targetProtein: Math.round((targetCalories * 0.3) / 4),
      avgSleepHours: 7.4,
      workoutCount: allWorkouts.filter((w) => last7Dates.has(w.date)).length,
      waterDaysMet: Math.min(7, daysLogged)
    } as any);
    const insights = Array.isArray(insightRes) ? insightRes : insightRes.bullets || [];

    const recipientEmail = String(req.body?.email || user?.email || '').trim();
    const emailed = await sendWeeklySundayAiReportEmail({
      toEmail: recipientEmail,
      userName: profile?.name || 'Athlete',
      weekSummary: {
        avgCalories,
        targetCalories,
        avgProtein,
        daysLogged: loggedDaysSet.size,
        insights
      }
    });

    res.json({
      success: true,
      emailed,
      recipient: recipientEmail || 'configured Sunday digest address',
      insights
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Could not dispatch Sunday AI report.' });
  }
});

const APP_VERSION = '1.0.0';
const APP_BUILD_ID = '2026.09.28.1';

app.get('/api/version', (_req, res) => {
  res.json({
    version: APP_VERSION,
    buildId: APP_BUILD_ID,
    maintenance: getMaintenanceStatus()
  });
});

app.get('/api/health', async (req, res) => {
  const simulateAlert = req.query.alert === '1';
  if (simulateAlert) {
    await sendUptimeAlertEmail('Simulated uptime alert triggered from health check.');
  }
  res.json({
    status: 'ok',
    uptimeSeconds: Math.round(process.uptime()),
    version: APP_VERSION,
    timestamp: new Date().toISOString()
  });
});

app.post('/api/admin/maintenance', (req, res) => {
  const { password, enabled, message } = req.body || {};
  if (!timingSafeEqualString(password, process.env.ADMIN_PASSWORD || 'caloriq-admin-2026')) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  const state = setMaintenanceStatus(Boolean(enabled), message);
  res.json({ success: true, maintenance: state });
});

// ------------------- USDA FOODDATA CENTRAL SEARCH -------------------
app.get('/api/usda/status', (req, res) => {
  res.json({ available: hasUsdaApiKey() });
});

app.post('/api/usda/search', authenticateUser, async (req, res) => {
  const { query, storeFilter } = req.body;
  if (!query || !query.trim()) {
    res.status(400).json({ error: 'Search query required' });
    return;
  }

  const result = await searchUsdaFoods(query, storeFilter);
  res.json(result);
});

// ------------------- ADMIN SETUP ROUTE -------------------
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'caloriq-admin-2026';

app.post('/api/admin/verify', (req, res) => {
  const { password } = req.body;
  if (!password || !timingSafeEqualString(String(password), ADMIN_PASSWORD)) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  res.json({ valid: true });
});

app.post('/api/admin/save-usda-key', (req, res) => {
  const { password, apiKey } = req.body;
  if (!password || !timingSafeEqualString(String(password), ADMIN_PASSWORD)) {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) {
    res.status(400).json({ error: 'Invalid API key provided' });
    return;
  }

  setUsdaApiKey(apiKey.trim());

  res.json({
    success: true,
    message: 'Saved. You can close this page.'
  });
});

// ------------------- DEV MIDDLEWARE & STATIC SERVING -------------------
async function startServer() {
  try {
    fixDuplicateHouseflyAccounts();
  } catch (err) {
    console.error('Failed to run fixDuplicateHouseflyAccounts on startup:', err);
  }

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      base: '/',
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    // #16 Cache static assets with long expiry headers
    app.use(
      express.static(path.resolve(process.cwd(), 'dist'), {
        maxAge: '365d',
        immutable: true,
        setHeaders(res, filePath) {
          if (filePath.endsWith('.html') || filePath.endsWith('sw.js') || filePath.endsWith('manifest.json')) {
            res.setHeader('Cache-Control', 'no-cache');
          } else {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          }
        }
      })
    );
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(process.cwd(), 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Caloriq server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
