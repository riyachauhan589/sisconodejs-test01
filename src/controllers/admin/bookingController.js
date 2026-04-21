
const { Booking, User, UserPackage, Package, Payment, AvailabilitySlot, sequelize, Transaction, BookingSlot, Sequelize, } = require("../../models");
const { Op } = require("sequelize");
const Stripe = require("stripe");
const axios = require("axios")

const createBooking = async (req, res) => {
  try {

    const { user_id, package_id, booking_date, start_time, end_time } = req.body;

    if (!user_id || !package_id || !booking_date || !start_time || !end_time) {
      return res.status(400).json({ success: false, message: "All fields are required" });
    }

    const check_package = await Package.findByPk(package_id);
    if (!check_package) {
      return res.status(404).json({ success: false, message: "Package not found" });
    }

    const check_existing_booking = await Booking.findOne({
      where: {
        user_id,
        package_id,
        booking_date,
        start_time,
        end_time
      }
    });
    if (check_existing_booking) {
      return res.status(409).json({ success: false, message: "Booking already exists for the given details" });
    }

    const newBooking = await Booking.create({
      user_id,
      package_id,
      booking_date,
      start_time,
      end_time,
      status: "pending",
    });

    return res.status(201).json({
      success: true,
      message: "Booking created successfully",
      data: newBooking
    });

  }
  catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Server error", error: error.message });

  }
}

// const getAllBookingsForAdmin = async (req, res) => {
//   try {
//     const page = parseInt(req.query.page, 10) || 1;
//     const limit = parseInt(req.query.limit, 10) || 10;
//     const offset = (page - 1) * limit;

//     const { search, status, payment_status } = req.query;

//     const whereCondition = {};

//     if (status) whereCondition.status = status;

//     if (payment_status) {
//       whereCondition["$payments.status$"] = payment_status;
//     }

//     if (search) {
//       whereCondition[Op.or] = [
//         { uid: { [Op.like]: `%${search}%` } },
//         { "$user.first_name$": { [Op.like]: `%${search}%` } },
//         { "$user.last_name$": { [Op.like]: `%${search}%` } },
//         { "$user.email$": { [Op.like]: `%${search}%` } },
//       ];
//     }

//     const { count, rows } = await Booking.findAndCountAll({
//       where: whereCondition,
//       include: [
//         {
//           model: User,
//           as: "user",
//           attributes: ["first_name", "last_name", "email"],
//         },
//         {
//           model: Package,
//           as: "package",
//           attributes: ["name"],
//         },
//         {
//           model: Payment,
//           as: "payments",
//           attributes: ["id", "uid", "status"],
//         },
//         {
//           model: BookingSlot,
//           as: "slots",
//           attributes: ["booking_date", "start_time", "end_time"],
//         },
//       ],
//       order: [["created_at", "DESC"]],
//       limit,
//       offset,
//       distinct: true,
//     });

//     const totalPages = Math.ceil(count / limit);

//     const data = rows.map((booking) => {
//       const payment = booking.payments?.[0] || null;

//       const sortedSlots = booking.slots
//         ? [...booking.slots].sort(
//             (a, b) =>
//               new Date(a.booking_date) - new Date(b.booking_date)
//           )
//         : [];

//       const firstSlot = sortedSlots[0];

//       return {
//         id: booking.id,
//         booking_id: booking.uid,
//         learner_name: `${booking.user?.first_name || ""} ${booking.user?.last_name || ""}`.trim(),
//         package_name: booking.package?.name || null,
//         first_lesson_date: firstSlot?.booking_date || null,
//         first_lesson_time: firstSlot
//           ? `${firstSlot.start_time} - ${firstSlot.end_time}`
//           : null,
//         total_lessons: booking.total_hours,
//         booking_status: booking.status,
//         payment_id: payment?.id || null,
//         payment_uid: payment?.uid || null,
//         payment_status: payment?.status || "pending",
//         created_on: booking.created_at,
//       };
//     });

//     return res.json({
//       success: true,
//       message: "Bookings fetched successfully",
//       settings: {
//         count,
//         page,
//         rows_per_page: limit,
//         total_pages: totalPages,
//         next_page: page < totalPages ? page + 1 : null,
//         prev_page: page > 1 ? page - 1 : null,
//       },
//       data,
//     });
//   } catch (error) {
//     return res.status(500).json({
//       success: false,
//       message: "Server error",
//       error: error.message,
//     });
//   }
// };



