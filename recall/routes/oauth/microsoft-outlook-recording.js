import { buildMicrosoftOutlookOAuthUrlForRecording } from "../../logic/oauth.js";
import { generateNotice } from "../utils.js";
import db from "../../db.js";

/**
 * GET /oauth/microsoft-outlook-recording
 * Redirects to Microsoft OAuth with recording/transcript scopes.
 * Requires admin consent in the user's tenant. Used when user enables "Teams recording & transcript".
 * Query: calendarId (optional; defaults to user's first Microsoft Outlook calendar).
 */
export default async (req, res) => {
  if (!req.authenticated) {
    res.cookie(
      "notice",
      JSON.stringify(
        generateNotice("error", "You must be signed in to enable Teams recording.")
      )
    );
    return res.redirect("/sign-in");
  }

  const userId = req.authentication.user.id;
  let calendarId = req.query.calendarId;

  if (!calendarId) {
    const msCalendar = await db.Calendar.findOne({
      where: { userId, platform: "microsoft_outlook" },
      order: [["createdAt", "ASC"]],
    });
    if (!msCalendar) {
      res.cookie(
        "notice",
        JSON.stringify(
          generateNotice(
            "error",
            "Connect Microsoft Outlook first, then enable Teams recording."
          )
        )
      );
      return res.redirect("/settings");
    }
    calendarId = msCalendar.id;
  } else {
    const calendar = await db.Calendar.findOne({
      where: { id: calendarId, userId, platform: "microsoft_outlook" },
    });
    if (!calendar) {
      res.cookie(
        "notice",
        JSON.stringify(
          generateNotice("error", "Microsoft Outlook calendar not found.")
        )
      );
      return res.redirect("/settings");
    }
  }

  const state = {
    intent: "recording",
    userId,
    calendarId,
  };
  const url = buildMicrosoftOutlookOAuthUrlForRecording(state);
  return res.redirect(url);
};
