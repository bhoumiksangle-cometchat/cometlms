// CometChat configuration sourced from Vite environment variables.
// All values are public (App ID / Region / Auth Key are safe for client use in
// development). In production the Auth Key is replaced by server-minted auth
// tokens — see Task 2 (loginWithAuthToken) and the cometchat-production guide.

export const cometChatConfig = {
  appId: import.meta.env.VITE_COMETCHAT_APP_ID ?? '',
  region: import.meta.env.VITE_COMETCHAT_REGION ?? '',
  authKey: import.meta.env.VITE_COMETCHAT_AUTH_KEY ?? '',
};

export function isCometChatConfigured(): boolean {
  return Boolean(cometChatConfig.appId && cometChatConfig.region);
}
