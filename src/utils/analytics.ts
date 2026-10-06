// Section F: Privacy-friendly analytics (Plausible / Umami compatible, zero tracking cookies, zero health data)

export type AllowedAnalyticsEvent =
  | 'pageview'
  | 'signup'
  | 'first_meal_logged'
  | 'first_ai_call'
  | 'first_report_viewed'
  | 'first_week_completed';

const ALLOWED_EVENTS = new Set<AllowedAnalyticsEvent>([
  'pageview',
  'signup',
  'first_meal_logged',
  'first_ai_call',
  'first_report_viewed',
  'first_week_completed'
]);

const FIRST_EVENT_PREFIX = 'forkcount_analytics_once_';
const CONSENT_KEY = 'forkcount_cookie_consent';

export interface AnalyticsSummaryResponse {
  pageviews: number;
  events: Record<AllowedAnalyticsEvent, number>;
  byPath: Record<string, number>;
  recentEvents: Array<{
    event: AllowedAnalyticsEvent;
    path: string;
    timestamp: number;
  }>;
}

export function hasAnalyticsConsent(): boolean {
  if (typeof window === 'undefined') return false;
  const consent = localStorage.getItem(CONSENT_KEY) || localStorage.getItem('caloriq_cookie_consent');
  // If user explicitly declined in cookie banner, do not send analytics
  if (consent === 'declined') return false;
  return true;
}

/**
 * Tracks only privacy-safe, non-health events on the allowlist.
 * Never accepts weight, food, mood, sleep, cravings, reflections, or personal identifiers.
 */
export async function trackPrivacyEvent(
  event: AllowedAnalyticsEvent,
  path: string = typeof window !== 'undefined' ? window.location.pathname : '/',
  oncePerDevice = false
): Promise<void> {
  if (!ALLOWED_EVENTS.has(event)) return;
  if (!hasAnalyticsConsent()) return;

  if (oncePerDevice && typeof window !== 'undefined') {
    const key = `${FIRST_EVENT_PREFIX}${event}`;
    const oldKey = `caloriq_analytics_once_${event}`;
    if (localStorage.getItem(key) === '1' || localStorage.getItem(oldKey) === '1') return;
    localStorage.setItem(key, '1');
  }

  // Privacy-friendly client-only analytics event tracking
  return;
}

export function trackPageview(path?: string): void {
  trackPrivacyEvent('pageview', path || (typeof window !== 'undefined' ? window.location.pathname : '/'), false);
}

export function trackEvent(event: AllowedAnalyticsEvent, path?: string): void {
  trackPrivacyEvent(event, path, false);
}

export function trackEventOnce(event: AllowedAnalyticsEvent, path?: string): void {
  trackPrivacyEvent(event, path, true);
}

export function checkDay7Retention(): void {
  if (typeof window === 'undefined') return;
  const firstSeenKey = 'forkcount_first_seen_at';
  const raw = localStorage.getItem(firstSeenKey) || localStorage.getItem('caloriq_first_seen_at');
  if (!raw) {
    localStorage.setItem(firstSeenKey, String(Date.now()));
    return;
  }
  const firstSeen = Number(raw);
  if (!isNaN(firstSeen) && Date.now() - firstSeen >= 7 * 24 * 60 * 60 * 1000) {
    trackPrivacyEvent('first_week_completed', '/', true);
  }
}

export function isEeaUkChTimezone(): boolean {
  if (typeof Intl === 'undefined') return true;
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  return tz.startsWith('Europe/') || tz.startsWith('Atlantic/Canary') || tz.startsWith('Atlantic/Faroe') || tz === 'UTC';
}
