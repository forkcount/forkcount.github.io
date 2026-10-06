import { useState, useEffect } from 'react';
import { isCommonPassword } from './commonPasswords.js';

/**
 * Constant-time string comparison function.
 * Uses crypto.timingSafeEqual() in Node.js or constant-time bitwise loop in browser.
 */
export function timingSafeEqualString(a: string | undefined | null, b: string | undefined | null): boolean {
  if (a === undefined || a === null || b === undefined || b === null) {
    return false;
  }
  const strA = String(a);
  const strB = String(b);

  if (typeof window === 'undefined') {
    try {
      const cryptoMod = require('crypto');
      if (cryptoMod && cryptoMod.timingSafeEqual && cryptoMod.createHash) {
        const bufA = cryptoMod.createHash('sha256').update(strA).digest();
        const bufB = cryptoMod.createHash('sha256').update(strB).digest();
        const match = cryptoMod.timingSafeEqual(bufA, bufB);
        return match && strA.length === strB.length;
      }
    } catch {
      // Fallback
    }
  }

  let mismatch = strA.length === strB.length ? 0 : 1;
  const maxLen = Math.max(strA.length, strB.length);
  for (let i = 0; i < maxLen; i++) {
    const codeA = i < strA.length ? strA.charCodeAt(i) : 0;
    const codeB = i < strB.length ? strB.charCodeAt(i) : 0;
    mismatch |= codeA ^ codeB;
  }
  return mismatch === 0;
}

/**
 * Safely validates redirect targets against Open Redirect vulnerabilities.
 * Allows ONLY relative internal paths starting with a single '/' (and not '//' or '/\').
 * If the target is invalid, external, or malicious, returns defaultRoute.
 */
export function getSafeRedirectUrl(target: string | null | undefined, defaultRoute: string = '/dashboard'): string {
  if (!target || typeof target !== 'string') {
    return defaultRoute;
  }
  const trimmed = target.trim();

  // Rule 1: Must start with a single '/'
  // Rule 2: Must NOT start with '//' or '/\'
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.startsWith('/\\')) {
    return defaultRoute;
  }

  try {
    const dummyOrigin = 'https://caloriq.internal';
    const parsed = new URL(trimmed, dummyOrigin);
    if (parsed.origin !== dummyOrigin) {
      return defaultRoute;
    }
    const safePath = parsed.pathname + parsed.search + parsed.hash;
    if (!safePath.startsWith('/') || safePath.startsWith('//') || safePath.startsWith('/\\')) {
      return defaultRoute;
    }
    return safePath;
  } catch {
    return defaultRoute;
  }
}

/**
 * #15 Debounce hook — waits `delay` ms (default 400ms) after value stops changing
 */
export function useDebounce<T>(value: T, delay = 400): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

/**
 * #1 Email field — must contain "@" and a "." after the "@".
 * If not: "That doesn't look like an email address."
 */
export function validateEmail(email: string): string | null {
  const trimmed = email.trim();
  if (!trimmed) return "That doesn't look like an email address.";
  const atIndex = trimmed.indexOf('@');
  if (atIndex <= 0) return "That doesn't look like an email address.";
  const afterAt = trimmed.slice(atIndex + 1);
  const dotIndex = afterAt.indexOf('.');
  if (dotIndex <= 0 || dotIndex === afterAt.length - 1) {
    return "That doesn't look like an email address.";
  }
  return null;
}

/**
 * Username field — 3–20 characters, letters, numbers, underscore only.
 */
export function validateUsername(username: string): string | null {
  const trimmed = username.trim();
  if (trimmed.length < 3 || trimmed.length > 20) {
    return 'Username must be between 3 and 20 characters.';
  }
  if (!/^[A-Za-z0-9_]+$/.test(trimmed)) {
    return 'Username can only contain letters, numbers, and underscores.';
  }
  return null;
}

/**
 * #2 Age field — must be between 13 and 120.
 * If outside: "Enter an age between 13 and 120."
 */
export function validateAge(age: number | string): string | null {
  const num = typeof age === 'string' ? Number(age) : age;
  if (!Number.isFinite(num) || num < 13 || num > 120) {
    return 'Enter an age between 13 and 120.';
  }
  return null;
}

/**
 * #3 Height field — cm must be between 50 and 250.
 * Feet/inches must be between 1'8" and 8'2" (20 to 98 total inches).
 * Outside: "That height doesn't look right."
 */
export function validateHeightCm(cm: number | string): string | null {
  const num = typeof cm === 'string' ? Number(cm) : cm;
  if (!Number.isFinite(num) || num < 50 || num > 250) {
    return "That height doesn't look right.";
  }
  return null;
}

