#!/usr/bin/env node
/**
 * Diagnose bot disconnection issues on Railway
 * 
 * This script analyzes recent bot status changes to identify why bots are disconnecting
 * when multiple bots join meetings.
 */

import db from "./db.js";
import { Op } from "sequelize";

async function diagnoseBotDisconnections() {
  console.log("🔍 Diagnosing Bot Disconnection Issues\n");
  console.log("=" .repeat(80));

  try {
    // Find recent calendar events with multiple bots scheduled
    const recentDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // Last 24 hours
    
    console.log("\n📊 Step 1: Finding events with multiple bots (last 24 hours)...\n");
    
    const events = await db.CalendarEvent.findAll({
      where: {
        startTime: { [Op.gte]: recentDate },
        recallId: { [Op.ne]: null },
      },
      include: [
        {
          model: db.Calendar,
          include: [{ model: db.User }],
        },
      ],
      order: [["startTime", "DESC"]],
      limit: 50,
    });

    console.log(`Found ${events.length} recent events with Recall bots\n`);

    // Group events by meeting URL to find duplicates
    const eventsByMeetingUrl = {};
    for (const event of events) {
      if (!event.meetingUrl) continue;
      const normalizedUrl = event.meetingUrl.toLowerCase().trim();
      if (!eventsByMeetingUrl[normalizedUrl]) {
        eventsByMeetingUrl[normalizedUrl] = [];
      }
      eventsByMeetingUrl[normalizedUrl].push(event);
    }

    // Find meetings with multiple bots
    const duplicateMeetings = Object.entries(eventsByMeetingUrl).filter(
      ([url, events]) => events.length > 1
    );

    if (duplicateMeetings.length === 0) {
      console.log("✅ No duplicate bots found in recent meetings\n");
    } else {
      console.log(`⚠️  Found ${duplicateMeetings.length} meetings with multiple bots:\n`);
      
      for (const [meetingUrl, events] of duplicateMeetings) {
        console.log(`\n🔗 Meeting: ${meetingUrl.substring(0, 60)}...`);
        console.log(`   Bot count: ${events.length}`);
        
        for (const event of events) {
          const user = event.Calendar?.User;
          const userEmail = user?.email || "unknown";
          const company = userEmail.split("@")[1] || "unknown";
          
          console.log(`   - Event ${event.id}:`);
          console.log(`     User: ${userEmail}`);
          console.log(`     Company: ${company}`);
          console.log(`     Recall Event ID: ${event.recallId}`);
          console.log(`     Start: ${event.startTime.toISOString()}`);
          console.log(`     Status: ${event.status}`);
        }
      }
    }

    // Check bot detection settings
    console.log("\n" + "=".repeat(80));
    console.log("\n📊 Step 2: Checking bot detection configuration...\n");
    
    const calendarsWithBots = await db.Calendar.findAll({
      where: {
        recallApiKey: { [Op.ne]: null },
      },
      include: [{ model: db.User }],
    });

    console.log(`Found ${calendarsWithBots.length} calendars with bot scheduling enabled\n`);
    
    for (const calendar of calendarsWithBots.slice(0, 10)) {
      const user = calendar.User;
      console.log(`📅 Calendar ${calendar.id}:`);
      console.log(`   User: ${user?.email || "unknown"}`);
      console.log(`   Auto-leave if alone: ${calendar.autoLeaveIfAlone ? "YES" : "NO"}`);
      console.log(`   Auto-leave timeout: ${calendar.autoLeaveAloneTimeoutSeconds || 60}s`);
      console.log(`   Platform: ${calendar.platform}`);
      console.log();
    }

    // Check for recent bot status changes in the database
    console.log("=".repeat(80));
    console.log("\n📊 Step 3: Analyzing recent bot status changes...\n");
    
    // Note: We don't have a BotStatusChange table, so we'll check the debug log
    console.log("⚠️  Bot status changes are logged to console/Railway logs");
    console.log("    Look for these patterns in Railway logs:\n");
    console.log("    - [RECALL-NOTES] Bot status change: ... sub_code=bot_detection");
    console.log("    - [RECALL-NOTES] Bot status change: ... sub_code=automatic_leave");
    console.log("    - [RECALL-NOTES] ⚠️  Bot disconnected/left");
    console.log("    - [BOT-SCHEDULE] ⚠️  WARNING: Multiple bots detected");
    console.log("    - [SHARED-BOT] Skipping - bot already scheduled");

    // Check Redis queue for pending bot scheduling jobs
    console.log("\n" + "=".repeat(80));
    console.log("\n📊 Step 4: Checking for duplicate bot scheduling jobs...\n");
    
    const { default: Queue } = await import("bull");
    const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";
    
    const botScheduleQueue = new Queue("calendar.event.update.bot_schedule", REDIS_URL);
    const waitingJobs = await botScheduleQueue.getWaiting();
    const activeJobs = await botScheduleQueue.getActive();
    
    console.log(`Waiting jobs: ${waitingJobs.length}`);
    console.log(`Active jobs: ${activeJobs.length}\n`);
    
    // Group by event ID to find duplicates
    const jobsByEventId = {};
    for (const job of [...waitingJobs, ...activeJobs]) {
      const eventId = job.data?.eventId;
      if (!eventId) continue;
      if (!jobsByEventId[eventId]) {
        jobsByEventId[eventId] = [];
      }
      jobsByEventId[eventId].push(job);
    }
    
    const duplicateJobs = Object.entries(jobsByEventId).filter(
      ([eventId, jobs]) => jobs.length > 1
    );
    
    if (duplicateJobs.length === 0) {
      console.log("✅ No duplicate bot scheduling jobs in queue\n");
    } else {
      console.log(`⚠️  Found ${duplicateJobs.length} events with duplicate jobs:\n`);
      for (const [eventId, jobs] of duplicateJobs) {
        console.log(`   Event ${eventId}: ${jobs.length} jobs`);
      }
    }

    await botScheduleQueue.close();

    // Summary and recommendations
    console.log("\n" + "=".repeat(80));
    console.log("\n📋 Summary & Recommendations:\n");
    
    if (duplicateMeetings.length > 0) {
      console.log("⚠️  ISSUE DETECTED: Multiple bots are being scheduled for the same meeting");
      console.log("\nPossible causes:");
      console.log("1. Multiple users from different companies joining the same meeting");
      console.log("2. Shared bot detection not working correctly");
      console.log("3. Deduplication key collision or race condition");
      console.log("\nRecommended fixes:");
      console.log("1. Check Railway logs for [SHARED-BOT] messages");
      console.log("2. Verify bot_detection settings are working (bots should leave when detecting each other)");
      console.log("3. Consider disabling bot_detection if you want multiple bots to coexist");
      console.log("4. Check if company domain extraction is working correctly");
    } else {
      console.log("✅ No obvious duplicate bot scheduling detected");
      console.log("\nIf bots are still disconnecting, check:");
      console.log("1. Railway logs for bot_detection or automatic_leave events");
      console.log("2. Meeting platform (Zoom/Teams/Meet) kicking bots");
      console.log("3. Network issues causing webhook delays");
    }

    console.log("\n" + "=".repeat(80));
    console.log("\n💡 Next steps:");
    console.log("1. Share Railway logs containing [RECALL-NOTES] and [BOT-SCHEDULE] messages");
    console.log("2. Look for the specific meeting where bots disconnected");
    console.log("3. Check the sub_code in bot status change events");
    console.log("\n");

  } catch (error) {
    console.error("❌ Error:", error.message);
    console.error(error.stack);
  } finally {
    await db.sequelize.close();
  }
}

diagnoseBotDisconnections().catch(console.error);
