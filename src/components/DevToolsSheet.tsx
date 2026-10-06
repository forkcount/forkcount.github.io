import React, { useState, useEffect, useCallback } from 'react';
import {
  Terminal,
  X,
  Sparkles,
  Flag,
  RefreshCw,
  Trash2,
  CheckCircle2,
  Search,
  Mail,
  Send,
  Shield,
  AlertTriangle,
  KeyRound,
  Copy,
  Check,
  UserX
} from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase.js';
import { useApp } from '../context/AppContext.js';
import { api } from '../services/api.js';
import type { CommunityPost, ReportedPostRecord } from '../types/index.js';

interface DevToolsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail?: string | null;
}

function formatSafeTimestamp(value?: string | number | null): string {
  if (value === undefined || value === null || value === '' || value === 'Never') {
    return 'This is your first session';
  }
  const num = Number(value);
  const d = !Number.isNaN(num) && num > 0 ? new Date(num) : new Date(String(value));
  if (Number.isNaN(d.getTime())) {
    return 'This is your first session';
  }
  return d.toLocaleString();
}

export const DevToolsSheet: React.FC<DevToolsSheetProps> = ({
  isOpen,
  onClose,
  userEmail
}) => {
  const { userId } = useApp();
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [deleteToast, setDeleteToast] = useState<string | null>(null);

  // 1. Seed Demo Account state
  const [isSeedingDemo, setIsSeedingDemo] = useState(false);
  const [demoSeedResult, setDemoSeedResult] = useState<{
    email: string;
    password: string;
    daysLogged: number;
    mealsLogged: number;
    exercisesLogged: number;
    weightEntries: number;
    waterGlassesTotal: number;
  } | null>(null);
  const [demoSeedError, setDemoSeedError] = useState<string | null>(null);
  const [copiedDemoCreds, setCopiedDemoCreds] = useState(false);

  // 2. Community moderation state
  const [reportedPosts, setReportedPosts] = useState<Array<ReportedPostRecord & { post: CommunityPost }>>([]);
  const [isLoadingReports, setIsLoadingReports] = useState(false);
  const [moderationNotice, setModerationNotice] = useState<string | null>(null);

  // 3. Account Inspector & Manual Code state
  const [inspectEmailInput, setInspectEmailInput] = useState('');
  const [isInspecting, setIsInspecting] = useState(false);
  const [inspectedAccount, setInspectedAccount] = useState<any | null>(null);
  const [inspectMessage, setInspectMessage] = useState<string | null>(null);
  const [isSendingManualCode, setIsSendingManualCode] = useState(false);

  // 4. Send Test Email state
  const [testEmailRecipient, setTestEmailRecipient] = useState('');
  const [testEmailTemplate, setTestEmailTemplate] = useState<
    'verification_code' | 'password_reset' | 'welcome' | 'weekly_recap' | 'suspicious_login_alert'
  >('verification_code');
  const [isSendingTestEmail, setIsSendingTestEmail] = useState(false);
  const [testEmailStatus, setTestEmailStatus] = useState<string | null>(null);

  // 5. Security Events & Recent Backend Errors state
  const [securitySearch, setSecuritySearch] = useState('');
  const [securityEvents, setSecurityEvents] = useState<any[]>([]);
  const [securityAlerts, setSecurityAlerts] = useState<any[]>([]);
  const [isLoadingSecurity, setIsLoadingSecurity] = useState(false);
  const [recentErrors, setRecentErrors] = useState<any[]>([]);
  const [isLoadingErrors, setIsLoadingErrors] = useState(false);

  // 6. Delete User state
  const [deleteTargetEmail, setDeleteTargetEmail] = useState('');
  const [deleteConfirmEmail, setDeleteConfirmEmail] = useState('');
  const [isDeletingUser, setIsDeletingUser] = useState(false);
  const [deleteUserStatus, setDeleteUserStatus] = useState<string | null>(null);

  const loadReportedPosts = useCallback(async () => {
    setIsLoadingReports(true);
    try {
      const res = await api.devGetReportedPosts();
      setReportedPosts(res.reports || []);
    } catch {
      // ignore
    } finally {
      setIsLoadingReports(false);
    }
  }, []);

  const loadDiagnostics = useCallback(async (searchQuery?: string) => {
    setIsLoadingSecurity(true);
    setIsLoadingErrors(true);
    try {
      const [secRes, errRes] = await Promise.all([
        api.devGetSecurityEvents({ search: searchQuery, limit: 25 }).catch(() => ({
          events: [],
          suspiciousPatterns: { flaggedEventIds: [], eventReasons: {}, alerts: [] }
        })),
        api.devGetRecentErrors().catch(() => ({ errors: [] }))
      ]);
      setSecurityEvents(secRes.events || []);
      setSecurityAlerts(secRes.suspiciousPatterns?.alerts || []);
      setRecentErrors(errRes.errors || []);
    } finally {
      setIsLoadingSecurity(false);
      setIsLoadingErrors(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadReportedPosts();
      loadDiagnostics();
    }
  }, [isOpen, loadReportedPosts, loadDiagnostics]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSeedDemoAccount = async () => {
    setIsSeedingDemo(true);
    setDemoSeedError(null);
    try {
      const res = await api.devSeedDemoAccount();
      setDemoSeedResult({
        email: res.email,
        password: res.password,
        daysLogged: res.daysLogged,
        mealsLogged: res.mealsLogged,
        exercisesLogged: res.exercisesLogged,
        weightEntries: res.weightEntries,
        waterGlassesTotal: res.waterGlassesTotal
      });
    } catch (err: any) {
      setDemoSeedError(err?.message || 'Failed to seed demo account.');
    } finally {
      setIsSeedingDemo(false);
    }
  };

  const handleDeleteReportedPost = async (postId: string) => {
    setModerationNotice(null);
    try {
      const res = await api.devDeleteCommunityPost(postId);
      setReportedPosts(res.reports || []);
      setModerationNotice('Reported post deleted.');
      setTimeout(() => setModerationNotice(null), 3000);
    } catch (err: any) {
      setModerationNotice(err?.message || 'Could not delete post.');
    }
  };

  const handleDismissPostReport = async (reportId: string) => {
    setModerationNotice(null);
    try {
      const res = await api.devDismissCommunityReport(reportId);
      setReportedPosts(res.reports || []);
      setModerationNotice('Report dismissed.');
      setTimeout(() => setModerationNotice(null), 3000);
    } catch (err: any) {
      setModerationNotice(err?.message || 'Could not dismiss report.');
    }
  };

  const handleInspectAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inspectEmailInput.trim()) return;
    setIsInspecting(true);
    setInspectMessage(null);
    setInspectedAccount(null);
    try {
      const res = await api.devInspectAccount(inspectEmailInput.trim());
      if (res.found && res.account) {
        setInspectedAccount(res.account);
      } else {
        setInspectMessage(res.message || 'No account found for that username or email.');
      }
    } catch (err: any) {
      setInspectMessage(err?.message || 'Could not inspect account.');
    } finally {
      setIsInspecting(false);
    }
  };

  const handleSendManualCode = async () => {
    if (!inspectEmailInput.trim()) return;
    setIsSendingManualCode(true);
    setInspectMessage(null);
    try {
      const res = await api.devSendManualCode(inspectEmailInput.trim());
      setInspectMessage(
        res.resendResult?.ok
          ? `Verification code sent to ${res.email}.`
          : `Code generated for ${res.email} (simulated / check logs).`
      );
    } catch (err: any) {
      setInspectMessage(err?.message || 'Failed to send manual verification code.');
    } finally {
      setIsSendingManualCode(false);
    }
  };

  const handleSendTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testEmailRecipient.trim()) return;
    setIsSendingTestEmail(true);
    setTestEmailStatus(null);
    try {
      const res = await api.devSendTestEmail(testEmailRecipient.trim(), testEmailTemplate);
      setTestEmailStatus(
        res.resendResult?.ok
          ? `Sent ${res.templateType} email to ${res.recipientEmail}${res.resendResult.messageId ? ` (ID: ${res.resendResult.messageId})` : ''}.`
          : `Dispatched ${res.templateType} to ${res.recipientEmail} (simulated / no API key).`
      );
    } catch (err: any) {
      setTestEmailStatus(err?.message || 'Failed to send test email.');
    } finally {
      setIsSendingTestEmail(false);
    }
  };

  const handleDeleteUserAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deleteTargetEmail || deleteTargetEmail !== deleteConfirmEmail) return;
    setShowDeleteConfirmModal(true);
  };

  const handleConfirmDeleteUserAccount = async () => {
    setShowDeleteConfirmModal(false);
    setIsDeletingUser(true);
    setDeleteUserStatus(null);
    try {
      const res = await api.devDeleteUser(deleteTargetEmail, deleteConfirmEmail);
      setDeleteUserStatus(res.summary || `Deleted user ${res.deletedEmail}.`);
      setDeleteTargetEmail('');
      setDeleteConfirmEmail('');
      setDeleteToast('Account deleted');
      setTimeout(() => setDeleteToast(null), 4000);

      // Log action to the securityEvents collection
      try {
        await setDoc(doc(db, 'securityEvents', `sec_${Date.now()}`), {
          id: `sec_${Date.now()}`,
          userId: userId || 'admin',
          username: localStorage.getItem('forkcount_user_email') || 'admin',
          eventType: 'ADMIN_DELETE_USER',
          severity: 'HIGH',
          detail: `Permanently deleted user account @${res.deletedEmail || deleteTargetEmail} and all their data.`,
          createdAt: Date.now(),
          ip: '127.0.0.1'
        });
      } catch (secErr) {
        console.error('Failed to log security event:', secErr);
      }
    } catch (err: any) {
      setDeleteUserStatus(err?.message || 'Could not delete user.');
    } finally {
      setIsDeletingUser(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Dev Tools Panel"
      className="fixed inset-0 z-[100] bg-zinc-950/95 backdrop-blur-md flex flex-col overflow-hidden"
    >
      {/* Top Sheet Bar */}
      <div className="border-b border-zinc-850 bg-zinc-900/90 px-4 py-3.5 shrink-0">
        <div className="max-w-md mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-teal-500/15 border border-teal-500/30 flex items-center justify-center text-teal-400">
              <Terminal className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-zinc-100">Dev Tools</h2>
                <span className="px-1.5 py-0.5 rounded bg-teal-500/20 border border-teal-500/40 text-[9px] font-mono font-bold text-teal-300 uppercase tracking-wider">
                  isDev = true
                </span>
              </div>
              <span className="text-[11px] text-zinc-400 block">
                Signed in as @{userEmail || 'housefly'}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close Dev Tools"
            className="p-2 rounded-xl bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-zinc-100 transition-colors flex items-center gap-1 text-xs font-medium"
          >
            <X className="w-4 h-4" />
            <span>Close</span>
          </button>
        </div>
      </div>

      {/* Scrollable Sheet Content */}
      <div className="flex-1 overflow-y-auto px-4 py-5">
        <div className="max-w-md mx-auto space-y-5 pb-12">
          {/* 1. SEED DEMO ACCOUNT */}
          <div className="bg-zinc-900/90 border border-teal-500/30 rounded-2xl p-4 shadow-xl space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-teal-400" />
                <div>
                  <h3 className="text-xs font-bold text-zinc-100">Seed Demo Account</h3>
                  <span className="text-[10px] text-zinc-400 block">
                    Generate a populated 7-day demo user with meals, workouts, weights &amp; water
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSeedDemoAccount}
              disabled={isSeedingDemo}
              className="w-full py-2.5 px-4 bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-zinc-950 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors shadow-lg shadow-teal-500/20"
            >
              {isSeedingDemo ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Seeding Demo Account...
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  Seed Demo Account
                </>
              )}
            </button>

            {demoSeedError && (
              <p className="text-xs text-rose-300 bg-rose-950/50 border border-rose-900/60 rounded-xl p-2.5">
                {demoSeedError}
              </p>
            )}

            {demoSeedResult && (
              <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-teal-300 font-semibold">Demo Account Ready</span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(
                        `${demoSeedResult.email} / ${demoSeedResult.password}`
                      );
                      setCopiedDemoCreds(true);
                      setTimeout(() => setCopiedDemoCreds(false), 2000);
                    }}
                    className="px-2 py-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 rounded-lg text-[10px] text-zinc-200 flex items-center gap-1"
                  >
                    {copiedDemoCreds ? (
                      <>
                        <Check className="w-3 h-3 text-teal-400" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        Copy Credentials
                      </>
                    )}
                  </button>
                </div>
                <div className="font-mono text-[11px] text-zinc-200 space-y-0.5">
                  <div>
                    Email / Username: <span className="text-teal-400">{demoSeedResult.email}</span>
                  </div>
                  <div>
                    Password: <span className="text-teal-400">{demoSeedResult.password}</span>
                  </div>
                  <div className="text-zinc-400 pt-1">
                    {demoSeedResult.daysLogged}d logged · {demoSeedResult.mealsLogged} meals ·{' '}
                    {demoSeedResult.exercisesLogged} workouts · {demoSeedResult.weightEntries} weights
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 2. COMMUNITY MODERATION */}
          <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 shadow-xl space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Flag className="w-4 h-4 text-amber-400" />
                <div>
                  <h3 className="text-xs font-bold text-zinc-100">Community moderation</h3>
                  <span className="text-[10px] text-zinc-400 block">
                    Review reported posts — delete violating posts or dismiss reports
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={loadReportedPosts}
                disabled={isLoadingReports}
                aria-label="Refresh reported posts"
                className="p-1.5 rounded-lg bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingReports ? 'animate-spin text-teal-400' : ''}`} />
              </button>
            </div>

            {moderationNotice && (
              <div
                role="status"
                aria-live="polite"
                className="px-3 py-2 rounded-lg bg-teal-950/60 border border-teal-500/40 text-[11px] text-teal-200 font-medium"
              >
                {moderationNotice}
              </div>
            )}

            {isLoadingReports ? (
              <div className="space-y-2 py-2">
                <div className="h-16 rounded-xl bg-zinc-950 animate-pulse" />
              </div>
            ) : reportedPosts.length === 0 ? (
              <div className="py-5 text-center border border-dashed border-zinc-800 rounded-xl bg-zinc-950/60">
                <p className="text-xs text-zinc-400 font-medium">No reported posts in queue</p>
                <p className="text-[10px] text-zinc-500 mt-0.5">
                  Posts reported by community members will appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {reportedPosts.map((report) => (
                  <div
                    key={report.id}
                    className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-zinc-100">
                            @{report.post?.username || 'user'}
                          </span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300">
                            Reported
                          </span>
                        </div>
                        <span className="text-[10px] text-zinc-500 block mt-0.5">
                          Reported by @{report.reportedByUsername} ·{' '}
                          {formatSafeTimestamp(report.createdAt)}
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-zinc-200 bg-zinc-900 border border-zinc-800/80 rounded-lg p-2.5 whitespace-pre-wrap break-words">
                      {report.post?.text || ''}
                    </p>

                    {report.post?.imageUrl && (
                      <div className="rounded-lg overflow-hidden border border-zinc-800 bg-zinc-900 max-h-36">
                        <img
                          src={report.post.imageUrl}
                          alt="Reported post attachment"
                          className="w-full h-full object-cover max-h-36"
                        />
                      </div>
                    )}

                    {report.reason && (
                      <p className="text-[11px] text-amber-300/90">
                        Reason: <span className="text-zinc-300">{report.reason}</span>
                      </p>
                    )}

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handleDeleteReportedPost(report.postId)}
                        className="flex-1 py-2 px-3 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete post
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDismissPostReport(report.id)}
                        className="flex-1 py-2 px-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold rounded-lg text-xs flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />
                        Dismiss report
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 3. ACCOUNT INSPECTOR & MANUAL CODE */}
          <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 shadow-xl space-y-3">
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-teal-400" />
              <div>
                <h3 className="text-xs font-bold text-zinc-100">Account Inspector &amp; Verification</h3>
                <span className="text-[10px] text-zinc-400 block">
                  Inspect user stats, last sign-in, or dispatch a manual verification code
                </span>
              </div>
            </div>

            <form onSubmit={handleInspectAccount} className="flex gap-2">
              <input
                type="text"
                value={inspectEmailInput}
                onChange={(e) => setInspectEmailInput(e.target.value)}
                placeholder="Username or email (e.g. housefly)..."
                className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-teal-500"
              />
              <button
                type="submit"
                disabled={isInspecting || !inspectEmailInput.trim()}
                className="px-3 py-2 bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-zinc-950 font-bold rounded-xl text-xs transition-colors"
              >
                {isInspecting ? '...' : 'Inspect'}
              </button>
              <button
                type="button"
                onClick={handleSendManualCode}
                disabled={isSendingManualCode || !inspectEmailInput.trim()}
                title="Send manual 6-digit verification code"
                className="px-2.5 py-2 bg-zinc-950 hover:bg-zinc-800 disabled:opacity-50 border border-zinc-800 text-teal-300 rounded-xl text-xs flex items-center gap-1 transition-colors"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Code</span>
              </button>
            </form>

            {inspectMessage && (
              <p className="text-xs text-teal-300 bg-zinc-950 border border-zinc-800 rounded-xl p-2.5">
                {inspectMessage}
              </p>
            )}

            {inspectedAccount && (
              <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3 space-y-1.5 text-[11px] font-mono text-zinc-300">
                <div>
                  User ID: <span className="text-zinc-100">{inspectedAccount.userId}</span>
                </div>
                <div>
                  Email / Username: <span className="text-teal-400">{inspectedAccount.email}</span>
                </div>
                <div>
                  Display Name: <span className="text-zinc-100">{inspectedAccount.displayName}</span>
                </div>
                <div>
                  Created: <span className="text-zinc-100">{formatSafeTimestamp(inspectedAccount.createdDate)}</span>
                </div>
                <div>
                  Last Signed In:{' '}
                  <span className="text-zinc-100">{formatSafeTimestamp(inspectedAccount.lastSignIn)}</span>
                </div>
                <div className="pt-1 text-zinc-400">
                  {inspectedAccount.daysLogged}d logged · {inspectedAccount.mealsLogged} meals ·{' '}
                  {inspectedAccount.weightEntries} weights · {inspectedAccount.currentStreak}d streak ·{' '}
                  {inspectedAccount.totalXP} XP
                </div>
              </div>
            )}
          </div>

          {/* 4. SEND TEST EMAIL */}
          <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 shadow-xl space-y-3">
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-teal-400" />
              <div>
                <h3 className="text-xs font-bold text-zinc-100">Send Test Email</h3>
                <span className="text-[10px] text-zinc-400 block">
                  Verify transactional email templates via Resend
                </span>
              </div>
            </div>

            <form onSubmit={handleSendTestEmail} className="space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="email"
                  value={testEmailRecipient}
                  onChange={(e) => setTestEmailRecipient(e.target.value)}
                  placeholder="Recipient email..."
                  className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-teal-500"
                />
                <select
                  value={testEmailTemplate}
                  onChange={(e) => setTestEmailTemplate(e.target.value as any)}
                  className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-teal-500"
                >
                  <option value="verification_code">Verification Code</option>
                  <option value="password_reset">Password Reset</option>
                  <option value="welcome">Welcome Email</option>
                  <option value="weekly_recap">Weekly Sunday AI Recap</option>
                  <option value="suspicious_login_alert">Suspicious Login Alert</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={isSendingTestEmail || !testEmailRecipient.trim()}
                className="w-full py-2 bg-zinc-950 hover:bg-zinc-850 disabled:opacity-50 border border-teal-500/40 text-teal-300 font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
                {isSendingTestEmail ? 'Sending...' : 'Send Test Email'}
              </button>
            </form>

            {testEmailStatus && (
              <p className="text-[11px] font-mono text-teal-300 bg-zinc-950 border border-zinc-800 rounded-xl p-2.5">
                {testEmailStatus}
              </p>
            )}
          </div>

          {/* 5. SECURITY EVENTS & RECENT ERRORS */}
          <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 shadow-xl space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-teal-400" />
                <div>
                  <h3 className="text-xs font-bold text-zinc-100">Security Events &amp; Error Logs</h3>
                  <span className="text-[10px] text-zinc-400 block">
                    Live audit trail &amp; recent backend exceptions
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => loadDiagnostics(securitySearch)}
                disabled={isLoadingSecurity || isLoadingErrors}
                aria-label="Refresh logs"
                className="p-1.5 rounded-lg bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${isLoadingSecurity || isLoadingErrors ? 'animate-spin text-teal-400' : ''}`}
                />
              </button>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={securitySearch}
                onChange={(e) => setSecuritySearch(e.target.value)}
                placeholder="Filter security events by user, IP, or type..."
                className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-teal-500"
              />
              <button
                type="button"
                onClick={() => loadDiagnostics(securitySearch)}
                className="px-3 py-1.5 bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-xs text-zinc-200"
              >
                Filter
              </button>
            </div>

            {securityAlerts.length > 0 && (
              <div className="space-y-1.5">
                {securityAlerts.map((alert, i) => (
                  <div
                    key={i}
                    className="p-2.5 bg-amber-950/40 border border-amber-500/40 rounded-xl text-[11px] text-amber-200 flex items-start gap-2"
                  >
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold block">{alert.title}</span>
                      <span className="text-amber-300/90">{alert.detail}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1">
              {securityEvents.length === 0 ? (
                <p className="text-[11px] text-zinc-500 text-center py-3 bg-zinc-950 rounded-xl border border-zinc-800">
                  No security events matching filter.
                </p>
              ) : (
                securityEvents.slice(0, 12).map((evt) => (
                  <div
                    key={evt.id}
                    className="p-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-[11px] space-y-0.5"
                  >
                    <div className="flex items-center justify-between font-mono text-[10px] text-zinc-400">
                      <span className="text-teal-400 font-semibold">{evt.eventType}</span>
                      <span>{formatSafeTimestamp(evt.timestampMs || evt.timestamp)}</span>
                    </div>
                    <p className="text-zinc-200 text-xs">{evt.summary}</p>
                  </div>
                ))
              )}
            </div>

            {recentErrors.length > 0 && (
              <div className="pt-2 border-t border-zinc-800 space-y-1.5">
                <span className="text-[10px] font-mono uppercase tracking-wider text-rose-400 block">
                  Recent Backend Errors ({recentErrors.length})
                </span>
                <div className="max-h-32 overflow-y-auto space-y-1.5 pr-1">
                  {recentErrors.slice(0, 5).map((err) => (
                    <div
                      key={err.id}
                      className="p-2 bg-rose-950/30 border border-rose-900/50 rounded-lg text-[10px] font-mono text-rose-200"
                    >
                      <div className="flex justify-between text-rose-400">
                        <span>{err.endpoint}</span>
                        <span>{formatSafeTimestamp(err.timestamp)}</span>
                      </div>
                      <div className="truncate">{err.errorMessage}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 6. DELETE USER ACCOUNT */}
          <div className="bg-zinc-900/90 border border-rose-900/40 rounded-2xl p-4 shadow-xl space-y-3">
            <div className="flex items-center gap-2">
              <UserX className="w-4 h-4 text-rose-400" />
              <div>
                <h3 className="text-xs font-bold text-zinc-100">Delete User Account</h3>
                <span className="text-[10px] text-zinc-400 block">
                  Permanently remove a user account and all associated records
                </span>
              </div>
            </div>

            <form onSubmit={handleDeleteUserAccount} className="space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  value={deleteTargetEmail}
                  onChange={(e) => setDeleteTargetEmail(e.target.value)}
                  placeholder="Target username or email..."
                  className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-rose-500"
                />
                <input
                  type="text"
                  value={deleteConfirmEmail}
                  onChange={(e) => setDeleteConfirmEmail(e.target.value)}
                  placeholder="Re-type to confirm..."
                  className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-rose-500"
                />
              </div>
              <button
                type="submit"
                disabled={
                  isDeletingUser ||
                  !deleteTargetEmail ||
                  deleteTargetEmail !== deleteConfirmEmail
                }
                className="w-full py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white font-bold rounded-xl text-xs transition-colors"
              >
                {isDeletingUser ? 'Deleting Account...' : 'Delete User Permanently'}
              </button>
            </form>

            {deleteUserStatus && (
              <p className="text-[11px] font-mono text-rose-300 bg-zinc-950 border border-zinc-800 rounded-xl p-2.5">
                {deleteUserStatus}
              </p>
            )}
          </div>
        </div>
      </div>

      {showDeleteConfirmModal && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-rose-900/50 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-rose-400">Confirm Permanent Deletion</h3>
            <p className="text-xs text-zinc-300 leading-relaxed">
              You are about to permanently delete <span className="font-mono text-rose-300 font-semibold">@{deleteTargetEmail}</span> and all their data. This cannot be undone.
            </p>
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirmModal(false)}
                className="flex-1 py-2.5 px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-bold rounded-xl text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteUserAccount}
                className="py-2 px-3 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-lg text-[11px] transition-colors shrink-0"
              >
                Delete forever
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteToast && (
        <div className="fixed bottom-6 right-6 z-[160] bg-zinc-950 border border-teal-500/30 text-teal-400 px-4 py-3 rounded-xl shadow-2xl text-xs font-semibold flex items-center gap-2 animate-bounce">
          <span className="w-2 h-2 rounded-full bg-teal-400 animate-ping" />
          {deleteToast}
        </div>
      )}
    </div>
  );
};
