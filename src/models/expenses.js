"use strict";
const { Model, Op } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
    class Expense extends Model {
        static associate(models) { }
    }

    Expense.init(
        {
            uid: {
                type: DataTypes.STRING(30),
                unique: true,
            },
            date: {
                type: DataTypes.DATEONLY,
                allowNull: false,
            },
            invoice_number: {
                type: DataTypes.STRING(100),
                allowNull: false,
            },
            price: {
                type: DataTypes.DECIMAL(10, 2),
                allowNull: false,
            },
            description: {
                type: DataTypes.STRING(255),
                allowNull: false,
            },
            image: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            category: {
                type: DataTypes.ENUM(
                    "Car registration exp.",
                    "Fuel expenses",
                    "Insurance exp.",
                    "Car service exp.",
                    "Car repair exp.",
                    "Advertising exp.",
                    "Accounting exp",
                    "Software exp.",
                    "Workwear exp.",
                    "Car cleaning exp.",
                    "Website maintenance exp.",
                    "Server charges",
                    "Google workshop exp",
                    "Professional email exp",
                    "SEO/Smo exp",
                    "Super paid exp.",
                    "Stationary exp.",
                    "Office equipment exp."
                ),
                allowNull: false,
            },


        },
        {
            sequelize,
            modelName: "Expense",
            tableName: "expenses",
            underscored: true,
            hooks: {
                beforeCreate: async (expense, options) => {
                    if (expense.uid) return;

                    const transaction = options.transaction;

                    const now = new Date();
                    const datePart = now.toISOString().slice(0, 10).replace(/-/g, "");

                    const start = new Date(now.setHours(0, 0, 0, 0));
                    const end = new Date(now.setHours(23, 59, 59, 999));

                    const last = await Expense.findOne({
                        where: {
                            createdAt: { [Op.between]: [start, end] },
                        },
                        order: [["createdAt", "DESC"]],
                        transaction,
                        lock: transaction?.LOCK.UPDATE,
                    });

                    let next = 1;
                    if (last?.uid) {
                        next = parseInt(last.uid.split("-")[2], 10) + 1;
                    }

                    expense.uid = `EXP-${datePart}-${String(next).padStart(3, "0")}`;
                },
            },
        }
    );

    return Expense;
};
