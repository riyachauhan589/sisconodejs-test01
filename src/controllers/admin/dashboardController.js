const {
  Booking,
  User,
  Package,
  Payment,
} = require("../../models");
const { Op } = require("sequelize");

const getISTDateRange = ({ start_date, end_date }) => {
  if (!start_date && !end_date) return null;

  const IST_OFFSET = 5.5 * 60 * 60 * 1000;

  const start = start_date
    ? new Date(`${start_date}T00:00:00`)
    : new Date("1970-01-01T00:00:00");

  const end = end_date
    ? new Date(`${end_date}T23:59:59`)
    : new Date();

  return {
    startUTC: new Date(start.getTime() - IST_OFFSET),
    endUTC: new Date(end.getTime() - IST_OFFSET),
  };
};

const dashboardStats = async (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    const dateRange = getISTDateRange({ start_date, end_date });

    const bookingWhere = {
      status: { [Op.in]: ["confirmed", "cancelled"] },
    };

    const userWhere = {
      status: "active",
    };

    if (dateRange) {
      const rangeFilter = {
        [Op.between]: [dateRange.startUTC, dateRange.endUTC],
      };

      bookingWhere.created_at = rangeFilter;

      if (start_date && end_date) {
        userWhere.registration_date = {
          [Op.between]: [
            new Date(`${start_date}T00:00:00`),
            new Date(`${end_date}T23:59:59`),
          ],
        };
      }
    }

    const [
      totalBookings,
      recentBookingsRaw,
      totalRevenue,
      recentPayments,
      totalLearners,
      recentLearners,
      activePackages,
    ] = await Promise.all([
      Booking.count({ where: bookingWhere }),

      Booking.findAll({
        where: bookingWhere,
        order: [["created_at", "DESC"]],
        limit: 5,
        include: [
          {
            model: User,
            as: "user",
            attributes: ["id", "first_name", "last_name", "mobile"],
          },
          {
            model: Package,
            as: "package",
            attributes: ["id", "name", "type"],
          },
          {
            model: Payment,
            as: "payments",
            attributes: ["id", "amount", "status", "created_at"],
          },
        ],
      }),

      Payment.sum("amount", {
        where: { status: ["paid", "refunded"] },
        include: [
          {
            model: Booking,
            as: "booking",
            where: bookingWhere,
            attributes: [],
          },
        ],
      }),

      Payment.findAll({
        where: { status: "paid" },
        order: [["created_at", "DESC"]],
        limit: 5,
        include: [
          {
            model: User,
            as: "user",
            attributes: ["id", "first_name", "last_name", "mobile"],
          },
          {
            model: Booking,
            as: "booking",
            where: bookingWhere,
            attributes: ["id", "uid", "status", "created_at"],
          },
        ],
      }),

      User.count({ where: userWhere }),

      User.findAll({
        where: userWhere,
        order: [["created_at", "DESC"]],
        limit: 5,
        attributes: [
          "id",
          "uid",
          "first_name",
          "last_name",
          "mobile",
          "email",
          "status",
          "created_at",
        ],
      }),

      Package.count({
        where: { status: "active" },
      }),
    ]);

    const recentBookings = recentBookingsRaw.map((booking) => {
      let firstSlot = null;

      try {
        const slots = booking.selected_slots
          ? JSON.parse(booking.selected_slots)
          : [];
        firstSlot = slots[0] || null;
      } catch (err) {
        console.error("Slot Parse Error:", err);
      }

      return {
        ...booking.toJSON(),
        created_at: booking.created_at,
        first_lesson_date: firstSlot?.date || null,
        first_lesson_time: firstSlot
          ? `${firstSlot.start_time} - ${firstSlot.end_time}`
          : null,
      };
    });

    return res.json({
      success: true,
      message: "Dashboard stats fetched successfully",
      data: {
        totalBookings,
        totalLearners,
        totalRevenue: totalRevenue || 0,
        activePackages,
        recentBookings,
        recentPayments,
        recentLearners,
      },
    });
  } catch (err) {
    console.error("Dashboard Error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message,
    });
  }
};

module.exports = { dashboardStats };
