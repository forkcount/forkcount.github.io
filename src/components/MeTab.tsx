import React, { useState, useEffect } from 'react';
import {
  Scale,
  Award,
  Download,
  AlertTriangle,
  Plus,
  Trash2,
  CheckCircle2,
  TrendingDown,
  Sparkles,
  Shield,
  Sun,
  Moon,
  Clock,
  Trophy,
  Compass,
  Bell,
  Smartphone,
  Calendar,
  BarChart3,
  CalendarCheck,
  Flame,
  BookOpen,
  Bookmark,
  Lock,
  Gift,
  Copy,
  Check,
  Globe,
  Upload,
  KeyRound,
  User,
  Bug,
  LogOut,
  Terminal,
  Flag,
  RefreshCw
} from 'lucide-react';
import { useApp } from '../context/AppContext.js';
import { api } from '../services/api.js';
import { APP_VERSION } from '../utils/i18n.js';
import { SecretFooter } from './SecretFooter.js';
import { validateAndMigrateBackup, CURRENT_BACKUP_SCHEMA_VERSION } from '../utils/backupMigration.js';
import { WeeklyRecapModal } from './WeeklyRecapModal.js';
import { SocialAccountabilitySection } from './SocialAccountabilitySection.js';
import { ConfirmDialog } from './ConfirmDialog.js';
import { SwipeableItem } from './SwipeableItem.js';
import {
  hasCompleteProfileStats,
  calculateBmr,
  calculateMaintenanceCalories,
  calculateDailyCalorieTarget,
  calculateMacroTargets,
  calculateProjectedGoalDetails,
  formatWeight
} from '../utils/nutritionMath.js';
import {
  useDebounce,
  validateAge,
  validateHeightCm,
  validateHeightImperial,
  validateWeight,
  validateBodyFat,
  getDateBounds,
  validateDateRange
} from '../utils/validation.js';
import { formatLocalDate, addDaysLocal } from '../utils/dateUtils.js';
import type { SupportedLanguage } from '../utils/i18n.js';
import type { UserProfile, CommunityPost, ReportedPostRecord } from '../types/index.js';

function cmToFtIn(cm: number): { ft: string; in: string } {
  if (!cm || cm <= 0) return { ft: '', in: '' };
  const totalInches = Math.round(cm / 2.54);
  const ft = Math.floor(totalInches / 12);
  const inc = totalInches % 12;
  return { ft: String(ft), in: String(inc) };
}

const BADGE_DEFINITIONS: Array<{ id: string; title: string; desc: string }> = [
  { id: 'First log', title: 'First Log', desc: 'Logged your first meal' },
  { id: '3-day streak', title: '3-Day Streak', desc: 'Logged consistency 3 days in a row' },
  { id: '7-day streak', title: '7-Day Streak', desc: 'Logged consistency 7 days in a row' },
  { id: '30-day streak', title: '30-Day Streak', desc: '1 month of consistent tracking' },
  { id: '100-day streak', title: '100-Day Streak', desc: 'Mastery of long-term habits' },
  { id: 'First workout', title: 'First Workout', desc: 'Logged your first exercise session' },
  { id: 'Hydrated', title: 'Hydrated', desc: 'Logged daily water consumption' },
  { id: 'First weigh-in', title: 'First Weigh-In', desc: 'Recorded baseline scale weight' },
  { id: 'Weighed 7 times', title: '7 Weigh-Ins', desc: 'Consistent scale monitoring' },
  { id: 'Weighed 30 times', title: '30 Weigh-Ins', desc: 'Comprehensive weight progression' },
  { id: '50 XP', title: '50 XP', desc: 'Earned 50 XP in Caloriq' },
  { id: '200 XP', title: '200 XP', desc: 'Earned 200 XP in Caloriq' },
  { id: '1000 XP', title: '1,000 XP', desc: 'Earned 1,000 XP milestone' },
  { id: '5000 XP', title: '5,000 XP', desc: 'Elite tracking veteran' }
];

interface MeTabProps {
  onOpenDescription?: () => void;
  onOpenPrivacy?: () => void;
  onOpenTerms?: () => void;
}

