"use strict";
const { Op } = require("sequelize");
const moment = require("moment");
const { AvailabilitySlot, Package , sequelize  ,Setting ,Booking ,User } = require("../../models");

// const createAvailability = async (req, res) => {
//   try {
//     const { schedule = [], slot_duration } = req.body;
//     const adminId = req.admin.id;

//     if (!Array.isArray(schedule) || !schedule.length || !slot_duration) {
//       return res.status(400).json({
//         success: false,
//         message: "Schedule and slot_duration are required",
//       });
//     }

//     const dayMap = {
//       sunday: 0,
//       monday: 1,
//       tuesday: 2,
//       wednesday: 3,
//       thursday: 4,
//       friday: 5,
//       saturday: 6,
//     };

//     const bufferSetting = await Setting.findOne({
//       where: { key: "slot_buffer_minutes", status: "active" },
//     });

//     const bufferMinutes = parseInt(bufferSetting?.value || 30);
//     const duration = parseInt(slot_duration);

//     const records = [];
//     const today = moment().startOf("day");
//     const selectedDays = schedule.map((s) =>
//       dayMap[s.day.toLowerCase()]
//     );

//     const maxWeeksAhead = 1;
//     const endDate = today.clone().add(maxWeeksAhead, "weeks");
//     let currentDate = today.clone();

//     while (currentDate.isSameOrBefore(endDate)) {
//       const weekday = currentDate.day();

//       if (selectedDays.includes(weekday)) {
//         const matchedSchedule = schedule.find(
//           (s) => dayMap[s.day.toLowerCase()] === weekday
//         );

//         if (matchedSchedule) {
//           let currentTime = moment(matchedSchedule.start_time, "HH:mm");
//           const endTimeMoment = moment(
//             matchedSchedule.end_time,
//             "HH:mm"
//           );

//           while (
//             currentTime
//               .clone()
//               .add(duration, "minutes")
//               .isSameOrBefore(endTimeMoment)
//           ) {
//             records.push({
//               date: currentDate.format("YYYY-MM-DD"),
//               start_time: currentTime.format("HH:mm:ss"),
//               end_time: currentTime
//                 .clone()
//                 .add(duration, "minutes")
//                 .format("HH:mm:ss"),
//               created_by: adminId,
//               status: "available",
//             });

//             currentTime.add(duration + bufferMinutes, "minutes");
//           }
//         }
//       }

//       currentDate.add(1, "day");
//     }

//     if (!records.length) {
//       return res.status(400).json({
//         success: false,
//         message: "No slots generated",
//       });
//     }

//     const existingSlots = await AvailabilitySlot.findAll({
//       where: {
//         [Op.or]: records.map((r) => ({
//           date: r.date,
//           start_time: r.start_time,
//           end_time: r.end_time,
//         })),
//       },
//       attributes: ["date", "start_time", "end_time"],
//     });

//     const existingSet = new Set(
//       existingSlots.map(
//         (s) => `${s.date}_${s.start_time}_${s.end_time}`
//       )
//     );

//     const filteredRecords = records.filter(
//       (r) =>
//         !existingSet.has(
//           `${r.date}_${r.start_time}_${r.end_time}`
//         )
//     );

//     if (!filteredRecords.length) {
//       return res.status(400).json({
//         success: false,
//         message: "All slots already exist",
//       });
//     }

//     await AvailabilitySlot.bulkCreate(filteredRecords);

//     return res.status(201).json({
//       success: true,
//       message: "Availability generated successfully",
//       total_slots_created: filteredRecords.length,
//       buffer_minutes_used: bufferMinutes,
//     });
//   } catch (error) {
//     console.error("Create Availability Error:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Internal server error",
//       error: error.message,
//     });
//   }
// };

