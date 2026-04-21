const {Setting} = require("../models");


const initializeDefaultSettings = async () => {
  try {
    const existing = await Setting.findOne({
      where: { key: "slot_buffer_minutes" },
    });

    if (existing) {
      console.log("slot_buffer_minutes setting already exists");
      return;
    }

    await Setting.create({
      key: "slot_buffer_minutes",
      name: "Buffer Time",
      value: "30", // default buffer minutes
      status: "active",
    });

    console.log("slot_buffer_minutes setting created successfully");
  } catch (error) {
    console.error("Error initializing default settings:", error);
  }
};


module.exports = {
    initializeDefaultSettings,
}   