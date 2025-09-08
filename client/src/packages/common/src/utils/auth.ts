/**
 * Check if user has all required authentication tokens
 * @returns true if user is properly authenticated, false otherwise
 */
export function isUserAuthenticated(): boolean {
  const grytToken = localStorage.getItem('token'); // useAccount uses 'token'
  return !!grytToken;
}

/**
 * Clear all authentication data and sign user out
 */
export function signOut(): void {
  // Clear all tokens
  localStorage.removeItem('token'); // useAccount uses 'token'
  
  // Clear all server-specific tokens
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.startsWith('accessToken_') || key.startsWith('serverUserId_'))) {
      keysToRemove.push(key);
    }
  }
  
  keysToRemove.forEach(key => localStorage.removeItem(key));
  
  console.log('🔐 User signed out - all tokens cleared');
}

/**
 * Force sign out user using useAccount logout
 * This function should be called from components that have access to useAccount
 */
export function forceSignOutWithAccount(logout: () => void, reason: string = 'Authentication required'): void {
  console.warn('🚨 Force signing out user:', reason);
  
  // Clear all server-specific tokens first
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.startsWith('accessToken_') || key.startsWith('serverUserId_'))) {
      keysToRemove.push(key);
    }
  }
  
  keysToRemove.forEach(key => localStorage.removeItem(key));
  
  // Use the proper logout function from useAccount
  logout();
  
  console.log('🧹 Force signed out user using useAccount logout');
}

/**
 * Check authentication on app launch and force sign out if missing required tokens
 */
export function checkAuthenticationOnLaunch(): boolean {
  if (!isUserAuthenticated()) {
    signOut(); // Use signOut instead since we don't have access to useAccount here
    return false;
  }
  
  console.log('✅ User authentication verified');
  return true;
}

/**
 * Check if user can use a specific server (has access token or can get one)
 */
export function canUseServer(serverHost: string): boolean {
  const grytToken = localStorage.getItem('token'); // useAccount uses 'token'
  const accessToken = localStorage.getItem(`accessToken_${serverHost}`);
  
  // Can use server if we have either an access token or a Gryt token to get one
  return !!(accessToken || grytToken);
}
