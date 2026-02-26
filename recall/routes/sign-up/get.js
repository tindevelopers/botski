import { buildMicrosoftOutlookOAuthUrl } from "../../logic/oauth.js";

export default async (req, res) => {
  const microsoftSignInUrl =
    process.env.MICROSOFT_OUTLOOK_OAUTH_CLIENT_ID
      ? buildMicrosoftOutlookOAuthUrl({ intent: "signin" })
      : null;
  return res.render("signup.ejs", {
    notice: req.notice,
    microsoftSignInUrl,
  });
}