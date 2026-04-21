const { UserPackage, Package } = require("../../models");

const purchasePackage = async (req, res) => {
  try {
    const userId = req.user.id;
    const { package_id } = req.body;

    if (!package_id) {
      return res.status(400).json({
        success: false,
        message: "Package ID is required",
      });
    }

    const pkg = await Package.findByPk(package_id);
    if (!pkg || pkg.status !== "active") {
      return res.status(404).json({
        success: false,
        message: "Invalid package",
      });
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + pkg.validity);

    const userPackage = await UserPackage.create({
      user_id: userId,
      package_id: pkg.id,
      price: pkg.price,
      total_credits: pkg.lessons_count || 1,
      remaining_credits: pkg.lessons_count || 1,
      expires_at: expiresAt,
      status: "active",
    });

    return res.status(201).json({
      success: true,
      message: "Package assigned to user",
      data: userPackage,
    });
  } catch (err) {
    console.error("User Package Error:", err);

    return res.status(500).json({
      success: false,
      message: err.message || "Server error",
    });
  }
};

const getPackages = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const offset = (page - 1) * limit;

    const { type } = req.query;

    const where = { status: "active" };
    if (type) where.type = type;

    const { rows, count } = await Package.findAndCountAll({
      where,
      order: [["id", "DESC"]],
      limit,
      offset,
    });

    const totalPages = Math.ceil(count / limit);

    return res.status(200).json({
      success: true,
      message: "Packages fetched successfully",
      settings: {
        count,
        page,
        rows_per_page: limit,
        total_pages: totalPages,
        next_page: page < totalPages ? page + 1 : null,
        prev_page: page > 1 ? page - 1 : null,
      },
      data: rows,
    });
  } catch (error) {
    next(error);
  }
};

// const createPayPalOrder = async (req, res) => {
//   const dbTx = await sequelize.transaction();

//   try {
//     const isSandbox = process.env.PAYPAL_MODE !== "live";

//     const {
//       package_id,
//       booking_date,
//       start_time,
//       end_time,
//       amount,
//       currency = isSandbox ? "USD" : "AUD",
//     } = req.body;

//     const user_id = req.user.id;

//     //  BASIC VALIDATION
//     if (!package_id || !booking_date || !start_time || !end_time || !amount) {
//       if (!dbTx.finished) await dbTx.rollback();
//       return res.status(400).json({
//         success: false,
//         message: "Invalid payload",
//       });
//     }

//     const parsedAmount = Number(amount);
//     if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
//       if (!dbTx.finished) await dbTx.rollback();
//       return res.status(400).json({
//         success: false,
//         message: "Invalid amount",
//       });
//     }
//     const checkpackage = await Package.findByPk(package_id);
//     if (!checkpackage) {
//       if (!dbTx.finished) await dbTx.rollback();
//       return res.status(404).json({
//         success: false,
//         message: "Package not found",
//       });
//     }
//     const packageprice = Number(checkpackage.price);

//     const conflict = await Booking.findOne({
//       where: {
//         booking_date,
//         start_time,
//         end_time,
//         user_package_id: package_id,
//         user_booking_amount: packageprice,
//         status: "confirmed",
//       },
//       transaction: dbTx,
//       lock: dbTx.LOCK.UPDATE,
//     });

//     if (conflict) {
//       if (!dbTx.finished) await dbTx.rollback();
//       return res.status(409).json({
//         success: false,
//         message: "Slot already booked",
//       });
//     }

//     // CREATE BOOKING (payment_pending)
//     const booking = await Booking.create(
//       {
//         user_id,
//         package_id,
//         booking_date,
//         start_time,
//         end_time,
//         user_package_id: package_id,
//         user_booking_amount: packageprice,
//         status: "payment_pending",
//       },
//       { transaction: dbTx },
//     );

