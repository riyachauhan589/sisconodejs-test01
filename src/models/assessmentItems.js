"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class AssessmentItem extends Model {
    static associate(models) {
      AssessmentItem.belongsTo(models.AssessmentSection, {
        foreignKey: "section_id",
        as: "section",
      });
    }
  }

  AssessmentItem.init(
    {
      section_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },

      label: {
        type: DataTypes.STRING(100), // Look Behind, Signal, Flow etc
        allowNull: false,
      },

      code: {
        type: DataTypes.STRING(10), // L, S, F, M, P, VM
        allowNull: true,
      },

      result: {
        type: DataTypes.ENUM("pass", "fail", "na"),
        allowNull: false,
        defaultValue: "na",
      },
    },
    {
      sequelize,
      modelName: "AssessmentItem",
      tableName: "assessment_items",
      underscored: true,
      paranoid: true,
    }
  );

  return AssessmentItem;
};
