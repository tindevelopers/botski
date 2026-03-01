/**
 * Ingest external meetings (not on user's calendar)
 *
 * POST /api/ingest-external-meeting
 * Body: { meetingUrl?: string, recordingUrl?: string, title?: string }
 *
 * - meetingUrl: Teams meeting URL → try Graph API with user's Microsoft calendars
 * - recordingUrl: Direct recording URL → create artifact, queue Super Agent
 */

import db from "../../db.js";
import { backgroundQueue } from "../../queue.js";

function isValidTeamsUrl(url) {
  if (!url || typeof url !== "string") return false;
  const u = url.trim().toLowerCase();
  return u.includes("teams.microsoft.com") && (u.startsWith("http://") || u.startsWith("https://"));
}

function isValidRecordingUrl(url) {
  if (!url || typeof url !== "string") return false;
  const u = url.trim().toLowerCase();
  return u.startsWith("http://") || u.startsWith("https://");
}

export default async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!req.authenticated) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const userId = req.authentication.user.id;
  const { meetingUrl, recordingUrl, title } = req.body || {};

  const meetingUrlTrimmed = meetingUrl ? String(meetingUrl).trim() : null;
  const recordingUrlTrimmed = recordingUrl ? String(recordingUrl).trim() : null;

  if (meetingUrlTrimmed && recordingUrlTrimmed) {
    return res.status(400).json({
      error: "Provide either meetingUrl or recordingUrl, not both",
    });
  }

  if (!meetingUrlTrimmed && !recordingUrlTrimmed) {
    return res.status(400).json({
      error: "Provide meetingUrl (Teams link) or recordingUrl (direct recording link)",
    });
  }

  try {
    if (meetingUrlTrimmed) {
      if (!isValidTeamsUrl(meetingUrlTrimmed)) {
        return res.status(400).json({
          error: "Invalid Teams meeting URL. Must be a teams.microsoft.com link.",
        });
      }

      const microsoftCalendars = await db.Calendar.findAll({
        where: {
          userId,
          platform: "microsoft_outlook",
        },
        include: [{ model: db.User, attributes: ["id", "email"] }],
      });

      if (microsoftCalendars.length === 0) {
        return res.status(400).json({
          error: "Connect a Microsoft Outlook calendar first to import Teams meetings.",
        });
      }

      await backgroundQueue.add(
        "meeting.ingest_external",
        {
          meetingUrl: meetingUrlTrimmed,
          userId,
          title: title ? String(title).trim() : null,
        },
        { removeOnComplete: true, removeOnFail: false }
      );

      return res.json({
        success: true,
        message: "Teams meeting import queued. We'll try to fetch the recording using your calendars.",
        type: "teams_url",
      });
    }

    if (recordingUrlTrimmed) {
      if (!isValidRecordingUrl(recordingUrlTrimmed)) {
        return res.status(400).json({
          error: "Invalid recording URL. Must start with http:// or https://",
        });
      }

      await backgroundQueue.add(
        "meeting.ingest_external",
        {
          recordingUrl: recordingUrlTrimmed,
          userId,
          title: title ? String(title).trim() : null,
        },
        { removeOnComplete: true, removeOnFail: false }
      );

      return res.json({
        success: true,
        message: "Recording import queued. Transcription and Super Agent analysis will run shortly.",
        type: "recording_url",
      });
    }
  } catch (error) {
    console.error("[API] Error queueing external ingest:", error);
    return res.status(500).json({
      error: "Failed to queue import",
      message: error.message,
    });
  }
};
