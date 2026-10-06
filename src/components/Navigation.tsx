import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Activity,
  Users,
  CalendarCheck,
  BarChart3,
  User,
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Clock,
  Sun,
  Moon,
  Terminal
} from 'lucide-react';
import { useApp } from '../context/AppContext.js';
import { DevToolsSheet } from './DevToolsSheet.js';
import { t } from '../utils/i18n.js';
import { getDateBounds } from '../utils/validation.js';
import { formatLocalDate, parseLocalDate, addDaysLocal } from '../utils/dateUtils.js';

export type TabType = 'diary' | 'fitness' | 'community' | 'plan' | 'reports' | 'me';

interface NavigationProps {
  currentTab: TabType;
  onTabChange: (tab: TabType) => void;
  onOpenDescription?: () => void;
}

export const Navigation: React.FC<NavigationProps> = ({ currentTab, onTabChange, onOpenDescription }) => {
  const {
    activeDate,
    setActiveDate,
    isGuest,
    isDev,
    userId,
    userEmail,
    profile,
    openAuthModal,
    openGuestLock,
    isOnline,
    isSyncing,
    saveStatus,
    language,
    updateUserProfile
  } = useApp();

  const theme = profile.themeMode || 'dark';
  const toggleTheme = async () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    try {
      localStorage.setItem('forkcount_theme_mode', next);
    } catch {}
    await updateUserProfile({ themeMode: next });
  };

  const [isDevToolsOpen, setIsDevToolsOpen] = useState(false);

  const isDevAccount =
    !isGuest &&
    Boolean(isDev) &&
    profile?.isDev !== false &&
    (userId === 'usr_dev_housefly' ||
      userId === 'usr_545648c7-5e38-44fc-adc5-373e0b3e5e18' ||
      (userEmail || '').toLowerCase().replace(/^@/, '') === 'housefly' ||
      (userEmail || '').toLowerCase() === 'housefly@mail2world.com' ||
      (profile?.username || '').toLowerCase().replace(/^@/, '') === 'housefly');

  useEffect(() => {
    const handleOpenDev = () => {
      if (isDevAccount) {
        setIsDevToolsOpen(true);
      }
    };
    window.addEventListener('forkcount-open-dev-console', handleOpenDev);
    return () => window.removeEventListener('forkcount-open-dev-console', handleOpenDev);
  }, [isDevAccount]);

  const { minDate, maxDate } = getDateBounds();
  const isAtMaxDate = activeDate >= maxDate;
  const isAtMinDate = activeDate <= minDate;

  const handlePrevDay = () => {
    if (isAtMinDate) return;
    const nextStr = addDaysLocal(activeDate, -1);
    if (nextStr >= minDate) {
      setActiveDate(nextStr);
    }
  };

  const handleNextDay = () => {
    if (isAtMaxDate) return;
    const nextStr = addDaysLocal(activeDate, 1);
    if (nextStr <= maxDate) {
      setActiveDate(nextStr);
    }
  };

  const formatDateDisplay = (dateStr: string) => {
    const d = parseLocalDate(dateStr);
    const todayStr = formatLocalDate();
    const isToday = dateStr === todayStr;

    const formatted = d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });

    return isToday ? `Today · ${formatted}` : formatted;
  };

  const navItems = [
    { id: 'diary' as TabType, label: t('diary', language), icon: BookOpen },
    { id: 'fitness' as TabType, label: t('fitness', language), icon: Activity },
    { id: 'community' as TabType, label: t('community', language), icon: Users },
    { id: 'reports' as TabType, label: t('reports', language), icon: BarChart3 },
    { id: 'me' as TabType, label: t('me', language), icon: User }
  ];

  const handleTabClick = (tab: TabType) => {
    if (isGuest && (tab === 'fitness' || tab === 'plan' || tab === 'reports')) {
      openGuestLock();
      return;
    }
    onTabChange(tab);
  };

  const effectiveSaveStatus = isSyncing && saveStatus !== 'error' ? 'saving' : saveStatus;

  return (
    <>
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-zinc-950/90 backdrop-blur-md border-b border-zinc-850 px-4 py-3">
        <div className="max-w-md mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              onClick={onOpenDescription}
              title="View ForkCount description and overview"
              aria-label="View ForkCount description and overview"
              className="font-bold text-base tracking-tight text-zinc-100 flex items-center gap-1.5 hover:text-teal-400 transition-colors cursor-pointer"
            >
              <span className="w-2 h-2 rounded-full bg-teal-400 inline-block"></span>
              <span>ForkCount</span>
            </button>
            {/* #19 Auto-save indicator dot */}
            <span
              title={
                effectiveSaveStatus === 'saving'
                  ? 'Saving...'
                  : effectiveSaveStatus === 'error'
                  ? 'Save failed'
                  : 'All changes saved'
              }
              aria-label={
                effectiveSaveStatus === 'saving'
                  ? 'Saving in progress'
                  : effectiveSaveStatus === 'error'
                  ? 'Save failed'
                  : 'All changes saved'
              }
              className={`w-2 h-2 rounded-full inline-block transition-colors ${
                effectiveSaveStatus === 'saving'
                  ? 'bg-teal-400 animate-pulse'
                  : effectiveSaveStatus === 'error'
                  ? 'bg-red-500'
                  : 'bg-zinc-500'
              }`}
            />
          </div>

          {/* Date Selector */}
          <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-xl px-1.5 py-1">
            <button
              onClick={handlePrevDay}
              disabled={isAtMinDate}
              className="p-1.5 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 disabled:opacity-30 disabled:pointer-events-none rounded-lg transition-colors"
              aria-label="Previous day"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            <label className="relative flex items-center gap-1.5 px-1.5 py-0.5 text-xs font-medium text-zinc-300 cursor-pointer hover:text-teal-400 transition-colors">
              <CalendarIcon className="w-3 h-3 text-zinc-500" />
              <span>{formatDateDisplay(activeDate)}</span>
              <input
                type="date"
                aria-label="Select date"
                min={minDate}
                max={maxDate}
                value={activeDate}
                onChange={(e) => e.target.value && setActiveDate(e.target.value)}
                className="absolute inset-0 opacity-0 cursor-pointer w-full"
              />
            </label>

            <button
              onClick={handleNextDay}
              disabled={isAtMaxDate}
              className="p-1.5 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 disabled:opacity-30 disabled:pointer-events-none rounded-lg transition-colors"
              aria-label="Next day"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Theme toggle, Dev button (housefly only), and Account status */}
          <div className="flex items-center gap-1.5">
            {isDevAccount && (
              <button
                type="button"
                onClick={() => setIsDevToolsOpen(true)}
                aria-label="Open Dev Tools"
                title="Open Dev Tools"
                className="px-2 py-1.5 rounded-lg bg-teal-500/15 hover:bg-teal-500/25 border border-teal-500/40 text-teal-300 font-mono font-bold text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Terminal className="w-3 h-3 text-teal-400" />
                <span>Dev Tools</span>
              </button>
            )}

            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer"
            >
              {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            </button>

            <button
              onClick={() => openAuthModal()}
              aria-label={isGuest ? 'Sign in or create account' : 'Account details'}
              className={`text-xs px-2.5 py-1.5 rounded-lg border transition-colors flex items-center gap-1.5 ${
                isGuest
                  ? 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
                  : 'bg-teal-950/40 border-teal-800/60 text-teal-300'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-teal-400"></span>
              <span>
                {isGuest
                  ? 'Guest'
                  : `@${(isDevAccount ? 'housefly' : (profile?.username || userEmail?.split('@')[0] || 'Sync')).replace(/^@/, '')}`}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Full-screen Dev Tools Sheet (only when signed in as housefly / isDev = true) */}
      {isDevAccount && (
        <DevToolsSheet
          isOpen={isDevToolsOpen}
          onClose={() => setIsDevToolsOpen(false)}
          userEmail={userEmail}
        />
      )}

      {/* Bottom Tab Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-zinc-950/95 backdrop-blur-md border-t border-zinc-850 px-2 py-2">
        <div className="max-w-md mx-auto flex items-center justify-around">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            const isLockedForGuest = isGuest && (item.id === 'fitness' || item.id === 'plan' || item.id === 'reports');
            return (
              <button
                key={item.id}
                onClick={() => handleTabClick(item.id)}
                aria-label={item.label}
                className={`min-h-[44px] min-w-[44px] flex flex-col items-center justify-center gap-1 py-1 px-3 rounded-xl transition-all ${
                  isActive
                    ? 'text-teal-400 font-semibold'
                    : isLockedForGuest
                      ? 'text-zinc-600 hover:text-zinc-400 font-normal'
                      : 'text-zinc-500 hover:text-zinc-300 font-normal'
                }`}
              >
                <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110 text-teal-400' : isLockedForGuest ? 'text-zinc-600' : 'text-zinc-500'}`} />
                <span className="text-[10px] tracking-tight">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
};
