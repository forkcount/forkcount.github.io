import React from 'react';
import { ArrowLeft, Shield } from 'lucide-react';
import { LegalFooter } from './LegalFooter.js';

interface PrivacyPolicyPageProps {
  onBackToLanding: () => void;
  onOpenTerms: () => void;
}

export const PrivacyPolicyPage: React.FC<PrivacyPolicyPageProps> = ({
  onBackToLanding,
  onOpenTerms
}) => {
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
            <span>Legal &amp; Data Protection (GDPR / CCPA)</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-100">
            Privacy Policy
          </h1>
          <p className="text-xs text-zinc-400 font-mono">Last updated: September 2026</p>
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

          <section className="space-y-2">
            <h2 className="text-base font-bold text-zinc-100">3. Cookies &amp; Local Storage Policy</h2>
            <p>
              ForkCount does not use third-party advertising cookies or cross-site tracking cookies. Instead of tracking cookies, ForkCount uses your browser&apos;s standard <code className="text-teal-300 font-mono text-xs">localStorage</code> and <code className="text-teal-300 font-mono text-xs">sessionStorage</code> so the app works reliably and offline:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-zinc-300">
              <li><strong>forkcount_session_token</strong>: Keeps you signed in across page reloads (Strictly Necessary).</li>
              <li><strong>forkcount_standalone_db_*</strong>: Caches your diary, water, and exercise entries so the app works offline (Strictly Necessary).</li>
              <li><strong>forkcount_locale</strong>: Remembers your chosen language (Functional).</li>
              <li><strong>forkcount_cookie_consent</strong>: Remembers whether you accepted or declined optional analytics (Compliance).</li>
            </ul>
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
              ForkCount is not intended for children under 13 (#50). Users between 13 and 17 years of age should use ForkCount only with the involvement of a parent or legal guardian. We do not knowingly collect personal data from children under 13.
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
