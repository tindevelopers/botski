# Bot leave behavior when only notetakers remain

## What we send to Recall

The app sends **bot_detection** and (optionally) **automatic_leave** in the bot config when scheduling. Recall's bot uses this to decide when to leave the meeting.

- **Bot detection**  
  - Detects other notetakers/bots by participant display names only (e.g. "Fireflies.ai Notetaker", "Otter", "Notetaker").  
  - When it concludes that only bots remain, our bot disconnects after a short timeout to avoid duplicate notes.

- **Automatic leave** (if "Auto-leave when alone" is enabled in calendar settings)  
  - Uses `waiting_room_timeout`, `noone_joined_timeout`, and `everyone_left_timeout` so the bot leaves when alone or when everyone has left (by Recall's participant count).

## Why the bot sometimes stayed (e.g. with Fireflies)

### Issue 1: activate_after was too long (fixed)
Previously, bot_detection **only started after 5 minutes** (`activate_after: 300`). Short meetings where everyone left before 5 minutes never triggered detection.

### Issue 2: using_participant_events blocked leave (fixed)
We used both name-based and **behavior-based** detection (`using_participant_events`). That heuristic marks a participant as "real" if they emit `active_speaker` or `screenshare_start`. Fireflies and other notetakers can trigger these events (or the platform reports them), so our bot never concluded "only bots remain" and stayed in the call.

## Current configuration

- **Name-based detection only** (`using_participant_names`): `activate_after` 90s, `timeout` 10s.
- **`using_participant_events` removed** – Fireflies/other notetakers can emit activity that blocks leave. Name-based is more reliable (per Recall docs).

## Where it's configured

- **recall/logic/bot-config.js**  
  - Bot detection is sent under **`automatic_leave.bot_detection`** (Recall API ignores top-level `bot_detection`).
  - Participant names use the **`matches`** array (API expects `matches`, not `keywords`).
  - `using_participant_names`: `activate_after` 90s, `timeout` 10s.

## Instrumentation for debugging

When the bot leaves or its status changes, the webhook logs:

- **recall/routes/webhooks/recall-notes.js**  
  - Full `status` object for every `bot.status_change` (includes any participant info Recall sends).
  - Full payload for leave events (`left_call`, `call_ended`, `bot_detection`, `automatic_leave`, `kicked`).

Check Railway logs (or server stdout) for `[RECALL-NOTES]` to diagnose leave behavior. Search for `LEAVE EVENT` or `Bot left due to bot_detection` to confirm the bot left as expected.

## Note on "Fireflies stayed"

If the **Fireflies** notetaker is still in the meeting after everyone left, that's expected: we only control our own Recall bot. We can't make Fireflies leave. Our bot should now leave when it detects only other notetakers (by name) remain.
