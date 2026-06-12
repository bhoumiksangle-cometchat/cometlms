const BLOCKED_TERMS = [
  'spam-link',
  'pirated-course',
  'hate-speech',
  // Add more banned terms here
];

const PROFANITY_WORDS = [
  'profanity-test',
  'fuck',
  'shit',
  'bitch',
  'asshole',
  'cunt',
  'dick',
  'pussy',
  'bastard',
  'slut',
  'whore',
  'faggot',
  'nigger',
  'retard',
  'dumbass',
  'jackass',
  'motherfucker',
  'cocksucker',
  'wanker',
  'prick',
  'bollocks',
  'arsehole',
  'crap',
  'piss',
  'goddamn',
  'kill yourself',
  'kys',
  'suicide',
  'cheat',
  'hackers',
  'scammer',
  'exploit',
  'idiot',
  'moron'
];

const SPAM_PATTERNS = [
  /https?:\/\/[^\s]+/gi, // URLs (configurable for blocking)
  /(\b\w+\b)(\s+\1){3,}/gi, // Repeated words
];

interface ModerationResult {
  flagged: boolean;
  reason?: string;
  severity?: 'low' | 'medium' | 'high';
}

/**
 * Check for content policy violations
 * Returns flagged status and reason
 */
export function moderateMessage(content: string): ModerationResult {
  const normalized = content.toLowerCase();

  // 1. Check for blocked terms
  const matchedTerm = BLOCKED_TERMS.find((term) => normalized.includes(term));
  if (matchedTerm) {
    return {
      flagged: true,
      reason: `Blocked term detected: ${matchedTerm}`,
      severity: 'high',
    };
  }

  // 2. Check for profanity
  const hasProfanity = PROFANITY_WORDS.some((word) => normalized.includes(word.toLowerCase()));
  if (hasProfanity) {
    return {
      flagged: true,
      reason: 'Inappropriate language detected',
      severity: 'medium',
    };
  }

  // 3. Check for spam patterns
  for (const pattern of SPAM_PATTERNS) {
    if (pattern.test(content)) {
      if (pattern.source === SPAM_PATTERNS[0].source) {
        // URL pattern
        return {
          flagged: true,
          reason: 'External links are not allowed in this channel',
          severity: 'medium',
        };
      }
      if (pattern.source === SPAM_PATTERNS[1].source) {
        // Repeated words pattern
        return {
          flagged: true,
          reason: 'Message appears to be spam',
          severity: 'low',
        };
      }
    }
  }

  // 4. Check message length (unusually long messages might be spam)
  if (content.length > 5000) {
    return {
      flagged: true,
      reason: 'Message is too long',
      severity: 'low',
    };
  }

  // 5. Check for excessive caps
  const capsRatio = (content.match(/[A-Z]/g) || []).length / content.length;
  if (capsRatio > 0.8 && content.length > 10) {
    return {
      flagged: true,
      reason: 'Excessive capitalization',
      severity: 'low',
    };
  }

  return { flagged: false };
}

/**
 * Rate limit check per user in a room
 * Returns true if user is rate limited
 */
export function checkRateLimit(
  userId: string,
  roomId: string,
  messageTimestamps: Map<string, number[]>,
  maxMessagesPerMinute: number = 10,
): boolean {
  const key = `${userId}-${roomId}`;
  const now = Date.now();
  const oneMinuteAgo = now - 60000;

  if (!messageTimestamps.has(key)) {
    messageTimestamps.set(key, []);
  }

  const timestamps = messageTimestamps.get(key)!;

  // Remove old timestamps outside the 1-minute window
  const recentTimestamps = timestamps.filter((ts) => ts > oneMinuteAgo);
  messageTimestamps.set(key, recentTimestamps);

  // Check if limit exceeded
  if (recentTimestamps.length >= maxMessagesPerMinute) {
    return true; // Rate limited
  }

  // Add current timestamp
  recentTimestamps.push(now);

  return false; // Not rate limited
}

/**
 * Similarity check to detect duplicate or nearly-duplicate messages
 * Returns true if message is similar to recent messages
 */
export function checkSimilarity(content: string, recentMessages: string[], threshold: number = 0.8): boolean {
  if (recentMessages.length === 0) return false;

  const normalizedContent = content.toLowerCase().trim();

  for (const recentMessage of recentMessages) {
    const normalizedRecent = recentMessage.toLowerCase().trim();

    // Simple similarity check (can be enhanced with more sophisticated algorithms)
    if (normalizedContent === normalizedRecent) {
      return true; // Exact duplicate
    }

    // Levenshtein distance similarity
    const similarity = calculateSimilarity(normalizedContent, normalizedRecent);
    if (similarity > threshold) {
      return true; // Similar message
    }
  }

  return false;
}

/**
 * Calculate similarity between two strings using Levenshtein distance
 */
function calculateSimilarity(a: string, b: string): number {
  const aLen = a.length;
  const bLen = b.length;

  if (aLen === 0) return bLen === 0 ? 1 : 0;
  if (bLen === 0) return 0;

  const matrix: number[][] = Array.from({ length: bLen + 1 }, () => Array(aLen + 1).fill(0));

  for (let i = 0; i <= aLen; i++) matrix[0][i] = i;
  for (let j = 0; j <= bLen; j++) matrix[j][0] = j;

  for (let j = 1; j <= bLen; j++) {
    for (let i = 1; i <= aLen; i++) {
      const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1, // deletion
        matrix[j - 1][i] + 1, // insertion
        matrix[j - 1][i - 1] + indicator, // substitution
      );
    }
  }

  const distance = matrix[bLen][aLen];
  const maxLength = Math.max(aLen, bLen);
  return 1 - distance / maxLength;
}
