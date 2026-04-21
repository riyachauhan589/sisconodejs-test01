const sequelize = require("../../models").sequelize;
const {
  Booking,
  Payment,
  Transaction,
  Package,
  AvailabilitySlot,
  Refund,
  User,
  BookingSlot
} = require("../../models");
const axios = require("axios");
const Stripe = require("stripe");
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const {refundProcessedTemplate} = require("../../utils/mailTemplates")
const sendEmail = require("../../../config/mailer")

const PAYPAL_BASE_URL =
  process.env.PAYPAL_MODE === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";


const getPayPalAccessToken = async () => {
  const response = await axios({
    url: `${PAYPAL_BASE_URL}/v1/oauth2/token`,
    method: "post",
    auth: {
      username: process.env.PAYPAL_CLIENT_ID,
      password: process.env.PAYPAL_SECRET,
    },
    params: { grant_type: "client_credentials" },
  });
  return response.data.access_token;
};

const { Op } = require("sequelize");

const fetchallRefundrequests = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const offset = (page - 1) * limit;

    const { search, start_date, end_date, status } = req.query;

    const refundWhere = {};

    if (status && ["initiated", "processed", "failed", "cancelled"].includes(status)) {
      refundWhere.status = status;
    }

    if (search) {
      refundWhere.uid = { [Op.like]: `%${search}%` };
    }

    if (start_date || end_date) {
      refundWhere.created_at = {};
      if (start_date) {
        refundWhere.created_at[Op.gte] = `${start_date} 00:00:00`;
      }
      if (end_date) {
        refundWhere.created_at[Op.lte] = `${end_date} 23:59:59`;
      }
    }

    const userWhere = {};
    if (search) {
      userWhere[Op.or] = [
        { first_name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
      ];
    }

    const { count, rows } = await Refund.findAndCountAll({
      where: refundWhere,
      include: [
        {
          model: Payment,
          as: "payment",
          attributes: ["amount", "currency"],
          include: [
            {
              model: Transaction,
              as: "transactions",
              attributes: ["gateway_name"],
            },
          ],
          required: true,
        },
        {
          model: Booking,
          as: "booking",
          attributes: ["id"],
          required: true,
          include: [
            {
              model: User,
              as: "user",
              attributes: ["first_name", "email"],
              where: Object.keys(userWhere).length ? userWhere : undefined,
              required: true,
            },
            {
              model: Package,
              as: "package",
              attributes: ["name"],
              required: true,
            },
          ],
        },
      ],
      order: [["createdAt", "DESC"]],
      limit,
      offset,
      distinct: true,
    });

    const formatted = rows.map((r) => ({
      id: r.id,
      refund_id: r.uid,
      learner: {
        name: r.booking.user.first_name,
        email: r.booking.user.email,
      },
      package_name: r.booking.package.name,
      amount: Number(r.payment.amount),
      refund_amount: Number(r.amount),
      gateway: r.payment.transactions?.[0]?.gateway_name || "wallet",
      status: r.status,
      request_date: r.createdAt,
    }));

    return res.json({
      success: true,
      data: formatted,
      settings: {
        count,
        page,
        rows_per_page: limit,
        total_pages: Math.ceil(count / limit),
        next_page: page * limit < count ? page + 1 : null,
        prev_page: page > 1 ? page - 1 : null,
      },
    });
  } catch (err) {
    console.error("FETCH_REFUNDS_ADMIN_ERROR:", err);
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

const getRefundById = async (req, res) => {
  try {
    const { refund_id } = req.params;

    const refund = await Refund.findOne({
      where: { id: refund_id }, // numeric ID
      include: [
        {
          model: Payment,
          as: "payment",
          attributes: ["id", "uid", "amount", "currency", "status"],
          include: [
            {
              model: Transaction,
              as: "transactions",
              attributes: ["gateway_name"],
            },
          ],
        },
        {
          model: Booking,
          as: "booking",
          attributes: ["id", "uid", "status"],
          include: [
            {
              model: User,
              as: "user",
              attributes: ["first_name", "email"],
            },
            {
              model: Package,
              as: "package",
              attributes: ["name", "price"],
            },
          ],
        },
      ],
    });

    if (!refund) {
      return res.status(404).json({
        success: false,
        message: "Refund not found",
      });
    }

    // 🔹 formatted response
    const response = {
      refund_id: refund.id,
      refund_uid: refund.uid,
      status: refund.status,
      reason: refund.reason,
      refund_amount: Number(refund.amount),
      requested_at: refund.createdAt,
      refunded_at: refund.refunded_at,

      learner: {
        name: refund.booking?.user?.first_name || "N/A",
        email: refund.booking?.user?.email || "N/A",
      },

      package: {
        name: refund.booking?.package?.name || "N/A",
        price: refund.booking?.package?.price || 0,
      },

      payment: {
        payment_id: refund.payment?.id,
        payment_uid: refund.payment?.uid,
        amount: Number(refund.payment?.amount || 0),
        currency: refund.payment?.currency,
        status: refund.payment?.status,
      },

      gateway:
        refund.payment?.transactions?.[0]?.gateway_name || "wallet",
    };

    return res.json({
      success: true,
      data: response,
    });
  } catch (err) {
    console.error("GET_REFUND_BY_ID_ERROR:", err);
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

const updaterefundrequests = async (req, res) => {
  const dbTx = await sequelize.transaction();
  try {
    const { refund_id, status } = req.body;

    if (!refund_id || !["processed", "cancelled"].includes(status)) {
      await dbTx.rollback();
      return res.status(400).json({
        success: false,
        message: "Invalid refund_id or status",
      });
    }

    const refund = await Refund.findOne({
      where: { id: refund_id },
      include: [
        {
          model: Payment,
          as: "payment",
        },
      ],
      transaction: dbTx,
      lock: dbTx.LOCK.UPDATE,
    });

    if (!refund) {
      await dbTx.rollback();
      return res.status(404).json({
        success: false,
        message: "Refund not found",
      });
    }

    if (refund.status !== "initiated") {
      await dbTx.rollback();
      return res.status(400).json({
        success: false,
        message: "Refund already processed or canceled",
      });
    }

    // 🔹 Update refund status
    refund.status = status;
    refund.refunded_at = status === "processed" ? new Date() : null;
    await refund.save({ transaction: dbTx });

    // 🔹 Only when refund is actually processed
    if (status === "processed") {
      await refund.payment.update(
        {
          status: "refunded",
          refunded_at: new Date(),
        },
        { transaction: dbTx }
      );
    }

    await dbTx.commit();

    return res.json({
      success: true,
      message: `Refund ${status} successfully`,
      data: {
        refund_id: refund.id,
        refund_uid: refund.uid,
        status: refund.status,
        refunded_at: refund.refunded_at,
      },
    });
  } catch (err) {
    await dbTx.rollback();
    console.error("UPDATE_REFUND_ERROR:", err);
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

const refundStripePayment = async (req, res) => {
  const dbTx = await sequelize.transaction();
  let committed = false;

  try {
    const { refund_id } = req.params;
    const { amount } = req.body;

    const refund = await Refund.findOne({
      where: { id: refund_id },
      include: [
        {
          model: Payment,
          as: "payment",
          include: [{ model: Transaction, as: "transactions" }],
        },
        {
          model: Booking,
          as: "booking",
          include: [
            { model: User, as: "user" },
            { model: Package, as: "package" },
          ],
        },
      ],
      transaction: dbTx,
      lock: dbTx.LOCK.UPDATE,
    });

    if (!refund) throw new Error("Refund not found");
    if (refund.status !== "initiated")
      throw new Error("Refund already processed");

    const transaction = refund.payment?.transactions?.[0];

    if (!transaction || !transaction.is_captured)
      throw new Error("Invalid Stripe transaction");

    if (amount && amount > Number(refund.payment.amount))
      throw new Error("Invalid refund amount");

    const stripeRefund = await stripe.refunds.create({
      payment_intent: transaction.gateway_order_id,
      ...(amount && { amount: Math.round(amount * 100) }),
    });

    await transaction.update(
      { status: "refunded", gateway_response: stripeRefund },
      { transaction: dbTx }
    );

    await refund.payment.update(
      { status: "refunded", refunded_at: new Date() },
      { transaction: dbTx }
    );

    await refund.update(
      { status: "processed", refunded_at: new Date() },
      { transaction: dbTx }
    );

    await refund.booking.update(
      { status: "cancelled" },
      { transaction: dbTx }
    );

    const bookingSlots = await BookingSlot.findAll({
      where: { booking_id: refund.booking.id },
      transaction: dbTx,
      lock: dbTx.LOCK.UPDATE,
    });

    for (const slot of bookingSlots) {
      await slot.update(
        { status: "cancelled" },
        { transaction: dbTx }
      );

      const availability = await AvailabilitySlot.findOne({
        where: {
          date: slot.booking_date,
          start_time: slot.start_time,
          end_time: slot.end_time,
        },
        transaction: dbTx,
        lock: dbTx.LOCK.UPDATE,
      });

      if (availability) {
        await availability.update(
          { status: "available" },
          { transaction: dbTx }
        );
      }
    }

    await dbTx.commit();
    committed = true;

    await refund.reload({
      include: [
        {
          model: Payment,
          as: "payment",
        },
        {
          model: Booking,
          as: "booking",
          include: [
            { model: User, as: "user" },
            { model: Package, as: "package" },
          ],
        },
      ],
    });

    try {
      if (refund.booking?.user?.email) {
        await sendEmail(
          refund.booking.user.email,
          "Your Refund Has Been Processed",
          refundProcessedTemplate({
            learner_name: refund.booking.user.first_name,
            refund_uid: refund.uid,
            amount: refund.amount,
            currency: refund.payment.currency,
            reason: refund.reason,
            refunded_at: refund.refunded_at,
            gateway: transaction.gateway_name,
          })
        );
      }
    } catch (mailErr) {
      console.error("REFUND_EMAIL_ERROR:", mailErr);
    }

    return res.json({
      success: true,
      message: "refund sent successfully",
      data: {
        refund_id: refund.id,
        refund_uid: refund.uid,
        status: refund.status,
        reason: refund.reason,
        refund_amount: Number(refund.amount),
        requested_at: refund.createdAt,
        refunded_at: refund.refunded_at,
        learner: {
          name: refund.booking?.user?.first_name || null,
          email: refund.booking?.user?.email || null,
        },
        package: {
          name: refund.booking?.package?.name || null,
          price: refund.booking?.package?.price || null,
        },
        payment: {
          payment_id: refund.payment?.id || null,
          payment_uid: refund.payment?.uid || null,
          amount: Number(refund.payment?.amount || 0),
          currency: refund.payment?.currency || null,
          status: refund.payment?.status || null,
        },
        gateway: transaction.gateway_name,
      },
    });
  } catch (err) {
    if (!committed) {
      await dbTx.rollback();
    }

    console.error("STRIPE_REFUND_ERROR:", err.response?.data || err);

    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

const refundPayPalPayment = async (req, res) => {
  const dbTx = await sequelize.transaction();
  let committed = false;

  try {
    const { refund_id } = req.params;
    const { amount } = req.body;

    if (!refund_id) {
      return res.status(400).json({
        success: false,
        message: "refund_id is required",
      });
    }

    const refund = await Refund.findOne({
      where: { id: refund_id },
      include: [
        {
          model: Payment,
          as: "payment",
          include: [{ model: Transaction, as: "transactions" }],
        },
        {
          model: Booking,
          as: "booking",
          include: [
            { model: User, as: "user" },
            { model: Package, as: "package" },
          ],
        },
      ],
      transaction: dbTx,
      lock: dbTx.LOCK.UPDATE,
    });

    if (!refund) throw new Error("Refund not found");
    if (refund.status !== "initiated")
      throw new Error("Refund already processed");

    const transaction = refund.payment?.transactions?.[0];

    if (!transaction || !transaction.is_captured)
      throw new Error("Invalid PayPal transaction");

    if (amount && amount > Number(refund.payment.amount))
      throw new Error("Invalid refund amount");

    const accessToken = await getPayPalAccessToken();

    const refundRes = await axios.post(
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

    await transaction.update(
      {
        status: "refunded",
        gateway_response: refundRes.data,
      },
      { transaction: dbTx }
    );

    await refund.payment.update(
      {
        status: "refunded",
        refunded_at: new Date(),
      },
      { transaction: dbTx }
    );

    await refund.update(
      {
        status: "processed",
        refunded_at: new Date(),
      },
      { transaction: dbTx }
    );

    await refund.booking.update(
      {
        status: "cancelled",
      },
      { transaction: dbTx }
    );

    const bookingSlots = await BookingSlot.findAll({
      where: { booking_id: refund.booking.id },
      transaction: dbTx,
      lock: dbTx.LOCK.UPDATE,
    });

    for (const slot of bookingSlots) {
      await slot.update(
        { status: "cancelled" },
        { transaction: dbTx }
      );

      const availability = await AvailabilitySlot.findOne({
        where: {
          date: slot.booking_date,
          start_time: slot.start_time,
          end_time: slot.end_time,
        },
        transaction: dbTx,
        lock: dbTx.LOCK.UPDATE,
      });

      if (availability) {
        await availability.update(
          { status: "available" },
          { transaction: dbTx }
        );
      }
    }

    await dbTx.commit();
    committed = true;

    await refund.reload({
      include: [
        {
          model: Payment,
          as: "payment",
        },
        {
          model: Booking,
          as: "booking",
          include: [
            { model: User, as: "user" },
            { model: Package, as: "package" },
          ],
        },
      ],
    });

    try {
      if (refund.booking?.user?.email) {
        await sendEmail(
          refund.booking.user.email,
          "Your Refund Has Been Processed",
          refundProcessedTemplate({
            learner_name: refund.booking.user.first_name,
            refund_uid: refund.uid,
            amount: refund.amount,
            currency: refund.payment.currency,
            reason: refund.reason,
            refunded_at: refund.refunded_at,
            gateway: transaction.gateway_name,
          })
        );
      }
    } catch (mailErr) {
      console.error("REFUND_EMAIL_ERROR:", mailErr);
    }

    return res.json({
      success: true,
      message: "Refund sent successfully",
      data: {
        refund_id: refund.id,
        refund_uid: refund.uid,
        status: refund.status,
        reason: refund.reason,
        refund_amount: Number(refund.amount),
        requested_at: refund.createdAt,
        refunded_at: refund.refunded_at,
        learner: {
          name: refund.booking?.user?.first_name || null,
          email: refund.booking?.user?.email || null,
        },
        package: {
          name: refund.booking?.package?.name || null,
          price: refund.booking?.package?.price || null,
        },
        payment: {
          payment_id: refund.payment?.id || null,
          payment_uid: refund.payment?.uid || null,
          amount: Number(refund.payment?.amount || 0),
          currency: refund.payment?.currency || null,
          status: refund.payment?.status || null,
        },
        gateway: transaction.gateway_name,
        paypal_refund_id: refundRes.data?.id || null,
      },
    });
  } catch (err) {
    if (!committed) {
      await dbTx.rollback();
    }

    console.error("PAYPAL_REFUND_ERROR:", err.response?.data || err);

    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

const AdmincreateRefund = async (req, res) => {
  const dbTx = await sequelize.transaction();
  try {
    const { payment_id, user_id, amount, reason } = req.body;

    if (!payment_id || !user_id || !amount || !reason) {
      await dbTx.rollback();
      return res.status(400).json({
        success: false,
        message: "payment_id, user_id, amount and reason are required",
      });
    }

    const payment = await Payment.findOne({
      where: {
        id: payment_id,
        user_id,
        status: "paid",
      },
      include: [{ model: Booking, as: "booking" }],
      transaction: dbTx,
      lock: dbTx.LOCK.UPDATE,
    });

    if (!payment) {
      await dbTx.rollback();
      return res.status(404).json({
        success: false,
        message: "Payment not found or not eligible",
      });
    }

    const existingRefund = await Refund.findOne({
      where: { payment_id },
      transaction: dbTx,
      lock: dbTx.LOCK.UPDATE,
    });

    if (existingRefund) {
      await dbTx.rollback();
      return res.status(400).json({
        success: false,
        message: "Refund already exists for this payment",
      });
    }

    const maxRefundAmount = Number(payment.amount) * 0.4;

    if (Number(amount) > maxRefundAmount) {
      await dbTx.rollback();
      return res.status(400).json({
        success: false,
        message: `Refund amount cannot exceed 40% (Max allowed: ${maxRefundAmount.toFixed(2)})`,
      });
    }

    const refund = await Refund.create(
      {
        payment_id,
        booking_id: payment.booking_id,
        user_id,
        amount: Number(amount).toFixed(2),
        reason,
        status: "initiated",
        initiated_by: "admin",
      },
      { transaction: dbTx }
    );

    await dbTx.commit();

    return res.status(201).json({
      success: true,
      message: "Refund created successfully",
      data: {
        refund_id: refund.id,
        refund_uid: refund.uid,
        amount: refund.amount,
        status: refund.status,
      },
    });
  } catch (error) {
    if (!dbTx.finished) await dbTx.rollback();
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getUsersForRefundDropdown = async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: ["id", "first_name", "mobile", "email"],
      order: [["id", "DESC"]],
    });

    return res.json({
      success: true,
      data: users.map((u) => ({
        label: `${u.first_name} (${u.mobile})`,
        user_id: u.id,
        first_name: u.first_name,
        mobile: u.mobile,
        email: u.email,
      })),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getPaymentsByUserForRefundDropdown = async (req, res) => {
  try {
    const { user_id } = req.params;

    if (!user_id) {
      return res.status(400).json({
        success: false,
        message: "user_id is required",
      });
    }

    const payments = await Payment.findAll({
      where: {
        user_id,
        status: "paid",
      },
      attributes: ["id", "uid", "amount", "booking_id"],
      include: [
        {
          model: Booking,
          as: "booking",
          // attributes: ["start_time", "end_time"],
        },
      ],
      order: [["id", "DESC"]],
    });

    return res.json({
      success: true,
      data: payments.map((p) => ({
        label: `${p.uid} | Amount: ${p.amount}`,
        payment_id: p.id,
        payment_uid: p.uid,
        booking_id: p.booking_id,
        amount: p.amount,
      })),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const searchUsersForRefund = async (req, res) => {
  try {
    const { search = "" } = req.query;

    const users = await User.findAll({
      where: {
        [Op.or]: [
          { first_name: { [Op.like]: `%${search}%` } },
          { last_name: { [Op.like]: `%${search}%` } },
          { mobile: { [Op.like]: `%${search}%` } },
        ],
        status: "active",
      },
      attributes: ["id", "uid", "first_name", "last_name", "mobile", "email"],
      limit: 20,
      order: [["created_at", "DESC"]],
    });

    return res.status(200).json({
      success: true,
      data: users,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


module.exports = {
  fetchallRefundrequests,
  updaterefundrequests,
  getRefundById,
  refundPayPalPayment,
  refundStripePayment,
  AdmincreateRefund,
  getUsersForRefundDropdown,
  getPaymentsByUserForRefundDropdown,
  searchUsersForRefund
}

