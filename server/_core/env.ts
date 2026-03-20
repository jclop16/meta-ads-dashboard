function normalizeAdAccountId(value: string) {
  if (!value) return "";
  return value.startsWith("act_") ? value : `act_${value}`;
}

function normalizeBaseUrl(value: string) {
  return value.replace(/\/+$/, "");
}

export const REQUIRED_PRODUCTION_ENV_VARS = [
  "DATABASE_URL",
  "META_ACCESS_TOKEN",
  "META_AD_ACCOUNT_ID",
  "REFRESH_API_KEY",
  "APP_BASE_URL",
] as const;

export type AppEnv = ReturnType<typeof readEnv>;

export function readEnv(source: NodeJS.ProcessEnv = process.env) {
  const metaApiVersion = source.META_API_VERSION ?? "v22.0";

  return {
    isProduction: source.NODE_ENV === "production",
    databaseUrl: source.DATABASE_URL ?? "",
    metaAccessToken: source.META_ACCESS_TOKEN ?? "",
    metaAdAccountId: normalizeAdAccountId(source.META_AD_ACCOUNT_ID ?? ""),
    metaAccountName: source.META_ACCOUNT_NAME ?? "",
    metaApiVersion,
    metaGraphBaseUrl: `https://graph.facebook.com/${metaApiVersion}`,
    refreshApiKey: source.REFRESH_API_KEY ?? "",
    appBaseUrl: normalizeBaseUrl(source.APP_BASE_URL ?? ""),
  };
}

export function getMissingProductionEnvVars(env: AppEnv = ENV) {
  if (!env.isProduction) {
    return [];
  }

  return REQUIRED_PRODUCTION_ENV_VARS.filter(key => {
    switch (key) {
      case "DATABASE_URL":
        return !env.databaseUrl;
      case "META_ACCESS_TOKEN":
        return !env.metaAccessToken;
      case "META_AD_ACCOUNT_ID":
        return !env.metaAdAccountId;
      case "REFRESH_API_KEY":
        return !env.refreshApiKey;
      case "APP_BASE_URL":
        return !env.appBaseUrl;
    }
  });
}

export function assertStartupEnvironment(env: AppEnv = ENV) {
  const missingVars = getMissingProductionEnvVars(env);

  if (missingVars.length > 0) {
    throw new Error(
      `Missing required production environment variables: ${missingVars.join(", ")}`
    );
  }
}

export const ENV = readEnv();
