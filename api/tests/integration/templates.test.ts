import request from "supertest";
import { createApp } from "../../src/app";
import { setupTestDb, teardownTestDb, clearTestDb, createTestHost } from "../helpers/setup";

const app = createApp();

beforeAll(setupTestDb);
afterAll(teardownTestDb);
afterEach(clearTestDb);

describe("template CRUD", () => {
  it("creates a template with valid fields", async () => {
    const { token } = await createTestHost();
    const res = await request(app)
      .post("/api/templates")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Full Heads Up Notes",
        triggerEvent: "trip_start",
        offsetAmount: 1,
        offsetUnit: "hours",
        offsetDirection: "before",
        body: "Hi {{GUEST_FIRST_NAME}}!",
        applicability: { allListings: true, listingIds: [] },
      });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe("Full Heads Up Notes");
    expect(res.body.active).toBe(true);
  });

  it("rejects a body over the 2000-character limit", async () => {
    const { token } = await createTestHost();
    const res = await request(app)
      .post("/api/templates")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Too Long",
        triggerEvent: "trip_booked",
        offsetAmount: 1,
        offsetUnit: "hours",
        offsetDirection: "after",
        body: "x".repeat(2001),
        applicability: { allListings: true, listingIds: [] },
      });

    expect(res.status).toBe(400);
  });

  it("rejects applicability with allListings=false and no listingIds", async () => {
    const { token } = await createTestHost();
    const res = await request(app)
      .post("/api/templates")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Bad applicability",
        triggerEvent: "trip_booked",
        offsetAmount: 1,
        offsetUnit: "hours",
        offsetDirection: "after",
        body: "Hi",
        applicability: { allListings: false, listingIds: [] },
      });

    expect(res.status).toBe(400);
  });

  it("lists only the requesting host's templates", async () => {
    const { token: tokenA } = await createTestHost({ email: "a@example.com" });
    const { token: tokenB } = await createTestHost({ email: "b@example.com" });

    await request(app)
      .post("/api/templates")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({
        name: "A's template",
        triggerEvent: "trip_booked",
        offsetAmount: 1,
        offsetUnit: "hours",
        offsetDirection: "after",
        body: "Hi",
        applicability: { allListings: true, listingIds: [] },
      });

    const res = await request(app).get("/api/templates").set("Authorization", `Bearer ${tokenB}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });

  it("rejects requests without a valid token", async () => {
    const res = await request(app).get("/api/templates");
    expect(res.status).toBe(401);
  });

  it("updates a template's active flag via PATCH", async () => {
    const { token } = await createTestHost();
    const created = await request(app)
      .post("/api/templates")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Toggle me",
        triggerEvent: "trip_booked",
        offsetAmount: 1,
        offsetUnit: "hours",
        offsetDirection: "after",
        body: "Hi",
        applicability: { allListings: true, listingIds: [] },
      });

    const res = await request(app)
      .patch(`/api/templates/${created.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ active: false });

    expect(res.status).toBe(200);
    expect(res.body.active).toBe(false);
  });
});
