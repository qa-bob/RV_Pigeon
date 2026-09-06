import request from "supertest";
import { createApp } from "../../src/app";
import { setupTestDb, teardownTestDb, clearTestDb, createTestHost, agentAuthHeader } from "../helpers/setup";

const app = createApp();

beforeAll(setupTestDb);
afterAll(teardownTestDb);
afterEach(clearTestDb);

async function seedTripWithTwoScheduledMessages(token: string) {
  await request(app)
    .post("/api/listings")
    .set("Authorization", `Bearer ${token}`)
    .send({ label: "Eclipse Milan", externalListingId: "listing-overrides" });

  await request(app)
    .post("/api/templates")
    .set("Authorization", `Bearer ${token}`)
    .send({
      name: "At pickup",
      triggerEvent: "trip_start",
      offsetAmount: 0,
      offsetUnit: "hours",
      offsetDirection: "after",
      body: "Hi",
      applicability: { allListings: true, listingIds: [] },
    });
  await request(app)
    .post("/api/templates")
    .set("Authorization", `Bearer ${token}`)
    .send({
      name: "At return",
      triggerEvent: "trip_finish",
      offsetAmount: 0,
      offsetUnit: "hours",
      offsetDirection: "after",
      body: "Bye",
      applicability: { allListings: true, listingIds: [] },
    });

  const [authHeaderName, authHeaderValue] = agentAuthHeader();
  await request(app)
    .post("/agent/sync-trips")
    .set(authHeaderName, authHeaderValue)
    .send({
      listingExternalId: "listing-overrides",
      trips: [
        {
          externalTripId: "trip-overrides-1",
          guestFirstName: "Sam",
          guestLastName: "",
          startAt: "2026-09-10T16:00:00.000Z",
          endAt: "2026-09-14T16:00:00.000Z",
          status: "booked",
        },
      ],
    });

  const tripsRes = await request(app).get("/api/trips").set("Authorization", `Bearer ${token}`);
  const tripId = tripsRes.body[0].id;
  const messagesRes = await request(app)
    .get(`/api/trips/${tripId}/scheduled-messages`)
    .set("Authorization", `Bearer ${token}`);
  return { tripId, scheduledMessages: messagesRes.body };
}

describe("Schedule review & overrides", () => {
  it("lists trips and their scheduled messages", async () => {
    const { token } = await createTestHost();
    const { scheduledMessages } = await seedTripWithTwoScheduledMessages(token);

    expect(scheduledMessages).toHaveLength(2);
    expect(scheduledMessages.every((m: any) => m.status === "scheduled")).toBe(true);
  });

  it("send-now marks a message due immediately without changing its status", async () => {
    const { token } = await createTestHost();
    const { scheduledMessages } = await seedTripWithTwoScheduledMessages(token);
    const target = scheduledMessages[0];

    const res = await request(app)
      .post(`/api/scheduled-messages/${target.id}/send-now`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("scheduled");
    expect(new Date(res.body.sendAt).getTime()).toBeLessThanOrEqual(Date.now());
  });

  it("skip marks a single message skipped with skipReason host_manual", async () => {
    const { token } = await createTestHost();
    const { scheduledMessages } = await seedTripWithTwoScheduledMessages(token);
    const target = scheduledMessages[0];

    const res = await request(app)
      .post(`/api/scheduled-messages/${target.id}/skip`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("skipped");
    expect(res.body.skipReason).toBe("host_manual");

    // The other message for this trip is untouched.
    const other = scheduledMessages[1];
    const otherRes = await request(app)
      .get(`/api/trips/${scheduledMessages[0].tripId}/scheduled-messages`)
      .set("Authorization", `Bearer ${token}`);
    const otherMessage = otherRes.body.find((m: any) => m.id === other.id);
    expect(otherMessage.status).toBe("scheduled");
  });

  it("rejects skip/send-now on a message that isn't scheduled", async () => {
    const { token } = await createTestHost();
    const { scheduledMessages } = await seedTripWithTwoScheduledMessages(token);
    const target = scheduledMessages[0];

    await request(app)
      .post(`/api/scheduled-messages/${target.id}/skip`)
      .set("Authorization", `Bearer ${token}`);

    const secondSkip = await request(app)
      .post(`/api/scheduled-messages/${target.id}/skip`)
      .set("Authorization", `Bearer ${token}`);
    expect(secondSkip.status).toBe(400);

    const sendNow = await request(app)
      .post(`/api/scheduled-messages/${target.id}/send-now`)
      .set("Authorization", `Bearer ${token}`);
    expect(sendNow.status).toBe(400);
  });

  it("skip-all-remaining skips every still-scheduled message for a trip", async () => {
    const { token } = await createTestHost();
    const { tripId } = await seedTripWithTwoScheduledMessages(token);

    const res = await request(app)
      .post(`/api/trips/${tripId}/scheduled-messages/skip-all-remaining`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.skipped).toBe(2);

    const messagesRes = await request(app)
      .get(`/api/trips/${tripId}/scheduled-messages`)
      .set("Authorization", `Bearer ${token}`);
    expect(messagesRes.body.every((m: any) => m.status === "skipped" && m.skipReason === "host_manual")).toBe(
      true,
    );
  });

  it("rejects requests without a valid token", async () => {
    const res = await request(app).get("/api/trips");
    expect(res.status).toBe(401);
  });
});
