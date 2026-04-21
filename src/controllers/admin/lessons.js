const { Booking, BookingSlot, Package, User, AvailabilitySlot, sequelize } = require("../../models");
const { Op, Sequelize } = require("sequelize");

// const fetchLessons = async (req, res) => {
//   try {
//     const page = parseInt(req.query.page, 10) || 1;
//     const limit = parseInt(req.query.limit, 10) || 10;
//     const offset = (page - 1) * limit;

//     const { status, search, start_date, end_date } = req.query;

//     const bookingWhere = {};
//     const slotWhere = {};
//     const userWhere = {};


//     if (status) {
//       slotWhere.status = status;
//     }

//     //  Date Filter (slot.booking_date)
//     if (start_date && end_date) {
//       slotWhere.booking_date = {
//         [Op.between]: [start_date, end_date],
//       };
//     } else if (start_date) {
//       slotWhere.booking_date = start_date;
//     }

//     //  Global Search
//     if (search) {

//       bookingWhere.uid = {
//         [Op.like]: `%${search}%`,
//       };

//       // search user fields
//       userWhere[Op.or] = [
//         { first_name: { [Op.like]: `%${search}%` } },
//         { last_name: { [Op.like]: `%${search}%` } },
//         { email: { [Op.like]: `%${search}%` } },
//       ];
//     }

//     const { count, rows } = await Booking.findAndCountAll({
//       where: bookingWhere,
//       include: [
//         {
//           model: Package,
//           as: "package",
//           attributes: ["id", "name", "lessons_count"],
//         },
//         {
//           model: User,
//           as: "user",
//           attributes: ["id", "first_name", "last_name", "email"],
//           where: Object.keys(userWhere).length ? userWhere : undefined,
//           required: !!search, // important for search filtering
//         },
//         {
//           model: BookingSlot,
//           as: "slots",
//           where: Object.keys(slotWhere).length ? slotWhere : undefined,
//           required: true, // because we filter by lesson
//           attributes: [
//             "id",
//             "booking_date",
//             "start_time",
//             "end_time",
//             "status",
//             "address",
//             "latitude",
//             "longitude",
//           ],
//         },
//       ],
//       order: [
//         [{ model: BookingSlot, as: "slots" }, "booking_date", "ASC"],
//       ],
//       limit,
//       offset,
//       distinct: true,
//       subQuery: false, // 🔥 prevents alias issue
//     });

//     const totalPages = Math.ceil(count / limit);

//     const formatted = rows.map((booking) => {
//       const totalLessons = booking.package?.lessons_count || 0;

//       const completedCount = booking.slots.filter(
//         (s) => s.status === "completed"
//       ).length;

//       const upcomingCount = booking.slots.filter(
//         (s) => s.status === "booked"
//       ).length;

//       const remaining =
//         totalLessons - (completedCount + upcomingCount);

//       const slot = booking.slots[0];

//       return {
//         booking_id: booking.id,
//         booking_uid: booking.uid,
//         lesson_id: slot?.id || null,

//         learner_name: `${booking.user?.first_name} ${booking.user?.last_name}`,
//         learner_email: booking.user?.email,

//         package_name: booking.package?.name,

//         total_lessons: totalLessons,
//         completed_lessons: completedCount,
//         upcoming_lessons: upcomingCount,
//         remaining_lessons: remaining < 0 ? 0 : remaining,

//         booking_status: booking.status,
//         lesson_status: slot?.status || null,
//         created_at: booking.created_at,

//         lesson_date: slot?.booking_date || null,
//         start_time: slot?.start_time || null,
//         end_time: slot?.end_time || null,
//         address: slot?.address || null,
//         latitude: slot?.latitude || null,
//         longitude: slot?.longitude || null,
//       };
//     });

//     return res.json({
//       success: true,
//       data: formatted,
//       settings: {
//         count,
//         page,
//         rows_per_page: limit,
//         total_pages: totalPages,
//         next_page: page < totalPages ? page + 1 : null,
//         prev_page: page > 1 ? page - 1 : null,
//       },
//     });

//   } catch (error) {
//     console.error("Fetch Lessons Error:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Server error",
//       error: error.message,
//     });
//   }
// };


