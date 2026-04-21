"use strict";
const { Model, Op } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class Setting extends Model {
    static associate(models) {}
  }

  Setting.init(
    {
      uid: {
        type: DataTypes.STRING(30),
        unique: true,
      },

      key: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true,
      },

      name: {
        type: DataTypes.STRING(150),
        allowNull: false,
      },

      value: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },

      status: {
        type: DataTypes.ENUM("active", "inactive"),
        defaultValue: "active",
      },
    },
    {
      sequelize,
      modelName: "Setting",
      tableName: "settings",
      underscored: true,

      hooks: {
        beforeCreate: async (setting) => {
          try {
            if (setting.uid) return;

            const now = new Date();
            const datePart = now.toISOString().slice(0, 10).replace(/-/g, "");

            const start = new Date(now.setHours(0, 0, 0, 0));
            const end = new Date(now.setHours(23, 59, 59, 999));

            const last = await Setting.findOne({
              where: {
                createdAt: {
                  [Op.between]: [start, end],
                },
              },
              order: [["createdAt", "DESC"]],
            });

            let next = 1;

            if (last?.uid) {
              next = parseInt(last.uid.split("-")[2]) + 1;
            }

            setting.uid = `SET-${datePart}-${String(next).padStart(3, "0")}`;
          } catch (error) {
            console.error("Error generating Setting UID:", error);
            throw error;
          }
        },

        beforeUpdate: async (setting) => {
          if (setting.changed("key")) {
            throw new Error("Setting key cannot be updated");
          }
        },
      },
    }
  );

  return Setting;
};
