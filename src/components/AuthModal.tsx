import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Mail, Lock, User, ArrowRight, ArrowLeft, X, Check, Eye, EyeOff, Search, Sparkles, Scale, Heart, Activity } from 'lucide-react';
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

interface AuthModalProps {
  onAuthComplete?: () => void;
}

type AuthFlowStage = 'credentials' | 'forgot_password' | 'step1_basic' | 'step2_body' | 'step3_lifestyle';

export const AuthModal: React.FC<AuthModalProps> = ({ onAuthComplete }) => {
  const {
    userId,
    isAuthModalOpen,
    authModalMode,
    closeAuthModal,
    onAuthSuccess,
    profile,
    updateUserProfile,
    addWeightLog
  } = useApp();

  const [mode, setMode] = useState<'signup' | 'login'>(authModalMode || 'login');

  // Credentials State
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [honeypot, setHoneypot] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

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

  const countryDropdownRef = useRef<HTMLDivElement>(null);

  // Reset/sync flow when modal opens
  useEffect(() => {
    if (isAuthModalOpen) {
      setErrorMsg('');
      if (authModalMode) {
        setMode(authModalMode);
      }
      // If user is already logged in but has an incomplete profile, open directly to step1
      if (userId && !userId.startsWith('guest_') && !hasCompleteProfileStats(profile)) {
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

  // Handle Credentials Submit
  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (honeypot.trim().length > 0) return;

    const cleanUsername = username.trim().toLowerCase().replace(/^@/, '');
    if (!cleanUsername || cleanUsername.length < 2) {
      setErrorMsg('Please enter a valid username (at least 2 characters).');
      return;
    }

    if (!password || password.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }

    if (mode === 'signup') {
      if (password !== confirmPassword) {
        setErrorMsg('Passwords do not match.');
        return;
      }
    }

    setErrorMsg('');
    setIsLoading(true);

    try {
      if (mode === 'signup') {
        const signupRes = await api.signup(cleanUsername, password, rememberMe, confirmPassword, honeypot);
        trackEvent('signup');
        await onAuthSuccess();
        // Move to Onboarding Step 1
        setFlowStage('step1_basic');
      } else {
        await api.login(cleanUsername, password, rememberMe);
        await onAuthSuccess();
        const freshProfile = await api.getProfile();
        if (hasCompleteProfileStats(freshProfile.profile)) {
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
        signupComplete: true
      };

      const bmr = calculateBmr(tempProfile);
      const tdee = calculateMaintenanceCalories(tempProfile);
      const targetCalories = calculateDailyCalorieTarget(tempProfile);
      const macroTarget = calculateMacroTargets(targetCalories, goal);

      const fullProfile: Partial<UserProfile> = {
        ...tempProfile,
        bmr,
        tdee,
        targetCalories,
        macroTarget
      };

      // 1. Update Firestore & AppContext profile
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
                : 'Set up your profile'}
            </h2>
            {flowStage.startsWith('step') && (
              <p className="text-xs text-teal-400 font-medium mt-1">
                Step {flowStage === 'step1_basic' ? '1' : flowStage === 'step2_body' ? '2' : '3'} of 3:{' '}
                {flowStage === 'step1_basic' ? 'Basic Info' : flowStage === 'step2_body' ? 'Body Stats' : 'Lifestyle & Goals'}
              </p>
            )}
          </div>
          {flowStage === 'credentials' && (
            <button
              onClick={closeAuthModal}
              className="rounded-xl p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
              aria-label="Close"
            >
              <X className="size-5" />
            </button>
          )}
        </div>

        {/* Progress Bar for Steps */}
        {flowStage.startsWith('step') && (
          <div className="my-3 h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden shrink-0">
            <div
              className="h-full bg-teal-500 transition-all duration-300"
              style={{
                width: flowStage === 'step1_basic' ? '33%' : flowStage === 'step2_body' ? '66%' : '100%'
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
            <div className="flex-1 overflow-y-auto pr-1.5 pb-6 space-y-4">
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
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">Username</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-zinc-500" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. alex_fitness"
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

            <div className="pt-3 border-t border-zinc-800 bg-zinc-900/95 shrink-0 space-y-3">
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

              <div className="flex items-center justify-between text-xs text-zinc-400">
                <button
                  type="button"
                  onClick={() => setMode(mode === 'signup' ? 'login' : 'signup')}
                  className="hover:text-teal-300 font-medium"
                >
                  {mode === 'signup' ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
                </button>
              </div>
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
                onClick={handleFinishOnboarding}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-teal-500 py-3 text-sm font-bold text-zinc-950 shadow-lg shadow-teal-500/25 hover:bg-teal-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                {isLoading ? (
                  <span>Saving profile...</span>
                ) : (
                  <>
                    <span>Calculate Targets &amp; Finish</span>
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
