import type { Request, Response, NextFunction } from "express";

// Rate Limiter tracker
interface RateLimitRecord {
  attempts: number;
  lockedUntil: number;
  lastAttempt: number;
}

const rateLimitMap = new Map<string, RateLimitRecord>();
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

// In-Memory Admin & Zero-Trust configuration
let customAllowedAdminEmails: string[] = [
  "crazybeevub@gmail.com",
  ...(process.env.ALLOWED_ADMIN_EMAILS ? process.env.ALLOWED_ADMIN_EMAILS.split(",").map((s) => s.trim().toLowerCase()) : []),
];

// Local Master Passcode (defaults to empty/disabled unless configured by user)
let localMasterPasscode: string = process.env.ADMIN_PASSCODE || "";

// Active verified session tokens for local network
const activeLocalSessions = new Set<string>();

/**
 * Clean up expired rate limit entries periodically
 */
setInterval(() => {
  const now = Date.now();
  for (const [ip, rec] of rateLimitMap.entries()) {
    if (now > rec.lockedUntil && now - rec.lastAttempt > LOCKOUT_WINDOW_MS) {
      rateLimitMap.delete(ip);
    }
  }
}, 5 * 60 * 1000);

/**
 * Check if an IP address is currently rate-limited
 */
export function checkRateLimit(ip: string): { isLocked: boolean; remainingMinutes: number } {
  const rec = rateLimitMap.get(ip);
  if (!rec) return { isLocked: false, remainingMinutes: 0 };

  const now = Date.now();
  if (now < rec.lockedUntil) {
    const remainingMs = rec.lockedUntil - now;
    return { isLocked: true, remainingMinutes: Math.ceil(remainingMs / 60000) };
  }
  return { isLocked: false, remainingMinutes: 0 };
}

/**
 * Record a failed authentication attempt
 */
export function recordFailedAttempt(ip: string): { isLocked: boolean; attemptsLeft: number } {
  const now = Date.now();
  let rec = rateLimitMap.get(ip);
  if (!rec) {
    rec = { attempts: 0, lockedUntil: 0, lastAttempt: now };
    rateLimitMap.set(ip, rec);
  }

  rec.attempts++;
  rec.lastAttempt = now;

  if (rec.attempts >= MAX_FAILED_ATTEMPTS) {
    rec.lockedUntil = now + LOCKOUT_WINDOW_MS;
    return { isLocked: true, attemptsLeft: 0 };
  }

  return { isLocked: false, attemptsLeft: MAX_FAILED_ATTEMPTS - rec.attempts };
}

/**
 * Clear failed attempts after successful authentication
 */
export function clearRateLimit(ip: string): void {
  rateLimitMap.delete(ip);
}

/**
 * Extract Zero Trust Identity from HTTP Headers
 */
