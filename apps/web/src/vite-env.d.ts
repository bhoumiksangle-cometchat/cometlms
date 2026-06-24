/// <reference types="vite/client" />

// Augments vite/client's ImportMetaEnv (which keeps its `[key: string]: any`
// index signature for all other vars). We only narrow the CometChat vars.
interface ImportMetaEnv {
  readonly VITE_COMETCHAT_APP_ID?: string;
  readonly VITE_COMETCHAT_REGION?: string;
  readonly VITE_COMETCHAT_AUTH_KEY?: string;
}
