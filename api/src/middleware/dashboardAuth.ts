import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface DashboardAuthedRequest extends Request {
  hostId?: string;
}

export function dashboardAuth(req: DashboardAuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing bearer token" });
    return;
  }
  const token = header.slice("Bearer ".length);
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    res.status(500).json({ error: "Server auth is not configured" });
    return;
  }
  try {
    const payload = jwt.verify(token, secret) as { hostId: string };
    req.hostId = payload.hostId;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}
