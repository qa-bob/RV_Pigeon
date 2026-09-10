import request from "supertest";
import { createApp } from "../../src/app";
import { setupTestDb, teardownTestDb, clearTestDb, createTestHost } from "../helpers/setup";

const app = createApp();

beforeAll(setupTestDb);
afterAll(teardownTestDb);
afterEach(clearTestDb);

describe("registration", () => {
  it("registers the first account and returns a token", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "New.Host@Example.com", password: "correct-horse" });

    expect(res.status).toBe(201);
    expect(typeof res.body.token).toBe("string");
  });

  it("rejects registration once an account already exists", async () => {
    await createTestHost();

    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "second@example.com", password: "correct-horse" });

    expect(res.status).toBe(409);
  });

  it("rejects a password under 8 characters", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "short@example.com", password: "short" });

    expect(res.status).toBe(400);
  });

  it("rejects a missing email or password", async () => {
    const res = await request(app).post("/api/auth/register").send({ email: "no-password@example.com" });

    expect(res.status).toBe(400);
  });

  it("lets a freshly registered account log in", async () => {
    await request(app)
      .post("/api/auth/register")
      .send({ email: "login-check@example.com", password: "correct-horse" });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "login-check@example.com", password: "correct-horse" });

    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe("string");
  });
});
