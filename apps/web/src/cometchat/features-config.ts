/**
 * CometChat managed features configuration.
 *
 * These constants document which CometChat extensions and AI features are
 * enabled for this app. They can be used in components to conditionally show
 * UI for features that require dashboard-side activation.
 *
 * Feature flags are optionally overridable via Vite env vars so different
 * deployments can toggle them without code changes.
 */

// ---------------------------------------------------------------------------
// Extensions (enabled via CometChat Dashboard > Extensions)
// ---------------------------------------------------------------------------

/** Rich text formatting in the message composer (bold, italic, code, etc.) */
export const FEATURE_RICH_TEXT = envFlag('VITE_COMETCHAT_FEATURES_RICH_TEXT', true);

/** Interactive polls within group chats. */
export const FEATURE_POLLS = envFlag('VITE_COMETCHAT_FEATURES_POLLS', true);

/** Sticker packs in the message composer. */
export const FEATURE_STICKERS = envFlag('VITE_COMETCHAT_FEATURES_STICKERS', true);

/** Message translation (auto-translate messages into user's language). */
export const FEATURE_MESSAGE_TRANSLATION = envFlag('VITE_COMETCHAT_FEATURES_TRANSLATION', true);

/** Link preview / URL unfurling for shared links. */
export const FEATURE_LINK_PREVIEW = envFlag('VITE_COMETCHAT_FEATURES_LINK_PREVIEW', true);

/** Collaborative document (Etherpad integration). */
export const FEATURE_COLLABORATIVE_DOC = envFlag('VITE_COMETCHAT_FEATURES_COLLABORATIVE_DOC', false);

/** Collaborative whiteboard. */
export const FEATURE_COLLABORATIVE_WHITEBOARD = envFlag('VITE_COMETCHAT_FEATURES_WHITEBOARD', false);

/** Reactions (emoji reactions on messages). */
export const FEATURE_REACTIONS = envFlag('VITE_COMETCHAT_FEATURES_REACTIONS', true);

/** Threaded replies (reply-in-thread). */
export const FEATURE_THREADS = envFlag('VITE_COMETCHAT_FEATURES_THREADS', true);

// ---------------------------------------------------------------------------
// AI Features (enabled via CometChat Dashboard > AI section + OpenAI key)
// ---------------------------------------------------------------------------

/** AI Smart Replies — suggests contextual quick replies. */
export const FEATURE_AI_SMART_REPLIES = envFlag('VITE_COMETCHAT_FEATURES_AI_SMART_REPLIES', true);

/** AI Conversation Starter — suggests first message for empty conversations. */
export const FEATURE_AI_CONVERSATION_STARTER = envFlag('VITE_COMETCHAT_FEATURES_AI_CONVERSATION_STARTER', true);

/** AI Conversation Summary — summarizes long conversation threads. */
export const FEATURE_AI_CONVERSATION_SUMMARY = envFlag('VITE_COMETCHAT_FEATURES_AI_CONVERSATION_SUMMARY', true);

// ---------------------------------------------------------------------------
// Moderation
// ---------------------------------------------------------------------------

/** Content moderation — auto-flags inappropriate messages. */
export const FEATURE_MODERATION = envFlag('VITE_COMETCHAT_FEATURES_MODERATION', true);

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

/**
 * Reads a Vite env var as a boolean, with a compile-time default.
 * Accepted truthy values: "true", "1", "yes".
 */
function envFlag(key: string, defaultValue: boolean): boolean {
  const raw = (import.meta.env as Record<string, string | undefined>)[key];
  if (raw === undefined || raw === '') return defaultValue;
  return raw === 'true' || raw === '1' || raw === 'yes';
}
