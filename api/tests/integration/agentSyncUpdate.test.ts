import request from "supertest";
import { createApp } from "../../src/app";
import { ScheduledMessage } from "../../src/models/scheduledMessage";
import { setupTestDb, teardownTestDb, clearTestDb, createTestHost, agentAuthHeader } from "../helpers/setup";

const app = createApp();

beforeAll(setupTestDb);
afterAll(teardownTestDb);
afterEach(clearTestDb);

async function seedListingAndTemplate(token: string) {
  await request(app)
    .post("/api/listings")
    .set("Authorization", `Bearer ${token}`)
    .send({ label: "Eclipse Milan", externalListingId: "listing-update" });

  await request(app)
    .post("/api/templates")
    .set("Authorization", `Bearer ${token}`)
    .send({
      name: "At pickup",
      triggerEvent: "trip_start",
      offsetAmount: 0,
      offsetUnit: "hours",
      offsetDirection: "after",
      body: "Hi {{GUEST_FIRST_NAME}}",
      applicability: { allListings: true, listingIds: [] },
    });
}

describe("POST /agent/sync-trips (update path)", () => {
  it("recomputes sendAt on still-scheduled messages when trip dates change", async () => {
    const { token } = await createTestHost();
    await seedListingAndTemplate(token);
    const authHeader = agentAuthHeader();

    await request(app)
      .post("/agent/sync-trips")
      .set(...authHeader)
      .send({
        listingExternalId: "listing-update",
        trips: [
          {
            externalTripId: "trip-reschedule",
            guestFirstName: "Sam",
            guestLastName: "",
            startAt: "2026-09-10T16:00:00.000Z",
            endAt: "2026-09-14T16:00:00.000Z",
            status: "booked",
          },
        ],
      });

    const before = await ScheduledMessage.findOne({});
    expect(before!.sendAt).toEqual(new Date("2026-09-10T16:00:00.000Z"));

    // Guest reschedules: trip now starts a day later.
    await request(app)
      .post("/agent/sync-trips")
      .set(...authHeader)
      .send({
        listingExternalId: "listing-update",
        trips: [
          {
            externalTripId: "trip-reschedule",
            guestFirstName: "Sam",
            guestLastName: "",
            startAt: "2026-09-11T16:00:00.000Z",
            endAt: "2026-09-15T16:00:00.000Z",
            status: "booked",
          },
        ],
      });

    const after = await ScheduledMessage.findOne({});
    expect(after!.sendAt).toEqual(new Date("2026-09-11T16:00:00.000Z"));
    expect(after!.status).toBe("scheduled");
  });

  it("skips remaining scheduled messages when a trip becomes cancelled", async () => {
    const { token } = await createTestHost();
    await seedListingAndTemplate(token);
    const authHeader = agentAuthHeader();

    await request(app)
      .post("/agent/sync-trips")
      .set(...authHeader)
      .send({
        listingExternalId: "listing-update",
        trips: [
          {
            externalTripId: "trip-cancel",
            guestFirstName: "Sam",
            guestLastName: "",
            startAt: "2026-09-10T16:00:00.000Z",
            endAt: "2026-09-14T16:00:00.000Z",
            status: "booked",
          },
        ],
      });

    await request(app)
      .post("/agent/sync-trips")
      .set(...authHeader)
      .send({
        listingExternalId: "listing-update",
        trips: [
          {
            externalTripId: "trip-cancel",
            guestFirstName: "Sam",
            guestLastName: "",
            startAt: "2026-09-10T16:00:00.000Z",
            endAt: "2026-09-14T16:00:00.000Z",
            status: "cancelled",
          },
        ],
      });

    const message = await ScheduledMessage.findOne({});
    expect(message!.status).toBe("skipped");
    expect(message!.skipReason).toBe("trip_cancelled");
  });

  it("leaves an already-sent message alone when the trip is later cancelled", async () => {
    const { token } = await createTestHost();
    await seedListingAndTemplate(token);
    const authHeader = agentAuthHeader();

    await request(app)
      .post("/agent/sync-trips")
      .set(...authHeader)
      .send({
        listingExternalId: "listing-update",
        trips: [
          {
            externalTripId: "trip-already-sent",
            guestFirstName: "Sam",
            guestLastName: "",
            startAt: "2026-09-10T16:00:00.000Z",
            endAt: "2026-09-14T16:00:00.000Z",
            status: "booked",
          },
        ],
      });

    const sm = await ScheduledMessage.findOne({});
    sm!.status = "sent";
    sm!.sentAt = new Date();
    await sm!.save();

    await request(app)
      .post("/agent/sync-trips")
      .set(...authHeader)
      .send({
        listingExternalId: "listing-update",
        trips: [
          {
            externalTripId: "trip-already-sent",
            guestFirstName: "Sam",
            guestLastName: "",
            startAt: "2026-09-10T16:00:00.000Z",
            endAt: "2026-09-14T16:00:00.000Z",
            status: "cancelled",
          },
        ],
      });

    const after = await ScheduledMessage.findOne({});
    expect(after!.status).toBe("sent");
  });
});
