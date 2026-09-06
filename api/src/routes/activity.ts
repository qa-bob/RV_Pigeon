import { Router } from "express";
import { AgentActivityLog } from "../models/agentActivityLog";

export const activityRouter = Router();

activityRouter.get("/", async (req, res) => {
  const filter: Record<string, unknown> = {};
  if (typeof req.query.outcome === "string") {
    filter.outcome = req.query.outcome;
  }
  if (typeof req.query.since === "string") {
    const since = new Date(req.query.since);
    if (!Number.isNaN(since.getTime())) {
      filter.occurredAt = { $gte: since };
    }
  }
  const entries = await AgentActivityLog.find(filter).sort({ occurredAt: -1 }).limit(200);
  res.json(entries);
});
