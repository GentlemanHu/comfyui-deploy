export function useAuth() {
  return {
    isSignedIn: true,
    userId: process.env.NEXT_PUBLIC_LOCAL_AUTH_USER_ID || "local-admin",
  };
}

export function useClerk() {
  return {
    openSignIn() {},
  };
}