//     //  CREATE PAYMENT
//     const payment = await Payment.create(
//       {
//         booking_id: booking.id,
//         user_id,
//         amount: parsedAmount,
//         currency,
//         method: "wallet",
//         status: "pending",
//       },
//       { transaction: dbTx },
//     );

//     // PAYPAL ACCESS TOKEN
//     const accessToken = await getPayPalAccessToken();

//     // CREATE PAYPAL ORDER
//     // const { data: order } = await axios.post(
//     //   `${PAYPAL_BASE_URL}/v2/checkout/orders`,
//     //   {
//     //     intent: "CAPTURE",
//     //     purchase_units: [
//     //       {
//     //         amount: {
//     //           currency_code: currency,
//     //           value: parsedAmount.toFixed(2),
//     //         },
//     //       },
//     //     ],
//     //   },
//     //   {
//     //     headers: {
//     //       Authorization: `Bearer ${accessToken}`,
//     //       "Content-Type": "application/json",
//     //     },
//     //   },
//     // );
//     if (!process.env.FRONTEND_URL) {
//       throw new Error("FRONTEND_URL is not defined in environment variables");
//     }
//     const { data: order } = await axios.post(
//       `${PAYPAL_BASE_URL}/v2/checkout/orders`,
//       {
//         intent: "CAPTURE",
//         purchase_units: [
//           {
//             amount: {
//               currency_code: currency,
//               value: parsedAmount.toFixed(2),
//             },
//           },
//         ],
//         application_context: {
//           brand_name: "TrueWay Driving School",
//           user_action: "PAY_NOW",
//           shipping_preference: "NO_SHIPPING",
//           return_url: `${process.env.FRONTEND_URL}/paypal-success`,
//           cancel_url: `${process.env.FRONTEND_URL}/paypal-cancel`,
//         },
//       },
//       {
//         headers: {
//           Authorization: `Bearer ${accessToken}`,
//           "Content-Type": "application/json",
//         },
//       },
//     );

//     const approvalUrl = order.links.find(
//       (link) => link.rel === "approve",
//     )?.href;

//     if (!approvalUrl) {
//       throw new Error("PayPal approval URL not found");
//     }

//     // CREATE TRANSACTION
//     await Transaction.create(
//       {
//         payment_id: payment.id,
//         amount: parsedAmount,
//         currency,
//         gateway_name: "paypal",
//         gateway_order_id: order.id,
//         status: "initiated",
//         is_captured: false,
//         gateway_response: order,
//       },
//       { transaction: dbTx },
//     );

//     //  COMMIT ONLY AFTER EVERYTHING SUCCEEDS
//     await dbTx.commit();

//     // FINAL RESPONSE (FRONTEND FRIENDLY)
//     return res.status(200).json({
//       redirectURL: approvalUrl,
//       successAction: "EXT_REDIRECT",
//       pageAttributes: {
//         paypalEnvironmentName:
//           process.env.PAYPAL_MODE === "live" ? "production" : "sandbox",
//         amount: parsedAmount.toFixed(2),
//         orderId: order.id,
//         currency,
//         receipt: payment.id.toString(),
//         callbackUrl: `${process.env.FRONTEND_URL}/payment/paypal/callback`,
//       },
//       paymentProvider: "PAYPAL2",
//     });
//   } catch (error) {
//     // SAFE ROLLBACK (NO DOUBLE ROLLBACK CRASH)
//     if (!dbTx.finished) {
//       await dbTx.rollback();
//     }

//     console.error("Create PayPal Order Error:", error);

//     return res.status(500).json({
//       success: false,
//       message: error.message,
//     });
//   }
// };


// const capturePayPalOrder = async (req, res) => {
//   const dbTransaction = await sequelize.transaction();

//   try {
//     const { order_id } = req.params;

//     const accessToken = await getPayPalAccessToken();

//     // Capture payment from PayPal
//     const captureResponse = await axios.post(
//       `${PAYPAL_BASE_URL}/v2/checkout/orders/${order_id}/capture`,
//       {},
//       {
//         headers: {
//           Authorization: `Bearer ${accessToken}`,
//         },
//       },
//     );

