import { Router } from "express";
import { Error as MongooseError } from "mongoose";
import { MessageTemplate } from "../models/messageTemplate";
import type { DashboardAuthedRequest } from "../middleware/dashboardAuth";

export const templatesRouter = Router();

templatesRouter.get("/", async (req: DashboardAuthedRequest, res) => {
  const templates = await MessageTemplate.find({ hostId: req.hostId }).sort({ createdAt: -1 });
  res.json(templates);
});

templatesRouter.post("/", async (req: DashboardAuthedRequest, res) => {
  try {
    const template = await MessageTemplate.create({ ...req.body, hostId: req.hostId });
    res.status(201).json(template);
  } catch (err) {
    if (err instanceof MongooseError.ValidationError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
});

templatesRouter.patch("/:id", async (req: DashboardAuthedRequest, res) => {
  const template = await MessageTemplate.findOne({ _id: req.params.id, hostId: req.hostId });
  if (!template) {
    res.status(404).json({ error: "Template not found" });
    return;
  }
  try {
    template.set(req.body);
    await template.save();
    res.json(template);
  } catch (err) {
    if (err instanceof MongooseError.ValidationError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
});