export function validateHeightImperial(feet: number | string, inches: number | string = 0): string | null {
  const ft = typeof feet === 'string' ? Number(feet) : feet;
  const inc = typeof inches === 'string' ? Number(inches) : inches;
  if (!Number.isFinite(ft) || !Number.isFinite(inc) || inc < 0 || inc >= 12) {
    return "That height doesn't look right.";
  }
  const totalInches = ft * 12 + inc;
  // 1'8" = 20 inches, 8'2" = 98 inches
  if (totalInches < 20 || totalInches > 98) {
    return "That height doesn't look right.";
  }
  return null;
}

/**
 * #4 Weight field — kg must be between 20 and 500. lb must be between 44 and 1,100.
 * Outside: "Enter a weight between 20 and 500 kg."
 */
export function validateWeight(value: number | string, unit: 'metric' | 'imperial' = 'metric'): string | null {
  const num = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(num)) {
    return 'Enter a weight between 20 and 500 kg.';
  }
  if (unit === 'imperial') {
    if (num < 44 || num > 1100) {
      return 'Enter a weight between 20 and 500 kg.';
    }
  } else {
    if (num < 20 || num > 500) {
      return 'Enter a weight between 20 and 500 kg.';
    }
  }
  return null;
}

/**
 * #5 Body fat % field — must be between 3 and 60.
 * Outside: "Enter a body fat percentage between 3 and 60."
 */
export function validateBodyFat(bf: number | string | undefined | null): string | null {
  if (bf === undefined || bf === null || bf === '') return null;
  const num = typeof bf === 'string' ? Number(bf) : bf;
  if (!Number.isFinite(num) || num < 3 || num > 60) {
    return 'Enter a body fat percentage between 3 and 60.';
  }
  return null;
}

/**
 * #6 Water glasses — cap at 20 per day.
 * Above that: "That's more than 20 glasses. Are you sure?"
 */
export function validateWaterGlasses(glasses: number): string | null {
  if (glasses > 20) {
    return "That's more than 20 glasses. Are you sure?";
  }
  return null;
}

/**
 * #7 Exercise minutes — cap at 600 per session.
 * Above that: "That's over 10 hours. Check the number."
 */
export function validateExerciseMinutes(minutes: number | string): string | null {
  const num = typeof minutes === 'string' ? Number(minutes) : minutes;
  if (!Number.isFinite(num) || num <= 0) {
    return 'Enter valid exercise minutes.';
  }
  if (num > 600) {
    return "That's over 10 hours. Check the number.";
  }
  return null;
}

/**
 * #8 Single food item — cap at 5,000 kcal per item.
 * Above: "This item is over 5,000 kcal. Check the quantity."
 */
export function validateSingleFoodCalories(calories: number | string): string | null {
  const num = typeof calories === 'string' ? Number(calories) : calories;
  if (Number.isFinite(num) && num > 5000) {
    return 'This item is over 5,000 kcal. Check the quantity.';
  }
  return null;
}

/**
 * #9 Single food weight — cap at 5 kg per item.
 * Above: "That's over 5 kg of one item. Did you mean grams?"
 */
export function parseFoodWeightGrams(servingText: string): number | null {
  if (!servingText) return null;
  const text = servingText.toLowerCase().trim();
  const kgMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:kg|kilogram|kilograms)\b/);
  if (kgMatch) {
    return parseFloat(kgMatch[1]) * 1000;
  }
  const gMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:g|gram|grams)\b/);
  if (gMatch) {
    return parseFloat(gMatch[1]);
  }
  const lbMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:lb|lbs|pound|pounds)\b/);
  if (lbMatch) {
    return parseFloat(lbMatch[1]) * 453.592;
  }
  return null;
}

export function validateSingleFoodWeight(servingOrGrams: string | number): string | null {
  const grams =
    typeof servingOrGrams === 'number'
      ? servingOrGrams
      : parseFoodWeightGrams(servingOrGrams);
  if (grams !== null && Number.isFinite(grams) && grams > 5000) {
    return "That's over 5 kg of one item. Did you mean grams?";
  }
  return null;
}

export function validateSingleFoodWeightGrams(grams: number): string | null {
  return validateSingleFoodWeight(grams);
}

export function validateSingleFoodWeightText(servingText: string): string | null {
  return validateSingleFoodWeight(servingText);
}

/**
 * #10 Daily total — if over 10,000 kcal, show a warning banner at the top of the Diary:
 * "Today's total is unusual. Tap to review."
 */
export function isDailyTotalUnusual(totalCalories: number): boolean {
  return Number.isFinite(totalCalories) && totalCalories > 10000;
}

/**
 * #11 Duplicate food — if the user logs the exact same food name and calories within 5 minutes,
 * show: "You just logged this. Add another?"
 */
