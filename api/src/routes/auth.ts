import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Host } from "../models/host";

export const authRouter = Router();

authRouter.post("/register", async (req, res) => {
  const { email, password } = req.body ?? {};
  if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
    res.status(400).json({ error: "email and password are required" });
    return;
  }
  if (password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters" });
    return;
  }

  // This feature supports exactly one host account (FR-014, see
  // singleHost.ts) — registration is only a friendlier alternative to the
  // `seed:host` CLI script for that first account, not general sign-up.
  const existingCount = await Host.countDocuments({});
  if (existingCount > 0) {
    res.status(409).json({ error: "An account already exists. Please sign in instead." });
    return;
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    res.status(500).json({ error: "Server auth is not configured" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const host = await Host.create({ email: email.toLowerCase().trim(), passwordHash });

  const token = jwt.sign({ hostId: host._id.toString() }, secret, { expiresIn: "7d" });
  res.status(201).json({ token });
});

authRouter.post("/login", async (req, res) => {
  const { email, password } = req.body ?? {};
  if (typeof email !== "string" || typeof password !== "string") {
    res.status(400).json({ error: "email and password are required" });
    return;
  }

  const host = await Host.findOne({ email: email.toLowerCase().trim() });
  if (!host) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const matches = await bcrypt.compare(password, host.passwordHash);
  if (!matches) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    res.status(500).json({ error: "Server auth is not configured" });
    return;
  }

  const token = jwt.sign({ hostId: host._id.toString() }, secret, { expiresIn: "7d" });
  res.json({ token });
});
