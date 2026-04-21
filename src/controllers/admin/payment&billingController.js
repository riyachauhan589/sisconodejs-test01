const { Booking, User, UserPackage, Package, Payment, Transaction, Refund ,Expense } = require("../../models");
const { Op } = require("sequelize");


const payments = async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const { status, start_date, end_date, search } = req.query;

    const whereCondition = {};

    // STATUS FILTER
    if (status) whereCondition.status = status;

    // DATE FILTER
    if (start_date || end_date) {
      whereCondition.created_at = {};
      if (start_date)
        whereCondition.created_at[Op.gte] = `${start_date} 00:00:00`;
      if (end_date)
        whereCondition.created_at[Op.lte] = `${end_date} 23:59:59`;
    }

    if (search) {
      whereCondition[Op.or] = [
        { id: { [Op.like]: `%${search}%` } },
        { uid: { [Op.like]: `%${search}%` } },
        { "$booking.id$": { [Op.like]: `%${search}%` } },
        { "$booking.uid$": { [Op.like]: `%${search}%` } },
        { "$booking.user.first_name$": { [Op.like]: `%${search}%` } },
        { "$booking.user.last_name$": { [Op.like]: `%${search}%` } },
        { "$booking.user.email$": { [Op.like]: `%${search}%` } },
        { "$booking.user.mobile$": { [Op.like]: `%${search}%` } },
      ];
    }

    const { count, rows } = await Payment.findAndCountAll({
      where: whereCondition,
      include: [
        {
          model: Booking,
          as: "booking",
          required: true,
          include: [
            {
              model: User,
              as: "user",
              attributes: ["id", "first_name", "last_name", "email", "mobile"],
            },
            {
              model: Package,
              as: "package",
              attributes: ["name"],
            },
          ],
        },
        {
          model: Transaction,
          as: "transactions",
          required: false,
          attributes: ["gateway_name"],
        },
        {
          model: Refund,
          required: false,
          attributes: ["amount"],
        },
      ],
      order: [["id", "DESC"]],
      limit,
      offset,
      distinct: true,
      subQuery: false,
    });

    const totalPages = Math.ceil(count / limit);

    const data = rows.map((payment) => {
      const user = payment.booking?.user;
      const paymentDate = payment.paid_at || payment.createdAt;

      let finalStatus = payment.status;

      if (payment.Refunds && payment.Refunds.length) {
        const totalRefunded = payment.Refunds.reduce(
          (sum, r) => sum + Number(r.amount || 0),
          0
        );

        if (totalRefunded >= Number(payment.amount)) {
          finalStatus = "refunded";
        } else if (totalRefunded > 0) {
          finalStatus = "partial_refund";
        }
      }

      return {
        payment_id: payment.id,
        payment_uid: payment.uid,
        invoice_number: payment.id,
        booking_id: payment.booking_id,
        learner_id: user.id,
        learner_name: user
          ? `${user.first_name} ${user.last_name}`.trim()
          : "-",
        learner_email: user?.email || "-",
        amount: Number(payment.amount),
        payment_method: payment.method
          ? payment.method.charAt(0).toUpperCase() +
          payment.method.slice(1)
          : "Card",
        status: finalStatus,
        package_name: payment.booking?.package?.name || "-",
        booking_status: payment.booking?.status || "-",
        booking_uid: payment.booking?.uid || "-",
        gateway_name: payment.transactions?.[0]?.gateway_name || "-",
        payment_date: paymentDate
          ? new Date(paymentDate).toLocaleDateString("en-GB")
          : "-",
      };
    });

    return res.json({
      success: true,
      message: "Payments fetched successfully",
      data,
      settings: {
        count,
        page,
        rows_per_page: limit,
        total_pages: totalPages,
        next_page: page < totalPages ? page + 1 : null,
        prev_page: page > 1 ? page - 1 : null,
      },
    });
  } catch (err) {
    console.error("Payments Error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch payments",
      error: err.message,
    });
  }
};

const getPaymentById = async (req, res) => {
  try {
    const { id } = req.params;

    const payment = await Payment.findOne({
      where: { id },
      include: [
        {
          model: Booking,
          as: "booking",
          include: [
            {
              model: User,
              as: "user",
              attributes: ["first_name", "last_name", "email", "mobile"],
            },
            {
              model: Package,
              as: "package",
              attributes: ["name", "type", "price"],
            },
          ],
        },
      ],
    });

    if (!payment) {
      return res.status(404).json({ success: false, message: "Payment not found" });
    }

    const amount = Number(payment.amount);
    const gst = +(amount * 0.1).toFixed(2);

    res.json({
      success: true,
      data: {
        invoice_number: payment.id,
        booking_id: payment.booking_id,
        status: payment.status,
        amount,
        gst,
        payment_method: payment.method || "Card",
        paid_at: payment.paid_at,
        created_at: payment.createdAt,
        learner: {
          name: `${payment.booking.user.first_name} ${payment.booking.user.last_name}`,
          email: payment.booking.user.email,
          mobile: payment.booking.user.mobile,
        },
        booking: {
          booking_date: payment.booking.booking_date,
          start_time: payment.booking.start_time,
          end_time: payment.booking.end_time,
          status: payment.booking.status,
        },
        package: payment.booking.package,
      },
    });
  } catch (err) {
    console.error("Get Payment Error:", err);
    res.status(500).json({ success: false });
  }
};

const paymentStats = async (req, res) => {
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
      let startDate = null;

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
        case "quarterly":
          startDate = new Date(
            now.getFullYear(),
            Math.floor(now.getMonth() / 3) * 3,
            1
          );
          break;
      }

      if (startDate) {
        dateCondition = { [Op.gte]: startDate };
      }
    }

    const paymentWhere = {
      status: { [Op.in]: ["paid", "refunded"] },
    };

    const pendingWhere = { status: "pending" };
    const refundWhere = { status: "processed" };
    const expenseWhere = {};

    if (dateCondition) {
      paymentWhere.created_at = dateCondition;
      pendingWhere.created_at = dateCondition;
      refundWhere.refunded_at = dateCondition;
      expenseWhere.date = dateCondition;
    }

    const [paymentTotal, pendingTotal, refundTotal, expenseTotal] =
      await Promise.all([
        Payment.sum("amount", { where: paymentWhere }),
        Payment.sum("amount", { where: pendingWhere }),
        Refund.sum("amount", { where: refundWhere }),
        Expense.sum("price", { where: expenseWhere }),
      ]);

    const gross = Number(paymentTotal || 0);
    const refunds = Number(refundTotal || 0);
    const expenses = Number(expenseTotal || 0);

    return res.status(200).json({
      success: true,
      message: "Payment statistics fetched successfully",
      filters_applied:
        start_date && end_date
          ? { start_date, end_date }
          : filter
          ? { filter }
          : {},
      data: {
        total_revenue: gross,
        pending_payments: Number(pendingTotal || 0),
        total_refunds: refunds,
        total_expenses: expenses,
        net_revenue: gross - refunds - expenses,
      },
    });

  } catch (error) {
    console.error("Payment Stats Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

module.exports = {
  payments,
  getPaymentById,
  paymentStats
};