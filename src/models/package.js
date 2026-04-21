"use strict";
const { Model, Op } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class Package extends Model {
    static associate(models) {
      Package.hasMany(models.UserPackage, {
        foreignKey: "package_id",
        as: "userPackages",
      });
    }
  }

  Package.init(
    {
      uid: {
        type: DataTypes.STRING(30),
        unique: true,
      },
      name: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      type: {
        type: DataTypes.ENUM("lesson", "test-day", "specialised-training"),
        allowNull: true,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      price: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0,
      },
      services: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      lessons_count: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      lessons_duration: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      validity: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      gst_included: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      auto_deduct: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      status: {
        type: DataTypes.ENUM("active", "inactive"),
        allowNull: false,
        defaultValue: "active",
      },
      most_popular: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
      }
    },
    {
      sequelize,
      modelName: "Package",
      tableName: "packages",
      underscored: true,
      hooks: {
        beforeCreate: async (pkg) => {
          if (pkg.uid) return;

          const now = new Date();
          const datePart = now.toISOString().slice(0, 10).replace(/-/g, "");

          const start = new Date(now.setHours(0, 0, 0, 0));
          const end = new Date(now.setHours(23, 59, 59, 999));

          const last = await Package.findOne({
            where: { createdAt: { [Op.between]: [start, end] } },
            order: [["createdAt", "DESC"]],
          });

          let next = 1;
          if (last?.uid) {
            next = parseInt(last.uid.split("-")[2]) + 1;
          }

          pkg.uid = `PKG-${datePart}-${String(next).padStart(3, "0")}`;
        },
      },
    }
  );

  return Package;
};
