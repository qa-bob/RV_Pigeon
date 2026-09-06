import request from "supertest";
import { createApp } from "../../src/app";
import { setupTestDb, teardownTestDb, clearTestDb, createTestHost } from "../helpers/setup";

const app = createApp();

beforeAll(setupTestDb);
afterAll(teardownTestDb);
afterEach(clearTestDb);

describe("Listing content (Guest Instructions / Car Guide)", () => {
  it("updates guestInstructions and carGuide, including the FAQ list", async () => {
    const { token } = await createTestHost();
    const created = await request(app)
      .post("/api/listings")
      .set("Authorization", `Bearer ${token}`)
      .send({ label: "Eclipse Milan", externalListingId: "listing-a" });

    const res = await request(app)
      .patch(`/api/listings/${created.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        guestInstructions: {
          pickupReturnInstructions: "Meet at the gate.",
          welcomeMessage: "Welcome aboard!",
        },
        carGuide: {
          tips: "Cold starts take a few seconds.",
          faqs: [{ question: "Can I smoke?", answer: "No." }],
        },
      });

    expect(res.status).toBe(200);
    expect(res.body.guestInstructions.pickupReturnInstructions).toBe("Meet at the gate.");
    expect(res.body.guestInstructions.welcomeMessage).toBe("Welcome aboard!");
    expect(res.body.carGuide.tips).toBe("Cold starts take a few seconds.");
    expect(res.body.carGuide.faqs).toEqual([{ question: "Can I smoke?", answer: "No." }]);
  });

  it("scopes content updates to one listing without leaking into another", async () => {
    const { token } = await createTestHost();
    const listingA = await request(app)
      .post("/api/listings")
      .set("Authorization", `Bearer ${token}`)
      .send({ label: "Eclipse Milan", externalListingId: "listing-a" });
    const listingB = await request(app)
      .post("/api/listings")
      .set("Authorization", `Bearer ${token}`)
      .send({ label: "Different RV", externalListingId: "listing-b" });

    await request(app)
      .patch(`/api/listings/${listingA.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ guestInstructions: { welcomeMessage: "Only for A" } });

    const bRes = await request(app)
      .get("/api/listings")
      .set("Authorization", `Bearer ${token}`);
    const bListing = bRes.body.find((l: any) => l.id === listingB.body.id);
    expect(bListing.guestInstructions.welcomeMessage).toBe("");
  });

  it("rejects a welcomeMessage over 170 characters", async () => {
    const { token } = await createTestHost();
    const created = await request(app)
      .post("/api/listings")
      .set("Authorization", `Bearer ${token}`)
      .send({ label: "Eclipse Milan", externalListingId: "listing-c" });

    const res = await request(app)
      .patch(`/api/listings/${created.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ guestInstructions: { welcomeMessage: "x".repeat(171) } });

    expect(res.status).toBe(400);
  });

  it("rejects pickupReturnInstructions or car guide tips over 5000 characters", async () => {
    const { token } = await createTestHost();
    const created = await request(app)
      .post("/api/listings")
      .set("Authorization", `Bearer ${token}`)
      .send({ label: "Eclipse Milan", externalListingId: "listing-d" });

    const res = await request(app)
      .patch(`/api/listings/${created.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ carGuide: { tips: "x".repeat(5001) } });

    expect(res.status).toBe(400);
  });

  it("rejects an FAQ entry missing a question or answer", async () => {
    const { token } = await createTestHost();
    const created = await request(app)
      .post("/api/listings")
      .set("Authorization", `Bearer ${token}`)
      .send({ label: "Eclipse Milan", externalListingId: "listing-e" });

    const res = await request(app)
      .patch(`/api/listings/${created.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ carGuide: { faqs: [{ question: "Missing an answer" }] } });

    expect(res.status).toBe(400);
  });
});
