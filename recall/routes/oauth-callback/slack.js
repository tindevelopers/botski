import crypto from "crypto";
import db from "../../db.js";
import { exchangeSlackCodeForToken } from "../../logic/slack-oauth.js";
import { generateNotice } from "../utils.js";

export default async (req, res) => {
  try {
    const { state, code } = req.query;
    let stateStr = state;
    if (typeof stateStr === "string" && /%[0-9A-Fa-f]{2}/.test(stateStr)) {
      try {
        stateStr = decodeURIComponent(stateStr);
      } catch (_) {
        // leave as-is if decode fails
      }
    }
    const parsedState = stateStr ? JSON.parse(stateStr) : {};
    const userId = parsedState.userId;

    if (!userId) {
      throw new Error("Missing userId in Slack OAuth state");
    }
    if (!code) {
      throw new Error("Missing Slack OAuth code");
    }

    const tokenResponse = await exchangeSlackCodeForToken(code);
    const accessToken = tokenResponse?.access_token;
    const authedTeam = tokenResponse?.team || {};
    const botUserId = tokenResponse?.bot_user_id;

    if (!accessToken) {
      throw new Error("Slack OAuth did not return an access token");
    }

    // Integration.id is UUID; Slack returns team id like T4PCHD9UP. Find by userId+provider or create with new UUID.
    const existing = await db.Integration.findOne({
      where: { userId, provider: "slack" },
    });
    const payload = {
      userId,
      provider: "slack",
      accessToken,
      refreshToken: null,
      config: {
        teamId: authedTeam.id,
        teamName: authedTeam.name,
        botUserId,
        scope: tokenResponse?.scope,
      },
    };
    if (existing) {
      await existing.update(payload);
    } else {
      await db.Integration.create({
        id: crypto.randomUUID(),
        ...payload,
      });
    }

    res.cookie(
      "notice",
      JSON.stringify(generateNotice("success", "Connected Slack successfully."))
    );
    return res.redirect("/publishing-targets" || "/");
  } catch (err) {
    console.error("[ERROR] Slack OAuth callback failed:", err);
    res.cookie(
      "notice",
      JSON.stringify(
        generateNotice(
          "error",
          `Failed to connect Slack: ${err.message || "unknown error"}`
        )
      )
    );
    return res.redirect("/");
  }
};
