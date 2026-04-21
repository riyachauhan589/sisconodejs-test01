"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class UserPackage extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      UserPackage.belongsTo(models.Package, {
        foreignKey: "package_id",
        as: "package",
      });
      
      UserPackage.belongsTo(models.User, {
        foreignKey: "user_id",
        as: "user",
      });

      UserPackage.hasMany(models.Booking, {
        foreignKey: "user_package_id",
        as: "bookings",
      });
    }
  }
  UserPackage.init(
    {
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      package_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      price: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0,
      },
      expires_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      total_credits: {
        type: DataTypes.DECIMAL(3),
        defaultValue: 0,
      },
      remaining_credits: {
        type: DataTypes.DECIMAL(3),
        defaultValue: 0,
      },
      status: {
        type: DataTypes.ENUM("active", "expired"),
        defaultValue: "active",
      },
    },
    {
      sequelize,
      modelName: "UserPackage",
      tableName: "user_packages",
      underscored: true,
    },
  );
  return UserPackage;
};