const fetchLessons = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const offset = (page - 1) * limit;

    const { status, search, start_date, end_date } = req.query;

    const slotWhere = {};
    const bookingWhere = {};
    const userWhere = {};

    // ✅ Status filter
    if (status) {
      slotWhere.status = status;
    }

    // ✅ Date filter
    if (start_date && end_date) {
      slotWhere.booking_date = {
        [Op.between]: [start_date, end_date],
      };
    } else if (start_date) {
      slotWhere.booking_date = start_date;
    }

    // ✅ Search filter
    if (search) {
      slotWhere[Op.or] = [
        { "$booking.uid$": { [Op.like]: `%${search}%` } },
        { "$booking.user.first_name$": { [Op.like]: `%${search}%` } },
        { "$booking.user.last_name$": { [Op.like]: `%${search}%` } },
        { "$booking.user.email$": { [Op.like]: `%${search}%` } },
      ];
    }

    // 🔥 MAIN QUERY (Paginating on BookingSlot)
    const { count, rows } = await BookingSlot.findAndCountAll({
      where: slotWhere,
      include: [
        {
          model: Booking,
          as: "booking",
          required: false,
          include: [
            {
              model: User,
              as: "user",
              attributes: ["id", "first_name", "last_name", "email"],
              required: false,
            },
            {
              model: Package,
              as: "package",
              attributes: ["id", "name", "lessons_count"],
            },
          ],
        },
      ],
      order: [["booking_date", "ASC"]],
      limit,
      offset,
      subQuery: false,
    });

    // ✅ Get booking IDs for count calculation
    const bookingIds = [...new Set(rows.map((lesson) => lesson.booking_id))];

    let countMap = {};

    if (bookingIds.length > 0) {
      const lessonCounts = await BookingSlot.findAll({
        attributes: [
          "booking_id",
          [
            Sequelize.fn(
              "SUM",
              Sequelize.literal(
                `CASE WHEN status = 'completed' THEN 1 ELSE 0 END`
              )
            ),
            "completed_count",
          ],
          [
            Sequelize.fn(
              "SUM",
              Sequelize.literal(
                `CASE WHEN status = 'booked' THEN 1 ELSE 0 END`
              )
            ),
            "upcoming_count",
          ],
        ],
        where: {
          booking_id: bookingIds,
        },
        group: ["booking_id"],
        raw: true,
      });

      lessonCounts.forEach((item) => {
        countMap[item.booking_id] = {
          completed: parseInt(item.completed_count, 10) || 0,
          upcoming: parseInt(item.upcoming_count, 10) || 0,
        };
      });
    }

    const totalPages = Math.ceil(count / limit);

    // ✅ Format response
    const formatted = rows.map((lesson) => {
      const booking = lesson.booking;
      const totalLessons = booking?.package?.lessons_count || 0;

      const counts = countMap[lesson.booking_id] || {
        completed: 0,
        upcoming: 0,
      };

      const completedCount = counts.completed;
      const upcomingCount = counts.upcoming;

      const remaining =
        totalLessons - (completedCount + upcomingCount);

      return {
        booking_id: booking?.id,
        booking_uid: booking?.uid,
        lesson_id: lesson.id,

        learner_name: `${booking?.user?.first_name || ""} ${booking?.user?.last_name || ""
          }`.trim(),
        learner_email: booking?.user?.email || null,

        package_name: booking?.package?.name || null,

        total_lessons: totalLessons,
        completed_lessons: completedCount,
        upcoming_lessons: upcomingCount,
        remaining_lessons: remaining < 0 ? 0 : remaining,

        booking_status: booking?.status,
        lesson_status: lesson.status,
        created_at: booking?.created_at,

        lesson_date: lesson.booking_date,
        start_time: lesson.start_time,
        end_time: lesson.end_time,
        address: lesson.address,
        latitude: lesson.latitude,
        longitude: lesson.longitude,
      };
    });

    return res.json({
      success: true,
      data: formatted,
      settings: {
        count,
        page,
        rows_per_page: limit,
        total_pages: totalPages,
        next_page: page < totalPages ? page + 1 : null,
        prev_page: page > 1 ? page - 1 : null,
      },
    });

  } catch (error) {
    console.error("Fetch Lessons Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};




const getLessonById = async (req, res) => {
  try {
    const { id } = req.params; // lesson_id

    const lesson = await BookingSlot.findOne({
      where: { id },
      attributes: [
        "id",
        "booking_date",
        "start_time",
        "end_time",
        "status",
        "address",
        "latitude",
        "longitude",
      ],
      include: [
        {
          model: Booking,
          as: "booking",
          attributes: ["id", "uid", "status", "created_at"],
          include: [
            {
              model: User,
              as: "user",
              attributes: ["id", "first_name", "last_name", "email"],
            },
            {
              model: Package,
              as: "package",
              attributes: ["id", "name", "lessons_count"],
            },
          ],
        },
      ],
    });

    if (!lesson) {
      return res.status(404).json({
        success: false,
        message: "Lesson not found",
      });
    }

    const booking = lesson.booking;
    const totalLessons = booking.package?.lessons_count || 0;

    // count booked lessons for this booking
    const bookedCount = await BookingSlot.count({
      where: {
        booking_id: booking.id,
        status: ["booked", "completed"],
      },
    });

    return res.json({
      success: true,
      data: {
        lesson: {
          lesson_id: lesson.id,
          lesson_date: lesson.booking_date,
          start_time: lesson.start_time,
          end_time: lesson.end_time,
          status: lesson.status,
          address: lesson.address,
          latitude: lesson.latitude,
          longitude: lesson.longitude,
        },

        booking: {
          booking_id: booking.id,
          booking_uid: booking.uid,
          booking_status: booking.status,
          created_at: booking.created_at,
        },

        learner: {
          learner_id: booking.user?.id,
          learner_name: `${booking.user?.first_name} ${booking.user?.last_name}`,
          learner_email: booking.user?.email,
        },

        package: {
          package_id: booking.package?.id,
          package_name: booking.package?.name,
          total_lessons: totalLessons,
          booked_lessons: bookedCount,
          remaining_lessons: totalLessons - bookedCount,
        },
      },
    });

  } catch (error) {
    console.error("Get Lesson Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

const updateLessonById = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const { id } = req.params;
    const {
      status,
      booking_date,
      start_time,
      end_time,
      address,
      latitude,
      longitude,
    } = req.body;

    const lesson = await BookingSlot.findOne({
      where: { id },
      include: [
        {
          model: Booking,
          as: "booking",
        },
      ],
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!lesson) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: "Lesson not found",
      });
    }


    // MARK COMPLETED

    if (status === "completed") {
      if (lesson.status === "completed") {
        await t.rollback();
        return res.status(400).json({
          success: false,
          message: "Lesson already completed",
        });
      }

      lesson.status = "completed";
      await lesson.save({ transaction: t });

      await t.commit();

      return res.json({
        success: true,
        message: "Lesson marked as completed",
        data: {
          lesson_id: lesson.id,
          status: lesson.status,
        },
      });
    }

    // RESCHEDULE LESSON
    if (lesson.status === "completed") {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Completed lesson cannot be rescheduled",
      });
    }

    if (!booking_date || !start_time || !end_time) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "booking_date, start_time and end_time are required",
      });
    }

    // Prevent same slot reschedule
    if (
      lesson.booking_date === booking_date &&
      lesson.start_time === start_time &&
      lesson.end_time === end_time
    ) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Lesson already scheduled for this slot",
      });
    }

    // Check new availability
    const newAvailability = await AvailabilitySlot.findOne({
      where: {
        date: booking_date,
        start_time,
        end_time,
        status: "available",
        booking_id: null,
      },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!newAvailability) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Selected time slot is not available",
      });
    }

    // Free old availability
    const oldAvailability = await AvailabilitySlot.findOne({
      where: {
        date: lesson.booking_date,
        start_time: lesson.start_time,
        end_time: lesson.end_time,
        booking_id: lesson.booking_id,
      },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (oldAvailability) {
      oldAvailability.status = "available";
      oldAvailability.booking_id = null;
      await oldAvailability.save({ transaction: t });
    }

    // Book new availability
    newAvailability.status = "booked";
    newAvailability.booking_id = lesson.booking_id;
    await newAvailability.save({ transaction: t });

    // Update lesson details
    lesson.booking_date = booking_date;
    lesson.start_time = start_time;
    lesson.end_time = end_time;
    lesson.address = address ?? lesson.address;
    lesson.latitude = latitude ?? lesson.latitude;
    lesson.longitude = longitude ?? lesson.longitude;

    await lesson.save({ transaction: t });

    await t.commit();

    return res.json({
      success: true,
      message: "Lesson rescheduled successfully",
      data: {
        lesson_id: lesson.id,
        booking_date: lesson.booking_date,
        start_time: lesson.start_time,
        end_time: lesson.end_time,
        address: lesson.address,
        latitude: lesson.latitude,
        longitude: lesson.longitude,
      },
    });

  } catch (error) {
    await t.rollback();
    console.error("Update Lesson Error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// const lessonsCounts = async (req, res) => {
//   try {
//     const totalLessons = await BookingSlot.count();
//     const completedLessons = await BookingSlot.count({
//       where: { status: "completed" }
//     });
//     const upcomingLessons = await BookingSlot.count({
//       where: {
//         status: "booked",
//         booking_date: {
//           [Op.gte]: Sequelize.fn('CURDATE')
//         }
//       }
//     });

//     return res.json({
//       success: true,
//       data: {
//         total_lessons: totalLessons,
//         completed_lessons: completedLessons,
//         upcoming_lessons: upcomingLessons,
//       }
//     });
//   } catch (error) {
//     console.error("Lessons Counts Error:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Server error",
//       error: error.message,
//     });
//   }
// }


const lessonsCounts = async (req, res) => {
  try {
    const totalLessons = await BookingSlot.count();

    const completedLessons = await BookingSlot.count({
      where: { status: "completed" },
    });

    const upcomingLessons = await BookingSlot.count({
      where: {
        status: "booked",
        booking_date: {
          [Op.gte]: Sequelize.literal("CURDATE()"),
        },
      },
    });

    return res.json({
      success: true,
      data: {
        total_lessons: totalLessons,
        completed_lessons: completedLessons,
        upcoming_lessons: upcomingLessons,
      },
    });

  } catch (error) {
    console.error("Lessons Counts Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

module.exports = {
  fetchLessons,
  getLessonById,
  updateLessonById,
  lessonsCounts
}