export const MeTab: React.FC<MeTabProps> = ({
  onOpenDescription,
  onOpenPrivacy,
  onOpenTerms
}) => {
  const {
    userId,
    profile,
    updateUserProfile,
    weights,
    addWeightLog,
    deleteWeightLog,
    stats,
    victories,
    addVictoryItem,
    deleteVictoryItem,
    isGuest,
    guestRemainingMs,
    openAuthModal,
    resetGuestSession,
    refreshDayData,
    allDiaryItems,
    exercises,
    allExercises,
    waterGlasses
  } = useApp();

  const getBadgeProgress = (badgeId: string): { current: number; target: number; unit: string } => {
    const streak = stats.foodStreak || 0;
    const xpVal = stats.xp || 0;
    const weighCount = weights.length;
    const mealCount = allDiaryItems.length;
    const workoutCount = (allExercises || exercises || []).length;
    switch (badgeId) {
      case 'First log':
        return { current: Math.min(1, mealCount), target: 1, unit: 'meal' };
      case '3-day streak':
        return { current: Math.min(3, streak), target: 3, unit: 'days' };
      case '7-day streak':
        return { current: Math.min(7, streak), target: 7, unit: 'days' };
      case '30-day streak':
        return { current: Math.min(30, streak), target: 30, unit: 'days' };
      case '100-day streak':
        return { current: Math.min(100, streak), target: 100, unit: 'days' };
      case 'First workout':
        return { current: Math.min(1, workoutCount), target: 1, unit: 'workout' };
      case 'Hydrated':
        return { current: Math.min(1, waterGlasses > 0 ? 1 : 0), target: 1, unit: 'glass' };
      case 'First weigh-in':
        return { current: Math.min(1, weighCount), target: 1, unit: 'weigh-in' };
      case 'Weighed 7 times':
        return { current: Math.min(7, weighCount), target: 7, unit: 'weigh-ins' };
      case 'Weighed 30 times':
        return { current: Math.min(30, weighCount), target: 30, unit: 'weigh-ins' };
      case '50 XP':
        return { current: Math.min(50, xpVal), target: 50, unit: 'XP' };
      case '200 XP':
        return { current: Math.min(200, xpVal), target: 200, unit: 'XP' };
      case '1000 XP':
        return { current: Math.min(1000, xpVal), target: 1000, unit: 'XP' };
      case '5000 XP':
        return { current: Math.min(5000, xpVal), target: 5000, unit: 'XP' };
      default:
        return { current: 0, target: 1, unit: '' };
    }
  };

  // Account deletion 2-step state & notice
  const [deleteStep, setDeleteStep] = useState<0 | 1>(0);
  const [deletePasswordConfirm, setDeletePasswordConfirm] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletedBanner, setDeletedBanner] = useState<string | null>(() => {
    const msg = sessionStorage.getItem('caloriq_deleted_notice');
    if (msg) {
      sessionStorage.removeItem('caloriq_deleted_notice');
      return msg;
    }
    return null;
  });

  // #53, #58 Active sessions & Last signed in
  const [sessionsList, setSessionsList] = useState<Array<{ id: string; deviceLabel: string; ip: string; createdAt: string; lastActiveAt: string; isCurrent: boolean }>>([]);
  const rawLastSignedInAt = localStorage.getItem('caloriq_last_signed_in_at');
  const formattedLastSignedIn = (() => {
    const candidate = rawLastSignedInAt || sessionsList.find((s) => s.isCurrent)?.createdAt || sessionsList[0]?.createdAt;
    if (!candidate || candidate === 'null' || candidate === 'undefined' || candidate === 'first_session') {
      return new Date().toLocaleDateString();
    }
    const num = Number(candidate);
    const d = !Number.isNaN(num) && num > 0 ? new Date(num) : new Date(String(candidate));
    if (Number.isNaN(d.getTime())) {
      return new Date().toLocaleDateString();
    }
    return d.toLocaleString();
  })();

  // Form State
  const [formData, setFormData] = useState<UserProfile>(profile);
  const [heightFtInput, setHeightFtInput] = useState<string>(() => cmToFtIn(profile.heightCm).ft);
  const [heightInInput, setHeightInInput] = useState<string>(() => cmToFtIn(profile.heightCm).in);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [showProjectedWhy, setShowProjectedWhy] = useState(false);
  const [localGoalSpeedOverride, setLocalGoalSpeedOverride] = useState(false);
  const debouncedFormData = useDebounce(formData, 400);

  const activeUsername = (profile.username || formData.username || 'housefly')
    .replace(/^@/, '')
    .split('@')[0];

  // "Why I started" pinned card state (#42)
  const [whyText, setWhyText] = useState(profile.pinnedWhy || '');
  const [isEditingWhy, setIsEditingWhy] = useState(!profile.pinnedWhy);

  // Non-scale victories (#41)
  const [newVictory, setNewVictory] = useState('');

  // #55 Username change flow state
  const [showUsernameChange, setShowUsernameChange] = useState(false);
  const [usernameChangeCurrentPwd, setUsernameChangeCurrentPwd] = useState('');
  const [usernameChangeNewUsername, setUsernameChangeNewUsername] = useState('');
  const [usernameChangeStatus, setUsernameChangeStatus] = useState<string | null>(null);

  // #56 Password change flow state
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [currentPasswordInput, setCurrentPasswordInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [passwordChangeStatus, setPasswordChangeStatus] = useState<string | null>(null);

  // #62 Report a bug state
  const [bugDescription, setBugDescription] = useState('');
  const [bugStatus, setBugStatus] = useState<string | null>(null);
  const [isSendingBug, setIsSendingBug] = useState(false);

  // #79, #80 Backup import state
  const [backupImportStatus, setBackupImportStatus] = useState<string | null>(null);

  // Referral code state
  const myReferralCode =
    profile.referralCode ||
    `CQ${(userId || 'GUEST').replace(/[^a-zA-Z0-9]/g, '').slice(0, 5).toUpperCase()}`;
  const [friendCodeInput, setFriendCodeInput] = useState('');
  const [referralMsg, setReferralMsg] = useState<string | null>(null);
  const [copiedRef, setCopiedRef] = useState(false);

  // Weight Log input
  const [newWeight, setNewWeight] = useState('');
  const [weightDate, setWeightDate] = useState(formatLocalDate());
  const [weightError, setWeightError] = useState<string | null>(null);
  const debouncedNewWeight = useDebounce(newWeight, 400);
  const { minDate, maxDate } = getDateBounds();

  // Clear confirmation modal
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  // #60 Weekly recap modal trigger
  const [showRecapModal, setShowRecapModal] = useState(false);
  // #57 Custom reminder times
  const [reminders, setReminders] = useState({
    breakfast: profile.reminderTimes?.breakfast || '08:00',
    lunch: profile.reminderTimes?.lunch || '13:00',
    dinner: profile.reminderTimes?.dinner || '19:00',
    water: profile.reminderTimes?.water || '15:00'
  });

  useEffect(() => {
    setFormData(profile);
    setWhyText(profile.pinnedWhy || '');
    const converted = cmToFtIn(profile.heightCm);
    setHeightFtInput(converted.ft);
    setHeightInInput(converted.in);
  }, [profile]);

  useEffect(() => {
    if (!isGuest) {
      api.getSessions().then((res) => setSessionsList(res.sessions || [])).catch(() => {});
    }
  }, [isGuest]);

  // Math recalculations live from form data (only when all required fields are answered)
  const isProfileComplete = hasCompleteProfileStats(formData);
  const currentBmrKcal = calculateBmr(formData);
  const currentMaintenanceKcal = calculateMaintenanceCalories(formData);
  const currentTargetKcal = calculateDailyCalorieTarget(formData);
  const currentMacros = calculateMacroTargets(currentTargetKcal);
  const projectedGoalDetails = calculateProjectedGoalDetails(
    formData,
    weights,
    localGoalSpeedOverride
  );
  const projectedGoalDate = projectedGoalDetails.dateText;

  const handleSaveWhy = async () => {
    await updateUserProfile({ pinnedWhy: whyText.trim() });
    setIsEditingWhy(false);
    setSaveStatus('Saved your "Why I started" statement.');
    setTimeout(() => setSaveStatus(null), 2500);
  };

  // #6 Streak freeze logic (one "protect a missed day" per month)
  const currentMonthPrefix = formatLocalDate().slice(0, 7); // YYYY-MM
  const freezesUsed = profile.streakFreezesUsed || [];
  const usedThisMonth = freezesUsed.find(d => d.startsWith(currentMonthPrefix));

  const handleUseStreakFreeze = async () => {
    if (usedThisMonth) return;
    const yStr = addDaysLocal(new Date(), -1);
    const nextFreezes = [...freezesUsed, yStr];
    await updateUserProfile({ streakFreezesUsed: nextFreezes });
    setSaveStatus(`Streak freeze activated for ${yStr}`);
    setTimeout(() => setSaveStatus(null), 3000);
  };

  // #55 Theme mode toggle (dark | light | auto)
  const currentThemeMode = formData.themeMode || profile.themeMode || 'dark';
  const handleSetTheme = async (mode: 'dark' | 'light' | 'auto') => {
    try {
      localStorage.setItem('caloriq_theme_mode', mode);
    } catch {
      // ignore
    }
    setFormData(prev => ({ ...prev, themeMode: mode }));
    await updateUserProfile({ themeMode: mode });
  };

  const handleAddVictory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVictory.trim()) return;
    await addVictoryItem(newVictory.trim());
    setNewVictory('');
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError(null);

    const ageErr = validateAge(formData.age);
    if (ageErr) {
      setProfileError(ageErr);
      return;
    }
    const heightErr =
      formData.unitSystem === 'imperial'
        ? validateHeightImperial(heightFtInput, heightInInput || '0')
        : validateHeightCm(formData.heightCm);
    if (heightErr) {
      setProfileError(heightErr);
      return;
    }
    const currWeightVal =
      formData.unitSystem === 'metric'
        ? formData.currentWeightKg
        : Math.round(formData.currentWeightKg * 2.20462 * 10) / 10;
    const weightErr = validateWeight(currWeightVal, formData.unitSystem);
    if (weightErr) {
      setProfileError(weightErr);
      return;
    }
    if (formData.goalWeightKg > 0) {
      const goalVal =
        formData.unitSystem === 'metric'
          ? formData.goalWeightKg
          : Math.round(formData.goalWeightKg * 2.20462 * 10) / 10;
      const goalWeightErr = validateWeight(goalVal, formData.unitSystem);
      if (goalWeightErr) {
        setProfileError(goalWeightErr);
        return;
      }
    }
    const bfErr = validateBodyFat(formData.bodyFatPercent);
    if (bfErr) {
      setProfileError(bfErr);
      return;
    }

    await updateUserProfile(formData);
    setSaveStatus('Profile and macro targets updated successfully!');
    setTimeout(() => setSaveStatus(null), 3000);
  };

  const handleAddWeight = async (e: React.FormEvent) => {
    e.preventDefault();
    setWeightError(null);

    const dateErr = validateDateRange(weightDate);
    if (dateErr) {
      setWeightError(dateErr);
      return;
    }
    const wErr = validateWeight(newWeight, formData.unitSystem);
    if (wErr) {
      setWeightError(wErr);
      return;
    }
    const w = parseFloat(newWeight);
    if (!w || w <= 0) return;

    const weightInKg = formData.unitSystem === 'imperial' ? Math.round((w / 2.20462) * 10) / 10 : w;
    await addWeightLog(weightInKg, weightDate);
    setNewWeight('');
  };

  const handleExportData = async () => {
    if (isGuest) return;
    try {
      const [allRes, savedRes, tmplRes] = await Promise.all([
        api.getAllDiary().catch(() => ({ items: allDiaryItems })),
        api.getSavedFoods().catch(() => ({ foods: [] })),
        api.getTemplates().catch(() => ({ templates: [] }))
      ]);

      const diaryByDate: Record<string, any[]> = {};
      for (const item of allRes.items || allDiaryItems) {
        if (!diaryByDate[item.date]) diaryByDate[item.date] = [];
        diaryByDate[item.date].push(item);
      }

      let serverExport: any = {};
      try {
        const res = await fetch(`/api/export?token=${api.getToken() || ''}`);
        if (res.ok) serverExport = await res.json();
      } catch {
        // ignore
      }

      const cleanExport = {
        schemaVersion: CURRENT_BACKUP_SCHEMA_VERSION,
        exportedAt: new Date().toISOString(),
        profile,
        diary: diaryByDate,
        weights,
        water: serverExport.water || { [formatLocalDate()]: waterGlasses },
        savedFoods: savedRes.foods || serverExport.savedFoods || [],
        recipes: serverExport.recipes || [],
        templates: tmplRes.templates || serverExport.templates || [],
        exercise: serverExport.exercise || exercises,
        plans: serverExport.plans || []
      };

      const todayStr = formatLocalDate();
      const blob = new Blob([JSON.stringify(cleanExport, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `caloriq-export-${todayStr}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    }
  };

  const handleImportBackupFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBackupImportStatus('Validating backup file...');
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const migrated = validateAndMigrateBackup(parsed);
      await api.importBackupData(migrated as unknown as Record<string, unknown>);
      await refreshDayData();
      setBackupImportStatus(
        migrated.migratedFromVersion
          ? `Backup restored and migrated from v${migrated.migratedFromVersion} to v${migrated.schemaVersion}.`
          : 'Backup restored successfully.'
      );
    } catch (err: any) {
      setBackupImportStatus(err?.message || 'Invalid backup JSON file.');
    } finally {
      e.target.value = '';
    }
  };

  const handleSubmitBugReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bugDescription.trim() || isSendingBug) return;
    setIsSendingBug(true);
    setBugStatus(null);
    try {
      const recentErrors = ((window as any).__caloriqConsoleErrors || []).slice(-5);
      await api.submitBugReport({
        description: bugDescription.trim(),
        browser: navigator.userAgent,
        os: navigator.platform || 'Unknown OS',
        screenSize: `${window.innerWidth}x${window.innerHeight}`,
        route: window.location.pathname,
        consoleErrors: recentErrors
      });
      setBugDescription('');
      setBugStatus('Bug report submitted with diagnostic details. Thank you.');
    } catch (err: any) {
      setBugStatus(err?.message || 'Could not send bug report.');
    } finally {
      setIsSendingBug(false);
    }
  };

  const handlePermanentDeleteAccount = async () => {
    setDeleteError(null);
    if (!isGuest && !deletePasswordConfirm.trim()) {
      setDeleteError('Please enter your password (or type DELETE) to confirm permanent deletion.');
      return;
    }
    try {
      await api.deleteAccount(deletePasswordConfirm.trim());
    } catch (err: any) {
      if (!isGuest && err?.message) {
        setDeleteError(err.message);
        return;
      }
    }
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('caloriq')) keysToRemove.push(k);
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
    sessionStorage.setItem(
      'caloriq_deleted_notice',
      'Your account and all your data have been deleted.'
    );
    await resetGuestSession();
    setDeleteStep(0);
    setDeletePasswordConfirm('');
    setDeletedBanner('Your account and all your data have been deleted.');
  };

  const handleRedeemReferral = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = friendCodeInput.trim().toUpperCase();
    if (!code) return;
    if (code === myReferralCode) {
      setReferralMsg('You cannot use your own referral code.');
      return;
    }
    const used = profile.usedReferrals || [];
    if (used.includes(code)) {
      setReferralMsg('This referral code has already been used.');
      return;
    }
    const nextXp = (profile.xp || stats.xp || 0) + 500;
    await updateUserProfile({
      xp: nextXp,
      referralCode: myReferralCode,
      usedReferrals: [...used, code]
    });
    setFriendCodeInput('');
    setReferralMsg('Referral applied. You and your friend both earned +500 XP.');
  };

  const handleConfirmClear = async () => {
    await api.clearAllData();
    setShowClearConfirm(false);
    window.location.reload();
  };

  // Weight Trend Line (SVG)
  const sortedWeights = [...weights].sort((a, b) => a.date.localeCompare(b.date));
  const minWeight = sortedWeights.length > 0 ? Math.min(...sortedWeights.map(w => w.weightKg)) - 1 : 60;
  const maxWeight = sortedWeights.length > 0 ? Math.max(...sortedWeights.map(w => w.weightKg)) + 1 : 75;
  const weightRange = maxWeight - minWeight || 1;

  const points = sortedWeights.map((w, idx) => {
    const x = sortedWeights.length === 1 ? 50 : (idx / (sortedWeights.length - 1)) * 260 + 20;
    const y = 90 - ((w.weightKg - minWeight) / weightRange) * 70;
    return `${x},${y}`;
  }).join(' ');

  // GUEST MODE ME TAB
  if (isGuest) {
    const hoursLeft = Math.max(0, Math.ceil(guestRemainingMs / (1000 * 60 * 60)));
    const h = Math.floor(guestRemainingMs / (1000 * 60 * 60));
    const m = Math.floor((guestRemainingMs % (1000 * 60 * 60)) / (1000 * 60));
    const s = Math.floor((guestRemainingMs % (1000 * 60)) / 1000);

    const lockedFeatures = [
      { label: 'Reports', icon: BarChart3 },
      { label: 'Weight tracking', icon: Scale },
      { label: 'Meal plans', icon: CalendarCheck },
      { label: 'Exercise log', icon: Flame },
      { label: 'Recipes', icon: BookOpen },
      { label: 'Saved foods', icon: Bookmark },
      { label: 'Streaks', icon: Award },
      { label: 'Export', icon: Download }
    ];

    return (
      <div className="space-y-5 pb-8 max-w-md mx-auto">
        {deletedBanner && (
          <div className="p-4 bg-teal-950/60 border border-teal-500/40 rounded-2xl text-xs text-teal-200 font-medium text-center">
            {deletedBanner}
          </div>
        )}

        <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-6 shadow-xl space-y-5 text-center">
          <div className="w-12 h-12 rounded-2xl bg-teal-500/15 border border-teal-500/30 flex items-center justify-center text-teal-400 mx-auto">
            <Clock className="w-6 h-6" />
          </div>

          <div className="space-y-1.5">
            <h2 className="font-display text-lg font-semibold text-zinc-100">
              Guest session — expires in {hoursLeft} {hoursLeft === 1 ? 'hour' : 'hours'}
            </h2>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-950 border border-zinc-800 font-mono text-sm font-bold text-teal-400">
              <span>
                {String(h).padStart(2, '0')}h : {String(m).padStart(2, '0')}m : {String(s).padStart(2, '0')}s
              </span>
            </div>
            <p className="text-xs text-zinc-400 pt-1">
              Sign up within 24 hours to keep everything you logged today and sync across devices.
            </p>
          </div>

          <button
            type="button"
            onClick={() => openAuthModal()}
            aria-label="Create your account"
            className="w-full min-h-[48px] py-3 bg-teal-500 hover:bg-teal-400 text-zinc-950 font-bold rounded-xl text-sm transition-colors shadow-lg shadow-teal-500/20"
          >
            Create your account
          </button>

          <div className="pt-4 border-t border-zinc-800 text-left space-y-3">
            <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 block">
              What you&apos;ll unlock
            </span>
            <div className="grid grid-cols-2 gap-2">
              {lockedFeatures.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.label}
                    className="p-2.5 rounded-xl bg-zinc-950/70 border border-zinc-800/80 flex items-center gap-2.5 text-zinc-500"
                  >
                    <Icon className="w-4 h-4 text-zinc-600 shrink-0" />
                    <span className="text-xs text-zinc-400">{item.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* #55 Dark / Light / Auto Theme Toggle */}
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 shadow-xl flex items-center justify-between">
          <span className="text-xs font-medium text-zinc-300">Appearance Theme</span>
          <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-lg border border-zinc-800">
            <button
              type="button"
              onClick={() => handleSetTheme('dark')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium flex items-center gap-1 transition-colors ${
                currentThemeMode === 'dark'
                  ? 'bg-teal-500 text-zinc-950 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Moon className="w-3 h-3" />
              Dark
            </button>
            <button
              type="button"
              onClick={() => handleSetTheme('light')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium flex items-center gap-1 transition-colors ${
                currentThemeMode === 'light'
                  ? 'bg-teal-500 text-zinc-950 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Sun className="w-3 h-3" />
              Light
            </button>
            <button
              type="button"
              onClick={() => handleSetTheme('auto')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium flex items-center gap-1 transition-colors ${
                currentThemeMode === 'auto'
                  ? 'bg-teal-500 text-zinc-950 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Clock className="w-3 h-3" />
              Auto
            </button>
          </div>
        </div>

        {/* Legal & Website Links */}
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 shadow-xl space-y-2">
          {onOpenDescription && (
            <button
              type="button"
              onClick={onOpenDescription}
              aria-label="View Caloriq landing page"
              className="w-full p-2.5 bg-zinc-950 hover:bg-zinc-850 border border-zinc-800 rounded-xl text-xs font-medium text-teal-300 flex items-center justify-center gap-2 transition-colors"
            >
              <Sparkles className="w-4 h-4 text-teal-400" />
              About Caloriq
            </button>
          )}
          <div className="grid grid-cols-2 gap-2">
            <a
              href="/privacy"
              onClick={(e) => {
                if (onOpenPrivacy) {
                  e.preventDefault();
                  onOpenPrivacy();
                }
              }}
              className="p-2.5 bg-zinc-950 hover:bg-zinc-850 border border-zinc-800 rounded-xl text-xs font-medium text-zinc-300 flex items-center justify-center gap-1.5 transition-colors"
            >
              <Shield className="w-3.5 h-3.5 text-teal-400" />
              Privacy Policy
            </a>
            <a
              href="/terms"
              onClick={(e) => {
                if (onOpenTerms) {
                  e.preventDefault();
                  onOpenTerms();
                }
              }}
              className="p-2.5 bg-zinc-950 hover:bg-zinc-850 border border-zinc-800 rounded-xl text-xs font-medium text-zinc-300 flex items-center justify-center gap-1.5 transition-colors"
            >
              <Lock className="w-3.5 h-3.5 text-teal-400" />
              Terms of Service
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-8 max-w-md mx-auto">
      {deletedBanner && (
        <div className="p-4 bg-teal-950/60 border border-teal-500/40 rounded-2xl text-xs text-teal-200 font-medium text-center">
          {deletedBanner}
        </div>
      )}
      {/* #42 "Why I started" Card — Pinned to the top of the Me tab */}
      <div className="bg-zinc-900/90 border border-teal-500/30 rounded-2xl p-4 shadow-xl space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Compass className="w-4 h-4 text-teal-400" />
            <h4 className="text-xs font-semibold uppercase tracking-wider text-teal-400">
              Why I Started
            </h4>
          </div>
          {!isEditingWhy && (
            <button
              type="button"
              onClick={() => setIsEditingWhy(true)}
              className="text-[11px] text-zinc-400 hover:text-teal-300 transition-colors"
            >
              Edit
            </button>
          )}
        </div>

        {isEditingWhy ? (
          <div className="space-y-2">
            <input
              type="text"
              value={whyText}
              onChange={(e) => setWhyText(e.target.value)}
              placeholder="Write your core reason once (e.g. Have steady energy for my family)..."
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-teal-500"
            />
            <div className="flex justify-end gap-2">
              {profile.pinnedWhy && (
                <button
                  type="button"
                  onClick={() => {
                    setWhyText(profile.pinnedWhy || '');
                    setIsEditingWhy(false);
                  }}
                  className="px-2.5 py-1 text-xs text-zinc-400 hover:text-zinc-200"
                >
                  Cancel
                </button>
              )}
              <button
                type="button"
                onClick={handleSaveWhy}
                className="px-3 py-1 bg-teal-500 hover:bg-teal-400 text-zinc-950 font-semibold rounded-lg text-xs"
              >
                Pin Reason
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm font-medium text-zinc-100 leading-relaxed">
            &ldquo;{profile.pinnedWhy}&rdquo;
          </p>
        )}
      </div>

      {/* Profile & Target Header Card */}
      <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-teal-400 flex items-center justify-center font-bold text-lg font-mono">
              {(formData.name || 'U').slice(0, 1).toUpperCase()}
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-100">{formData.name || 'Set up your profile'}</h3>
              <span className="text-xs text-zinc-500 font-mono">
                Level {stats.level} · {stats.xp} XP · {stats.foodStreak || 0}d streak
              </span>
            </div>
          </div>

          <div className="text-right">
            {isProfileComplete && currentTargetKcal > 0 ? (
              <>
                <span className="text-xl font-extrabold text-teal-400 font-mono block">
                  {currentTargetKcal}
                </span>
                <span className="text-[10px] text-zinc-500 uppercase">kcal / day</span>
              </>
            ) : (
              <button
                type="button"
                onClick={() => openAuthModal()}
                className="px-3 py-1.5 bg-teal-500 hover:bg-teal-400 text-zinc-950 font-semibold rounded-xl text-xs transition-colors"
              >
                Finish profile questions
              </button>
            )}
          </div>
        </div>

        {formData.gender === 'prefer_not_to_say' && (
          <div className="p-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-[11px] text-zinc-300">
            Gender is set to &ldquo;Prefer not to say&rdquo; — Caloriq is using the average of the male and female Mifflin-St Jeor calorie formulas.
          </div>
        )}

        {/* Calculated BMR, Maintenance, Macros & Projected Goal Date (only shown when all required questions are answered) */}
        {isProfileComplete && currentTargetKcal > 0 && (
          <>
            <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800 grid grid-cols-2 gap-2 text-center text-xs font-mono">
              <div>
                <span className="text-zinc-500 block text-[10px]">BMR (At Rest)</span>
                <span className="font-bold text-zinc-200">{currentBmrKcal} kcal</span>
              </div>
              <div>
                <span className="text-zinc-500 block text-[10px]">Maintenance</span>
                <span className="font-bold text-zinc-200">{currentMaintenanceKcal} kcal</span>
              </div>
            </div>

            <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800 grid grid-cols-3 gap-2 text-center text-xs font-mono">
              <div>
                <span className="text-zinc-500 block text-[10px]">Carbs (40%)</span>
                <span className="font-bold text-blue-400">{currentMacros.carbsGrams}g</span>
              </div>
              <div>
                <span className="text-zinc-500 block text-[10px]">Fat (30%)</span>
                <span className="font-bold text-amber-400">{currentMacros.fatGrams}g</span>
              </div>
              <div>
                <span className="text-zinc-500 block text-[10px]">Protein (30%)</span>
                <span className="font-bold text-red-400">{currentMacros.proteinGrams}g</span>
              </div>
            </div>

            {projectedGoalDate && (
              <div className="bg-teal-950/40 border border-teal-900/60 rounded-xl p-3 space-y-1.5 text-xs text-teal-300">
                <div className="flex items-start gap-2.5">
                  <TrendingDown className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="font-semibold">Projected Target Date:</span>
                      <span className="text-teal-200 font-mono">
                        {projectedGoalDetails.isMaintain ? '—' : projectedGoalDate}
                      </span>
                    </div>
                    {!projectedGoalDetails.isMaintain && projectedGoalDetails.calculationText && (
                      <p className="text-[11px] text-zinc-400">
                        {projectedGoalDetails.calculationText}
                      </p>
                    )}
                    {!projectedGoalDetails.isMaintain && (
                      <div className="flex items-center gap-2 text-[11px] text-teal-300/90">
                        <span>Based on your goal speed.</span>
                      </div>
                    )}
                    {!projectedGoalDetails.isMaintain && projectedGoalDetails.isCappedAtTwoYears && (
                      <p className="text-[11px] text-amber-300 font-medium">
                        Long-term trend — keep logging to refine.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* #6 Streak Freeze (1 per month) */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Shield className="w-4 h-4 text-teal-400 shrink-0" />
            <div>
              <span className="text-xs font-semibold text-zinc-200 block">Monthly Streak Freeze</span>
              <span className="text-[11px] text-zinc-500">
                {usedThisMonth
                  ? `Used this month (${usedThisMonth})`
                  : '1 available this month to protect a missed day'}
              </span>
            </div>
          </div>
          <button
            type="button"
            disabled={Boolean(usedThisMonth)}
            onClick={handleUseStreakFreeze}
            className="px-3 py-1.5 bg-teal-500/15 hover:bg-teal-500/25 disabled:opacity-40 border border-teal-500/30 text-teal-300 rounded-xl text-xs font-semibold transition-colors"
          >
            {usedThisMonth ? 'Protected' : 'Protect Missed Day'}
          </button>
        </div>

        {/* #55 Dark / Light / Auto Theme Toggle */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3 flex items-center justify-between">
          <span className="text-xs font-medium text-zinc-300">Appearance Theme</span>
          <div className="flex items-center gap-1 bg-zinc-900 p-1 rounded-lg border border-zinc-800">
            <button
              type="button"
              onClick={() => handleSetTheme('dark')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium flex items-center gap-1 transition-colors ${
                currentThemeMode === 'dark'
                  ? 'bg-teal-500 text-zinc-950 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Moon className="w-3 h-3" />
              Dark
            </button>
            <button
              type="button"
              onClick={() => handleSetTheme('light')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium flex items-center gap-1 transition-colors ${
                currentThemeMode === 'light'
                  ? 'bg-teal-500 text-zinc-950 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Sun className="w-3 h-3" />
              Light
            </button>
            <button
              type="button"
              onClick={() => handleSetTheme('auto')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium flex items-center gap-1 transition-colors ${
                currentThemeMode === 'auto'
                  ? 'bg-teal-500 text-zinc-950 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Clock className="w-3 h-3" />
              Auto
            </button>
          </div>
        </div>
      </div>

      {/* REFERRAL CODE CARD (+500 XP for both friends) */}
      <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-5 shadow-xl space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Gift className="w-4 h-4 text-teal-400" />
            <h4 className="text-sm font-semibold text-zinc-200">Referral Code (+500 XP)</h4>
          </div>
          <span className="text-[10px] font-mono text-teal-400">One-time use per friend</span>
        </div>

        <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3 flex items-center justify-between">
          <div>
            <span className="text-[10px] text-zinc-500 uppercase block">Your Invite Code</span>
            <span className="text-sm font-bold font-mono text-teal-300 tracking-wider">
              {myReferralCode}
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(myReferralCode);
              setCopiedRef(true);
              setTimeout(() => setCopiedRef(false), 2000);
            }}
            aria-label="Copy referral code"
            className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
          >
            {copiedRef ? <Check className="w-3.5 h-3.5 text-teal-400" /> : <Copy className="w-3.5 h-3.5" />}
            {copiedRef ? 'Copied' : 'Copy'}
          </button>
        </div>

        <form onSubmit={handleRedeemReferral} className="flex gap-2">
          <input
            type="text"
            value={friendCodeInput}
            onChange={(e) => setFriendCodeInput(e.target.value)}
            placeholder="Enter a friend's code for +500 XP..."
            className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 font-mono uppercase placeholder:normal-case placeholder:text-zinc-600 focus:outline-none focus:border-teal-500"
          />
          <button
            type="submit"
            aria-label="Redeem referral code"
            className="px-3 py-2 bg-teal-500 hover:bg-teal-400 text-zinc-950 font-semibold rounded-xl text-xs shrink-0 transition-colors"
          >
            Redeem
          </button>
        </form>

        {referralMsg && (
          <p className="text-[11px] text-teal-300 font-medium">{referralMsg}</p>
        )}
      </div>

      {saveStatus && (
        <div className="p-3 bg-teal-950/60 border border-teal-800/80 rounded-xl text-xs text-teal-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
          <span>{saveStatus}</span>
        </div>
      )}

      {/* #41 Non-Scale Victories */}
      <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-5 shadow-xl space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-teal-400" />
            <h4 className="text-sm font-semibold text-zinc-200">Non-Scale Victories</h4>
          </div>
          <span className="text-[11px] font-mono text-zinc-500">{victories.length} wins</span>
        </div>

        <form onSubmit={handleAddVictory} className="flex gap-2">
          <input
            type="text"
            value={newVictory}
            onChange={(e) => setNewVictory(e.target.value)}
            placeholder="e.g. Jeans fit better, ran 5k without stopping..."
            className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-teal-500"
          />
          <button
            type="submit"
            className="px-3 py-2 bg-teal-500 hover:bg-teal-400 text-zinc-950 font-semibold text-xs rounded-xl flex items-center gap-1 transition-colors shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Win
          </button>
        </form>

        {victories.length === 0 ? (
          <p className="text-xs text-zinc-500 text-center py-2">
            Record private milestones beyond the scale.
          </p>
        ) : (
          <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
            {victories.map((v) => (
              <SwipeableItem
                key={v.id}
                itemTitle={v.text}
                onSwipeLeftDelete={() => deleteVictoryItem(v.id)}
              >
                <div className="p-2.5 bg-zinc-950/70 border border-zinc-850 rounded-xl flex items-center justify-between text-xs">
                  <div>
                    <span className="text-zinc-200 font-medium block">{v.text}</span>
                    <span className="text-[10px] text-zinc-500 font-mono">{v.date}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteVictoryItem(v.id)}
                    aria-label={`Delete victory ${v.text}`}
                    className="p-1 text-zinc-600 hover:text-rose-400 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </SwipeableItem>
            ))}
          </div>
        )}
      </div>

      {/* Profile Settings Form */}
      <form onSubmit={handleSaveProfile} className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-zinc-200">Physiology & Goal Settings</h4>
          <button
            type="button"
            onClick={() => {
              const nextUnit = formData.unitSystem === 'metric' ? 'imperial' : 'metric';
              if (formData.heightCm > 0) {
                const converted = cmToFtIn(formData.heightCm);
                setHeightFtInput(converted.ft);
                setHeightInInput(converted.in);
              }
              setFormData(prev => ({
                ...prev,
                unitSystem: nextUnit
              }));
              updateUserProfile({ unitSystem: nextUnit });
            }}
            className="px-2.5 py-1 bg-zinc-950 border border-zinc-800 rounded-lg text-xs font-mono text-teal-400 hover:border-zinc-700 transition-colors"
          >
            {formData.unitSystem.toUpperCase()} UNITS
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Name</label>
            <input
              type="text"
              value={formData.name || ''}
              onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))}
              placeholder="Your name"
              required
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-teal-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Gender</label>
            <select
              value={formData.gender || ''}
              onChange={(e) => setFormData(p => ({ ...p, gender: e.target.value as any }))}
              required
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-teal-500"
            >
              <option value="">Select gender</option>
              <option value="female">Female (floor 1200 kcal)</option>
              <option value="male">Male (floor 1500 kcal)</option>
              <option value="prefer_not_to_say">Prefer not to say (average of both formulas)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Age</label>
            <input
              type="number"
              min="13"
              max="120"
              value={formData.age > 0 ? formData.age : ''}
              onChange={(e) => setFormData(p => ({ ...p, age: e.target.value ? Number(e.target.value) : 0 }))}
              placeholder="13–120"
              required
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-teal-500 font-mono"
            />
            {debouncedFormData.age > 0 && validateAge(debouncedFormData.age) && (
              <span className="text-[10px] text-rose-400 mt-1 block">
                {validateAge(debouncedFormData.age)}
              </span>
            )}
            {formData.age >= 13 && formData.age < 18 && (
              <span className="text-[10px] text-amber-400 mt-1 block">
                Use Caloriq with a parent or guardian.
              </span>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">
              Height ({formData.unitSystem === 'metric' ? 'cm' : 'ft / in'})
            </label>
            {formData.unitSystem === 'metric' ? (
              <>
                <input
                  type="number"
                  min="50"
                  max="250"
                  step="any"
                  value={formData.heightCm > 0 ? Math.round(formData.heightCm * 10) / 10 : ''}
                  onChange={(e) => {
                    const nextCm = e.target.value ? Number(e.target.value) : 0;
                    setFormData(p => ({ ...p, heightCm: nextCm }));
                    const converted = cmToFtIn(nextCm);
                    setHeightFtInput(converted.ft);
                    setHeightInInput(converted.in);
                  }}
                  placeholder="e.g. 165"
                  required
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-teal-500 font-mono"
                />
                {debouncedFormData.heightCm > 0 && validateHeightCm(debouncedFormData.heightCm) && (
                  <span className="text-[10px] text-rose-400 mt-1 block">
                    {validateHeightCm(debouncedFormData.heightCm)}
                  </span>
                )}
              </>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <div className="relative">
                    <input
                      type="number"
                      min="1"
                      max="8"
                      value={heightFtInput}
                      onChange={(e) => {
                        const nextFt = e.target.value;
                        setHeightFtInput(nextFt);
                        const ft = parseFloat(nextFt);
                        const inc = parseFloat(heightInInput || '0');
                        if (!nextFt && !heightInInput) {
                          setFormData(p => ({ ...p, heightCm: 0 }));
                          return;
                        }
                        const totalInches = (!isNaN(ft) ? ft * 12 : 0) + (!isNaN(inc) ? inc : 0);
                        const nextCm = totalInches > 0 ? Math.round(totalInches * 2.54 * 10) / 10 : 0;
                        setFormData(p => ({ ...p, heightCm: nextCm }));
                      }}
                      placeholder="ft"
                      aria-label="Height feet"
                      required
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-2.5 py-2 pr-7 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-teal-500 font-mono"
                    />
                    <span className="absolute right-2.5 top-2 text-[10px] font-mono text-zinc-500 pointer-events-none">
                      ft
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="11"
                      value={heightInInput}
                      onChange={(e) => {
                        const nextIn = e.target.value;
                        setHeightInInput(nextIn);
                        const ft = parseFloat(heightFtInput || '0');
                        const inc = parseFloat(nextIn || '0');
                        if (!heightFtInput && !nextIn) {
                          setFormData(p => ({ ...p, heightCm: 0 }));
                          return;
                        }
                        const totalInches = (!isNaN(ft) ? ft * 12 : 0) + (!isNaN(inc) ? inc : 0);
                        const nextCm = totalInches > 0 ? Math.round(totalInches * 2.54 * 10) / 10 : 0;
                        setFormData(p => ({ ...p, heightCm: nextCm }));
                      }}
                      placeholder="in"
                      aria-label="Height inches"
                      required
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-2.5 py-2 pr-7 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-teal-500 font-mono"
                    />
                    <span className="absolute right-2.5 top-2 text-[10px] font-mono text-zinc-500 pointer-events-none">
                      in
                    </span>
                  </div>
                </div>
                {heightFtInput !== '' && validateHeightImperial(heightFtInput, heightInInput || '0') && (
                  <span className="text-[10px] text-rose-400 mt-1 block">
                    {validateHeightImperial(heightFtInput, heightInInput || '0')}
                  </span>
                )}
              </>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">
              Current Weight ({formData.unitSystem === 'metric' ? 'kg' : 'lbs'})
            </label>
            <input
              type="number"
              step="0.1"
              min={formData.unitSystem === 'metric' ? 20 : 44}
              max={formData.unitSystem === 'metric' ? 500 : 1100}
              value={
                formData.currentWeightKg > 0
                  ? formData.unitSystem === 'metric'
                    ? formData.currentWeightKg
                    : Math.round(formData.currentWeightKg * 2.20462 * 10) / 10
                  : ''
              }
              onChange={(e) => {
                if (!e.target.value) {
                  setFormData(p => ({ ...p, currentWeightKg: 0 }));
                  return;
                }
                const val = parseFloat(e.target.value) || 0;
                const inKg = formData.unitSystem === 'metric' ? val : val / 2.20462;
                setFormData(p => ({ ...p, currentWeightKg: Math.round(inKg * 10) / 10 }));
              }}
              placeholder="e.g. 70"
              required
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-teal-500 font-mono"
            />
            {debouncedFormData.currentWeightKg > 0 &&
              validateWeight(
                debouncedFormData.unitSystem === 'metric'
                  ? debouncedFormData.currentWeightKg
                  : Math.round(debouncedFormData.currentWeightKg * 2.20462 * 10) / 10,
                debouncedFormData.unitSystem
              ) && (
                <span className="text-[10px] text-rose-400 mt-1 block">
                  {validateWeight(
                    debouncedFormData.unitSystem === 'metric'
                      ? debouncedFormData.currentWeightKg
                      : Math.round(debouncedFormData.currentWeightKg * 2.20462 * 10) / 10,
                    debouncedFormData.unitSystem
                  )}
                </span>
              )}
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">
              Goal Weight ({formData.unitSystem === 'metric' ? 'kg' : 'lbs'})
            </label>
            <input
              type="number"
              step="0.1"
              min={formData.unitSystem === 'metric' ? 20 : 44}
              max={formData.unitSystem === 'metric' ? 500 : 1100}
              value={
                formData.goalWeightKg > 0
                  ? formData.unitSystem === 'metric'
                    ? formData.goalWeightKg
                    : Math.round(formData.goalWeightKg * 2.20462 * 10) / 10
                  : ''
              }
              onChange={(e) => {
                if (!e.target.value) {
                  setFormData(p => ({ ...p, goalWeightKg: 0 }));
                  return;
                }
                const val = parseFloat(e.target.value) || 0;
                const inKg = formData.unitSystem === 'metric' ? val : val / 2.20462;
                setFormData(p => ({ ...p, goalWeightKg: Math.round(inKg * 10) / 10 }));
              }}
              placeholder=""
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-teal-500 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Body Fat % (optional)</label>
            <input
              type="number"
              min="3"
              max="60"
              value={formData.bodyFatPercent || ''}
              onChange={(e) => setFormData(p => ({ ...p, bodyFatPercent: e.target.value ? Number(e.target.value) : undefined }))}
              placeholder="e.g. 18 (uses Katch-McArdle)"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-teal-500 font-mono"
            />
            {debouncedFormData.bodyFatPercent !== undefined &&
              validateBodyFat(debouncedFormData.bodyFatPercent) && (
                <span className="text-[10px] text-rose-400 mt-1 block">
                  {validateBodyFat(debouncedFormData.bodyFatPercent)}
                </span>
              )}
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Fitness Level</label>
            <select
              value={formData.fitnessLevel || ''}
              onChange={(e) => setFormData(p => ({ ...p, fitnessLevel: e.target.value as any }))}
              required
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-teal-500"
            >
              <option value="">Select fitness level</option>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-1">Daily Activity Level</label>
          <select
            value={formData.dailyActivity || ''}
            onChange={(e) => setFormData(p => ({ ...p, dailyActivity: e.target.value as any }))}
            required
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-teal-500"
          >
            <option value="">Select your activity level</option>
            <option value="sedentary">Sedentary (1.2×) · Desk job, minimal walking</option>
            <option value="light">Lightly Active (1.375×) · 1-3 workouts / week</option>
            <option value="moderate">Moderately Active (1.55×) · 3-5 workouts / week</option>
            <option value="active">Very Active (1.725×) · 6-7 intense sessions</option>
            <option value="athlete">Athlete (1.9×) · Physical job + training</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-1">Goal</label>
          <select
            value={formData.goalSpeed || ''}
            onChange={(e) => {
              const nextSpeed = e.target.value as UserProfile['goalSpeed'];
              setLocalGoalSpeedOverride(true);
              setFormData((p) => ({
                ...p,
                goalSpeed: nextSpeed,
                goalSpeedOverriddenAt: Date.now()
              }));
            }}
            required
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-teal-500"
          >
            <option value="">Select your goal</option>
            <option value="lose_slow">Lose Slow (−250 kcal/day · ~0.25 kg/wk)</option>
            <option value="lose_normal">Lose fat — about 0.5 kg per week (−500 kcal/day)</option>
            <option value="lose_fast">Lose Fast (−750 kcal/day · ~0.75 kg/wk)</option>
            <option value="lose_aggressive">Lose faster — up to 1 kg/week (aggressive)</option>
            <option value="maintain">Maintain — eat at your maintenance (0 adjustment)</option>
            <option value="gain_slow">Build muscle — small lean surplus (+250 kcal/day)</option>
            <option value="gain_normal">Gain Normal (+500 kcal/day)</option>
          </select>
          <p className="text-[11px] text-zinc-400 mt-1.5 leading-relaxed">
            Only if you&apos;ve been losing at this rate already and feel well. Not recommended to start here.
          </p>
        </div>

        {profileError && (
          <div className="p-2.5 bg-rose-950/60 border border-rose-900/60 rounded-xl text-xs text-rose-300">
            {profileError}
          </div>
        )}

        <button
          type="submit"
          className="w-full bg-teal-500 hover:bg-teal-400 text-zinc-950 font-bold py-2.5 rounded-xl text-xs transition-colors shadow-lg shadow-teal-500/20"
        >
          Save Physiology Settings
        </button>
      </form>

      {/* WEIGHT LOG WITH TREND LINE */}
      <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Scale className="w-4 h-4 text-teal-400" />
            <h4 className="text-sm font-semibold text-zinc-200">Weight Progression</h4>
          </div>
          <span className="text-xs text-zinc-400 font-mono">
            {formData.currentWeightKg > 0 ? formatWeight(formData.currentWeightKg, formData.unitSystem) : '—'}
          </span>
        </div>

        {sortedWeights.length >= 2 ? (
          <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-850">
            <div className="h-28 w-full relative">
              <svg className="w-full h-full" viewBox="0 0 300 100" preserveAspectRatio="none">
                <line x1="0" y1="20" x2="300" y2="20" stroke="#27272a" strokeDasharray="3 3" />
                <line x1="0" y1="55" x2="300" y2="55" stroke="#27272a" strokeDasharray="3 3" />
                <line x1="0" y1="90" x2="300" y2="90" stroke="#27272a" strokeDasharray="3 3" />

                <polyline
                  fill="none"
                  stroke="#14b8a6"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={points}
                />

                {sortedWeights.map((w, idx) => {
                  const x = (idx / (sortedWeights.length - 1)) * 260 + 20;
                  const y = 90 - ((w.weightKg - minWeight) / weightRange) * 70;
                  return (
                    <circle
                      key={w.id}
                      cx={x}
                      cy={y}
                      r="4"
                      className="fill-teal-400 stroke-zinc-950 stroke-2"
                    />
                  );
                })}
              </svg>
            </div>
            <div className="flex justify-between text-[10px] text-zinc-500 font-mono mt-1 px-1">
              <span>{sortedWeights[0].date}</span>
              <span>{sortedWeights[sortedWeights.length - 1].date}</span>
            </div>
          </div>
        ) : (
          <p className="text-xs text-zinc-500 text-center py-3 bg-zinc-950/60 border border-zinc-800/80 rounded-xl">
            Log at least 2 weigh-ins to see the trend.
          </p>
        )}

        <form onSubmit={handleAddWeight} className="space-y-2">
          <div className="flex gap-2">
            <input
              type="date"
              min={minDate}
              max={maxDate}
              value={weightDate}
              onChange={(e) => setWeightDate(e.target.value)}
              required
              className="bg-zinc-950 border border-zinc-800 rounded-xl px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-teal-500 font-mono"
            />
            <input
              type="number"
              step="0.1"
              min={formData.unitSystem === 'metric' ? 20 : 44}
              max={formData.unitSystem === 'metric' ? 500 : 1100}
              value={newWeight}
              onChange={(e) => setNewWeight(e.target.value)}
              placeholder={`Weight in ${formData.unitSystem === 'metric' ? 'kg' : 'lbs'}`}
              required
              className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-teal-500 font-mono"
            />
            <button
              type="submit"
              className="px-3 py-1.5 bg-teal-500 hover:bg-teal-400 text-zinc-950 font-semibold text-xs rounded-xl flex items-center gap-1 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Log
            </button>
          </div>
          {(weightError || (debouncedNewWeight !== '' && validateWeight(debouncedNewWeight, formData.unitSystem))) && (
            <p className="text-xs text-rose-400">
              {weightError || validateWeight(debouncedNewWeight, formData.unitSystem)}
            </p>
          )}
        </form>

        {sortedWeights.length === 0 ? (
          <p className="text-xs text-zinc-500 text-center py-3 bg-zinc-950/40 border border-zinc-850 rounded-xl">
            No weigh-ins logged yet. Add your weight above to start tracking your progress.
          </p>
        ) : (
          <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
            {sortedWeights.slice().reverse().map((w) => (
              <SwipeableItem
                key={w.id}
                itemTitle={`Weight on ${w.date}`}
                onSwipeLeftDelete={() => deleteWeightLog(w.id)}
              >
                <div className="p-2 bg-zinc-950/70 border border-zinc-850 rounded-xl flex items-center justify-between text-xs font-mono">
                  <span className="text-zinc-400">{w.date}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-zinc-100 font-bold">
                      {formatWeight(w.weightKg, formData.unitSystem)}
                    </span>
                    <button
                      type="button"
                      onClick={() => deleteWeightLog(w.id)}
                      aria-label={`Delete weight entry on ${w.date}`}
                      className="p-1 text-zinc-600 hover:text-rose-400 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </SwipeableItem>
            ))}
          </div>
        )}
      </div>

      {/* XP & BADGES */}
      <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Award className="w-4 h-4 text-teal-400" />
            <h4 className="text-sm font-semibold text-zinc-200">Badges & Consistency</h4>
          </div>
          <span className="text-xs font-mono text-teal-400 font-bold">
            Level {stats.level} ({stats.xp} XP)
          </span>
        </div>

        {stats.badges.length === 0 && (
          <p className="text-xs text-zinc-500 bg-zinc-950/60 border border-zinc-800/80 rounded-xl p-2.5 text-center">
            No badges unlocked yet. Log your first meal, water glass, or weigh-in to earn your first badge.
          </p>
        )}

        <div className="grid grid-cols-2 gap-2">
          {BADGE_DEFINITIONS.map((badge) => {
            const prog = getBadgeProgress(badge.id);
            const isUnlocked = stats.badges.includes(badge.id) || prog.current >= prog.target;
            const pct = Math.min(100, Math.round((prog.current / prog.target) * 100));
            return (
              <div
                key={badge.id}
                className={`p-3 rounded-xl border transition-all flex flex-col justify-between gap-2 ${
                  isUnlocked
                    ? 'bg-zinc-950 border-teal-500/30'
                    : 'bg-zinc-950/60 border-zinc-800/80'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-1.5 mb-1">
                    <div className="flex items-center gap-1.5 truncate">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${isUnlocked ? 'bg-teal-400' : 'bg-zinc-600'}`} />
                      <span className={`text-xs font-semibold truncate ${isUnlocked ? 'text-zinc-100' : 'text-zinc-400'}`}>
                        {badge.title}
                      </span>
                    </div>
                    <span
                      className={`text-[9px] font-mono px-1.5 py-0.5 rounded shrink-0 ${
                        isUnlocked
                          ? 'bg-teal-500/15 text-teal-300 border border-teal-500/30'
                          : 'bg-zinc-900 text-zinc-500 border border-zinc-800'
                      }`}
                    >
                      {isUnlocked ? 'Unlocked' : 'Locked'}
                    </span>
                  </div>
                  <p className="text-[10px] text-zinc-500 leading-tight">
                    {badge.desc}
                  </p>
                </div>

                <div className="space-y-1 pt-1">
                  <div className="flex items-center justify-between text-[9px] font-mono text-zinc-400">
                    <span>Progress</span>
                    <span>
                      {prog.current} / {prog.target} {prog.unit}
                    </span>
                  </div>
                  <div className="w-full h-1 bg-zinc-900 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${isUnlocked ? 'bg-teal-400' : 'bg-zinc-600'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* #57 CUSTOM REMINDERS */}
      <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-5 shadow-xl space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-teal-400" />
            <h4 className="text-sm font-semibold text-zinc-200">Custom Daily Reminders</h4>
          </div>
          <span className="text-xs font-mono text-zinc-500">Coming soon.</span>
        </div>
        <p className="text-xs text-zinc-500">
          Coming soon.
        </p>
      </div>

      {/* #54 HOME SCREEN WIDGET & PWA INSTRUCTIONS */}
      <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-5 shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-teal-400" />
            <h4 className="text-sm font-semibold text-zinc-200">Home Screen App & Widget</h4>
          </div>
          <button
            type="button"
            onClick={() => setShowRecapModal(true)}
            className="text-[11px] text-teal-400 hover:underline flex items-center gap-1"
          >
            <Calendar className="w-3 h-3" />
            Weekly Recap
          </button>
        </div>
        <p className="text-xs text-zinc-400 leading-relaxed">
          Install Caloriq to your phone&apos;s home screen for one-tap offline logging and full-screen access:
        </p>
        <div className="grid grid-cols-1 gap-2 text-xs">
          <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3">
            <span className="font-semibold text-zinc-200 block mb-0.5">iOS (Safari)</span>
            <span className="text-zinc-400 text-[11px]">
              Tap the Share icon in the bottom bar, scroll down, and select &ldquo;Add to Home Screen&rdquo;.
            </span>
          </div>
          <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3">
            <span className="font-semibold text-zinc-200 block mb-0.5">Android (Chrome)</span>
            <span className="text-zinc-400 text-[11px]">
              Tap the three-dot menu in the top right and select &ldquo;Add to Home screen&rdquo; or &ldquo;Install app&rdquo;.
            </span>
          </div>
        </div>
      </div>

      <WeeklyRecapModal
        forceOpen={showRecapModal}
        onCloseForce={() => setShowRecapModal(false)}
      />

      {/* PHASE 5: SOCIAL & ACCOUNTABILITY (#43, #44, #45, #46, #47) */}
      <SocialAccountabilitySection />

      {/* #53, #55, #56, #58 ACCOUNT SECURITY & ACTIVE SESSIONS */}
      {!isGuest && (
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-teal-400" />
              <div>
                <h4 className="text-sm font-semibold text-zinc-200">Account Security &amp; Sessions</h4>
                <span className="text-[11px] text-zinc-400 block">
                  Signed in as @{activeUsername} · Last signed in {formattedLastSignedIn}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setShowUsernameChange((v) => !v);
                setShowPasswordChange(false);
              }}
              aria-label="Change account username"
              className="p-2.5 bg-zinc-950 hover:bg-zinc-850 border border-zinc-800 rounded-xl text-xs font-medium text-zinc-200 flex items-center justify-center gap-1.5 transition-colors"
            >
              <User className="w-3.5 h-3.5 text-teal-400" />
              Change Username
            </button>
            <button
              type="button"
              onClick={() => {
                setShowPasswordChange((v) => !v);
                setShowUsernameChange(false);
              }}
              aria-label="Change account password"
              className="p-2.5 bg-zinc-950 hover:bg-zinc-850 border border-zinc-800 rounded-xl text-xs font-medium text-zinc-200 flex items-center justify-center gap-1.5 transition-colors"
            >
              <KeyRound className="w-3.5 h-3.5 text-teal-400" />
              Change Password
            </button>
          </div>

          {/* #55 Username Change Form */}
          {showUsernameChange && (
            <div className="p-3.5 bg-zinc-950 border border-zinc-800 rounded-xl space-y-3">
              <h5 className="text-xs font-bold text-zinc-200">Change Username</h5>
              <div className="space-y-2">
                <input
                  type="password"
                  value={usernameChangeCurrentPwd}
                  onChange={(e) => setUsernameChangeCurrentPwd(e.target.value)}
                  placeholder="Current password"
                  aria-label="Current password for username change"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-100"
                />
                <input
                  type="text"
                  value={usernameChangeNewUsername}
                  onChange={(e) => setUsernameChangeNewUsername(e.target.value)}
                  placeholder="New username"
                  aria-label="New username"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-100"
                />
                <button
                  type="button"
                  onClick={async () => {
                    setUsernameChangeStatus(null);
                    try {
                      const res = await api.changeUsername(usernameChangeCurrentPwd, usernameChangeNewUsername);
                      await updateUserProfile({ username: res.username });
                      setUsernameChangeStatus(res.message);
                      setUsernameChangeCurrentPwd('');
                      setUsernameChangeNewUsername('');
                    } catch (err: any) {
                      setUsernameChangeStatus(err?.message || 'Failed to update username.');
                    }
                  }}
                  className="w-full py-2 bg-teal-500 hover:bg-teal-400 text-zinc-950 font-bold rounded-lg text-xs"
                >
                  Update Username
                </button>
              </div>
              {usernameChangeStatus && (
                <p role="status" aria-live="polite" className="text-[11px] text-teal-300">
                  {usernameChangeStatus}
                </p>
              )}
            </div>
          )}

          {/* #56 Password Change Form */}
          {showPasswordChange && (
            <div className="p-3.5 bg-zinc-950 border border-zinc-800 rounded-xl space-y-2.5">
              <h5 className="text-xs font-bold text-zinc-200">Change Password</h5>
              <input
                type="password"
                value={currentPasswordInput}
                onChange={(e) => setCurrentPasswordInput(e.target.value)}
                placeholder="Current password"
                aria-label="Current password"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-100"
              />
              <input
                type="password"
                value={newPasswordInput}
                onChange={(e) => setNewPasswordInput(e.target.value)}
                placeholder="New password (at least 6 characters)"
                aria-label="New password"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-100"
              />
              <button
                type="button"
                onClick={async () => {
                  setPasswordChangeStatus(null);
                  try {
                    const res = await api.changePassword(currentPasswordInput, newPasswordInput);
                    setPasswordChangeStatus(res.message);
                    setCurrentPasswordInput('');
                    setNewPasswordInput('');
                  } catch (err: any) {
                    setPasswordChangeStatus(err?.message || 'Could not update password.');
                  }
                }}
                className="w-full py-2 bg-teal-500 hover:bg-teal-400 text-zinc-950 font-bold rounded-lg text-xs"
              >
                Update Password
              </button>
              {passwordChangeStatus && (
                <p role="status" aria-live="polite" className="text-[11px] text-teal-300">
                  {passwordChangeStatus}
                </p>
              )}
            </div>
          )}

          {/* #58 Active Sessions List */}
          <div className="space-y-2 pt-2 border-t border-zinc-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-300">Signed-In Devices</span>
              {sessionsList.length > 1 && (
                <button
                  type="button"
                  onClick={async () => {
                    await api.revokeAllSessions(true);
                    const res = await api.getSessions();
                    setSessionsList(res.sessions || []);
                  }}
                  className="text-[11px] text-rose-400 hover:text-rose-300 underline"
                >
                  Sign out all other devices
                </button>
              )}
            </div>
            <div className="space-y-1.5">
              {sessionsList.map((sess) => (
                <div
                  key={sess.id}
                  className="p-2.5 bg-zinc-950 border border-zinc-800 rounded-xl flex items-center justify-between gap-2 text-xs"
                >
                  <div>
                    <span className="font-semibold text-zinc-200 block">
                      {sess.deviceLabel} {sess.isCurrent ? '(This device)' : ''}
                    </span>
                    <span className="text-[10px] font-mono text-zinc-400">
                      Active{' '}
                      {(() => {
                        const raw = sess.lastActiveAt || sess.createdAt;
                        const num = Number(raw);
                        const d = !Number.isNaN(num) && num > 0 ? new Date(num) : new Date(String(raw));
                        return !Number.isNaN(d.getTime()) ? d.toLocaleDateString() : 'recently';
                      })()}
                    </span>
                  </div>
                  {!sess.isCurrent && (
                    <button
                      type="button"
                      onClick={async () => {
                        await api.revokeSession(sess.id);
                        setSessionsList((prev) => prev.filter((s) => s.id !== sess.id));
                      }}
                      className="px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 rounded-lg text-[11px] text-zinc-300"
                    >
                      Sign out
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* #62 REPORT A BUG FORM */}
      <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-5 shadow-xl space-y-3">
        <div className="flex items-center gap-2">
          <Bug className="w-4 h-4 text-teal-400" />
          <div>
            <h4 className="text-sm font-semibold text-zinc-200">Report a bug</h4>
            <span className="text-[11px] text-zinc-400">
              Automatically includes your browser, OS, screen size, current route, and recent console errors.
            </span>
          </div>
        </div>
        <form onSubmit={handleSubmitBugReport} className="space-y-2.5">
          <textarea
            rows={2}
            value={bugDescription}
            onChange={(e) => setBugDescription(e.target.value)}
            placeholder="Describe what happened and what you expected..."
            aria-label="Describe the bug"
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-teal-500 resize-none"
          />
          <button
            type="submit"
            disabled={isSendingBug || !bugDescription.trim()}
            className="w-full py-2 bg-zinc-950 hover:bg-zinc-850 disabled:opacity-50 border border-teal-500/40 text-teal-300 font-semibold rounded-xl text-xs transition-colors"
          >
            {isSendingBug ? 'Sending report...' : 'Submit Bug Report'}
          </button>
          {bugStatus && (
            <p role="status" aria-live="polite" className="text-xs text-teal-300">
              {bugStatus}
            </p>
          )}
        </form>
      </div>

      {/* DATA MANAGEMENT */}
      <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-5 shadow-xl space-y-3">
        <h4 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
          Data & Privacy Management
        </h4>

        <div className="flex flex-col gap-2">
          {onOpenDescription && (
            <button
              onClick={onOpenDescription}
              className="w-full p-2.5 bg-zinc-950 hover:bg-zinc-850 border border-teal-500/30 rounded-xl text-xs font-medium text-teal-300 flex items-center justify-center gap-2 transition-colors"
            >
              <Sparkles className="w-4 h-4 text-teal-400" />
              About Caloriq
            </button>
          )}

          <div className="grid grid-cols-2 gap-2">
            <a
              href="/privacy"
              onClick={(e) => {
                if (onOpenPrivacy) {
                  e.preventDefault();
                  onOpenPrivacy();
                }
              }}
              className="w-full p-2.5 bg-zinc-950 hover:bg-zinc-850 border border-zinc-800 rounded-xl text-xs font-medium text-zinc-300 flex items-center justify-center gap-2 transition-colors"
            >
              <Shield className="w-4 h-4 text-teal-400" />
              Privacy Policy
            </a>

            <a
              href="/terms"
              onClick={(e) => {
                if (onOpenTerms) {
                  e.preventDefault();
                  onOpenTerms();
                }
              }}
              className="w-full p-2.5 bg-zinc-950 hover:bg-zinc-850 border border-zinc-800 rounded-xl text-xs font-medium text-zinc-300 flex items-center justify-center gap-2 transition-colors"
            >
              <Lock className="w-4 h-4 text-teal-400" />
              Terms of Service
            </a>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleExportData}
              aria-label="Export data as JSON"
              className="w-full p-2.5 bg-zinc-950 hover:bg-zinc-850 border border-zinc-800 rounded-xl text-xs font-medium text-zinc-300 flex items-center justify-center gap-2 transition-colors"
            >
              <Download className="w-4 h-4 text-teal-400" />
              Export JSON
            </button>

            <label className="w-full p-2.5 bg-zinc-950 hover:bg-zinc-850 border border-zinc-800 rounded-xl text-xs font-medium text-zinc-300 flex items-center justify-center gap-2 transition-colors cursor-pointer">
              <Upload className="w-4 h-4 text-teal-400" />
              <span>Restore JSON</span>
              <input
                type="file"
                accept=".json,application/json"
                onChange={handleImportBackupFile}
                aria-label="Restore backup from JSON file"
                className="sr-only"
              />
            </label>
          </div>

          {backupImportStatus && (
            <p role="status" aria-live="polite" className="text-xs text-teal-300 text-center">
              {backupImportStatus}
            </p>
          )}

          <button
            type="button"
            onClick={() => setShowClearConfirm(true)}
            aria-label="Clear all data"
            className="w-full p-2.5 bg-zinc-950 hover:bg-zinc-850 border border-zinc-800 rounded-xl text-xs font-medium text-amber-300 flex items-center justify-center gap-2 transition-colors"
          >
            <Trash2 className="w-4 h-4 text-amber-400" />
            Clear all data
          </button>

          {/* #18 & #43 Two-Step Account Deletion with Password Confirmation */}
          {deleteStep === 0 ? (
            <button
              type="button"
              onClick={() => setDeleteStep(1)}
              aria-label="Delete account"
              className="w-full min-h-[44px] p-2.5 bg-rose-950/20 hover:bg-rose-950/40 border border-rose-900/40 text-rose-300 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              Delete account?
            </button>
          ) : (
            <div className="p-3 bg-rose-950/30 border border-rose-500/50 rounded-xl space-y-2.5">
              <p className="text-xs text-rose-200 font-medium text-center">
                Are you sure? This permanently deletes your account and all your data.
              </p>
              {!isGuest && (
                <input
                  type="password"
                  value={deletePasswordConfirm}
                  onChange={(e) => setDeletePasswordConfirm(e.target.value)}
                  placeholder="Enter your password (or type DELETE) to confirm"
                  aria-label="Confirm password to delete account"
                  className="w-full bg-zinc-950 border border-rose-500/40 rounded-lg px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-500"
                />
              )}
              {deleteError && (
                <p role="alert" className="text-xs text-rose-300 text-center">
                  {deleteError}
                </p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handlePermanentDeleteAccount}
                  aria-label="Yes, delete everything permanently"
                  className="flex-1 min-h-[44px] py-2 px-3 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs transition-colors shadow-lg shadow-rose-600/30"
                >
                  Yes, delete everything permanently.
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDeleteStep(0);
                    setDeletePasswordConfirm('');
                    setDeleteError(null);
                  }}
                  aria-label="Cancel account deletion"
                  className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <SecretFooter className="pt-2 text-center text-[11px] font-mono text-zinc-400" />
        </div>
      </div>

      {/* #18 Two-step confirmation for clearing all data */}
      <ConfirmDialog
        isOpen={showClearConfirm}
        title="Clear All Tracking Data?"
        description="This will delete all logged meals, exercises, weights, and recipes. This action cannot be undone."
        confirmLabel="Continue"
        secondStepLabel="Yes, Clear All Data"
        twoStep={true}
        isDestructive={true}
        onConfirm={handleConfirmClear}
        onCancel={() => setShowClearConfirm(false)}
      />
    </div>
  );
};
