# Design: Ingesting Meetings You Weren't Invited To

## Problem

The current Teams recording flow requires a **calendar event** in the database. If you weren't invited to a meeting, it won't be on your calendar, so you cannot trigger ingestion. This design adds support for:

1. **Teams meeting URL** – Paste a Teams link; try to fetch recording via Microsoft Graph
2. **Shared recording URL** – Paste a direct link to a recording (Stream, SharePoint, OneDrive)

---

## Flow Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        INGEST EXTERNAL MEETING                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  User Input                                                                  │
│  ├── Path A: Teams meeting URL (teams.microsoft.com/l/meetup-join/...)      │
│  └── Path B: Recording URL (stream, sharepoint, onedrive, or public URL)     │
│                                                                             │
│  Path A: Teams URL                    Path B: Recording URL                 │
│  ├── Try Graph API with user's        ├── Create artifact with              │
│  │   Microsoft calendars                sourceRecordingUrl                   │
│  ├── If access: fetch transcript      ├── Queue Super Agent (AssemblyAI     │
│  │   + recording metadata               transcribes from URL)               │
│  └── Create artifact, enrich          └── Or: queue enrichment if transcript │
│                                          available from URL metadata         │
│                                                                             │
│  Output: MeetingArtifact → Enrichment → Super Agent (user-triggered)        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Path A: Ingest by Teams Meeting URL

### When It Works

- User has at least one connected Microsoft Outlook calendar with Teams recording permissions
- User's token has access to the meeting (e.g. same org, was forwarded the link, admin access)
- Meeting has ended and recording is available

### When It Fails

- User wasn't a participant and Microsoft denies access
- No Microsoft calendar connected
- Recording not yet processed by Microsoft (wait ~5–10 min after meeting ends)

### Flow

1. **User pastes Teams URL** (e.g. `https://teams.microsoft.com/l/meetup-join/19%3ameeting_xxx%40thread.v2/0?context=...`)

2. **Validate URL** – Must contain `teams.microsoft.com` and be parseable

3. **Build minimal meeting context** – Extract from URL:
   - `meetingUrl` (normalized)
   - `meetingId` (thread ID or path segment)
   - `joinWebUrl` (same as meetingUrl for meetup-join)

4. **Try Graph API with each of user's Microsoft calendars**:
   - For each calendar: `findMeetingByJoinUrl(userId, joinWebUrl)` → get `actualMeetingId`
   - If found: `listMeetingTranscripts`, `listMeetingRecordings`
   - First calendar that succeeds wins

5. **Create artifact** (same shape as `teams-recording-ingest`):
   - `calendarEventId: null`
   - `recallEventId: null`
   - `eventType: "teams_recording"` or `"teams_url_ingest"`
   - `sourceRecordingUrl`, transcript chunks, metadata
   - `userId` = current user (creator)
   - `ownerUserId` = organizer if resolvable, else current user

6. **Queue enrichment** (if transcript) or **queue Super Agent** (if only video URL)

### API

```
POST /api/ingest-external-meeting
Content-Type: application/json
Authorization: Bearer <token>

{
  "meetingUrl": "https://teams.microsoft.com/l/meetup-join/..."
}

Response:
{
  "success": true,
  "artifactId": "uuid",
  "meetingId": "readable-id",
  "hasTranscript": true,
  "hasRecording": true,
  "message": "Ingested Teams meeting. Summary will be generated shortly."
}

Error (403 / no access):
{
  "success": false,
  "error": "Could not access recording. You may need to be a participant or have the organizer connect their calendar."
}
```

### Implementation Notes

- Reuse `extractTeamsMeetingInfo` logic but accept raw URL + userId from calendar (no full calendar event)
- Add `fetchTeamsTranscriptByUrl(meetingUrl, calendar)` and `fetchTeamsRecordingByUrl(meetingUrl, calendar)` that build meeting info from URL
- Loop over user's Microsoft calendars until one succeeds or all fail

---

## Path B: Ingest by Shared Recording URL

### When It Works

- URL is publicly accessible (no auth), or
- AssemblyAI can fetch it (some CDN/signed URLs work), or
- We implement a proxy that uses user's Microsoft token to download and re-host

### When It Fails

- URL requires authentication (Stream/SharePoint often do)
- URL has expired
- CORS or other fetch restrictions

### Flow

1. **User pastes recording URL** (and optionally title)

