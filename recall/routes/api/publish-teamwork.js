import db from "../../db.js";
import { backgroundQueue } from "../../queue.js";
import { Op } from "sequelize";

/**
 * POST /api/meetings/:meetingId/publish/teamwork
 * Queue publishing this meeting's summary and action items to the user's Teamwork target.
 */
export default async (req, res) => {
  if (!req.authenticated) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const userId = req.authentication.user.id;
  const { meetingId } = req.params;

  try {
    const teamworkTarget = await db.PublishTarget.findOne({
      where: { userId, type: "teamwork", enabled: true },
    });

    if (!teamworkTarget?.config?.baseUrl || !teamworkTarget?.config?.apiKey) {
      return res.status(400).json({
        error: "Teamwork not configured",
        message: "Please configure and enable a Teamwork target in Settings > Publishing.",
      });
    }

    const artifact = await db.MeetingArtifact.findOne({
      where: {
        userId,
        [Op.or]: [{ id: meetingId }, { readableId: meetingId }],
      },
    });

    if (!artifact) {
      return res.status(404).json({ error: "Meeting not found" });
    }

    const summary = await db.MeetingSummary.findOne({
      where: { meetingArtifactId: artifact.id },
      order: [["createdAt", "DESC"]],
    });

    if (!summary) {
      return res.status(404).json({
        error: "Meeting summary not found",
        message: "Generate a summary for this meeting first.",
      });
    }

    await backgroundQueue.add("publishing.dispatch", {
      meetingSummaryId: summary.id,
      teamworkOverride: true,
    });

    return res.json({
      success: true,
      message: "Publishing to Teamwork…",
    });
  } catch (err) {
    console.error("[API] publish-teamwork error", err);
    return res.status(500).json({
      error: err.message || "Failed to publish to Teamwork",
    });
  }
};