export function findRecentDuplicateFood<T extends { name: string; calories: number; createdAt?: number }>(
  items: T[],
  name: string,
  calories: number,
  windowMs = 5 * 60 * 1000
): T | null {
  const cleanName = name.trim().toLowerCase();
  const roundedCal = Math.round(Number(calories) || 0);
  const now = Date.now();
  for (const item of items) {
    if (
      item.name.trim().toLowerCase() === cleanName &&
      Math.round(item.calories) === roundedCal &&
      item.createdAt &&
      now - item.createdAt <= windowMs
    ) {
      return item;
    }
  }
  return null;
}

/**
 * #12 Date fields — no dates in the future for weight log or diary.
 * No dates more than 5 years in the past.
 */
export function getDateBounds(): { minDate: string; maxDate: string } {
  const now = new Date();
  const maxDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const minObj = new Date(now.getFullYear() - 5, now.getMonth(), now.getDate());
  const minDate = `${minObj.getFullYear()}-${String(minObj.getMonth() + 1).padStart(2, '0')}-${String(minObj.getDate()).padStart(2, '0')}`;
  return { minDate, maxDate };
}

export function validateDateRange(dateStr: string): string | null {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return 'Enter a valid date.';
  }
  const { minDate, maxDate } = getDateBounds();
  if (dateStr > maxDate) {
    return 'Dates in the future are not allowed.';
  }
  if (dateStr < minDate) {
    return 'Dates more than 5 years in the past are not allowed.';
  }
  return null;
}

/**
 * #22 & 5.E Password rules & strength meter:
 * - Minimum 8 characters
 * - At least one number or symbol
 * - Reject the 1,000 most common passwords
 * - No password can match the email
 * - Show strength meter: Weak / Fair / Strong. Require "Fair" minimum.
 */
export type PasswordStrength = 'Weak' | 'Fair' | 'Strong';

export function validatePasswordRules(password: string, email?: string): string | null {
  if (!password || password.length < 8) {
    return 'Password must be at least 8 characters.';
  }
  if (!/[0-9]|[^A-Za-z0-9]/.test(password)) {
    return 'Password must contain at least one number or symbol.';
  }
  if (email && timingSafeEqualString(password.trim().toLowerCase(), email.trim().toLowerCase())) {
    return 'Password cannot match your email address.';
  }
  if (isCommonPassword(password)) {
    return 'This password is in the list of most common passwords. Choose a more unique password.';
  }
  return null;
}

export function getPasswordStrength(password: string, email?: string): {
  strength: PasswordStrength;
  score: number; // 1 = Weak, 2 = Fair, 3 = Strong
  error: string | null;
} {
  const ruleError = validatePasswordRules(password, email);
  if (ruleError) {
    return { strength: 'Weak', score: 1, error: ruleError };
  }

  let points = 0;
  if (password.length >= 8) points += 1;
  if (password.length >= 11) points += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) points += 1;
  if (/\d/.test(password)) points += 1;
  if (/[^A-Za-z0-9]/.test(password)) points += 1;

  if (points >= 4 && password.length >= 10) {
    return { strength: 'Strong', score: 3, error: null };
  }
  return { strength: 'Fair', score: 2, error: null };
}

export interface DeviceFingerprintPayload {
  userAgent: string;
  screenSize: string;
  timezone: string;
  language: string;
  platform: string;
  fingerprintHash: string;
}

function simpleClientHash(input: string): string {
  let h1 = 0xdeadbeef ^ input.length;
  let h2 = 0x41c6ce57 ^ input.length;
  for (let i = 0, ch; i < input.length; i++) {
    ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0');
}

export function getClientDeviceFingerprint(): DeviceFingerprintPayload {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      userAgent: 'Server',
      screenSize: '0x0',
      timezone: 'UTC',
      language: 'en',
      platform: 'Unknown',
      fingerprintHash: '0000000000000000'
    };
  }
  const userAgent = navigator.userAgent || '';
  const screenSize = window.screen ? `${window.screen.width}x${window.screen.height}` : '0x0';
  let timezone = 'UTC';
  try {
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    timezone = 'UTC';
  }
  const language = navigator.language || 'en';
  const platform = navigator.platform || 'Web';
  const raw = `${userAgent}|${screenSize}|${timezone}|${language}|${platform}`;
  return {
    userAgent,
    screenSize,
    timezone,
    language,
    platform,
    fingerprintHash: simpleClientHash(raw)
  };
}

export function getDeviceMetadata() {
  const fp = getClientDeviceFingerprint();
  return {
    ...fp,
    rawFingerprint: `${fp.userAgent}|${fp.screenSize}|${fp.timezone}|${fp.language}|${fp.platform}`,
    deviceName: fp.platform || 'Web Browser'
  };
}


