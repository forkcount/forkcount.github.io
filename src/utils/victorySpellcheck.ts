const REJECTED_WORDS_STORAGE_KEY = 'forkcount_rejected_spellchecks';

const sessionRejectedWords: Set<string> = (() => {
  const initial = new Set<string>();
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const raw = window.sessionStorage.getItem(REJECTED_WORDS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            if (typeof item === 'string' && item.trim()) {
              initial.add(item.trim().toLowerCase());
            }
          }
        }
      }
    }
  } catch {
    // Ignore storage access errors
  }
  return initial;
})();

function persistRejectedWords(): void {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.setItem(
        REJECTED_WORDS_STORAGE_KEY,
        JSON.stringify(Array.from(sessionRejectedWords))
      );
    }
  } catch {
    // Ignore storage access errors
  }
}

export function extractCoreWord(token: string): string {
  return token.replace(/^[^a-zA-Z0-9']+|[^a-zA-Z0-9']+$/g, '');
}

export function isWordRejected(word: string): boolean {
  const core = extractCoreWord(word).toLowerCase();
  if (!core) return false;
  return sessionRejectedWords.has(core);
}

export function rejectWordCorrection(word: string): void {
  const core = extractCoreWord(word).toLowerCase();
  if (!core) return;
  if (!sessionRejectedWords.has(core)) {
    sessionRejectedWords.add(core);
    persistRejectedWords();
  }
}

export function getRejectedWordsSnapshot(): string[] {
  return Array.from(sessionRejectedWords);
}

/**
 * Protects acronyms, numbers/alphanumeric codes, camelCase/brand tokens
 * (e.g. "C25K", "PR", "HIIT", "5k", "CrossFit") from ever being altered.
 */
export function isProtectedUserToken(token: string): boolean {
  const core = extractCoreWord(token);
  if (!core) return true;
  // Alphanumeric or numeric tokens (e.g. "C25K", "5k", "10K", "75Hard", "3x5")
  if (/\d/.test(core)) return true;
  // All-uppercase acronyms of 2+ characters (e.g. "PR", "HIIT", "AMRAP", "EMOM", "NSV")
  const lettersOnly = core.replace(/[^a-zA-Z]/g, '');
  if (lettersOnly.length >= 2 && lettersOnly === lettersOnly.toUpperCase()) {
    return true;
  }
  // Internal capital letters indicating custom terms / brands (e.g. "CrossFit", "iPhone")
  if (/[a-z][A-Z]/.test(core)) {
    return true;
  }
  return false;
}

/**
 * Edge-case eligibility rules:
 * - Empty input -> skip
 * - Only 1-2 words -> skip (not enough context)
 * - Longer than 500 characters -> skip
 */
export function shouldRunVictorySpellcheck(text: string): boolean {
  if (!text || text.length > 500) return false;
  const trimmed = text.trim();
  if (!trimmed) return false;
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length <= 2) return false;
  return true;
}

export interface AppliedCorrection {
  originalWord: string;
  originalLower: string;
  correctedWord: string;
  correctedLower: string;
  postAiOriginalCount: number;
}

export interface SpellcheckApplyResult {
  finalText: string;
  changed: boolean;
  appliedFixes: AppliedCorrection[];
}

function countCoreWordsLower(text: string): Map<string, number> {
  const counts = new Map<string, number>();
  const tokens = text.trim().split(/\s+/).filter(Boolean);
  for (const tok of tokens) {
    const core = extractCoreWord(tok).toLowerCase();
    if (core) {
      counts.set(core, (counts.get(core) || 0) + 1);
    }
  }
  return counts;
}

/**
 * Compares AI's suggested text against the user's text word-by-word,
 * skipping any word in the session rejected Set or protected acronyms/codes.
 */
