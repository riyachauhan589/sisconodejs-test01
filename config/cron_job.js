"use strict";
const cron = require("node-cron");
const { Op } = require("sequelize");
const { BookingSlot, Booking, User  ,AvailabilitySlot } = require("../src/models");
const sendEmail = require("../config/mailer");
const {
  lessonReminder24hTemplate,
  adminLessonReminder24hTemplate,
} = require("../src/utils/mailTemplates");
const moment = require("moment-timezone");

const getISTNow = () => {
  const istString = new Date().toLocaleString("en-US", {
    timeZone: "Asia/Kolkata",
  });
  return new Date(istString);
};

const check24HourLessonReminders = async () => {
  try {
    const now = getISTNow();
    console.log("⏰ [CRON RUNNING] IST Time:", now.toISOString());

    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDate = tomorrow.toISOString().split("T")[0];

    console.log("📅 Checking slots for date:", tomorrowDate);

    const slots = await BookingSlot.findAll({
      where: {
        booking_date: tomorrowDate,
        reminder_24h_sent: false,
        status: {
          [Op.ne]: "cancelled",
        },
      },
      include: [
        {
          model: Booking,
          as: "booking",
          include: [
            {
              model: User,
              as: "user",
            },
          ],
        },
      ],
    });

    console.log(`🔍 Slots found: ${slots.length}`);

    for (const slot of slots) {
      console.log(`➡️ Checking Slot ID: ${slot.id}`);

      const slotDateTime = new Date(
        `${slot.booking_date}T${slot.start_time}`
      );

      const diffHours =
        (slotDateTime - now) / (1000 * 60 * 60);

      console.log(
        `🕒 Slot Time: ${slotDateTime.toISOString()} | Diff Hours: ${diffHours}`
      );

      if (diffHours > 23.9 && diffHours < 24.1) {

        console.log(`📨 Sending reminder for Slot ID: ${slot.id}`);

        await sendEmail(
          slot.booking.user.email,
          "Reminder: Your Lesson is Tomorrow 🚗",
          lessonReminder24hTemplate(slot)
        );

        await sendEmail(
          process.env.MAIL_TO_ADDRESS,
          "Admin Alert: Lesson Scheduled for Tomorrow",
          adminLessonReminder24hTemplate(slot)
        );

        await slot.update({ reminder_24h_sent: true });

        console.log(
          `✅ 24H Reminder sent successfully for Slot ID: ${slot.id}`
        );
      } else {
        console.log(
          `⏭️ Skipped Slot ID: ${slot.id} (Not exactly 24h window)`
        );
      }
    }

    if (slots.length === 0) {
      console.log("ℹ️ No eligible slots found.");
    }

  } catch (err) {
    console.error("[LESSON_REMINDER_CRON_ERROR]", err);
  }
};

const startLessonReminderCron = () => {
  cron.schedule(
    "*/10 * * * *",
    () => {
      console.log("🔄 Cron Triggered...");
      check24HourLessonReminders();
    },
    {
      timezone: "Asia/Kolkata",
    }
  );

  console.log("✅ 24H Lesson Reminder Cron Started (Runs every 10 mins)");
};

const autoBlockPastSlots = async () => {
  try {
    const nowIST = moment().tz("Asia/Kolkata");
    const todayDate = nowIST.format("YYYY-MM-DD");

    const graceTime = nowIST.clone().subtract(30, "minutes");
    const graceTimeFormatted = graceTime.format("HH:mm:ss");

    console.log("⏰ [AUTO BLOCK CRON] Running at:", nowIST.format());
    console.log("⌛ Blocking slots before:", graceTimeFormatted);

    const result = await AvailabilitySlot.update(
      { status: "blocked" },
      {
        where: {
          date: todayDate,
          status: "available",
          start_time: {
            [Op.lte]: graceTimeFormatted,
          },
        },
      }
    );

    console.log(
      `🔒 Blocked Slots Count: ${result[0]} | Date: ${todayDate}`
    );
  } catch (error) {
    console.error("[AUTO_BLOCK_CRON_ERROR]", error);
  }
};

const startAutoBlockCron = () => {
  cron.schedule(
    "*/10 * * * *",
    async () => {
      await autoBlockPastSlots();
    },
    {
      timezone: "Asia/Kolkata",
    }
  );

  console.log("✅ Auto Block Past Slots Cron Started (Every 10 mins)");
};

module.exports = { startLessonReminderCron  ,startAutoBlockCron };