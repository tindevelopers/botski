import { generateNotice } from "../utils.js";
import db from "../../db.js";
import { queueBotScheduleJob } from "../../utils/queue-bot-schedule.js";

export default async (req, res) => {
  if (!req.authenticated) {
    return res.redirect("/");
  }
  const event = await db.CalendarEvent.findByPk(req.params.id);
  if (!event) {
    return res.render("404.ejs", { notice: req.notice });
  }
  const calendar = await event.getCalendar();
  if (!calendar || calendar.userId !== req.authentication.user.id) {
    return res.render("404.ejs", { notice: req.notice });
  }

  console.log(`INFO: Send bot again requested for event(ID: ${event.id})`);

  await queueBotScheduleJob(event.recallId, calendar.id, {
    forceReschedule: true,
    isRetry: true,
  });

  res.cookie(
    "notice",
    JSON.stringify(
      generateNotice(
        "success",
        `Bot re-requested for "${event.title || "meeting"}". It will join shortly.`
      )
    )
  );

  return res.redirect("/meetings");
};
