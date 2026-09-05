import "dotenv/config";
import { createApp } from "./app";
import { connectDb } from "./db";

async function main() {
  await connectDb();
  const app = createApp();
  const port = Number(process.env.PORT ?? 4000);
  app.listen(port, () => {
    console.log(`RV_Pigeon API listening on port ${port}`);
  });
}

main().catch((err) => {
  console.error("Failed to start API:", err);
  process.exit(1);
});
