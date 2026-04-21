const sendEmail = require("../../../config/mailer");
const { User, Booking, BookingSlot,
  Package,
  Payment,
  Transaction, } = require("../../models");
const bcrypt = require("bcrypt");
const { welcomeUserTemp } = require("../../utils/mailTemplates");
const { v4: uuidv4 } = require("uuid");
const { Op } = require("sequelize");

const createUser = async (req, res, next) => {
  try {
    const {
      first_name,
      email,
      mobile,
      date_of_birth,
      license_number,
      registration_date,
      status,
    } = req.body;

    if (!first_name || !email) {
      return res.status(400).json({
        success: false,
        message: "Name and email are required",
      });
    }

    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(404).json({
        success: false,
        message: "Email already exists",
      });
    }

    const password = uuidv4().replace(/-/g, "").slice(0, 10);

    hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      first_name,
      email,
      mobile,
      date_of_birth,
      license_number,
      registration_date,
      created_by: req.admin.id,
      password: hashedPassword,
      status: status || "active",
    });

    sendEmail(
      email,
      "🎉 Welcome to True Way Driving School",
      welcomeUserTemp(first_name, email, password),
    );

    return res.status(201).json({
      success: true,
      message: "User created successfully",
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

const getAllUsers = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      status = "active",
      search = "",
      dateFrom,
      dateTo,
    } = req.query;

    const pageNumber = parseInt(page, 10);
    const pageSize = parseInt(limit, 10);
    const offset = (pageNumber - 1) * pageSize;

    const whereCondition = { status };

    if (search) {
      whereCondition[Op.or] = [
        { first_name: { [Op.like]: `%${search}%` } },
        { last_name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
        { mobile: { [Op.like]: `%${search}%` } },
      ];
    }

    if (dateFrom && dateTo) {
      whereCondition.registration_date = {
        [Op.between]: [
          new Date(`${dateFrom}T00:00:00`),
          new Date(`${dateTo}T23:59:59`),
        ],
      };
    } else if (dateFrom) {
      whereCondition.registration_date = {
        [Op.gte]: new Date(`${dateFrom}T00:00:00`),
      };
    } else if (dateTo) {
      whereCondition.registration_date = {
        [Op.lte]: new Date(`${dateTo}T23:59:59`),
      };
    }

    const { rows, count } = await User.findAndCountAll({
      where: whereCondition,
      attributes: [
        "id",
        "first_name",
        "last_name",
        "email",
        "mobile",
        "registration_date",
        "status",
        "license_number",
        "date_of_birth",
      ],
      limit: pageSize,
      offset,
      order: [["created_at", "ASC"]],
    });

    const totalPages = Math.ceil(count / pageSize);

    return res.status(200).json({
      success: true,
      message: "Users fetched successfully",
      settings: {
        count,
        page: pageNumber,
        rows_per_page: pageSize,
        total_pages: totalPages,
        next_page: pageNumber < totalPages ? pageNumber + 1 : null,
        prev_page: pageNumber > 1 ? pageNumber - 1 : null,
      },
      data: rows,
    });
  } catch (error) {
    next(error);
  }
};

const getUserById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const user = await User.findOne({
      where: { id, status: "active" },
      attributes: [
        "id",
        "uid",
        "first_name",
        "last_name",
        "email",
        "mobile",
        "date_of_birth",
        "registration_date",
        "license_number",
        "address",
        "status",
      ],
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const bookings = await Booking.findAll({
      where: { user_id: id },
      attributes: ["id", "uid", "total_hours", "status", "created_at"],
      order: [["created_at", "DESC"]],
      include: [
        {
          model: Package,
          as: "package",
          attributes: ["name", "lessons_duration"],
        },
        {
          model: Payment,
          as: "payments",
          attributes: [
            "id",
            "uid",
            "amount",
            "currency",
            "status",
            "paid_at",
            "created_at",
          ],
        },
        {
          model: BookingSlot,
          as: "slots",
          attributes: ["status"],
        },
      ],
    });

    let completedLessons = 0;
    let upcomingLessons = 0;

    bookings.forEach((b) => {
      b.slots.forEach((s) => {
        if (s.status === "completed") completedLessons++;
        if (s.status === "booked") upcomingLessons++;
      });
    });

    const totalLessons = completedLessons + upcomingLessons;

    const stats = {
      total_bookings: bookings.length,
      total_lessons: totalLessons,
      completed_lessons: completedLessons,
      upcoming_lessons: upcomingLessons,
    };

    const bookings_history = bookings.map((b) => ({
      booking_id: b.uid || null,
      lesson_type: b.package?.name || "N/A",
      duration: b.package?.lessons_duration || "N/A",
      date_time: b.created_at,
      status: b.status,
      payment_status: b.payments?.[0]?.status || "pending",
      created_on: b.get("created_at"),
    }));

    const payments_invoices = bookings.flatMap((b) =>
      b.payments.map((p) => ({
        invoice_id: p.uid,
        amount: `${p.amount} ${p.currency}`,
        payment_method: "online",
        date: p.paid_at,
        status: p.status,
        id: p.id,
        created_on: p.get("created_at"),
      }))
    );

    return res.status(200).json({
      success: true,
      data: {
        user,
        stats,
        bookings_history,
        payments_invoices,
      },
    });
  } catch (error) {
    console.error("getUserById Error:", error);
    next(error);
  }
};

const updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    const user = await User.findByPk(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (req.body.email && req.body.email !== user.email) {
      const emailExists = await User.findOne({
        where: {
          email: req.body.email,
          id: { [Op.ne]: id },
        },
      });
      if (emailExists) {
        return res.status(409).json({
          success: false,
          message: "Email already exists",
        });
      }
    }

    const first_name = req.body.first_name ?? user.first_name;
    const email = req.body.email ?? user.email;
    const mobile = req.body.mobile ?? user.mobile;
    const date_of_birth = req.body.date_of_birth ?? user.date_of_birth;
    const license_number =
      req.body.license_number ?? user.license_number;
    const registration_date =
      req.body.registration_date ?? user.registration_date;
    const status = req.body.status ?? user.status;

    await user.update({
      first_name,
      email,
      mobile,
      date_of_birth,
      license_number,
      registration_date,
      status,
    });

    const userData = user.toJSON();
    delete userData.password;

    return res.status(200).json({
      success: true,
      message: "User updated successfully",
      data: userData,
    });
  } catch (error) {
    next(error);
  }
};

const downloadInvoice = async (req, res) => {
  try {
    const { user_id, payment_id } = req.query;

    if (!user_id || !payment_id) {
      return res.status(400).json({
        success: false,
        message: "user_id and payment_id are required",
      });
    }

    const booking = await Booking.findOne({
      where: { user_id },
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "first_name", "last_name", "email", "mobile", "address"],
        },
        {
          model: Package,
          as: "package",
          attributes: ["id", "name", "price"],
        },
        {
          model: Payment,
          as: "payments",
          where: { id: payment_id },
          required: true,
          attributes: [
            "id",
            "uid",
            "amount",
            "currency",
            "method",
            "status",
            "paid_at",
          ],
        },
        {
          model: BookingSlot,
          as: "slots",
          attributes: ["booking_date", "start_time", "end_time"],
          separate: true,
          order: [["booking_date", "ASC"]],
        },
      ],
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "No invoice found for this user and payment",
      });
    }

    const firstSlot = booking.slots?.[0];

    const invoiceData = {
      booking_uid: booking.uid,
      booking_date: firstSlot?.booking_date || null,
      start_time: firstSlot?.start_time || null,
      end_time: firstSlot?.end_time || null,
      status: booking.status,

      user: {
        id: booking.user?.id,
        first_name: booking.user?.first_name,
        last_name: booking.user?.last_name,
        email: booking.user?.email,
        mobile: booking.user?.mobile,
        address: booking.user?.address,
      },

      package: {
        id: booking.package?.id,
        name: booking.package?.name,
        price: booking.package?.price,
      },

      payments: booking.payments.map((payment) => ({
        payment_id: payment.id,
        payment_uid: payment.uid,
        amount: payment.amount,
        currency: payment.currency,
        method: payment.method,
        status: payment.status,
        paid_at: payment.paid_at,
      })),
    };

    return res.status(200).json({
      success: true,
      data: invoiceData,
    });

  } catch (error) {
    console.error("Invoice download error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to generate invoice data",
    });
  }
};

module.exports = {
  createUser,
  getAllUsers,
  getUserById,
  updateUser,
  downloadInvoice
};
