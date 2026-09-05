import { Router } from "express";
import type {
  AgentReportResultRequest,
  AgentReportSyncFailureRequest,
  AgentSyncTripsRequest,
} from "@rv-pigeon/shared";
import { ScheduledMessage } from "../models/scheduledMessage";
import { AgentActivityLog } from "../models/agentActivityLog";
import { syncTrips } from "../services/tripSync";
import { renderTemplate } from "../services/renderTemplate";
import { getSingleHost } from "../services/singleHost";

export const agentRouter = Router();

agentRouter.post("/sync-trips", async (req, res) => {
  const { listingExternalId, trips } = req.body as AgentSyncTripsRequest;
  if (!listingExternalId || !Array.isArray(trips)) {
    res.status(400).json({ error: "listingExternalId and trips[] are required" });
    return;
  }
  try {
    const host = await getSingleHost();
    const result = await syncTrips(host._id.toString(), listingExternalId, trips);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

agentRouter.get("/due-messages", async (_req, res) => {
  const due = await ScheduledMessage.find({ status: "scheduled", sendAt: { $lte: new Date() } })
    .populate("tripId")
    .populate("listingId")
    .populate("templateId");

  const host = await getSingleHost();

  const results = due
    .filter((sm) => sm.tripId && sm.listingId && sm.templateId)
    .map((sm) => {
      const trip = sm.tripId as any;
      const listing = sm.listingId as any;
      const template = sm.templateId as any;
      const renderedBody = renderTemplate(template.body, {
        GUEST_FIRST_NAME: trip.guestFirstName,
        GUEST_LAST_NAME: trip.guestLastName,
        HOST_FIRST_NAME: host.firstName,
        HOST_PHONE_NUMBER: host.phoneNumber,
      });
      return {
        scheduledMessageId: sm._id.toString(),
        tripExternalId: trip.externalTripId,
        listingExternalId: listing.externalListingId,
        renderedBody,
      };
    });

  res.json(results);
});

agentRouter.post("/report-result", async (req, res) => {
  const { scheduledMessageId, outcome, detail } = req.body as AgentReportResultRequest;
  const scheduledMessage = await ScheduledMessage.findById(scheduledMessageId);
  if (!scheduledMessage) {
    res.status(404).json({ error: "ScheduledMessage not found" });
    return;
  }

  if (outcome === "sent") {
    scheduledMessage.status = "sent";
    scheduledMessage.sentAt = new Date();
    await scheduledMessage.save();
  } else {
    // Leave status=scheduled so it's retried on a later poll (Constitution
    // Principle V: fail loud, don't silently drop).
    await AgentActivityLog.create({
      type: "message_delivery",
      outcome: "failure",
      detail: detail ?? "Unknown delivery failure",
      scheduledMessageId: scheduledMessage._id,
      tripId: scheduledMessage.tripId,
      occurredAt: new Date(),
    });
  }

  res.status(204).end();
});

agentRouter.post("/report-sync-failure", async (req, res) => {
  const { detail } = req.body as AgentReportSyncFailureRequest;
  await AgentActivityLog.create({
    type: "trip_sync",
    outcome: "failure",
    detail: detail ?? "Unknown sync failure",
    occurredAt: new Date(),
  });
  res.status(204).end();
});
