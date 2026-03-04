import db from "../db.js";

/**
 * Normalize meeting data for all publishers.
 * Includes transcript, action items, follow-ups, sentiment, and metadata.
 */
export async function normalizeMeetingData(meetingSummary, options = {}) {
  const { includeTranscript = true } = options;

  if (!meetingSummary) {
    throw new Error("normalizeMeetingData requires meetingSummary");
  }

  // Load related data
  const artifact = await db.MeetingArtifact.findByPk(
    meetingSummary.meetingArtifactId,
    {
      include: [
        { model: db.CalendarEvent },
        {
          model: db.MeetingTranscriptChunk,
          order: [["sequence", "ASC"]],
        },
      ],
    }
  );

  const calendarEvent = artifact?.CalendarEvent;

  // Prefer Super Agent analysis when available (same data as Premium meeting detail)
  let actionItems = meetingSummary.actionItems || [];
  let summary = meetingSummary.summary;
  const analysis = await db.MeetingSuperAgentAnalysis.findOne({
    where: { meetingArtifactId: meetingSummary.meetingArtifactId, status: "completed" },
    order: [["updatedAt", "DESC"]],
  });
  if (analysis?.actionItems?.length) {
    actionItems = analysis.actionItems;
  }
  if (analysis?.detailedSummary) {
    summary = analysis.detailedSummary;
  }

  // Ensure meetingUrl is a string (avoid "[object Object]" in task descriptions)
  let meetingUrlRaw = calendarEvent?.meetingUrl || artifact?.rawPayload?.data?.meeting_url || null;
  const meetingUrl =
    meetingUrlRaw == null
      ? null
      : typeof meetingUrlRaw === "string"
        ? meetingUrlRaw
        : (meetingUrlRaw?.url || meetingUrlRaw?.href || meetingUrlRaw?.link || null);

  // Calculate duration
  const startTime =
    calendarEvent?.startTime || artifact?.rawPayload?.data?.start_time;
  const endTime = calendarEvent?.endTime || artifact?.rawPayload?.data?.end_time;
  const duration =
    startTime && endTime
      ? Math.round((new Date(endTime) - new Date(startTime)) / 1000 / 60) // minutes
      : null;

  // Extract attendees/participants
  const attendees =
    calendarEvent?.recallData?.raw?.attendees ||
    artifact?.rawPayload?.data?.participants ||
    artifact?.rawPayload?.data?.attendees ||
    [];

  // Format attendees
  const formattedAttendees = attendees.map((att) => ({
    name:
      att.name ||
      att.displayName ||
      att.emailAddress?.name ||
      att.email ||
      "Unknown",
    email: att.email || att.emailAddress?.address || null,
    status: att.responseStatus || att.status?.response || "unknown",
  }));

  // Build full transcript
  let transcript = [];
  if (includeTranscript && artifact?.MeetingTranscriptChunks) {
    transcript = artifact.MeetingTranscriptChunks.map((chunk) => ({
      speaker: chunk.speaker || "Unknown",
      text: chunk.text,
      startTimeMs: chunk.startTimeMs,
      endTimeMs: chunk.endTimeMs,
      sequence: chunk.sequence,
    }));
  }

  // #region agent log
  const sentiment = meetingSummary.sentiment;
  const debugPayload = {
    typeOfSentiment: typeof sentiment,
    isNull: sentiment === null,
    hypothesisId: "H1",
  };
  console.log("[DEBUG da5c0c] data-transformer sentiment", JSON.stringify(debugPayload));
  fetch("http://127.0.0.1:7638/ingest/79656976-3d7d-40e3-8c2f-1fcd56f4a972", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "da5c0c" },
    body: JSON.stringify({
      sessionId: "da5c0c",
      location: "data-transformer.js:before-sentiment",
      message: "sentiment before building normalized payload",
      data: debugPayload,
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion

  return {
    // Core content
    title:
      calendarEvent?.title ||
      (summary || meetingSummary.summary)?.slice(0, 100) ||
      "Meeting Notes",
    summary: summary,

    // 1. Entire transcript
    transcript: transcript,
    transcriptText: transcript.map((t) => `${t.speaker}: ${t.text}`).join("\n"),

    // 2. Actions assigned (prefer Super Agent when available)
    actionItems,

    // 3. Follow ups
    followUps: meetingSummary.followUps || [],

    // 4. Sentiment
    sentiment: meetingSummary.sentiment || null,
    sentimentLabel:
      typeof meetingSummary.sentiment === "object"
        ? meetingSummary.sentiment.label ||
          meetingSummary.sentiment.sentiment ||
          null
        : meetingSummary.sentiment || null,
    sentimentScore:
      typeof meetingSummary.sentiment === "object"
        ? meetingSummary.sentiment.score
        : null,

    // Meeting metadata and artifacts
    metadata: {
      meetingId: meetingSummary.meetingArtifactId,
      readableId: artifact?.readableId,

      // Time information
      startTime: startTime,
      endTime: endTime,
      duration: duration, // minutes
      durationFormatted: duration
        ? `${Math.floor(duration / 60)}h ${duration % 60}m`
        : null,

      // Attendees
      attendees: formattedAttendees,
      attendeeCount: formattedAttendees.length,
      attendeeNames: formattedAttendees.map((a) => a.name).join(", "),

      // Meeting platform and URL (always string to avoid [object Object])
      platform: calendarEvent?.platform || null,
      meetingUrl,

      // Recording artifacts
      videoUrl:
        artifact?.rawPayload?.data?.video_url ||
        artifact?.rawPayload?.data?.recording_url ||
        artifact?.rawPayload?.data?.media_shortcuts?.video?.data?.download_url ||
        null,
      audioUrl:
        artifact?.rawPayload?.data?.audio_url ||
        artifact?.rawPayload?.data?.media_shortcuts?.audio?.data?.download_url ||
        null,

      // Additional insights
      topics: meetingSummary.topics || [],
      decisions: meetingSummary.decisions || [],
      keyInsights: meetingSummary.keyInsights || [],
      outcome: meetingSummary.outcome || null,

      // Timestamps
      createdAt: meetingSummary.createdAt,
      meetingDate: startTime ? new Date(startTime).toLocaleDateString() : null,
      meetingTime: startTime ? new Date(startTime).toLocaleTimeString() : null,
    },
  };
}



