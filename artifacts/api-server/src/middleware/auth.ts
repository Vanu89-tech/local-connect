import type { NextFunction, Request, Response } from "express";
import type { User as SupabaseUser } from "@supabase/supabase-js";

import { getSupabaseClient, mapSupabaseUserToAppUser } from "../auth/supabase";
import type { User } from "../data/store";

declare global {
  namespace Express {
    interface Request {
      supabaseUser?: SupabaseUser;
      currentUser?: User;
    }
  }
}

function getBearerToken(req: Request): string | undefined {
  const header = req.get("authorization");
  if (!header) return undefined;

  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return undefined;
  return token;
}

async function attachUser(req: Request, res: Response): Promise<boolean> {
  const token = getBearerToken(req);
  if (!token) {
    res.status(401).json({ message: "Authorization bearer token is required" });
    return false;
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    res.status(503).json({ message: "Supabase server config is missing" });
    return false;
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    res.status(401).json({ message: "Invalid or expired session" });
    return false;
  }

  req.supabaseUser = data.user;
  req.currentUser = mapSupabaseUserToAppUser(data.user);
  return true;
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (await attachUser(req, res)) next();
}
