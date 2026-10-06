import React from 'react';
import { ArrowLeft, FileText } from 'lucide-react';
import { LegalFooter } from './LegalFooter.js';

interface TermsOfServicePageProps {
  onBackToLanding: () => void;
  onOpenPrivacy: () => void;
}

export const TermsOfServicePage: React.FC<TermsOfServicePageProps> = ({
  onBackToLanding,
  onOpenPrivacy
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
            <FileText className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Terms of Use</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-100">
            Terms of Service
          </h1>
          <p className="text-xs text-zinc-400 font-mono">Last updated: September 2026</p>
        </div>

        <div className="space-y-6 text-sm text-zinc-300 leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-base font-bold text-zinc-100">1. What ForkCount Is</h2>
            <p>
              ForkCount is a self-guided calorie, macronutrient, hydration, and exercise tracking web application. By accessing or using ForkCount, you agree to these Terms of Service.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-zinc-100">2. Medical Disclaimer (#48)</h2>
            <p>
              <strong>ForkCount is not a medical device and does not provide medical advice, diagnosis, or treatment.</strong> Calorie targets, Mifflin-St Jeor BMR calculations, macro splits, and weekly summaries are general informational estimates. Always consult a qualified physician or registered dietitian before starting any diet, fasting protocol, or exercise program, especially if you are pregnant, nursing, managing a medical condition, or have a history of disordered eating.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-zinc-100">3. AI Nutrition Estimates Disclosure (#49)</h2>
            <p>
              ForkCount includes AI-assisted food and meal estimation powered by Google Gemini and local reference databases. <strong>AI estimates are approximate and not medical or clinical nutritional advice.</strong> Actual calories and macronutrients vary by brand, preparation method, cooking oils, and exact portion weight. You can review and edit every gram and calorie value before saving.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-zinc-100">4. Age Requirements (#50)</h2>
            <p>
              You must be at least <strong>13 years of age</strong> to create an account or use ForkCount. If you are between 13 and 18 years old, you must review these Terms with a parent or guardian and use ForkCount under their supervision.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-zinc-100">5. Account Responsibility &amp; Acceptable Use</h2>
            <p>
              You are responsible for keeping your account credentials secure. You agree not to abuse API endpoints, submit automated scraping requests, or attempt unauthorized access to other users&apos; data.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-zinc-100">6. Limitation of Liability</h2>
            <p>
              ForkCount is provided &quot;as is&quot; and &quot;as available&quot; without warranties of any kind. To the maximum extent permitted by applicable law, ForkCount and its creator shall not be liable for any indirect, incidental, or consequential damages arising from your use of the app or reliance on nutrition estimates.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-zinc-100">7. Contact</h2>
            <p>
              Questions about these Terms can be sent to{' '}
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

        <LegalFooter onOpenPrivacy={onOpenPrivacy} />
      </main>
    </div>
  );
};
