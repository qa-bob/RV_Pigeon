import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { Host } from "../../src/models/host";

let mongod: MongoMemoryServer | undefined;

export async function setupTestDb(): Promise<void> {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();
  process.env.JWT_SECRET = "test-jwt-secret";
  process.env.AGENT_SERVICE_TOKEN = "test-agent-service-token";
  await mongoose.connect(mongod.getUri());
}

export async function teardownTestDb(): Promise<void> {
  await mongoose.disconnect();
  await mongod?.stop();
}

export async function clearTestDb(): Promise<void> {
  const collections = mongoose.connection.collections;
  for (const name of Object.keys(collections)) {
    await collections[name].deleteMany({});
  }
}

export async function createTestHost(overrides: Partial<{ email: string; firstName: string; phoneNumber: string }> = {}) {
  const passwordHash = await bcrypt.hash("test-password-123", 4);
  const host = await Host.create({
    email: overrides.email ?? "host@example.com",
    passwordHash,
    firstName: overrides.firstName ?? "Alex",
    phoneNumber: overrides.phoneNumber ?? "555-0100",
  });
  const token = jwt.sign({ hostId: host._id.toString() }, process.env.JWT_SECRET!, {
    expiresIn: "1h",
  });
  return { host, token };
}

export function agentAuthHeader(): [string, string] {
  return ["Authorization", `Bearer ${process.env.AGENT_SERVICE_TOKEN}`];
}
