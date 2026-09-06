import express, { ErrorRequestHandler } from "express";
import cors from "cors";
import { authRouter } from "./routes/auth";
import { templatesRouter } from "./routes/templates";
import { listingsRouter } from "./routes/listings";
import { agentRouter } from "./routes/agent";
import { tripsRouter } from "./routes/trips";
import { scheduledMessagesRouter } from "./routes/scheduledMessages";
import { activityRouter } from "./routes/activity";
import { dashboardAuth } from "./middleware/dashboardAuth";
import { agentAuth } from "./middleware/agentAuth";

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get("/health", (_req, res) => res.json({ status: "ok" }));

  app.use("/api/auth", authRouter);
  app.use("/api/templates", dashboardAuth, templatesRouter);
  app.use("/api/listings", dashboardAuth, listingsRouter);
  app.use("/api/trips", dashboardAuth, tripsRouter);
  app.use("/api/scheduled-messages", dashboardAuth, scheduledMessagesRouter);
  app.use("/api/activity", dashboardAuth, activityRouter);
  app.use("/agent", agentAuth, agentRouter);

  const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  };
  app.use(errorHandler);

  return app;
}
