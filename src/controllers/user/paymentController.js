
const axios = require("axios");
const { Op } = require("sequelize");
const {
  Booking,
  Payment,
  Transaction,
  Package,
  AvailabilitySlot,
  Refund, Setting, BookingSlot,
  User,
  sequelize
} = require("../../models");
const sendEmail = require("../../../config/mailer");
const { bookingConfirmationTemplate } = require("../../utils/mailTemplates")

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

const verifyPayPalWebhook = async (req) => {
  const accessToken = await getPayPalAccessToken();

  const headers = req.headers;

  const payload = {
    auth_algo: headers["paypal-auth-algo"],
    cert_url: headers["paypal-cert-url"],
    transmission_id: headers["paypal-transmission-id"],
    transmission_sig: headers["paypal-transmission-sig"],
    transmission_time: headers["paypal-transmission-time"],
    webhook_id: process.env.PAYPAL_WEBHOOK_ID,
    webhook_event: JSON.parse(req.body.toString()),
  };

  const { data } = await axios.post(
    `${PAYPAL_BASE_URL}/v1/notifications/verify-webhook-signature`,
    payload,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    },
  );

  return data.verification_status === "SUCCESS";
};

const getSetting = async (key) => {
  const setting = await Setting.findOne({
    where: {
      key,
      status: "active",
    },
  });

  if (!setting) {
    throw new Error(`Setting "${key}" not found or inactive`);
  }

  return setting.value;
};

