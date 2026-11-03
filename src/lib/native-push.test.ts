import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), rpc: vi.fn(), from: vi.fn(), checkPermissions: vi.fn(), requestPermissions: vi.fn(), addListener: vi.fn(), register: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { getUser: mocks.getUser }, rpc: mocks.rpc, from: mocks.from } }));
vi.mock("@capacitor/push-notifications", () => ({ PushNotifications: mocks }));

describe("phone registration ownership", () => {
  beforeEach(() => {
    vi.resetModules(); vi.clearAllMocks();
    vi.stubGlobal("window", { Capacitor: { isNativePlatform: () => true } });
    vi.stubGlobal("localStorage", { getItem: () => "ar" });
    mocks.checkPermissions.mockResolvedValue({ receive: "granted" });
    mocks.rpc.mockResolvedValue({ error: null });
    mocks.getUser.mockResolvedValue({ data: { user: { id: "admin-account" } } });
    mocks.addListener.mockImplementation(async (name, cb) => { if (name === "registration") cb({ value: "a".repeat(64) }); });
  });
  it("registers only the phone token and locale, never a caller-selected owner", async () => {
    const push = await import("./native-push");
    await push.initNativePush(); await push.syncPushToken();
    expect(mocks.rpc).toHaveBeenCalledWith("register_push_device", { _token: "a".repeat(64), _locale: "ar" });
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("scopes pre-signout deletion to the current account and token", async () => {
    const eqOwner = vi.fn().mockResolvedValue({ error: null });
    const eqToken = vi.fn().mockReturnValue({ eq: eqOwner });
    mocks.from.mockReturnValue({ delete: () => ({ eq: eqToken }) });
    const push = await import("./native-push"); await push.initNativePush(); await push.clearPushToken();
    expect(eqToken).toHaveBeenCalledWith("token", "a".repeat(64));
    expect(eqOwner).toHaveBeenCalledWith("user_id", "admin-account");
  });
  it("does not register the device while signed out", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    const push = await import("./native-push"); await push.initNativePush(); await push.syncPushToken();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("surfaces registration errors so a failed handover is not treated as saved", async () => {
    mocks.rpc.mockResolvedValue({ error: { message: "denied" } });
    const push = await import("./native-push"); await push.initNativePush();
    await expect(push.syncPushToken()).rejects.toThrow("Unable to register this phone");
  });
});