const createAvailability = async (req, res) => {
  try {
    const { schedule = [] } = req.body;
    const adminId = req.admin.id;

    if (!Array.isArray(schedule) || !schedule.length) {
      return res.status(400).json({
        success: false,
        message: "Schedule is required",
      });
    }

    const dayMap = {
      sunday: 0,
      monday: 1,
      tuesday: 2,
      wednesday: 3,
      thursday: 4,
      friday: 5,
      saturday: 6,
    };

    const bufferSetting = await Setting.findOne({
      where: { key: "slot_buffer_minutes", status: "active" },
    });

    const bufferMinutes = parseInt(bufferSetting?.value || 30);
    const duration = 60;

    const today = moment().startOf("day");
    const endDate = today.clone().add(1, "weeks");

    const selectedDays = schedule.map((s) =>
      dayMap[s.day.toLowerCase()]
    );

    const records = [];
    let currentDate = today.clone();

    while (currentDate.isSameOrBefore(endDate)) {
      const weekday = currentDate.day();

      if (selectedDays.includes(weekday)) {
        const matchedSchedule = schedule.find(
          (s) => dayMap[s.day.toLowerCase()] === weekday
        );

        if (matchedSchedule) {
          let currentTime = moment(
            matchedSchedule.start_time,
            "HH:mm"
          );
          const endTimeMoment = moment(
            matchedSchedule.end_time,
            "HH:mm"
          );

          while (
            currentTime
              .clone()
              .add(duration, "minutes")
              .isSameOrBefore(endTimeMoment)
          ) {
            const startTime = currentTime.format("HH:mm:ss");
            const endTime = currentTime
              .clone()
              .add(duration, "minutes")
              .format("HH:mm:ss");

            records.push({
              date: currentDate.format("YYYY-MM-DD"),
              start_time: startTime,
              end_time: endTime,
              created_by: adminId,
              status: "available",
              package_id: null,
            });

            currentTime.add(duration + bufferMinutes, "minutes");
          }
        }
      }

      currentDate.add(1, "day");
    }

    if (!records.length) {
      return res.status(400).json({
        success: false,
        message: "No slots generated",
      });
    }

    const existingSlots = await AvailabilitySlot.findAll({
      where: {
        [Op.or]: records.map((r) => ({
          date: r.date,
          start_time: r.start_time,
          end_time: r.end_time,
          package_id: null,
        })),
      },
      attributes: ["date", "start_time", "end_time", "package_id"],
    });

    const existingSet = new Set(
      existingSlots.map(
        (s) =>
          `${s.date}_${s.start_time}_${s.end_time}_${s.package_id}`
      )
    );

    const filteredRecords = records.filter(
      (r) =>
        !existingSet.has(
          `${r.date}_${r.start_time}_${r.end_time}_${r.package_id}`
        )
    );

    if (!filteredRecords.length) {
      return res.status(400).json({
        success: false,
        message: "All slots already exist",
      });
    }

    await AvailabilitySlot.bulkCreate(filteredRecords, {
      ignoreDuplicates: true,
    });

    return res.status(201).json({
      success: true,
      message: "Availability generated successfully",
      total_slots_created: filteredRecords.length,
      buffer_minutes_used: bufferMinutes,
    });
  } catch (error) {
    console.error("Create Availability Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

const getAvailability = async (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    const where = {};

    if (start_date && end_date) {
      where.date = { [Op.between]: [start_date, end_date] };
    } else if (start_date) {
      where.date = start_date;
    }

    const slots = await AvailabilitySlot.findAll({
      where,
      attributes: [
        "id",
        "date",
        "start_time",
        "end_time",
        "status",
        "booking_id",
      ],
      order: [
        ["date", "ASC"],
        ["start_time", "ASC"],
      ],
      raw: true,
    });

    const bookingIds = slots
      .filter(s => s.booking_id)
      .map(s => s.booking_id);

    let usersMap = {};

    if (bookingIds.length) {
      const bookings = await Booking.findAll({
        where: { id: bookingIds },
        attributes: ["id", "user_id"],
        raw: true,
      });

      const userIds = bookings.map(b => b.user_id);

      const users = await User.findAll({
        where: { id: userIds },
        attributes: ["id", "first_name", "mobile"],
        raw: true,
      });

      const bookingUserMap = {};
      bookings.forEach(b => {
        bookingUserMap[b.id] = b.user_id;
      });

      users.forEach(u => {
        usersMap[u.id] = {
          name: u.first_name,
          mobile: u.mobile,
        };
      });

      slots.forEach(slot => {
        if (slot.booking_id && bookingUserMap[slot.booking_id]) {
          const userId = bookingUserMap[slot.booking_id];
          slot.user = usersMap[userId] || null;
        } else {
          slot.user = null;
        }
      });
    } else {
      slots.forEach(slot => {
        slot.user = null;
      });
    }

    return res.json({
      success: true,
      data: slots,
    });

  } catch (error) {
    console.error("Admin Availability Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error:error.message
    });
  }
};

const updateAvailabilitySlot = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const { type, date, slots = [] } = req.body;

    if (!type || !date) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "type and date are required",
      });
    }

    if (!["block", "unblock"].includes(type)) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Invalid type",
      });
    }

    if (!Array.isArray(slots) || !slots.length) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "slots array is required",
      });
    }

    for (const s of slots) {
      if (!s.start_time || !s.end_time) {
        await t.rollback();
        return res.status(400).json({
          success: false,
          message: "Each slot must have start_time and end_time",
        });
      }

      if (s.start_time >= s.end_time) {
        await t.rollback();
        return res.status(400).json({
          success: false,
          message: "End time must be greater than start time",
        });
      }
    }

    const slotConditions = slots.map((s) => ({
      date,
      start_time: s.start_time,
      end_time: s.end_time,
    }));

    const matchingSlots = await AvailabilitySlot.findAll({
      where: {
        [Op.or]: slotConditions,
      },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!matchingSlots.length) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: "No matching slots found",
      });
    }

    const hasBooked = matchingSlots.some(
      (slot) => slot.status === "booked"
    );

    if (hasBooked) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Booked slots cannot be modified",
      });
    }

    await AvailabilitySlot.update(
      {
        status: type === "block" ? "blocked" : "available",
      },
      {
        where: {
          [Op.or]: slotConditions,
        },
        transaction: t,
      }
    );

    await t.commit();

    return res.json({
      success: true,
      message:
        type === "block"
          ? "Slots blocked successfully"
          : "Slots unblocked successfully",
    });

  } catch (error) {
    await t.rollback();
    console.error("Update Availability Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

const getAvailabilityDropDown = async (req, res) => {
  try {
    const { booking_date, package_id } = req.query;

    if (!booking_date || !package_id) {
      return res.status(400).json({
        success: false,
        message: "booking_date and package_id are required",
      });
    }

    const slots = await AvailabilitySlot.findAll({
      where: {
        date: booking_date,
        package_id,
      },
      attributes: ["date", "start_time", "end_time", "status"],
      order: [["start_time", "ASC"]],
    });

    return res.json({
      success: true,
      data: slots,
    });
  } catch (error) {
    console.error("User Availability Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

const blockTimeSlot = async (req, res) => {
  try {
    const { blockType, dateFrom, dateTo, startTime, endTime, reason } =
      req.body;

    if (!blockType || !dateFrom) {
      return res.status(400).json({ message: "Invalid payload" });
    }

    if (blockType === "specific" && (!startTime || !endTime)) {
      return res.status(400).json({
        message: "Start time and end time are required for specific block",
      });
    }

    const startDate = dateFrom;
    const endDate = blockType === "multiple" && dateTo ? dateTo : dateFrom;

    const where = {
      date: { [Op.between]: [startDate, endDate] },
      status: { [Op.ne]: "booked" },
    };

    if (blockType === "specific") {
      where[Op.and] = [
        { start_time: { [Op.lt]: endTime } },
        { end_time: { [Op.gt]: startTime } },
      ];
    }

    const [count] = await AvailabilitySlot.update(
      {
        status: "blocked",
        block_reason: reason || null,
      },
      { where },
    );

    if (!count) {
      return res.status(404).json({
        success: false,
        message: "No slots found to block",
      });
    }

    return res.json({
      success: true,
      message: "Availability blocked successfully",
      affected: count,
    });
  } catch (err) {
    return res.status(500).json({ message: "Server error" });
  }
};

const bulkCopyAvailability = async (req, res) => {
  try {
    const { source_date, target_dates } = req.body;
    const adminId = req.admin.id;

    if (!source_date || !target_dates?.length) {
      return res.status(400).json({
        success: false,
        message: "Invalid request",
      });
    }

    // 1️⃣ Only copy AVAILABLE slots
    const sourceSlots = await AvailabilitySlot.findAll({
      where: {
        date: source_date,
        status: "available",
      },
    });

    if (!sourceSlots.length) {
      return res.status(404).json({
        success: false,
        message: "No available slots found for source date",
      });
    }

    const newSlots = [];

    for (const targetDate of target_dates) {
      for (const slot of sourceSlots) {
        // 2️⃣ Prevent duplicate slots
        const exists = await AvailabilitySlot.findOne({
          where: {
            date: targetDate,
            start_time: slot.start_time,
            end_time: slot.end_time,
          },
        });

        if (!exists) {
          newSlots.push({
            date: targetDate,
            start_time: slot.start_time,
            end_time: slot.end_time,
            package_ids: slot.package_ids,
            created_by: adminId,
            status: "available",
          });
        }
      }
    }

    if (!newSlots.length) {
      return res.json({
        success: true,
        message: "No new slots to copy (all already exist)",
      });
    }

    await AvailabilitySlot.bulkCreate(newSlots);

    return res.json({
      success: true,
      message: "Availability copied successfully",
      created: newSlots.length,
    });
  } catch (error) {
    console.error("Bulk Copy Error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const deleteAvailabilitySlot = async (req, res) => {
  try {
    const { slot_id } = req.params;
    const slot = await AvailabilitySlot.findByPk(slot_id);

    if (!slot) {
      return res.status(404).json({
        success: false,
        message: "Slot not found",
      });
    }

    if (slot.status === "booked") {
      return res.status(400).json({
        success: false,
        message: "Booked slot cannot be deleted",
      });
    }

    await slot.destroy();

    return res.json({
      success: true,
      message: "Slot deleted successfully",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = {
  createAvailability,
  getAvailability,
  blockTimeSlot,
  bulkCopyAvailability,
  updateAvailabilitySlot,
  deleteAvailabilitySlot,
  getAvailabilityDropDown
};
