/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** base URL of the cloud-save service; empty disables cloud saves */
  readonly VITE_SYNC_URL?: string
}
interface ImportMeta {
  readonly env: ImportMetaEnv
}
