import { Schema, model, InferSchemaType } from "mongoose";

const hostSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
  },
  { timestamps: true },
);

export type HostDoc = InferSchemaType<typeof hostSchema>;
export const Host = model("Host", hostSchema);
