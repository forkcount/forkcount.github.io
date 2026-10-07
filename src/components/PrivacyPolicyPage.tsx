import React, { useState } from 'react';
import { ArrowLeft, Shield } from 'lucide-react';
import { LegalFooter } from './LegalFooter.js';
import { api } from '../services/api.js';

interface PrivacyPolicyPageProps {
  onBackToLanding: () => void;
  onOpenTerms: () => void;
}

export const PrivacyPolicyPage: React.FC<PrivacyPolicyPageProps> = ({
  onBackToLanding,
  onOpenTerms
}) => {
  const [ccpaOptOut, setCcpaOptOut] = useState<boolean>(() => {
    return (
      typeof window !== 'undefined' &&
      (localStorage.getItem('forkcount_ccpa_do_not_sell') === 'true' ||
        localStorage.getItem('caloriq_ccpa_do_not_sell') === 'true')
    );
  });

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
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-teal-500/20 selection:text-teal-300">
      <a href="#main-content" className="skip-to-content">
        Skip to main content
      </a>
      <header className="sticky top-0 z-40 bg-zinc-950/90 backdrop-blur-md border-b border-zinc-850 px-5 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-teal-400 inline-block" aria-hidden="true" />
            <span className="font-bold text-lg tracking-tight text-zinc-100">ForkCount</span>
          </div>

          <button
            type="button"
            onClick={onBackToLanding}
            aria-label="Back to ForkCount home"
            className="text-xs font-medium text-teal-400 hover:text-teal-300 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            Back to ForkCount
          </button>
        </div>
      </header>

      <main id="main-content" className="max-w-3xl mx-auto px-5 py-10 space-y-8">
        <div className="space-y-2 border-b border-zinc-800 pb-6">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-300 text-[11px] font-medium">
            <Shield className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Legal, Privacy &amp; Cookie Storage Policy (GDPR / CCPA)</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-100">
            Privacy &amp; Cookie Storage Policy
          </h1>
          <p className="text-xs text-zinc-400 font-mono">Last updated: October 2026</p>
        </div>

        <div className="space-y-6 text-sm text-zinc-300 leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-base font-bold text-zinc-100">1. What We Collect</h2>
            <p>
              ForkCount collects only the information needed to calculate your targets and store your logs:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-zinc-300">
              <li>Account email address and encrypted password hash (if you create an account).</li>
              <li>Body metrics you enter: age, sex, height, current weight, goal weight, and activity level.</li>
              <li>Daily food logs, macro totals, water glasses, exercise entries, weight history, and habit notes.</li>
              <li>Temporary text or food photos you submit when using the AI food estimator.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-zinc-100">2. Why We Collect It</h2>
            <p>
              We use this data solely to compute your Basal Metabolic Rate (BMR), Total Daily Energy Expenditure (TDEE), daily calorie and macronutrient targets, and progress charts across your signed-in devices.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-zinc-100">3. Cookies &amp; Local Storage Policy</h2>
            <p>
              ForkCount does not use third-party advertising cookies or cross-site tracking cookies. Instead of tracking cookies, ForkCount uses your browser&apos;s standard <code className="text-teal-300 font-mono text-xs">localStorage</code> and <code className="text-teal-300 font-mono text-xs">sessionStorage</code> so the app works reliably and offline:
            </p>
            <div className="overflow-x-auto border border-zinc-800 rounded-xl my-3">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-900/90 text-zinc-300 border-b border-zinc-800">
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
                    <td className="p-3">Remembers your chosen language.</td>
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

            <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-2.5">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-teal-400" />
                <h3 className="text-xs font-semibold text-zinc-100">
                  California Privacy Rights (CCPA) — Do Not Sell My Personal Information
                </h3>
              </div>
              <p className="text-xs text-zinc-300 leading-relaxed">
                ForkCount never sells, rents, or trades your personal data or health records to any third party or data broker. You can record an explicit CCPA opt-out preference below:
              </p>
              <button
                type="button"
                onClick={handleToggleCcpa}
                aria-label="Toggle Do Not Sell My Data preference"
                className="min-h-[38px] px-3.5 py-1.5 rounded-lg bg-teal-500/15 hover:bg-teal-500/25 border border-teal-500/40 text-teal-300 text-xs font-semibold transition-colors cursor-pointer"
              >
                {ccpaOptOut
                  ? 'Do Not Sell My Data: Active (Confirmed)'
                  : 'Do not sell my data — Record preference'}
              </button>
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-zinc-100">4. How Long We Keep It (Data Retention)</h2>
            <p>
              Signed-in account data is kept for as long as your account remains active. Inactive accounts with no sign-in activity for 24 consecutive months are scheduled for automatic deletion after a 30-day email notice. Guest mode local storage expires after 24 hours.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-zinc-100">5. Your GDPR &amp; CCPA Rights (Export &amp; Deletion)</h2>
            <p>
              Under the General Data Protection Regulation (GDPR) and the California Consumer Privacy Act (CCPA), you have the right to access, port, rectify, and erase your personal data:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-zinc-300">
              <li>
                <strong>Export Your Data (Right to Portability):</strong> Open the <strong>Me</strong> tab and click <strong>Export JSON</strong> to download a complete, machine-readable copy of your profile, food diary, exercises, water logs, weights, habits, cravings, and saved meals.
              </li>
              <li>
                <strong>Delete Your Account &amp; Data (Right to Erasure):</strong> Open the <strong>Me</strong> tab, scroll to Account &amp; Data, and select <strong>Delete Account</strong>. Confirming deletion permanently removes your profile, food logs, weight history, and account credentials from our database immediately.
              </li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-zinc-100">6. No Sale of Personal or Health Data (CCPA)</h2>
            <p>
              ForkCount does <strong>not</strong> sell, rent, or share your personal information or health data with third-party advertisers or data brokers. We use privacy-friendly, cookieless event counts (such as aggregate pageviews and signup counts) that never include personal or health data.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-zinc-100">7. Age Requirement</h2>
            <p>
              ForkCount is not intended for children under 13. Users between 13 and 17 years of age should use ForkCount only with the involvement of a parent or legal guardian. We do not knowingly collect personal data from children under 13.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-zinc-100">8. Contact for Privacy Requests</h2>
            <p>
              For any privacy questions, GDPR/CCPA requests, or data inquiries, email{' '}
              <a
                href="mailto:housefly@mail2world.com"
                className="text-teal-400 hover:text-teal-300 underline underline-offset-4"
              >
                housefly@mail2world.com
              </a>
              .
            </p>
          </section>
        </div>

        <LegalFooter onOpenTerms={onOpenTerms} />
      </main>
    </div>
  );
};
