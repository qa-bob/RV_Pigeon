import { Schema, model, Types, InferSchemaType } from "mongoose";
import { toJSONOptions } from "./schemaOptions";

const ACTIVITY_TYPES = ["trip_sync", "message_delivery"] as const;
const ACTIVITY_OUTCOMES = ["success", "failure"] as const;

const agentActivityLogSchema = new Schema(
  {
    type: { type: String, enum: ACTIVITY_TYPES, required: true },
    outcome: { type: String, enum: ACTIVITY_OUTCOMES, required: true },
    detail: { type: String, required: true },
    scheduledMessageId: { type: Schema.Types.ObjectId, ref: "ScheduledMessage", default: null },
    tripId: { type: Schema.Types.ObjectId, ref: "Trip", default: null },
    occurredAt: { type: Date, required: true, default: () => new Date() },
  },
  { toJSON: toJSONOptions },
);

agentActivityLogSchema.index({ occurredAt: -1 });

export type AgentActivityLogDoc = InferSchemaType<typeof agentActivityLogSchema> & {
  _id: Types.ObjectId;
};
export const AgentActivityLog = model("AgentActivityLog", agentActivityLogSchema);
export { ACTIVITY_TYPES, ACTIVITY_OUTCOMES };
