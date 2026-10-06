import React, { useState, useEffect, Suspense } from 'react';
import { Lock, Shield, Eye, EyeOff, RefreshCw } from 'lucide-react';
import { AppProvider, useApp } from './context/AppContext.js';
import { DevBanner } from './components/DevBanner.js';
import { Navigation, TabType } from './components/Navigation.js';
import { DiaryTab } from './components/DiaryTab.js';
import { AuthModal } from './components/AuthModal.js';
import { OnboardingModal } from './components/OnboardingModal.js';
import { WeeklyRecapModal } from './components/WeeklyRecapModal.js';
import { LegalFooter } from './components/LegalFooter.js';
import { DesktopScrollbar } from './components/DesktopScrollbar.js';
import { ErrorBoundary } from './components/ErrorBoundary.js';
import {
  RouteErrorBoundary,
  CookiesPolicyPage,
  FaqPage,
  ContactPage,
  PressKitPage,
  NotFoundPage
} from './components/PublicInfoPages.js';
import {
  GuestLockSheet,
  GuestExpiredOverlay,
  FirstRunTooltips,
  KeyboardShortcutsModal,
  MilestoneConfettiModal
} from './components/GuestModals.js';
import { FitnessTab } from './components/FitnessTab.js';
import { CommunityTab } from './components/CommunityTab.js';
import { PlanTab } from './components/PlanTab.js';
import { ReportsTab } from './components/ReportsTab.js';
import { MeTab } from './components/MeTab.js';
import { AddFoodModal } from './components/AddFoodModal.js';
import { DescriptionPage } from './components/DescriptionPage.js';
import { PrivacyPolicyPage } from './components/PrivacyPolicyPage.js';
import { TermsOfServicePage } from './components/TermsOfServicePage.js';
import { api } from './services/api.js';
import { trackPageview } from './utils/analytics.js';
import { getSafeRedirectUrl } from './utils/validation.js';

// #17 Skeleton loader for lazy routes
const RouteSkeleton: React.FC = () => (
  <div className="space-y-4 py-4 max-w-md mx-auto w-full animate-pulse" aria-label="Loading section">
    <div className="h-14 bg-zinc-900 border border-zinc-800 rounded-2xl" />
    <div className="h-44 bg-zinc-900 border border-zinc-800 rounded-2xl" />
    <div className="h-32 bg-zinc-900 border border-zinc-800 rounded-2xl" />
  </div>
);

interface MainAppContentProps {
  onOpenDescription: () => void;
  onOpenPrivacy: () => void;
  onOpenTerms: () => void;
  onOpenCookies: () => void;
  onOpenFaq: () => void;
  onOpenContact: () => void;
  onOpenPress: () => void;
  initialTab?: TabType;
  autoOpenAuth?: boolean;
  onAutoOpenAuthHandled?: () => void;
}

