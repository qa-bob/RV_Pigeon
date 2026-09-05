import request from "supertest";
import { createApp } from "../../src/app";
import { ScheduledMessage } from "../../src/models/scheduledMessage";
import { setupTestDb, teardownTestDb, clearTestDb, createTestHost, agentAuthHeader } from "../helpers/setup";

const app = createApp();

beforeAll(setupTestDb);
afterAll(teardownTestDb);
afterEach(clearTestDb);

describe("POST /agent/sync-trips (create path)", () => {
  it("creates a new Trip and generates ScheduledMessages from active applicable templates", async () => {
    const { token } = await createTestHost();

    const listingRes = await request(app)
      .post("/api/listings")
      .set("Authorization", `Bearer ${token}`)
      .send({ label: "2017 Nissan Titan XD", externalListingId: "outdoorsy-listing-1" });
    expect(listingRes.status).toBe(201);

    await request(app)
      .post("/api/templates")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "At pickup",
        triggerEvent: "trip_start",
        offsetAmount: 0,
        offsetUnit: "hours",
        offsetDirection: "after",
        body: "Hi {{GUEST_FIRST_NAME}}, welcome!",
        applicability: { allListings: true, listingIds: [] },
      });

    // An inactive template must NOT produce a ScheduledMessage.
    await request(app)
      .post("/api/templates")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Inactive template",
        triggerEvent: "trip_start",
        offsetAmount: 1,
        offsetUnit: "hours",
        offsetDirection: "after",
        body: "Should not fire",
        applicability: { allListings: true, listingIds: [] },
        active: false,
      });

    const [authHeaderName, authHeaderValue] = agentAuthHeader();
    const syncRes = await request(app)
      .post("/agent/sync-trips")
      .set(authHeaderName, authHeaderValue)
      .send({
        listingExternalId: "outdoorsy-listing-1",
        trips: [
          {
            externalTripId: "trip-001",
            guestFirstName: "Jermey",
            guestLastName: "Smith",
            startAt: "2026-09-10T16:00:00.000Z",
            endAt: "2026-09-14T16:00:00.000Z",
            status: "booked",
          },
        ],
      });

    expect(syncRes.status).toBe(200);
    expect(syncRes.body).toEqual({ created: 1, updated: 0 });

    const scheduled = await ScheduledMessage.find({}).populate("templateId");
    expect(scheduled).toHaveLength(1);
    expect((scheduled[0].templateId as any).name).toBe("At pickup");
    expect(scheduled[0].sendAt).toEqual(new Date("2026-09-10T16:00:00.000Z"));
    expect(scheduled[0].status).toBe("scheduled");
  });

  it("does not create duplicate Trips when the same externalTripId is synced twice", async () => {
    const { token } = await createTestHost();
    await request(app)
      .post("/api/listings")
      .set("Authorization", `Bearer ${token}`)
      .send({ label: "Truck", externalListingId: "listing-2" });

    const [authHeaderName, authHeaderValue] = agentAuthHeader();
    const payload = {
      listingExternalId: "listing-2",
      trips: [
        {
          externalTripId: "trip-dup",
          guestFirstName: "Sam",
          guestLastName: "",
          startAt: "2026-09-10T16:00:00.000Z",
          endAt: "2026-09-14T16:00:00.000Z",
          status: "booked",
        },
      ],
    };

    const first = await request(app).post("/agent/sync-trips").set(authHeaderName, authHeaderValue).send(payload);
    const second = await request(app).post("/agent/sync-trips").set(authHeaderName, authHeaderValue).send(payload);

    expect(first.body).toEqual({ created: 1, updated: 0 });
    expect(second.body).toEqual({ created: 0, updated: 1 });
  });

  it("rejects requests without a valid service token", async () => {
    const res = await request(app)
      .post("/agent/sync-trips")
      .send({ listingExternalId: "x", trips: [] });
    expect(res.status).toBe(401);
  });
});
