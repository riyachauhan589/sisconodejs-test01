"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class BookingSlot extends Model {
    static associate(models) {
      BookingSlot.belongsTo(models.Booking, {
        foreignKey: "booking_id",
        as: "booking",
      });
      BookingSlot.hasOne(models.AvailabilitySlot, {
        foreignKey: "lesson_id",
        as: "availability",
      });
    }
  }

  BookingSlot.init(
    {
      booking_id: DataTypes.INTEGER,
      booking_date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      start_time: {
        type: DataTypes.TIME,
        allowNull: false,
      },
      end_time: {
        type: DataTypes.TIME,
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM("booked", "completed", "cancelled"),
        defaultValue: "booked",
      },
      address: {
        type: DataTypes.STRING(500),
      },
      longitude: {
        type: DataTypes.STRING(100),
      },
      latitude: {
        type: DataTypes.STRING(100),
      },
      car_type: {
        type: DataTypes.ENUM("MANUAL", "AUTOMATIC"),
      },
      reminder_24h_sent: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
    },

    {
      indexes: [
        {
          fields: ["booking_date", "start_time", "end_time"],
        },
      ],

      sequelize,
      modelName: "BookingSlot",
      tableName: "booking_slots",
      underscored: true,
    }
  );

  return BookingSlot;
};
