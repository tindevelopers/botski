import {
  fetchTokensFromAuthorizationCodeForMicrosoftOutlook,
  fetchMicrosoftUserProfile,
} from "../../logic/oauth.js";
import { getAuthTokenForUser } from "../../logic/auth.js";
import { generateNotice } from "../utils.js";
import Recall from "../../services/recall/index.js";
import db from "../../db.js";

export default async (req, res) => {
  // #region agent log
  fetch('http://127.0.0.1:7248/ingest/9df62f0f-78c1-44fb-821f-c3c7b9f764cc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'oauth-callback/microsoft-outlook.js:entry',message:'ms_oauth_callback_entry',data:{host:req.headers.host,hasCode:!!req.query.code,stateRaw:typeof req.query.state,publicUrl:process.env.PUBLIC_URL||'(not set)'},timestamp:Date.now(),runId:'ms-oauth',hypothesisId:'H1'})}).catch(()=>{});
  // #endregion
  if (
    req.headers.host.indexOf("localhost") === -1 &&
    process.env.NODE_ENV === "development"
  ) {
    const url = new URL(
      `http://localhost:${process.env.PORT}/oauth-callback/microsoft-outlook`
    );
    url.search = new URLSearchParams(req.query).toString();
    // this ensures we redirect back to localhost and not tunneled public URL
    // before processing the oauth callback, which ensures cookies(authToken, notice)
    // are set correctly in development
    return res.redirect(url.toString());
  }

  try {
    // Admin consent redirect: Microsoft sends admin_consent=True&tenant=... (no code)
    if (req.query.admin_consent === "True" || req.query.admin_consent === "true") {
      res.cookie(
        "notice",
        JSON.stringify(
          generateNotice(
            "success",
            "Admin consent granted. Users in your organization can now sign in to TIN Meetings."
          )
        )
      );
      return res.redirect("/");
    }

    const state = JSON.parse(req.query.state || "{}");
    const { intent } = state;
    const userId = state.userId;
    let calendarId = state.calendarId;
    // #region agent log
    fetch('http://127.0.0.1:7248/ingest/9df62f0f-78c1-44fb-821f-c3c7b9f764cc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'oauth-callback/microsoft-outlook.js:state_parsed',message:'ms_oauth_state_parsed',data:{intent,intentIsSignin:intent==='signin',hasUserId:!!userId},timestamp:Date.now(),runId:'ms-oauth',hypothesisId:'H1'})}).catch(()=>{});
    // #endregion

    // Sign-in / sign-up with Microsoft (no existing user)
    if (intent === "signin") {
      const oauthTokens =
        await fetchTokensFromAuthorizationCodeForMicrosoftOutlook(req.query.code);
      // #region agent log
      fetch('http://127.0.0.1:7248/ingest/9df62f0f-78c1-44fb-821f-c3c7b9f764cc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'oauth-callback/microsoft-outlook.js:signin_token_exchange',message:'ms_oauth_signin_tokens',data:{hasError:!!oauthTokens.error,errorDesc:oauthTokens.error_description||null},timestamp:Date.now(),runId:'ms-oauth',hypothesisId:'H2'})}).catch(()=>{});
      // #endregion
      if (oauthTokens.error) {
        res.cookie(
          "notice",
          JSON.stringify(
            generateNotice(
              "error",
              `Microsoft sign-in failed: ${oauthTokens.error_description || oauthTokens.error}`
            )
          )
        );
        return res.redirect("/sign-in");
      }
      const profile = await fetchMicrosoftUserProfile(oauthTokens.access_token);
      // #region agent log
      fetch('http://127.0.0.1:7248/ingest/9df62f0f-78c1-44fb-821f-c3c7b9f764cc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'oauth-callback/microsoft-outlook.js:signin_profile',message:'ms_oauth_signin_profile',data:{hasEmail:!!profile?.email},timestamp:Date.now(),runId:'ms-oauth',hypothesisId:'H3'})}).catch(()=>{});
      // #endregion
      if (!profile.email) {
        res.cookie(
          "notice",
          JSON.stringify(generateNotice("error", "Microsoft did not provide an email."))
        );
        return res.redirect("/sign-in");
      }
      let user = await db.User.findOne({ where: { email: profile.email } });
      if (!user) {
        user = await db.User.create({
          email: profile.email,
          name: profile.name,
          password: `oauth-ms-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        });
        console.log(`Created user via Microsoft sign-in: ${profile.email}`);
      }
      res.cookie("authToken", getAuthTokenForUser(user), {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 30 * 24 * 60 * 60 * 1000,
      });
      res.cookie(
        "notice",
        JSON.stringify(generateNotice("success", "Signed in with Microsoft."))
      );
      // #region agent log
      fetch('http://127.0.0.1:7248/ingest/9df62f0f-78c1-44fb-821f-c3c7b9f764cc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'oauth-callback/microsoft-outlook.js:signin_redirect',message:'ms_oauth_signin_redirect_to_home',data:{userId:user?.id,host:req.headers.host},timestamp:Date.now(),runId:'ms-oauth',hypothesisId:'H4'})}).catch(()=>{});
      // #endregion
      return res.redirect("/");
    }

    // Teams recording & transcript: upgrade existing calendar with recording scopes (admin consent may be required)
    if (intent === "recording" && userId && calendarId) {
      const oauthTokens =
        await fetchTokensFromAuthorizationCodeForMicrosoftOutlook(req.query.code);
      if (oauthTokens.error) {
        res.cookie(
          "notice",
          JSON.stringify(
            generateNotice(
              "error",
              `Could not enable Teams recording: ${oauthTokens.error_description || oauthTokens.error}. Your organization may require an admin to approve this app.`
            )
          )
        );
        return res.redirect("/settings");
      }

      const localCalendar = await db.Calendar.findOne({
        where: { id: calendarId, userId, platform: "microsoft_outlook" },
      });
      if (!localCalendar || !localCalendar.recallId) {
        res.cookie(
          "notice",
          JSON.stringify(
            generateNotice("error", "Calendar not found. Please connect Outlook first.")
          )
        );
        return res.redirect("/settings");
      }

      try {
        await Recall.updateCalendar({
          id: localCalendar.recallId,
          data: {
            platform: "microsoft_outlook",
            oauth_refresh_token: oauthTokens.refresh_token,
            oauth_client_id: process.env.MICROSOFT_OUTLOOK_OAUTH_CLIENT_ID,
            oauth_client_secret:
              process.env.MICROSOFT_OUTLOOK_OAUTH_CLIENT_SECRET,
            webhook_url: `${process.env.PUBLIC_URL}/webhooks/recall-calendar-updates`,
          },
        });
      } catch (err) {
        console.error("[ERROR] Failed to update Recall calendar with recording tokens:", err?.message || err);
        res.cookie(
          "notice",
          JSON.stringify(
            generateNotice(
              "error",
              "Failed to save recording permissions. Please try again."
            )
          )
        );
        return res.redirect("/settings");
      }

      const updatedRecallData = {
        ...(localCalendar.recallData || {}),
        oauth_refresh_token: oauthTokens.refresh_token,
        teamsRecordingConsent: true,
      };
      localCalendar.recallData = updatedRecallData;
      await localCalendar.save();

      res.cookie(
        "notice",
        JSON.stringify(
          generateNotice(
            "success",
            "Teams recording and transcript access enabled. You can now use Teams meeting recordings and transcripts."
          )
        )
      );
      return res.redirect(`/settings?calendarId=${calendarId}`);
    }

    // Calendar connection flow (existing user)
    if (!userId) {
      // #region agent log
      fetch('http://127.0.0.1:7248/ingest/9df62f0f-78c1-44fb-821f-c3c7b9f764cc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'oauth-callback/microsoft-outlook.js:calendar_no_userId',message:'ms_oauth_calendar_no_user_id',data:{},timestamp:Date.now(),runId:'ms-oauth',hypothesisId:'H1'})}).catch(()=>{});
      // #endregion
      res.cookie(
        "notice",
        JSON.stringify(generateNotice("error", "Invalid Microsoft OAuth state. Please try connecting again from Settings."))
      );
      return res.redirect("/");
    }
    console.log(
      `Received microsoft oauth callback for user ${userId} with code ${req.query.code}`
    );

    const oauthTokens =
      await fetchTokensFromAuthorizationCodeForMicrosoftOutlook(req.query.code);

    if (oauthTokens.error) {
      // #region agent log
      fetch('http://127.0.0.1:7248/ingest/9df62f0f-78c1-44fb-821f-c3c7b9f764cc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'oauth-callback/microsoft-outlook.js:calendar_token_error',message:'ms_oauth_calendar_tokens_error',data:{error:oauthTokens.error},timestamp:Date.now(),runId:'ms-oauth',hypothesisId:'H2'})}).catch(()=>{});
      // #endregion
      res.cookie(
        "notice",
        JSON.stringify(
          generateNotice(
            "error",
            `Failed to exchanged code for oauth tokens due to "${oauthTokens.error}(${oauthTokens.error_description})"`
          )
        )
      );
      return res.redirect("/");
    }

    console.log(
      `Successfully exchanged code for oauth tokens: ${JSON.stringify(
        oauthTokens
      )}`
    );

    let localCalendar = null;
    let recallCalendar = null;
    if (calendarId) {
      localCalendar = await db.Calendar.findByPk(calendarId);
      // If calendar was deleted (disconnected), treat as new connection
      if (!localCalendar) {
        console.log(`Calendar ${calendarId} not found (was deleted/disconnected), treating as new connection`);
        calendarId = null; // Clear calendarId to force new calendar creation
      }
    }

    if (localCalendar && localCalendar.recallId) {
      // this calendar was re-connected so we need to update the oauth tokens in Recall
      // and update the calendar in our database
      // If the calendar was deleted from Recall (disconnected), create a new one instead
      try {
        recallCalendar = await Recall.updateCalendar({
          id: localCalendar.recallId,
          data: {
            platform: "microsoft_outlook",
            oauth_refresh_token: oauthTokens.refresh_token,
            oauth_client_id: process.env.MICROSOFT_OUTLOOK_OAUTH_CLIENT_ID,
            oauth_client_secret:
              process.env.MICROSOFT_OUTLOOK_OAUTH_CLIENT_SECRET,
            webhook_url: `${process.env.PUBLIC_URL}/webhooks/recall-calendar-updates`,
          },
        });
        console.log(
          `Successfully updated calendar in Recall: ${JSON.stringify(
            recallCalendar
          )}`
        );
        localCalendar.recallData = recallCalendar;
        await localCalendar.save();
        console.log(
          `Successfully updated calendar(id: ${localCalendar.id}) in database`
        );
      } catch (err) {
        // If calendar was deleted from Recall (404), create a new one
        if (err.res && err.res.status === 404) {
          console.warn(
            `Calendar ${localCalendar.recallId} not found in Recall (was disconnected); creating new calendar. Error:`,
            err.message || err
          );
          recallCalendar = await Recall.createCalendar({
            platform: "microsoft_outlook",
            webhook_url: `${process.env.PUBLIC_URL}/webhooks/recall-calendar-updates`,
            oauth_refresh_token: oauthTokens.refresh_token,
            oauth_client_id: process.env.MICROSOFT_OUTLOOK_OAUTH_CLIENT_ID,
            oauth_client_secret: process.env.MICROSOFT_OUTLOOK_OAUTH_CLIENT_SECRET,
          });
          localCalendar.recallId = recallCalendar.id;
          localCalendar.recallData = recallCalendar;
          await localCalendar.save();
          console.log(
            `Successfully created new Recall calendar and updated local calendar(id: ${localCalendar.id})`
          );
        } else {
          // Re-throw other errors
          throw err;
        }
      }
    } else {
      // Idempotency: if a calendar already exists for this user+platform, treat this as a reconnect.
      // (The dashboard "Connect" button historically didn't include calendarId in state, which caused duplicates.)
      // But don't reuse disconnected calendars - they should be treated as new connections
      const existing = await db.Calendar.findOne({
        where: { userId, platform: "microsoft_outlook" },
        order: [["updatedAt", "DESC"]],
      });

      // Only reuse existing calendar if it's actually connected (not disconnected)
      let calendarToReuse = existing;
      if (existing) {
        const existingStatus = existing.status || existing.recallData?.status;
        if (existingStatus === "disconnected") {
          console.log(`Existing calendar ${existing.id} is disconnected, creating new calendar instead`);
          // Delete the disconnected calendar and create a new one
          try {
            if (existing.recallId) {
              await Recall.deleteCalendar(existing.recallId).catch(() => {});
            }
          } catch (err) {
            // Ignore errors deleting from Recall
          }
          await existing.destroy();
          calendarToReuse = null; // Force new calendar creation
        }
      }

      if (calendarToReuse && calendarToReuse.recallId) {
        localCalendar = calendarToReuse;
        try {
          recallCalendar = await Recall.updateCalendar({
            id: localCalendar.recallId,
            data: {
              platform: "microsoft_outlook",
              oauth_refresh_token: oauthTokens.refresh_token,
              oauth_client_id: process.env.MICROSOFT_OUTLOOK_OAUTH_CLIENT_ID,
              oauth_client_secret:
                process.env.MICROSOFT_OUTLOOK_OAUTH_CLIENT_SECRET,
              webhook_url: `${process.env.PUBLIC_URL}/webhooks/recall-calendar-updates`,
            },
          });
          console.log(
            `Successfully reconnected existing calendar in Recall: ${JSON.stringify(
              recallCalendar
            )}`
          );
          localCalendar.recallData = recallCalendar;
          await localCalendar.save();
          console.log(
            `Successfully updated existing calendar(id: ${localCalendar.id}) in database`
          );
        } catch (err) {
          console.warn(
            `WARN: Failed to update existing Recall calendar (${localCalendar.recallId}); creating a new Recall calendar and updating the existing local record. Error:`,
            err.message || err
          );
          recallCalendar = await Recall.createCalendar({
            platform: "microsoft_outlook",
            webhook_url: `${process.env.PUBLIC_URL}/webhooks/recall-calendar-updates`,
            oauth_refresh_token: oauthTokens.refresh_token,
            oauth_client_id: process.env.MICROSOFT_OUTLOOK_OAUTH_CLIENT_ID,
            oauth_client_secret:
              process.env.MICROSOFT_OUTLOOK_OAUTH_CLIENT_SECRET,
          });
          localCalendar.recallId = recallCalendar.id;
          localCalendar.recallData = recallCalendar;
          await localCalendar.save();
          console.log(
            `Successfully created new Recall calendar and updated existing local calendar(id: ${localCalendar.id})`
          );
        }
      } else {
        // this calendar was connected for the first time so we need to create it in Recall
        // and then create it in our database
        recallCalendar = await Recall.createCalendar({
          platform: "microsoft_outlook",
          webhook_url: `${process.env.PUBLIC_URL}/webhooks/recall-calendar-updates`,
          oauth_refresh_token: oauthTokens.refresh_token,
          oauth_client_id: process.env.MICROSOFT_OUTLOOK_OAUTH_CLIENT_ID,
          oauth_client_secret: process.env.MICROSOFT_OUTLOOK_OAUTH_CLIENT_SECRET,
        });
        console.log(
          `Successfully created calendar in Recall: ${JSON.stringify(
            recallCalendar
          )}`
        );

        localCalendar = await db.Calendar.create({
          platform: "microsoft_outlook",
          recallId: recallCalendar.id,
          recallData: recallCalendar,
          userId,
        });
        console.log(
          `Successfully created calendar in database with id: ${localCalendar.id}`
        );
      }
    }

    // The calendar might still be "connecting" at this point - Recall will send a webhook
    // when it's fully connected with the email. Use user's email as fallback.
    const user = await db.User.findByPk(userId);
    const calendarEmail = localCalendar.email && localCalendar.email !== "Unknown" 
      ? localCalendar.email 
      : null;
    const emailDisplay = calendarEmail || user?.email || "your account";
    res.cookie(
      "notice",
      JSON.stringify(
        generateNotice(
          "success",
          `Successfully connected Microsoft Outlook for ${emailDisplay}`
        )
      )
    );

    return res.redirect("/");
  } catch (err) {
    // #region agent log
    fetch('http://127.0.0.1:7248/ingest/9df62f0f-78c1-44fb-821f-c3c7b9f764cc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'oauth-callback/microsoft-outlook.js:catch',message:'ms_oauth_callback_exception',data:{errMessage:err?.message},timestamp:Date.now(),runId:'ms-oauth',hypothesisId:'H5'})}).catch(()=>{});
    // #endregion
    console.error(
      `[ERROR] Failed to handle oauth callback from Microsoft calendar:`,
      err.message || err
    );
    console.error(`[ERROR] Stack:`, err.stack);
    res.cookie(
      "notice",
      JSON.stringify(
        generateNotice(
          "error",
          `Failed to connect Microsoft calendar: ${err.message || 'Unknown error'}`
        )
      )
    );
    return res.redirect("/");
  }
};
