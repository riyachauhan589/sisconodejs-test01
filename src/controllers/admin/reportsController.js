const { Op, fn, col, literal } = require("sequelize");
const { Booking, Payment, Package, User, Expense, Refund } = require("../../models");
const moment = require("moment")

const bookingReport = async (req, res) => {
  try {
    const { filter, start_date, end_date } = req.query;

    let dateCondition = null;
    const now = new Date();

    const isValidDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d);

    if (start_date && end_date) {
      if (!isValidDate(start_date) || !isValidDate(end_date)) {
        return res.status(400).json({
          success: false,
          message: "Invalid date format. Use YYYY-MM-DD",
        });
      }

      dateCondition = {
        [Op.between]: [
          new Date(`${start_date} 00:00:00`),
          new Date(`${end_date} 23:59:59`)
        ],
      };
    } else if (filter) {
      let startDate;
      let endDate = new Date();

      switch (filter) {
        case "today":
          startDate = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate()
          );
          break;
        case "weekly":
          startDate = new Date();
          startDate.setDate(now.getDate() - 7);
          break;
        case "monthly":
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
      }

      if (startDate) {
        dateCondition = { [Op.between]: [startDate, endDate] };
      }
    }

    // ✅ Only confirmed + cancelled in total bookings count
    const bookingWhere = {
      status: {
        [Op.in]: ["confirmed", "cancelled"],
      },
    };

    // ✅ Rescheduled counted separately with its own where
    const rescheduledWhere = {
      status: "rescheduled",
    };

    // ✅ Payment date scoped to booking date range (not independent)
    const paymentWhere = { status: "paid" };

    // ✅ Refund date scoped to booking date range (not independent)
    const refundWhere = { status: "processed" };

    if (dateCondition) {
      bookingWhere.created_at = dateCondition;
      rescheduledWhere.created_at = dateCondition;
      paymentWhere.created_at = dateCondition;
      refundWhere.refunded_at = dateCondition;
    }

    // ✅ Stats for confirmed + cancelled only
    const [bookingStats] = await Booking.findAll({
      attributes: [
        [fn("COUNT", col("Booking.id")), "total_bookings"],
        [fn("SUM", literal(`Booking.status = 'confirmed'`)), "confirmed"],
        [fn("SUM", literal(`Booking.status = 'cancelled'`)), "cancelled"],
      ],
      where: bookingWhere,
      raw: true,
    });

    // ✅ Rescheduled count separately
    const rescheduledCount = await Booking.count({
      where: rescheduledWhere,
    });

    const totalRevenue = await Payment.sum("amount", {
      where: paymentWhere,
    });

    const refundAmount = await Refund.sum("amount", {
      where: refundWhere,
    });

    // ✅ Table rows: confirmed + cancelled per date
    const tableRows = await Booking.findAll({
      attributes: [
        [fn("DATE", col("Booking.created_at")), "date"],
        [fn("COUNT", col("Booking.id")), "total"],
        [fn("SUM", literal(`Booking.status = 'confirmed'`)), "confirmed"],
        [fn("SUM", literal(`Booking.status = 'cancelled'`)), "cancelled"],
      ],
      where: bookingWhere,
      group: [fn("DATE", col("Booking.created_at"))],
      order: [[fn("DATE", col("Booking.created_at")), "ASC"]],
      raw: true,
    });

    const table = tableRows.map((r) => ({
      date: r.date,
      total_bookings: Number(r.total),
      completed: Number(r.confirmed),
      cancelled: Number(r.cancelled),
      completion_rate:
        r.total > 0 ? ((r.confirmed / r.total) * 100).toFixed(1) : "0.0",
    }));

    return res.json({
      success: true,
      total_bookings: Number(bookingStats?.total_bookings || 0),
      confirmed: Number(bookingStats?.confirmed || 0),
      cancelled: Number(bookingStats?.cancelled || 0),
      rescheduled_count: Number(rescheduledCount || 0),
      total_revenue: Number(totalRevenue || 0),
      refund_amount: Number(refundAmount || 0),
      table,
    });

  } catch (err) {
    console.error("Booking Report Error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message,
    });
  }
};

