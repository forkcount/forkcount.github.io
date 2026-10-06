import React, { useState, useEffect } from 'react';
import { ArrowLeft, Check, Copy, Download, HelpCircle, Mail, Shield, AlertTriangle, RefreshCw } from 'lucide-react';
import { api } from '../services/api.js';
import { LegalFooter } from './LegalFooter.js';

interface PageNavProps {
  onBack?: () => void;
  onBackToLanding?: () => void;
  onOpenPrivacy?: () => void;
  onOpenTerms?: () => void;
  onOpenCookies?: () => void;
  onOpenContact?: () => void;
  onOpenFaq?: () => void;
  onOpenPress?: () => void;
}

// ============================================================================
// #39 /cookies Page — Explaining what cookies and local storage are used & why
// ============================================================================
export const CookiesPage: React.FC<PageNavProps> = ({
  onBack,
  onOpenPrivacy,
  onOpenTerms,
  onOpenCookies,
  onOpenContact,
  onOpenFaq,
  onOpenPress
}) => {
  const [ccpaOptOut, setCcpaOptOut] = useState<boolean>(() => {
    return typeof window !== 'undefined' && (localStorage.getItem('forkcount_ccpa_do_not_sell') === 'true' || localStorage.getItem('caloriq_ccpa_do_not_sell') === 'true');
  });

  useEffect(() => {
    document.title = 'Cookies & Local Storage — ForkCount';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleToggleCcpa = () => {
    const next = !ccpaOptOut;
    setCcpaOptOut(next);
    localStorage.setItem('forkcount_ccpa_do_not_sell', String(next));
    if (next) {
      localStorage.setItem('forkcount_cookie_consent', 'declined');
      api.logCookieConsent('declined').catch(() => {});
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans">
      <a href="#main-cookies" className="skip-to-content">
        Skip to main content
      </a>
      <div className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
        <div className="mb-8 flex items-center justify-between border-b border-zinc-800 pb-5">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to app"
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2 text-xs font-medium text-zinc-200 hover:border-teal-500/40 hover:text-teal-300"
          >
            <ArrowLeft className="w-4 h-4 text-teal-400" />
            <span>Back</span>
          </button>
          <span className="text-sm font-semibold text-zinc-100">ForkCount</span>
        </div>

        <main id="main-cookies" className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-6 sm:p-10 space-y-8">
          <header className="border-b border-zinc-800 pb-5 space-y-2">
            <h1 className="text-2xl sm:text-3xl font-bold text-zinc-100">
              Cookies &amp; Local Storage Policy
            </h1>
            <p className="text-xs text-zinc-300">
              ForkCount does not use third-party advertising cookies or cross-site tracking cookies.
            </p>
          </header>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-zinc-100">What we store in your browser and why</h2>
            <p className="text-sm text-zinc-300 leading-relaxed">
              Instead of tracking cookies, ForkCount uses your browser&apos;s standard <code className="text-teal-300 font-mono text-xs">localStorage</code> and <code className="text-teal-300 font-mono text-xs">sessionStorage</code> so the app works reliably and offline:
            </p>
            <div className="overflow-x-auto border border-zinc-800 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-950 text-zinc-300 border-b border-zinc-800">
                  <tr>
                    <th className="p-3 font-semibold">Key</th>
                    <th className="p-3 font-semibold">Purpose</th>
                    <th className="p-3 font-semibold">Category</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800 text-zinc-300">
                  <tr>
                    <td className="p-3 font-mono text-teal-300">forkcount_session_token</td>
                    <td className="p-3">Keeps you signed in across page reloads.</td>
                    <td className="p-3">Strictly Necessary</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-mono text-teal-300">forkcount_standalone_db_*</td>
                    <td className="p-3">Caches your diary, water, and exercise entries so the app works offline.</td>
                    <td className="p-3">Strictly Necessary</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-mono text-teal-300">forkcount_locale</td>
                    <td className="p-3">Remembers your chosen language (English, Español, Français, Deutsch).</td>
                    <td className="p-3">Functional</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-mono text-teal-300">forkcount_cookie_consent</td>
                    <td className="p-3">Remembers whether you accepted or declined optional analytics.</td>
                    <td className="p-3">Compliance</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* #37 California CCPA Notice */}
          <section className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-3">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-teal-400" />
              <h2 className="text-sm font-semibold text-zinc-100">
                California Privacy Rights (CCPA) — Do Not Sell My Personal Information
              </h2>
            </div>
            <p className="text-xs text-zinc-300 leading-relaxed">
              ForkCount never sells, rents, or trades your personal data or health records to any third party or data broker. You can also record an explicit CCPA opt-out preference below:
            </p>
            <button
              type="button"
              onClick={handleToggleCcpa}
              aria-label="Toggle Do Not Sell My Data preference"
              className="min-h-[44px] px-4 py-2 rounded-xl bg-teal-500/15 hover:bg-teal-500/25 border border-teal-500/40 text-teal-300 text-xs font-semibold transition-colors"
            >
              {ccpaOptOut
                ? 'Do Not Sell My Data: Active (Confirmed)'
                : 'Do not sell my data — Record preference'}
            </button>
          </section>
        </main>

        <LegalFooter
          onOpenPrivacy={onOpenPrivacy}
          onOpenTerms={onOpenTerms}
          onOpenCookies={onOpenCookies}
          onOpenContact={onOpenContact}
          onOpenFaq={onOpenFaq}
          onOpenPress={onOpenPress}
        />
      </div>
    </div>
  );
};

// ============================================================================
// #45 /faq Page — Answering the 7 required questions
// ============================================================================
const FAQ_ITEMS = [
  {
    q: 'What is ForkCount?',
    a: 'ForkCount is a calorie, macro, water, and exercise tracking application. It calculates your daily energy targets from your own body statistics using the Mifflin-St Jeor formula and lets you log meals via plain-English AI text, barcode scan, saved recipes, or manual entry.'
  },
  {
    q: 'Is it free?',
    a: 'Yes. ForkCount is completely free to use. There is no credit card required, no paywall, and no trial subscription that automatically renews.'
  },
  {
    q: 'Is it medical?',
    a: 'No. ForkCount is a self-guided nutrition and activity tracking tool, not a medical device or healthcare provider. It does not diagnose, treat, or prescribe. Always consult a qualified physician before changing your diet or exercise program.'
  },
  {
    q: 'How do I log food?',
    a: 'Tap the "Add Food" button on your Diary tab. You can type what you ate in plain English (for example, "60g dried prunes, oatmeal 150g, milk 200g"), scan a package barcode, search the USDA food database, build a custom recipe, or enter calories and macros manually.'
  },
  {
    q: 'How do I delete my account?',
    a: 'Open the "Me" tab, scroll to Data & Privacy Management at the bottom, tap "Delete account?", re-enter your current password to confirm, and tap "Yes, delete everything permanently." This immediately wipes your account and all associated data with no backups or shadow copies.'
  },
  {
    q: 'Why do I need to enter my weight?',
    a: 'Your weight, height, age, gender, and activity level are required inputs for the Mifflin-St Jeor equation, which estimates how many calories your body burns at rest (BMR) and during daily activity (TDEE) as well as calories burned during exercise.'
  },
  {
    q: 'Does it sync across devices?',
    a: 'Yes. When you create a free account and sign in with your email or Google account, your diary, water, workouts, recipes, and weight trend sync across your phone, tablet, and computer, while also caching locally so you can log offline.'
  }
];

export const FaqPage: React.FC<PageNavProps> = ({
  onBack,
  onOpenPrivacy,
  onOpenTerms,
  onOpenCookies,
  onOpenContact,
  onOpenFaq,
  onOpenPress
}) => {
  useEffect(() => {
    document.title = 'Frequently Asked Questions — ForkCount';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans">
      <a href="#main-faq" className="skip-to-content">
        Skip to main content
      </a>
      <div className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
        <div className="mb-8 flex items-center justify-between border-b border-zinc-800 pb-5">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to app"
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2 text-xs font-medium text-zinc-200 hover:border-teal-500/40 hover:text-teal-300"
          >
            <ArrowLeft className="w-4 h-4 text-teal-400" />
            <span>Back</span>
          </button>
          <span className="text-sm font-semibold text-zinc-100">ForkCount FAQ</span>
        </div>

        <main id="main-faq" className="space-y-4">
          <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-6 space-y-2">
            <div className="flex items-center gap-2 text-teal-400">
              <HelpCircle className="w-5 h-5" />
              <h1 className="text-2xl font-bold text-zinc-100">Frequently Asked Questions</h1>
            </div>
            <p className="text-xs text-zinc-300">
              Plain-English answers about how ForkCount works, privacy, and account management.
            </p>
          </div>

          <div className="space-y-3">
            {FAQ_ITEMS.map((item) => (
              <section
                key={item.q}
                className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-5 space-y-2"
              >
                <h2 className="text-base font-semibold text-zinc-100">{item.q}</h2>
                <p className="text-sm text-zinc-300 leading-relaxed">{item.a}</p>
              </section>
            ))}
          </div>
        </main>

        <LegalFooter
          onOpenPrivacy={onOpenPrivacy}
          onOpenTerms={onOpenTerms}
          onOpenCookies={onOpenCookies}
          onOpenContact={onOpenContact}
          onOpenFaq={onOpenFaq}
          onOpenPress={onOpenPress}
        />
      </div>
    </div>
  );
};

// ============================================================================
// #46 /contact Page — Form that saves messages to database & emails via Resend
// ============================================================================
export const ContactPage: React.FC<PageNavProps> = ({
  onBack,
  onOpenPrivacy,
  onOpenTerms,
  onOpenCookies,
  onOpenContact,
  onOpenFaq,
  onOpenPress
}) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Contact — ForkCount';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !message.trim()) {
      setError('Please enter your email address and message.');
      return;
    }
    setIsSubmitting(true);
    try {
      await api.submitContactForm({
        name: name.trim() || 'ForkCount User',
        email: email.trim(),
        subject: subject.trim() || 'ForkCount Support Inquiry',
        message: message.trim()
      });
      setSubmitted(true);
      setName('');
      setEmail('');
      setSubject('');
      setMessage('');
    } catch (err: any) {
      setError(err.message || 'Could not send message. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans">
      <a href="#main-contact" className="skip-to-content">
        Skip to main content
      </a>
      <div className="mx-auto max-w-2xl px-5 py-10 sm:px-8 sm:py-14">
        <div className="mb-8 flex items-center justify-between border-b border-zinc-800 pb-5">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to app"
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2 text-xs font-medium text-zinc-200 hover:border-teal-500/40 hover:text-teal-300"
          >
            <ArrowLeft className="w-4 h-4 text-teal-400" />
            <span>Back</span>
          </button>
          <span className="text-sm font-semibold text-zinc-100">Contact ForkCount</span>
        </div>

        <main id="main-contact" className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-6 sm:p-8 space-y-6">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-teal-400">
              <Mail className="w-5 h-5" />
              <h1 className="text-2xl font-bold text-zinc-100">Contact the Developer</h1>
            </div>
            <p className="text-xs text-zinc-300">
              Send a message below. It is saved directly to our database and forwarded via Resend to{' '}
              <a href="mailto:housefly@mail2world.com" className="text-teal-400 underline">
                housefly@mail2world.com
              </a>
              .
            </p>
          </div>

          {submitted ? (
            <div
              role="status"
              aria-live="polite"
              className="p-4 rounded-xl bg-teal-950/50 border border-teal-500/40 text-xs text-teal-200 space-y-3"
            >
              <p className="font-semibold text-sm">Message received.</p>
              <p>Your message has been saved to our database and emailed to the developer.</p>
              <button
                type="button"
                onClick={() => setSubmitted(false)}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-teal-500 text-zinc-950 font-semibold text-xs"
              >
                Send another message
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div role="alert" aria-live="assertive" className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-xs text-rose-200">
                  {error}
                </div>
              )}
              <div>
                <label htmlFor="contact-name" className="block text-xs font-medium text-zinc-300 mb-1">
                  Your Name
                </label>
                <input
                  id="contact-name"
                  type="text"
                  autoFocus
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Alex Rivera"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label htmlFor="contact-email" className="block text-xs font-medium text-zinc-300 mb-1">
                  Email Address
                </label>
                <input
                  id="contact-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label htmlFor="contact-subject" className="block text-xs font-medium text-zinc-300 mb-1">
                  Subject
                </label>
                <input
                  id="contact-subject"
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Question, feedback, or support request"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label htmlFor="contact-message" className="block text-xs font-medium text-zinc-300 mb-1">
                  Message
                </label>
                <textarea
                  id="contact-message"
                  rows={5}
                  required
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="How can we help?"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-sm text-zinc-100 focus:outline-none focus:border-teal-500"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full min-h-[44px] bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-zinc-950 font-semibold py-2.5 rounded-xl text-xs transition-colors"
              >
                {isSubmitting ? 'Sending...' : 'Send Message'}
              </button>
            </form>
          )}
        </main>

        <LegalFooter
          onOpenPrivacy={onOpenPrivacy}
          onOpenTerms={onOpenTerms}
          onOpenCookies={onOpenCookies}
          onOpenContact={onOpenContact}
          onOpenFaq={onOpenFaq}
          onOpenPress={onOpenPress}
        />
      </div>
    </div>
  );
};

// ============================================================================
// #64 /press Page — Logo files, 50/100/200-word descriptions, journalist contact
// ============================================================================
const PRESS_50_WORDS =
  'ForkCount is a free web and mobile calorie, macro, water, and exercise tracker built on transparent physiology math. Users calculate personalized daily targets using the Mifflin-St Jeor formula and log meals in plain English, by barcode, or offline—with zero paywalls, no credit card required, and no tracking cookies.';

const PRESS_100_WORDS =
  'ForkCount is a free, privacy-first calorie and macro tracking application designed for everyday clarity. Instead of hiding core features behind subscriptions, ForkCount gives every user personalized BMR and maintenance calculations using the Mifflin-St Jeor equation, plain-English AI food and workout deciphering, USDA packaged food lookup, barcode scanning, hydration tracking, and weekly progress reports. Built as an installable Progressive Web App, ForkCount works offline for daily food, water, and exercise logging while syncing across devices when online. ForkCount collects no advertising cookies, never sells personal health data, and lets users export or permanently delete their account data in one tap.';

const PRESS_200_WORDS =
  'ForkCount is an independent, full-featured nutrition and activity tracker built to make evidence-based weight management accessible without subscriptions, dark patterns, or data brokers. Most commercial nutrition apps lock macro breakdowns, barcode scanners, or custom recipes behind recurring paywalls while monetizing user health profiles. ForkCount takes the opposite approach: every feature is free from day one, with no credit card and no trial period.\n\nWhen a user joins ForkCount, the app calculates resting energy expenditure (BMR), total daily energy expenditure (TDEE), and macro targets from their own physiology using the clinical Mifflin-St Jeor formula. Logging a meal takes seconds: users can type ingredients in natural language (such as "60g dried prunes, oatmeal 150g, milk 200g"), scan a barcode, search the USDA FoodData Central catalog, or build reusable meal templates. An integrated nutritional analyzer evaluates meal size, protein density, and fiber to offer practical, meal-appropriate suggestions.\n\nEngineered as a fast Progressive Web App with offline-first local storage and Google Firebase synchronization, ForkCount runs on iOS, Android, and desktop browsers. Journalists and reviewers can explore ForkCount immediately using the instant Demo Mode on the landing page or contact the developer directly for interviews and high-resolution assets.';

export const PressPage: React.FC<PageNavProps> = ({
  onBack,
  onOpenPrivacy,
  onOpenTerms,
  onOpenCookies,
  onOpenContact,
  onOpenFaq,
  onOpenPress
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Press Kit — ForkCount';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const copyText = (key: string, text: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans">
      <a href="#main-press" className="skip-to-content">
        Skip to main content
      </a>
      <div className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
        <div className="mb-8 flex items-center justify-between border-b border-zinc-800 pb-5">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to app"
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2 text-xs font-medium text-zinc-200 hover:border-teal-500/40 hover:text-teal-300"
          >
            <ArrowLeft className="w-4 h-4 text-teal-400" />
            <span>Back</span>
          </button>
          <span className="text-sm font-semibold text-zinc-100">ForkCount Press Kit</span>
        </div>

        <main id="main-press" className="space-y-6">
          <section className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-6 space-y-3">
            <h1 className="text-2xl font-bold text-zinc-100">Press &amp; Media Kit</h1>
            <p className="text-sm text-zinc-300 leading-relaxed">
              Official brand assets, boilerplate descriptions, and media contact for journalists covering ForkCount.
            </p>
            <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-300 flex flex-wrap items-center justify-between gap-2">
              <span>
                <strong>Media &amp; Journalist Contact:</strong>{' '}
                <a href="mailto:housefly@mail2world.com" className="text-teal-400 underline">
                  housefly@mail2world.com
                </a>
              </span>
              <span className="font-mono text-zinc-400">Built by one person</span>
            </div>
          </section>

          {/* Logo Files */}
          <section className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-6 space-y-4">
            <h2 className="text-lg font-semibold text-zinc-100">Logo &amp; Visual Assets</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <a
                href="/icon.svg"
                download="forkcount-logo.svg"
                className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-teal-500/40 flex flex-col items-center gap-3 text-xs text-zinc-200 transition-colors"
              >
                <img src="/icon.svg" alt="ForkCount vector logo" width="64" height="64" className="w-16 h-16 rounded-xl" />
                <span className="font-semibold">Vector Logo (SVG)</span>
                <span className="inline-flex items-center gap-1 text-teal-400 text-[11px]">
                  <Download className="w-3.5 h-3.5" /> Download SVG
                </span>
              </a>

              <a
                href="/pwa-512x512.png"
                download="forkcount-icon-512.png"
                className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-teal-500/40 flex flex-col items-center gap-3 text-xs text-zinc-200 transition-colors"
              >
                <img src="/pwa-512x512.png" alt="ForkCount 512x512 app icon" width="64" height="64" className="w-16 h-16 rounded-xl" />
                <span className="font-semibold">App Icon (512x512 PNG)</span>
                <span className="inline-flex items-center gap-1 text-teal-400 text-[11px]">
                  <Download className="w-3.5 h-3.5" /> Download PNG
                </span>
              </a>

              <a
                href="/og-image.png"
                download="forkcount-og-1200x630.png"
                className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-teal-500/40 flex flex-col items-center gap-3 text-xs text-zinc-200 transition-colors"
              >
                <img src="/og-image.png" alt="ForkCount social preview card" width="120" height="63" className="w-28 h-16 object-cover rounded-lg border border-zinc-800" />
                <span className="font-semibold">Share Banner (1200x630)</span>
                <span className="inline-flex items-center gap-1 text-teal-400 text-[11px]">
                  <Download className="w-3.5 h-3.5" /> Download PNG
                </span>
              </a>
            </div>
          </section>

          {/* 50, 100, and 200-word descriptions */}
          {[
            { id: '50', title: '50-Word Description', text: PRESS_50_WORDS },
            { id: '100', title: '100-Word Description', text: PRESS_100_WORDS },
            { id: '200', title: '200-Word Description', text: PRESS_200_WORDS }
          ].map((block) => (
            <section key={block.id} className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-6 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-zinc-100">{block.title}</h2>
                <button
                  type="button"
                  onClick={() => copyText(block.id, block.text)}
                  aria-label={`Copy ${block.title}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-xs text-teal-300"
                >
                  {copiedKey === block.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey === block.id ? 'Copied' : 'Copy text'}</span>
                </button>
              </div>
              <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed whitespace-pre-line">
                {block.text}
              </p>
            </section>
          ))}
        </main>

        <LegalFooter
          onOpenPrivacy={onOpenPrivacy}
          onOpenTerms={onOpenTerms}
          onOpenCookies={onOpenCookies}
          onOpenContact={onOpenContact}
          onOpenFaq={onOpenFaq}
          onOpenPress={onOpenPress}
        />
      </div>
    </div>
  );
};

export const CookiesPolicyPage = CookiesPage;
export const PressKitPage = PressPage;

// ============================================================================
// #72 & #88 Custom 404 Page: "This page doesn't exist. Back to your diary."
// ============================================================================
export const NotFoundPage: React.FC<{
  onBackToDiary?: () => void;
  onGoToDiary?: () => void;
  onGoToLanding?: () => void;
}> = ({ onBackToDiary, onGoToDiary, onGoToLanding }) => {
  useEffect(() => {
    document.title = 'Page Not Found — ForkCount';
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center p-6 text-center">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
        <div className="w-12 h-12 rounded-2xl bg-teal-500/10 border border-teal-500/30 text-teal-400 flex items-center justify-center mx-auto font-mono font-bold text-lg">
          404
        </div>
        <h1 className="text-lg font-bold text-zinc-100">
          This page doesn&apos;t exist. Back to your diary.
        </h1>
        <button
          type="button"
          onClick={() => {
            if (onBackToDiary) onBackToDiary();
            else if (onGoToDiary) onGoToDiary();
            else if (onGoToLanding) onGoToLanding();
          }}
          aria-label="Back to your diary"
          className="w-full min-h-[44px] bg-teal-500 hover:bg-teal-400 text-zinc-950 font-semibold py-2.5 px-4 rounded-xl text-xs transition-colors"
        >
          Back to your diary
        </button>
      </div>
    </div>
  );
};

// ============================================================================
// #71 & #73 Route Error Boundary & Server Error View
// ============================================================================
export class RouteErrorBoundary extends React.Component<
  { children: React.ReactNode; routeName?: string },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode; routeName?: string }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          aria-live="assertive"
          className="p-6 my-4 bg-zinc-900 border border-zinc-800 rounded-2xl text-center space-y-3 max-w-md mx-auto"
        >
          <AlertTriangle className="w-6 h-6 text-amber-400 mx-auto" />
          <p className="text-sm font-semibold text-zinc-100">
            Something&apos;s wrong on our end. Try again in a minute.
          </p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false })}
            className="inline-flex min-h-[44px] items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-500 text-zinc-950 font-semibold text-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry screen</span>
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