//     const captureData = captureResponse.data;

//     if (captureData.status !== "COMPLETED") {
//       throw new Error("Payment not completed");
//     }

//     // Fetch transaction
//     const transaction = await Transaction.findOne({
//       where: { gateway_order_id: order_id },
//       include: [{ model: Payment }],
//       transaction: dbTransaction,
//       lock: true,
//     });

//     if (!transaction) {
//       throw new Error("Transaction not found");
//     }

//     //Update Transaction
//     transaction.gateway_payment_id =
//       captureData.purchase_units[0].payments.captures[0].id;

//     transaction.status = "success";
//     transaction.is_captured = true;
//     transaction.captured_at = new Date();
//     transaction.gateway_response = captureData;

//     await transaction.save({ transaction: dbTransaction });

//     // Update Payment
//     await transaction.Payment.update(
//       {
//         status: "paid",
//         paid_at: new Date(),
//       },
//       { transaction: dbTransaction },
//     );
//     await Booking.update(
//       { status: "confirmed" },
//       {
//         where: { id: transaction.Payment.booking_id },
//         transaction: dbTransaction,
//       }
//     );

//     const booking = await Booking.findOne({
//       where: { id: transaction.Payment.booking_id },
//       transaction: dbTransaction,
//     });

//     await AvailabilitySlot.update(
//       { status: "booked", booking_id: transaction.Payment.booking_id },

//       {
//         where: {
//           date: booking.booking_date,
//           start_time: booking.start_time,
//           end_time: booking.end_time,
//         },
//         transaction: dbTransaction,
//       }
//     );


//     await dbTransaction.commit();

//     return res.status(200).json({
//       success: true,
//       message: "Payment captured successfully",
//     });
//   } catch (error) {
//     await dbTransaction.rollback();

//     console.error(
//       "Capture PayPal Payment Error:",
//       error.response?.data || error,
//     );
//     return res.status(500).json({
//       success: false,
//       message: "Payment capture failed",
//       error: error.message,
//     });
//   }
// };

// const paypalWebhookHandler = async (req, res) => {
//   const dbTx = await sequelize.transaction();
//   console.log("PayPal Webhook Received");

//   try {
//     const isValid = await verifyPayPalWebhook(req);
//     console.log("PayPal Webhook Received");

//     if (!isValid) {
//       return res
//         .status(400)
//         .json({ success: false, message: "Invalid webhook" });
//     }

//     const event = JSON.parse(req.body.toString());
//     console.log("evnent  type", event.event_type);

//     //CAPTURE COMPLETED
//     if (event.event_type === "CHECKOUT.ORDER.APPROVED") {
//       console.log("Processing CHECKOUT.ORDER.APPROVED webhook");
//       const capture = event.resource;
//       console.log(" capture", capture);
//       // console.log(" capture.supplementary_data", capture.supplementary_data);
//       // console.log("capture.supplementary_data.related_ids", capture.supplementary_data.related_ids);
//       // const orderId = capture.supplementary_data.related_ids.order_id;
//       const captureId = capture.id;

//       const transaction = await Transaction.findOne({
//         where: { gateway_order_id: captureId },
//         include: [{ model: Payment }],
//         transaction: dbTx,
//         lock: true,
//       });

//       if (!transaction) {
//         throw new Error("Transaction not found for webhook");
//       }

//       // Idempotency (VERY IMPORTANT)
//       if (transaction.status === "success") {
//         await dbTx.commit();
//         return res.status(200).json({ success: true });
//       }

//       // Update transaction
//       transaction.gateway_payment_id = captureId;
//       transaction.status = "success";
//       transaction.is_captured = true;
//       transaction.captured_at = new Date();
//       transaction.gateway_response = event;

//       await transaction.save({ transaction: dbTx });

