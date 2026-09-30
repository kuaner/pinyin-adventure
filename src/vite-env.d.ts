/// <reference types="vite/client" />

declare const __APP_VERSION__: string

/* vite-plugin-pwa 虚拟模块（UpdatePrompt 用；registerType: 'prompt'） */
declare module 'virtual:pwa-register' {
  interface RegisterSWOptions {
    immediate?: boolean
    onNeedRefresh?: () => void
    onOfflineReady?: () => void
    onRegisteredSW?: (url: string, registration: ServiceWorkerRegistration | undefined) => void
    onRegistered?: (registration: ServiceWorkerRegistration | undefined) => void
    onRegisterError?: (error: unknown) => void
  }
  export function registerSW(options?: RegisterSWOptions): (reloadPage?: boolean) => Promise<void>
}
