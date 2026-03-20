import "dotenv/config";
import { assertStartupEnvironment } from "./_core/env";
import { createApp } from "./app";

async function startServer() {
  assertStartupEnvironment();
  const { server } = await createApp();

  const port = Number.parseInt(process.env.PORT || "3000", 10);
  const host = "0.0.0.0";

  server.listen(port, host, () => {
    console.log(`Meta Ads Dashboard running on http://${host}:${port}/`);
  });
}

startServer().catch(error => {
  console.error("[Server] Failed to start", error);
  process.exitCode = 1;
});
