import { Schema, model, InferSchemaType } from "mongoose";
import { toJSONOptions } from "./schemaOptions";

const hostSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    // Used to render the {{HOST_FIRST_NAME}} / {{HOST_PHONE_NUMBER}} template
    // variables (see api/src/services/renderTemplate.ts). Optional so an
    // account can be created before this profile info is filled in.
    firstName: { type: String, default: "", trim: true },
    phoneNumber: { type: String, default: "", trim: true },
  },
  { timestamps: true, toJSON: toJSONOptions },
);

export type HostDoc = InferSchemaType<typeof hostSchema>;
export const Host = model("Host", hostSchema);
