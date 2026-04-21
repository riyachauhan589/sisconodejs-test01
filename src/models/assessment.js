"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class Assessment extends Model {
    static associate(models) {
      Assessment.belongsTo(models.User, {
        foreignKey: "learner_id",
        as: "learner",
      });

      Assessment.hasMany(models.AssessmentSection, {
        foreignKey: "assessment_id",
        as: "sections",
      });
    }
  }

  Assessment.init(
    {
      uid: DataTypes.STRING(50),

      learner_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },

      license_number: DataTypes.STRING(100),
      assessment_date: DataTypes.DATEONLY,
      assessment_time: DataTypes.TIME,

      location: DataTypes.STRING(255),
      vehicle_plate: DataTypes.STRING(50),
      assessor_number: DataTypes.STRING(50),

      result: {
        type: DataTypes.ENUM("standard_met", "standard_not_met"),
        allowNull: true,
      },

      general_notes: DataTypes.TEXT,
    },
    {
      sequelize,
      modelName: "Assessment",
      tableName: "assessments",
      underscored: true,
      paranoid: true,
    }
  );

  return Assessment;
};