//       // Update payment
//       await transaction.Payment.update(
//         {
//           status: "paid",
//           paid_at: new Date(),
//         },
//         { transaction: dbTx },
//       );
//       await Booking.update(
//         { status: "confirmed" },
//         { where: { id: transaction.Payment.booking_id }, transaction: dbTx },
//       );
//     }

//     await dbTx.commit();
//     return res.status(200).json({ success: true });
//   } catch (error) {
//     await dbTx.rollback();
//     console.error("PayPal Webhook Error:", error);
//     return res.status(500).json({ success: false });
//   }
//   console.log("PayPal Webhook Received");

//   res.status(200).json({ success: true });
// };



// const createStripePaymentIntent = async (req, res) => {
//   const dbTx = await sequelize.transaction();
//   const isSandbox = process.env.PAYPAL_MODE !== "live";
//   try {
//     const {
//       package_id,
//       booking_date,
//       start_time,
//       end_time,
//       amount,
//       currency = isSandbox ? "USD" : "AUD",
//     } = req.body;

//     const user_id = req.user.id;

//     if (!package_id || !booking_date || !start_time || !end_time || !amount) {
//       await dbTx.rollback();
//       return res.status(400).json({ success: false });
//     }

//     const checkpackage = await Package.findByPk(package_id);
//     if (!checkpackage) {
//       await dbTx.rollback();
//       return res.status(404).json({
//         success: false,
//         message: "Package not found",
//       });
//     }
//     const packageprice = Number(checkpackage.price);


//     const conflict = await Booking.findOne({
//       where: {
//         booking_date,
//         start_time,
//         end_time,
//         user_id,
//         user_package_id: package_id,
//         user_booking_amount: packageprice,
//         status: "confirmed",
//       },
//       transaction: dbTx,
//     });

//     if (conflict) {
//       await dbTx.rollback();
//       return res
//         .status(409)
//         .json({ success: false, message: "Slot already booked" });
//     }

//     // CREATE BOOKING HERE
//     const booking = await Booking.create(
//       {
//         user_id,
//         package_id,
//         booking_date,
//         start_time,
//         end_time,
//         user_package_id: package_id,
//         user_booking_amount: packageprice,
//         status: "payment_pending",
//       },
//       { transaction: dbTx },
//     );

//     // CREATE PAYMENT
//     const payment = await Payment.create(
//       {
//         booking_id: booking.id,
//         user_id,
//         amount,
//         currency,
//         method: "wallet",
//         status: "pending",
//       },
//       { transaction: dbTx },
//     );

//     const intent = await stripe.paymentIntents.create({
//       amount: Math.round(amount * 100),
//       currency,
//       automatic_payment_methods: { enabled: true },
//       metadata: {
//         payment_id: payment.id,
//         booking_id: booking.id,
//         user_id,
//       },
//     });

//     await Transaction.create(
//       {
//         payment_id: payment.id,
//         amount,
//         currency,
//         gateway_name: "stripe",
//         gateway_order_id: intent.id,
//         status: "initiated",
//         is_captured: false,
//         gateway_response: intent,
//       },
//       { transaction: dbTx },
//     );

//     await dbTx.commit();

//     return res.json({
//       success: true,
//       client_secret: intent.client_secret,
//       payment_intent_id: intent.id,
//     });
//   } catch (error) {
//     await dbTx.rollback();
//     return res.status(500).json({
//       success: false,
//       message: "Payment capture failed",
//       error: error.message,
//     });
//   }
// };

// const confirmStripePayment = async (req, res) => {
//   const dbTx = await sequelize.transaction();

//   try {
//     const { payment_intent_id } = req.params;
//     const user_id = req.user.id;

//     if (!payment_intent_id) {
//       await dbTx.rollback();
//       return res.status(400).json({
//         success: false,
//         message: "PaymentIntent ID is required",
//       });
//     }

