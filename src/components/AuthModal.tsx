import React, { useState, useEffect, useMemo } from 'react';
import { Mail, Lock, User, ArrowRight, ArrowLeft, X, RefreshCw, Shield, Check, Eye, EyeOff } from 'lucide-react';
import { api } from '../services/api.js';
import { trackEvent } from '../utils/analytics.js';
import { useApp } from '../context/AppContext.js';
import {
  hasCompleteProfileStats,
  calculateBmr,
  calculateMaintenanceCalories,
  calculateDailyCalorieTarget,
  calculateMacroTargets,
  calculateProjectedGoalDetails
} from '../utils/nutritionMath.js';
import {
  useDebounce,
  validateEmail,
  validateUsername,
  validateAge,
  validateHeightCm,
  validateHeightImperial,
  validateWeight,
  getPasswordStrength,
  timingSafeEqualString,
  getSafeRedirectUrl
} from '../utils/validation.js';
import type { UserProfile } from '../types/index.js';

interface AuthModalProps {
  onAuthComplete?: () => void;
}

type SignupFlowStage =
  | 'credentials'
  | 'forgot_password'
  | 'reset_password'
  | 'intro'
  | 'questions'
  | 'final';

interface SignupDraft {
  flowStage: SignupFlowStage;
  questionStep: number; // 1 to 8
  name: string;
  age: string;
  gender: 'female' | 'male' | 'prefer_not_to_say' | '';
  heightUnit: 'metric' | 'imperial';
  heightCm: string;
  heightFt: string;
  heightIn: string;
  weightUnit: 'metric' | 'imperial';
  currentWeight: string;
  goalWeight: string;
  dailyActivity: 'sedentary' | 'light' | 'moderate' | 'active' | 'athlete' | '';
  goalSpeed: 'lose_normal' | 'maintain' | 'gain_slow' | '';
}

const EMPTY_DRAFT: SignupDraft = {
  flowStage: 'intro',
  questionStep: 1,
  name: '',
  age: '',
  gender: '',
  heightUnit: 'metric',
  heightCm: '',
  heightFt: '',
  heightIn: '',
  weightUnit: 'metric',
  currentWeight: '',
  goalWeight: '',
  dailyActivity: '',
  goalSpeed: ''
};

