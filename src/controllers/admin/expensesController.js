const { Expense } = require("../../models")
const getBaseUrl = require("../../../config/getBaseUrl")
const { Op , fn ,col} = require("sequelize");

const addExpense = async (req, res) => {
    try {
        const { date, invoice_number, price, description, category } = req.body;

        if (!date || !invoice_number || !price || !description || !category) {
            return res.status(400).json({
                success: false,
                message: "All fields are required",
            });
        }

        if (Number(price) <= 0) {
            return res.status(400).json({
                success: false,
                message: "Price must be greater than 0",
            });
        }

        const expense = await Expense.create({
            date,
            invoice_number,
            price,
            description,
            category,
            image: req.file
                ? `${req.folder}/${req.file.filename}`
                : null,
        });

        const baseUrl = getBaseUrl(req);

        const responseData = expense.toJSON();
        if (responseData.image) {
            responseData.image = baseUrl + responseData.image;
        }

        return res.status(201).json({
            success: true,
            message: "Expense created successfully",
            data: responseData,
        });
    } catch (error) {
        console.error("Add Expense Error:", error);
        return res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
};

const getExpenses = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const offset = (page - 1) * limit;

    const { search, category, start_date, end_date } = req.query;

    const whereCondition = {};

    if (category) {
      const cleanedCategory = category.trim();
      whereCondition.category = {
        [Op.like]: cleanedCategory.endsWith(".")
          ? cleanedCategory
          : `${cleanedCategory}.`,
      };
    }

    if (search) {
      whereCondition.invoice_number = {
        [Op.like]: `%${search}%`,
      };
    }

    if (start_date && end_date) {
      whereCondition.date = {
        [Op.between]: [start_date, end_date],
      };
    }

    const { count, rows } = await Expense.findAndCountAll({
      where: whereCondition,
      order: [["created_at", "DESC"]],
      limit,
      offset,
    });

    const totals = await Expense.findOne({
      attributes: [
        [fn("COALESCE", fn("SUM", col("price")), 0), "total_expense"],
        [fn("COUNT", col("id")), "total_records"],
        [fn("COALESCE", fn("AVG", col("price")), 0), "average_expense"],
      ],
      where: whereCondition,
      raw: true,
    });

    const totalPages = Math.ceil(count / limit);

    const baseUrl = getBaseUrl(req);

    const formattedData = rows.map((expense) => {
      const data = expense.toJSON();
      return {
        ...data,
        image: data.image ? baseUrl + data.image : null,
      };
    });

    return res.json({
      success: true,
      message: "Expense fetched successfully",
      settings: {
        count,
        page,
        rows_per_page: limit,
        total_pages: totalPages,
        next_page: page < totalPages ? page + 1 : null,
        prev_page: page > 1 ? page - 1 : null,
      },
      stats: {
        total_expense: Number(totals.total_expense || 0),
        total_records: Number(totals.total_records || 0),
        average_expense: Number(
          Number(totals.average_expense || 0).toFixed(2)
        ),
      },
      data: formattedData,
    });
  } catch (error) {
    console.error("Get All Expenses Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

const updateExpense = async (req, res) => {
    try {
        const { id } = req.params;
        const { date, invoice_number, price, description, category } = req.body;

        const expense = await Expense.findByPk(id);

        if (!expense) {
            return res.status(404).json({
                success: false,
                message: "Expense not found",
            });
        }

        if (price && Number(price) <= 0) {
            return res.status(400).json({
                success: false,
                message: "Price must be greater than 0",
            });
        }

        const updatedImage = req.file
            ? `${req.folder}/${req.file.filename}`
            : expense.image;

        await expense.update({
            date: date ?? expense.date,
            invoice_number: invoice_number ?? expense.invoice_number,
            price: price ?? expense.price,
            description: description ?? expense.description,
            category: category ?? expense.category,
            image: updatedImage,
        });

        const baseUrl = getBaseUrl(req);
        const responseData = expense.toJSON();

        if (responseData.image) {
            responseData.image = baseUrl + responseData.image;
        }

        return res.json({
            success: true,
            message: "Expense updated successfully",
            data: responseData,
        });
    } catch (error) {
        console.error("Update Expense Error:", error);
        return res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
};

const deleteExpense = async (req, res) => {
    try {
        const { id } = req.params;

        const expense = await Expense.findByPk(id);

        if (!expense) {
            return res.status(404).json({
                success: false,
                message: "Expense not found",
            });
        }

        await expense.destroy();

        return res.json({
            success: true,
            message: "Expense deleted successfully",
        });
    } catch (error) {
        console.error("Delete Expense Error:", error);
        return res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
};


module.exports = {
    addExpense, getExpenses, updateExpense, deleteExpense
}