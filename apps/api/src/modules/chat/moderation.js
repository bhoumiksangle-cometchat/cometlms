const BLOCKED_TERMS = ['spam-link', 'pirated-course', 'hate-speech'];
export function moderateMessage(content) {
    const normalized = content.toLowerCase();
    const matchedTerm = BLOCKED_TERMS.find((term) => normalized.includes(term));
    if (!matchedTerm) {
        return { flagged: false };
    }
    return {
        flagged: true,
        reason: `Blocked term detected: ${matchedTerm}`,
    };
}
//# sourceMappingURL=moderation.js.map