const revenueReport = async (req, res) => {
  try {
    const { filter, start_date, end_date } = req.query;

    let dateCondition = null;
    const now = new Date();

    const isValidDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d);

    if (start_date && end_date) {
      if (!isValidDate(start_date) || !isValidDate(end_date)) {
        return res.status(400).json({
          success: false,
          message: "Invalid date format. Use YYYY-MM-DD",
        });
      }

      dateCondition = {
        [Op.between]: [
          new Date(`${start_date} 00:00:00`),
          new Date(`${end_date} 23:59:59`),
        ],
      };
    } else if (filter) {
      let startDate = null;
      let endDate = new Date();

      switch (filter) {
        case "today":
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case "weekly":
          startDate = new Date();
          startDate.setDate(now.getDate() - 7);
          break;
        case "monthly":
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
      }

      if (startDate) {
        dateCondition = { [Op.between]: [startDate, endDate] };
      }
    }

    const paymentWhere = {
      status: { [Op.in]: ["paid", "refunded"] },
    };

    const refundWhere = { status: "processed" };
    const expenseWhere = {};

    if (dateCondition) {
      paymentWhere.created_at = dateCondition;
      refundWhere.refunded_at = dateCondition;
      expenseWhere.date = dateCondition;
    }

    const [paymentStats] = await Payment.findAll({
      attributes: [
        [fn("COUNT", fn("DISTINCT", col("Payment.id"))), "total_payments"],
        [fn("COALESCE", fn("SUM", col("Payment.amount")), 0), "gross_revenue"],
        [fn("SUM", literal(`Payment.status = 'paid'`)), "paid_count"],
      ],
      where: paymentWhere,
      raw: true,
    });

    const [refundStats] = await Refund.findAll({
      attributes: [
        [fn("COUNT", col("Refund.id")), "refunded"],
        [fn("COALESCE", fn("SUM", col("Refund.amount")), 0), "refund_amount"],
      ],
      where: refundWhere,
      raw: true,
    });

    const [expenseStats] = await Expense.findAll({
      attributes: [
        [fn("COALESCE", fn("SUM", col("Expense.price")), 0), "expense_amount"],
      ],
      where: expenseWhere,
      raw: true,
    });

    const tableRevenue = await Payment.findAll({
      attributes: [
        [fn("DATE", col("Payment.created_at")), "date"],
        [fn("COUNT", fn("DISTINCT", col("Payment.id"))), "total"],
        [fn("COALESCE", fn("SUM", col("Payment.amount")), 0), "revenue"],
      ],
      where: paymentWhere,
      group: [literal("DATE(Payment.created_at)")],
      order: [[literal("DATE(Payment.created_at)"), "ASC"]],
      raw: true,
    });

    const tableRefund = await Refund.findAll({
      attributes: [
        [fn("DATE", col("Refund.refunded_at")), "date"],
        [fn("COALESCE", fn("SUM", col("Refund.amount")), 0), "refund"],
      ],
      where: refundWhere,
      group: [literal("DATE(Refund.refunded_at)")],
      raw: true,
    });

    const tableExpense = await Expense.findAll({
      attributes: [
        [fn("DATE", col("Expense.date")), "date"],
        [fn("COALESCE", fn("SUM", col("Expense.price")), 0), "expense"],
      ],
      where: expenseWhere,
      group: [literal("DATE(Expense.date)")],
      raw: true,
    });

    const refundMap = {};
    tableRefund.forEach((r) => {
      refundMap[r.date] = Number(r.refund || 0);
    });

    const expenseMap = {};
    tableExpense.forEach((e) => {
      expenseMap[e.date] = Number(e.expense || 0);
    });

    const table = tableRevenue.map((r) => {
      const revenue = Number(r.revenue || 0);
      const refund = refundMap[r.date] || 0;
      const expense = expenseMap[r.date] || 0;

      return {
        date: r.date,
        total_payments: Number(r.total),
        gross_revenue: revenue,
        refund_amount: refund,
        expense_amount: expense,
        net_revenue: revenue - refund - expense,
      };
    });

    const grossRevenue = Number(paymentStats?.gross_revenue || 0);
    const refundAmount = Number(refundStats?.refund_amount || 0);
    const expenseAmount = Number(expenseStats?.expense_amount || 0);

    return res.json({
      success: true,
      message: "Revenue report fetched successfully",
      total_payments: Number(paymentStats?.total_payments || 0),
      paid: Number(paymentStats?.paid_count || 0),
      refunded: Number(refundStats?.refunded || 0),
      gross_revenue: grossRevenue,
      refund_amount: refundAmount,
      expense_amount: expenseAmount,
      net_revenue: grossRevenue - refundAmount - expenseAmount,
      table,
    });

  } catch (err) {
    console.error("Revenue Report Error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message,
    });
  }
};

