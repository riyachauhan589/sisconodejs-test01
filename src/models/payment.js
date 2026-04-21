"use strict";
const { Model, Op } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class Payment extends Model {
    static associate(models) {
      Payment.belongsTo(models.Booking, { foreignKey: "booking_id", as: "booking" });
      Payment.belongsTo(models.User, { foreignKey: "user_id", as: "user" });
      Payment.hasMany(models.Transaction, { foreignKey: "payment_id", as: "transactions" });

      Payment.hasMany(models.Refund, { foreignKey: "payment_id" });
      Payment.hasMany(models.Refund, {
        foreignKey: "payment_id",
        as: "refunds",
      });

    }
  }

  Payment.init(
    {
      uid: {
        type: DataTypes.STRING(30),
        unique: true,
      },
      booking_id: DataTypes.INTEGER,
      user_id: DataTypes.INTEGER,
      amount: DataTypes.DECIMAL(10, 2),
      currency: {
        type: DataTypes.STRING(10),
        defaultValue: "AUD",
      },
      method: DataTypes.ENUM(
        "cash",
        "upi",
        "wallet",
        "bank_transfer",
        "credit_card",
        "debit_card",
        "net_banking",
        "other"
      ),
      status: {
        type: DataTypes.ENUM("pending", "paid", "failed", "refunded", "partial_refund"),
        defaultValue: "pending",
      },
      paid_at: DataTypes.DATE,
      refunded_at: DataTypes.DATE,
    },
    {
      sequelize,
      modelName: "Payment",
      tableName: "payments",
      underscored: true,
      hooks: {
        beforeCreate: async (payment) => {
          if (payment.uid) return;

          const now = new Date();
          const datePart = now.toISOString().slice(0, 10).replace(/-/g, "");

          const start = new Date(now);
          start.setHours(0, 0, 0, 0);

          const end = new Date(now);
          end.setHours(23, 59, 59, 999);

          const last = await Payment.findOne({
            where: {
              createdAt: { [Op.between]: [start, end] },
            },
            order: [["createdAt", "DESC"]],
          });

          let next = 1;
          if (last?.uid) {
            next = parseInt(last.uid.split("-")[2], 10) + 1;
          }

          payment.uid = `PAY-${datePart}-${String(next).padStart(3, "0")}`;
        },
      },

    }
  );

  return Payment;
};
