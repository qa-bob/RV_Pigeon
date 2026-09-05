import request from "supertest";
import { createApp } from "../../src/app";
import { ScheduledMessage } from "../../src/models/scheduledMessage";
import { setupTestDb, teardownTestDb, clearTestDb, createTestHost, agentAuthHeader } from "../helpers/setup";

const app = createApp();

beforeAll(setupTestDb);
afterAll(teardownTestDb);
afterEach(clearTestDb);

async function seedDueMessage(token: string, authHeader: [string, string]) {
  await request(app)
    .post("/api/listings")
    .set("Authorization", `Bearer ${token}`)
    .send({ label: "Truck", externalListingId: "listing-3" });

  await request(app)
    .post("/api/templates")
    .set("Authorization", `Bearer ${token}`)
    .send({
      name: "Welcome",
      triggerEvent: "trip_booked",
      offsetAmount: 0,
      offsetUnit: "hours",
      offsetDirection: "after",
      body: "Hi {{GUEST_FIRST_NAME}}, call {{HOST_FIRST_NAME}} at {{HOST_PHONE_NUMBER}}.",
      applicability: { allListings: true, listingIds: [] },
    });

  await request(app)
    .post("/agent/sync-trips")
    .set(...authHeader)
    .send({
      listingExternalId: "listing-3",
      trips: [
        {
          externalTripId: "trip-due-1",
          guestFirstName: "Jermey",
          guestLastName: "",
          bookedAt: "2020-01-01T00:00:00.000Z", // long past -> already due
          startAt: "2020-01-05T00:00:00.000Z",
          endAt: "2020-01-08T00:00:00.000Z",
          status: "booked",
        },
      ],
    });
}

describe("GET /agent/due-messages + POST /agent/report-result", () => {
  it("returns a due message with variables rendered, then marks it sent", async () => {
    const { token } = await createTestHost({ firstName: "Alex", phoneNumber: "555-0100" });
    const authHeader = agentAuthHeader();
    await seedDueMessage(token, authHeader);

    const dueRes = await request(app).get("/agent/due-messages").set(...authHeader);
    expect(dueRes.status).toBe(200);
    expect(dueRes.body).toHaveLength(1);
    expect(dueRes.body[0]).toMatchObject({
      tripExternalId: "trip-due-1",
      listingExternalId: "listing-3",
      renderedBody: "Hi Jermey, call Alex at 555-0100.",
    });

    const scheduledMessageId = dueRes.body[0].scheduledMessageId;
    const reportRes = await request(app)
      .post("/agent/report-result")
      .set(...authHeader)
      .send({ scheduledMessageId, outcome: "sent" });
    expect(reportRes.status).toBe(204);

    const updated = await ScheduledMessage.findById(scheduledMessageId);
    expect(updated!.status).toBe("sent");
    expect(updated!.sentAt).not.toBeNull();

    // Once sent, it must no longer show up as due.
    const secondDueRes = await request(app).get("/agent/due-messages").set(...authHeader);
    expect(secondDueRes.body).toHaveLength(0);
  });

  it("does not mark a message sent on a reported failure, and logs it", async () => {
    const { token } = await createTestHost();
    const authHeader = agentAuthHeader();
    await seedDueMessage(token, authHeader);

    const dueRes = await request(app).get("/agent/due-messages").set(...authHeader);
    const scheduledMessageId = dueRes.body[0].scheduledMessageId;

    const reportRes = await request(app)
      .post("/agent/report-result")
      .set(...authHeader)
      .send({ scheduledMessageId, outcome: "failed", detail: "Outdoorsy login challenge" });
    expect(reportRes.status).toBe(204);

    const updated = await ScheduledMessage.findById(scheduledMessageId);
    expect(updated!.status).toBe("scheduled");

    // Still due next poll since it was never marked sent.
    const secondDueRes = await request(app).get("/agent/due-messages").set(...authHeader);
    expect(secondDueRes.body).toHaveLength(1);
  });
});
