// Demo authentication for testing without Supabase setup
const DEMO_ACCOUNTS = {
  "demo@mascores.app": "demo123",
  "test@mascores.app": "test123",
  "admin@mascores.app": "admin123",
};

export function isDemoAccount(email: string): boolean {
  return email in DEMO_ACCOUNTS;
}

export function validateDemoAccount(email: string, password: string): boolean {
  return DEMO_ACCOUNTS[email as keyof typeof DEMO_ACCOUNTS] === password;
}

export function getDemoSession(email: string) {
  return {
    user: {
      id: `demo-${email.split("@")[0]}`,
      email: email,
      user_metadata: {
        display_name: email.split("@")[0],
      },
    },
    session: {
      access_token: `demo-token-${Date.now()}`,
      token_type: "bearer",
      expires_in: 3600,
      refresh_token: `demo-refresh-${Date.now()}`,
    },
  };
}

export function saveDemoSession(session: any) {
  if (typeof window !== "undefined") {
    localStorage.setItem("demo-auth-session", JSON.stringify(session));
  }
}

export function loadDemoSession() {
  if (typeof window === "undefined") return null;
  const session = localStorage.getItem("demo-auth-session");
  return session ? JSON.parse(session) : null;
}

export function clearDemoSession() {
  if (typeof window !== "undefined") {
    localStorage.removeItem("demo-auth-session");
  }
}
