import mongoose from "mongoose";

let connected = false;

export async function connectDb(): Promise<typeof mongoose> {
  if (connected) {
    return mongoose;
  }
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not set");
  }
  await mongoose.connect(uri);
  connected = true;
  return mongoose;
}

export async function disconnectDb(): Promise<void> {
  if (connected) {
    await mongoose.disconnect();
    connected = false;
  }
}
