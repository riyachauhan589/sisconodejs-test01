const { Package, Booking, Payment, User, sequelize } = require("../../models");
const { v4: uuidv4 } = require("uuid");
const Sequelize = require("sequelize")

const createPackage = async (req, res, next) => {
  try {
    const {
      name,
      type,
      description,
      price,
      services,
      lessons_count,
      lessons_duration,
      validity,
      gst_included,
      auto_deduct,
      status,
      most_popular = false
    } = req.body;

    if (!name || !type) {
      return res.status(400).json({
        success: false,
        message: "Name and type are required",
      });
    }

    const checkExisting = await Package.findOne({ where: { name } });
    if (checkExisting) {
      return res.status(409).json({
        success: false,
        message: "Package with this name already exists",
      });
    }

    const packageData = await Package.create({
      name,
      type,
      description,
      price,
      services,
      lessons_count: lessons_count || 0,
      lessons_duration: lessons_duration || 0,
      validity: validity || 0,
      gst_included,
      auto_deduct,
      status,
      most_popular
    });

    return res.status(201).json({
      success: true,
      message: "Package created successfully",
      data: packageData,
    });
  } catch (error) {
    next(error);
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

const updatePackage = async (req, res, next) => {
  try {
    const { id } = req.params;

    const packageData = await Package.findByPk(id);
    if (!packageData) {
      return res.status(404).json({
        success: false,
        message: "Package not found",
      });
    }

    const name = req.body.name ?? packageData.name;
    const type = req.body.type ?? packageData.type;
    const description = req.body.description ?? packageData.description;
    const price = req.body.price ?? packageData.price;
    const services = req.body.services ?? packageData.services;
    const lessons_count = req.body.lessons_count ?? packageData.lessons_count;
    const lessons_duration =
      req.body.lessons_duration ?? packageData.lessons_duration;
    const validity = req.body.validity ?? packageData.validity;
    const gst_included =
      req.body.gst_included ?? packageData.gst_included;
    const auto_deduct = req.body.auto_deduct ?? packageData.auto_deduct;
    const status = req.body.status ?? packageData.status;
    const most_popular = req.body.most_popular ?? packageData.most_popular
    await packageData.update({
      name,
      type,
      description,
      price,
      services,
      lessons_count,
      lessons_duration,
      validity,
      gst_included,
      auto_deduct,
      status,
      most_popular
    });
    
    return res.status(200).json({
      success: true,
      message: "Package updated successfully",
    });
  } catch (error) {
    next(error);
  }
};

const getPackageBookedLearners = async (req, res, next) => {
  try {
    const { package_id } = req.params;

    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const offset = (page - 1) * limit;

    // 1️⃣ Check package
    const packageData = await Package.findOne({
      where: { id: package_id },
      attributes: ["id", "name", "type", "price"],
    });

    if (!packageData) {
      return res.status(404).json({
        success: false,
        message: "Package not found",
      });
    }

    //paid paymeNts
    const summaryData = await Booking.findAll({
      where: { package_id },
      include: [
        {
          model: Payment,
          as: "payments",
          where: { status: "paid" },
          attributes: [],
          required: true,
        },
      ],
      attributes: [
        [Sequelize.fn("COUNT", Sequelize.col("Booking.id")), "paid_learners"],
        [Sequelize.fn("SUM", Sequelize.col("payments.amount")), "total_amount"],
      ],
      raw: true,
    });

    const totalPaidLearners = Number(summaryData[0]?.paid_learners || 0);
    const totalAmountCollected = Number(summaryData[0]?.total_amount || 0);


    // PAGINATED LEARNERS (PAID ONLY)

    const { rows, count } = await Booking.findAndCountAll({
      where: { package_id },
      include: [
        {
          model: User,
          as: "user",
          attributes: ["first_name", "email"],
        },
        {
          model: Payment,
          as: "payments",
          where: { status: "paid" },
          attributes: ["amount"],
          required: true,
        },
      ],
      attributes: [ "status"],
      order: [["id", "DESC"]],
      limit,
      offset,
      distinct: true,
    });

    const totalPages = Math.ceil(count / limit);

    const learners = rows.map((booking) => ({
      learner_name: booking.user.first_name,
      learner_email: booking.user.email,
      booking_date: booking.booking_date,
      booking_status: booking.status,
      payment_status: "paid",
      amount: booking.payments[0].amount,
      package_type: packageData.type,
    }));

    return res.status(200).json({
      success: true,
      message: "Package learners fetched successfully",
      summary: {
        total_active_learners: totalPaidLearners,
        package_price: packageData.price,
        package_type: packageData.type,
        total_amount_collected: totalAmountCollected.toFixed(2),
      },
      settings: {
        count,
        page,
        rows_per_page: limit,
        total_pages: totalPages,
        next_page: page < totalPages ? page + 1 : null,
        prev_page: page > 1 ? page - 1 : null,
      },
      learners,
    });
  } catch (error) {
    console.error("getPackageBookedLearners error:", error);
    next(error);
  }
};


module.exports = { createPackage, updatePackage, getPackages, getPackageBookedLearners };
