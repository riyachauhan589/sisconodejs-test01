"use strict";
const { Model, Op } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class Transaction extends Model {
    static associate(models) {
      Transaction.belongsTo(models.Payment, { foreignKey: "payment_id" });
    }
  }

  Transaction.init(
    {
      uid: {
        type: DataTypes.STRING(30),
        unique: true,
      },
      payment_id: DataTypes.INTEGER,
      amount: DataTypes.DECIMAL(10, 2),
      currency: {
        type: DataTypes.STRING(10),
        defaultValue: "AUD",
      },
      gateway_name: DataTypes.STRING(100),
      gateway_order_id: DataTypes.STRING(255),
      gateway_payment_id: DataTypes.STRING(255),
      gateway_signature: DataTypes.STRING(255),
      gateway_response: DataTypes.JSON,
      is_captured: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
      captured_at: DataTypes.DATE,
      status: DataTypes.ENUM("initiated", "success", "failed", "refunded"),
    },
    {
      sequelize,
      modelName: "Transaction",
      tableName: "transactions",
      underscored: true,
      hooks: {
        beforeCreate: async (txn) => {
          if (txn.uid) return;

          const now = new Date();
          const datePart = now.toISOString().slice(0, 10).replace(/-/g, "");

          const start = new Date(now.setHours(0, 0, 0, 0));
          const end = new Date(now.setHours(23, 59, 59, 999));

          const last = await Transaction.findOne({
            where: { createdAt: { [Op.between]: [start, end] } },
            order: [["createdAt", "DESC"]],
          });

          let next = 1;
          if (last?.uid) {
            next = parseInt(last.uid.split("-")[2]) + 1;
          }

          txn.uid = `TXN-${datePart}-${String(next).padStart(3, "0")}`;
        },
      },
    }
  );

  return Transaction;
};
