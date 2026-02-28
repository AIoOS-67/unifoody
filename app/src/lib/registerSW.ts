export async function registerServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null;

  try {
    const registration = await navigator.serviceWorker.register(
      '/service-worker.js',
      { scope: '/' }
    );
    console.log('[FoodyePay] Service Worker registered:', registration.scope);
    return registration;
  } catch (err) {
    console.error('[FoodyePay] Service Worker registration failed:', err);
    return null;
  }
}
