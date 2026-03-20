import { beforeEach, describe, expect, it } from "vitest";
import {
  assertStartupEnvironment,
  getMissingProductionEnvVars,
  readEnv,
} from "./_core/env";

describe("startup environment validation", () => {
  let baseEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    baseEnv = {
      NODE_ENV: "production",
      DATABASE_URL: "mysql://user:pass@localhost:3306/meta_ads_dashboard",
      META_ACCESS_TOKEN: "token",
      META_AD_ACCOUNT_ID: "1234567890",
      APP_BASE_URL: "https://ads.example.com",
    };
  });

  it("fails in production when required env vars are missing", () => {
    const env = readEnv({
      ...baseEnv,
      DATABASE_URL: "",
      APP_BASE_URL: "",
    });

    expect(getMissingProductionEnvVars(env)).toEqual([
      "DATABASE_URL",
      "APP_BASE_URL",
    ]);
    expect(() => assertStartupEnvironment(env)).toThrow(
      "Missing required production environment variables: DATABASE_URL, APP_BASE_URL"
    );
  });

  it("allows development startup without production-only env vars", () => {
    const env = readEnv({
      NODE_ENV: "development",
    });

    expect(getMissingProductionEnvVars(env)).toEqual([]);
    expect(() => assertStartupEnvironment(env)).not.toThrow();
  });

  it("falls back to Railway public domain for APP_BASE_URL", () => {
    const env = readEnv({
      NODE_ENV: "production",
      DATABASE_URL: "mysql://user:pass@localhost:3306/meta_ads_dashboard",
      META_ACCESS_TOKEN: "token",
      META_AD_ACCOUNT_ID: "1234567890",
      RAILWAY_PUBLIC_DOMAIN: "meta-ads-dashboard-production.up.railway.app",
    });

    expect(env.appBaseUrl).toBe(
      "https://meta-ads-dashboard-production.up.railway.app"
    );
    expect(getMissingProductionEnvVars(env)).toEqual([]);
    expect(() => assertStartupEnvironment(env)).not.toThrow();
  });
});