export const AuthModal: React.FC<AuthModalProps> = ({ onAuthComplete }) => {
  const {
    userId,
    isAuthModalOpen,
    authModalMode,
    closeAuthModal,
    isGuest,
    userEmail,
    onAuthSuccess,
    profile,
    updateUserProfile,
    addWeightLog,
    resetGuestSession
  } = useApp();

  const [mode, setMode] = useState<'signup' | 'login'>(authModalMode || 'login');

  useEffect(() => {
    if (isAuthModalOpen && authModalMode) {
      setMode(authModalMode);
    }
  }, [isAuthModalOpen, authModalMode]);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [honeypot, setHoneypot] = useState('');
  const [draft, setDraft] = useState<SignupDraft>(EMPTY_DRAFT);
  const debouncedUsername = useDebounce(username, 400);
  const debouncedDraft = useDebounce(draft, 400);
  const [rememberMe, setRememberMe] = useState<boolean>(() => {
    const saved = localStorage.getItem('forkcount_remember_me') || localStorage.getItem('caloriq_remember_me');
    return saved !== null ? saved === 'true' : true;
  });
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Password reset state
  const [verificationCode, setVerificationCode] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resetToken, setResetToken] = useState('');
  const [newResetPassword, setNewResetPassword] = useState('');
  const [resetSentSuccess, setResetSentSuccess] = useState(false);

  // Multi-step signup state
  const [flowStage, setFlowStage] = useState<SignupFlowStage>('credentials');
  const [questionStep, setQuestionStep] = useState<number>(1);
  const [savedMidFlowNotice, setSavedMidFlowNotice] = useState<string | null>(null);
  const [showClosePrompt, setShowClosePrompt] = useState(false);
  const [saveButtonPhase, setSaveButtonPhase] = useState<'idle' | 'saving' | 'saved'>('idle');

  // 30-second countdown timer for Resend button (password reset)
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 1 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const draftStorageKey = useMemo(() => {
    const keyId = userId || username.trim().toLowerCase() || 'pending';
    return `forkcount_signup_draft_${keyId}`;
  }, [userId, username]);

  // Load saved draft if user is signed in, or check URL for password reset link
  useEffect(() => {
    if (!isAuthModalOpen) {
      setShowClosePrompt(false);
      setSavedMidFlowNotice(null);
      setSaveButtonPhase('idle');
      return;
    }

    if (saveButtonPhase !== 'idle') {
      return;
    }

    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tokenParam = params.get('resetToken');
      const emailParam = params.get('email');
      if (tokenParam && emailParam) {
        setEmail(emailParam);
        setResetToken(tokenParam);
        setFlowStage('reset_password');
        return;
      }
    }

    const isSignupAlreadyDone =
      hasCompleteProfileStats(profile) ||
      Boolean(profile?.signupComplete) ||
      (userId
        ? localStorage.getItem(`forkcount_signup_complete_${userId}`) === 'true' ||
          localStorage.getItem(`caloriq_signup_complete_${userId}`) === 'true'
        : false);

    if (!isGuest && !isSignupAlreadyDone) {
      try {
        const raw =
          localStorage.getItem(`forkcount_signup_draft_${userId}`) ||
          localStorage.getItem(`caloriq_signup_draft_${userId}`);
        if (raw) {
          const parsed = JSON.parse(raw) as Partial<SignupDraft>;
          const merged: SignupDraft = { ...EMPTY_DRAFT, ...parsed };
          setDraft(merged);
          setFlowStage(
            merged.flowStage === 'credentials' ||
              merged.flowStage === 'forgot_password' ||
              merged.flowStage === 'reset_password'
              ? 'intro'
              : merged.flowStage
          );
          setQuestionStep(merged.questionStep >= 1 && merged.questionStep <= 8 ? merged.questionStep : 1);
          return;
        }
      } catch {
        // ignore
      }
      setDraft(EMPTY_DRAFT);
      setFlowStage('intro');
      setQuestionStep(1);
    } else {
      setFlowStage('credentials');
    }
  }, [isAuthModalOpen, isGuest, profile, userId, saveButtonPhase]);

  // Persist draft whenever it changes during intro/questions/final
  const saveDraftState = (nextDraft: SignupDraft, nextStage?: SignupFlowStage, nextStep?: number) => {
    const updated: SignupDraft = {
      ...nextDraft,
      flowStage: nextStage ?? nextDraft.flowStage,
      questionStep: nextStep ?? nextDraft.questionStep
    };
    setDraft(updated);
    try {
      if (userId) {
        localStorage.setItem(`forkcount_signup_draft_${userId}`, JSON.stringify(updated));
      }
      localStorage.setItem(draftStorageKey, JSON.stringify(updated));
    } catch {
      // ignore
    }
  };

  // Convert draft height/weight into metric cm and kg for calculation
  const computedHeightCm = useMemo(() => {
    if (draft.heightUnit === 'metric') {
      const cm = parseFloat(draft.heightCm);
      return !isNaN(cm) && cm > 0 ? Math.round(cm * 10) / 10 : 0;
    } else {
      const ft = parseFloat(draft.heightFt);
      const inches = parseFloat(draft.heightIn || '0');
      if (isNaN(ft) || ft <= 0) return 0;
      const totalInches = ft * 12 + (isNaN(inches) ? 0 : inches);
      return totalInches > 0 ? Math.round(totalInches * 2.54 * 10) / 10 : 0;
    }
  }, [draft.heightUnit, draft.heightCm, draft.heightFt, draft.heightIn]);

  const computedCurrentWeightKg = useMemo(() => {
    const val = parseFloat(draft.currentWeight);
    if (isNaN(val) || val <= 0) return 0;
    return draft.weightUnit === 'metric'
      ? Math.round(val * 10) / 10
      : Math.round((val / 2.20462) * 10) / 10;
  }, [draft.weightUnit, draft.currentWeight]);

  const computedGoalWeightKg = useMemo(() => {
    const val = parseFloat(draft.goalWeight);
    if (isNaN(val) || val <= 0) return 0;
    return draft.weightUnit === 'metric'
      ? Math.round(val * 10) / 10
      : Math.round((val / 2.20462) * 10) / 10;
  }, [draft.weightUnit, draft.goalWeight]);

  const candidateProfile: UserProfile = useMemo(() => {
    const parsedAge = parseInt(draft.age, 10);
    const resolvedGoalWeightKg =
      computedGoalWeightKg > 0 ? computedGoalWeightKg : computedCurrentWeightKg;
    return {
      ...profile,
      name: draft.name.trim(),
      age: !isNaN(parsedAge) ? parsedAge : 0,
      gender: draft.gender,
      heightCm: computedHeightCm,
      currentWeightKg: computedCurrentWeightKg,
      goalWeightKg: resolvedGoalWeightKg,
      dailyActivity: draft.dailyActivity,
      goalSpeed: draft.goalSpeed,
      unitSystem: draft.weightUnit
    };
  }, [
    profile,
    draft.name,
    draft.age,
    draft.gender,
    computedHeightCm,
    computedCurrentWeightKg,
    computedGoalWeightKg,
    draft.dailyActivity,
    draft.goalSpeed,
    draft.weightUnit
  ]);

  const allQuestionsComplete = useMemo(
    () => hasCompleteProfileStats(candidateProfile),
    [candidateProfile]
  );

  const calculatedBmr = useMemo(
    () => (allQuestionsComplete ? calculateBmr(candidateProfile) : 0),
    [allQuestionsComplete, candidateProfile]
  );
  const calculatedMaintenance = useMemo(
    () => (allQuestionsComplete ? calculateMaintenanceCalories(candidateProfile) : 0),
    [allQuestionsComplete, candidateProfile]
  );
  const calculatedTarget = useMemo(
    () => (allQuestionsComplete ? calculateDailyCalorieTarget(candidateProfile) : 0),
    [allQuestionsComplete, candidateProfile]
  );
  const calculatedMacros = useMemo(
    () => (allQuestionsComplete ? calculateMacroTargets(calculatedTarget) : calculateMacroTargets(0)),
    [allQuestionsComplete, calculatedTarget]
  );
  const calculatedGoalDetails = useMemo(
    () => (allQuestionsComplete ? calculateProjectedGoalDetails(candidateProfile, [], true) : null),
    [allQuestionsComplete, candidateProfile]
  );
  const calculatedGoalDate = calculatedGoalDetails?.dateText || '';

  if (!isAuthModalOpen) return null;

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUsername = username.trim().replace(/^@/, '');

    if (mode === 'signup') {
      const usernameErr = validateUsername(cleanUsername);
      if (usernameErr) {
        setErrorMsg(usernameErr);
        return;
      }
      if (!password) {
        setErrorMsg('Please enter a password.');
        return;
      }
      if (!timingSafeEqualString(password, confirmPassword)) {
        setErrorMsg('Passwords do not match.');
        return;
      }
    } else {
      if (!cleanUsername || !password) {
        setErrorMsg('Wrong username or password.');
        return;
      }
    }

    localStorage.setItem('forkcount_remember_me', String(rememberMe));
    setErrorMsg('');
    setIsLoading(true);

    try {
      if (mode === 'signup') {
        const signupRes = await api.signup(cleanUsername, password, rememberMe, confirmPassword, honeypot);
        if (signupRes?.userId) {
          try {
            localStorage.setItem('forkcount_signup_complete', 'true');
            localStorage.setItem(`forkcount_signup_complete_${signupRes.userId}`, 'true');
          } catch {
            // ignore
          }
        }
        trackEvent('signup');
      } else {
        await api.login(cleanUsername, password, rememberMe);
      }

      await onAuthSuccess();

      setUsername('');
      setPassword('');
      setConfirmPassword('');
      setErrorMsg('');

      closeAuthModal();
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const redirectParam =
          params.get('next') ||
          params.get('returnTo') ||
          params.get('redirect') ||
          params.get('redirectTo') ||
          params.get('redirectUrl');
        const safeTarget = getSafeRedirectUrl(redirectParam, '/dashboard');
        window.history.pushState({}, '', safeTarget);
        window.dispatchEvent(new PopStateEvent('popstate'));
      }
      if (onAuthComplete) {
        onAuthComplete();
      }
    } catch (err: any) {
      setErrorMsg(
        mode === 'login'
          ? 'Wrong username or password.'
          : err.message || 'Failed to create account.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim();
    const emailErr = validateEmail(cleanEmail);
    if (emailErr) {
      setErrorMsg(emailErr);
      return;
    }
    setErrorMsg('');
    setResetSentSuccess(false);
    setIsLoading(true);
    try {
      const res = await api.requestPasswordReset(cleanEmail);
      setVerificationCode('');
      setResendCooldown(res.resendCooldownSeconds || 30);
      setResetSentSuccess(true);
      setFlowStage('reset_password');
    } catch (err: any) {
      setErrorMsg(
        err.message || 'Email sending is limited during testing. Use the developer account email to sign up.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    const codeOrToken = resetToken.trim() || verificationCode.trim();
    if (!codeOrToken) {
      setErrorMsg("That code isn't right. Check your email and try again.");
      return;
    }
    if (!newResetPassword || newResetPassword.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }
    if (getPasswordStrength(newResetPassword).score < 2) {
      setErrorMsg('Password must be at least Fair strength.');
      return;
    }
    setErrorMsg('');
    setIsLoading(true);
    try {
      await api.resetPassword(email.trim(), codeOrToken, newResetPassword, rememberMe);
      await onAuthSuccess();
      setNewResetPassword('');
      setResetToken('');
      setVerificationCode('');
      if (typeof window !== 'undefined') {
        window.history.replaceState({}, '', '/dashboard');
      }
      closeAuthModal();
      if (onAuthComplete) {
        onAuthComplete();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Could not reset password.');
    } finally {
      setIsLoading(false);
    }
  };

  // Check if current question step has a valid answer
  const getStepValidationError = (): string | null => {
    switch (questionStep) {
      case 2:
        return draft.age !== '' ? validateAge(draft.age) : 'Enter an age between 13 and 120.';
      case 4:
        if (draft.heightUnit === 'metric') {
          return draft.heightCm !== '' ? validateHeightCm(draft.heightCm) : "That height doesn't look right.";
        }
        return draft.heightFt !== ''
          ? validateHeightImperial(draft.heightFt, draft.heightIn || '0')
          : "That height doesn't look right.";
      case 5:
        return draft.currentWeight !== ''
          ? validateWeight(draft.currentWeight, draft.weightUnit)
          : 'Enter a weight between 20 and 500 kg.';
      case 6:
        return draft.goalWeight !== ''
          ? validateWeight(draft.goalWeight, draft.weightUnit)
          : 'Enter a weight between 20 and 500 kg.';
      default:
        return null;
    }
  };

  const isCurrentStepValid = (): boolean => {
    switch (questionStep) {
      case 1:
        return draft.name.trim().length > 0;
      case 2:
        return validateAge(draft.age) === null;
      case 3:
        return (
          draft.gender === 'female' ||
          draft.gender === 'male' ||
          draft.gender === 'prefer_not_to_say'
        );
      case 4:
        return draft.heightUnit === 'metric'
          ? validateHeightCm(draft.heightCm) === null
          : validateHeightImperial(draft.heightFt, draft.heightIn || '0') === null;
      case 5:
        return validateWeight(draft.currentWeight, draft.weightUnit) === null;
      case 6:
        return validateWeight(draft.goalWeight, draft.weightUnit) === null;
      case 7:
        return Boolean(draft.dailyActivity);
      case 8:
        return Boolean(draft.goalSpeed);
      default:
        return false;
    }
  };

  const handleNextQuestion = () => {
    setErrorMsg('');
    if (!isCurrentStepValid()) {
      const stepErr = getStepValidationError();
      setErrorMsg(stepErr || 'Please answer this question to continue.');
      return;
    }
    setSavedMidFlowNotice(null);
    setShowClosePrompt(false);

    if (questionStep < 8) {
      const nextStep = questionStep + 1;
      setQuestionStep(nextStep);
      saveDraftState(draft, 'questions', nextStep);
    } else {
      setFlowStage('final');
      saveDraftState(draft, 'final', 8);
    }
  };

  const handleMidFlowBack = () => {
    setErrorMsg('');
    setSavedMidFlowNotice('Your answers are saved. Come back anytime to finish.');
    if (flowStage === 'final') {
      setFlowStage('questions');
      setQuestionStep(8);
      saveDraftState(draft, 'questions', 8);
    } else if (flowStage === 'questions' && questionStep > 1) {
      const prevStep = questionStep - 1;
      setQuestionStep(prevStep);
      saveDraftState(draft, 'questions', prevStep);
    } else if (flowStage === 'questions' && questionStep === 1) {
      setFlowStage('intro');
      saveDraftState(draft, 'intro', 1);
    }
  };

  const handleAttemptCloseMidFlow = () => {
    if (flowStage === 'intro' || flowStage === 'questions' || flowStage === 'final') {
      saveDraftState(draft, flowStage, questionStep);
      setSavedMidFlowNotice('Your answers are saved. Come back anytime to finish.');
      setShowClosePrompt(true);
      return;
    }
    closeAuthModal();
  };

  const handleSaveAndStart = async () => {
    if (!allQuestionsComplete || isLoading || saveButtonPhase !== 'idle') return;
    setIsLoading(true);
    setSaveButtonPhase('saving');
    setErrorMsg('');
    try {
      if (isGuest && username.trim() && password) {
        try {
          await api.signup(username.trim(), password, rememberMe, confirmPassword || password, honeypot);
        } catch {
          // ignore if already signed up
        }
      }

      const resolvedUserId = userId || api.getToken() || '';
      try {
        localStorage.setItem('forkcount_signup_complete', 'true');
        localStorage.setItem('forkcount_onboarding_complete_v1', 'true');
        localStorage.setItem('forkcount_onboarding_completed', 'true');
        if (resolvedUserId) {
          localStorage.setItem(`forkcount_signup_complete_${resolvedUserId}`, 'true');
          localStorage.removeItem(`forkcount_signup_draft_${resolvedUserId}`);
          localStorage.removeItem(`caloriq_signup_draft_${resolvedUserId}`);
        }
        localStorage.removeItem(draftStorageKey);
      } catch {
        // ignore
      }

      await updateUserProfile({
        name: candidateProfile.name,
        age: candidateProfile.age,
        gender: candidateProfile.gender,
        heightCm: candidateProfile.heightCm,
        height: candidateProfile.heightCm,
        currentWeightKg: candidateProfile.currentWeightKg,
        currentWeight: candidateProfile.currentWeightKg,
        goalWeightKg: candidateProfile.goalWeightKg,
        goalWeight: candidateProfile.goalWeightKg,
        dailyActivity: candidateProfile.dailyActivity,
        activity: candidateProfile.dailyActivity,
        goalSpeed: candidateProfile.goalSpeed,
        goal: candidateProfile.goalSpeed,
        unitSystem: candidateProfile.unitSystem,
        signupComplete: true
      });

      if (candidateProfile.currentWeightKg > 0) {
        await addWeightLog(candidateProfile.currentWeightKg).catch(() => {});
      }

      await onAuthSuccess().catch(() => {});

      setSaveButtonPhase('saved');
      setShowClosePrompt(false);
      setSavedMidFlowNotice(null);
      trackEvent('signup');

      await new Promise((resolve) => setTimeout(resolve, 250));

      closeAuthModal();

      if (typeof window !== 'undefined') {
        window.history.pushState({}, '', '/dashboard');
        window.dispatchEvent(new PopStateEvent('popstate'));
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      if (onAuthComplete) {
        onAuthComplete();
      }
    } catch (err) {
      console.error('[ForkCount] Save and start failed:', err);
      setErrorMsg("Couldn't save your profile. Try again.");
      setSaveButtonPhase('idle');
    } finally {
      setIsLoading(false);
    }
  };

  const isInSignupQuestionnaire =
    flowStage === 'intro' || flowStage === 'questions' || flowStage === 'final';

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative my-auto">
        <button
          type="button"
          onClick={handleAttemptCloseMidFlow}
          className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-200 p-1 rounded-lg"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Saved answers notice when going back or attempting to close mid-flow */}
        {savedMidFlowNotice && (
          <div className="mb-4 p-3 bg-teal-950/50 border border-teal-500/40 rounded-xl text-xs text-teal-200 space-y-2">
            <p className="font-medium">{savedMidFlowNotice}</p>
            {showClosePrompt && (
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowClosePrompt(false);
                    setSavedMidFlowNotice(null);
                  }}
                  className="px-3 py-1.5 bg-teal-500 hover:bg-teal-400 text-zinc-950 font-semibold rounded-lg text-xs transition-colors"
                >
                  Continue questions
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowClosePrompt(false);
                    closeAuthModal();
                  }}
                  className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium rounded-lg text-xs transition-colors"
                >
                  Close for now
                </button>
              </div>
            )}
          </div>
        )}

        {/* ==================== INTRO SCREEN ==================== */}
        {isInSignupQuestionnaire && flowStage === 'intro' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400 shrink-0">
                <Shield className="w-4 h-4" />
              </div>
              <h3 className="text-lg font-bold text-zinc-100">
                A few questions before we start
              </h3>
            </div>

            <div className="space-y-3 text-xs text-zinc-300 leading-relaxed bg-zinc-950/80 border border-zinc-800 rounded-xl p-4">
              <p>ForkCount needs a few details about your body to work.</p>
              <p>
                We use them for one thing: calculating your daily calorie target and how many calories you burn during exercise. That&apos;s the Mifflin-St Jeor formula — the standard way to work out how much energy your body needs at rest.
              </p>
              <p>
                Without these numbers, we can&apos;t show you a target. The app would just be a blank page.
              </p>
              <div className="pt-1">
                <p className="font-semibold text-zinc-200 mb-1.5">Where your data goes:</p>
                <ul className="space-y-1 text-zinc-400">
                  <li>- It stays in your account, on our servers (Google Firebase)</li>
                  <li>- Only you can see it</li>
                  <li>- We don&apos;t sell it</li>
                  <li>- We don&apos;t share it with advertisers</li>
                  <li>- You can delete it at any time from the Me tab</li>
                </ul>
              </div>
              <p className="text-teal-400 font-medium pt-1">This takes about 90 seconds.</p>
            </div>

            <div className="space-y-2.5 pt-1 text-center">
              <button
                type="button"
                onClick={() => {
                  setSavedMidFlowNotice(null);
                  setShowClosePrompt(false);
                  setFlowStage('questions');
                  setQuestionStep(1);
                  saveDraftState(draft, 'questions', 1);
                }}
                className="w-full bg-teal-500 hover:bg-teal-400 text-zinc-950 font-semibold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors shadow-lg shadow-teal-500/20"
              >
                Start
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              <a
                href="/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-[11px] text-zinc-400 hover:text-teal-400 underline transition-colors"
              >
                Read our Privacy Policy
              </a>
            </div>
          </div>
        )}

        {/* ==================== 8 QUESTION SCREENS ==================== */}
        {isInSignupQuestionnaire && flowStage === 'questions' && (
          <div className="space-y-5">
            {/* Progress Bar Header */}
            <div className="space-y-2 pr-6">
              <div className="flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={handleMidFlowBack}
                  className="text-zinc-400 hover:text-zinc-200 flex items-center gap-1 text-xs font-medium"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Back
                </button>
                <span className="font-mono text-xs font-semibold text-teal-400">
                  {questionStep} of 8
                </span>
              </div>
              <div className="w-full h-1.5 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800">
                <div
                  className="h-full bg-teal-500 transition-all duration-300 rounded-full"
                  style={{ width: `${(questionStep / 8) * 100}%` }}
                />
              </div>
            </div>

            {errorMsg && (
              <div className="p-2.5 bg-rose-950/60 border border-rose-900/60 rounded-xl text-xs text-rose-300">
                {errorMsg}
              </div>
            )}

            {/* Question 1: Name */}
            {questionStep === 1 && (
              <div className="space-y-4">
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-zinc-100">
                    What should we call you?
                  </h3>
                  <p className="text-xs text-zinc-400">
                    So the app can greet you. Nothing else.
                  </p>
                </div>
                <input
                  type="text"
                  value={draft.name}
                  onChange={(e) => saveDraftState({ ...draft, name: e.target.value })}
                  placeholder="Enter your name"
                  autoFocus
                  required
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-teal-500"
                />
              </div>
            )}

            {/* Question 2: Age */}
            {questionStep === 2 && (
              <div className="space-y-4">
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-zinc-100">
                    How old are you?
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Age is one of the five inputs in the calorie formula. Your body needs fewer calories as you age.
                  </p>
                </div>
                <input
                  type="number"
                  min={13}
                  max={120}
                  value={draft.age}
                  onChange={(e) => saveDraftState({ ...draft, age: e.target.value })}
                  placeholder="Age (13–120)"
                  autoFocus
                  required
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm font-mono text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-teal-500"
                />
                {debouncedDraft.age !== '' && validateAge(debouncedDraft.age) && (
                  <p className="text-xs text-rose-400">{validateAge(debouncedDraft.age)}</p>
                )}
                {draft.age !== '' && Number(draft.age) >= 13 && Number(draft.age) < 18 && (
                  <div className="p-2.5 bg-amber-950/40 border border-amber-800/50 rounded-xl text-xs text-amber-300">
                    Use ForkCount with a parent or guardian.
                  </div>
                )}
              </div>
            )}

            {/* Question 3: Gender */}
            {questionStep === 3 && (
              <div className="space-y-4">
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-zinc-100">
                    What&apos;s your gender?
                  </h3>
                  <p className="text-xs text-zinc-400">
                    The male and female calorie formulas are different. Knowing which one to use gets you a more accurate target.
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {[
                    { value: 'female', label: 'Female' },
                    { value: 'male', label: 'Male' },
                    { value: 'prefer_not_to_say', label: 'Prefer not to say' }
                  ].map((option) => {
                    const selected = draft.gender === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() =>
                          saveDraftState({
                            ...draft,
                            gender: option.value as SignupDraft['gender']
                          })
                        }
                        className={`w-full text-left px-4 py-3 rounded-xl border text-xs font-semibold flex items-center justify-between transition-colors ${
                          selected
                            ? 'bg-teal-500/15 border-teal-500 text-teal-300'
                            : 'bg-zinc-950 border-zinc-800 text-zinc-200 hover:border-zinc-700'
                        }`}
                      >
                        <span>{option.label}</span>
                        {selected && <Check className="w-4 h-4 text-teal-400" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Question 4: Height */}
            {questionStep === 4 && (
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-zinc-100">
                      How tall are you?
                    </h3>
                    <p className="text-xs text-zinc-400">
                      Height is one of the five inputs in the calorie formula.
                    </p>
                  </div>
                  <div className="flex bg-zinc-950 p-1 rounded-lg border border-zinc-800 shrink-0">
                    <button
                      type="button"
                      onClick={() => saveDraftState({ ...draft, heightUnit: 'metric' })}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-mono transition-colors ${
                        draft.heightUnit === 'metric'
                          ? 'bg-teal-500 text-zinc-950 font-bold'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      cm
                    </button>
                    <button
                      type="button"
                      onClick={() => saveDraftState({ ...draft, heightUnit: 'imperial' })}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-mono transition-colors ${
                        draft.heightUnit === 'imperial'
                          ? 'bg-teal-500 text-zinc-950 font-bold'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      ft / in
                    </button>
                  </div>
                </div>

                {draft.heightUnit === 'metric' ? (
                  <div className="space-y-2">
                    <div className="relative">
                      <input
                        type="number"
                        min={50}
                        max={250}
                        step="any"
                        value={draft.heightCm}
                        onChange={(e) => saveDraftState({ ...draft, heightCm: e.target.value })}
                        placeholder="Height in cm (50–250)"
                        autoFocus
                        required
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 pr-12 text-sm font-mono text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-teal-500"
                      />
                      <span className="absolute right-3.5 top-2.5 text-xs font-mono text-zinc-500">
                        cm
                      </span>
                    </div>
                    {debouncedDraft.heightCm !== '' && validateHeightCm(debouncedDraft.heightCm) && (
                      <p className="text-xs text-rose-400">{validateHeightCm(debouncedDraft.heightCm)}</p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="relative">
                        <input
                          type="number"
                          min={1}
                          max={8}
                          value={draft.heightFt}
                          onChange={(e) => saveDraftState({ ...draft, heightFt: e.target.value })}
                          placeholder="Feet"
                          autoFocus
                          required
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 pr-10 text-sm font-mono text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-teal-500"
                        />
                        <span className="absolute right-3.5 top-2.5 text-xs font-mono text-zinc-500">
                          ft
                        </span>
                      </div>
                      <div className="relative">
                        <input
                          type="number"
                          min={0}
                          max={11}
                          value={draft.heightIn}
                          onChange={(e) => saveDraftState({ ...draft, heightIn: e.target.value })}
                          placeholder="Inches"
                          required
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 pr-10 text-sm font-mono text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-teal-500"
                        />
                        <span className="absolute right-3.5 top-2.5 text-xs font-mono text-zinc-500">
                          in
                        </span>
                      </div>
                    </div>
                    {debouncedDraft.heightFt !== '' &&
                      validateHeightImperial(debouncedDraft.heightFt, debouncedDraft.heightIn || '0') && (
                        <p className="text-xs text-rose-400">
                          {validateHeightImperial(debouncedDraft.heightFt, debouncedDraft.heightIn || '0')}
                        </p>
                      )}
                  </div>
                )}
              </div>
            )}

            {/* Question 5: Current weight */}
            {questionStep === 5 && (
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-zinc-100">
                      What do you weigh right now?
                    </h3>
                    <p className="text-xs text-zinc-400">
                      Weight is the biggest input in the calorie formula, and it&apos;s used for exercise burn too.
                    </p>
                  </div>
                  <div className="flex bg-zinc-950 p-1 rounded-lg border border-zinc-800 shrink-0">
                    <button
                      type="button"
                      onClick={() => saveDraftState({ ...draft, weightUnit: 'metric' })}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-mono transition-colors ${
                        draft.weightUnit === 'metric'
                          ? 'bg-teal-500 text-zinc-950 font-bold'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      kg
                    </button>
                    <button
                      type="button"
                      onClick={() => saveDraftState({ ...draft, weightUnit: 'imperial' })}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-mono transition-colors ${
                        draft.weightUnit === 'imperial'
                          ? 'bg-teal-500 text-zinc-950 font-bold'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      lb
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <input
                    type="number"
                    min={draft.weightUnit === 'metric' ? 20 : 44}
                    max={draft.weightUnit === 'metric' ? 500 : 1100}
                    step="0.1"
                    value={draft.currentWeight}
                    onChange={(e) => saveDraftState({ ...draft, currentWeight: e.target.value })}
                    placeholder={`Current weight in ${draft.weightUnit === 'metric' ? 'kg' : 'lb'}`}
                    autoFocus
                    required
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 pr-12 text-sm font-mono text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-teal-500"
                  />
                  <span className="absolute right-3.5 top-2.5 text-xs font-mono text-zinc-500">
                    {draft.weightUnit === 'metric' ? 'kg' : 'lb'}
                  </span>
                </div>
                {debouncedDraft.currentWeight !== '' &&
                  validateWeight(debouncedDraft.currentWeight, debouncedDraft.weightUnit) && (
                    <p className="text-xs text-rose-400">
                      {validateWeight(debouncedDraft.currentWeight, debouncedDraft.weightUnit)}
                    </p>
                  )}
              </div>
            )}

            {/* Question 6: Goal weight */}
            {questionStep === 6 && (
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-zinc-100">
                      What&apos;s your goal weight?
                    </h3>
                    <p className="text-xs text-zinc-400">
                      We use this to estimate when you&apos;ll reach your goal. Not required for the maths, but recommended.
                    </p>
                  </div>
                  <div className="flex bg-zinc-950 p-1 rounded-lg border border-zinc-800 shrink-0">
                    <button
                      type="button"
                      onClick={() => saveDraftState({ ...draft, weightUnit: 'metric' })}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-mono transition-colors ${
                        draft.weightUnit === 'metric'
                          ? 'bg-teal-500 text-zinc-950 font-bold'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      kg
                    </button>
                    <button
                      type="button"
                      onClick={() => saveDraftState({ ...draft, weightUnit: 'imperial' })}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-mono transition-colors ${
                        draft.weightUnit === 'imperial'
                          ? 'bg-teal-500 text-zinc-950 font-bold'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      lb
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <input
                    type="number"
                    min={draft.weightUnit === 'metric' ? 20 : 44}
                    max={draft.weightUnit === 'metric' ? 500 : 1100}
                    step="0.1"
                    value={draft.goalWeight}
                    onChange={(e) => saveDraftState({ ...draft, goalWeight: e.target.value })}
                    placeholder={`Goal weight in ${draft.weightUnit === 'metric' ? 'kg' : 'lb'}`}
                    autoFocus
                    required
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 pr-12 text-sm font-mono text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-teal-500"
                  />
                  <span className="absolute right-3.5 top-2.5 text-xs font-mono text-zinc-500">
                    {draft.weightUnit === 'metric' ? 'kg' : 'lb'}
                  </span>
                </div>
                {debouncedDraft.goalWeight !== '' &&
                  validateWeight(debouncedDraft.goalWeight, debouncedDraft.weightUnit) && (
                    <p className="text-xs text-rose-400">
                      {validateWeight(debouncedDraft.goalWeight, debouncedDraft.weightUnit)}
                    </p>
                  )}

                <p className="text-[11px] text-zinc-500">
                  If you&apos;re not sure yet, you can enter your current weight ({draft.currentWeight || '—'}{' '}
                  {draft.weightUnit === 'metric' ? 'kg' : 'lb'}) and change it anytime later.
                </p>
              </div>
            )}

            {/* Question 7: Daily activity level */}
            {questionStep === 7 && (
              <div className="space-y-4">
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-zinc-100">
                    How active are you on a normal day?
                  </h3>
                  <p className="text-xs text-zinc-400">
                    This multiplies your resting rate to work out how many calories you burn in a normal day.
                  </p>
                </div>
                <div className="space-y-2">
                  {[
                    { value: 'sedentary', label: 'Sedentary — desk job, little movement' },
                    { value: 'light', label: 'Lightly active — walks, 1–2 workouts a week' },
                    { value: 'moderate', label: 'Moderately active — 3–5 workouts a week' },
                    { value: 'active', label: 'Very active — 5–6 workouts a week' },
                    { value: 'athlete', label: 'Athlete — daily hard training, physical job' }
                  ].map((option) => {
                    const selected = draft.dailyActivity === option.value;
                    return (
                      <label
                        key={option.value}
                        onClick={() =>
                          saveDraftState({
                            ...draft,
                            dailyActivity: option.value as SignupDraft['dailyActivity']
                          })
                        }
                        className={`w-full px-3.5 py-3 rounded-xl border text-xs flex items-center gap-3 cursor-pointer transition-colors ${
                          selected
                            ? 'bg-teal-500/15 border-teal-500 text-teal-300 font-semibold'
                            : 'bg-zinc-950 border-zinc-800 text-zinc-200 hover:border-zinc-700'
                        }`}
                      >
                        <input
                          type="radio"
                          name="dailyActivity"
                          checked={selected}
                          onChange={() =>
                            saveDraftState({
                              ...draft,
                              dailyActivity: option.value as SignupDraft['dailyActivity']
                            })
                          }
                          className="accent-teal-500"
                        />
                        <span>{option.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Question 8: Goal */}
            {questionStep === 8 && (
              <div className="space-y-4">
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-zinc-100">
                    What are you here to do?
                  </h3>
                  <p className="text-xs text-zinc-400">
                    This sets whether your daily target goes down, stays the same, or goes up.
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {[
                    { value: 'lose_normal', label: 'Lose fat — about 0.5 kg per week' },
                    { value: 'maintain', label: 'Maintain — eat at your maintenance' },
                    { value: 'gain_slow', label: 'Build muscle — small lean surplus' }
                  ].map((option) => {
                    const selected = draft.goalSpeed === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() =>
                          saveDraftState({
                            ...draft,
                            goalSpeed: option.value as SignupDraft['goalSpeed']
                          })
                        }
                        className={`w-full text-left px-4 py-3 rounded-xl border text-xs font-semibold flex items-center justify-between transition-colors ${
                          selected
                            ? 'bg-teal-500/15 border-teal-500 text-teal-300'
                            : 'bg-zinc-950 border-zinc-800 text-zinc-200 hover:border-zinc-700'
                        }`}
                      >
                        <span>{option.label}</span>
                        {selected && <Check className="w-4 h-4 text-teal-400" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Single Action Button: Continue (steps 1-7) or See my plan (step 8) */}
            <button
              type="button"
              disabled={!isCurrentStepValid()}
              onClick={handleNextQuestion}
              className="w-full bg-teal-500 hover:bg-teal-400 disabled:opacity-40 text-zinc-950 font-semibold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors shadow-lg shadow-teal-500/20"
            >
              <span>{questionStep === 8 ? 'See my plan' : 'Continue'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* ==================== FINAL SCREEN ==================== */}
        {isInSignupQuestionnaire && flowStage === 'final' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between pr-6">
              <button
                type="button"
                onClick={handleMidFlowBack}
                className="text-zinc-400 hover:text-zinc-200 flex items-center gap-1 text-xs font-medium"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back
              </button>
              <span className="font-mono text-xs text-teal-400 font-semibold">Complete</span>
            </div>

            <h3 className="text-lg font-bold text-zinc-100">
              Here&apos;s what we calculated
            </h3>

            {errorMsg && (
              <div className="p-2.5 bg-rose-950/60 border border-rose-900/60 rounded-xl text-xs text-rose-300">
                {errorMsg}
              </div>
            )}

            {allQuestionsComplete && (
              <div className="space-y-2.5">
                {calculatedBmr > 0 && (
                  <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold text-zinc-200 block">BMR</span>
                      <span className="text-[11px] text-zinc-400">Your body burns this much at rest</span>
                    </div>
                    <span className="font-mono text-sm font-bold text-zinc-100">
                      {calculatedBmr} kcal
                    </span>
                  </div>
                )}

                {calculatedMaintenance > 0 && (
                  <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold text-zinc-200 block">Maintenance</span>
                      <span className="text-[11px] text-zinc-400">What you burn on a normal day</span>
                    </div>
                    <span className="font-mono text-sm font-bold text-zinc-100">
                      {calculatedMaintenance} kcal
                    </span>
                  </div>
                )}

                {calculatedTarget > 0 && (
                  <div className="p-3 bg-teal-950/30 border border-teal-500/40 rounded-xl flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold text-teal-300 block">Daily target</span>
                      <span className="text-[11px] text-zinc-400">What we&apos;re aiming for</span>
                    </div>
                    <span className="font-mono text-base font-extrabold text-teal-400">
                      {calculatedTarget} kcal
                    </span>
                  </div>
                )}

                {calculatedTarget > 0 && (
                  <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl space-y-2">
                    <div>
                      <span className="text-xs font-semibold text-zinc-200 block">
                        Protein, carbs, fat
                      </span>
                      <span className="text-[11px] text-zinc-400">Your daily macros</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center font-mono text-xs pt-1">
                      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-2">
                        <span className="text-[10px] text-red-400 block">Protein</span>
                        <span className="font-bold text-zinc-100">{calculatedMacros.proteinGrams}g</span>
                      </div>
                      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-2">
                        <span className="text-[10px] text-blue-400 block">Carbs</span>
                        <span className="font-bold text-zinc-100">{calculatedMacros.carbsGrams}g</span>
                      </div>
                      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-2">
                        <span className="text-[10px] text-amber-400 block">Fat</span>
                        <span className="font-bold text-zinc-100">{calculatedMacros.fatGrams}g</span>
                      </div>
                    </div>
                  </div>
                )}

                {calculatedGoalDetails && (
                  <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl space-y-1">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <span className="text-xs font-semibold text-zinc-200 block">
                          Projected goal date
                        </span>
                        {!calculatedGoalDetails.isMaintain && (
                          <span className="text-[11px] text-zinc-400">
                            Based on your goal speed.
                          </span>
                        )}
                      </div>
                      <span className="font-mono text-xs font-bold text-teal-300 text-right">
                        {calculatedGoalDetails.isMaintain ? '—' : calculatedGoalDate}
                      </span>
                    </div>
                    {!calculatedGoalDetails.isMaintain && calculatedGoalDetails.calculationText && (
                      <p className="text-[11px] text-zinc-400 pt-0.5">
                        {calculatedGoalDetails.calculationText}
                      </p>
                    )}
                    {!calculatedGoalDetails.isMaintain && calculatedGoalDetails.isCappedAtTwoYears && (
                      <p className="text-[11px] text-amber-300 font-medium">
                        Long-term trend — keep logging to refine.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            <p className="text-xs text-zinc-400 text-center pt-1">
              You can change any of this in the Me tab.
            </p>

            <button
              type="button"
              disabled={isLoading || saveButtonPhase !== 'idle' || !allQuestionsComplete}
              onClick={handleSaveAndStart}
              className="w-full bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-zinc-950 font-semibold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors shadow-lg shadow-teal-500/20"
            >
              {saveButtonPhase === 'saving' ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Saving...
                </>
              ) : saveButtonPhase === 'saved' ? (
                <>
                  <Check className="w-4 h-4" />
                  Saved. Opening your diary...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Save and start
                </>
              )}
            </button>
          </div>
        )}

        {/* ==================== FORGOT PASSWORD SCREEN ==================== */}
        {!isInSignupQuestionnaire && flowStage === 'forgot_password' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between pr-6">
              <button
                type="button"
                onClick={() => {
                  setErrorMsg('');
                  setResetSentSuccess(false);
                  setFlowStage('credentials');
                }}
                className="text-zinc-400 hover:text-zinc-200 flex items-center gap-1 text-xs font-medium"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to sign in
              </button>
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-bold text-zinc-100">Reset your password</h3>
              <p className="text-xs text-zinc-400">
                Enter your account email and we&apos;ll send you a password reset link.
              </p>
            </div>

            {errorMsg && (
              <div className="p-2.5 bg-rose-950/60 border border-rose-900/60 rounded-xl text-xs text-rose-300">
                {errorMsg}
              </div>
            )}

            {resetSentSuccess ? (
              <div role="status" aria-live="polite" className="p-3 bg-teal-950/40 border border-teal-500/40 rounded-xl text-xs text-teal-200 space-y-2">
                <p>We sent a reset link to {email}. It expires in 1 hour.</p>
              </div>
            ) : (
              <form onSubmit={handleSendPasswordReset} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-zinc-500 absolute left-3 top-3" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@example.com"
                      required
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-teal-500"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-zinc-950 font-semibold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors shadow-lg shadow-teal-500/20"
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Sending reset link...
                    </>
                  ) : (
                    <>
                      Send reset link
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        )}

        {/* ==================== RESET PASSWORD SCREEN ==================== */}
        {!isInSignupQuestionnaire && flowStage === 'reset_password' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between pr-6">
              <button
                type="button"
                onClick={() => {
                  setErrorMsg('');
                  setFlowStage('credentials');
                }}
                className="text-zinc-400 hover:text-zinc-200 flex items-center gap-1 text-xs font-medium"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to sign in
              </button>
              <span className="font-mono text-xs text-teal-400 font-semibold">Reset Password</span>
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-bold text-zinc-100">Choose a new password</h3>
              <p className="text-xs text-zinc-400">
                {resetToken
                  ? `Setting a new password for ${email}.`
                  : `We sent a 6-digit reset code to ${email}. Enter it below with your new password.`}
              </p>
            </div>

            {errorMsg && (
              <div className="p-2.5 bg-rose-950/60 border border-rose-900/60 rounded-xl text-xs text-rose-300">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleConfirmPasswordReset} className="space-y-4">
              {!resetToken && (
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                    6-digit reset code
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    disabled={isLoading}
                    autoFocus
                    required
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-center text-lg font-mono tracking-[0.35em] text-zinc-100 placeholder:text-zinc-700 focus:outline-none focus:border-teal-500 disabled:opacity-50"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                  New Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-zinc-500 absolute left-3 top-3" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newResetPassword}
                    onChange={(e) => setNewResetPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    minLength={6}
                    required
                    autoFocus={Boolean(resetToken)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-10 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-teal-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-2.5 text-zinc-400 hover:text-zinc-200"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || (!resetToken && verificationCode.trim().length !== 6)}
                className="w-full bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-zinc-950 font-semibold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors shadow-lg shadow-teal-500/20"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Updating password...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Save new password
                  </>
                )}
              </button>
            </form>

            {!resetToken && (
              <div className="text-center pt-1">
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={async () => {
                    setErrorMsg('');
                    setIsLoading(true);
                    try {
                      const res = await api.requestPasswordReset(email.trim());
                      setVerificationCode('');
                      setResendCooldown(res.resendCooldownSeconds || 30);
                    } catch (err: any) {
                      setErrorMsg(
                        err.message ||
                          'Email sending is limited during testing. Use the developer account email to sign up.'
                      );
                    } finally {
                      setIsLoading(false);
                    }
                  }}
                  className="text-xs font-medium text-teal-400 hover:text-teal-300 disabled:text-zinc-500 disabled:no-underline underline transition-colors"
                >
                  {resendCooldown > 0 ? `Resend (${resendCooldown}s)` : 'Resend'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ==================== CREDENTIALS / ACCOUNT DETAILS SCREEN ==================== */}
        {!isInSignupQuestionnaire && flowStage === 'credentials' && (
          <>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
                <Shield className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-zinc-100">
                  {isGuest ? (mode === 'signup' ? 'Create Account' : 'Member Sign In') : 'Account Details'}
                </h3>
                <p className="text-xs text-zinc-400">
                  {isGuest
                    ? 'Your guest data will automatically transfer.'
                    : `Signed in as ${profile?.username || userEmail}`}
                </p>
              </div>
            </div>

            {!isGuest ? (
              <div className="space-y-4">
                <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-300 space-y-1">
                  <span className="text-[10px] font-mono uppercase text-zinc-500 block">Signed-in Username</span>
                  <span className="font-semibold text-zinc-100">{profile?.username || userEmail}</span>
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-1 bg-zinc-950 p-1 rounded-xl border border-zinc-800 mb-4">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('signup');
                      setErrorMsg('');
                    }}
                    className={`py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      mode === 'signup' ? 'bg-teal-500 text-zinc-950' : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    Sign up
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('login');
                      setErrorMsg('');
                    }}
                    className={`py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      mode === 'login' ? 'bg-teal-500 text-zinc-950' : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    Log in
                  </button>
                </div>

                {errorMsg && (
                  <div role="alert" aria-live="polite" className="mb-4 p-2.5 bg-rose-950/60 border border-rose-900/60 rounded-xl text-xs text-rose-300">
                    {errorMsg}
                  </div>
                )}

                <form onSubmit={handleCredentialsSubmit} className="space-y-4">
                  {/* #32 Hidden Honeypot Field */}
                  <div
                    className="forkcount-honeypot absolute -left-[9999px] h-0 w-0 opacity-0 overflow-hidden pointer-events-none"
                    aria-hidden="true"
                  >
                    <label htmlFor="forkcount-company-hp" aria-hidden="true">
                      Leave this field blank
                    </label>
                    <input
                      id="forkcount-company-hp"
                      type="text"
                      name="company_website_hp"
                      tabIndex={-1}
                      aria-hidden="true"
                      autoComplete="off"
                      value={honeypot}
                      onChange={(e) => setHoneypot(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                      Username
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-zinc-500 absolute left-3 top-3" />
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder={mode === 'signup' ? '3–20 characters (letters, numbers, _)' : 'Enter your username'}
                        minLength={mode === 'signup' ? 3 : undefined}
                        maxLength={20}
                        autoComplete="username"
                        required
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-teal-500"
                      />
                    </div>
                    {mode === 'signup' && debouncedUsername.trim() !== '' && validateUsername(debouncedUsername) && (
                      <p className="text-[11px] text-rose-400 mt-1">
                        {validateUsername(debouncedUsername)}
                      </p>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-medium text-zinc-400">
                        Password
                      </label>
                      {mode === 'login' && (
                        <button
                          type="button"
                          onClick={() => {
                            setErrorMsg('');
                            setResetSentSuccess(false);
                            setFlowStage('forgot_password');
                          }}
                          className="text-[11px] text-teal-400 hover:text-teal-300 underline"
                        >
                          Forgot password?
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-zinc-500 absolute left-3 top-3" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={mode === 'login' ? 'Enter your password' : 'Enter a password'}
                        autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                        required
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-10 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-teal-500"
                      />
                      {/* #23 Show/hide password toggle */}
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        className="absolute right-3 top-2.5 text-zinc-400 hover:text-zinc-200"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {mode === 'signup' && (
                    <div>
                      <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                        Confirm Password
                      </label>
                      <div className="relative">
                        <Lock className="w-4 h-4 text-zinc-500 absolute left-3 top-3" />
                        <input
                          type={showConfirmPassword ? 'text' : 'password'}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Confirm your password"
                          autoComplete="new-password"
                          required
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-10 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-teal-500"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword((prev) => !prev)}
                          aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                          className="absolute right-3 top-2.5 text-zinc-400 hover:text-zinc-200"
                        >
                          {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      {confirmPassword.length > 0 && !timingSafeEqualString(password, confirmPassword) && (
                        <p className="text-[11px] text-rose-400 mt-1">
                          Passwords do not match.
                        </p>
                      )}
                    </div>
                  )}

                  <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="accent-teal-500 rounded w-3.5 h-3.5"
                    />
                    <span>Remember me</span>
                  </label>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-zinc-950 font-semibold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors shadow-lg shadow-teal-500/20"
                  >
                    {isLoading ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        {mode === 'signup' ? 'Creating account...' : 'Signing in...'}
                      </>
                    ) : (
                      <>
                        {mode === 'signup' ? 'Create account' : 'Log in'}
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </form>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};
