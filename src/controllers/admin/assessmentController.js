const { Assessment , User, Package ,
  AssessmentSection,
  AssessmentItem, sequelize } = require("../../models");

const saveAssessment = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const {
      assessment_id, // optional (if editing)
      learner_id,
      license_number,
      assessment_date,
      assessment_time,
      location,
      vehicle_plate,
      assessor_number,
      result,
      general_notes,
      sections,
    } = req.body;

    if (!learner_id || !sections || !sections.length) {
      return res.status(400).json({
        success: false,
        message: "Learner and assessment sections are required",
      });
    }

    let assessment;

    //  UPDATE FLOW
    if (assessment_id) {
      assessment = await Assessment.findByPk(assessment_id);

      if (!assessment) {
        return res.status(404).json({
          success: false,
          message: "Assessment not found",
        });
      }

      await assessment.update(
        {
          learner_id,
          license_number,
          assessment_date,
          assessment_time,
          location,
          vehicle_plate,
          assessor_number,
          result,
          general_notes,
        },
        { transaction }
      );

      //  Clear old data
      await AssessmentSection.destroy({
        where: { assessment_id },
        transaction,
      });
    }
    //  CREATE FLOW
    else {
      assessment = await Assessment.create(
        {
          learner_id,
          license_number,
          assessment_date,
          assessment_time,
          location,
          vehicle_plate,
          assessor_number,
          result,
          general_notes,
        },
        { transaction }
      );
    }

    //  Re-insert sections & items
    for (const section of sections) {
      const createdSection = await AssessmentSection.create(
        {
          assessment_id: assessment.id,
          title: section.title,
          notes: section.notes || null,
        },
        { transaction }
      );

      for (const item of section.items) {
        await AssessmentItem.create(
          {
            section_id: createdSection.id,
            label: item.label,
            code: item.code,
            result: item.result || "na",
          },
          { transaction }
        );
      }
    }

    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: "Assessment saved successfully",
      data: {
        assessment_id: assessment.id,
      },
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Save Assessment Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to save assessment",
      error:error.message
    });
  }
};

const getAssessment = async (req, res) => {
  try {
    const assessments = await Assessment.findAll({
      where: {
        result: ["standard_met", "standard_not_met"],
      },
      include: [
        {
          association: "learner",
          attributes: ["id", "first_name", "last_name", "license_number"],
        },
      ],
      order: [["created_at", "DESC"]],
    });

    return res.json({
      success: true,
      data: assessments,
    });
  } catch (error) {
    console.error("Get Completed Assessments Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch assessments",
    });
  }
};

const getAssessmentById = async (req, res) => {
  try {
    const assessment = await Assessment.findByPk(req.params.id, {
      include: [
        {
          model: AssessmentSection,
          as: "sections",
          include: [
            {
              model: AssessmentItem,
              as: "items",
            },
          ],
        },
      ],
      order: [
        ["id", "DESC"],
        [{ model: AssessmentSection, as: "sections" }, "id", "ASC"],
      ],
    });

    if (!assessment) {
      return res.status(404).json({
        success: false,
        message: "Assessment not found",
      });
    }

    return res.json({
      success: true,
      data: assessment,
    });
  } catch (error) {
    console.error("Get Assessment Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch assessment",
    });
  }
};

module.exports = {
  getAssessment,
  saveAssessment, 
  getAssessmentById
};