export function extractZeroTrustIdentity(req: Request) {
  // 1. Cloudflare Access Headers
  const cfEmail = (req.headers["cf-access-authenticated-user-email"] as string)?.toLowerCase();
  const cfJwt = req.headers["cf-access-jwt-assertion"] as string;
  const cfConnectingIp = req.headers["cf-connecting-ip"] as string;

  // 2. Tailscale Headers
  const tailscaleLogin = (req.headers["tailscale-user-login"] as string)?.toLowerCase();
  const tailscaleName = req.headers["tailscale-user-name"] as string;

  // 3. Local Passcode / Session Token
  const authHeader = req.headers["authorization"];
  const bearerToken = authHeader && authHeader.startsWith("Bearer ") ? authHeader.substring(7) : null;
  const passcodeHeader = req.headers["x-admin-passcode"] as string;

  const clientIp = cfConnectingIp || (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "127.0.0.1";

  if (cfEmail) {
    const isAllowed = customAllowedAdminEmails.length === 0 || customAllowedAdminEmails.includes(cfEmail);
    return {
      provider: "CLOUDFLARE_ACCESS" as const,
      isAuthenticated: true,
      userEmail: cfEmail,
      userName: cfEmail.split("@")[0],
      isAdmin: isAllowed,
      clientIp,
    };
  }

  if (tailscaleLogin) {
    const isAllowed = customAllowedAdminEmails.length === 0 || customAllowedAdminEmails.includes(tailscaleLogin);
    return {
      provider: "TAILSCALE" as const,
      isAuthenticated: true,
      userEmail: tailscaleLogin,
      userName: tailscaleName || tailscaleLogin.split("@")[0],
      isAdmin: isAllowed,
      clientIp,
    };
  }

  if (bearerToken && activeLocalSessions.has(bearerToken)) {
    return {
      provider: "LOCAL_PASSCODE" as const,
      isAuthenticated: true,
      userEmail: "local-admin@station",
      userName: "Local Admin",
      isAdmin: true,
      clientIp,
    };
  }

  if (localMasterPasscode && passcodeHeader === localMasterPasscode) {
    return {
      provider: "LOCAL_PASSCODE" as const,
      isAuthenticated: true,
      userEmail: "local-admin@station",
      userName: "Local Admin",
      isAdmin: true,
      clientIp,
    };
  }

  // If no master passcode is configured and we are on local network, allow default access
  const isEnforced = Boolean(localMasterPasscode || req.headers["cf-ray"]);
  return {
    provider: isEnforced ? ("UNAUTHENTICATED" as const) : ("LOCAL_OPEN" as const),
    isAuthenticated: !isEnforced,
    userEmail: null,
    userName: null,
    isAdmin: !isEnforced,
    clientIp,
  };
}

/**
 * Express Middleware to Protect Sensitive Operations
 */
export function requireAdminAuth(req: Request, res: Response, next: NextFunction) {
  const identity = extractZeroTrustIdentity(req);

  // If pass-through is active (no passcode configured and not behind Cloudflare Access with restrictions)
  if (identity.isAdmin) {
    return next();
  }

  // If user is from Cloudflare Access but not in allowed admin list
  if (identity.provider === "CLOUDFLARE_ACCESS" && !identity.isAdmin) {
    return res.status(403).json({
      success: false,
      error: "FORBIDDEN_USER",
      message: `Access denied. Email '${identity.userEmail}' is not in the authorized admin list for this station.`,
      allowedAdminEmails: customAllowedAdminEmails,
    });
  }

  // If unauthenticated
  return res.status(401).json({
    success: false,
    error: "UNAUTHORIZED",
    message: "Zero-Trust authentication or admin passcode required to perform this action.",
    provider: identity.provider,
  });
}

/**
 * Generate a new local session token
 */
export function createLocalAdminSession(): string {
  const token = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  activeLocalSessions.add(token);
  return token;
}

/**
 * Get full Auth Status object for UI
 */
export function getFullAuthStatus(req: Request) {
  const identity = extractZeroTrustIdentity(req);
  const isPublicInternet = Boolean(req.headers["cf-ray"] || req.headers["x-forwarded-proto"] === "https");

  return {
    isAuthenticated: identity.isAuthenticated,
    provider: identity.provider,
    userEmail: identity.userEmail,
    userName: identity.userName,
    clientIp: identity.clientIp,
    isAdmin: identity.isAdmin,
    isEnforced: Boolean(localMasterPasscode || identity.provider === "CLOUDFLARE_ACCESS"),
    allowedAdminEmails: customAllowedAdminEmails,
    hasLocalPasscode: Boolean(localMasterPasscode),
    features: {
      canControlEasee: identity.isAdmin,
      canSyncSchedule: identity.isAdmin,
      canFlushCache: identity.isAdmin,
      isPublicInternet,
    },
  };
}

export function setMasterPasscode(newPasscode: string): boolean {
  localMasterPasscode = newPasscode.trim();
  return true;
}

export function verifyPasscode(passcode: string): boolean {
  if (!localMasterPasscode) return true;
  return passcode === localMasterPasscode;
}

export function updateAllowedEmails(emails: string[]): string[] {
  customAllowedAdminEmails = emails.map((e) => e.trim().toLowerCase()).filter(Boolean);
  return customAllowedAdminEmails;
}