2. **Detect URL type**:
   - `*.stream.microsoft.com` – Microsoft Stream
   - `*.sharepoint.com` – SharePoint
   - `*.onedrive.live.com`, `*.1drv.ms` – OneDrive
   - `*.recall.ai` – Recall recording
   - Generic `https://` – try as public URL

3. **Create artifact**:
   - `sourceRecordingUrl` = user's URL
   - `calendarEventId: null`, `recallEventId: null`
   - `eventType: "recording_url_ingest"`
   - `title` = user-provided or "Imported recording"
   - `userId` = current user

4. **Queue Super Agent directly** (bypass enrichment):
   - Super Agent uses AssemblyAI `audio_url` – submit user's URL
   - AssemblyAI transcribes; we get transcript via webhook
   - Super Agent completes with chapters, summary, etc.

5. **Optional: Queue enrichment** after Super Agent if we want Notepad-style summary too (or rely on Super Agent output only)

### API

```
POST /api/ingest-external-meeting
Content-Type: application/json
Authorization: Bearer <token>

{
  "recordingUrl": "https://...",
  "title": "Optional meeting title"
}

Response:
{
  "success": true,
  "artifactId": "uuid",
  "meetingId": "readable-id",
  "message": "Recording submitted for transcription. Super Agent analysis will begin shortly."
}
```

### Implementation Notes

- AssemblyAI accepts `audio_url` – if the URL is public, it may work
- Microsoft Stream/SharePoint URLs usually require auth – AssemblyAI cannot fetch them directly
- **Fallback**: Add optional file upload – user uploads the recording file; we store temporarily and pass URL to AssemblyAI (or use AssemblyAI upload API)

---

## Unified API Design

Single endpoint supports both inputs:

```
POST /api/ingest-external-meeting

Body (one of):
{ "meetingUrl": "https://teams.microsoft.com/..." }
{ "recordingUrl": "https://...", "title": "Optional" }

Logic:
- If meetingUrl → Path A (Teams Graph)
- If recordingUrl → Path B (direct recording)
- If both → prefer meetingUrl (richer metadata)
```

---

## UI Design

### Entry Point: "Import Meeting" Button

- Location: Meetings list page (top bar or tab)
- Opens modal with two tabs or options:
  1. **Teams meeting link** – Paste URL, "Fetch recording"
  2. **Recording link** – Paste URL, optional title, "Import & analyze"

### After Import

- Redirect to meeting detail page (`/meetings/:meetingId`)
- Show status: "Transcription in progress" or "Super Agent analyzing..."
- When done: full meeting view with transcript, summary, Super Agent results

---

## Data Model

### MeetingArtifact (existing, no schema change)

- `calendarEventId` – null for external ingests
- `recallEventId` – null for external ingests
- `eventType` – add `"teams_url_ingest"` | `"recording_url_ingest"`
- `sourceRecordingUrl` – set for both paths
- `userId` – current user (creator)
- `ownerUserId` – organizer if known, else current user

### Access Control

- Artifact is owned by `userId` (creator)
- Use existing `findAccessibleArtifact` – user can access their own artifacts

---

## Worker Jobs

### New: `meeting.ingest_external`

- Input: `{ meetingUrl?, recordingUrl?, title?, userId }`
- Path A: call Graph, create artifact, queue enrichment
- Path B: create artifact, queue Super Agent
- Idempotency: optional dedup by normalized URL to avoid duplicates

### Existing

- `meeting.enrich` – unchanged
- `meeting.super_agent.start` – unchanged, accepts artifact with `sourceRecordingUrl`

---

## Limitations & Future Work

1. **Microsoft URL auth** – Stream/SharePoint links often need auth. Future: proxy download using user's token, then pass to AssemblyAI.
2. **File upload** – Add "Upload recording" to support local files when URL is not fetchable.
3. **Deduplication** – If same URL imported twice, optionally attach to existing artifact instead of creating new one.
4. **Other platforms** – Zoom, Google Meet recording links could follow Path B pattern.

---

## Implementation Order

1. **Path A (Teams URL)** – Higher value, reuses Graph + existing ingest logic
2. **API + worker** – `POST /api/ingest-external-meeting`, `meeting.ingest_external` job
3. **Path B (recording URL)** – Simpler, but URL auth limits usefulness
4. **UI** – "Import Meeting" modal
5. **File upload** – If Path B proves limited by URL auth
