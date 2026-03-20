import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  vi.resetModules();
  vi.unstubAllGlobals();
  process.env = {
    ...ORIGINAL_ENV,
    NODE_ENV: "test",
  };
});

afterAll(() => {
  vi.unstubAllGlobals();
  process.env = ORIGINAL_ENV;
});

describe("getMetaConnectionStatus", () => {
  it("returns demo diagnostics when Meta credentials are missing", async () => {
    const { getMetaConnectionStatus } = await import("./metaAdsFetcher");

    const status = await getMetaConnectionStatus();

    expect(status).toEqual(
      expect.objectContaining({
        configured: false,
        connected: false,
        sourceMode: "demo",
      })
    );
    expect(status.errorMessage).toContain("not configured");
  });

  it("returns actionable Meta error details when Graph access fails", async () => {
    process.env.META_ACCESS_TOKEN = "token";
    process.env.META_AD_ACCOUNT_ID = "1234567890";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: async () =>
          JSON.stringify({
            error: {
              message: "Unsupported get request.",
              code: 100,
              type: "GraphMethodException",
              error_subcode: 33,
              fbtrace_id: "TRACE123",
            },
          }),
      })
    );

    const { getMetaConnectionStatus } = await import("./metaAdsFetcher");
    const status = await getMetaConnectionStatus();

    expect(status).toEqual(
      expect.objectContaining({
        configured: true,
        connected: false,
        sourceMode: "live",
        errorCode: 100,
        errorType: "GraphMethodException",
        errorSubcode: 33,
        fbtraceId: "TRACE123",
      })
    );
    expect(status.errorMessage).toContain("Unsupported get request.");
  });

  it("verifies the account and insights endpoint when Graph access succeeds", async () => {
    process.env.META_ACCESS_TOKEN = "token";
    process.env.META_AD_ACCOUNT_ID = "1234567890";
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              id: "act_1234567890",
              name: "Legacy Empowerment Group",
              currency: "USD",
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              data: [
                {
                  spend: "123.45",
                  impressions: "1000",
                  clicks: "12",
                  date_start: "2026-03-13",
                  date_stop: "2026-03-19",
                },
              ],
            }),
        })
    );

    const { getMetaConnectionStatus } = await import("./metaAdsFetcher");
    const status = await getMetaConnectionStatus();

    expect(status).toEqual(
      expect.objectContaining({
        configured: true,
        connected: true,
        sourceMode: "live",
        adAccountId: "act_1234567890",
        sampleDateStart: "2026-03-13",
        sampleDateStop: "2026-03-19",
      })
    );
    expect(status.account).toEqual(
      expect.objectContaining({
        name: "Legacy Empowerment Group",
        currency: "USD",
      })
    );
  });
});