export function applySpellcheckWithOverrides(
  originalText: string,
  aiSuggestedText: string
): SpellcheckApplyResult {
  if (!aiSuggestedText || !aiSuggestedText.trim()) {
    return { finalText: originalText, changed: false, appliedFixes: [] };
  }

  const leadingWs = originalText.match(/^\s*/)?.[0] || '';
  const trailingWs = originalText.match(/\s*$/)?.[0] || '';
  const origTrimmed = originalText.trim();
  const aiTrimmed = aiSuggestedText.trim();

  if (!origTrimmed || origTrimmed === aiTrimmed) {
    return { finalText: originalText, changed: false, appliedFixes: [] };
  }

  const origParts = origTrimmed.split(/(\s+)/);
  const origWords: string[] = [];
  for (let i = 0; i < origParts.length; i += 2) {
    origWords.push(origParts[i]);
  }
  const aiWords = aiTrimmed.split(/\s+/).filter(Boolean);

  const rawFixes: Array<{
    originalWord: string;
    originalLower: string;
    correctedWord: string;
    correctedLower: string;
  }> = [];

  let finalTrimmed = origTrimmed;

  if (origWords.length === aiWords.length) {
    const rebuiltParts = [...origParts];
    for (let i = 0; i < origWords.length; i++) {
      const origTok = origWords[i];
      const aiTok = aiWords[i];
      if (origTok === aiTok) continue;

      const origCore = extractCoreWord(origTok);
      const aiCore = extractCoreWord(aiTok);
      if (
        !origCore ||
        !aiCore ||
        origCore === aiCore ||
        isProtectedUserToken(origTok) ||
        isWordRejected(origCore)
      ) {
        continue;
      }

      rebuiltParts[i * 2] = aiTok;
      rawFixes.push({
        originalWord: origCore,
        originalLower: origCore.toLowerCase(),
        correctedWord: aiCore,
        correctedLower: aiCore.toLowerCase()
      });
    }
    finalTrimmed = rebuiltParts.join('');
  } else {
    // LCS alignment fallback when word count differs (e.g. missing space fixed)
    const m = origWords.length;
    const n = aiWords.length;
    const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
    for (let i = m - 1; i >= 0; i--) {
      for (let j = n - 1; j >= 0; j--) {
        if (origWords[i] === aiWords[j]) {
          dp[i][j] = 1 + dp[i + 1][j + 1];
        } else {
          dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
        }
      }
    }

    const outTokens: string[] = [];
    let i = 0;
    let j = 0;
    while (i < m || j < n) {
      if (i < m && j < n && origWords[i] === aiWords[j]) {
        outTokens.push(origWords[i]);
        i++;
        j++;
        continue;
      }

      const origSeg: string[] = [];
      const aiSeg: string[] = [];
      while (i < m && (j >= n || dp[i + 1][j] >= dp[i][j + 1]) && (j >= n || origWords[i] !== aiWords[j])) {
        origSeg.push(origWords[i]);
        i++;
      }
      while (j < n && (i >= m || dp[i][j + 1] > dp[i + 1]?.[j] || i === m) && (i >= m || origWords[i] !== aiWords[j])) {
        aiSeg.push(aiWords[j]);
        j++;
      }

      const hasBlockedToken = origSeg.some(
        (tok) => isProtectedUserToken(tok) || isWordRejected(tok)
      );
      if (hasBlockedToken || aiSeg.length === 0) {
        outTokens.push(...origSeg);
      } else {
        outTokens.push(...aiSeg);
        for (let k = 0; k < origSeg.length; k++) {
          const origCore = extractCoreWord(origSeg[k]);
          const aiCore = extractCoreWord(aiSeg[Math.min(k, aiSeg.length - 1)] || '');
          if (origCore && aiCore && origCore !== aiCore) {
            rawFixes.push({
              originalWord: origCore,
              originalLower: origCore.toLowerCase(),
              correctedWord: aiCore,
              correctedLower: aiCore.toLowerCase()
            });
          }
        }
      }
    }
    finalTrimmed = outTokens.join(' ');
  }

  const finalText = `${leadingWs}${finalTrimmed}${trailingWs}`;
  const changed = finalText !== originalText && rawFixes.length > 0;
  if (!changed) {
    return { finalText: originalText, changed: false, appliedFixes: [] };
  }

  const postAiCounts = countCoreWordsLower(finalText);
  const appliedFixes: AppliedCorrection[] = rawFixes.map((f) => ({
    ...f,
    postAiOriginalCount: postAiCounts.get(f.originalLower) || 0
  }));

  return {
    finalText,
    changed: true,
    appliedFixes
  };
}

/**
 * Checks whether the user manually reverted any AI correction back to their
 * original spelling, recording reverted words in the session rejected Set.
 */
export function evaluateUserEditAgainstFixes(
  currentText: string,
  activeFixes: AppliedCorrection[],
  originalBeforeAi: string | null
): { revertedAny: boolean; shouldHideHint: boolean } {
  if (!activeFixes.length) {
    return { revertedAny: false, shouldHideHint: true };
  }

  const trimmed = currentText.trim();
  if (!trimmed) {
    return { revertedAny: false, shouldHideHint: true };
  }

  const currentCounts = countCoreWordsLower(currentText);
  let revertedAny = false;
  let remainingActiveFixes = 0;

  for (const fix of activeFixes) {
    const currentOrigCount = currentCounts.get(fix.originalLower) || 0;
    if (currentOrigCount > fix.postAiOriginalCount) {
      rejectWordCorrection(fix.originalWord);
      revertedAny = true;
    } else if ((currentCounts.get(fix.correctedLower) || 0) > 0) {
      remainingActiveFixes++;
    }
  }

  const matchesPreAiOriginal =
    originalBeforeAi !== null && trimmed === originalBeforeAi.trim();

  return {
    revertedAny,
    shouldHideHint: revertedAny || matchesPreAiOriginal || remainingActiveFixes === 0
  };
}
