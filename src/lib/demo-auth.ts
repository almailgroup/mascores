// Demo authentication for testing without Supabase setup
const DEMO_ACCOUNTS = {
  "demo@mascores.app": "demo123",
  "test@mascores.app": "test123",
  "admin@mascores.app": "admin123",
};

export function isDemoAccount(email: string): boolean {
  return email.toLowerCase() in DEMO_ACCOUNTS;
}

export function validateDemoAccount(email: string, password: string): boolean {
  const key = email.toLowerCase() as keyof typeof DEMO_ACCOUNTS;
  return DEMO_ACCOUNTS[key] === password;
}

export function getDemoSession(email: string) {
  return {
    user: {
      id: `demo-${email.split("@")[0]}`,
      email: email,
      user_metadata: {
        display_name: email.split("@")[0],
      },
      aud: "authenticated",
      created_at: new Date().toISOString(),
    },
    session: {
      access_token: `demo-token-${Date.now()}`,
      token_type: "bearer",
      expires_in: 3600,
      refresh_token: `demo-refresh-${Date.now()}`,
      user: {
        id: `demo-${email.split("@")[0]}`,
        email: email,
        user_metadata: {
          display_name: email.split("@")[0],
        },
      },
    },
  };
}

export function saveDemoSession(session: any) {
  try {
    if (typeof window !== "undefined") {
      localStorage.setItem("demo-auth-session", JSON.stringify(session));
      console.log("Demo session saved");
    }
  } catch (e) {
    console.error("Failed to save demo session:", e);
  }
}

export function loadDemoSession() {
  try {
    if (typeof window === "undefined") return null;
    const session = localStorage.getItem("demo-auth-session");
    return session ? JSON.parse(session) : null;
  } catch (e) {
    console.error("Failed to load demo session:", e);
    return null;
  }
}

export function clearDemoSession() {
  try {
    if (typeof window !== "undefined") {
      localStorage.removeItem("demo-auth-session");
    }
  } catch (e) {
    console.error("Failed to clear demo session:", e);
  }
}
