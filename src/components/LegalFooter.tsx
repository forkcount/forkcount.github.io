import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { SecretFooter } from './SecretFooter.js';

interface LegalFooterProps {
  onOpenPrivacy?: () => void;
  onOpenTerms?: () => void;
  onOpenCookies?: () => void;
  onOpenFaq?: () => void;
  onOpenContact?: () => void;
}

export const LegalFooter: React.FC<LegalFooterProps> = ({
  onOpenPrivacy,
  onOpenTerms,
  onOpenCookies,
  onOpenFaq,
  onOpenContact
}) => {
  const handleNav = (e: React.MouseEvent<HTMLAnchorElement>, path: string, cb?: () => void) => {
    if (cb) {
      e.preventDefault();
      cb();
      return;
    }
    e.preventDefault();
    window.history.pushState({}, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="mt-12 mb-20 px-6 py-6 border-t border-zinc-800/80 text-center text-xs text-zinc-300 space-y-2.5 max-w-lg mx-auto no-print">
      <div className="flex items-center justify-center gap-1.5 text-zinc-300">
        <ShieldCheck className="w-3.5 h-3.5 text-teal-500/80" aria-hidden="true" />
        <span className="font-medium tracking-wide">Self-guided nutrition &amp; activity tracking tools</span>
      </div>
      <p className="leading-relaxed">
        ForkCount provides weight-management tracking tools and is not a medical provider. Speak to your doctor before changing how you eat or train.
      </p>
      <p className="text-zinc-300 leading-relaxed">
        If you&apos;re under 18, use ForkCount with a parent or guardian. Not intended for children under 13.
      </p>
      <p className="text-zinc-400 leading-relaxed">
        ForkCount uses local storage to keep you signed in and remember your theme. It does not use tracking cookies. See our{' '}
        <a
          href="/privacy"
          onClick={(e) => handleNav(e, '/privacy', onOpenPrivacy)}
          className="text-teal-400 hover:text-teal-300 underline underline-offset-4 transition-colors"
        >
          Privacy Policy
        </a>
        .
      </p>
      <div className="pt-1 flex flex-wrap items-center justify-center gap-2 text-zinc-400">
        <a
          href="/privacy"
          onClick={(e) => handleNav(e, '/privacy', onOpenPrivacy)}
          className="text-teal-400 hover:text-teal-300 underline underline-offset-4 transition-colors"
        >
          Privacy
        </a>
        <span aria-hidden="true">·</span>
        <a
          href="/terms"
          onClick={(e) => handleNav(e, '/terms', onOpenTerms)}
          className="text-teal-400 hover:text-teal-300 underline underline-offset-4 transition-colors"
        >
          Terms
        </a>
        <span aria-hidden="true">·</span>
        <a
          href="/faq"
          onClick={(e) => handleNav(e, '/faq', onOpenFaq)}
          className="text-teal-400 hover:text-teal-300 underline underline-offset-4 transition-colors"
        >
          FAQ
        </a>
        <span aria-hidden="true">·</span>
        <a
          href="/contact"
          onClick={(e) => handleNav(e, '/contact', onOpenContact)}
          className="text-teal-400 hover:text-teal-300 underline underline-offset-4 transition-colors"
        >
          Contact
        </a>
      </div>
      <SecretFooter className="pt-1 text-[11px] font-mono text-zinc-400" />
    </footer>
  );
};
