import {
  getMicrosoftSignInScopes,
  getMicrosoftAdminConsentUrl,
} from "../../logic/oauth.js";

/**
 * GET /api/debug/ms-oauth?tenant=optional-tenant-id
 * Returns the Microsoft OAuth scopes used for sign-in and the admin consent URL.
 * Use this to verify the deployed app is using minimal scopes (no OnlineMeetings.Read in signInScopes).
 */
export default async (req, res) => {
  const tenant = req.query.tenant || "common";
  const signInScopes = getMicrosoftSignInScopes();
  const adminConsentUrl = getMicrosoftAdminConsentUrl(tenant);
  res.json({
    signInScopes,
    adminConsentUrl,
    note: "If signInScopes includes OnlineMeetings.Read or *.Read.All, the deployment may not have the latest code. Admin consent URL: have an org admin open it to grant consent for all users in their tenant.",
  });
};
