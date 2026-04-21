"use strict";
const { Model, Op } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class Refund extends Model {
    static associate(models) {
      Refund.belongsTo(models.Payment, {
        foreignKey: "payment_id",
        as: "payment",
      });

      Refund.belongsTo(models.Booking, {
        foreignKey: "booking_id",
        as: "booking",
      });
      
    }
  }

  Refund.init(
    {
      uid: {
        type: DataTypes.STRING(30),
        unique: true,
      },
      payment_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      booking_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      reason: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM("initiated", "processed", "failed","cancelled"),
        defaultValue: "initiated",
      },
      refunded_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "Refund",
      tableName: "refunds",
      underscored: true,
      hooks: {
        beforeCreate: async (refund, options) => {
          if (refund.uid) return;

          const transaction = options.transaction;

          for (let attempt = 0; attempt < 5; attempt++) {
            const now = new Date();
            const datePart = now.toISOString().slice(0, 10).replace(/-/g, "");

            const start = new Date(now.setHours(0, 0, 0, 0));
            const end = new Date(now.setHours(23, 59, 59, 999));

            const last = await Refund.findOne({
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

            refund.uid = `RFD-${datePart}-${String(next).padStart(3, "0")}`;
            break;
          }
        },
      },

    }
  );

  return Refund;
};