// const getAllBookingsForAdmin = async (req, res) => {
//   try {
//     const page = parseInt(req.query.page, 10) || 1;
//     const limit = parseInt(req.query.limit, 10) || 10;
//     const offset = (page - 1) * limit;

//     const {
//       search,
//       status,
//       payment_status,
//       booking_start_date,
//       booking_end_date,
//       start_date,
//       end_date,
//     } = req.query;

//     const bookingWhere = {};
//     const slotWhere = {};
//     const paymentWhere = {};
//     const userWhere = {};

//     if (status) {
//       bookingWhere.status = status;
//     }

//     if (start_date && end_date) {
//       bookingWhere.created_at = {
//         [Op.between]: [start_date, end_date],
//       };
//     } else if (start_date) {
//       bookingWhere.created_at = {
//         [Op.gte]: start_date,
//       };
//     }

//     if (payment_status) {
//       paymentWhere.status = payment_status;
//     }

//     if (booking_start_date && booking_end_date) {
//       slotWhere.booking_date = {
//         [Op.between]: [booking_start_date, booking_end_date],
//       };
//     } else if (booking_start_date) {
//       slotWhere.booking_date = booking_start_date;
//     }

//     if (search) {
//       bookingWhere[Op.or] = [
//         { uid: { [Op.like]: `%${search}%` } },
//       ];

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
//           model: User,
//           as: "user",
//           attributes: ["first_name", "last_name", "email"],
//           where: Object.keys(userWhere).length ? userWhere : undefined,
//           required: !!search,
//         },
//         {
//           model: Package,
//           as: "package",
//           attributes: ["name"],
//         },
//         {
//           model: Payment,
//           as: "payments",
//           attributes: ["id", "uid", "status"],
//           where: Object.keys(paymentWhere).length ? paymentWhere : undefined,
//           required: !!payment_status,
//         },
//         {
//           model: BookingSlot,
//           as: "slots",
//           attributes: [
//             "booking_date",
//             "start_time",
//             "end_time",
//             "status",
//           ],
//           where: Object.keys(slotWhere).length ? slotWhere : undefined,
//           required: !!booking_start_date || !!booking_end_date,
//         },
//       ],
//       order: [["created_at", "DESC"]],
//       limit,
//       offset,
//       distinct: true,
//       subQuery: false,   // ✅ IMPORTANT FIX
//     });

//     const totalPages = Math.ceil(count / limit);

//     const data = rows.map((booking) => {
//       const payment = booking.payments?.[0] || null;

//       const sortedSlots = booking.slots
//         ? [...booking.slots].sort(
//           (a, b) =>
//             new Date(a.booking_date) - new Date(b.booking_date)
//         )
//         : [];

//       const firstSlot = sortedSlots[0];

//       const completedLessons = booking.slots
//         ? booking.slots.filter((slot) => slot.status === "completed").length
//         : 0;

//       const upcomingLessons = booking.slots
//         ? booking.slots.filter((slot) => slot.status === "booked").length
//         : 0;

//       const totalLessons = booking.total_hours || 0;

//       const remainingLessons =
//         totalLessons - (completedLessons + upcomingLessons);

//       return {
//         id: booking.id,
//         booking_id: booking.uid,
//         learner_name: `${booking.user?.first_name || ""} ${booking.user?.last_name || ""}`.trim(),
//         package_name: booking.package?.name || null,
//         first_lesson_date: firstSlot?.booking_date || null,
//         first_lesson_time: firstSlot
//           ? `${firstSlot.start_time} - ${firstSlot.end_time}`
//           : null,
//         total_lessons: totalLessons,
//         completed_lessons: completedLessons,
//         upcoming_lessons: upcomingLessons,
//         remaining_lessons: remainingLessons < 0 ? 0 : remainingLessons,
//         booking_status: booking.status,
//         payment_id: payment?.id || null,
//         payment_uid: payment?.uid || null,
//         payment_status: payment?.status || "pending",
//         created_on: booking.created_at,
//       };
//     });