const createPayPalOrder = async (req, res) => {
  const dbTx = await sequelize.transaction();

  try {
    const { package_id, slots = [], currency = "AUD" } = req.body;
    const user_id = req.user.id;

    if (!package_id || !Array.isArray(slots) || !slots.length) {
      await dbTx.rollback();
      return res.status(400).json({
        success: false,
        message: "Package and valid slots are required",
      });
    }

    for (const s of slots) {
      if (
        !s.date ||
        !s.start_time ||
        !s.end_time ||
        !s.address
      ) {
        await dbTx.rollback();
        return res.status(400).json({
          success: false,
          message: "Each slot must include date, time and location details",
        });
      }
    }

    const pkg = await Package.findOne({
      where: { id: package_id, status: "active" },
      transaction: dbTx,
      lock: dbTx.LOCK.UPDATE,
    });

    if (!pkg) {
      await dbTx.rollback();
      return res.status(404).json({
        success: false,
        message: "Selected package not found",
      });
    }

    const amount = Number(pkg.price);

    const availabilitySlots = await AvailabilitySlot.findAll({
      where: {
        [Op.or]: slots.map((s) => ({
          date: s.date,
          start_time: s.start_time,
          end_time: s.end_time,
          status: "available",
        })),
      },
      transaction: dbTx,
      lock: dbTx.LOCK.UPDATE,
    });

    if (availabilitySlots.length !== slots.length) {
      await dbTx.rollback();
      return res.status(400).json({
        success: false,
        message: "One or more selected slots are not available",
      });
    }

    const booking = await Booking.create(
      {
        user_id,
        package_id,
        total_hours: slots.length,
        selected_slots: slots,
        status: "payment_pending",
        user_booking_amount: amount,
      },
      { transaction: dbTx }
    );

    const payment = await Payment.create(
      {
        booking_id: booking.id,
        user_id,
        amount,
        currency,
        method: "paypal",
        status: "pending",
      },
      { transaction: dbTx }
    );

    const accessToken = await getPayPalAccessToken();

    const { data: order } = await axios.post(
      `${PAYPAL_BASE_URL}/v2/checkout/orders`,
      {
        intent: "CAPTURE",
        purchase_units: [
          {
            amount: {
              currency_code: currency,
              value: amount.toFixed(2),
            },
          },
        ],
        application_context: {
          brand_name: "TrueWay Driving School",
          user_action: "PAY_NOW",
          shipping_preference: "NO_SHIPPING",
          return_url: `${process.env.FRONTEND_URL}/paypal-success?booking_id=${booking.id}`,
          cancel_url: `${process.env.FRONTEND_URL}/paypal-cancel?booking_id=${booking.id}`,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    const approvalUrl = order.links.find(
      (link) => link.rel === "approve"
    )?.href;

    await Transaction.create(
      {
        payment_id: payment.id,
        amount,
        currency,
        gateway_name: "paypal",
        gateway_order_id: order.id,
        status: "initiated",
        is_captured: false,
        gateway_response: order,
      },
      { transaction: dbTx }
    );

    await dbTx.commit();

    return res.status(200).json({
      success: true,
      booking_id: booking.id,
      order_id: order.id,
      redirect_url: approvalUrl,
    });

  } catch (error) {
    await dbTx.rollback();
    return res.status(500).json({
      success: false,
      message: "Failed to create PayPal order",
    });
  }
};

// const capturePayPalOrder = async (req, res) => {
//   const dbTx = await sequelize.transaction();

//   try {
//     const { order_id } = req.params;

//     const accessToken = await getPayPalAccessToken();

//     const { data: captureData } = await axios.post(
//       `${PAYPAL_BASE_URL}/v2/checkout/orders/${order_id}/capture`,
//       {},
//       { headers: { Authorization: `Bearer ${accessToken}` } }
//     );

//     if (captureData.status !== "COMPLETED") {
//       throw new Error("Payment not completed");
//     }

//     const transaction = await Transaction.findOne({
//       where: { gateway_order_id: order_id },
//       include: [{ model: Payment }],
//       transaction: dbTx,
//       lock: dbTx.LOCK.UPDATE,
//     });

//     if (!transaction) throw new Error("Transaction not found");

//     if (transaction.status === "success") {
//       // await dbTx.commit();
//       return res.status(200).json({
//         success: true,
//         message: "Payment already processed",
//       });
//     }

//     const booking = await Booking.findByPk(
//       transaction.Payment.booking_id,
//       {
//         include: [{ model: User, as: "user" }],
//         transaction: dbTx,
//         lock: dbTx.LOCK.UPDATE,
//       }
//     );

//     if (!booking) throw new Error("Booking not found");

//     let slots = booking.selected_slots;

//     if (typeof slots === "string") {
//       slots = JSON.parse(slots);
//     }

//     const availabilitySlots = await AvailabilitySlot.findAll({
//       where: {
//         [Op.or]: slots.map((s) => ({
//           date: s.date,
//           start_time: s.start_time,
//           end_time: s.end_time,
//         })),
//       },
//       transaction: dbTx,
//       lock: dbTx.LOCK.UPDATE,
//     });

//     if (availabilitySlots.length !== slots.length) {
//       throw new Error("Slot mismatch detected");
//     }

//     for (const slot of availabilitySlots) {
//       if (slot.status !== "available") {
//         throw new Error(
//           `Slot ${slot.date} ${slot.start_time} is no longer available`
//         );
//       }
//     }

//     await BookingSlot.bulkCreate(
//       slots.map((s) => ({
//         booking_id: booking.id,
//         booking_date: s.date,
//         start_time: s.start_time,
//         end_time: s.end_time,
//         status: "booked",
//         address: s.address,
//         latitude: s.latitude || null,
//         longitude: s.longitude || null,
//       })),
//       { transaction: dbTx }
//     );

//     await AvailabilitySlot.update(
//       {
//         status: "booked",
//         booking_id: booking.id,
//         package_id: booking.package_id,
//       },
//       {
//         where: {
//           [Op.or]: slots.map((s) => ({
//             date: s.date,
//             start_time: s.start_time,
//             end_time: s.end_time,
//           })),
//         },
//         transaction: dbTx,
//       }
//     );

//     await booking.update(
//       { status: "confirmed" },
//       { transaction: dbTx }
//     );

//     await transaction.update(
//       {
//         status: "success",
//         is_captured: true,
//         captured_at: new Date(),
//         gateway_response: captureData,
//       },
//       { transaction: dbTx }
//     );

//     await transaction.Payment.update(
//       { status: "paid", paid_at: new Date() },
//       { transaction: dbTx }
//     );

//     // await dbTx.commit();

//     const fullBooking = await Booking.findByPk(booking.id, {
//       include: [
//         { model: User, as: "user" },
//         { model: Package, as: "package" },
//         { model: BookingSlot, as: "slots" },
//       ],
//     });

//     await sendEmail(
//       fullBooking.user.email,
//       "Your Booking is Confirmed 🚗",
//       bookingConfirmationTemplate(fullBooking)
//     );

//     return res.status(200).json({
//       success: true,
//       message: "Payment captured and slot booked successfully",
//     });

//   } catch (error) {
//     await dbTx.rollback();
//     return res.status(500).json({
//       success: false,
//       message: error.message,
//     });
//   }
// };



const capturePayPalOrder = async (req, res) => {
  let dbTx;

  try {
    const { order_id } = req.params;

    const accessToken = await getPayPalAccessToken();

    const { data: captureData } = await axios.post(
      `${PAYPAL_BASE_URL}/v2/checkout/orders/${order_id}/capture`,
      {},
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (captureData.status !== "COMPLETED") {
      return res.status(400).json({
        success: false,
        message: "Payment not completed",
      });
    }

    dbTx = await sequelize.transaction();

    const transaction = await Transaction.findOne({
      where: { gateway_order_id: order_id },
      include: [{ model: Payment }],
      transaction: dbTx,
      lock: dbTx.LOCK.UPDATE,
    });

    if (!transaction) throw new Error("Transaction not found");

    if (transaction.status === "success") {
      await dbTx.commit();
      return res.status(200).json({
        success: true,
        message: "Payment already processed",
      });
    }

    const booking = await Booking.findByPk(
      transaction.Payment.booking_id,
      {
        include: [{ model: User, as: "user" }],
        transaction: dbTx,
        lock: dbTx.LOCK.UPDATE,
      }
    );

    if (!booking) throw new Error("Booking not found");

    let slots = booking.selected_slots;
    if (typeof slots === "string") slots = JSON.parse(slots);

    const availabilitySlots = await AvailabilitySlot.findAll({
      where: {
        [Op.or]: slots.map((s) => ({
          date: s.date,
          start_time: s.start_time,
          end_time: s.end_time,
        })),
      },
      transaction: dbTx,
      lock: dbTx.LOCK.UPDATE,
    });

    if (availabilitySlots.length !== slots.length) {
      throw new Error("Slot mismatch detected");
    }

    for (const slot of availabilitySlots) {
      if (slot.status !== "available") {
        throw new Error(
          `Slot ${slot.date} ${slot.start_time} is no longer available`
        );
      }
    }

    await BookingSlot.bulkCreate(
      slots.map((s) => ({
        booking_id: booking.id,
        booking_date: s.date,
        start_time: s.start_time,
        end_time: s.end_time,
        status: "booked",
        address: s.address,
        latitude: s.latitude || null,
        longitude: s.longitude || null,
      })),
      { transaction: dbTx }
    );

    await AvailabilitySlot.update(
      {
        status: "booked",
        booking_id: booking.id,
        package_id: booking.package_id,
      },
      {
        where: {
          [Op.or]: slots.map((s) => ({
            date: s.date,
            start_time: s.start_time,
            end_time: s.end_time,
          })),
        },
        transaction: dbTx,
      }
    );

    await booking.update({ status: "confirmed" }, { transaction: dbTx });

    await transaction.update(
      {
        status: "success",
        is_captured: true,
        captured_at: new Date(),
        gateway_response: captureData,
        gateway_payment_id:
          captureData.purchase_units[0].payments.captures[0].id,
      },
      { transaction: dbTx }
    );

    await transaction.Payment.update(
      { status: "paid", paid_at: new Date() },
      { transaction: dbTx }
    );

    await dbTx.commit();

    const fullBooking = await Booking.findByPk(booking.id, {
      include: [
        { model: User, as: "user" },
        { model: Package, as: "package" },
        { model: BookingSlot, as: "slots" },
      ],
      order: [[{ model: BookingSlot, as: "slots" }, "booking_date", "ASC"]],
    });

    await sendEmail(
      fullBooking.user.email,
      "Your Booking is Confirmed 🚗",
      bookingConfirmationTemplate(fullBooking)
    );

    return res.status(200).json({
      success: true,
      message: "Payment captured and slot booked successfully",
    });

  } catch (error) {
    if (dbTx && !dbTx.finished) {
      await dbTx.rollback();
    }

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const paypalWebhookHandler = async (req, res) => {
  const dbTx = await sequelize.transaction();

  try {
    const isValid = await verifyPayPalWebhook(req);

    if (!isValid) {
      await dbTx.rollback();
      return res.status(400).json({
        success: false,
        message: "Invalid webhook signature",
      });
    }

    const event = JSON.parse(req.body.toString());

    if (event.event_type !== "PAYMENT.CAPTURE.COMPLETED") {
      await dbTx.commit();
      return res.status(200).json({ success: true });
    }

    const capture = event.resource;
    const captureId = capture.id;
    const orderId =
      capture.supplementary_data?.related_ids?.order_id;

    if (!orderId) {
      throw new Error("Order ID not found in PayPal webhook");
    }

    const transaction = await Transaction.findOne({
      where: { gateway_order_id: orderId },
      include: [{ model: Payment }],
      transaction: dbTx,
      lock: dbTx.LOCK.UPDATE,
    });

    if (!transaction) {
      throw new Error("Transaction not found");
    }

    if (transaction.status === "success") {
      await dbTx.commit();
      return res.status(200).json({ success: true });
    }

    const booking = await Booking.findByPk(
      transaction.Payment.booking_id,
      { transaction: dbTx, lock: dbTx.LOCK.UPDATE }
    );

    if (!booking) {
      throw new Error("Booking not found");
    }

    if (booking.status === "confirmed") {
      await dbTx.commit();
      return res.status(200).json({ success: true });
    }

    let slots = booking.selected_slots;

    if (typeof slots === "string") {
      slots = JSON.parse(slots);
    }

    if (!Array.isArray(slots) || !slots.length) {
      throw new Error("No slots found for booking");
    }

    const availabilitySlots = await AvailabilitySlot.findAll({
      where: {
        [Op.or]: slots.map((s) => ({
          date: s.date,
          start_time: s.start_time,
          end_time: s.end_time,
        })),
      },
      transaction: dbTx,
      lock: dbTx.LOCK.UPDATE,
    });

    if (availabilitySlots.length !== slots.length) {
      throw new Error("Slot mismatch detected");
    }

    for (const slot of availabilitySlots) {
      if (slot.status !== "available") {
        throw new Error(
          `Slot ${slot.date} ${slot.start_time} is no longer available`
        );
      }
    }

    await BookingSlot.bulkCreate(
      slots.map((s) => ({
        booking_id: booking.id,
        booking_date: s.date,
        start_time: s.start_time,
        end_time: s.end_time,
        status: "booked",
        address: s.address,
        latitude: s.latitude || null,
        longitude: s.longitude || null,
      })),
      { transaction: dbTx }
    );

    await AvailabilitySlot.update(
      {
        status: "booked",
        booking_id: booking.id,
        package_id: booking.package_id,
      },
      {
        where: {
          [Op.or]: slots.map((s) => ({
            date: s.date,
            start_time: s.start_time,
            end_time: s.end_time,
          })),
        },
        transaction: dbTx,
      }
    );

    await booking.update(
      { status: "confirmed" },
      { transaction: dbTx }
    );

    await transaction.update(
      {
        gateway_payment_id: captureId,
        status: "success",
        is_captured: true,
        captured_at: new Date(),
        gateway_response: event,
        gateway_signature: req.headers["paypal-transmission-sig"],
      },
      { transaction: dbTx }
    );

    await transaction.Payment.update(
      {
        status: "paid",
        paid_at: new Date(),
      },
      { transaction: dbTx }
    );

    await dbTx.commit();

    return res.status(200).json({
      success: true,
      message: "PayPal payment processed and slots booked successfully",
    });

  } catch (error) {
    await dbTx.rollback();
    console.error("PayPal Webhook Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};



const Stripe = require("stripe");
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const createStripePaymentIntent = async (req, res) => {
  const dbTx = await sequelize.transaction();

  try {
    const { package_id, slots = [], currency = "AUD" } = req.body;
    console.log("payload:", req.body)
    const user_id = req.user.id;

    if (!package_id || !Array.isArray(slots) || !slots.length) {
      await dbTx.rollback();
      return res.status(400).json({
        success: false,
        message: "Package and valid slots are required",
      });
    }

    for (const s of slots) {
      if (
        !s.date ||
        !s.start_time ||
        !s.end_time ||
        !s.address
      ) {
        await dbTx.rollback();
        return res.status(400).json({
          success: false,
          message: "Each slot must include date, time and address",
        });
      }
    }

    const pkg = await Package.findOne({
      where: { id: package_id, status: "active" },
      transaction: dbTx,
      lock: dbTx.LOCK.UPDATE,
    });

    if (!pkg) {
      await dbTx.rollback();
      return res.status(404).json({
        success: false,
        message: "Selected package not found",
      });
    }

    const amount = Number(pkg.price);

    const availabilitySlots = await AvailabilitySlot.findAll({
      where: {
        [Op.or]: slots.map((s) => ({
          date: s.date,
          start_time: s.start_time,
          end_time: s.end_time,
          status: "available",
        })),
      },
      transaction: dbTx,
      lock: dbTx.LOCK.UPDATE,
    });

    if (availabilitySlots.length !== slots.length) {
      await dbTx.rollback();
      return res.status(400).json({
        success: false,
        message: "One or more selected slots are not available",
      });
    }

    const booking = await Booking.create(
      {
        user_id,
        package_id,
        total_hours: slots.length,
        selected_slots: slots,
        status: "payment_pending",
        user_booking_amount: amount,
      },
      { transaction: dbTx }
    );

    const payment = await Payment.create(
      {
        booking_id: booking.id,
        user_id,
        amount,
        currency,
        method: "stripe",
        status: "pending",
      },
      { transaction: dbTx }
    );

    const intent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency,
      automatic_payment_methods: { enabled: true },
      metadata: {
        booking_id: booking.id,
        payment_id: payment.id,
      },
    });

    await Transaction.create(
      {
        payment_id: payment.id,
        amount,
        currency,
        gateway_name: "stripe",
        gateway_order_id: intent.id,
        status: "initiated",
        is_captured: false,
        gateway_response: intent,
      },
      { transaction: dbTx }
    );

    await dbTx.commit();

    return res.status(200).json({
      success: true,
      client_secret: intent.client_secret,
      payment_intent_id: intent.id,
      booking_id: booking.id,
    });

  } catch (error) {
    await dbTx.rollback();
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const confirmStripePayment = async (req, res) => {
  const dbTx = await sequelize.transaction();

  try {
    const { payment_intent_id } = req.params;

    if (!payment_intent_id) {
      await dbTx.rollback();
      return res.status(400).json({
        success: false,
        message: "PaymentIntent ID is required",
      });
    }

    const intent = await stripe.paymentIntents.retrieve(payment_intent_id);

    if (intent.status !== "succeeded") {
      await dbTx.rollback();
      return res.status(400).json({
        success: false,
        message: "Payment not completed",
      });
    }

    const transaction = await Transaction.findOne({
      where: { gateway_order_id: payment_intent_id },
      include: [{ model: Payment }],
      transaction: dbTx,
      lock: dbTx.LOCK.UPDATE,
    });

    if (!transaction) throw new Error("Transaction not found");

    if (transaction.status === "success") {
      await dbTx.commit();
      return res.status(200).json({
        success: true,
        message: "Payment already confirmed",
      });
    }

    const booking = await Booking.findByPk(
      transaction.Payment.booking_id,
      {
        include: [{ model: User, as: "user" }],
        transaction: dbTx,
        lock: dbTx.LOCK.UPDATE,
      }
    );

    if (!booking) throw new Error("Booking not found");

    let slots = booking.selected_slots;
    if (typeof slots === "string") slots = JSON.parse(slots);

    const availabilitySlots = await AvailabilitySlot.findAll({
      where: {
        [Op.or]: slots.map((s) => ({
          date: s.date,
          start_time: s.start_time,
          end_time: s.end_time,
        })),
      },
      transaction: dbTx,
      lock: dbTx.LOCK.UPDATE,
    });

    if (availabilitySlots.length !== slots.length) {
      throw new Error("Slot mismatch detected");
    }

    for (const slot of availabilitySlots) {
      if (slot.status !== "available") {
        throw new Error(
          `Slot ${slot.date} ${slot.start_time} is no longer available`
        );
      }
    }

    await BookingSlot.bulkCreate(
      slots.map((s) => ({
        booking_id: booking.id,
        booking_date: s.date,
        start_time: s.start_time,
        end_time: s.end_time,
        status: "booked",
        address: s.address,
        latitude: s.latitude || null,
        longitude: s.longitude || null,
      })),
      { transaction: dbTx }
    );

    await AvailabilitySlot.update(
      {
        status: "booked",
        booking_id: booking.id,
        package_id: booking.package_id,
      },
      {
        where: {
          [Op.or]: slots.map((s) => ({
            date: s.date,
            start_time: s.start_time,
            end_time: s.end_time,
          })),
        },
        transaction: dbTx,
      }
    );

    await booking.update({ status: "confirmed" }, { transaction: dbTx });

    await transaction.update(
      {
        status: "success",
        is_captured: true,
        captured_at: new Date(),
        gateway_response: intent,
      },
      { transaction: dbTx }
    );

    await transaction.Payment.update(
      { status: "paid", paid_at: new Date() },
      { transaction: dbTx }
    );

    await dbTx.commit();

    const fullBooking = await Booking.findByPk(booking.id, {
      include: [
        { model: User, as: "user" },
        { model: Package, as: "package" },
        { model: BookingSlot, as: "slots" },
      ],
      order: [[{ model: BookingSlot, as: "slots" }, "booking_date", "ASC"]],
    });

    await sendEmail(
      fullBooking.user.email,
      "Your Booking is Confirmed 🚗",
      bookingConfirmationTemplate(fullBooking)
    );

    return res.status(200).json({
      success: true,
      message: "Payment confirmed and slots booked successfully",
    });

  } catch (error) {
    await dbTx.rollback();
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const stripeWebhookHandler = async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    return res.status(400).send("Invalid signature");
  }

  if (event.type !== "payment_intent.succeeded") {
    return res.json({ received: true });
  }

  const dbTx = await sequelize.transaction();

  try {
    const intent = event.data.object;

    const transaction = await Transaction.findOne({
      where: { gateway_order_id: intent.id },
      include: [{ model: Payment }],
      transaction: dbTx,
      lock: dbTx.LOCK.UPDATE,
    });

    if (!transaction || transaction.status === "success") {
      await dbTx.commit();
      return res.json({ received: true });
    }

    const booking = await Booking.findByPk(
      transaction.Payment.booking_id,
      { transaction: dbTx, lock: dbTx.LOCK.UPDATE }
    );

    if (!booking || booking.status === "confirmed") {
      await dbTx.commit();
      return res.json({ received: true });
    }

    let slots = booking.selected_slots;

    if (typeof slots === "string") {
      slots = JSON.parse(slots);
    }

    const availabilitySlots = await AvailabilitySlot.findAll({
      where: {
        [Op.or]: slots.map((s) => ({
          date: s.date,
          start_time: s.start_time,
          end_time: s.end_time,
        })),
      },
      transaction: dbTx,
      lock: dbTx.LOCK.UPDATE,
    });

    for (const slot of availabilitySlots) {
      if (slot.status !== "available") {
        throw new Error(
          `Slot ${slot.date} ${slot.start_time} is no longer available`
        );
      }
    }

    await BookingSlot.bulkCreate(
      slots.map((s) => ({
        booking_id: booking.id,
        booking_date: s.date,
        start_time: s.start_time,
        end_time: s.end_time,
        status: "booked",
        address: s.address,
        latitude: s.latitude || null,
        longitude: s.longitude || null,
      })),
      { transaction: dbTx }
    );

    await AvailabilitySlot.update(
      {
        status: "booked",
        booking_id: booking.id,
        package_id: booking.package_id,
      },
      {
        where: {
          [Op.or]: slots.map((s) => ({
            date: s.date,
            start_time: s.start_time,
            end_time: s.end_time,
          })),
        },
        transaction: dbTx,
      }
    );

    await booking.update(
      { status: "confirmed" },
      { transaction: dbTx }
    );

    await transaction.update(
      {
        status: "success",
        is_captured: true,
        captured_at: new Date(),
        gateway_response: intent,
      },
      { transaction: dbTx }
    );

    await transaction.Payment.update(
      { status: "paid", paid_at: new Date() },
      { transaction: dbTx }
    );

    await dbTx.commit();

    return res.json({
      success: true,
      message: "Stripe payment processed and slots booked successfully",
    });

  } catch (error) {
    await dbTx.rollback();
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const fetchMyPayments = async (req, res) => {
  try {
    const userId = req.user.id;

    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 5;
    const offset = (page - 1) * limit;

    const { count, rows } = await Payment.findAndCountAll({
      where: { user_id: userId },
      attributes: [
        "id",
        "amount",
        "currency",
        "method",
        "status",
        "created_at",
        "uid"
      ],
      include: [
        {
          model: Booking,
          as: "booking",
          attributes: [
            "id",
            "uid",
            "status",
            "total_hours",
            "user_booking_amount",
          ],
          include: [
            {
              model: Package,
              as: "package",
              attributes: ["id", "name", "price"],
            },
            {
              model: BookingSlot,
              as: "slots",
              attributes: [
                "id",
                "booking_date",
                "start_time",
                "end_time",
                "address",
              ],
            },
          ],
        },
      ],
      order: [["id", "DESC"]],
      limit,
      offset,
      distinct: true,
    });

    const totalPages = Math.ceil(count / limit);

    return res.status(200).json({
      success: true,
      data: rows,
      pagination: {
        total_records: count,
        current_page: page,
        per_page: limit,
        total_pages: totalPages,
        next_page: page < totalPages ? page + 1 : null,
        prev_page: page > 1 ? page - 1 : null,
      },
    });

  } catch (error) {
    console.error("Fetch My Payments Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

const fetchMyBookings = async (req, res) => {
  try {
    const userId = req.user.id;

    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 5;
    const offset = (page - 1) * limit;

    const { count, rows } = await Booking.findAndCountAll({
      where: { user_id: userId , status:["confirmed", "cancelled"] },
      attributes: [
        "id",
        "uid",
        "status",
        "created_at",
      ],
      include: [
        {
          model: Package,
          as: "package",
          attributes: ["id", "name", "price", "lessons_count", "lessons_duration"],
        },
        {
          model: Payment,
          as: "payments",
          attributes: [
            "id",
            "amount",
            "currency",
            "method",
            "status",
            "created_at",
          ],
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
          ],
        },
      ],
      order: [["id", "DESC"]],
      limit,
      offset,
      distinct: true,
    });

    const formattedRows = rows.map((booking) => {
      const totalLessons = booking.package?.lessons_count || 0;

      const bookedLessons = booking.slots.filter(
        (slot) =>
          slot.status === "booked" || slot.status === "completed"
      ).length;

      return {
        ...booking.toJSON(),
        total_lessons: totalLessons,
        booked_lessons: bookedLessons,
        remaining_lessons: totalLessons - bookedLessons,
      };
    });

    const totalPages = Math.ceil(count / limit);

    return res.status(200).json({
      success: true,
      data: formattedRows,
      pagination: {
        total_records: count,
        current_page: page,
        per_page: limit,
        total_pages: totalPages,
        next_page: page < totalPages ? page + 1 : null,
        prev_page: page > 1 ? page - 1 : null,
      },
    });

  } catch (error) {
    console.error("Fetch My Bookings Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
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
      attributes: ["id", "name", "type", "price", "lessons_duration", "lessons_count", "validity"],
      order: [["name", "ASC"]],
      limit: 20,
    });

    return res.status(200).json({
      success: true,
      data: packages,
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

const getAvailability = async (req, res) => {
  try {
    const { booking_date } = req.query;

    if (!booking_date) {
      return res.status(400).json({
        success: false,
        message: "booking_date are required",
      });
    }

    const slots = await AvailabilitySlot.findAll({
      where: {
        date: booking_date,
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
      error: error.message
    });
  }
};

const myRefunds = async (req, res) => {
  try {
    const user_id = req.user.id;

    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 5;
    const offset = (page - 1) * limit;

    const { count, rows } = await Refund.findAndCountAll({
      include: [
        {
          model: Payment,
          as: "payment",
          where: { user_id },
          attributes: ["id", "uid", "amount", "currency", "status"],
        },
        {
          model: Booking,
          as: "booking",
          attributes: ["id", "uid", "status"],
          include: [
            {
              model: Package,
              as: "package",
              attributes: ["name", "type", "price"],
            },
          ],
        },
      ],
      order: [["createdAt", "DESC"]],
      limit,
      offset,
      distinct: true,
    });

    const totalPages = Math.ceil(count / limit);

    return res.status(200).json({
      success: true,
      data: rows,
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
    console.error("MY_REFUNDS_ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

const createRequestForRefund = async (req, res) => {
  const dbTx = await sequelize.transaction();

  try {
    const user_id = req.user.id;
    const { payment_id, reason } = req.body;

    if (!payment_id || !reason) {
      await dbTx.rollback();
      return res.status(400).json({
        success: false,
        message: "Payment and reason are required",
      });
    }

    const payment = await Payment.findOne({
      where: {
        id: payment_id,
        user_id,
        status: "paid",
      },
      include: [
        {
          model: Booking,
          as: "booking",
        },
      ],
      transaction: dbTx,
      lock: dbTx.LOCK.UPDATE,
    });

    if (!payment || !payment.booking) {
      await dbTx.rollback();
      return res.status(404).json({
        success: false,
        message: "Payment not found or not eligible for refund",
      });
    }

    // ==============================
    // STRICT 24 HOUR VALIDATION
    // ==============================

    const paymentTimeRaw = payment.paid_at || payment.created_at;

    if (!paymentTimeRaw) {
      await dbTx.rollback();
      return res.status(400).json({
        success: false,
        message: "Payment date not found",
      });
    }

    const paymentTime = new Date(paymentTimeRaw).getTime();
    const nowTime = Date.now();

    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

    // Strict comparison
    if (nowTime > paymentTime + TWENTY_FOUR_HOURS) {
      await dbTx.rollback();
      return res.status(400).json({
        success: false,
        message: "Refund request is allowed only within 24 hours of payment",
      });
    }

    // ==============================
    // CHECK EXISTING REFUND
    // ==============================

    const existingRefund = await Refund.findOne({
      where: { payment_id: payment.id },
      transaction: dbTx,
      lock: dbTx.LOCK.UPDATE,
    });

    if (existingRefund) {
      await dbTx.rollback();
      return res.status(400).json({
        success: false,
        message: "Refund request already exists for this payment",
      });
    }

    const paymentAmount = Number(payment.amount);

    if (Number.isNaN(paymentAmount) || paymentAmount <= 0) {
      await dbTx.rollback();
      return res.status(400).json({
        success: false,
        message: "Invalid payment amount",
      });
    }

    const refundAmount = (paymentAmount * 0.4).toFixed(2);

    const refund = await Refund.create(
      {
        payment_id: payment.id,
        booking_id: payment.booking_id,
        amount: refundAmount,
        reason,
        status: "initiated",
      },
      { transaction: dbTx }
    );

    await dbTx.commit();

    return res.status(201).json({
      success: true,
      message: "Refund request submitted successfully",
      data: {
        refund_id: refund.id,
        refund_uid: refund.uid,
        refund_amount: refund.amount,
        status: refund.status,
      },
    });

  } catch (error) {
    console.error("Refund creation error:", error);

    if (!dbTx.finished) await dbTx.rollback();

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const fetchPaymentDropdownWithPackagePrice = async (req, res) => {
  try {
    const user_id = req.user.id;

    const payments = await Payment.findAll({
      where: {
        user_id,
        status: "paid",
      },
      include: [
        {
          model: Booking,
          as: "booking",
          include: [
            {
              model: Package,
              as: "package",
              attributes: ["name", "price"],
            },
          ],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    const dropdownData = payments.map((p) => ({
      payment_id: p.id,
      payment_uid: p.uid,
      label: `${p.uid} - ${p.booking.package.name} ($${p.amount})`,
      amount: Number(p.amount),
    }));

    return res.status(200).json({
      success: true,
      data: dropdownData,
    });
  } catch (error) {
    console.error("Fetch payment dropdown error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

const editMyBooking = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const user_id = req.user.id;
    const { booking_id, slot_id, booking_date, start_time, end_time } = req.body;

    if (!booking_id || !slot_id || !booking_date || !start_time || !end_time) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "booking_id, slot_id, booking_date, start_time and end_time are required",
      });
    }

    const booking = await Booking.findOne({
      where: { id: booking_id, user_id },
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

    if (booking.status !== "confirmed") {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Only confirmed bookings can be edited",
      });
    }

    const now = new Date();
    const createdAt = new Date(booking.createdAt);
    const diffHours = (now - createdAt) / (1000 * 60 * 60);

    if (diffHours > 24) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Booking can only be edited within 24 hours of creation",
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (new Date(booking_date) < today) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Cannot reschedule to past date",
      });
    }

    const existingBookingSlot = await BookingSlot.findOne({
      where: { id: slot_id, booking_id: booking.id },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!existingBookingSlot) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: "Booking slot not found",
      });
    }

    const newAvailabilitySlot = await AvailabilitySlot.findOne({
      where: {
        date: booking_date,
        start_time,
        end_time,
        status: "available",
        package_id: booking.package_id,
      },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!newAvailabilitySlot) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Selected slot is not available",
      });
    }

    await AvailabilitySlot.update(
      { status: "available", booking_id: null },
      {
        where: {
          date: existingBookingSlot.booking_date,
          start_time: existingBookingSlot.start_time,
          end_time: existingBookingSlot.end_time,
          booking_id: booking.id,
        },
        transaction: t,
      }
    );

    await newAvailabilitySlot.update(
      { status: "booked", booking_id: booking.id },
      { transaction: t }
    );

    await existingBookingSlot.update(
      {
        booking_date,
        start_time,
        end_time,
      },
      { transaction: t }
    );

    await t.commit();

    return res.status(200).json({
      success: true,
      message: "Booking rescheduled successfully",
      data: {
        booking_id: booking.id,
        slot_id: existingBookingSlot.id,
        booking_date: existingBookingSlot.booking_date,
        start_time: existingBookingSlot.start_time,
        end_time: existingBookingSlot.end_time,
      },
    });

  } catch (error) {
    if (!t.finished) await t.rollback();

    console.error("Edit Booking Error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

const bookLessonForPackage = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const { booking_id, slots = [] } = req.body;
    const user_id = req.user.id;

    if (!booking_id || !Array.isArray(slots) || !slots.length) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Booking ID and valid slots array are required",
      });
    }

    for (const s of slots) {
      if (!s.date || !s.start_time || !s.end_time || !s.address) {
        await t.rollback();
        return res.status(400).json({
          success: false,
          message: "Each slot must include date, start_time, end_time and address",
        });
      }
    }

    const booking = await Booking.findOne({
      where: { id: booking_id, user_id },
      include: [{ model: Package, as: "package" }],
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

    if (booking.status !== "confirmed") {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Booking is not confirmed",
      });
    }

    const totalLessons = booking.package?.lessons_count || 0;

    const alreadyBookedCount = await BookingSlot.count({
      where: {
        booking_id,
        status: { [Op.in]: ["booked", "completed"] },
      },
      transaction: t,
    });

    const remainingSlots = totalLessons - alreadyBookedCount;

    if (remainingSlots <= 0) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "All package lessons already booked",
      });
    }

    if (slots.length > remainingSlots) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: `You can only book ${remainingSlots} more lesson(s)`,
      });
    }

    for (const s of slots) {
      const availability = await AvailabilitySlot.findOne({
        where: {
          date: s.date,
          start_time: s.start_time,
          end_time: s.end_time,
          status: "available",
        },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      if (!availability) {
        await t.rollback();
        return res.status(400).json({
          success: false,
          message: `Slot ${s.date} ${s.start_time} is not available`,
        });
      }

      const duplicate = await BookingSlot.findOne({
        where: {
          booking_id,
          booking_date: s.date,
          start_time: s.start_time,
          end_time: s.end_time,
          status: { [Op.in]: ["booked", "completed"] },
        },
        transaction: t,
      });

      if (duplicate) {
        await t.rollback();
        return res.status(400).json({
          success: false,
          message: `Lesson already booked for ${s.date} ${s.start_time}`,
        });
      }
    }

    await BookingSlot.bulkCreate(
      slots.map((s) => ({
        booking_id,
        booking_date: s.date,
        start_time: s.start_time,
        end_time: s.end_time,
        status: "booked",
        address: s.address,
        latitude: s.latitude || null,
        longitude: s.longitude || null,
      })),
      { transaction: t }
    );

    await AvailabilitySlot.update(
      {
        status: "booked",
        booking_id,
      },
      {
        where: {
          [Op.or]: slots.map((s) => ({
            date: s.date,
            start_time: s.start_time,
            end_time: s.end_time,
          })),
        },
        transaction: t,
      }
    );

    await t.commit();

    return res.status(200).json({
      success: true,
      message: "Lesson(s) booked successfully",
      remaining_lessons: remainingSlots - slots.length,
    });

  } catch (error) {
    await t.rollback();
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


// const getBookingDetails = async (req, res) => {
//   try {
//     const user_id = req.user.id;

//     const lessons = await BookingSlot.findAll({
//       include: [
//         {
//           model: Booking,
//           as: "booking",
//           where: {
//             user_id,
//             status: "confirmed",
//           },
//           attributes: ["id", "uid", "total_hours"],
//           include: [
//             {
//               model: Package,
//               as: "package",
//               attributes: ["id", "name"],
//             },
//           ],
//         },
//       ],
//       attributes: [
//         "id",
//         "booking_date",
//         "start_time",
//         "end_time",
//         "status",
//         "address",
//         "latitude",
//         "longitude",
//       ],
//       order: [
//         ["booking_date", "ASC"],
//         ["start_time", "ASC"],
//       ],
//     });

//     if (!lessons.length) {
//       return res.status(200).json({
//         success: true,
//         message: "No lessons found",
//         data: [],
//       });
//     }

//     const formatted = lessons.map((lesson) => ({
//       lesson_id: lesson.id,
//       lesson_date: lesson.booking_date,
//       start_time: lesson.start_time,
//       end_time: lesson.end_time,
//       status: lesson.status,
//       address: lesson.address,
//       latitude: lesson.latitude,
//       longitude: lesson.longitude,

//       booking_id: lesson.booking.id,
//       booking_uid: lesson.booking.uid,
//       total_lessons: lesson.booking.total_hours,

//       package_id: lesson.booking.package?.id || null,
//       package_name: lesson.booking.package?.name || null,
//     }));

//     return res.status(200).json({
//       success: true,
//       data: formatted,
//     });

//   } catch (error) {
//     console.error("getBookingDetails error:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Failed to fetch booking details",
//     });
//   }
// };



const getBookingDetails = async (req, res) => {
  try {
    const user_id = req.user.id;
    const { booking_id, page = 1, limit = 5 } = req.query;

    const currentPage = parseInt(page, 10);
    const perPage = parseInt(limit, 10);
    const offset = (currentPage - 1) * perPage;

    // 1️⃣ Build booking filter
    const bookingWhere = {
      user_id,
      status: "confirmed",
    };

    if (booking_id) {
      bookingWhere.id = booking_id;
    }

    // 2️⃣ Fetch bookings
    const bookings = await Booking.findAll({
      where: bookingWhere,
      attributes: ["id", "uid", "total_hours"],
      include: [
        {
          model: Package,
          as: "package",
          attributes: ["id", "name"],
        },
      ],
    });

    if (!bookings.length) {
      return res.status(200).json({
        success: true,
        message: "No lessons found",
        data: [],
      });
    }

    const bookingIds = bookings.map((b) => b.id);

    // 3️⃣ Fetch lessons with pagination
    const { count, rows: lessons } = await BookingSlot.findAndCountAll({
      where: {
        booking_id: {
          [Op.in]: bookingIds,
        },
      },
      attributes: [
        "id",
        "booking_id",
        "booking_date",
        "start_time",
        "end_time",
        "status",
        "address",
        "latitude",
        "longitude",
      ],
      order: [
        ["booking_date", "ASC"],
        ["start_time", "ASC"],
      ],
      limit: perPage,
      offset,
    });

    // Map bookings for lookup
    const bookingMap = {};
    bookings.forEach((b) => {
      bookingMap[b.id] = b;
    });

    const formatted = lessons.map((lesson) => {
      const booking = bookingMap[lesson.booking_id];

      return {
        lesson_id: lesson.id,
        lesson_date: lesson.booking_date,
        start_time: lesson.start_time,
        end_time: lesson.end_time,
        status: lesson.status,
        address: lesson.address,
        latitude: lesson.latitude,
        longitude: lesson.longitude,

        booking_id: booking?.id || null,
        booking_uid: booking?.uid || null,
        total_lessons: booking?.total_hours || null,

        package_id: booking?.package?.id || null,
        package_name: booking?.package?.name || null,
      };
    });

    const totalPages = Math.ceil(count / perPage);

    return res.status(200).json({
      success: true,
      settings: {
        total_records: count,
        page: currentPage,
        rows_per_page: perPage,
        total_pages: totalPages,
        next_page: currentPage < totalPages ? currentPage + 1 : null,
        prev_page: currentPage > 1 ? currentPage - 1 : null,
      },
      data: formatted,
    });

  } catch (error) {
    console.error("getBookingDetails error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch booking details",
    });
  }
};


const getBookingDropdown = async (req, res) => {
  try {
    const bookings = await Booking.findAll({
      where: {
        user_id: req.user.id,
        status: "confirmed",
      },
      include: [
        {
          model: Package,
          as: "package",
          attributes: ["name"],
          required: false,
        },
      ],
      attributes: ["id", "uid", "package_id"],
      order: [["created_at", "DESC"]],
    });

    return res.status(200).json({
      success: true,
      data: bookings.map((b) => ({
        booking_id: b.id,
        package_id: b.package_id,
        label: `${b.uid} - ${b.package?.name || "Package"}`,
      })),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch booking dropdown",
    });
  }
};


// const updateBookingSlot = async (req, res) => {
//   const dbTx = await sequelize.transaction();

//   try {
//     const { booking_id, slot_id } = req.params;
//     const { booking_date, start_time, end_time } = req.body;

//     if (!booking_date || !start_time || !end_time) {
//       return res.status(400).json({
//         success: false,
//         message: "booking_date, start_time and end_time are required",
//       });
//     }

//     // 1️⃣ Find slot with lock
//     const slot = await BookingSlot.findOne({
//       where: {
//         id: slot_id,
//         booking_id: booking_id,
//       },
//       include: [
//         {
//           model: Booking,
//           as: "booking",
//           where: { user_id: req.user.id },
//         },
//       ],
//       transaction: dbTx,
//       lock: dbTx.LOCK.UPDATE,
//     });

//     if (!slot) {
//       throw new Error("Booking slot not found");
//     }

//     if (slot.status !== "booked") {
//       throw new Error("Only booked slots can be modified");
//     }

//     // 2️⃣ Check 24 hour restriction
//     const slotDateTime = new Date(
//       `${slot.booking_date}T${slot.start_time}`
//     );

//     const now = new Date();
//     const diffInMs = slotDateTime - now;
//     const diffInHours = diffInMs / (1000 * 60 * 60);

//     if (diffInHours <= 24) {
//       throw new Error(
//         "Slot cannot be modified within 24 hours of start time"
//       );
//     }

//     // 3️⃣ Check new availability slot exists
//     const newAvailability = await AvailabilitySlot.findOne({
//       where: {
//         date: booking_date,
//         start_time,
//         end_time,
//         status: "available",
//       },
//       transaction: dbTx,
//       lock: dbTx.LOCK.UPDATE,
//     });

//     if (!newAvailability) {
//       throw new Error("Selected new slot is not available");
//     }

//     // 4️⃣ Free old availability slot
//     await AvailabilitySlot.update(
//       {
//         status: "available",
//         booking_id: null,
//         package_id: null,
//       },
//       {
//         where: {
//           date: slot.booking_date,
//           start_time: slot.start_time,
//           end_time: slot.end_time,
//         },
//         transaction: dbTx,
//       }
//     );

//     // 5️⃣ Book new availability slot
//     await newAvailability.update(
//       {
//         status: "booked",
//         booking_id: booking_id,
//         package_id: slot.booking.package_id,
//       },
//       { transaction: dbTx }
//     );

//     // 6️⃣ Update booking slot
//     await slot.update(
//       {
//         booking_date,
//         start_time,
//         end_time,
//       },
//       { transaction: dbTx }
//     );

//     await dbTx.commit();

//     return res.status(200).json({
//       success: true,
//       message: "Booking slot updated successfully",
//     });

//   } catch (error) {
//     if (!dbTx.finished) {
//       await dbTx.rollback();
//     }

//     return res.status(400).json({
//       success: false,
//       message: error.message,
//     });
//   }
// };

const updateBookingSlot = async (req, res) => {
  const dbTx = await sequelize.transaction();

  try {
    const { booking_id, slot_id } = req.params;
    const { booking_date, start_time, end_time } = req.body;

    if (!booking_date || !start_time || !end_time) {
      return res.status(400).json({
        success: false,
        message: "booking_date, start_time and end_time are required",
      });
    }

    const slot = await BookingSlot.findOne({
      where: {
        id: slot_id,
        booking_id: booking_id,
      },
      include: [
        {
          model: Booking,
          as: "booking",
          where: { user_id: req.user.id },
        },
      ],
      transaction: dbTx,
      lock: dbTx.LOCK.UPDATE,
    });

    if (!slot) {
      throw new Error("Booking slot not found");
    }

    if (slot.status !== "booked") {
      throw new Error("Only booked slots can be modified");
    }

    // Max 2 slots per user per day validation
    const existingSlotsCount = await BookingSlot.count({
      include: [
        {
          model: Booking,
          as: "booking",
          where: { user_id: req.user.id },
        },
      ],
      where: {
        booking_date: booking_date,
        status: "booked",
        id: { [Op.ne]: slot.id },
      },
      transaction: dbTx,
    });

    if (existingSlotsCount >= 2) {
      throw new Error("You can only book maximum 2 slots per day");
    }

    const slotDateTime = new Date(
      `${slot.booking_date}T${slot.start_time}`
    );

    const nowTime = Date.now();
    const slotStartTime = new Date(slotDateTime).getTime();
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

    if (slotStartTime - nowTime <= TWENTY_FOUR_HOURS) {
      throw new Error(
        "Slot cannot be modified within 24 hours of start time"
      );
    }

    const newAvailability = await AvailabilitySlot.findOne({
      where: {
        date: booking_date,
        start_time,
        end_time,
        status: "available",
      },
      transaction: dbTx,
      lock: dbTx.LOCK.UPDATE,
    });

    if (!newAvailability) {
      throw new Error("Selected new slot is not available");
    }

    await AvailabilitySlot.update(
      {
        status: "available",
        booking_id: null,
        package_id: null,
      },
      {
        where: {
          date: slot.booking_date,
          start_time: slot.start_time,
          end_time: slot.end_time,
        },
        transaction: dbTx,
      }
    );

    await newAvailability.update(
      {
        status: "booked",
        booking_id: booking_id,
        package_id: slot.booking.package_id,
      },
      { transaction: dbTx }
    );

    await slot.update(
      {
        booking_date,
        start_time,
        end_time,
      },
      { transaction: dbTx }
    );

    await dbTx.commit();

    return res.status(200).json({
      success: true,
      message: "Booking slot updated successfully",
    });

  } catch (error) {
    if (!dbTx.finished) {
      await dbTx.rollback();
    }

    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};


module.exports = {
  capturePayPalOrder,
  createPayPalOrder,
  fetchMyPayments,
  paypalWebhookHandler,
  createStripePaymentIntent,
  stripeWebhookHandler,
  fetchMyBookings,
  getPackagesDropdown,
  getAvailability,
  confirmStripePayment,
  myRefunds,
  createRequestForRefund,
  fetchPaymentDropdownWithPackagePrice,
  editMyBooking,
  bookLessonForPackage,
  getBookingDetails,
  getBookingDropdown,
  updateBookingSlot,
};
