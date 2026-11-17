import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { db, type UserRow } from "./db.js";

const SESSION_COOKIE = "hm_session";
const SESSION_DAYS = 30;
const TRIAL_DAYS = 14;

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(password, Buffer.from(saltHex, "hex"), expected.length);
  // Lengths must match before timingSafeEqual, which throws on a mismatch.
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function createUser(email: string, password: string): UserRow {
  const trialEnds = new Date(Date.now() + TRIAL_DAYS * 864e5).toISOString();
  const info = db
    .prepare(
      "INSERT INTO users (email, password_hash, trial_ends_at) VALUES (?, ?, ?)"
    )
    .run(email.trim().toLowerCase(), hashPassword(password), trialEnds);
  db.prepare("INSERT INTO settings (user_id) VALUES (?)").run(info.lastInsertRowid);
  return db
    .prepare("SELECT * FROM users WHERE id = ?")
    .get(info.lastInsertRowid) as UserRow;
}

export function findUserByEmail(email: string): UserRow | undefined {
  return db
    .prepare("SELECT * FROM users WHERE email = ?")
    .get(email.trim().toLowerCase()) as UserRow | undefined;
}

export function startSession(res: Response, userId: number): void {
  const id = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + SESSION_DAYS * 864e5);
  db.prepare("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)").run(
    id,
    userId,
    expires.toISOString()
  );
  res.cookie(SESSION_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires,
  });
}

export function endSession(req: Request, res: Response): void {
  const id = req.cookies?.[SESSION_COOKIE];
  if (id) db.prepare("DELETE FROM sessions WHERE id = ?").run(id);
  res.clearCookie(SESSION_COOKIE);
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: UserRow;
    }
  }
}

/** Attaches req.user when a live session cookie is present. Never blocks. */
export function loadUser(req: Request, _res: Response, next: NextFunction): void {
  const id = req.cookies?.[SESSION_COOKIE];
  if (id) {
    const row = db
      .prepare(
        `SELECT u.* FROM sessions s
         JOIN users u ON u.id = s.user_id
         WHERE s.id = ? AND s.expires_at > datetime('now')`
      )
      .get(id) as UserRow | undefined;
    if (row) req.user = row;
  }
  next();
}

export function requireUser(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.redirect("/login");
    return;
  }
  next();
}

/** Housekeeping so the sessions table does not grow without bound. */
export function purgeExpiredSessions(): void {
  db.prepare("DELETE FROM sessions WHERE expires_at <= datetime('now')").run();
}
