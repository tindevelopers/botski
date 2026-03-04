import db from "../../db.js";
import { backgroundQueue } from "../../queue.js";
import { createConversation, listUsers, inviteUsers } from "../../services/slack/web-api-client.js";
import { Op } from "sequelize";

export default async (req, res) => {
  if (!req.authenticated) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const userId = req.authentication.user.id;
  const { meetingId } = req.params;
  const { channelId, channelName, createChannelName, isPrivate, inviteAll } = req.body;

  try {
    const integration = await db.Integration.findOne({
      where: { userId, provider: "slack" },
    });
    if (!integration?.accessToken) {
      return res.status(400).json({ error: "Slack not connected" });
    }

    // Resolve summary: prefer MeetingSummary; fallback to Super Agent analysis (no MeetingSummary row for Super-Only meetings)
    let summary = await db.MeetingSummary.findOne({
      where: { meetingArtifactId: meetingId },
      order: [["createdAt", "DESC"]],
    });
    if (!summary) {
      const artifact = await db.MeetingArtifact.findOne({
        where: {
          [Op.or]: [{ id: meetingId }, { readableId: meetingId }],
          userId,
        },
        include: [{ model: db.CalendarEvent }],
      });
      if (!artifact) {
        return res.status(404).json({ error: "Meeting not found" });
      }
      const analysis = await db.MeetingSuperAgentAnalysis.findOne({
        where: { meetingArtifactId: artifact.id, status: "completed" },
        order: [["updatedAt", "DESC"]],
      });
      if (!analysis) {
        return res.status(404).json({ error: "Meeting summary not found" });
      }
      const [summaryRow] = await db.MeetingSummary.findOrCreate({
        where: { meetingArtifactId: artifact.id },
        defaults: {
          userId: artifact.userId || userId,
          summary: analysis.detailedSummary || "",
          actionItems: analysis.actionItems || [],
          followUps: [],
          sentiment: analysis.sentiment || null,
          status: "completed",
        },
      });
      summary = summaryRow;
    }

    let finalChannelId = channelId;
    let finalChannelName = channelName;

    // Create channel if requested
    if (!finalChannelId && createChannelName) {
      const created = await createConversation(integration.accessToken, {
        name: createChannelName,
        isPrivate: isPrivate === true || isPrivate === "true",
      });
      finalChannelId = created.channel.id;
      finalChannelName = created.channel.name;

      if (inviteAll) {
        const usersResp = await listUsers(integration.accessToken, { limit: 500 });
        const userIds = (usersResp.members || [])
          .filter((u) => !u.is_bot && !u.deleted && u.id)
          .map((u) => u.id);
        if (userIds.length) {
          await inviteUsers(integration.accessToken, {
            channel: finalChannelId,
            users: userIds.join(","),
          });
        }
      }
    }

    if (!finalChannelId) {
      return res.status(400).json({ error: "channelId is required" });
    }

    await backgroundQueue.add("publishing.dispatch", {
      meetingSummaryId: summary.id,
      slackOverride: {
        channelId: finalChannelId,
        channelName: finalChannelName,
      },
    });

    return res.json({
      success: true,
      channelId: finalChannelId,
      channelName: finalChannelName,
    });
  } catch (err) {
    console.error("[API] publish-slack error", err);
    return res.status(500).json({ error: err.message || "Failed to publish to Slack" });
  }
};


