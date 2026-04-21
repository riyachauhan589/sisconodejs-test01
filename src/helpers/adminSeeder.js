const bcrypt = require("bcrypt");
const { Admin } = require("../models");

const createDefaultAdmin = async () => {
  try {
    const defaultEmail = "truewayadmin@gmail.com";

    const existingAdmin = await Admin.findOne({
      where: { email: defaultEmail },
    });

    if (existingAdmin) {
      console.log("Default admin already exists");
      return;
    }

    const hashedPassword = await bcrypt.hash("Admin@123", 10);

    await Admin.create({
      name: "Admin",
      email: defaultEmail,
      password: hashedPassword,
      status: "active",
    });

    console.log("Default admin created successfully");
  } catch (error) {
    console.error("Error creating default admin:", error);
    throw error;
  }
};

module.exports = {
  createDefaultAdmin,
};