import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Activity,
  Flame,
  Plus,
  Trash2,
  Info,
  Trophy,
  TrendingUp,
  Ruler,
  Camera,
  BatteryCharging,
  Zap,
  Sparkles
} from 'lucide-react';
import { useApp } from '../context/AppContext.js';
import { api } from '../services/api.js';
import { decipherExerciseText } from '../utils/localAiEngine.js';
import { useDebounce, validateExerciseMinutes } from '../utils/validation.js';
import { formatLocalDate, parseLocalDate, addDaysLocal } from '../utils/dateUtils.js';
import { SwipeableItem } from './SwipeableItem.js';
import { SafeImage } from './SafeImage.js';
import type { BodyMeasurement, ProgressPhoto } from '../types/index.js';

export const FitnessTab: React.FC = () => {
  const {
    userId,
    isLoading,
    activeDate,
    profile,
    stats,
    exercises,
    allExercises,
    addExerciseItem,
    deleteExerciseItem,
    triggerUndoableDelete
  } = useApp();

  // Natural Language In-Code AI Exercise Logger (#16 draft save)
  const [workoutDescription, setWorkoutDescription] = useState<string>(() => {
    return localStorage.getItem('forkcount_draft_exercise_ai') || localStorage.getItem('caloriq_draft_exercise_ai') || '';
  });
  const debouncedWorkoutDescription = useDebounce(workoutDescription, 400);
  const [liftWeightKg, setLiftWeightKg] = useState<string>('');
  const [liftReps, setLiftReps] = useState<string>('');
  const [distanceKm, setDistanceKm] = useState<string>('');
  const [plankSeconds, setPlankSeconds] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [exerciseError, setExerciseError] = useState<string | null>(null);
  const [dailyRecommendation, setDailyRecommendation] = useState<string>('');
  const [latestExerciseRatingText, setLatestExerciseRatingText] = useState<string | null>(null);
  const [isRatingLoading, setIsRatingLoading] = useState(false);
  const [exerciseRatingsById, setExerciseRatingsById] = useState<
    Record<string, { rating: number; feedback: string; formatted: string }>
  >(() => {
    try {
      const raw = localStorage.getItem('forkcount_exercise_ai_ratings_v1') || localStorage.getItem('caloriq_exercise_ai_ratings_v1');
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });
  const recFetchedForDayKeyRef = useRef<string | null>(null);

  useEffect(() => {
    localStorage.setItem('forkcount_draft_exercise_ai', workoutDescription);
  }, [workoutDescription]);

  // #22 Body Measurements
  const [measurements, setMeasurements] = useState<BodyMeasurement[]>([]);
  const [chestCm, setChestCm] = useState('');
  const [waistCm, setWaistCm] = useState('');
  const [armsCm, setArmsCm] = useState('');
  const [hipsCm, setHipsCm] = useState('');
  const [thighCm, setThighCm] = useState('');

  // #23 Before/After Progress Photo Library
  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  const [photoLabel, setPhotoLabel] = useState<'before' | 'after' | 'progress'>('progress');
  const [photoNote, setPhotoNote] = useState('');
  const [compareLeftId, setCompareLeftId] = useState<string>('');
  const [compareRightId, setCompareRightId] = useState<string>('');

  useEffect(() => {
    loadFitnessExtras();
  }, []);

  const loadFitnessExtras = async () => {
    try {
      const [mRes, pRes] = await Promise.all([
        api.getMeasurements(),
        api.getProgressPhotos()
      ]);
      const mList = mRes.items || [];
      const pList = pRes.items || [];
      setMeasurements(mList);
      setPhotos(pList);
      if (pList.length >= 2) {
        const beforeItem = pList.find(p => p.label === 'before') || pList[0];
        const afterItem = pList.find(p => p.label === 'after') || pList[pList.length - 1];
        setCompareLeftId(beforeItem.id);
        setCompareRightId(afterItem.id);
      }
    } catch {
      // ignore
    }
  };

  // #24 Rest day detector: trained 4+ days in a row?
  const consecutiveTrainingDays = useMemo(() => {
    const dates = new Set(allExercises.map(e => e.date));
    let streak = 0;
    const cursor = parseLocalDate(activeDate);
    for (let i = 0; i < 14; i++) {
      const dStr = formatLocalDate(cursor);
      if (dates.has(dStr)) {
        streak++;
        cursor.setDate(cursor.getDate() - 1);
      } else {
        break;
      }
    }
    return streak;
  }, [allExercises, activeDate]);

  // #20 Personal Records auto-detected from logs
  const personalRecords = useMemo(() => {
    let heaviestLift = 0;
    let heaviestLiftName = '—';
    let fastestPaceMinPerKm = Infinity;
    let fastestRunLabel = '—';
    let longestPlankSec = 0;

    for (const ex of allExercises) {
      if (ex.weightKg && ex.weightKg > heaviestLift) {
        heaviestLift = ex.weightKg;
        heaviestLiftName = ex.activityName;
      }
      if (ex.distanceKm && ex.distanceKm > 0 && ex.minutes > 0) {
        const pace = ex.minutes / ex.distanceKm;
        if (pace < fastestPaceMinPerKm) {
          fastestPaceMinPerKm = pace;
          fastestRunLabel = `${pace.toFixed(1)} min/km (${ex.distanceKm}km)`;
        }
      }
      if (ex.plankSeconds && ex.plankSeconds > longestPlankSec) {
        longestPlankSec = ex.plankSeconds;
      }
    }

    return {
      heaviestLift,
      heaviestLiftName,
      fastestRunLabel: fastestPaceMinPerKm === Infinity ? 'Log a run with km' : fastestRunLabel,
      longestPlankSec
    };
  }, [allExercises]);

  // #21 Progressive Overload Chart data (exercises with weightKg)
  const liftHistory = useMemo(() => {
    return allExercises
      .filter(e => e.weightKg && e.weightKg > 0)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-10);
  }, [allExercises]);

  const userWeightKg = profile.currentWeightKg || 70;
  const last7DaysExercises = useMemo(() => {
    const cutoffStr = addDaysLocal(new Date(), -7);
    return allExercises
      .filter((e) => e.date >= cutoffStr)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [allExercises]);

  useEffect(() => {
    const todayStr = formatLocalDate();
    const uidKey = userId || 'user';
    const dayKey = `${uidKey}:${todayStr}`;

    try {
      const raw = localStorage.getItem('forkcount_exercise_ai_rec_v1') || localStorage.getItem('caloriq_exercise_ai_rec_v1');
      const map = raw ? JSON.parse(raw) : {};
      if (map[dayKey]?.recommendation) {
        setDailyRecommendation(map[dayKey].recommendation);
        recFetchedForDayKeyRef.current = dayKey;
        return;
      }
    } catch {
      // ignore storage errors
    }

    if (isLoading) return;
    if (recFetchedForDayKeyRef.current === dayKey) return;
    recFetchedForDayKeyRef.current = dayKey;

    const goalText =
      profile.goalSpeed ||
      profile.goal ||
      (profile.goalWeightKg && profile.currentWeightKg
        ? profile.goalWeightKg < profile.currentWeightKg
          ? 'lose weight'
          : profile.goalWeightKg > profile.currentWeightKg
            ? 'gain muscle'
            : 'maintain weight'
        : 'maintain fitness');
    const activityText = profile.dailyActivity || profile.activity || 'moderate';

    api
      .getExerciseRecommendation({
        userId: uidKey,
        date: todayStr,
        last7DaysExercises: last7DaysExercises.map((e) => ({
          date: e.date,
          activityName: e.activityName,
          minutes: e.minutes,
          caloriesBurned: e.caloriesBurned,
          intensity: e.intensity,
          weightKg: e.weightKg,
          distanceKm: e.distanceKm
        })),
        goal: goalText,
        activityLevel: activityText,
        fitnessLevel: profile.fitnessLevel || 'intermediate'
      })
      .then((res) => {
        if (res?.recommendation) {
          setDailyRecommendation(res.recommendation);
        }
      })
      .catch(() => {
        // fallback handled in api/server
      });
  }, [isLoading, userId, last7DaysExercises, profile.goalSpeed, profile.goal, profile.goalWeightKg, profile.currentWeightKg, profile.dailyActivity, profile.activity, profile.fitnessLevel]);

  const decipheredWorkout = useMemo(
    () => decipherExerciseText(debouncedWorkoutDescription, userWeightKg),
    [debouncedWorkoutDescription, userWeightKg]
  );
  const exerciseMinutesWarning =
    debouncedWorkoutDescription.trim() && decipheredWorkout.totalMinutes > 600
      ? validateExerciseMinutes(decipheredWorkout.totalMinutes)
      : null;

  const handleLogExercise = async (e: React.FormEvent) => {
    e.preventDefault();
    setExerciseError(null);
    const liveDeciphered = decipherExerciseText(workoutDescription, userWeightKg);
    if (!workoutDescription.trim() || liveDeciphered.totalCaloriesBurned <= 0) return;

    const minErr = validateExerciseMinutes(Math.max(1, Math.round(liveDeciphered.totalMinutes)));
    if (minErr) {
      setExerciseError(minErr);
      return;
    }

    setIsSubmitting(true);
    try {
      const savedExercise = await addExerciseItem({
        date: activeDate,
        activityName: liveDeciphered.summaryTitle,
        met: liveDeciphered.averageMet,
        minutes: Math.max(1, Math.round(liveDeciphered.totalMinutes)),
        caloriesBurned: liveDeciphered.totalCaloriesBurned,
        intensity: liveDeciphered.overallIntensity,
        weightKg: liftWeightKg ? Number(liftWeightKg) : undefined,
        reps: liftReps ? Number(liftReps) : (liveDeciphered.segments.length === 1 ? liveDeciphered.segments[0].reps : undefined),
        distanceKm: distanceKm ? Number(distanceKm) : undefined,
        plankSeconds: plankSeconds ? Number(plankSeconds) : undefined
      });
      setWorkoutDescription('');
      localStorage.removeItem('forkcount_draft_exercise_ai');
      localStorage.removeItem('caloriq_draft_exercise_ai');
      setLiftWeightKg('');
      setLiftReps('');
      setDistanceKm('');
      setPlankSeconds('');

      if (savedExercise?.id) {
        if (exerciseRatingsById[savedExercise.id]?.formatted) {
          setLatestExerciseRatingText(exerciseRatingsById[savedExercise.id].formatted);
        } else {
          setIsRatingLoading(true);
          try {
            const ratingRes = await api.rateExercise({
              exerciseId: savedExercise.id,
              activityName: savedExercise.activityName,
              minutes: savedExercise.minutes,
              caloriesBurned: savedExercise.caloriesBurned,
              intensity: savedExercise.intensity,
              met: savedExercise.met,
              weightKg: savedExercise.weightKg,
              reps: savedExercise.reps,
              distanceKm: savedExercise.distanceKm,
              plankSeconds: savedExercise.plankSeconds,
              recentExercises: last7DaysExercises.map((ex) => ({
                date: ex.date,
                activityName: ex.activityName,
                minutes: ex.minutes,
                caloriesBurned: ex.caloriesBurned,
                intensity: ex.intensity
              })),
              goal: profile.goalSpeed || profile.goal || 'general fitness',
              activityLevel: profile.dailyActivity || profile.activity || 'moderate'
            });
            if (ratingRes?.formatted) {
              setLatestExerciseRatingText(ratingRes.formatted);
              setExerciseRatingsById((prev) => ({
                ...prev,
                [savedExercise.id]: ratingRes
              }));
            }
          } catch {
            // ignore rating errors
          } finally {
            setIsRatingLoading(false);
          }
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddMeasurement = async (e: React.FormEvent) => {
    e.preventDefault();
    const entry = await api.addMeasurement({
      date: activeDate,
      chestCm: chestCm ? Number(chestCm) : undefined,
      waistCm: waistCm ? Number(waistCm) : undefined,
      armsCm: armsCm ? Number(armsCm) : undefined,
      hipsCm: hipsCm ? Number(hipsCm) : undefined,
      thighCm: thighCm ? Number(thighCm) : undefined
    });
    setMeasurements(prev => [...prev, entry].sort((a, b) => a.date.localeCompare(b.date)));
    setChestCm('');
    setWaistCm('');
    setArmsCm('');
    setHipsCm('');
    setThighCm('');
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = String(reader.result);
      const saved = await api.addProgressPhoto({
        date: activeDate,
        label: photoLabel,
        dataUrl,
        weightKg: profile.currentWeightKg,
        note: photoNote.trim() || undefined
      });
      setPhotos(prev => {
        const next = [...prev, saved];
        if (!compareLeftId) setCompareLeftId(saved.id);
        else if (!compareRightId) setCompareRightId(saved.id);
        return next;
      });
      setPhotoNote('');
    };
    reader.readAsDataURL(file);
  };

  const totalDayBurn = exercises.reduce((sum, e) => sum + (e.caloriesBurned || 0), 0);
  const workoutStreak = stats.workoutStreak ?? consecutiveTrainingDays;

  const leftPhoto = photos.find(p => p.id === compareLeftId) || photos[0];
  const rightPhoto = photos.find(p => p.id === compareRightId) || photos[photos.length - 1];

  return (
    <div className="space-y-5 pb-8 max-w-md mx-auto">
      {/* #25 Overview Card + Workout Streak */}
      <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-5 shadow-xl flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
              Total Burned Today
            </span>
            <span className="px-2 py-0.5 rounded-full bg-teal-500/15 border border-teal-500/30 text-[10px] font-mono font-bold text-teal-300 flex items-center gap-1">
              <Zap className="w-2.5 h-2.5" />
              {workoutStreak}d Workout Streak
            </span>
          </div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-3xl font-extrabold text-teal-400 font-mono">
              +{totalDayBurn}
            </span>
            <span className="text-xs text-zinc-400 font-mono">kcal</span>
          </div>
          <span className="text-[11px] text-zinc-500 mt-1 block">
            Burned calories expand today&apos;s eating target automatically.
          </span>
        </div>

        <div className="w-14 h-14 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
          <Flame className="w-7 h-7" />
        </div>
      </div>

      {/* #24 Rest Day Suggestion Card (trained 4+ days in a row) */}
      {consecutiveTrainingDays >= 4 && (
        <div className="bg-amber-950/30 border border-amber-700/50 rounded-2xl p-4 flex items-start gap-3">
          <BatteryCharging className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-xs font-bold text-amber-300">
              Rest Day Recommended ({consecutiveTrainingDays} Days Trained in a Row)
            </h4>
            <p className="text-[11px] text-zinc-300 mt-0.5 leading-relaxed">
              You have logged training {consecutiveTrainingDays} consecutive days. Consider active recovery, mobility work, or a full rest day to support muscle repair and nervous system recovery.
            </p>
          </div>
        </div>
      )}

      {/* Log Exercise Box (In-Code AI Natural Language Decipherer) */}
      <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-teal-400" />
            <h3 className="text-sm font-semibold text-zinc-200">Log Exercise</h3>
          </div>
          <button
            type="button"
            onClick={() =>
              setWorkoutDescription(
                '2 min warm-up slow jog, 10 min steady-pace run, followed by 24 min brisk walking intervals'
              )
            }
            className="text-[11px] text-teal-400 hover:text-teal-300 underline cursor-pointer"
          >
            Try example
          </button>
        </div>

        {/* Recommended for you card (above the exercise log, cached once per day) */}
        <div className="bg-zinc-950/90 border border-teal-500/25 rounded-xl px-3.5 py-2.5 flex items-start gap-2.5">
          <Sparkles className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-teal-400 block">
              Recommended for you
            </span>
            <p className="text-xs text-zinc-200 leading-relaxed mt-0.5">
              {dailyRecommendation || 'Checking your last 7 days of workouts...'}
            </p>
          </div>
        </div>

        <form onSubmit={handleLogExercise} className="space-y-3.5">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">
              Describe your workout in your own words
            </label>
            <textarea
              rows={3}
              value={workoutDescription}
              onChange={(e) => setWorkoutDescription(e.target.value)}
              placeholder="e.g., 2 min warm-up slow jog, 10 min steady-pace run, followed by 24 min brisk walking intervals"
              required
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-teal-500 resize-none leading-relaxed"
            />
          </div>

          {/* Calculated Calories Burned Box Below */}
          <div className="bg-zinc-950 border border-teal-500/30 rounded-xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 block">
                  Calculated Calories Burned
                </span>
                <span className="text-xs text-zinc-300 font-medium">
                  {workoutDescription.trim()
                    ? decipheredWorkout.summaryTitle
                    : 'Type your activity above to decipher'}
                </span>
              </div>
              <div className="text-right">
                <span className="text-2xl font-extrabold text-teal-400 font-mono">
                  {decipheredWorkout.totalCaloriesBurned}
                </span>
                <span className="text-xs text-zinc-400 font-mono ml-1">kcal</span>
              </div>
            </div>

            {decipheredWorkout.segments.length > 0 && (
              <div className="pt-2 border-t border-zinc-800/80 space-y-1.5">
                {decipheredWorkout.segments.map((seg, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between text-[11px] bg-zinc-900/70 px-2.5 py-1.5 rounded-lg border border-zinc-800/70"
                  >
                    <div className="truncate pr-2">
                      <span className="text-zinc-200 font-medium">{seg.activityName}</span>
                      <span className="text-zinc-500 font-mono ml-1.5">
                        ({seg.reps ? `${seg.reps} reps · ` : ''}{seg.minutes} min · MET {seg.met} · {seg.intensity})
                      </span>
                    </div>
                    <span className="font-mono font-semibold text-teal-400 shrink-0">
                      +{seg.caloriesBurned} kcal
                    </span>
                  </div>
                ))}
                <div className="text-[10px] text-zinc-500 flex items-center gap-1 pt-0.5">
                  <Info className="w-3 h-3 text-teal-400 shrink-0" />
                  <span>{decipheredWorkout.explanation}</span>
                </div>
              </div>
            )}
          </div>

          {/* Optional PR & Progressive Overload inputs */}
          <div className="grid grid-cols-4 gap-2 pt-1">
            <div>
              <label className="block text-[10px] text-zinc-500 mb-1">Lift (kg)</label>
              <input
                type="number"
                step="0.5"
                value={liftWeightKg}
                onChange={(e) => setLiftWeightKg(e.target.value)}
                placeholder="80"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs font-mono text-zinc-100 focus:outline-none focus:border-teal-500"
              />
            </div>
            <div>
              <label className="block text-[10px] text-zinc-500 mb-1">Reps</label>
              <input
                type="number"
                value={liftReps}
                onChange={(e) => setLiftReps(e.target.value)}
                placeholder="8"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs font-mono text-zinc-100 focus:outline-none focus:border-teal-500"
              />
            </div>
            <div>
              <label className="block text-[10px] text-zinc-500 mb-1">Run (km)</label>
              <input
                type="number"
                step="0.1"
                value={distanceKm}
                onChange={(e) => setDistanceKm(e.target.value)}
                placeholder="5.0"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs font-mono text-zinc-100 focus:outline-none focus:border-teal-500"
              />
            </div>
            <div>
              <label className="block text-[10px] text-zinc-500 mb-1">Plank (s)</label>
              <input
                type="number"
                value={plankSeconds}
                onChange={(e) => setPlankSeconds(e.target.value)}
                placeholder="90"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs font-mono text-zinc-100 focus:outline-none focus:border-teal-500"
              />
            </div>
          </div>

          {(exerciseError || exerciseMinutesWarning) && (
            <div className="p-2.5 bg-rose-950/60 border border-rose-900/60 rounded-xl text-xs text-rose-300">
              {exerciseError || exerciseMinutesWarning}
            </div>
          )}

          <button
            type="submit"
            disabled={
              isSubmitting ||
              !workoutDescription.trim() ||
              decipheredWorkout.totalCaloriesBurned <= 0 ||
              Boolean(exerciseMinutesWarning)
            }
            className="w-full bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-zinc-950 font-semibold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors shadow-lg shadow-teal-500/20"
          >
            {isSubmitting ? (
              <span>Calculating...</span>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                <span>Save Exercise</span>
              </>
            )}
          </button>
        </form>

        {(isRatingLoading || latestExerciseRatingText) && (
          <div className="bg-zinc-950 border border-teal-500/30 rounded-xl px-3.5 py-2.5 flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
            <p className="text-xs text-zinc-200 font-medium leading-relaxed">
              {isRatingLoading ? 'Rating your workout...' : latestExerciseRatingText}
            </p>
          </div>
        )}
      </div>

      {/* #20 PERSONAL RECORDS (Auto-detected from logs) */}
      <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-5 shadow-xl space-y-3">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-teal-400" />
          <h4 className="text-sm font-semibold text-zinc-200">Personal Records (Auto-Detected)</h4>
        </div>
        <div className="grid grid-cols-3 gap-2.5 text-center">
          <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-2.5">
            <span className="text-[10px] text-zinc-500 uppercase block">Heaviest Lift</span>
            <span className="text-sm font-bold text-teal-400 font-mono block mt-0.5">
              {personalRecords.heaviestLift > 0 ? `${personalRecords.heaviestLift} kg` : '—'}
            </span>
            <span className="text-[9px] text-zinc-500 truncate block">{personalRecords.heaviestLiftName}</span>
          </div>
          <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-2.5">
            <span className="text-[10px] text-zinc-500 uppercase block">Fastest Run</span>
            <span className="text-xs font-bold text-teal-400 font-mono block mt-1">
              {personalRecords.fastestRunLabel}
            </span>
          </div>
          <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-2.5">
            <span className="text-[10px] text-zinc-500 uppercase block">Longest Plank</span>
            <span className="text-sm font-bold text-teal-400 font-mono block mt-0.5">
              {personalRecords.longestPlankSec > 0 ? `${personalRecords.longestPlankSec}s` : '—'}
            </span>
          </div>
        </div>
      </div>

      {/* #21 PROGRESSIVE OVERLOAD CHART */}
      <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-5 shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-teal-400" />
            <h4 className="text-sm font-semibold text-zinc-200">Progressive Overload</h4>
          </div>
          <span className="text-[10px] text-zinc-500 font-mono">Weight × Reps</span>
        </div>

        {liftHistory.length === 0 ? (
          <p className="text-xs text-zinc-500 text-center py-3 border border-dashed border-zinc-800 rounded-xl">
            Enter Lift (kg) and Reps above when logging strength sessions to chart progressive overload.
          </p>
        ) : (
          <div className="space-y-2">
            <div className="h-28 flex items-end justify-between gap-2 bg-zinc-950 border border-zinc-800 rounded-xl p-3">
              {(() => {
                const maxW = Math.max(...liftHistory.map(l => l.weightKg || 1), 50);
                return liftHistory.map((item) => {
                  const pct = Math.max(15, Math.round(((item.weightKg || 0) / maxW) * 100));
                  return (
                    <div key={item.id} className="flex-1 flex flex-col items-center h-full justify-end">
                      <span className="text-[9px] font-mono text-teal-400 mb-1">
                        {item.weightKg}kg{item.reps ? `×${item.reps}` : ''}
                      </span>
                      <div className="w-full max-w-[24px] bg-teal-500/80 rounded-t-md" style={{ height: `${pct}%` }} />
                      <span className="text-[9px] font-mono text-zinc-500 mt-1">{item.date.slice(5)}</span>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        )}
      </div>

      {/* #22 BODY MEASUREMENTS (Chest, Waist, Arms, Hips, Thigh) */}
      <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-5 shadow-xl space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Ruler className="w-4 h-4 text-teal-400" />
            <h4 className="text-sm font-semibold text-zinc-200">Body Measurements (cm)</h4>
          </div>
          <span className="text-[10px] font-mono text-zinc-500">{measurements.length} entries</span>
        </div>

        <form onSubmit={handleAddMeasurement} className="space-y-2.5">
          <div className="grid grid-cols-5 gap-1.5">
            <input
              type="number"
              step="0.1"
              value={chestCm}
              onChange={(e) => setChestCm(e.target.value)}
              placeholder="Chest"
              className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs font-mono text-zinc-100 focus:outline-none focus:border-teal-500"
            />
            <input
              type="number"
              step="0.1"
              value={waistCm}
              onChange={(e) => setWaistCm(e.target.value)}
              placeholder="Waist"
              className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs font-mono text-zinc-100 focus:outline-none focus:border-teal-500"
            />
            <input
              type="number"
              step="0.1"
              value={armsCm}
              onChange={(e) => setArmsCm(e.target.value)}
              placeholder="Arms"
              className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs font-mono text-zinc-100 focus:outline-none focus:border-teal-500"
            />
            <input
              type="number"
              step="0.1"
              value={hipsCm}
              onChange={(e) => setHipsCm(e.target.value)}
              placeholder="Hips"
              className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs font-mono text-zinc-100 focus:outline-none focus:border-teal-500"
            />
            <input
              type="number"
              step="0.1"
              value={thighCm}
              onChange={(e) => setThighCm(e.target.value)}
              placeholder="Thigh"
              className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs font-mono text-zinc-100 focus:outline-none focus:border-teal-500"
            />
          </div>
          <button
            type="submit"
            className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 text-teal-400 font-semibold rounded-xl text-xs flex items-center justify-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            Save Measurements for {activeDate}
          </button>
        </form>

        {measurements.length > 0 && (
          <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
            {measurements.slice().reverse().map((m) => (
              <div
                key={m.id}
                className="p-2 bg-zinc-950 border border-zinc-850 rounded-xl flex items-center justify-between text-[11px] font-mono"
              >
                <span className="text-zinc-400">{m.date}</span>
                <div className="flex items-center gap-2 text-zinc-200">
                  {m.chestCm && <span>C:{m.chestCm}</span>}
                  {m.waistCm && <span className="text-teal-400">W:{m.waistCm}</span>}
                  {m.armsCm && <span>A:{m.armsCm}</span>}
                  {m.hipsCm && <span>H:{m.hipsCm}</span>}
                  {m.thighCm && <span>T:{m.thighCm}</span>}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    triggerUndoableDelete(
                      `Deleted measurement (${m.date})`,
                      async () => {
                        setMeasurements(prev => prev.filter(x => x.id !== m.id));
                        await api.deleteMeasurement(m.id);
                      },
                      async () => {
                        const { id: _id, userId: _u, createdAt: _c, ...rest } = m;
                        const restored = await api.addMeasurement(rest);
                        setMeasurements(prev => [...prev, restored]);
                      }
                    )
                  }
                  className="text-zinc-600 hover:text-rose-400"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* #23 BEFORE / AFTER PHOTO LIBRARY (Side-by-Side Compare View) */}
      <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-5 shadow-xl space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Camera className="w-4 h-4 text-teal-400" />
            <h4 className="text-sm font-semibold text-zinc-200">Before / After Photo Library</h4>
          </div>
          <span className="text-[10px] text-zinc-500">Private per user</span>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={photoLabel}
            onChange={(e) => setPhotoLabel(e.target.value as any)}
            className="bg-zinc-950 border border-zinc-800 rounded-xl px-2.5 py-2 text-xs text-zinc-200"
          >
            <option value="before">Before</option>
            <option value="progress">Progress</option>
            <option value="after">After</option>
          </select>
          <input
            type="text"
            value={photoNote}
            onChange={(e) => setPhotoNote(e.target.value)}
            placeholder="Note (optional)"
            className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100"
          />
          <label className="px-3 py-2 bg-teal-500 hover:bg-teal-400 text-zinc-950 font-semibold rounded-xl text-xs cursor-pointer shrink-0 flex items-center gap-1">
            <Camera className="w-3.5 h-3.5" />
            Add
            <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
          </label>
        </div>

        {photos.length >= 2 && leftPhoto && rightPhoto && (
          <div className="space-y-2 pt-1">
            <span className="text-[11px] font-semibold text-zinc-400 block">Side-by-Side Compare</span>
            <div className="grid grid-cols-2 gap-2.5">
              <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-2 space-y-1.5">
                <select
                  value={leftPhoto.id}
                  onChange={(e) => setCompareLeftId(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1 text-[10px] text-zinc-300"
                >
                  {photos.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.label.toUpperCase()} · {p.date}
                    </option>
                  ))}
                </select>
                <SafeImage
                  src={leftPhoto.dataUrl}
                  alt="Before comparison"
                  className="w-full h-36 object-cover rounded-lg border border-zinc-800"
                />
              </div>

              <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-2 space-y-1.5">
                <select
                  value={rightPhoto.id}
                  onChange={(e) => setCompareRightId(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1 text-[10px] text-zinc-300"
                >
                  {photos.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.label.toUpperCase()} · {p.date}
                    </option>
                  ))}
                </select>
                <SafeImage
                  src={rightPhoto.dataUrl}
                  alt="After comparison"
                  className="w-full h-36 object-cover rounded-lg border border-zinc-800"
                />
              </div>
            </div>
          </div>
        )}

        {photos.length === 1 && (
          <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <SafeImage src={photos[0].dataUrl} alt="Progress" className="w-12 h-12 object-cover rounded-lg" />
              <div>
                <span className="text-xs font-semibold text-zinc-200 uppercase block">{photos[0].label}</span>
                <span className="text-[10px] text-zinc-500 font-mono">{photos[0].date} · Add 1 more for side-by-side compare</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Logged Activities List */}
      <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-5 shadow-xl space-y-3">
        <h4 className="text-xs font-semibold text-zinc-300">
          Today&apos;s Logged Exercises ({exercises.length})
        </h4>

        {exercises.length === 0 ? (
          <div className="py-4 text-center text-xs text-zinc-600 border border-dashed border-zinc-800 rounded-xl">
            No exercises logged for today yet.
          </div>
        ) : (
          <div className="space-y-2">
            {exercises.map((item) => (
              <SwipeableItem
                key={item.id}
                itemTitle={item.activityName}
                onSwipeLeftDelete={() => deleteExerciseItem(item.id)}
              >
                <div className="p-3 bg-zinc-950/70 border border-zinc-800 rounded-xl flex items-center justify-between group">
                  <div>
                    <span className="text-xs font-semibold text-zinc-200 block">
                      {item.activityName}
                    </span>
                    <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-mono mt-0.5">
                      <span>{item.reps && !item.weightKg ? `${item.reps} reps · ` : ''}{item.minutes} mins</span>
                      <span>·</span>
                      <span className="text-zinc-400">MET {item.met}</span>
                      <span>·</span>
                      <span className="text-teal-400/80">{item.intensity}</span>
                      {item.weightKg && <span>· {item.weightKg}kg{item.reps ? `×${item.reps}` : ''}</span>}
                      {item.distanceKm && <span>· {item.distanceKm}km</span>}
                    </div>
                    {exerciseRatingsById[item.id]?.formatted && (
                      <p className="text-[11px] text-teal-300/90 mt-1 leading-snug">
                        {exerciseRatingsById[item.id].formatted}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-teal-400 font-mono">
                      +{item.caloriesBurned} kcal
                    </span>
                    <button
                      onClick={() => deleteExerciseItem(item.id)}
                      className="p-1 text-zinc-600 hover:text-rose-400 rounded transition-colors"
                      aria-label="Delete exercise"
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
    </div>
  );
};
