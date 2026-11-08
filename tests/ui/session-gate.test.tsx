// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiFailure } from "@/server/errors";
import { requireVerifiedSession } from "@/server/auth/session";
import { createApi, type Services } from "@/server/api";

const gate = vi.hoisted(() => ({
  cookies: vi.fn(),
  services: vi.fn(),
  session: vi.fn(),
  profile: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(path);
  }),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: gate.cookies }));
vi.mock("next/navigation", () => ({ redirect: gate.redirect }));
vi.mock("@/server/services", () => ({ getServices: gate.services }));

beforeEach(() => {
  vi.clearAllMocks();
  gate.cookies.mockResolvedValue({
    get: () => ({ value: crypto.randomUUID() }),
  });
  gate.services.mockReturnValue({
    auth: { session: gate.session, profile: gate.profile },
  });
});

describe("server financial session gate", () => {
  it("returns a profile only after server session validation", async () => {
    const cookie = crypto.randomUUID();
    const profile = { id: "test-user", display_name: "Test person" };
    gate.cookies.mockResolvedValue({ get: () => ({ value: cookie }) });
    gate.session.mockReturnValue({ user_id: profile.id });
    gate.profile.mockReturnValue(profile);
    expect(await requireVerifiedSession()).toEqual(profile);
    expect(gate.session).toHaveBeenCalledWith(cookie);
    expect(gate.profile).toHaveBeenCalledWith(profile.id);
    expect(gate.redirect).not.toHaveBeenCalled();
  });

  it("denies a missing cookie with the expired reason recognized by login", async () => {
    gate.cookies.mockResolvedValue({ get: () => undefined });
    gate.session.mockImplementation(() => {
      throw new ApiFailure(401, "unauthenticated", "Test denial");
    });
    await expect(requireVerifiedSession()).rejects.toThrow(
      "/login?reason=expired",
    );
    expect(gate.session).toHaveBeenCalledWith("");
    expect(gate.profile).not.toHaveBeenCalled();
  });

  it("recognizes expired/revoked-session failures from another server bundle", async () => {
    vi.resetModules();
    const { ApiFailure: OtherBundleFailure } = await import("@/server/errors");
    const failure = new OtherBundleFailure(
      401,
      "unauthenticated",
      "Test denial",
    );
    expect(failure).not.toBeInstanceOf(ApiFailure);
    gate.session.mockImplementation(() => {
      throw failure;
    });
    await expect(requireVerifiedSession()).rejects.toThrow(
      "/login?reason=expired",
    );
    expect(gate.profile).not.toHaveBeenCalled();
    // The API and page may each be the first bundle to populate cached services.
    const services = { auth: { session: gate.session } } as unknown as Services;
    const response = await createApi(services)(
      new Request("http://localhost:3000/api/v1/me"),
    );
    expect(response.status).toBe(401);
    expect((await response.json()).error.code).toBe("unauthenticated");
  });

  it("keeps configuration failures distinct from an expired session", async () => {
    gate.services.mockImplementation(() => {
      throw new Error("Test unavailable configuration");
    });
    await expect(requireVerifiedSession()).rejects.toThrow(
      "/login?reason=unavailable",
    );
    expect(gate.session).not.toHaveBeenCalled();
  });

  it.each([
    new ApiFailure(503, "auth_unavailable", "Test service failure"),
    new ApiFailure(401, "invalid_code", "Test non-session failure"),
    { status: 401, code: "unauthenticated" },
    new Error("Test unexpected failure"),
  ])(
    "denies service, unrelated and unbranded errors without calling them expired",
    async (failure) => {
      gate.session.mockImplementation(() => {
        throw failure;
      });
      await expect(requireVerifiedSession()).rejects.toThrow(
        "/login?reason=unavailable",
      );
      expect(gate.profile).not.toHaveBeenCalled();
    },
  );
});
