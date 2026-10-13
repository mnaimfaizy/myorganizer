/** Hard-reloads the current document; the seam tests mock instead of jsdom's location. */
export function reloadPage(): void {
  window.location.reload();
}

/** Hard-navigates to the dashboard; a full document load, not a client-side route change. */
export function goToDashboard(): void {
  window.location.assign('/dashboard');
}
