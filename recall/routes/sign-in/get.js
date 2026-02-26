import { buildMicrosoftOutlookOAuthUrl } from "../../logic/oauth.js";

export default async (req, res) => {
  if (req.authenticated) {
    return res.redirect("/");
  }
  const microsoftSignInUrl =
    process.env.MICROSOFT_OUTLOOK_OAUTH_CLIENT_ID
      ? buildMicrosoftOutlookOAuthUrl({ intent: "signin" })
      : null;
  return res.render("signin.ejs", {
    notice: req.notice,
    microsoftSignInUrl,
  });
};