//     //  Retrieve PaymentIntent from Stripe
//     const intent = await stripe.paymentIntents.retrieve(
//       payment_intent_id
//     );

//     const status = intent.status;

//     //  Find transaction
//     const transaction = await Transaction.findOne({
//       where: {
//         gateway_order_id: payment_intent_id,
//       },
//       include: [{ model: Payment }],
//       transaction: dbTx,
//       lock: true,
//     });

//     if (!transaction) {
//       await dbTx.rollback();
//       return res.status(404).json({
//         success: false,
//         message: "Transaction not found",
//       });
//     }

//     // Confirm payment if succeeded
//     if (status === "succeeded") {
//       if (transaction.status !== "success") {
//         transaction.status = "success";
//         transaction.is_captured = true;
//         transaction.captured_at = new Date();
//         transaction.gateway_response = intent;

//         await transaction.save({ transaction: dbTx });

//         await transaction.Payment.update(
//           {
//             status: "paid",
//             paid_at: new Date(),
//           },
//           { transaction: dbTx }
//         );

//         await Booking.update(
//           { status: "confirmed" },
//           {
//             where: { id: transaction.Payment.booking_id },
//             transaction: dbTx,
//           }
//         );
//       }
//     }

//     const booking = await Booking.findOne({
//       where: { id: transaction.Payment.booking_id },
//       transaction: dbTx,
//     });

//     await AvailabilitySlot.update(
//       { status: "booked", booking_id: transaction.Payment.booking_id },
//       {
//         where: {
//           date: booking.booking_date,
//           start_time: booking.start_time,
//           end_time: booking.end_time,
//         },
//         transaction: dbTx,
//       }
//     );



//     await dbTx.commit();

//     return res.json({
//       success: true,
//       message: "Stripe payment status confirmed",
//       data: {
//         payment_intent_id,
//         status,
//       },
//     });
//   } catch (error) {
//     await dbTx.rollback();
//     console.error("confirmStripePayment error:", error);

//     return res.status(500).json({
//       success: false,
//       message: error.message,
//     });
//   }
// };


// const stripeWebhookHandler = async (req, res) => {
//   console.log("Stripe Webhook Received");
//   const sig = req.headers["stripe-signature"];
//   let event;
//   console.log("event", event);
//   console.log("event_type ", event?.type);

//   try {
//     event = stripe.webhooks.constructEvent(
//       req.body,
//       sig,
//       process.env.STRIPE_WEBHOOK_SECRET,
//     );
//   } catch (err) {
//     console.error("Stripe Webhook Error:", err.message);
//     return res.status(400).send(`Webhook Error`);
//   }

//   const dbTx = await sequelize.transaction();

//   try {
//     if (event.type === "payment_intent.succeeded") {
//       const intent = event.data.object;
//       console.log("Processing payment_intent.succeeded for:", intent.id);

//       const transaction = await Transaction.findOne({
//         where: { gateway_order_id: intent.id },
//         include: [{ model: Payment }],
//         transaction: dbTx,
//         lock: true,
//       });

//       if (!transaction || transaction.status === "success") {
//         await dbTx.commit();
//         return res.json({ received: true });
//       }

//       transaction.status = "success";
//       transaction.is_captured = true;
//       transaction.captured_at = new Date();
//       transaction.gateway_response = intent;

//       await transaction.save({ transaction: dbTx });

//       await transaction.Payment.update(
//         {
//           status: "paid",
//           paid_at: new Date(),
//         },
//         { transaction: dbTx },
//       );
//       await Booking.update(
//         { status: "confirmed" },
//         { where: { id: transaction.Payment.booking_id }, transaction: dbTx },
//       );
//     }

//     await dbTx.commit();
//     res.json({ received: true });
//   } catch (error) {
//     await dbTx.rollback();
//     console.error("Stripe Webhook DB Error:", error);
//     res.status(500).json({ success: false });
//   }
// };



module.exports = { purchasePackage, getPackages };
