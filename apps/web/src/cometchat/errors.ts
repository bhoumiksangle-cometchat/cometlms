// Pretty-printing helpers for CometChat exceptions.
// CometChatException objects stringify to "[object Object]" with String(e),
// which hides the actual error. Always route caught errors through these.

export function formatCometChatError(e: unknown): string {
  if (e == null) return 'Unknown CometChat error.';
  const err = e as Record<string, unknown>;
  const code =
    (err.code as string | undefined) ?? (err.errorCode as string | undefined);
  const message =
    (err.message as string | undefined) ??
    (err.errorDescription as string | undefined);
  if (code && message) return `[CometChat ${code}] ${message}`;
  if (message) return `[CometChat] ${message}`;
  try {
    return `[CometChat] ${JSON.stringify(e)}`;
  } catch {
    return `[CometChat] ${String(e)}`;
  }
}

const KNOWN_DOC_HINTS: Record<string, string> = {
  ERROR_API_KEY_NOT_FOUND:
    'Auth Key is missing or invalid. Check VITE_COMETCHAT_AUTH_KEY and the dashboard credentials.',
  ERR_UID_NOT_FOUND:
    "The UID doesn't exist in this CometChat app yet. It is created on registration/login sync (Task 2).",
  ERR_AUTH_TOKEN_NOT_FOUND:
    'Auth token is empty or expired. Re-mint it from the backend via the CometChat REST API.',
  AUTH_ERR_BOT:
    'This UID is flagged as a Bot — auth-key login is refused for bots. Use a non-bot UID.',
};

export function logCometChatError(e: unknown): void {
  const formatted = formatCometChatError(e);
  console.error(formatted, e);
  const code =
    (e as { code?: string; errorCode?: string })?.code ??
    (e as { code?: string; errorCode?: string })?.errorCode;
  if (code && KNOWN_DOC_HINTS[code]) {
    console.warn(`[CometChat hint] ${KNOWN_DOC_HINTS[code]}`);
  }
}
