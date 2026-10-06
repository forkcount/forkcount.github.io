import React, { useState, useEffect } from 'react';
import {
  Users,
  Share2,
  Droplets,
  Send,
  UserPlus,
  Trash2,
  ShieldCheck,
  Download,
  Check,
  ChefHat
} from 'lucide-react';
import { useApp } from '../context/AppContext.js';
import { api } from '../services/api.js';
import { ConfirmDialog } from './ConfirmDialog.js';
import { SwipeableItem } from './SwipeableItem.js';
import { SafeImage } from './SafeImage.js';
import { formatLocalDate } from '../utils/dateUtils.js';
import type { FriendRecord, SharedRecipeRecord, SavedRecipe } from '../types/index.js';

export const SocialAccountabilitySection: React.FC = () => {
  const {
    profile,
    updateUserProfile,
    stats,
    allDiaryItems,
    allExercises,
    waterGlasses,
    macroTarget,
    triggerUndoableDelete
  } = useApp();

  const [friends, setFriends] = useState<FriendRecord[]>([]);
  const [sharedRecipes, setSharedRecipes] = useState<SharedRecipeRecord[]>([]);
  const [savedRecipes, setSavedRecipes] = useState<SavedRecipe[]>([]);
  const [friendUsername, setFriendUsername] = useState('');
  const [isPartnerInvite, setIsPartnerInvite] = useState(false);
  const [friendToRemove, setFriendToRemove] = useState<FriendRecord | null>(null);

  // #43 Share a progress card state
  const [hideWeightOnCard, setHideWeightOnCard] = useState(true);
  const [cardPreviewUrl, setCardPreviewUrl] = useState<string | null>(null);

  // #46 Share a recipe state
  const [selectedRecipeId, setSelectedRecipeId] = useState('');
  const [recipeRecipient, setRecipeRecipient] = useState('');
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  useEffect(() => {
    loadSocialData();
  }, []);

  const loadSocialData = async () => {
    try {
      const [socRes, recRes] = await Promise.all([
        api.getSocial(),
        api.getSavedRecipes()
      ]);
      const fakeSet = new Set(['claire_m', 'marcus_r', 'elena_v']);
      const realFriends = (socRes.friends || []).filter(
        (f: FriendRecord) => !fakeSet.has((f.username || '').toLowerCase())
      );
      setFriends(realFriends);
      setSharedRecipes(socRes.sharedRecipes || []);
      const loadedRecipes = recRes.recipes || [];
      setSavedRecipes(loadedRecipes);
      if (loadedRecipes.length > 0 && !selectedRecipeId) {
        setSelectedRecipeId(loadedRecipes[0].id);
      }
    } catch {
      // ignore
    }
  };

  // #43 Generate clean PNG Progress Card via Canvas (with or without weight numbers)
  const handleGenerateProgressCard = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 720;
    canvas.height = 460;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Background
    ctx.fillStyle = '#09090b';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Border card
    ctx.strokeStyle = '#14b8a6';
    ctx.lineWidth = 2;
    ctx.strokeRect(24, 24, canvas.width - 48, canvas.height - 48);

    // Header
    ctx.fillStyle = '#14b8a6';
    ctx.font = 'bold 16px Inter, sans-serif';
    ctx.fillText('CALORIQ · WEEKLY PROGRESS SNAPSHOT', 54, 72);

    ctx.fillStyle = '#f4f4f5';
    ctx.font = 'bold 32px Inter, sans-serif';
    ctx.fillText(profile.name || 'Athlete', 54, 118);

    // Compute 7-day stats
    const today = new Date();
    const last7: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      last7.push(formatLocalDate(d));
    }
    const loggedDays = new Set(allDiaryItems.filter(i => last7.includes(i.date)).map(i => i.date)).size;
    const weekWorkouts = allExercises.filter(e => last7.includes(e.date)).length;

    // Stat boxes
    const statsList = [
      { label: 'FOOD STREAK', val: `${stats.foodStreak || 0} Days` },
      { label: 'DAYS LOGGED (7D)', val: `${loggedDays} / 7` },
      { label: 'WORKOUTS (7D)', val: `${weekWorkouts} Sessions` },
      {
        label: hideWeightOnCard ? 'DAILY TARGET' : 'CURRENT WEIGHT',
        val: hideWeightOnCard ? `${macroTarget.calories} kcal` : `${profile.currentWeightKg} kg`
      }
    ];

    statsList.forEach((st, idx) => {
      const x = 54 + (idx % 2) * 310;
      const y = 160 + Math.floor(idx / 2) * 115;
      ctx.fillStyle = '#18181b';
      ctx.fillRect(x, y, 285, 92);
      ctx.strokeStyle = '#27272a';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, 285, 92);

      ctx.fillStyle = '#a1a1aa';
      ctx.font = '600 12px monospace';
      ctx.fillText(st.label, x + 20, y + 32);

      ctx.fillStyle = '#14b8a6';
      ctx.font = 'bold 26px monospace';
      ctx.fillText(st.val, x + 20, y + 68);
    });

    ctx.fillStyle = '#71717a';
    ctx.font = '13px Inter, sans-serif';
    ctx.fillText(
      hideWeightOnCard ? 'Weight numbers hidden by user preference' : 'Verified consistency log',
      54,
      412
    );

    setCardPreviewUrl(canvas.toDataURL('image/png'));
  };

  // #44 & #47 Add friend by username / set accountability partner
  const handleAddFriend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!friendUsername.trim()) return;
    const clean = friendUsername.trim().replace(/^@/, '');
    const added = await api.addFriend(clean, isPartnerInvite);
    if (isPartnerInvite) {
      await updateUserProfile({ accountabilityPartner: clean });
      setFriends(prev => [...prev.map(f => ({ ...f, isPartner: false })), added]);
    } else {
      setFriends(prev => [...prev, added]);
    }
    setFriendUsername('');
    setIsPartnerInvite(false);
    setStatusMsg(`Added @${clean} (streak-only view)`);
    setTimeout(() => setStatusMsg(null), 2500);
  };

  const handleSetPartner = async (username: string) => {
    await updateUserProfile({ accountabilityPartner: username });
    setFriends(prev => prev.map(f => ({ ...f, isPartner: f.username === username })));
    setStatusMsg(`@${username} set as your accountability partner`);
    setTimeout(() => setStatusMsg(null), 2500);
  };

  // #46 Share a recipe to another Caloriq user
  const handleShareRecipe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipeRecipient.trim() || savedRecipes.length === 0) return;
    const chosen = savedRecipes.find(r => r.id === selectedRecipeId) || savedRecipes[0];
    if (!chosen) return;
    const payload = {
      toUsername: recipeRecipient.trim().replace(/^@/, ''),
      recipeName: chosen.name,
      calories: chosen.totalCalories,
      protein: chosen.totalProtein,
      carbs: chosen.totalCarbs,
      fat: chosen.totalFat
    };

    const rec = await api.shareRecipe(payload);
    setSharedRecipes(prev => [rec, ...prev]);
    setRecipeRecipient('');
    setStatusMsg(`Sent "${payload.recipeName}" to @${payload.toUsername}`);
    setTimeout(() => setStatusMsg(null), 2500);
  };

  const partnerFriend = friends.find(
    f =>
      (f.isPartner || f.username === profile.accountabilityPartner) &&
      !['claire_m', 'marcus_r', 'elena_v'].includes((f.username || '').toLowerCase())
  );

  return (
    <div className="space-y-5">
      {/* #43 SHARE A PROGRESS CARD */}
      <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-5 shadow-xl space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Share2 className="w-4 h-4 text-teal-400" />
            <h4 className="text-sm font-semibold text-zinc-200">Share Weekly Progress Card</h4>
          </div>
          <label className="flex items-center gap-1.5 text-[11px] text-zinc-400 cursor-pointer">
            <input
              type="checkbox"
              checked={hideWeightOnCard}
              onChange={(e) => setHideWeightOnCard(e.target.checked)}
              className="accent-teal-500 rounded"
            />
            Hide weight numbers
          </label>
        </div>

        <button
          type="button"
          onClick={handleGenerateProgressCard}
          className="w-full py-2 bg-teal-500/15 hover:bg-teal-500/25 border border-teal-500/30 text-teal-300 font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors"
        >
          <Share2 className="w-3.5 h-3.5" />
          Generate Clean Weekly Image
        </button>

        {cardPreviewUrl && (
          <div className="space-y-2 pt-1">
            <SafeImage
              src={cardPreviewUrl}
              alt="Weekly progress card"
              className="w-full rounded-xl border border-zinc-800"
            />
            <a
              href={cardPreviewUrl}
              download={`caloriq-progress-${formatLocalDate()}.png`}
              className="w-full py-2 bg-teal-500 text-zinc-950 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              Download Progress Card PNG
            </a>
          </div>
        )}
      </div>

      {/* #44 FRIENDS (STREAK-ONLY) & #47 ACCOUNTABILITY PARTNER & #45 WEEKLY WATER CHALLENGE */}
      <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-teal-400" />
            <div>
              <h4 className="text-sm font-semibold text-zinc-200">Friends &amp; Accountability</h4>
              <span className="text-[10px] text-zinc-500 block">
                Privacy-first: friends see each other&apos;s streak only, nothing else.
              </span>
            </div>
          </div>
        </div>

        {statusMsg && (
          <div className="p-2.5 bg-teal-950/50 border border-teal-800/60 rounded-xl text-xs text-teal-300 flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5 text-teal-400" />
            <span>{statusMsg}</span>
          </div>
        )}

        {/* #44 Add friend by username */}
        <form onSubmit={handleAddFriend} className="space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={friendUsername}
              onChange={(e) => setFriendUsername(e.target.value)}
              placeholder="Add friend by username (e.g. @alex_runs)"
              className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-teal-500"
            />
            <button
              type="submit"
              className="px-3 py-2 bg-teal-500 hover:bg-teal-400 text-zinc-950 font-semibold rounded-xl text-xs flex items-center gap-1 shrink-0"
            >
              <UserPlus className="w-3.5 h-3.5" />
              Add
            </button>
          </div>
          <label className="flex items-center gap-1.5 text-[11px] text-zinc-400 cursor-pointer">
            <input
              type="checkbox"
              checked={isPartnerInvite}
              onChange={(e) => setIsPartnerInvite(e.target.checked)}
              className="accent-teal-500 rounded"
            />
            Set as my Accountability Partner (gets a gentle ping if I miss 2 days in a row)
          </label>
        </form>

        {/* #47 Accountability Partner Banner */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-4 h-4 text-teal-400 shrink-0" />
            <div>
              <span className="text-xs font-semibold text-zinc-200 block">Accountability Partner</span>
              <span className="text-[10px] text-zinc-500">
                {partnerFriend
                  ? `@${partnerFriend.username} (${partnerFriend.streakDays}d streak)`
                  : 'No partner set yet.'}
              </span>
            </div>
          </div>
        </div>

        {/* Friends List (Streak Only) */}
        {friends.length === 0 ? (
          <p className="text-xs text-zinc-500 text-center py-3 bg-zinc-950/60 border border-zinc-800/80 rounded-xl">
            No friends yet. Add someone by username to get started.
          </p>
        ) : (
          <div className="space-y-1.5">
            {friends.map((f) => (
              <SwipeableItem
                key={f.id}
                itemTitle={`@${f.username}`}
                onSwipeLeftDelete={() => setFriendToRemove(f)}
              >
                <div className="p-2.5 bg-zinc-950/70 border border-zinc-850 rounded-xl flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-zinc-200">@{f.username}</span>
                    {(f.isPartner || profile.accountabilityPartner === f.username) && (
                      <span className="px-1.5 py-0.5 rounded bg-teal-500/15 border border-teal-500/30 text-[9px] text-teal-300 font-mono">
                        Partner
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-teal-400">
                      {f.streakDays}d streak
                    </span>
                    {profile.accountabilityPartner !== f.username && (
                      <button
                        type="button"
                        onClick={() => handleSetPartner(f.username)}
                        className="text-[10px] text-zinc-500 hover:text-teal-300"
                      >
                        Set Partner
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setFriendToRemove(f)}
                      aria-label={`Remove friend @${f.username}`}
                      className="p-1 text-zinc-600 hover:text-rose-400"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </SwipeableItem>
            ))}
          </div>
        )}

        {/* #45 Weekly Water Challenge (Opt-in group goal: 8 glasses/day) */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Droplets className="w-4 h-4 text-cyan-400" />
              <div>
                <span className="text-xs font-semibold text-zinc-200 block">
                  Weekly Water Challenge (8 Glasses / Day)
                </span>
                <span className="text-[10px] text-zinc-500">
                  Opt-in group hydration goal · Today: {waterGlasses}/8 glasses
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => updateUserProfile({ waterChallengeJoined: !profile.waterChallengeJoined })}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors ${
                profile.waterChallengeJoined
                  ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-400'
              }`}
            >
              {profile.waterChallengeJoined ? 'Joined' : 'Join Challenge'}
            </button>
          </div>

          <div className="text-[11px] text-zinc-400 font-mono flex items-center justify-between pt-1 border-t border-zinc-900">
            {profile.waterChallengeJoined ? (
              <>
                <span>Your challenge progress today</span>
                <span className="text-cyan-300">{waterGlasses >= 8 ? '1 / 1 on track' : '0 / 1 on track'}</span>
              </>
            ) : (
              <span>No one has joined this challenge yet. Be the first.</span>
            )}
          </div>
        </div>

        {/* #46 Share a Recipe */}
        <div className="pt-2 border-t border-zinc-800/80 space-y-2.5">
          <div className="flex items-center gap-2">
            <ChefHat className="w-4 h-4 text-teal-400" />
            <span className="text-xs font-semibold text-zinc-200">Share a Saved Recipe</span>
          </div>
          {savedRecipes.length === 0 ? (
            <p className="text-xs text-zinc-500 bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-center">
              You haven&apos;t saved any recipes yet.
            </p>
          ) : (
            <form onSubmit={handleShareRecipe} className="flex gap-2">
              <select
                value={selectedRecipeId}
                onChange={(e) => setSelectedRecipeId(e.target.value)}
                className="bg-zinc-950 border border-zinc-800 rounded-xl px-2.5 py-1.5 text-xs text-zinc-200 max-w-[140px]"
              >
                {savedRecipes.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.totalCalories} kcal)
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={recipeRecipient}
                onChange={(e) => setRecipeRecipient(e.target.value)}
                placeholder="To @username..."
                className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-zinc-100"
              />
              <button
                type="submit"
                className="px-3 py-1.5 bg-teal-500 hover:bg-teal-400 text-zinc-950 font-semibold rounded-xl text-xs flex items-center gap-1 shrink-0"
              >
                <Send className="w-3 h-3" />
                Send
              </button>
            </form>
          )}

          {sharedRecipes.length > 0 && (
            <div className="space-y-1">
              {sharedRecipes.slice(0, 3).map((sr) => (
                <div key={sr.id} className="text-[11px] text-zinc-400 font-mono flex justify-between">
                  <span>Sent &ldquo;{sr.recipeName}&rdquo; to @{sr.toUsername}</span>
                  <span className="text-teal-400">{sr.calories} kcal</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* #18 Two-step confirmation for removing a friend */}
      <ConfirmDialog
        isOpen={Boolean(friendToRemove)}
        title={`Remove @${friendToRemove?.username || ''}?`}
        description={`Are you sure you want to remove @${friendToRemove?.username || ''} from your friends list?`}
        confirmLabel="Continue"
        secondStepLabel="Remove Friend"
        twoStep={true}
        isDestructive={true}
        onConfirm={() => {
          if (!friendToRemove) return;
          const target = friendToRemove;
          setFriendToRemove(null);
          triggerUndoableDelete(
            `Removed @${target.username}`,
            async () => {
              setFriends(prev => prev.filter(x => x.id !== target.id));
              await api.removeFriend(target.id);
            },
            async () => {
              const readded = await api.addFriend(target.username, target.isPartner);
              setFriends(prev => [...prev, readded]);
            }
          );
        }}
        onCancel={() => setFriendToRemove(null)}
      />
    </div>
  );
};
