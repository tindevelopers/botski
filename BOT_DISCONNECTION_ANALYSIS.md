# Bot Disconnection Analysis - Railway Deployment

## Issue Summary
Bots are disconnecting on Railway deployment when multiple bots join the same meeting. This works fine on localhost but fails in production.

## Root Cause Analysis

### Current Bot Detection Configuration

The system has **bot detection** enabled with these settings (see `recall/logic/bot-config.js`):

```javascript
bot_detection: {
  using_participant_names: {
    keywords: ["notetaker", "bot", "otter", "fireflies", "recall", ...],
    activate_after: 90,  // Start detecting after 90 seconds
    timeout: 10,         // Leave 10 seconds after detecting only bots
  },
  using_participant_events: {
    types: ["active_speaker", "screen_share"],
    activate_after: 90,
    timeout: 30,  // Leave 30 seconds after no human activity
  }
}
```

**What this means:**
- When multiple bots join a meeting, they detect each other by participant names
- After 90 seconds, if only bots remain (no human participants), each bot will leave after 10-30 seconds
- This is **intentional behavior** to avoid duplicate note-taking

### Why It Works on Localhost but Not Railway

Possible reasons:

1. **Different meeting scenarios**
   - Localhost: Testing with real human participants joining
   - Railway: Production meetings where only bots join (no humans yet)

2. **Timing differences**
   - Railway may have network latency causing bots to join at slightly different times
   - Bot detection activates after 90s, so if humans don't join quickly, bots leave

3. **Multiple users scheduling bots**
   - Different users from different companies scheduling bots for the same meeting
   - Shared bot detection should prevent this, but may not be working correctly

4. **Webhook processing delays**
   - Railway may have slower webhook processing
   - Status changes may arrive out of order

## Diagnostic Steps

### 1. Run the Diagnostic Script

```bash
cd recall
node diagnose-bot-disconnections.js
```

This will show:
- Events with multiple bots scheduled
- Bot detection configuration
- Duplicate scheduling jobs
- Recommendations

### 2. Check Railway Logs

Look for these specific log patterns:

**Bot disconnection due to bot detection:**
```
[RECALL-NOTES] Bot status change: ... sub_code=bot_detection
[RECALL-NOTES] Bot left due to bot_detection (only bots detected in meeting)
```

**Bot disconnection due to automatic leave:**
```
[RECALL-NOTES] Bot status change: ... sub_code=automatic_leave
[RECALL-NOTES] Bot left due to automatic_leave setting
```

**Multiple bots scheduled:**
```
[BOT-SCHEDULE] ⚠️  WARNING: Multiple bots detected for event ...
```

**Shared bot detection:**
```
[SHARED-BOT] Found existing bot from same company
[SHARED-BOT] Skipping - bot already scheduled by same company
```

### 3. Check Specific Meeting

For the meeting where bots disconnected, find:
1. Meeting URL
2. Number of bots that joined
3. Time each bot joined
4. Time each bot left
5. The `sub_code` in the status change event

## Solutions

### Option 1: Disable Bot Detection (Quick Fix)

If you want multiple bots to coexist in meetings:

**Edit `recall/logic/bot-config.js`:**

```javascript
// Comment out or remove bot_detection configuration
// botConfig.bot_detection = { ... };
```

**Pros:**
- Multiple bots can stay in the same meeting
- No disconnections

**Cons:**
- Duplicate note-taking if multiple services are recording
- Higher costs (multiple bots processing same meeting)

### Option 2: Increase Bot Detection Timeout

Give bots more time before leaving:

```javascript
bot_detection: {
  using_participant_names: {
    activate_after: 300,  // Wait 5 minutes instead of 90s
    timeout: 60,          // Wait 60s after detection instead of 10s
  },
  using_participant_events: {
    activate_after: 300,
    timeout: 120,         // Wait 2 minutes instead of 30s
  }
}
```

**Pros:**
- Gives humans more time to join before bots leave
- Still prevents long-term duplicate bots

**Cons:**
- Bots stay longer in meetings with no humans
- May still disconnect if meeting is bot-only

### Option 3: Fix Shared Bot Detection

Ensure only one bot is scheduled per meeting when multiple users from the same company join:

**Check if shared bot detection is working:**
1. Look for `[SHARED-BOT]` logs in Railway
2. Verify company domain extraction is correct
3. Check deduplication keys are being generated properly

**Debug shared bot logic:**
```bash
# Check if multiple bots are being scheduled for same meeting
cd recall
node check-duplicate-bots.js
```

### Option 4: Whitelist Your Own Bots

Remove "recall" from the bot detection keywords so your bots don't detect each other:

```javascript
bot_detection: {
  using_participant_names: {
    keywords: [
      "notetaker", "bot", "otter", "fireflies",
      // Remove "recall" from this list
    ],
    // ...
  }
}
```

**Pros:**
- Multiple Recall bots can coexist
- Still detects other bot services

**Cons:**
- May result in duplicate Recall bots if not using shared bot detection

## Instrumentation Already in Place

The code already has comprehensive logging:

1. **Bot status changes** - `recall/routes/webhooks/recall-notes.js:157-184`
2. **Multiple bot warnings** - `recall/worker/processors/calendar-event-update-bot-schedule.js:175`
3. **Shared bot detection** - `recall/utils/shared-bot-scheduling.js`
4. **Debug logs** - Sent to Railway console and debug log file

## Next Steps

1. **Share Railway logs** - Copy the logs containing `[RECALL-NOTES]`, `[BOT-SCHEDULE]`, and `[SHARED-BOT]` messages
2. **Run diagnostic script** - Execute `node diagnose-bot-disconnections.js` and share output
3. **Identify the pattern** - Determine which hypothesis matches your logs:
   - H-BOT-1: automatic_leave (timeout)
   - H-BOT-2: bot_detection (multiple bots)
   - H-BOT-3: Meeting platform kicked bot
   - H-BOT-4: Webhook timing issue
   - H-BOT-5: Duplicate scheduling

4. **Apply appropriate fix** based on the identified pattern

## Questions to Answer

1. Are the bots from the same company/user or different companies?
2. How many bots are joining the same meeting?
3. Are there human participants in the meeting when bots disconnect?
4. How long after joining do the bots disconnect? (10s, 30s, 90s+?)
5. What does the Railway log show for `sub_code` in the bot status change?

Please share the Railway logs or run the diagnostic script so we can identify the exact cause.
