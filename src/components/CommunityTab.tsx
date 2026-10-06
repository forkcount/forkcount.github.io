import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Users,
  Plus,
  Heart,
  MessageCircle,
  Flag,
  UserX,
  Image as ImageIcon,
  X,
  Send,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  UserPlus,
  UserCheck
} from 'lucide-react';
import { useApp } from '../context/AppContext.js';
import { api } from '../services/api.js';
import type { CommunityPost, CommunityReply } from '../types/index.js';

type CommunityFilter = 'all' | 'following' | 'mine';

function formatRelativeTime(timestamp: number): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  });
}

export const CommunityTab: React.FC = () => {
  const { userId, userEmail, profile, isGuest, openAuthModal } = useApp();

  const [filter, setFilter] = useState<CommunityFilter>('all');
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [statusNotice, setStatusNotice] = useState<{ type: 'info' | 'error'; text: string } | null>(null);

  // Guest prompt banner when tapping "New post" or "Reply"
  const [guestPromptMessage, setGuestPromptMessage] = useState<string | null>(null);

  // New Post sheet state
  const [isNewPostOpen, setIsNewPostOpen] = useState<boolean>(false);
  const [newPostText, setNewPostText] = useState<string>('');
  const [newPostImage, setNewPostImage] = useState<string | undefined>(undefined);
  const [isSubmittingPost, setIsSubmittingPost] = useState<boolean>(false);
  const [newPostError, setNewPostError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Selected post detail & replies state
  const [activePostId, setActivePostId] = useState<string | null>(null);
  const [activePost, setActivePost] = useState<CommunityPost | null>(null);
  const [replies, setReplies] = useState<CommunityReply[]>([]);
  const [isLoadingDetail, setIsLoadingDetail] = useState<boolean>(false);
  const [replyText, setReplyText] = useState<string>('');
  const [isSubmittingReply, setIsSubmittingReply] = useState<boolean>(false);
  const [ focusReplyInputOnOpen, setFocusReplyInputOnOpen ] = useState<boolean>(false);
  const replyInputRef = useRef<HTMLTextAreaElement | null>(null);

  const myUsername = (profile?.username || userEmail || '').toLowerCase();

  const loadPosts = useCallback(async (selectedFilter: CommunityFilter = filter) => {
    setIsLoading(true);
    try {
      const res = await api.getCommunityPosts(selectedFilter);
      const validPosts = Array.isArray(res?.posts)
        ? res.posts.filter((p): p is CommunityPost => Boolean(p && typeof p === 'object' && p.id))
        : [];
      setPosts(validPosts);
    } catch {
      setPosts([]);
    } finally {
      setIsLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    loadPosts(filter);
  }, [filter, loadPosts]);

  const openPostDetail = async (post: CommunityPost, focusReply = false) => {
    setActivePostId(post.id);
    setActivePost(post);
    setFocusReplyInputOnOpen(focusReply);
    setIsLoadingDetail(true);
    try {
      const res = await api.getCommunityPostDetail(post.id);
      if (res.post) setActivePost(res.post);
      setReplies(res.replies || []);
    } catch {
      setReplies([]);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  useEffect(() => {
    if (activePostId && focusReplyInputOnOpen && !isLoadingDetail) {
      replyInputRef.current?.focus();
      setFocusReplyInputOnOpen(false);
    }
  }, [activePostId, focusReplyInputOnOpen, isLoadingDetail]);

  const handleTapNewPost = () => {
    if (isGuest) {
      setGuestPromptMessage('Create an account to post.');
      return;
    }
    setGuestPromptMessage(null);
    setNewPostError(null);
    setIsNewPostOpen(true);
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setNewPostImage(reader.result);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isGuest) {
      setNewPostError('Create an account to post.');
      return;
    }
    const trimmed = newPostText.trim();
    if (!trimmed) {
      setNewPostError('Please enter some text for your post.');
      return;
    }
    if (trimmed.length > 500) {
      setNewPostError('Posts can be up to 500 characters.');
      return;
    }

    setIsSubmittingPost(true);
    setNewPostError(null);
    try {
      const res = await api.createCommunityPost(trimmed, newPostImage);
      const fallbackUsername = (profile?.username || userEmail || 'housefly')
        .replace(/^@/, '')
        .split('@')[0];
      const createdPost: CommunityPost =
        res?.post && typeof res.post === 'object' && res.post.id
          ? res.post
          : {
              id: `post_${Date.now()}`,
              userId: userId || 'usr_dev_housefly',
              username: fallbackUsername || 'housefly',
              text: trimmed,
              ...(newPostImage ? { imageUrl: newPostImage } : {}),
              createdAt: Date.now(),
              likeCount: 0,
              replyCount: 0,
              likedByMe: false
            };
      setPosts((prev) => [
        createdPost,
        ...prev.filter((p): p is CommunityPost => Boolean(p && p.id && p.id !== createdPost.id))
      ]);
      setNewPostText('');
      setNewPostImage(undefined);
      setIsNewPostOpen(false);
    } catch (err: any) {
      setNewPostError(err?.message || 'Could not publish post.');
    } finally {
      setIsSubmittingPost(false);
    }
  };

  const handleToggleLike = async (post: CommunityPost, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const optimisticLiked = !post.likedByMe;
    const optimisticCount = Math.max(0, post.likeCount + (optimisticLiked ? 1 : -1));

    setPosts((prev) =>
      prev.map((p) =>
        p.id === post.id
          ? { ...p, likedByMe: optimisticLiked, likeCount: optimisticCount }
          : p
      )
    );
    if (activePost?.id === post.id) {
      setActivePost((prev) =>
        prev ? { ...prev, likedByMe: optimisticLiked, likeCount: optimisticCount } : prev
      );
    }

    try {
      const res = await api.toggleLikeCommunityPost(post.id);
      setPosts((prev) =>
        prev.map((p) =>
          p.id === post.id ? { ...p, likedByMe: res.liked, likeCount: res.likeCount } : p
        )
      );
      if (activePost?.id === post.id) {
        setActivePost((prev) =>
          prev ? { ...prev, likedByMe: res.liked, likeCount: res.likeCount } : prev
        );
      }
    } catch {
      // revert on failure
      loadPosts(filter);
    }
  };

  const handleSubmitReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePost) return;
    if (isGuest) {
      setGuestPromptMessage('Create an account to post.');
      return;
    }
    const trimmed = replyText.trim();
    if (!trimmed) return;

    setIsSubmittingReply(true);
    try {
      const res = await api.addCommunityReply(activePost.id, trimmed);
      if (res?.reply && res.reply.id) {
        setReplies((prev) => [...prev.filter(Boolean), res.reply]);
      }
      setReplyText('');
      setActivePost((prev) =>
        prev ? { ...prev, replyCount: prev.replyCount + 1 } : prev
      );
      setPosts((prev) =>
        prev.map((p) =>
          p.id === activePost.id ? { ...p, replyCount: p.replyCount + 1 } : p
        )
      );
    } catch (err: any) {
      setStatusNotice({ type: 'error', text: err?.message || 'Could not post reply.' });
      setTimeout(() => setStatusNotice(null), 3000);
    } finally {
      setIsSubmittingReply(false);
    }
  };

  const handleReportPost = async (post: CommunityPost, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await api.reportCommunityPost(post.id);
      setStatusNotice({
        type: 'info',
        text: `Reported post by @${post.username} for moderation.`
      });
      setTimeout(() => setStatusNotice(null), 3000);
    } catch (err: any) {
      setStatusNotice({
        type: 'error',
        text: err?.message || 'Could not report post.'
      });
      setTimeout(() => setStatusNotice(null), 3000);
    }
  };

  const handleBlockUser = async (post: CommunityPost, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await api.blockCommunityUser(post.userId || post.username);
      setPosts((prev) =>
        prev.filter(
          (p) =>
            p &&
            p.userId !== post.userId &&
            (p.username || '').toLowerCase() !== (post.username || '').toLowerCase()
        )
      );
      if (activePost && (activePost.userId === post.userId || activePost.username === post.username)) {
        setActivePostId(null);
        setActivePost(null);
      }
      setStatusNotice({
        type: 'info',
        text: `Blocked @${post.username}. Their posts are now hidden.`
      });
      setTimeout(() => setStatusNotice(null), 3000);
    } catch (err: any) {
      setStatusNotice({
        type: 'error',
        text: err?.message || 'Could not block user.'
      });
      setTimeout(() => setStatusNotice(null), 3000);
    }
  };

  const handleToggleFollow = async (post: CommunityPost, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const res = await api.toggleFollowCommunityUser(post.username);
      setPosts((prev) =>
        prev.map((p) =>
          p && (p.username || '').toLowerCase() === (post.username || '').toLowerCase()
            ? { ...p, isFollowingAuthor: res.following }
            : p
        )
      );
      if (activePost && (activePost.username || '').toLowerCase() === (post.username || '').toLowerCase()) {
        setActivePost((prev) => (prev ? { ...prev, isFollowingAuthor: res.following } : prev));
      }
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-4 pb-8 max-w-md mx-auto">
      {/* Header & "New post" button at the top */}
      <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 shadow-xl space-y-3.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400 shrink-0">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-zinc-100">Community</h2>
              <p className="text-[11px] text-zinc-400">
                Share meals, milestones, and questions with other members.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleTapNewPost}
            className="px-3.5 py-2 bg-teal-500 hover:bg-teal-400 text-zinc-950 font-bold rounded-xl text-xs flex items-center gap-1.5 shrink-0 transition-colors shadow-lg shadow-teal-500/20"
          >
            <Plus className="w-4 h-4" />
            New post
          </button>
        </div>

        {/* Filters at the top: All · Following · My posts */}
        <div className="grid grid-cols-3 gap-1.5 bg-zinc-950 p-1 rounded-xl border border-zinc-800">
          {(
            [
              { id: 'all', label: 'All' },
              { id: 'following', label: 'Following' },
              { id: 'mine', label: 'My posts' }
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setActivePostId(null);
                setActivePost(null);
                setFilter(tab.id);
              }}
              className={`py-1.5 px-2.5 rounded-lg text-xs font-semibold transition-colors ${
                filter === tab.id
                  ? 'bg-teal-500 text-zinc-950'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Guest prompt when tapping "New post" or "Reply" */}
      {guestPromptMessage && (
        <div
          role="alert"
          className="p-3.5 bg-zinc-900 border border-teal-500/40 rounded-2xl flex items-center justify-between gap-3 shadow-xl"
        >
          <div className="flex items-center gap-2 text-xs text-zinc-100 font-medium">
            <AlertCircle className="w-4 h-4 text-teal-400 shrink-0" />
            <span>{guestPromptMessage}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                setGuestPromptMessage(null);
                openAuthModal();
              }}
              className="px-3 py-1.5 bg-teal-500 hover:bg-teal-400 text-zinc-950 font-bold rounded-lg text-xs transition-colors"
            >
              Create account
            </button>
            <button
              type="button"
              onClick={() => setGuestPromptMessage(null)}
              aria-label="Dismiss notice"
              className="p-1 text-zinc-400 hover:text-zinc-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Status notice for report/block actions */}
      {statusNotice && (
        <div
          role="status"
          aria-live="polite"
          className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
            statusNotice.type === 'error'
              ? 'bg-rose-950/60 border-rose-800/60 text-rose-200'
              : 'bg-teal-950/60 border-teal-800/60 text-teal-200'
          }`}
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{statusNotice.text}</span>
        </div>
      )}

      {/* Post Detail & Replies View */}
      {activePostId && activePost ? (
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => {
              setActivePostId(null);
              setActivePost(null);
            }}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-400 hover:text-teal-400 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to feed
          </button>

          <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 shadow-xl space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400 font-mono text-xs font-bold">
                  {(activePost.username || 'U').slice(0, 1).toUpperCase()}
                </div>
                <div>
                  <span className="text-xs font-bold text-zinc-100 block">
                    @{activePost.username}
                  </span>
                  <span className="text-[10px] font-mono text-zinc-500">
                    {formatRelativeTime(activePost.createdAt)}
                  </span>
                </div>
              </div>

              {!isGuest &&
                activePost.userId !== userId &&
                (activePost.username || '').toLowerCase() !== myUsername && (
                  <button
                    type="button"
                    onClick={(e) => handleToggleFollow(activePost, e)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border flex items-center gap-1 transition-colors ${
                      activePost.isFollowingAuthor
                        ? 'bg-teal-500/15 border-teal-500/40 text-teal-300'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                    }`}
                  >
                    {activePost.isFollowingAuthor ? (
                      <>
                        <UserCheck className="w-3 h-3" />
                        Following
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-3 h-3" />
                        Follow
                      </>
                    )}
                  </button>
                )}
            </div>

            <p className="text-sm text-zinc-100 whitespace-pre-wrap break-words leading-relaxed">
              {activePost.text}
            </p>

            {activePost.imageUrl && (
              <div className="rounded-xl overflow-hidden border border-zinc-800 bg-zinc-950">
                <img
                  src={activePost.imageUrl}
                  alt={`Post by @${activePost.username}`}
                  className="w-full max-h-80 object-cover"
                />
              </div>
            )}

            <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={(e) => handleToggleLike(activePost, e)}
                  className={`flex items-center gap-1.5 font-medium transition-colors ${
                    activePost.likedByMe
                      ? 'text-rose-400'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <Heart
                    className={`w-4 h-4 ${activePost.likedByMe ? 'fill-rose-400 text-rose-400' : ''}`}
                  />
                  <span>{activePost.likeCount}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (isGuest) {
                      setGuestPromptMessage('Create an account to post.');
                      return;
                    }
                    replyInputRef.current?.focus();
                  }}
                  className="flex items-center gap-1.5 text-zinc-400 hover:text-teal-400 font-medium transition-colors"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>{activePost.replyCount}</span>
                  <span>Reply</span>
                </button>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={(e) => handleReportPost(activePost, e)}
                  className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-amber-400 transition-colors"
                >
                  <Flag className="w-3.5 h-3.5" />
                  <span>Report</span>
                </button>
                {activePost.userId !== userId && (
                  <button
                    type="button"
                    onClick={(e) => handleBlockUser(activePost, e)}
                    className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-rose-400 transition-colors"
                  >
                    <UserX className="w-3.5 h-3.5" />
                    <span>Block User</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Reply box */}
          <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 shadow-xl space-y-3">
            <h3 className="text-xs font-semibold text-zinc-300">
              Replies ({replies.length})
            </h3>

            {isGuest ? (
              <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl flex items-center justify-between gap-2">
                <span className="text-xs text-zinc-400">Create an account to post.</span>
                <button
                  type="button"
                  onClick={() => openAuthModal()}
                  className="px-3 py-1.5 bg-teal-500 hover:bg-teal-400 text-zinc-950 font-bold rounded-lg text-xs transition-colors"
                >
                  Create account
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmitReply} className="space-y-2">
                <textarea
                  ref={replyInputRef}
                  rows={2}
                  maxLength={500}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Write a reply..."
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-teal-500 resize-none"
                />
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-zinc-500">
                    {replyText.length} / 500
                  </span>
                  <button
                    type="submit"
                    disabled={isSubmittingReply || !replyText.trim()}
                    className="px-3.5 py-1.5 bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-zinc-950 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors"
                  >
                    <Send className="w-3.5 h-3.5" />
                    {isSubmittingReply ? 'Posting...' : 'Reply'}
                  </button>
                </div>
              </form>
            )}

            {/* Replies list */}
            {isLoadingDetail ? (
              <div className="space-y-2 py-2">
                <div className="h-14 bg-zinc-950 border border-zinc-800 rounded-xl animate-pulse" />
                <div className="h-14 bg-zinc-950 border border-zinc-800 rounded-xl animate-pulse" />
              </div>
            ) : replies.length === 0 ? (
              <p className="text-xs text-zinc-500 text-center py-4">
                No replies yet. Be the first to reply.
              </p>
            ) : (
              <div className="space-y-2 pt-1">
                {replies.map((reply) => (
                  <div
                    key={reply.id}
                    className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-zinc-200">@{reply.username}</span>
                      <span className="text-[10px] font-mono text-zinc-500">
                        {formatRelativeTime(reply.createdAt)}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-300 whitespace-pre-wrap break-words leading-relaxed">
                      {reply.text}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Feed of posts (newest first) */
        <div className="space-y-3">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((idx) => (
                <div
                  key={idx}
                  className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3 animate-pulse"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-zinc-800" />
                    <div className="w-24 h-4 rounded bg-zinc-800" />
                  </div>
                  <div className="w-full h-12 rounded-xl bg-zinc-800/70" />
                </div>
              ))}
            </div>
          ) : posts.length === 0 ? (
            <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-8 text-center space-y-2 shadow-xl">
              <p className="text-sm font-semibold text-zinc-200">
                {filter === 'following'
                  ? 'No posts from people you follow yet'
                  : filter === 'mine'
                    ? "You haven't posted yet"
                    : 'No posts yet'}
              </p>
              <p className="text-xs text-zinc-500">
                {filter === 'following'
                  ? 'Follow members in the community or add friends in the Me tab to see their posts here.'
                  : 'Tap "New post" above to share an update with the community.'}
              </p>
            </div>
          ) : (
            posts.filter((post): post is CommunityPost => Boolean(post && post.id)).map((post) => (
              <article
                key={post.id}
                onClick={() => openPostDetail(post, false)}
                className="bg-zinc-900/90 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-2xl p-4 shadow-xl space-y-3 cursor-pointer transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400 font-mono text-xs font-bold">
                      {(post.username || 'U').slice(0, 1).toUpperCase()}
                    </div>
                    <div>
                      <span className="text-xs font-bold text-zinc-100 block">
                        @{post.username || 'member'}
                      </span>
                      <span className="text-[10px] font-mono text-zinc-500">
                        {formatRelativeTime(post.createdAt || Date.now())}
                      </span>
                    </div>
                  </div>

                  {!isGuest &&
                    post.userId !== userId &&
                    (post.username || '').toLowerCase() !== myUsername && (
                      <button
                        type="button"
                        onClick={(e) => handleToggleFollow(post, e)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border flex items-center gap-1 transition-colors ${
                          post.isFollowingAuthor
                            ? 'bg-teal-500/15 border-teal-500/40 text-teal-300'
                            : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        {post.isFollowingAuthor ? (
                          <>
                            <UserCheck className="w-3 h-3" />
                            Following
                          </>
                        ) : (
                          <>
                            <UserPlus className="w-3 h-3" />
                            Follow
                          </>
                        )}
                      </button>
                    )}
                </div>

                <p className="text-xs text-zinc-100 whitespace-pre-wrap break-words leading-relaxed">
                  {post.text}
                </p>

                {post.imageUrl && (
                  <div className="rounded-xl overflow-hidden border border-zinc-800 bg-zinc-950">
                    <img
                      src={post.imageUrl}
                      alt={`Post by @${post.username}`}
                      className="w-full max-h-64 object-cover"
                    />
                  </div>
                )}

                <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      onClick={(e) => handleToggleLike(post, e)}
                      aria-label={`Like post by ${post.username}`}
                      className={`flex items-center gap-1.5 font-medium transition-colors ${
                        post.likedByMe
                          ? 'text-rose-400'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      <Heart
                        className={`w-4 h-4 ${post.likedByMe ? 'fill-rose-400 text-rose-400' : ''}`}
                      />
                      <span>{post.likeCount}</span>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isGuest) {
                          setGuestPromptMessage('Create an account to post.');
                          return;
                        }
                        openPostDetail(post, true);
                      }}
                      className="flex items-center gap-1.5 text-zinc-400 hover:text-teal-400 font-medium transition-colors"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>{post.replyCount}</span>
                      <span>Reply</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={(e) => handleReportPost(post, e)}
                      aria-label={`Report post by ${post.username}`}
                      className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-amber-400 transition-colors"
                    >
                      <Flag className="w-3.5 h-3.5" />
                      <span>Report</span>
                    </button>
                    {post.userId !== userId && (
                      <button
                        type="button"
                        onClick={(e) => handleBlockUser(post, e)}
                        aria-label={`Block user ${post.username}`}
                        className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-rose-400 transition-colors"
                      >
                        <UserX className="w-3.5 h-3.5" />
                        <span>Block User</span>
                      </button>
                    )}
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      )}

      {/* New Post Sheet Modal */}
      {isNewPostOpen && (
        <div className="fixed inset-0 z-[90] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-zinc-900 border-t sm:border border-zinc-800 rounded-t-2xl sm:rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-zinc-100">New post</h3>
              <button
                type="button"
                onClick={() => setIsNewPostOpen(false)}
                aria-label="Close new post sheet"
                className="p-1 text-zinc-400 hover:text-zinc-200 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {newPostError && (
              <div role="alert" className="p-2.5 bg-rose-950/60 border border-rose-800/60 rounded-xl text-xs text-rose-300">
                {newPostError}
              </div>
            )}

            <form onSubmit={handleCreatePost} className="space-y-3.5">
              <div>
                <textarea
                  rows={4}
                  maxLength={500}
                  value={newPostText}
                  onChange={(e) => setNewPostText(e.target.value)}
                  placeholder="Share what you're working on (up to 500 characters)..."
                  autoFocus
                  required
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-teal-500 resize-none"
                />
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[10px] text-zinc-500">
                    Max 10 posts per hour
                  </span>
                  <span className="text-[10px] font-mono text-zinc-400">
                    {newPostText.length} / 500
                  </span>
                </div>
              </div>

              {newPostImage && (
                <div className="relative rounded-xl overflow-hidden border border-zinc-800 bg-zinc-950">
                  <img
                    src={newPostImage}
                    alt="Upload preview"
                    className="w-full max-h-48 object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => setNewPostImage(undefined)}
                    aria-label="Remove uploaded image"
                    className="absolute top-2 right-2 p-1.5 bg-zinc-950/80 hover:bg-zinc-900 text-zinc-200 rounded-full border border-zinc-700"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              <div className="flex items-center justify-between gap-2 pt-1">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageFileChange}
                  className="sr-only"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-2 bg-zinc-950 hover:bg-zinc-850 border border-zinc-800 rounded-xl text-xs font-medium text-zinc-300 flex items-center gap-1.5 transition-colors"
                >
                  <ImageIcon className="w-3.5 h-3.5 text-teal-400" />
                  <span>{newPostImage ? 'Change image' : 'Add image'}</span>
                </button>

                <button
                  type="submit"
                  disabled={isSubmittingPost || !newPostText.trim()}
                  className="px-5 py-2 bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-zinc-950 font-bold rounded-xl text-xs transition-colors shadow-lg shadow-teal-500/20"
                >
                  {isSubmittingPost ? 'Posting...' : 'Post'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
