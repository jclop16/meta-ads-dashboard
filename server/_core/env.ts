function normalizeAdAccountId(value: string) {
  if (!value) return "";
  return value.startsWith("act_") ? value : `act_${value}`;
}

const metaApiVersion = process.env.META_API_VERSION ?? "v22.0";

export const ENV = {
  isProduction: process.env.NODE_ENV === "production",
  databaseUrl: process.env.DATABASE_URL ?? "",
  metaAccessToken: process.env.META_ACCESS_TOKEN ?? "",
  metaAdAccountId: normalizeAdAccountId(process.env.META_AD_ACCOUNT_ID ?? ""),
  metaAccountName: process.env.META_ACCOUNT_NAME ?? "",
  metaApiVersion,
  metaGraphBaseUrl: `https://graph.facebook.com/${metaApiVersion}`,
};
