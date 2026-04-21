// "use strict";
// const { Model, Op } = require("sequelize");

// module.exports = (sequelize, DataTypes) => {
//   class Booking extends Model {
//     static associate(models) {
//       Booking.belongsTo(models.User, { foreignKey: "user_id", as: "user" });
//       Booking.belongsTo(models.Package, { foreignKey: "package_id", as: "package" });
//       Booking.hasMany(models.Payment, { foreignKey: "booking_id", as: "payments" });
//       Booking.belongsTo(models.Package, {
//         foreignKey: "user_package_id",
//         as: "userPackage"
//       });
//       Booking.belongsTo(models.Booking, { foreignKey: "rescheduled_id", as: "rescheduledFrom" });
//       Booking.hasMany(models.Refund, { foreignKey: "booking_id" });
//     }
//   }

//   Booking.init(
//     {
//       uid: {
//         type: DataTypes.STRING(30),
//         unique: true,
//       },
//       user_id: DataTypes.INTEGER,
//       package_id: DataTypes.INTEGER,
//       user_package_id: DataTypes.INTEGER,
//       booking_date: DataTypes.DATEONLY,
//       start_time: DataTypes.TIME,
//       end_time: DataTypes.TIME,
//       status: DataTypes.ENUM(
//         "pending",
//         "confirmed",
//         "completed",
//         "cancelled",
//         "rescheduled",
//         "payment_pending"
//       ),
//       cancel_reason: DataTypes.TEXT,
//       notes: DataTypes.TEXT,
//       rescheduled_date: DataTypes.DATEONLY,
//       user_booking_amount: DataTypes.STRING(50),
//     },
//     {
//       sequelize,
//       modelName: "Booking",
//       tableName: "bookings",
//       underscored: true,
//       hooks: {
//         beforeCreate: async (booking) => {
//           if (booking.uid) return;

//           const now = new Date();
//           const datePart = now.toISOString().slice(0, 10).replace(/-/g, "");

//           const start = new Date(now.setHours(0, 0, 0, 0));
//           const end = new Date(now.setHours(23, 59, 59, 999));

//           const last = await Booking.findOne({
//             where: { createdAt: { [Op.between]: [start, end] } },
//             order: [["createdAt", "DESC"]],
//           });

//           let next = 1;
//           if (last?.uid) {
//             next = parseInt(last.uid.split("-")[2]) + 1;
//           }

//           booking.uid = `BKG-${datePart}-${String(next).padStart(3, "0")}`;
//         },
//       },
//     }
//   );

//   return Booking;
// };


"use strict";
const { Model, Op } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class Booking extends Model {
    static associate(models) {
      Booking.belongsTo(models.User, { foreignKey: "user_id", as: "user" });
      Booking.belongsTo(models.Package, { foreignKey: "package_id", as: "package" });
      Booking.hasMany(models.BookingSlot, { foreignKey: "booking_id", as: "slots" });
      Booking.hasMany(models.Payment, { foreignKey: "booking_id", as: "payments" });
      Booking.hasMany(models.Refund, {
        foreignKey: "booking_id",
        as: "refunds",
      });
    }
  }

  Booking.init(
    {
      uid: {
        type: DataTypes.STRING(30),
        unique: true,
      },

      user_id: DataTypes.INTEGER,
      package_id: DataTypes.INTEGER,

      total_hours: DataTypes.INTEGER,

      status: DataTypes.ENUM(
        "pending",
        "confirmed",
        "completed",
        "cancelled",
        "payment_pending",
        "rescheduled",
        "refunded"
      ),

      user_booking_amount: DataTypes.STRING(50),
      selected_slots: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: [],
      },
    },
    {
      sequelize,
      modelName: "Booking",
      tableName: "bookings",
      underscored: true,

      hooks: {
        beforeCreate: async (booking) => {
          if (booking.uid) return;

          const now = new Date();
          const datePart = now.toISOString().slice(0, 10).replace(/-/g, "");

          const start = new Date(now.setHours(0, 0, 0, 0));
          const end = new Date(now.setHours(23, 59, 59, 999));

          const last = await Booking.findOne({
            where: { createdAt: { [Op.between]: [start, end] } },
            order: [["createdAt", "DESC"]],
          });

          let next = 1;
          if (last?.uid) {
            next = parseInt(last.uid.split("-")[2]) + 1;
          }

          booking.uid = `BKG-${datePart}-${String(next).padStart(3, "0")}`;
        },
      },
    }
  );

  return Booking;
};
