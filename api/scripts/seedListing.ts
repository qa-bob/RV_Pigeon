import "dotenv/config";
import { createInterface } from "node:readline/promises";
import { connectDb, disconnectDb } from "../src/db";
import { Host } from "../src/models/host";
import { Listing } from "../src/models/listing";

async function main() {
  await connectDb();

  const host = await Host.findOne({});
  if (!host) {
    console.error("No host account exists yet. Run `npm run seed:host` first.");
    process.exit(1);
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const label =
    process.env.SEED_LISTING_LABEL ??
    (await rl.question('Listing label (e.g. "2017 Nissan Titan XD"): '));
  const externalListingId =
    process.env.SEED_LISTING_EXTERNAL_ID ??
    (await rl.question(
      "External listing id (any value you choose; must exactly match agent/.env's OUTDOORSY_LISTING_ID): ",
    ));
  rl.close();

  if (!label || !externalListingId) {
    console.error("Both fields are required.");
    process.exit(1);
  }

  const existing = await Listing.findOne({ hostId: host._id, externalListingId });
  if (existing) {
    console.error(`A listing with externalListingId "${externalListingId}" already exists.`);
    await disconnectDb();
    process.exit(1);
  }

  const listing = await Listing.create({ hostId: host._id, label, externalListingId });
  console.log(`Listing "${listing.label}" created with externalListingId "${listing.externalListingId}".`);
  await disconnectDb();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
