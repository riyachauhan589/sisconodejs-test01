"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class AvailabilitySlot extends Model {
    static associate(models) {

      AvailabilitySlot.belongsTo(models.Booking, {
        foreignKey: "booking_id",
        as: "booking",
      });
      AvailabilitySlot.belongsTo(models.BookingSlot, {
        foreignKey: "lesson_id",
        as: "lesson",
      });

    }
  }

  AvailabilitySlot.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },

      date: {
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

      package_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },

      status: {
        type: DataTypes.ENUM("available", "booked", "blocked"),
        defaultValue: "available",
      },

      booking_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },

      block_reason: {
        type: DataTypes.STRING,
        allowNull: true,
      },

      created_by: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      lesson_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      }
    },
    {
      sequelize,
      modelName: "AvailabilitySlot",
      tableName: "availability_slots",
      underscored: true,
      timestamps: true,

      indexes: [
        {
          unique: true,
          fields: ["date", "start_time", "end_time", "package_id"],
        },
      ],
    }
  );

  return AvailabilitySlot;
};
