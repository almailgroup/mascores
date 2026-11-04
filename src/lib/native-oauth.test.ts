import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  appListener: vi.fn(), browserListener: vi.fn(), open: vi.fn(), close: vi.fn(),
  setSession: vi.fn(), exchangeCodeForSession: vi.fn(), removeApp: vi.fn(), removeBrowser: vi.fn(),
}));
vi.mock("@capacitor/core", () => ({ Capacitor: { isPluginAvailable: (name: string) => name === "Browser" }, registerPlugin: vi.fn() }));
vi.mock("@capacitor/app", () => ({ App: { addListener: mocks.appListener } }));
vi.mock("@capacitor/browser", () => ({ Browser: { addListener: mocks.browserListener, open: mocks.open, close: mocks.close } }));
vi.mock("@/lib/native-notify", () => ({ isNativeApp: () => true }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: mocks } }));

describe("Android Google sign-in return", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.appListener.mockResolvedValue({ remove: mocks.removeApp });
    mocks.browserListener.mockResolvedValue({ remove: mocks.removeBrowser });
    mocks.open.mockResolvedValue(undefined);
    mocks.close.mockResolvedValue(undefined);
    mocks.setSession.mockResolvedValue({ error: null });
  });
  it("registers a browsable Android callback for the app scheme", () => {
    const manifest = readFileSync("android/app/src/main/AndroidManifest.xml", "utf8");
    const filter = manifest.match(/<intent-filter>[\s\S]*?android.intent.action.VIEW[\s\S]*?<\/intent-filter>/)?.[0];
    expect(filter).toContain('android.intent.category.BROWSABLE');
    expect(filter).toContain('android:scheme="com.almailgroup.mascores"');
    expect(filter).toContain('android:host="auth"');
    expect(filter).toContain('android:pathPrefix="/callback"');
  });
  it("stores the returned session in the app and cleans up both listeners", async () => {
    const { nativeOAuthSignIn } = await import("./native-oauth");
    const result = nativeOAuthSignIn("google");
    await vi.waitFor(() => expect(mocks.open).toHaveBeenCalled());
    expect(mocks.appListener.mock.invocationCallOrder[0]).toBeLessThan(mocks.open.mock.invocationCallOrder[0]);
    const receive = mocks.appListener.mock.calls[0][1];
    await receive({ url: "com.almailgroup.mascores://auth/callback#access_token=test-access&refresh_token=test-refresh" });
    await expect(result).resolves.toEqual({ handled: true });
    expect(mocks.setSession).toHaveBeenCalledWith({ access_token: "test-access", refresh_token: "test-refresh" });
    expect(mocks.removeApp).toHaveBeenCalledOnce();
    expect(mocks.removeBrowser).toHaveBeenCalledOnce();
  });
});