const learnerActivityReport = async (req, res) => {
  try {
    const { filter, start_date, end_date } = req.query;

    let dateCondition = null;
    const now = new Date();

    const isValidDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d);

    if (start_date && end_date) {
      if (!isValidDate(start_date) || !isValidDate(end_date)) {
        return res.status(400).json({
          success: false,
          message: "Invalid date format. Use YYYY-MM-DD",
        });
      }

      dateCondition = {
        [Op.between]: [
          new Date(`${start_date} 00:00:00`),
          new Date(`${end_date} 23:59:59`),
        ],
      };
    } else if (filter) {
      let startDate;
      let endDate = new Date();

      switch (filter) {
        case "today":
          startDate = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate()
          );
          break;

        case "weekly":
          startDate = new Date();
          startDate.setDate(now.getDate() - 7);
          break;

        case "monthly":
          startDate = new Date(
            now.getFullYear(),
            now.getMonth(),
            1
          );
          break;
      }

      if (startDate) {
        dateCondition = { [Op.between]: [startDate, endDate] };
      }
    }

    const learners = await User.findAll({
      where: { status: "active" },

      attributes: [
        "id",
        "first_name",
        "last_name",
        "email",
        "created_at",
        [fn("COUNT", fn("DISTINCT", col("bookings.id"))), "total_bookings"],
        [
          fn("COALESCE", fn("SUM", col("bookings->payments.amount")), 0),
          "total_paid",
        ],
        [
          fn("COALESCE", fn("SUM", col("bookings->refunds.amount")), 0),
          "total_refunded",
        ],
      ],

      include: [
        {
          model: Booking,
          as: "bookings",
          attributes: [],
          required: false,
          where: {
            ...(dateCondition ? { created_at: dateCondition } : {}),
            status: { [Op.in]: ["confirmed", "cancelled"] },
          },
          include: [
            {
              model: Payment,
              as: "payments",
              attributes: [],
              required: false,
              where: { status: "paid" },
            },
            {
              model: Refund,
              as: "refunds",
              attributes: [],
              required: false,
            },
          ],
        },
      ],

      group: ["User.id"],
      raw: true,
    });

    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    let newLearners = 0;
    let repeatLearners = 0;
    let totalLessons = 0;
    let activeLearners = 0;
    let grandTotalBookings = 0;
    let grandTotalSpend = 0;

    const table = learners.map((l) => {
      const bookings = Number(l.total_bookings || 0);
      const paid = Number(l.total_paid || 0);
      const refunded = Number(l.total_refunded || 0);
      const spend = paid - refunded;

      if (
        new Date(l.created_at) >= todayStart &&
        new Date(l.created_at) <= todayEnd
      ) {
        newLearners++;
      }

      if (bookings > 1) {
        repeatLearners++;
      }

      if (bookings > 0) {
        activeLearners++;
      }

      totalLessons += bookings;
      grandTotalBookings += bookings;
      grandTotalSpend += spend;

      return {
        learner_name: `${l.first_name} ${l.last_name}`.trim(),
        email: l.email,
        total_bookings: bookings,
        total_spend: spend,
      };
    });

    const avgLessons =
      activeLearners > 0
        ? (totalLessons / activeLearners).toFixed(1)
        : "0.0";

    return res.json({
      success: true,
      stats: {
        new_learners: newLearners,
        repeat_learners: repeatLearners,
        avg_lessons_per_learner: Number(avgLessons),
      },
      totals: {
        total_bookings: grandTotalBookings,
        total_spend: grandTotalSpend,
      },
      table,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message,
    });
  }
};

const packagePerformance = async (req, res) => {
  try {
    const { filter, start_date, end_date } = req.query;

    let dateCondition = null;
    const now = new Date();

    if (start_date && end_date) {
      dateCondition = {
        [Op.between]: [
          new Date(`${start_date} 00:00:00`),
          new Date(`${end_date} 23:59:59`),
        ],
      };
    } else if (filter) {
      let startDate;
      let endDate = new Date();

      switch (filter) {
        case "today":
          startDate = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate()
          );
          break;

        case "weekly":
          startDate = new Date();
          startDate.setDate(now.getDate() - 7);
          break;

        case "monthly":
          startDate = new Date(
            now.getFullYear(),
            now.getMonth(),
            1
          );
          break;
      }

      if (startDate) {
        dateCondition = { [Op.between]: [startDate, endDate] };
      }
    }

    const rows = await Booking.findAll({
      attributes: [
        [col("package.name"), "package_name"],

        [
          fn("COUNT", fn("DISTINCT", col("Booking.id"))),
          "sold",
        ],

        [
          fn("COALESCE", fn("SUM", col("payments.amount")), 0),
          "total_paid",
        ],

        [
          fn("COALESCE", fn("SUM", col("refunds.amount")), 0),
          "total_refunded",
        ],
      ],

      where: {
        ...(dateCondition ? { created_at: dateCondition } : {}),
        status: { [Op.in]: ["confirmed", "cancelled"] },
      },

      include: [
        {
          model: Package,
          as: "package",
          attributes: [],
        },
        {
          model: Payment,
          as: "payments",
          attributes: [],
          required: false,
          where: { status: "paid" },
        },
        {
          model: Refund,
          as: "refunds",
          attributes: [],
          required: false,
        },
      ],

      group: ["package.id"],
      raw: true,
    });

    return res.json({
      success: true,
      data: rows.map((r) => {
        const paid = Number(r.total_paid || 0);
        const refunded = Number(r.total_refunded || 0);

        return {
          package_name: r.package_name,
          sold: Number(r.sold || 0),
          revenue: paid - refunded,
        };
      }),
    });

  } catch (err) {
    console.error("Package Performance Error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message,
    });
  }
};

