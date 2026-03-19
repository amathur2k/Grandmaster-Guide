import type { Request, Response, NextFunction } from "express";
import geoip from "geoip-lite";

const ALLOWED_COUNTRIES = new Set(["US", "GB", "CA", "AU"]);

const BLOCKED_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Chess Analysis — Not Available</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #0a0a0a;
      color: #e5e5e5;
      padding: 2rem;
    }
    .container {
      text-align: center;
      max-width: 480px;
    }
    .icon { font-size: 4rem; margin-bottom: 1.5rem; }
    h1 { font-size: 1.5rem; font-weight: 600; margin-bottom: 0.75rem; }
    p { font-size: 1rem; color: #a3a3a3; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">♟️</div>
    <h1>Not Available in Your Region</h1>
    <p>Chess Analysis is currently only available in the United States, United Kingdom, Canada, and Australia. We hope to expand to more regions soon.</p>
  </div>
</body>
</html>`;

export function geoRestriction(req: Request, res: Response, next: NextFunction) {
  if (process.env.NODE_ENV !== "production") {
    return next();
  }

  const forwarded = req.headers["x-forwarded-for"];
  const ip = typeof forwarded === "string"
    ? forwarded.split(",")[0].trim()
    : req.ip || req.socket.remoteAddress || "";

  const geo = geoip.lookup(ip);

  if (!geo || ALLOWED_COUNTRIES.has(geo.country)) {
    return next();
  }

  res.status(403).send(BLOCKED_HTML);
}