//     return res.json({
//       success: true,
//       message: "Bookings fetched successfully",
//       settings: {
//         count,
//         page,
//         rows_per_page: limit,
//         total_pages: totalPages,
//         next_page: page < totalPages ? page + 1 : null,
//         prev_page: page > 1 ? page - 1 : null,
//       },
//       data,
//     });

//   } catch (error) {
//     console.error("Get All Bookings Error:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Server error",
//       error: error.message,
//     });
//   }
// };


const getAllBookingsForAdmin = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const offset = (page - 1) * limit;

    const {
      search,
      status,
      payment_status,
      booking_start_date,
      booking_end_date,
      start_date,
      end_date,
    } = req.query;

    const allowedStatuses = ["confirmed", "cancelled", "rescheduled"];

    const bookingWhere = {
      status: {
        [Op.in]: allowedStatuses,
      },
    };

    const paymentWhere = {};

    if (status && allowedStatuses.includes(status)) {
      bookingWhere.status = status;
    }

    if (start_date && end_date) {
      const endOfDay = new Date(end_date);
      endOfDay.setHours(23, 59, 59, 999);

      bookingWhere.created_at = {
        [Op.between]: [new Date(start_date), endOfDay],
      };
    } else if (start_date) {
      bookingWhere.created_at = {
        [Op.gte]: new Date(start_date),
      };
    }

    if (payment_status) {
      paymentWhere.status = payment_status;
    }

    if (booking_start_date && booking_end_date) {
      const start = new Date(booking_start_date);
      const end = new Date(booking_end_date);
      end.setDate(end.getDate() + 1);

      bookingWhere.id = {
        [Op.in]: Sequelize.literal(`
          (
            SELECT DISTINCT booking_id
            FROM booking_slots
            WHERE booking_slots.booking_id = Booking.id
            AND booking_date >= '${start.toISOString()}'
            AND booking_date < '${end.toISOString()}'
          )
        `),
      };
    }

    if (search) {
      bookingWhere[Op.or] = [
        { uid: { [Op.like]: `%${search}%` } },
        { "$user.first_name$": { [Op.like]: `%${search}%` } },
        { "$user.last_name$": { [Op.like]: `%${search}%` } },
        { "$user.email$": { [Op.like]: `%${search}%` } },
      ];
    }

    const { count, rows } = await Booking.findAndCountAll({
      where: bookingWhere,
      attributes: ["id", "uid", "status", "created_at"],
      include: [
        {
          model: User,
          as: "user",
          attributes: ["first_name", "last_name", "email"],
          required: false,
        },
        {
          model: Package,
          as: "package",
          attributes: ["name", "lessons_count"],
        },
        {
          model: Payment,
          as: "payments",
          attributes: ["id", "uid", "status"],
          where: Object.keys(paymentWhere).length ? paymentWhere : undefined,
          required: !!payment_status,
        },
        {
          model: BookingSlot,
          as: "slots",
          attributes: [
            "booking_date",
            "start_time",
            "end_time",
            "status",
            "created_at",
          ],
          separate: true,
          order: [["booking_date", "ASC"]],
        },
      ],
      order: [["created_at", "DESC"]],
      limit,
      offset,
      distinct: true,
      subQuery: false,
    });

    const totalPages = Math.ceil(count / limit);

    const data = rows.map((booking) => {
      const payment = booking.payments?.[0] || null;
      const sortedSlots = booking.slots || [];
      const firstSlot = sortedSlots[0];

      const completedLessons = sortedSlots.filter(
        (slot) => slot.status === "completed"
      ).length;

      const upcomingLessons = sortedSlots.filter(
        (slot) => slot.status === "booked"
      ).length;

      const totalLessons = booking.package?.lessons_count || 0;

      const remainingLessons =
        totalLessons - (completedLessons + upcomingLessons);

      return {
        id: booking.id,
        booking_id: booking.uid,
        learner_name: `${booking.user?.first_name || ""} ${booking.user?.last_name || ""}`.trim(),
        package_name: booking.package?.name || null,
        first_lesson_date: firstSlot?.booking_date || null,
        first_lesson_time: firstSlot
          ? `${firstSlot.start_time} - ${firstSlot.end_time}`
          : null,
        total_lessons: totalLessons,
        completed_lessons: completedLessons,
        upcoming_lessons: upcomingLessons,
        remaining_lessons: remainingLessons < 0 ? 0 : remainingLessons,
        booking_status: booking.status,
        payment_id: payment?.id || null,
        payment_uid: payment?.uid || null,
        payment_status: payment?.status || "pending",
        created_on: booking.get("created_at"),
      };
    });

    return res.json({
      success: true,
      message: "Bookings fetched successfully",
      settings: {
        count,
        page,
        rows_per_page: limit,
        total_pages: totalPages,
        next_page: page < totalPages ? page + 1 : null,
        prev_page: page > 1 ? page - 1 : null,
      },
      data,
    });
  } catch (error) {
    console.error("Get All Bookings Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

const getBookingById = async (req, res) => {
  try {
    const { id } = req.params;

    const booking = await Booking.findByPk(id, {
       attributes: ["id", "uid", "status", "created_at"],
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "first_name", "last_name", "email", "mobile"],
        },
        {
          model: Package,
          as: "package",
          attributes: [
            "id",
            "name",
            "type",
            "description",
            "price",
            "lessons_duration",
            "lessons_count",   // ✅ FIX
          ],
        },
        {
          model: Payment,
          as: "payments",
          attributes: ["id", "uid", "amount", "currency", "status", "paid_at"],
        },
        {
          model: BookingSlot,
          as: "slots",
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
        },
      ],
      order: [
        [{ model: BookingSlot, as: "slots" }, "booking_date", "ASC"],
      ],
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }
    // const bookingData = booking.toJSON();
    const totalLessons = booking.package?.lessons_count || 0;

    const completedCount = booking.slots.filter(
      (s) => s.status === "completed"
    ).length;

    const upcomingCount = booking.slots.filter(
      (s) => s.status === "booked"
    ).length;

    const remainingLessons =
      totalLessons - (completedCount + upcomingCount);

    return res.status(200).json({
      success: true,
      data: {
        booking_id: booking.id,
        booking_uid: booking.uid,
        booking_created_date: booking.get("created_at"),
        booking_status: booking.status,
        total_lessons: totalLessons,
        completed_lessons: completedCount,
        upcoming_lessons: upcomingCount,
        created_on: booking.get("created_at"),
        remaining_lessons:
          remainingLessons < 0 ? 0 : remainingLessons,
        learner: booking.user,
        package: booking.package,
        payment: booking.payments?.[0] || null,
        lessons: booking.slots,
      },
    });
  } catch (error) {
    console.error("Get Booking By Id Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// const updateBooking = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const { status, cancel_reason, notes, rescheduled_date, start_time, end_time, booking_date, package_id } = req.body;

//     if (!id) {
//       return res.status(400).json({ success: false, message: "Booking ID is required" });
//     }
//     const booking = await Booking.findByPk(id);
//     if (!booking) {
//       return res.status(404).json({ success: false, message: "Booking not found" });
//     }

//     if (package_id) {
//       const check_package = await Package.findByPk(package_id);
//       if (!check_package) {
//         return res.status(404).json({ success: false, message: "Package not found" });
//       }
//       booking.package_id = package_id;
//     }
//     if (status) booking.status = status;
//     if (cancel_reason) {
//       booking.cancel_reason = cancel_reason;
//       booking.status = "cancelled";

//     }
//     if (notes) booking.notes = notes;
//     if (booking_date) {
//       const check_existing_reschedule = await Booking.findOne({
//         where: {
//           user_id: booking.user_id,
//           package_id: booking.package_id,
//           booking_date: booking_date,
//           start_time: start_time || booking.start_time,
//           end_time: end_time || booking.end_time
//         }
//       });
//       if (check_existing_reschedule) {
//         return res.status(409).json({ success: false, message: "A booking already exists for the rescheduled date and time" });
//       }
//       booking.booking_date = booking_date;
//       booking.status = "rescheduled";
//     }
//     if (start_time) booking.start_time = start_time;
//     if (end_time) booking.end_time = end_time;
//     if (booking_date) booking.booking_date = booking_date;
//     await booking.save();

//     return res.status(200).json({
//       success: true,
//       message: "Booking updated successfully",
//       data: booking
//     });


//   }
//   catch (error) {
//     console.error(error);
//     return res.status(500).json({ success: false, message: "Server error", error: error.message });

//   }
// }


const updateBooking = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const {
      booking_date,
      start_time,
      end_time,
      cancel_reason,
      notes,
    } = req.body;

    if (!id) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Booking ID is required",
      });
    }

    const booking = await Booking.findOne({
      where: { id },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!booking) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    //slot
    const oldSlot = await AvailabilitySlot.findOne({
      where: {
        date: booking.booking_date,
        start_time: booking.start_time,
        end_time: booking.end_time,
        package_id: booking.package_id,
      },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    //reschedule
    if (booking_date && start_time && end_time) {

      const newSlot = await AvailabilitySlot.findOne({
        where: {
          date: booking_date,
          start_time,
          end_time,
          package_id: booking.package_id,
          status: "available",
        },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      if (!newSlot) {
        await t.rollback();
        return res.status(400).json({
          success: false,
          message: "Selected slot is not available",
        });
      }

      // Book new slot
      await newSlot.update(
        {
          status: "booked",
          booking_id: booking.id,
        },
        { transaction: t }
      );

      // Free old slot
      if (oldSlot) {
        await oldSlot.update(
          {
            status: "available",
            booking_id: null,
          },
          { transaction: t }
        );
      }

      booking.booking_date = booking_date;
      booking.start_time = start_time;
      booking.end_time = end_time;
      booking.availability_slot_id = newSlot.id;
      booking.status = "rescheduled";
    }

    //cancel
    if (cancel_reason) {

      if (oldSlot) {
        await oldSlot.update(
          {
            status: "available",
            booking_id: null,
          },
          { transaction: t }
        );
      }

      booking.status = "cancelled";
      booking.cancel_reason = cancel_reason;
    }

    if (notes) {
      booking.notes = notes;
    }

    await booking.save({ transaction: t });
    await t.commit();

    return res.status(200).json({
      success: true,
      message: "Booking updated successfully",
      data: booking,
    });

  } catch (error) {
    await t.rollback();
    console.error("Update Booking Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};



const getUsersDropdown = async (req, res, next) => {
  try {
    const search = req.query.search || "";

    const whereCondition = {
      status: "active",
    };

    if (search) {
      whereCondition[Op.or] = [
        { first_name: { [Op.like]: `%${search}%` } },
        { last_name: { [Op.like]: `%${search}%` } },
        { mobile: { [Op.like]: `%${search}%` } },
      ];
    }

    const users = await User.findAll({
      where: whereCondition,
      attributes: ["id", "first_name", "last_name", "mobile"],
      order: [["first_name", "ASC"]],
      limit: 20,
    });

    return res.status(200).json({
      success: true,
      data: users,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

const getPackagesDropdown = async (req, res, next) => {
  try {
    const search = req.query.search || "";

    const whereCondition = {
      status: "active",
    };

    if (search) {
      whereCondition[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { type: { [Op.like]: `%${search}%` } },
      ];
    }

    const packages = await Package.findAll({
      where: whereCondition,
      attributes: ["id", "name", "type", "price"],
      order: [["name", "ASC"]],
      limit: 20,
    });

    return res.status(200).json({
      success: true,
      data: packages,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const refundStripePayment = async (req, res) => {
  const dbTx = await sequelize.transaction();

  try {
    const { payment_intent_id } = req.params;
    const { amount } = req.body; //  (partial refund)

    if (!payment_intent_id) {
      throw new Error("PaymentIntent ID required");
    }

    if (amount !== undefined && amount <= 0) {
      throw new Error("Refund amount must be greater than zero");
    }


    const transaction = await Transaction.findOne({
      where: { gateway_order_id: payment_intent_id },
      include: [{ model: Payment }],
      transaction: dbTx,
      lock: true,
    });

    if (!transaction) throw new Error("Transaction not found");

    if (transaction.status === "refunded") {
      await dbTx.commit();
      return res.json({ success: true, message: "Already refunded" });
    }

    if (!transaction.is_captured) {
      throw new Error("Payment not captured yet");
    }

    // Validate partial refund
    if (amount && amount > transaction.amount) {
      throw new Error("Refund amount exceeds original payment");
    }

    // Stripe Refund
    const refund = await stripe.refunds.create({
      payment_intent: payment_intent_id,
      ...(amount && { amount: Math.round(amount * 100) }),
    });

    const isPartial = amount && amount < transaction.amount;

    //Update Transaction
    transaction.status = isPartial ? "refunded" : "refunded";
    transaction.gateway_response = refund;
    await transaction.save({ transaction: dbTx });

    //Update Payment
    await transaction.Payment.update(
      {
        status: isPartial ? "refunded" : "refunded",
        refunded_at: new Date(),
      },
      { transaction: dbTx }
    );

    //Update Booking
    await Booking.update(
      {
        status: isPartial ? "confirmed" : "cancelled",
      },
      {
        where: { id: transaction.Payment.booking_id },
        transaction: dbTx,
      }
    );

    await dbTx.commit();

    return res.json({
      success: true,
      message: "Stripe refund successful",
      refund_id: refund.id,
      refund_type: isPartial ? "partial" : "full",
    });
  } catch (error) {
    await dbTx.rollback();
    console.error("Stripe Refund Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const PAYPAL_BASE_URL =
  process.env.PAYPAL_MODE === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";

const getPayPalAccessToken = async () => {
  try {
    const response = await axios({
      url: `${PAYPAL_BASE_URL}/v1/oauth2/token`,
      method: "post",
      auth: {
        username: process.env.PAYPAL_CLIENT_ID,
        password: process.env.PAYPAL_SECRET,
      },
      params: {
        grant_type: "client_credentials",
      },
    });
    return response.data.access_token;
  } catch (error) {
    console.error("PayPal Token Error:", error.response?.data || error.message);
    throw new Error("Failed to get PayPal access token");
  }
};

const refundPayPalPayment = async (req, res) => {
  const dbTx = await sequelize.transaction();

  try {
    const { order_id } = req.params;
    const { amount } = req.body; //  partial refund

    if (!order_id) {
      throw new Error("order_id  required");
    }

    if (amount !== undefined && amount <= 0) {
      throw new Error("Refund amount must be greater than zero");
    }

    const accessToken = await getPayPalAccessToken();
    console.log("accestoken", accessToken)
    const transaction = await Transaction.findOne({
      where: { gateway_order_id: order_id },
      include: [{ model: Payment }],
      transaction: dbTx,
      lock: true,
    });

    if (!transaction) throw new Error("Transaction not found");

    if (transaction.status === "refunded") {
      await dbTx.commit();
      return res.json({ success: true, message: "Already refunded" });
    }

    if (!transaction.is_captured) {
      throw new Error("PayPal payment not captured");
    }

    if (!transaction.gateway_payment_id) {
      throw new Error("PayPal capture ID missing");
    }

    //Validate partial refund
    if (amount && amount > transaction.amount) {
      throw new Error("Refund amount exceeds original payment");
    }

    //PayPal Refund
    const refundResponse = await axios.post(
      `${PAYPAL_BASE_URL}/v2/payments/captures/${transaction.gateway_payment_id}/refund`,
      amount
        ? {
          amount: {
            value: amount,
            currency_code: transaction.currency,
          },
        }
        : {},
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    const isPartial = amount && amount < transaction.amount;

    //Update Transaction
    transaction.status = isPartial ? "refunded" : "refunded";
    transaction.gateway_response = refundResponse.data;
    await transaction.save({ transaction: dbTx });

    //Update Payment
    await transaction.Payment.update(
      {
        status: isPartial ? "refunded" : "refunded",
        refunded_at: new Date(),
      },
      { transaction: dbTx }
    );

    //Update Booking
    await Booking.update(
      {
        status: isPartial ? "confirmed" : "cancelled",
      },
      {
        where: { id: transaction.Payment.booking_id },
        transaction: dbTx,
      }
    );

    await dbTx.commit();

    return res.json({
      success: true,
      message: "PayPal refund successful",
      refund_id: refundResponse.data.id,
      refund_type: isPartial ? "partial" : "full",
    });
  } catch (error) {
    await dbTx.rollback();
    console.error("PayPal Refund Error:", error.response?.data || error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getAvailability = async (req, res) => {
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

module.exports = {
  getAllBookingsForAdmin,
  createBooking,
  updateBooking,
  getBookingById,
  getUsersDropdown,
  getPackagesDropdown,
  refundPayPalPayment,
  refundStripePayment,
  getAvailability
};