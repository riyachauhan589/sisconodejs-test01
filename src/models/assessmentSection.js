"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class AssessmentSection extends Model {
    static associate(models) {
      AssessmentSection.belongsTo(models.Assessment, {
        foreignKey: "assessment_id",
        as: "assessment",
      });

      AssessmentSection.hasMany(models.AssessmentItem, {
        foreignKey: "section_id",
        as: "items",
      });
    }
  }

  AssessmentSection.init(
    {
      assessment_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },

      title: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },

      notes: DataTypes.TEXT,
    },
    {
      sequelize,
      modelName: "AssessmentSection",
      tableName: "assessment_sections",
      underscored: true,
      paranoid: true,
    }
  );

  return AssessmentSection;
};
