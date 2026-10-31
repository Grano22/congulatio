const MESSAGES: Record<string, string> = {
  'auth/invalid-email': 'That e-mail address does not look right.',
  'auth/missing-email': 'Write your e-mail address first.',
  'auth/missing-password': 'Write your password first.',
  'auth/weak-password': 'Choose a password of at least 6 characters.',
  'auth/email-already-in-use': 'An account with this e-mail already exists. Sign in instead.',
  'auth/invalid-credential': 'The e-mail or password is wrong.',
  'auth/wrong-password': 'The e-mail or password is wrong.',
  'auth/user-not-found': 'The e-mail or password is wrong.',
  'auth/user-disabled': 'This account was disabled by an administrator.',
  'auth/too-many-requests': 'Too many attempts. Wait a moment and try again.',
  'auth/network-request-failed': 'The cloud could not be reached. Check your connection.',
  'auth/popup-closed-by-user': 'The sign-in window was closed before it finished.',
  'auth/cancelled-popup-request': 'The sign-in window was closed before it finished.',
  'auth/popup-blocked': 'The browser blocked the sign-in window. Allow pop-ups for this site.',
  'auth/credential-already-in-use': 'That account is already used by another traveller. Sign in with it instead.',
  'auth/provider-already-linked': 'This sign-in method is already linked to your account.',
  'auth/requires-recent-login': 'Sign in again before changing this.',
  'auth/operation-not-allowed': 'This sign-in method is turned off in the Firebase console.',
  'auth/admin-restricted-operation': 'This sign-in method is turned off in the Firebase console.',
  'auth/unauthorized-domain': 'This site is not on the authorised domains list in the Firebase console.',
  'permission-denied': 'The cloud refused the request. Check the security rules.',
  'storage/unauthorized': 'The cloud refused the upload. Check the storage rules.',
  'storage/quota-exceeded': 'The cloud storage bucket is full.',
  'unavailable': 'The cloud could not be reached. Your work stays in this browser.',
};

export function cloudErrorMessage(error: unknown, fallback = 'Something went wrong in the cloud.'): string {
  const code = typeof error === 'object' && error !== null && 'code' in error ? String((error as { code: unknown }).code) : '';
  return MESSAGES[code] ?? (error instanceof Error && !code && error.message ? error.message : fallback);
}
