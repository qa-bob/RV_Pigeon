import request from "supertest";
import { createApp } from "../../src/app";
import { AgentActivityLog } from "../../src/models/agentActivityLog";
import { setupTestDb, teardownTestDb, clearTestDb, createTestHost, agentAuthHeader } from "../helpers/setup";

const app = createApp();

beforeAll(setupTestDb);
afterAll(teardownTestDb);
afterEach(clearTestDb);

describe("GET /api/activity", () => {
  it("returns failure entries recorded via the agent API, newest first", async () => {
    const { token } = await createTestHost();
    const [authHeaderName, authHeaderValue] = agentAuthHeader();

    await request(app)
      .post("/agent/report-sync-failure")
      .set(authHeaderName, authHeaderValue)
      .send({ listingExternalId: "listing-1", detail: "Outdoorsy login challenge" });
    await request(app)
      .post("/agent/report-sync-failure")
      .set(authHeaderName, authHeaderValue)
      .send({ detail: "Session expired" });

    const res = await request(app).get("/api/activity").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].detail).toBe("Session expired");
    expect(res.body.every((e: any) => e.type === "trip_sync" && e.outcome === "failure")).toBe(true);
  });

  it("filters by outcome", async () => {
    const { token } = await createTestHost();
    await AgentActivityLog.create({ type: "trip_sync", outcome: "success", detail: "ok" });
    await AgentActivityLog.create({ type: "trip_sync", outcome: "failure", detail: "bad" });

    const res = await request(app)
      .get("/api/activity")
      .query({ outcome: "failure" })
      .set("Authorization", `Bearer ${token}`);

    expect(res.body).toHaveLength(1);
    expect(res.body[0].detail).toBe("bad");
  });

  it("rejects requests without a valid token", async () => {
    const res = await request(app).get("/api/activity");
    expect(res.status).toBe(401);
  });
});
