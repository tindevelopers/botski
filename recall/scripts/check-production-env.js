#!/usr/bin/env node
/**
 * Check production env vars required for bot scheduling (webhooks, callbacks).
 *
 * With Railway CLI (from repo root):
 *   1. Link a service: railway link  (then pick project → environment → service)
 *   2. List vars:     railway variables
 *   3. Run this:      railway run -s <service> node recall/scripts/check-production-env.js
 * Or from recall/:   railway run -s <service> node scripts/check-production-env.js
 */
const vars = {
  PUBLIC_URL: process.env.PUBLIC_URL,
  RAILWAY_PUBLIC_DOMAIN: process.env.RAILWAY_PUBLIC_DOMAIN,
  RAILWAY_STATIC_URL: process.env.RAILWAY_STATIC_URL,
  NODE_ENV: process.env.NODE_ENV,
};
const resolved = vars.PUBLIC_URL
  || (vars.RAILWAY_PUBLIC_DOMAIN ? `https://${vars.RAILWAY_PUBLIC_DOMAIN}` : null)
  || vars.RAILWAY_STATIC_URL;
const isSafe = resolved && !/localhost|127\.0\.0\.1/i.test(resolved);

console.log("Production env check (bot webhooks):");
console.log(JSON.stringify(vars, null, 2));
console.log("Resolved public URL:", resolved || "(none)");
console.log("Safe for Recall API (no localhost):", isSafe ? "yes" : "no");
if (!isSafe && process.env.RAILWAY_ENVIRONMENT) {
  console.log("\nSet PUBLIC_URL in Railway to your app URL (e.g. https://your-app.up.railway.app) so bots get webhooks.");
}