// const expenseReport = async (req, res) => {
//   try {
//     const { filter, start_date, end_date } = req.query;

//     let dateCondition = null;
//     const now = new Date();

//     if (start_date && end_date) {
//       dateCondition = {
//         [Op.between]: [start_date, end_date],
//       };
//     } else if (filter) {
//       let startDate;
//       let endDate = new Date();

//       switch (filter) {
//         case "today":
//           startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
//           break;
//         case "weekly":
//           startDate = new Date();
//           startDate.setDate(now.getDate() - 7);
//           break;
//         case "monthly":
//           startDate = new Date(now.getFullYear(), now.getMonth(), 1);
//           break;
//       }

//       if (startDate) {
//         dateCondition = { [Op.between]: [startDate, endDate] };
//       }
//     }

//     const where = {};
//     if (dateCondition) where.date = dateCondition;

//     const [summary] = await Expense.findAll({
//       attributes: [
//         [fn("COUNT", col("Expense.id")), "total_expenses"],
//         [fn("SUM", col("Expense.price")), "total_amount"],
//       ],
//       where,
//       raw: true,
//     });

//     const tableRows = await Expense.findAll({
//       attributes: [
//         "date",
//         [fn("COUNT", col("Expense.id")), "total_expenses"],
//         [fn("SUM", col("Expense.price")), "total_amount"],
//       ],
//       where,
//       group: ["date"],
//       order: [["date", "ASC"]],
//       raw: true,
//     });

//     const table = tableRows.map((r) => ({
//       date: r.date,
//       total_expenses: Number(r.total_expenses || 0),
//       total_amount: Number(r.total_amount || 0),
//     }));

//     return res.json({
//       success: true,
//       total_expenses: Number(summary.total_expenses || 0),
//       total_amount: Number(summary.total_amount || 0),
//       table,
//     });
//   } catch (err) {
//     console.error(err);
//     return res.status(500).json({
//       success: false,
//       message: "Server error",
//       error: err.message,
//     });
//   }
// };

const expenseReport = async (req, res) => {
  try {
    const { filter, start_date, end_date } = req.query;

    let dateCondition = null;
    const now = new Date();

    // 🔹 Custom Date Range
    if (start_date && end_date) {
      dateCondition = {
        [Op.between]: [new Date(start_date), new Date(end_date)],
      };
    }

    // 🔹 Filter Based (today / weekly / monthly)
    else if (filter) {
      let startDate;
      let endDate = new Date();

      switch (filter) {
        case "today":
          startDate = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate()
          );
          break;

        case "weekly":
          startDate = new Date();
          startDate.setDate(now.getDate() - 7);
          break;

        case "monthly":
          startDate = new Date(
            now.getFullYear(),
            now.getMonth(),
            1
          );
          break;
      }

      if (startDate) {
        dateCondition = {
          [Op.between]: [startDate, endDate],
        };
      }
    }

    const where = {};
    if (dateCondition) where.date = dateCondition;

    // 🔹 Overall Summary
    const [summary] = await Expense.findAll({
      attributes: [
        [fn("COUNT", col("Expense.id")), "total_expenses"],
        [fn("SUM", col("Expense.price")), "total_amount"],
      ],
      where,
      raw: true,
    });

    // 🔹 Date + Category Wise Table
    const tableRows = await Expense.findAll({
      attributes: [
        "date",
        "category",
        [fn("COUNT", col("Expense.id")), "total_expenses"],
        [fn("SUM", col("Expense.price")), "total_amount"],
      ],
      where,
      group: ["date", "category"],
      order: [["date", "ASC"]],
      raw: true,
    });

    const table = tableRows.map((r) => ({
      date: r.date,
      expense_uid:r.uid,
      category: r.category,
      total_expenses: Number(r.total_expenses || 0),
      total_amount: Number(r.total_amount || 0),
    }));

    return res.json({
      success: true,
      total_expenses: Number(summary?.total_expenses || 0),
      total_amount: Number(summary?.total_amount || 0),
      table,
    });

  } catch (err) {
    console.error("Expense Report Error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message,
    });
  }
};



module.exports = {
  bookingReport, revenueReport, learnerActivityReport, packagePerformance, expenseReport
};