const MainAppContent: React.FC<MainAppContentProps> = ({
  onOpenDescription,
  onOpenPrivacy,
  onOpenTerms,
  onOpenCookies,
  onOpenFaq,
  onOpenContact,
  onOpenPress,
  initialTab = 'diary',
  autoOpenAuth = false,
  onAutoOpenAuthHandled
}) => {
  const [currentTab, setCurrentTab] = useState<TabType>(initialTab);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const {
    isAddFoodOpen,
    openAddFood,
    closeAddFood,
    selectedMealForAdd,
    isLoading,
    openAuthModal,
    undoToast,
    dismissUndoToast,
    isOnline,
    offlineQueueCount,
    hasSyncConflict,
    resolveSyncConflict,
    isSessionExpiryWarningOpen,
    sessionExpiryRemainingSec,
    staySignedIn,
    lastSelectedMeal,
    waterGlasses,
    updateWaterGlasses,
    isGuest,
    openGuestLock,
    saveStatus
  } = useApp();

  useEffect(() => {
    setCurrentTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    trackPageview(`/dashboard/${currentTab}`);
  }, [currentTab]);

  useEffect(() => {
    if (autoOpenAuth) {
      openAuthModal('login');
      if (onAutoOpenAuthHandled) {
        onAutoOpenAuthHandled();
      }
    }
  }, [autoOpenAuth, openAuthModal, onAutoOpenAuthHandled]);

  // #9 Keyboard shortcuts (desktop): N = Add Food, W = log water, E = exercise log, ? = shortcuts list
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const key = e.key.toLowerCase();
      if (key === 'n') {
        e.preventDefault();
        openAddFood();
      } else if (key === 'w') {
        e.preventDefault();
        updateWaterGlasses(Math.min(20, waterGlasses + 1));
      } else if (key === 'e') {
        e.preventDefault();
        if (isGuest) {
          openGuestLock();
        } else {
          setCurrentTab('fitness');
        }
      } else if (e.key === '?') {
        e.preventDefault();
        setIsShortcutsOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [openAddFood, updateWaterGlasses, waterGlasses, isGuest, openGuestLock]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans">
        <div className="h-14 bg-zinc-900/80 border-b border-zinc-850 px-4 flex items-center justify-between">
          <div className="w-24 h-5 rounded-lg bg-zinc-800 animate-pulse" />
          <div className="w-32 h-7 rounded-xl bg-zinc-800 animate-pulse" />
          <div className="w-16 h-7 rounded-lg bg-zinc-800 animate-pulse" />
        </div>
        <div className="flex-1 px-4 pt-4 pb-20 max-w-md mx-auto w-full space-y-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="w-28 h-4 rounded bg-zinc-800 animate-pulse" />
              <div className="w-16 h-4 rounded bg-zinc-800 animate-pulse" />
            </div>
            <div className="flex items-center justify-around py-3">
              <div className="w-16 h-10 rounded-lg bg-zinc-800 animate-pulse" />
              <div className="w-28 h-28 rounded-full bg-zinc-800 animate-pulse" />
              <div className="w-16 h-10 rounded-lg bg-zinc-800 animate-pulse" />
            </div>
            <div className="grid grid-cols-3 gap-3 pt-2">
              <div className="h-8 rounded-lg bg-zinc-800 animate-pulse" />
              <div className="h-8 rounded-lg bg-zinc-800 animate-pulse" />
              <div className="h-8 rounded-lg bg-zinc-800 animate-pulse" />
            </div>
          </div>
          {[1, 2, 3, 4].map((idx) => (
            <div key={idx} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-24 h-4 rounded bg-zinc-800 animate-pulse" />
                <div className="w-14 h-4 rounded bg-zinc-800 animate-pulse" />
              </div>
              <div className="w-full h-10 rounded-xl bg-zinc-800/70 animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-teal-500/20 selection:text-teal-300">
      {/* #5 Skip to content link at the top of every page */}
      <a href="#main-content" className="skip-to-content">
        Skip to main content
      </a>

      {/* #10 Screen reader live region for save status & undo notices */}
      <div role="status" aria-live="polite" className="sr-only">
        {saveStatus === 'error'
          ? 'Save failed. Changes will retry automatically.'
          : undoToast
            ? undoToast.label
            : ''}
      </div>

      {/* #29 Persistent thin network status banner when offline */}
      {!isOnline && (
        <div
          role="status"
          aria-live="polite"
          className="bg-amber-950/90 border-b border-amber-800/70 text-amber-200 text-[11px] font-mono py-1.5 px-4 text-center sticky top-0 z-50 no-print"
        >
          Offline — changes will sync when you&apos;re back online.
        </div>
      )}
      <DevBanner />
      <div className="no-print">
        <Navigation
          currentTab={currentTab}
          onTabChange={setCurrentTab}
          onOpenDescription={onOpenDescription}
        />
      </div>

      {/* #20 Sync conflict banner */}
      {hasSyncConflict && (
        <div className="max-w-md mx-auto w-full px-4 pt-2 no-print">
          <div className="px-3 py-2 rounded-xl bg-teal-950/60 border border-teal-700/60 text-xs text-teal-200 flex items-center justify-between gap-2">
            <span>This day was changed on another device. Refresh to see the latest.</span>
            <button
              type="button"
              onClick={resolveSyncConflict}
              className="px-2.5 py-1 bg-teal-500 hover:bg-teal-400 text-zinc-950 font-bold text-[11px] rounded-lg shrink-0 transition-colors"
            >
              Refresh
            </button>
          </div>
        </div>
      )}

      {isOnline && offlineQueueCount > 0 && (
        <div className="max-w-md mx-auto w-full px-4 pt-2 no-print">
          <div className="px-3 py-1.5 rounded-xl bg-amber-950/40 border border-amber-800/50 text-[11px] text-amber-300 flex items-center justify-between font-mono">
            <span>{`Syncing ${offlineQueueCount} offline entry(s)...`}</span>
          </div>
        </div>
      )}

      <main id="main-content" className="flex-1 px-4 pt-4 pb-20 max-w-md mx-auto w-full">
        {currentTab === 'diary' && (
          <RouteErrorBoundary routeName="Diary">
            <DiaryTab
              onNavigateToFitness={() => {
                if (isGuest) {
                  openGuestLock();
                } else {
                  setCurrentTab('fitness');
                }
              }}
            />
          </RouteErrorBoundary>
        )}
        {currentTab === 'fitness' && (
          <RouteErrorBoundary routeName="Fitness">
            <Suspense fallback={<RouteSkeleton />}>
              <FitnessTab />
            </Suspense>
          </RouteErrorBoundary>
        )}
        {currentTab === 'community' && (
          <RouteErrorBoundary routeName="Community">
            <Suspense fallback={<RouteSkeleton />}>
              <CommunityTab />
            </Suspense>
          </RouteErrorBoundary>
        )}
        {currentTab === 'plan' && (
          <RouteErrorBoundary routeName="Plan">
            <Suspense fallback={<RouteSkeleton />}>
              <PlanTab />
            </Suspense>
          </RouteErrorBoundary>
        )}
        {currentTab === 'reports' && (
          <RouteErrorBoundary routeName="Reports">
            <Suspense fallback={<RouteSkeleton />}>
              <ReportsTab />
            </Suspense>
          </RouteErrorBoundary>
        )}
        {currentTab === 'me' && (
          <RouteErrorBoundary routeName="Me">
            <Suspense fallback={<RouteSkeleton />}>
              <MeTab
                onOpenDescription={onOpenDescription}
                onOpenPrivacy={onOpenPrivacy}
                onOpenTerms={onOpenTerms}
              />
            </Suspense>
          </RouteErrorBoundary>
        )}

        <LegalFooter
          onOpenPrivacy={onOpenPrivacy}
          onOpenTerms={onOpenTerms}
          onOpenCookies={onOpenCookies}
          onOpenFaq={onOpenFaq}
          onOpenContact={onOpenContact}
          onOpenPress={onOpenPress}
        />
      </main>

      {/* #58 5-second Undo Toast */}
      {undoToast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 max-w-sm w-[92%] bg-zinc-900 border border-teal-500/40 rounded-xl px-4 py-2.5 shadow-2xl flex items-center justify-between gap-3 no-print">
          <span className="text-xs text-zinc-200 truncate">{undoToast.label}</span>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={async () => {
                await undoToast.onUndo();
                dismissUndoToast();
              }}
              aria-label="Undo delete"
              className="px-3 py-1 bg-teal-500 hover:bg-teal-400 text-zinc-950 font-bold rounded-lg text-xs transition-colors"
            >
              Undo
            </button>
            <button
              type="button"
              onClick={dismissUndoToast}
              aria-label="Dismiss undo notice"
              className="text-xs text-zinc-400 hover:text-zinc-200 px-1"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Global Modals & Overlays */}
      <OnboardingModal />
      <FirstRunTooltips />
      {!isGuest && <WeeklyRecapModal />}
      <AuthModal
        onAuthComplete={() => {
          setCurrentTab('diary');
          window.history.pushState({}, '', '/dashboard');
          window.dispatchEvent(new PopStateEvent('popstate'));
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />
      <GuestLockSheet />
      <GuestExpiredOverlay />
      <MilestoneConfettiModal />
      <KeyboardShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />
      {isAddFoodOpen && (
        <Suspense fallback={null}>
          <AddFoodModal
            isOpen={isAddFoodOpen}
            onClose={closeAddFood}
            defaultMeal={selectedMealForAdd || lastSelectedMeal || 'breakfast'}
          />
        </Suspense>
      )}

      {/* #21 Session expiry warning modal (25m idle -> 5m warning) */}
      {isSessionExpiryWarningOpen && (
        <div className="fixed inset-0 z-[95] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl text-center">
            <h3 className="text-sm font-bold text-zinc-100">Session Expiring Soon</h3>
            <p className="text-xs text-zinc-300 leading-relaxed">
              You haven&apos;t interacted in 25 minutes. For your security, you will be signed out in{' '}
              <span className="font-mono font-bold text-teal-400">
                {Math.floor(sessionExpiryRemainingSec / 60)}:
                {String(sessionExpiryRemainingSec % 60).padStart(2, '0')}
              </span>
              .
            </p>
            <button
              type="button"
              onClick={staySignedIn}
              className="w-full py-2.5 px-4 bg-teal-500 hover:bg-teal-400 text-zinc-950 font-bold text-xs rounded-xl transition-colors"
            >
              Stay signed in
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

type ViewType =
  | 'landing'
  | 'app'
  | 'privacy'
  | 'terms'
  | 'cookies'
  | 'faq'
  | 'contact'
  | 'press'
  | 'notfound';

function hasStoredNonGuestToken(): boolean {
  try {
    if (localStorage.getItem('forkcount_dev_device') !== null || localStorage.getItem('calory_dev_device') !== null) {
      return true;
    }
    const token =
      localStorage.getItem('forkcount_session_token') ||
      localStorage.getItem('caloriq_session_token') ||
      sessionStorage.getItem('forkcount_session_token') ||
      sessionStorage.getItem('caloriq_session_token');
    return Boolean(
      token &&
        token !== 'undefined' &&
        token !== 'null' &&
        !token.startsWith('guest_')
    );
  } catch {
    return false;
  }
}

function resolveViewFromLocation(): ViewType {
  const path = window.location.pathname;
  const params = new URLSearchParams(window.location.search);

  // Validate redirect query parameter against open redirect vulnerabilities
  const redirectParam =
    params.get('next') ||
    params.get('returnTo') ||
    params.get('redirect') ||
    params.get('redirectTo') ||
    params.get('redirectUrl');

  if (redirectParam) {
    const safeTarget = getSafeRedirectUrl(redirectParam, '/dashboard');
    if (window.location.pathname !== safeTarget) {
      window.history.replaceState({}, '', safeTarget);
      return safeTarget === '/privacy'
        ? 'privacy'
        : safeTarget === '/terms'
        ? 'terms'
        : safeTarget === '/cookies'
        ? 'cookies'
        : safeTarget === '/faq'
        ? 'faq'
        : safeTarget === '/contact'
        ? 'contact'
        : safeTarget === '/press'
        ? 'press'
        : 'app';
    }
  }

  if (path === '/' || path === '/index.html') {
    if (params.get('view') === 'privacy') return 'privacy';
    if (params.get('view') === 'terms') return 'terms';
    if (params.get('view') === 'app' || params.get('resetToken')) return 'app';
    if (hasStoredNonGuestToken()) {
      window.history.replaceState({}, '', '/dashboard');
      return 'app';
    }
    return 'landing';
  }
  if (path === '/app' || path === '/dashboard') return 'app';
  if (path === '/privacy') return 'privacy';
  if (path === '/terms') return 'terms';
  if (path === '/cookies') return 'cookies';
  if (path === '/faq') return 'faq';
  if (path === '/contact') return 'contact';
  if (path === '/press') return 'press';
  return 'notfound';
}

export default function App() {
  const [activeView, setActiveView] = useState<ViewType>(() => resolveViewFromLocation());
  const [pathname, setPathname] = useState(window.location.pathname);
  const [initialTab, setInitialTab] = useState<TabType>('diary');
  const [autoOpenAuth, setAutoOpenAuth] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return Boolean(params.get('resetToken'));
  });

  // #47 Cookie / Local Storage first-visit notice
  const [showStorageBanner, setShowStorageBanner] = useState<boolean>(() => {
    return !localStorage.getItem('forkcount_cookie_consent_at') && !localStorage.getItem('caloriq_cookie_consent_at');
  });

  // #20, #21, #22 Custom PWA install prompt (after 2nd visit, hidden if installed or dismissed)
  const [deferredPwaPrompt, setDeferredPwaPrompt] = useState<any>(null);
  const [showPwaBanner, setShowPwaBanner] = useState(false);
  const [isIosSafari, setIsIosSafari] = useState(false);

  // #24 Service worker update toast ("New version available — tap to refresh")
  const [swUpdateAvailable, setSwUpdateAvailable] = useState(false);

  // #83 Maintenance mode check
  const [maintenanceInfo, setMaintenanceInfo] = useState<{ active: boolean; message: string } | null>(null);

  // Session management state
  const [devSessionKey, setDevSessionKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const hadTokenSynchronously = hasStoredNonGuestToken();
    api.verifyStoredSessionOnLoad().then((res) => {
      if (cancelled) return;
      if (res.hasValidToken) {
        setAutoOpenAuth(false);
        if (!hadTokenSynchronously) {
          setDevSessionKey((k) => k + 1);
        }
        if (window.location.pathname === '/' || window.location.pathname === '/index.html') {
          setActiveView('app');
          setPathname('/dashboard');
          window.history.replaceState({}, '', '/dashboard');
        }
      } else if (res.devAccountExists) {
        setAutoOpenAuth(true);
        if (window.location.pathname === '/' || window.location.pathname === '/index.html') {
          setActiveView('app');
          setPathname('/dashboard');
          window.history.replaceState({}, '', '/dashboard');
        }
      }
    }).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // #59 & #62 Capture global errors and console.error ring buffer for bug reports
  useEffect(() => {
    const w = window as any;
    if (!Array.isArray(w.__forkcountConsoleErrors)) {
      w.__forkcountConsoleErrors = [];
      const origError = console.error;
      console.error = (...args: any[]) => {
        try {
          const msg = args
            .map((a) => (typeof a === 'string' ? a : a?.message || JSON.stringify(a)))
            .join(' ')
            .slice(0, 300);
          w.__forkcountConsoleErrors.push(`${new Date().toISOString()}: ${msg}`);
          if (w.__forkcountConsoleErrors.length > 10) {
            w.__forkcountConsoleErrors.shift();
          }
        } catch {
          // ignore
        }
        origError.apply(console, args);
      };
    }

    const onGlobalError = (event: ErrorEvent) => {
      try {
        w.__forkcountConsoleErrors.push(`Uncaught: ${event.message || 'Error'}`);
      } catch {
        // ignore
      }
    };
    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      try {
        w.__forkcountConsoleErrors.push(`UnhandledRejection: ${String(event.reason)}`);
      } catch {
        // ignore
      }
    };
    window.addEventListener('error', onGlobalError);
    window.addEventListener('unhandledrejection', onUnhandledRejection);
    return () => {
      window.removeEventListener('error', onGlobalError);
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
    };
  }, []);

  // #20, #21, #22 Visit counter & PWA install prompt detection + #24 SW update toast + #83 Maintenance check
  useEffect(() => {
    const visits = Number(localStorage.getItem('forkcount_visit_count') || localStorage.getItem('caloriq_visit_count') || '0') + 1;
    localStorage.setItem('forkcount_visit_count', String(visits));

    const isStandalone =
      window.matchMedia?.('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    const isDismissed = localStorage.getItem('forkcount_pwa_dismissed') === 'true' || localStorage.getItem('caloriq_pwa_dismissed') === 'true';

    const ua = window.navigator.userAgent;
    const ios = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
    const safari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
    setIsIosSafari(ios && safari);

    if (!isStandalone && !isDismissed && visits >= 2 && ios && safari) {
      setShowPwaBanner(true);
    }

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPwaPrompt(e);
      if (!isStandalone && !isDismissed && visits >= 2) {
        setShowPwaBanner(true);
      }
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    const handleSwUpdate = () => setSwUpdateAvailable(true);
    window.addEventListener('forkcount-sw-update', handleSwUpdate);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('forkcount-sw-update', handleSwUpdate);
    };
  }, []);

  useEffect(() => {
    trackPageview(window.location.pathname);
    const handlePopState = () => {
      setPathname(window.location.pathname);
      setActiveView(resolveViewFromLocation());
      trackPageview(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // #83 Maintenance page when maintenance mode is active
  if (maintenanceInfo?.active) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-6 font-sans">
        <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-center space-y-3 shadow-2xl">
          <span className="inline-block px-2.5 py-1 rounded-full bg-teal-500/10 border border-teal-500/30 text-teal-300 text-[11px] font-mono">
            Scheduled Maintenance
          </span>
          <h1 className="text-lg font-bold text-zinc-100">We&apos;ll be right back</h1>
          <p className="text-xs text-zinc-300 leading-relaxed">{maintenanceInfo.message}</p>
        </div>
      </div>
    );
  }

  const navigateTo = (view: ViewType, path: string) => {
    setActiveView(view);
    setPathname(path);
    window.history.pushState({}, '', path);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenApp = async (action?: 'guest' | 'login' | 'program' | 'demo') => {
    if (action === 'demo') {
      try {
        await api.startDemoMode();
      } catch {
        // ignore
      }
    }
    if (action === 'login') {
      setAutoOpenAuth(true);
    } else {
      setAutoOpenAuth(false);
    }

    if (action === 'program') {
      setInitialTab('plan');
    } else {
      setInitialTab('diary');
    }

    setActiveView('app');
    setPathname('/dashboard');
    window.history.pushState({}, '', '/dashboard');
  };

  const handleOpenDescription = () => navigateTo('landing', '/');
  const handleOpenPrivacy = () => navigateTo('privacy', '/privacy');
  const handleOpenTerms = () => navigateTo('terms', '/terms');
  const handleOpenCookies = () => navigateTo('cookies', '/cookies');
  const handleOpenFaq = () => navigateTo('faq', '/faq');
  const handleOpenContact = () => navigateTo('contact', '/contact');
  const handleOpenPress = () => navigateTo('press', '/press');

  const handleDismissStorageBanner = () => {
    setShowStorageBanner(false);
    api.logCookieConsent();
  };

  const handleDismissPwaBanner = () => {
    setShowPwaBanner(false);
    localStorage.setItem('forkcount_pwa_dismissed', 'true');
  };

  const handleTriggerPwaInstall = async () => {
    if (deferredPwaPrompt) {
      deferredPwaPrompt.prompt();
      await deferredPwaPrompt.userChoice.catch(() => {});
      setDeferredPwaPrompt(null);
      setShowPwaBanner(false);
    }
  };

  return (
    <ErrorBoundary>
      {activeView === 'privacy' && (
        <Suspense fallback={<RouteSkeleton />}>
          <PrivacyPolicyPage
            onBackToLanding={handleOpenDescription}
            onOpenTerms={handleOpenTerms}
          />
          <DesktopScrollbar />
        </Suspense>
      )}

      {activeView === 'terms' && (
        <Suspense fallback={<RouteSkeleton />}>
          <TermsOfServicePage
            onBackToLanding={handleOpenDescription}
            onOpenPrivacy={handleOpenPrivacy}
          />
          <DesktopScrollbar />
        </Suspense>
      )}

      {activeView === 'cookies' && (
        <Suspense fallback={<RouteSkeleton />}>
          <CookiesPolicyPage
            onBackToLanding={handleOpenDescription}
            onOpenPrivacy={handleOpenPrivacy}
            onOpenTerms={handleOpenTerms}
          />
          <DesktopScrollbar />
        </Suspense>
      )}

      {activeView === 'faq' && (
        <Suspense fallback={<RouteSkeleton />}>
          <FaqPage
            onBackToLanding={handleOpenDescription}
            onOpenPrivacy={handleOpenPrivacy}
            onOpenTerms={handleOpenTerms}
          />
          <DesktopScrollbar />
        </Suspense>
      )}

      {activeView === 'contact' && (
        <Suspense fallback={<RouteSkeleton />}>
          <ContactPage
            onBackToLanding={handleOpenDescription}
            onOpenPrivacy={handleOpenPrivacy}
            onOpenTerms={handleOpenTerms}
          />
          <DesktopScrollbar />
        </Suspense>
      )}

      {activeView === 'press' && (
        <Suspense fallback={<RouteSkeleton />}>
          <PressKitPage
            onBackToLanding={handleOpenDescription}
            onOpenPrivacy={handleOpenPrivacy}
            onOpenTerms={handleOpenTerms}
          />
          <DesktopScrollbar />
        </Suspense>
      )}

      {activeView === 'notfound' && (
        <Suspense fallback={<RouteSkeleton />}>
          <NotFoundPage
            onGoToDiary={() => handleOpenApp('guest')}
            onGoToLanding={handleOpenDescription}
          />
          <DesktopScrollbar />
        </Suspense>
      )}

      {activeView === 'landing' && (
        <Suspense fallback={<RouteSkeleton />}>
          <DescriptionPage
            onOpenApp={handleOpenApp}
            onOpenPrivacy={handleOpenPrivacy}
            onOpenTerms={handleOpenTerms}
            onOpenCookies={handleOpenCookies}
            onOpenFaq={handleOpenFaq}
            onOpenContact={handleOpenContact}
            onOpenPress={handleOpenPress}
          />
          <DesktopScrollbar />
        </Suspense>
      )}

      {activeView === 'app' && (
        <AppProvider key={devSessionKey}>
          <MainAppContent
            onOpenDescription={handleOpenDescription}
            onOpenPrivacy={handleOpenPrivacy}
            onOpenTerms={handleOpenTerms}
            onOpenCookies={handleOpenCookies}
            onOpenFaq={handleOpenFaq}
            onOpenContact={handleOpenContact}
            onOpenPress={handleOpenPress}
            initialTab={initialTab}
            autoOpenAuth={autoOpenAuth}
            onAutoOpenAuthHandled={() => setAutoOpenAuth(false)}
          />
          <DesktopScrollbar />
        </AppProvider>
      )}

      {/* #24 Service Worker Update Toast */}
      {swUpdateAvailable && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-3 left-1/2 -translate-x-1/2 z-[90] bg-zinc-900 border border-teal-500/50 rounded-xl px-4 py-2.5 shadow-2xl flex items-center gap-3 no-print"
        >
          <span className="text-xs text-zinc-100 font-medium">
            New version available — tap to refresh
          </span>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-3 py-1 bg-teal-500 hover:bg-teal-400 text-zinc-950 font-bold rounded-lg text-xs"
          >
            Refresh
          </button>
        </div>
      )}

      {/* #20, #21, #22 Custom PWA Install Banner (after 2nd visit) */}
      {showPwaBanner && (
        <div className="fixed bottom-16 left-1/2 -translate-x-1/2 z-[80] max-w-md w-[94%] bg-zinc-900 border border-teal-500/40 rounded-2xl p-4 shadow-2xl space-y-2.5 no-print">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h4 className="text-xs font-bold text-zinc-100">Install ForkCount to Home Screen</h4>
              <p className="text-[11px] text-zinc-300 mt-0.5 leading-relaxed">
                {isIosSafari
                  ? 'On iOS Safari: tap the Share button at the bottom of your screen, then choose "Add to Home Screen".'
                  : 'Install ForkCount for instant offline logging and a clean full-screen experience.'}
              </p>
            </div>
            <button
              type="button"
              onClick={handleDismissPwaBanner}
              aria-label="Dismiss install banner"
              className="text-xs text-zinc-400 hover:text-zinc-200 px-1.5 py-0.5"
            >
              Dismiss
            </button>
          </div>
          {!isIosSafari && deferredPwaPrompt && (
            <button
              type="button"
              onClick={handleTriggerPwaInstall}
              className="w-full py-2 bg-teal-500 hover:bg-teal-400 text-zinc-950 font-bold rounded-xl text-xs transition-colors"
            >
              Install App
            </button>
          )}
        </div>
      )}

      {/* #47 First-visit Local Storage / Cookie Notice Banner */}
      {showStorageBanner && (
        <div
          role="region"
          aria-label="Storage and privacy notice"
          className="fixed bottom-3 left-1/2 -translate-x-1/2 z-[85] max-w-lg w-[94%] bg-zinc-900/95 backdrop-blur-md border border-zinc-800 rounded-2xl p-3.5 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-3 no-print"
        >
          <p className="text-xs text-zinc-300 leading-relaxed text-center sm:text-left">
            ForkCount uses local storage to keep you signed in and remember your preferences. No tracking cookies.{' '}
            <a
              href="/cookies"
              onClick={(e) => {
                e.preventDefault();
                handleOpenCookies();
              }}
              className="text-teal-400 hover:text-teal-300 underline underline-offset-4"
            >
              Learn more
            </a>
          </p>
          <button
            type="button"
            onClick={handleDismissStorageBanner}
            aria-label="Got it, dismiss storage notice"
            className="px-4 py-1.5 bg-teal-500 hover:bg-teal-400 text-zinc-950 font-bold rounded-xl text-xs shrink-0 transition-colors"
          >
            Got it
          </button>
        </div>
      )}
    </ErrorBoundary>
  );
}
