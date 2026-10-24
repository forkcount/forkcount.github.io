import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Mail,
  Lock,
  User,
  ArrowRight,
  ArrowLeft,
  X,
  Check,
  Eye,
  EyeOff,
  Search,
  Sparkles,
  Scale,
  Heart,
  Activity,
  AlertCircle,
  Shield
} from 'lucide-react';
import { api } from '../services/api.js';
import { trackEvent } from '../utils/analytics.js';
import { useApp } from '../context/AppContext.js';
import { COUNTRIES, CountryOption } from '../utils/countries.js';
import {
  hasCompleteProfileStats,
  calculateBmr,
  calculateMaintenanceCalories,
  calculateDailyCalorieTarget,
  calculateMacroTargets
} from '../utils/nutritionMath.js';
import {
  useDebounce,
  validateAge,
  validateHeightCm,
  validateWeight,
  getPasswordStrength,
  getSafeRedirectUrl
} from '../utils/validation.js';
import type { UserProfile } from '../types/index.js';

import { supabase } from '../services/supabase.js';

const GoogleIcon: React.FC<{ className?: string }> = ({ className = 'size-4' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none">
    <path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      fill="#4285F4"
    />
    <path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      fill="#34A853"
    />
    <path
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      fill="#FBBC05"
    />
    <path
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      fill="#EA4335"
    />
  </svg>
);

const FacebookIcon: React.FC<{ className?: string }> = ({ className = 'size-4' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
  </svg>
);

interface AuthModalProps {
  onAuthComplete?: () => void;
}

type AuthFlowStage =
  | 'credentials'
  | 'check_email'
  | 'choose_username'
  | 'forgot_password'
  | 'step1_basic'
  | 'step2_body'
  | 'step3_lifestyle'
  | 'step4_targets';

export const AuthModal: React.FC<AuthModalProps> = ({ onAuthComplete }) => {
  const {
    userId,
    isAuthModalOpen,
    authModalMode,
    closeAuthModal,
    onAuthSuccess,
    profile,
    updateUserProfile,
    addWeightLog,
    signOutUser
  } = useApp();

  const handleCloseModal = async () => {
    // 1. Cancel in-progress signup (do not leave partial account in database or localStorage)
    const isIncompleteSignup = flowStage.startsWith('step') || mode === 'signup';
    if (isIncompleteSignup) {
      if (userId && !userId.startsWith('guest_')) {
        try {
          await api.deleteAccount().catch(() => {});
        } catch (err) {
          console.warn('Failed to delete incomplete account on cancel:', err);
        }
      }
      try {
        await signOutUser();
      } catch (err) {
        console.warn('signOutUser on cancel error:', err);
      }
      try {
        api.logout();
      } catch (err) {
        console.warn('api.logout on cancel error:', err);
      }
    } else {
      if (!userId || userId.startsWith('guest_')) {
        try {
          api.logout();
        } catch {}
      }
    }

    // 2. Clear all partial form state
    setUsername('');
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setShowConfirmPassword(false);
    setErrorMsg('');
    setResetEmail('');
    setResetCode('');
    setNewResetPassword('');
    setResetStage('request');
    setResetSentSuccess(false);
    setCountry('');
    setCountrySearch('');
    setIsCountryDropdownOpen(false);
    setName('');
    setGender('');
    setAge('');
    setHeightCm('');
    setCurrentWeightKg('');
    setGoalWeightKg('');
    setBodyFatPercent('');
    setFitnessLevel('');
    setDailyActivity('');
    setGoal('');
    setEmail('');
    setIsResending(false);
    setResendSuccess(false);
    setFlowStage('credentials');

    // 3. Close the modal
    closeAuthModal();

    // 4. Redirect to "/" (landing page), not /dashboard or /diary
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', '/');
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

  const [mode, setMode] = useState<'signup' | 'login'>(authModalMode || 'login');

  // Credentials State
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [honeypot, setHoneypot] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isResending, setIsResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);

  // Password reset state
  const [resetEmail, setResetEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newResetPassword, setNewResetPassword] = useState('');
  const [resetStage, setResetStage] = useState<'request' | 'confirm'>('request');
  const [resetSentSuccess, setResetSentSuccess] = useState(false);

  // Flow State
  const [flowStage, setFlowStage] = useState<AuthFlowStage>('credentials');

  // Step 1: Basic info
  const [country, setCountry] = useState('');
  const [countrySearch, setCountrySearch] = useState('');
  const [isCountryDropdownOpen, setIsCountryDropdownOpen] = useState(false);
  const [name, setName] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | 'other' | 'prefer_not_to_say' | ''>('');
  const [age, setAge] = useState('');

  // Step 2: Body
  const [heightCm, setHeightCm] = useState('');
  const [currentWeightKg, setCurrentWeightKg] = useState('');
  const [goalWeightKg, setGoalWeightKg] = useState('');
  const [bodyFatPercent, setBodyFatPercent] = useState('');

  // Step 3: Lifestyle
  const [fitnessLevel, setFitnessLevel] = useState<'beginner' | 'intermediate' | 'advanced' | ''>('');
  const [dailyActivity, setDailyActivity] = useState<'sedentary' | 'light' | 'moderate' | 'active' | 'athlete' | ''>('');
  const [goal, setGoal] = useState<'lose' | 'maintain' | 'gain' | 'recomp' | ''>('');
  const [hasMetabolicCondition, setHasMetabolicCondition] = useState(false);

  const countryDropdownRef = useRef<HTMLDivElement>(null);

  // Reset/sync flow when modal opens
  useEffect(() => {
    if (isAuthModalOpen) {
      setErrorMsg('');
      if (authModalMode) {
        setMode(authModalMode);
      }
      // If user is already logged in but has an incomplete profile, open directly to step1
      if (userId && !userId.startsWith('guest_') && !profile?.isDev && !hasCompleteProfileStats(profile)) {
        setFlowStage('step1_basic');
      } else {
        setFlowStage('credentials');
      }
    }
  }, [isAuthModalOpen, authModalMode, userId, profile]);

  // Close country dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (countryDropdownRef.current && !countryDropdownRef.current.contains(e.target as Node)) {
        setIsCountryDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredCountries = useMemo(() => {
    if (!countrySearch.trim()) return COUNTRIES;
    const q = countrySearch.toLowerCase();
    return COUNTRIES.filter((c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q));
  }, [countrySearch]);

  // Validation Checks for Step 1
  const isStep1Valid = useMemo(() => {
    const ageNum = parseInt(age, 10);
    return (
      country.trim().length > 0 &&
      name.trim().length > 0 &&
      gender !== '' &&
      !isNaN(ageNum) &&
      ageNum >= 13 &&
      ageNum <= 120
    );
  }, [country, name, gender, age]);

  // Validation Checks for Step 2
  const isStep2Valid = useMemo(() => {
    const h = parseFloat(heightCm);
    const cw = parseFloat(currentWeightKg);
    const gw = parseFloat(goalWeightKg);
    const bf = bodyFatPercent.trim() ? parseFloat(bodyFatPercent) : null;

    return (
      !isNaN(h) &&
      h >= 50 &&
      h <= 260 &&
      !isNaN(cw) &&
      cw >= 20 &&
      cw <= 400 &&
      !isNaN(gw) &&
      gw >= 20 &&
      gw <= 400 &&
      (bf === null || (!isNaN(bf) && bf >= 3 && bf <= 70))
    );
  }, [heightCm, currentWeightKg, goalWeightKg, bodyFatPercent]);

  // Validation Checks for Step 3
  const isStep3Valid = useMemo(() => {
    return fitnessLevel !== '' && dailyActivity !== '' && goal !== '';
  }, [fitnessLevel, dailyActivity, goal]);

  // Previews for Step 4
  const previewProfile: UserProfile = useMemo(() => {
    const ageNum = parseInt(age, 10) || 25;
    const heightNum = parseFloat(heightCm) || 170;
    const currentWeightNum = parseFloat(currentWeightKg) || 70;
    const goalWeightNum = parseFloat(goalWeightKg) || 70;
    const bodyFatNum = bodyFatPercent.trim() ? parseFloat(bodyFatPercent) : undefined;
    let goalSpeed: 'lose_normal' | 'maintain' | 'gain_normal' | 'recomp' = 'maintain';
    if (goal === 'lose') goalSpeed = 'lose_normal';
    else if (goal === 'gain') goalSpeed = 'gain_normal';
    else if (goal === 'recomp') goalSpeed = 'recomp';

    return {
      name: name.trim() || 'User',
      username: username.trim() || 'user',
      country: country.trim() || 'US',
      age: ageNum,
      gender: gender || 'prefer_not_to_say',
      heightCm: heightNum,
      currentWeightKg: currentWeightNum,
      goalWeightKg: goalWeightNum,
      bodyFatPercent: bodyFatNum,
      fitnessLevel: fitnessLevel || 'beginner',
      dailyActivity: dailyActivity || 'moderate',
      goal: goal || 'maintain',
      goalSpeed,
      unitSystem: 'metric',
      signupComplete: true,
      hasMetabolicCondition,
      lastCalculationWeightKg: currentWeightNum
    };
  }, [name, username, country, age, gender, heightCm, currentWeightKg, goalWeightKg, bodyFatPercent, fitnessLevel, dailyActivity, goal, hasMetabolicCondition]);

  const previewBmr = useMemo(() => calculateBmr(previewProfile), [previewProfile]);
  const previewTdee = useMemo(() => calculateMaintenanceCalories(previewProfile), [previewProfile]);
  const previewTarget = useMemo(() => calculateDailyCalorieTarget(previewProfile), [previewProfile]);
  const previewMacros = useMemo(() => {
    const cw = parseFloat(currentWeightKg) || undefined;
    const bf = bodyFatPercent.trim() ? parseFloat(bodyFatPercent) : undefined;
    return calculateMacroTargets(previewTarget, goal, cw, bf);
  }, [previewTarget, goal, currentWeightKg, bodyFatPercent]);

  // Handle Credentials Submit
  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (honeypot.trim().length > 0) return;

    const cleanUsername = username.trim().toLowerCase().replace(/^@/, '');
    if (!cleanUsername || cleanUsername.length < 2) {
      setErrorMsg('Please enter a valid username (at least 2 characters).');
      return;
    }

    const effectivePassword = mode === 'login' ? password.trim() : password;
    const minPassLen = mode === 'login' ? 4 : 6;
    if (!effectivePassword || effectivePassword.length < minPassLen) {
      setErrorMsg(`Password must be at least ${minPassLen} characters.`);
      return;
    }

    if (mode === 'signup') {
      const cleanEmail = email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        setErrorMsg('Please enter a valid email address.');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMsg('Passwords do not match.');
        return;
      }
    }

    setErrorMsg('');
    setIsLoading(true);

    try {
      if (mode === 'signup') {
        const cleanEmail = email.trim().toLowerCase();
        const signupRes = await api.signup(cleanUsername, cleanEmail, password, rememberMe, confirmPassword, honeypot);
        trackEvent('signup');
        if (!signupRes.needsEmailVerification && signupRes.session) {
          await onAuthSuccess();
          setFlowStage('step1_basic');
        } else {
          setFlowStage('check_email');
        }
      } else {
        await api.login(username.trim(), effectivePassword, rememberMe);
        await onAuthSuccess();
        const freshProfile = await api.getProfile();
        if (freshProfile.profile?.isDev || hasCompleteProfileStats(freshProfile.profile)) {
          closeAuthModal();
          if (onAuthComplete) onAuthComplete();
        } else {
          // Incomplete profile -> guide through onboarding
          setFlowStage('step1_basic');
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Authentication failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleOAuth = async () => {
    setErrorMsg('');
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin + '/dashboard' }
      });
      if (error) throw error;
    } catch (err: any) {
      setErrorMsg(err.message || 'Google sign in failed');
    }
  };

  const handleFacebookOAuth = async () => {
    setErrorMsg('');
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'facebook',
        options: { redirectTo: window.location.origin + '/dashboard' }
      });
      if (error) throw error;
    } catch (err: any) {
      setErrorMsg(err.message || 'Facebook sign in failed');
    }
  };

  const handleChooseUsernameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUsername = username.trim().toLowerCase().replace(/^@/, '');
    if (!cleanUsername || cleanUsername.length < 2) {
      setErrorMsg('Please enter a valid username (at least 2 characters).');
      return;
    }
    setIsLoading(true);
    setErrorMsg('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const currentUserId = session?.user?.id || userId;
      const currentEmail = session?.user?.email || '';
      const provider = (session?.user?.app_metadata?.provider as string) || 'google';
      const signup_method = provider === 'facebook' ? 'facebook' : provider === 'google' ? 'google' : 'email';

      const { error } = await supabase.from('profiles').upsert({
        id: currentUserId,
        username: cleanUsername,
        name: session?.user?.user_metadata?.full_name || cleanUsername,
        email: currentEmail,
        signup_method,
        updated_at: new Date().toISOString()
      });
      if (error) throw error;

      setFlowStage('step1_basic');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to set username. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Onboarding Completion
  const handleFinishOnboarding = async () => {
    if (!isStep1Valid || !isStep2Valid || !isStep3Valid) {
      setErrorMsg('Please complete all required fields.');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');

    try {
      const ageNum = parseInt(age, 10);
      const heightNum = parseFloat(heightCm);
      const currentWeightNum = parseFloat(currentWeightKg);
      const goalWeightNum = parseFloat(goalWeightKg);
      const bodyFatNum = bodyFatPercent.trim() ? parseFloat(bodyFatPercent) : undefined;

      let goalSpeed: 'lose_normal' | 'maintain' | 'gain_normal' | 'recomp' = 'maintain';
      if (goal === 'lose') goalSpeed = 'lose_normal';
      else if (goal === 'gain') goalSpeed = 'gain_normal';
      else if (goal === 'recomp') goalSpeed = 'recomp';

      const tempProfile: UserProfile = {
        name: name.trim(),
        username: username.trim() || profile.username || 'user',
        country: country.trim(),
        age: ageNum,
        gender,
        heightCm: heightNum,
        currentWeightKg: currentWeightNum,
        goalWeightKg: goalWeightNum,
        bodyFatPercent: bodyFatNum,
        fitnessLevel,
        dailyActivity,
        goal,
        goalSpeed,
        unitSystem: 'metric',
        signupComplete: true,
        hasMetabolicCondition,
        lastCalculationWeightKg: currentWeightNum
      };

      const bmr = calculateBmr(tempProfile);
      const tdee = calculateMaintenanceCalories(tempProfile);
      const targetCalories = calculateDailyCalorieTarget(tempProfile);
      const macroTarget = calculateMacroTargets(targetCalories, goal, currentWeightNum, bodyFatNum);

      const fullProfile: Partial<UserProfile> = {
        ...tempProfile,
        bmr,
        tdee,
        targetCalories,
        macroTarget
      };

      // 1. Update database & AppContext profile
      await updateUserProfile(fullProfile);

      // 2. Add starting weight record
      try {
        await addWeightLog(currentWeightNum, new Date().toISOString().slice(0, 10));
      } catch {
        // ignore if weight record already exists
      }

      trackEvent('onboarding_completed' as any);

      // 3. Navigate to dashboard
      closeAuthModal();
      if (typeof window !== 'undefined') {
        window.history.pushState({}, '', '/dashboard');
        window.dispatchEvent(new PopStateEvent('popstate'));
      }
      if (onAuthComplete) onAuthComplete();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save profile. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isAuthModalOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-4 backdrop-blur-sm animate-fadeIn h-[100dvh] max-h-[100dvh] overflow-hidden"
    >
      <div className="relative w-full max-w-lg max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2rem)] rounded-3xl border border-zinc-800 bg-zinc-900/95 p-5 sm:p-7 shadow-2xl flex flex-col my-auto overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800 shrink-0">
          <div>
            <h2 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
              <span className="size-2 rounded-full bg-teal-400" />
              {flowStage === 'credentials'
                ? mode === 'signup'
                  ? 'Create account'
                  : 'Welcome back'
                : flowStage === 'forgot_password'
                ? 'Reset password'
                : flowStage === 'check_email'
                ? 'Check your email'
                : flowStage === 'choose_username'
                ? 'Choose your username'
                : 'Set up your profile'}
            </h2>
            {flowStage.startsWith('step') && (
              <p className="text-xs text-teal-400 font-medium mt-1">
                Step{' '}
                {flowStage === 'step1_basic'
                  ? '1'
                  : flowStage === 'step2_body'
                  ? '2'
                  : flowStage === 'step3_lifestyle'
                  ? '3'
                  : '4'}{' '}
                of 4:{' '}
                {flowStage === 'step1_basic'
                  ? 'Basic Info'
                  : flowStage === 'step2_body'
                  ? 'Body Stats'
                  : flowStage === 'step3_lifestyle'
                  ? 'Lifestyle & Goals'
                  : 'Personalized Targets'}
              </p>
            )}
          </div>
          <button
            onClick={handleCloseModal}
            className="rounded-xl p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
            aria-label="Close"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Progress Bar for Steps */}
        {flowStage.startsWith('step') && (
          <div className="my-3 h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden shrink-0">
            <div
              className="h-full bg-teal-500 transition-all duration-300"
              style={{
                width:
                  flowStage === 'step1_basic'
                    ? '25%'
                    : flowStage === 'step2_body'
                    ? '50%'
                    : flowStage === 'step3_lifestyle'
                    ? '75%'
                    : '100%'
              }}
            />
          </div>
        )}

        {errorMsg && (
          <div className="my-2 rounded-xl border border-red-500/30 bg-red-500/10 p-2.5 text-xs text-red-300 shrink-0">
            {errorMsg}
          </div>
        )}

        {/* 1. Credentials Screen */}
        {flowStage === 'credentials' && (
          <form onSubmit={handleCredentialsSubmit} className="mt-3 flex flex-col flex-1 min-h-0 overflow-hidden">
            <div className="flex-1 overflow-y-auto pr-1.5 pb-4 space-y-3.5">
              <input
                type="text"
                name="honeypot"
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
                className="hidden"
                tabIndex={-1}
                autoComplete="off"
              />

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  {mode === 'signup' ? 'Username' : 'Username or Email'}
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-zinc-500" />
                  <input
                    type="text"
                    required
                    placeholder={mode === 'signup' ? 'e.g. alex_fitness' : 'e.g. alex_fitness or you@example.com'}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-800/80 py-2.5 pl-10 pr-3.5 text-sm text-zinc-100 placeholder-zinc-500 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-zinc-500" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="At least 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-800/80 py-2.5 pl-10 pr-10 text-sm text-zinc-100 placeholder-zinc-500 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200"
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              {/* Email field on signup (between Password and Confirm Password) */}
              {mode === 'signup' && (
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-zinc-500" />
                    <input
                      type="email"
                      required
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full rounded-xl border border-zinc-700 bg-zinc-800/80 py-2.5 pl-10 pr-3.5 text-sm text-zinc-100 placeholder-zinc-500 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                    />
                  </div>
                </div>
              )}

              {mode === 'signup' && (
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">Confirm Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-zinc-500" />
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      placeholder="Repeat password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full rounded-xl border border-zinc-700 bg-zinc-800/80 py-2.5 pl-10 pr-10 text-sm text-zinc-100 placeholder-zinc-500 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200"
                    >
                      {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-zinc-800 bg-zinc-900/95 shrink-0 space-y-2.5">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-teal-500 py-3 text-sm font-bold text-zinc-950 shadow-lg shadow-teal-500/20 hover:bg-teal-400 disabled:opacity-50 transition-all active:scale-[0.98]"
              >
                {isLoading ? (
                  <span>Loading...</span>
                ) : (
                  <>
                    <span>{mode === 'signup' ? 'Continue to setup' : 'Sign in'}</span>
                    <ArrowRight className="size-4" />
                  </>
                )}
              </button>

              {/* OAuth Continue with Google / Facebook buttons */}
              <div className="relative my-2">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-zinc-800" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-zinc-900 px-2 text-zinc-500 font-medium">or</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleGoogleOAuth}
                  disabled={isLoading}
                  className="w-full flex items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800/80 hover:bg-zinc-800 hover:border-zinc-600 py-2.5 px-2 text-xs font-semibold text-zinc-100 transition-all disabled:opacity-50"
                >
                  <GoogleIcon className="size-4 shrink-0" />
                  <span className="truncate">Continue with Google</span>
                </button>

                <button
                  type="button"
                  onClick={handleFacebookOAuth}
                  disabled={isLoading}
                  className="w-full flex items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800/80 hover:bg-zinc-800 hover:border-zinc-600 py-2.5 px-2 text-xs font-semibold text-zinc-100 transition-all disabled:opacity-50"
                >
                  <FacebookIcon className="size-4 text-[#1877F2] shrink-0" />
                  <span className="truncate">Continue with Facebook</span>
                </button>
              </div>

              <div className="flex items-center justify-between text-xs text-zinc-400 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setMode(mode === 'signup' ? 'login' : 'signup');
                    setErrorMsg('');
                  }}
                  className="hover:text-teal-300 font-medium"
                >
                  {mode === 'signup' ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
                </button>

                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMsg('');
                      setFlowStage('forgot_password');
                    }}
                    className="hover:text-teal-300 font-medium text-zinc-400"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
            </div>
          </form>
        )}

        {/* Check your email screen */}
        {flowStage === 'check_email' && (
          <div className="mt-3 flex flex-col flex-1 min-h-0 text-center py-6 px-2 space-y-4">
            <div className="mx-auto size-12 rounded-2xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
              <Mail className="size-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-zinc-100">Check your email</h3>
              <p className="text-xs text-zinc-300 leading-relaxed max-w-sm mx-auto">
                We sent a verification link to <span className="font-semibold text-teal-300">{email}</span>. Click it to activate your account.
              </p>
            </div>

            {resendSuccess && (
              <div className="rounded-xl border border-teal-500/30 bg-teal-500/10 p-2.5 text-xs text-teal-300">
                Verification email resent! Check your inbox.
              </div>
            )}

            <div className="pt-2 space-y-2 max-w-xs mx-auto w-full">
              <button
                type="button"
                disabled={isResending}
                onClick={async () => {
                  setIsResending(true);
                  setErrorMsg('');
                  try {
                    const { error } = await supabase.auth.resend({
                      type: 'signup',
                      email: email.trim().toLowerCase()
                    });
                    if (error) throw error;
                    setResendSuccess(true);
                  } catch (err: any) {
                    setErrorMsg(err.message || 'Failed to resend email');
                  } finally {
                    setIsResending(false);
                  }
                }}
                className="w-full rounded-xl bg-teal-500 py-2.5 text-xs font-bold text-zinc-950 shadow-md shadow-teal-500/20 hover:bg-teal-400 disabled:opacity-50 transition-all"
              >
                {isResending ? 'Resending...' : 'Resend email'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setFlowStage('credentials');
                  setMode('login');
                  setErrorMsg('');
                }}
                className="w-full py-2 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                Back to sign in
              </button>
            </div>
          </div>
        )}

        {/* Choose your username screen (for OAuth users) */}
        {flowStage === 'choose_username' && (
          <form onSubmit={handleChooseUsernameSubmit} className="mt-3 flex flex-col flex-1 min-h-0 space-y-4 py-3">
            <div className="text-center space-y-1">
              <div className="mx-auto size-11 rounded-2xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400 mb-2">
                <User className="size-5" />
              </div>
              <h3 className="text-base font-bold text-zinc-100">Choose your username</h3>
              <p className="text-xs text-zinc-400">Select a unique username to finish setting up your account.</p>
            </div>

            <div className="space-y-1.5 pt-2">
              <label className="block text-xs font-medium text-zinc-300">Username</label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-zinc-500" />
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="e.g. alex_fitness"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-800/80 py-2.5 pl-10 pr-3.5 text-sm text-zinc-100 placeholder-zinc-500 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-teal-500 py-3 text-sm font-bold text-zinc-950 shadow-lg shadow-teal-500/20 hover:bg-teal-400 disabled:opacity-50 transition-all mt-4"
            >
              {isLoading ? <span>Saving...</span> : <span>Continue to setup</span>}
              <ArrowRight className="size-4" />
            </button>
          </form>
        )}

        {/* Forgot password screen */}
        {flowStage === 'forgot_password' && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!resetEmail.trim()) {
                setErrorMsg('Please enter your username or email.');
                return;
              }
              setIsLoading(true);
              setErrorMsg('');
              try {
                await api.requestPasswordReset(resetEmail.trim());
                setResetSentSuccess(true);
                setErrorMsg('');
              } catch (err: any) {
                setErrorMsg(err.message || 'Failed to send reset link.');
              } finally {
                setIsLoading(false);
              }
            }}
            className="mt-3 flex flex-col flex-1 min-h-0 space-y-4 py-2"
          >
            <div className="space-y-1">
              <p className="text-xs text-zinc-400">
                Enter your username or email address and we will send you a password reset link.
              </p>
            </div>

            {resetSentSuccess ? (
              <div className="rounded-xl border border-teal-500/30 bg-teal-500/10 p-3 text-xs text-teal-300 space-y-1">
                <p className="font-semibold">Reset link sent!</p>
                <p className="text-teal-400/90">Please check your email to reset your password.</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-zinc-300">Username or Email</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-zinc-500" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. alex_fitness or you@example.com"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-800/80 py-2.5 pl-10 pr-3.5 text-sm text-zinc-100 placeholder-zinc-500 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                  />
                </div>
              </div>
            )}

            <div className="pt-2 space-y-2">
              {!resetSentSuccess && (
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-teal-500 py-3 text-sm font-bold text-zinc-950 shadow-lg shadow-teal-500/20 hover:bg-teal-400 disabled:opacity-50 transition-all"
                >
                  {isLoading ? <span>Sending...</span> : <span>Send reset link</span>}
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setFlowStage('credentials');
                  setErrorMsg('');
                  setResetSentSuccess(false);
                }}
                className="w-full py-2 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                Back to sign in
              </button>
            </div>
          </form>
        )}

        {/* 2. Step 1: Basic Info */}
        {flowStage === 'step1_basic' && (
          <div className="mt-3 flex flex-col flex-1 min-h-0 overflow-hidden">
            <div className="flex-1 overflow-y-auto pr-1.5 pb-6 space-y-4">
              {/* Country Dropdown */}
              <div className="relative" ref={countryDropdownRef}>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Country <span className="text-teal-400">*</span>
                </label>
                <div
                  onClick={() => setIsCountryDropdownOpen(!isCountryDropdownOpen)}
                  className="w-full flex items-center justify-between rounded-xl border border-zinc-700 bg-zinc-800/80 py-2.5 px-3.5 text-sm text-zinc-100 cursor-pointer hover:border-zinc-600"
                >
                  <span className={country ? 'text-zinc-100' : 'text-zinc-500'}>
                    {country || 'Select your country'}
                  </span>
                  <Search className="size-4 text-zinc-400" />
                </div>

                {isCountryDropdownOpen && (
                  <div className="absolute left-0 right-0 top-full mt-1.5 z-50 max-h-56 overflow-y-auto rounded-xl border border-zinc-700 bg-zinc-900 p-2 shadow-2xl space-y-1">
                    <input
                      type="text"
                      placeholder="Search countries..."
                      value={countrySearch}
                      onChange={(e) => setCountrySearch(e.target.value)}
                      autoFocus
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-teal-500"
                    />
                    <div className="pt-1">
                      {filteredCountries.map((c) => (
                        <button
                          key={c.code}
                          type="button"
                          onClick={() => {
                            setCountry(c.name);
                            setIsCountryDropdownOpen(false);
                            setCountrySearch('');
                          }}
                          className={`w-full text-left px-3 py-1.5 rounded-lg text-xs flex items-center justify-between transition-colors ${
                            country === c.name ? 'bg-teal-500/20 text-teal-300 font-semibold' : 'text-zinc-300 hover:bg-zinc-800'
                          }`}
                        >
                          <span>{c.name}</span>
                          <span className="text-zinc-500 font-mono text-[10px]">{c.code}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Name */}
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Your Name <span className="text-teal-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="What should we call you?"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-800/80 py-2.5 px-3.5 text-sm text-zinc-100 placeholder-zinc-500 focus:border-teal-500 focus:outline-none"
                />
              </div>

              {/* Gender */}
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Biological / Physiological Gender <span className="text-teal-400">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {[
                    { value: 'male', label: 'Male' },
                    { value: 'female', label: 'Female' },
                    { value: 'other', label: 'Other' },
                    { value: 'prefer_not_to_say', label: 'Prefer not to say' }
                  ].map((g) => (
                    <button
                      key={g.value}
                      type="button"
                      onClick={() => setGender(g.value as any)}
                      className={`rounded-xl border py-2.5 px-2 text-xs font-semibold transition-all ${
                        gender === g.value
                          ? 'border-teal-500 bg-teal-500/20 text-teal-300 shadow-sm'
                          : 'border-zinc-700 bg-zinc-800/60 text-zinc-300 hover:bg-zinc-800'
                      }`}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Age */}
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Age (13–120) <span className="text-teal-400">*</span>
                </label>
                <input
                  type="number"
                  min={13}
                  max={120}
                  required
                  placeholder="e.g. 28"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-800/80 py-2.5 px-3.5 text-sm text-zinc-100 placeholder-zinc-500 focus:border-teal-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-zinc-800 bg-zinc-900/95 shrink-0 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setFlowStage('credentials')}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-zinc-700 text-xs font-semibold text-zinc-300 hover:bg-zinc-800"
              >
                <ArrowLeft className="size-4" />
                <span>Back</span>
              </button>

              <button
                type="button"
                disabled={!isStep1Valid}
                onClick={() => setFlowStage('step2_body')}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-teal-500 py-2.5 text-xs font-bold text-zinc-950 shadow-md shadow-teal-500/20 hover:bg-teal-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <span>Next: Body Stats</span>
                <ArrowRight className="size-4" />
              </button>
            </div>
          </div>
        )}

        {/* 3. Step 2: Body Stats */}
        {flowStage === 'step2_body' && (
          <div className="mt-3 flex flex-col flex-1 min-h-0 overflow-hidden">
            <div className="flex-1 overflow-y-auto pr-1.5 pb-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Height (cm) <span className="text-teal-400">*</span>
                </label>
                <input
                  type="number"
                  min={50}
                  max={260}
                  required
                  placeholder="e.g. 175"
                  value={heightCm}
                  onChange={(e) => setHeightCm(e.target.value)}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-800/80 py-2.5 px-3.5 text-sm text-zinc-100 placeholder-zinc-500 focus:border-teal-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                    Current Weight (kg) <span className="text-teal-400">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min={20}
                    max={400}
                    required
                    placeholder="e.g. 78.5"
                    value={currentWeightKg}
                    onChange={(e) => setCurrentWeightKg(e.target.value)}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-800/80 py-2.5 px-3.5 text-sm text-zinc-100 placeholder-zinc-500 focus:border-teal-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                    Goal Weight (kg) <span className="text-teal-400">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min={20}
                    max={400}
                    required
                    placeholder="e.g. 72.0"
                    value={goalWeightKg}
                    onChange={(e) => setGoalWeightKg(e.target.value)}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-800/80 py-2.5 px-3.5 text-sm text-zinc-100 placeholder-zinc-500 focus:border-teal-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-zinc-300">Body Fat % (optional)</label>
                  <span className="text-[11px] text-zinc-500">Improves BMR accuracy</span>
                </div>
                <input
                  type="number"
                  step="0.5"
                  min={3}
                  max={70}
                  placeholder="e.g. 18 (leave blank if unknown)"
                  value={bodyFatPercent}
                  onChange={(e) => setBodyFatPercent(e.target.value)}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-800/80 py-2.5 px-3.5 text-sm text-zinc-100 placeholder-zinc-500 focus:border-teal-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-zinc-800 bg-zinc-900/95 shrink-0 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setFlowStage('step1_basic')}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-zinc-700 text-xs font-semibold text-zinc-300 hover:bg-zinc-800"
              >
                <ArrowLeft className="size-4" />
                <span>Back</span>
              </button>

              <button
                type="button"
                disabled={!isStep2Valid}
                onClick={() => setFlowStage('step3_lifestyle')}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-teal-500 py-2.5 text-xs font-bold text-zinc-950 shadow-md shadow-teal-500/20 hover:bg-teal-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <span>Next: Lifestyle & Goals</span>
                <ArrowRight className="size-4" />
              </button>
            </div>
          </div>
        )}

        {/* 4. Step 3: Lifestyle & Goals */}
        {flowStage === 'step3_lifestyle' && (
          <div className="mt-3 flex flex-col flex-1 min-h-0 overflow-hidden">
            <div className="flex-1 overflow-y-auto pr-1.5 pb-6 space-y-4">
              {/* Fitness Level */}
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Fitness Level <span className="text-teal-400">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'beginner', label: 'Beginner' },
                    { value: 'intermediate', label: 'Intermediate' },
                    { value: 'advanced', label: 'Advanced' }
                  ].map((lvl) => (
                    <button
                      key={lvl.value}
                      type="button"
                      onClick={() => setFitnessLevel(lvl.value as any)}
                      className={`rounded-xl border py-2 px-2 text-xs font-semibold transition-all ${
                        fitnessLevel === lvl.value
                          ? 'border-teal-500 bg-teal-500/20 text-teal-300'
                          : 'border-zinc-700 bg-zinc-800/60 text-zinc-300 hover:bg-zinc-800'
                      }`}
                    >
                      {lvl.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Daily Activity Level */}
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Daily Activity Level <span className="text-teal-400">*</span>
                </label>
                <div className="space-y-1.5">
                  {[
                    { value: 'sedentary', label: 'Sedentary', desc: 'Desk job, minimal daily movement' },
                    { value: 'light', label: 'Lightly active', desc: '1–3 light exercise sessions/wk' },
                    { value: 'moderate', label: 'Moderately active', desc: '3–5 moderate exercise sessions/wk' },
                    { value: 'active', label: 'Very active', desc: '6–7 vigorous workout days/wk' },
                    { value: 'athlete', label: 'Extremely active', desc: 'Heavy physical job or dual training' }
                  ].map((act) => (
                    <button
                      key={act.value}
                      type="button"
                      onClick={() => setDailyActivity(act.value as any)}
                      className={`w-full text-left p-2.5 rounded-xl border transition-all flex items-center justify-between ${
                        dailyActivity === act.value
                          ? 'border-teal-500 bg-teal-500/15 text-teal-300'
                          : 'border-zinc-800 bg-zinc-800/50 text-zinc-300 hover:bg-zinc-800'
                      }`}
                    >
                      <div>
                        <div className="text-xs font-semibold text-zinc-200">{act.label}</div>
                        <div className="text-[11px] text-zinc-400">{act.desc}</div>
                      </div>
                      {dailyActivity === act.value && <Check className="size-4 text-teal-400" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Goal */}
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Primary Goal <span className="text-teal-400">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {[
                    { value: 'lose', label: 'Lose weight' },
                    { value: 'maintain', label: 'Maintain' },
                    { value: 'gain', label: 'Gain muscle' },
                    { value: 'recomp', label: 'Recomp' }
                  ].map((g) => (
                    <button
                      key={g.value}
                      type="button"
                      onClick={() => setGoal(g.value as any)}
                      className={`rounded-xl border py-2.5 px-2 text-xs font-semibold transition-all ${
                        goal === g.value
                          ? 'border-teal-500 bg-teal-500/20 text-teal-300'
                          : 'border-zinc-700 bg-zinc-800/60 text-zinc-300 hover:bg-zinc-800'
                      }`}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
              </div>
              {/* Optional Medical Conditions Checkbox */}
              <div className="pt-1">
                <label className="flex items-start gap-3 p-3 rounded-xl border border-zinc-800 bg-zinc-800/40 hover:bg-zinc-800/70 cursor-pointer transition-all">
                  <input
                    type="checkbox"
                    checked={hasMetabolicCondition}
                    onChange={(e) => setHasMetabolicCondition(e.target.checked)}
                    className="mt-0.5 rounded border-zinc-700 bg-zinc-900 text-teal-500 focus:ring-teal-400"
                  />
                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-zinc-200 block leading-snug">
                      I have a medical condition that affects my metabolism (thyroid, PCOS, post-bariatric surgery, other).
                    </span>
                  </div>
                </label>

                {hasMetabolicCondition && (
                  <div className="mt-2.5 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-200 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <span className="leading-relaxed">
                      Your calorie target is calculated from a standard formula. It may not fit if you have a metabolic condition. Talk to your doctor before following it.
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-zinc-800 bg-zinc-900/95 shrink-0 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setFlowStage('step2_body')}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-zinc-700 text-xs font-semibold text-zinc-300 hover:bg-zinc-800"
              >
                <ArrowLeft className="size-4" />
                <span>Back</span>
              </button>

              <button
                type="button"
                disabled={!isStep3Valid || isLoading}
                onClick={() => setFlowStage('step4_targets')}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-teal-500 py-3 text-sm font-bold text-zinc-950 shadow-lg shadow-teal-500/25 hover:bg-teal-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <span>Review Targets</span>
                <ArrowRight className="size-4" />
              </button>
            </div>
          </div>
        )}

        {/* 5. Step 4: Personalized Targets Review */}
        {flowStage === 'step4_targets' && (
          <div className="mt-3 flex flex-col flex-1 min-h-0 overflow-hidden">
            <div className="flex-1 overflow-y-auto pr-1.5 pb-6 space-y-4">
              <div className="text-center pb-1">
                <h3 className="text-base font-bold text-zinc-100">Your Calculated Metabolic Targets</h3>
                <p className="text-xs text-zinc-400 mt-0.5">Calculated using Mifflin-St Jeor and your activity level</p>
              </div>

              {/* Main Daily Calorie Target Card */}
              <div className="bg-zinc-950 p-4 rounded-2xl border border-teal-500/30 text-center space-y-1">
                <span className="text-[11px] font-medium text-teal-400 uppercase tracking-wider block">Daily Calorie Target</span>
                <div className="text-3xl font-extrabold font-mono text-zinc-100">
                  {previewTarget.toLocaleString()} <span className="text-sm font-normal text-zinc-400 font-sans">kcal / day</span>
                </div>
              </div>

              {/* BMR and Maintenance */}
              <div className="grid grid-cols-2 gap-2 text-center text-xs font-mono">
                <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800">
                  <span className="text-zinc-500 block text-[10px]">BMR (At Rest)</span>
                  <span className="font-bold text-zinc-200">{previewBmr} kcal</span>
                </div>
                <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800">
                  <span className="text-zinc-500 block text-[10px]">Maintenance (TDEE)</span>
                  <span className="font-bold text-zinc-200">{previewTdee} kcal</span>
                </div>
              </div>

              {/* Macronutrient targets */}
              <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800 space-y-2">
                <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono">
                  <div>
                    <span className="text-zinc-500 block text-[10px]">Carbs (40%)</span>
                    <span className="font-bold text-blue-400">{previewMacros.carbsGrams}g</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block text-[10px]">Fat (30%)</span>
                    <span className="font-bold text-amber-400">{previewMacros.fatGrams}g</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block text-[10px]">Protein (30%)</span>
                    <span className="font-bold text-red-400">{previewMacros.proteinGrams}g</span>
                  </div>
                </div>

                {previewMacros.proteinRaisedToFloor && (
                  <div className="pt-2 border-t border-zinc-850 flex items-center gap-1.5 text-[11px] text-teal-300">
                    <Shield className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                    <span>Protein target raised to protect muscle mass.</span>
                  </div>
                )}
              </div>

              {/* Medical Condition Warning Note on Next Screen */}
              {hasMetabolicCondition && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-200 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">
                    Your calorie target is calculated from a standard formula. It may not fit if you have a metabolic condition. Talk to your doctor before following it.
                  </span>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-zinc-800 bg-zinc-900/95 shrink-0 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setFlowStage('step3_lifestyle')}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-zinc-700 text-xs font-semibold text-zinc-300 hover:bg-zinc-800"
              >
                <ArrowLeft className="size-4" />
                <span>Back</span>
              </button>

              <button
                type="button"
                disabled={isLoading}
                onClick={handleFinishOnboarding}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-teal-500 py-3 text-sm font-bold text-zinc-950 shadow-lg shadow-teal-500/25 hover:bg-teal-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                {isLoading ? (
                  <span>Saving profile...</span>
                ) : (
                  <>
                    <span>Start Tracking</span>
                    <Sparkles className="size-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
