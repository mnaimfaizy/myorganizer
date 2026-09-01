export { routeApi } from './apiStub';
export {
  submitLoginForm,
  waitForDashboardReady,
  waitForLoginFormInteractive,
  waitForReload,
  waitForSignupFormInteractive,
} from './auth';
export { GroceriesPage } from './GroceriesPage';
export { gotoStable } from './navigation';
export {
  createOwnedVault,
  E2E_VAULT_PHRASE,
  unlockWithPassphrase,
} from './vaultGate';
export {
  UNCLAIMED_VAULT_KEY,
  E2E_USER_ID,
  ownedVaultKey,
  waitForOwnedVault,
  readOwnedVault,
  removeOwnedVault,
} from './vaultStorage';
export {
  createAndUnlockVault,
  identityForEmail,
  login,
  setupBackend,
  signOut,
  signUp,
  writeAddressToVault,
  type IdentityEntry,
} from './multiUserVault';
