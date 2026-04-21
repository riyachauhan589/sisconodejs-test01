"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class Lesson extends Model {
    static associate(models) {}

    get price_with_gst() {
      if (!this.gst_applicable) {
        return Number(this.base_price).toFixed(2);
      }

      return (
        Number(this.base_price) +
        (Number(this.base_price) * Number(this.gst_percentage)) / 100
      ).toFixed(2);
    }

    
    get gst_amount() {
      if (!this.gst_applicable) {
        return "0.00";
      }

      return (
        (Number(this.base_price) * Number(this.gst_percentage)) / 100
      ).toFixed(2);
    }

    // ✅ Expose computed fields in API response
    toJSON() {
      const values = { ...this.get() };

      values.price_with_gst = this.price_with_gst;
      values.gst_amount = this.gst_amount;

      return values;
    }
  }

  Lesson.init(
    {
      uid: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },

      name: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },

      category: {
        type: DataTypes.ENUM(
          "Single",
          "Extended",
          "Intensive",
          "Specialised"
        ),
        allowNull: false,
      },

      duration: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },

      base_price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
      },

      gst_applicable: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },

      gst_percentage: {
        type: DataTypes.DECIMAL(5, 2),
        defaultValue: 18.0, // India GST
      },

      status: {
        type: DataTypes.ENUM("Active", "Inactive"),
        allowNull: false,
        defaultValue: "Active",
      },
    },
    {
      sequelize,
      modelName: "Lesson",
      tableName: "lessons",
      underscored: true,
    }
  );

  return Lesson;
};
