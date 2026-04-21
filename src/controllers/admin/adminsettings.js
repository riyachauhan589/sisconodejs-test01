const { Setting } = require("../../models")
const { Op } = require("sequelize");


const createSetting = async (req, res) => {
    try {
        const { key, name, value, status } = req.body;

        if (!key || typeof key !== "string" || key.trim() === "") {
            return res.status(400).json({ success: false, message: "Valid key is required" });
        }

        if (!name || typeof name !== "string" || name.trim() === "") {
            return res.status(400).json({ success: false, message: "Valid name is required" });
        }

        if (value === undefined || value === null || value === "") {
            return res.status(400).json({ success: false, message: "Value is required" });
        }

        if (status && !["active", "inactive"].includes(status)) {
            return res.status(400).json({ success: false, message: "Invalid status" });
        }

        const existing = await Setting.findOne({ where: { key: key } });

        if (existing) {
            return res.status(400).json({ success: false, message: "Setting key already exists" });
        }

        const setting = await Setting.create({
            key: key.trim(),
            name: name.trim(),
            value: String(value),
            status: status || "active",
        });

        return res.status(201).json({
            success: true,
            message: "Setting created successfully",
            data: setting,
        });
    } catch (error) {
        console.error("Create Setting Error:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Failed to create setting",
        });
    }
};

const fetchSettings = async (req, res) => {
    try {
        const { search = "", status } = req.query;

        const where = {};

        if (search) {
            where[Op.or] = [
                { key: { [Op.like]: `%${search}%` } },
                { name: { [Op.like]: `%${search}%` } },
                { value: { [Op.like]: `%${search}%` } },
            ];
        }

        if (status && ["active", "inactive"].includes(status)) {
            where.status = status;
        }

        const settings = await Setting.findAll({
            where,
            order: [["createdAt", "DESC"]],
        });

        return res.status(200).json({
            success: true,
            message: "Settings fetched successfully",
            total: settings.length,
            data: settings,
        });
    } catch (error) {
        console.error("Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to save assessment",
            error: error.message
        });
    }
};

const updateSetting = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, value, status } = req.body;

        if (!id) {
            return res.status(400).json({ success: false, message: "Setting id is required" });
        }

        const setting = await Setting.findByPk(id);

        if (!setting) {
            return res.status(404).json({ success: false, message: "Setting not found" });
        }

        if (name !== undefined) {
            if (!name || name.trim() === "") {
                return res.status(400).json({ success: false, message: "Invalid name" });
            }
            setting.name = name.trim();
        }

        if (value !== undefined) {
            if (value === null || value === "") {
                return res.status(400).json({ success: false, message: "Invalid value" });
            }
            setting.value = String(value);
        }

        if (status !== undefined) {
            if (!["active", "inactive"].includes(status)) {
                return res.status(400).json({ success: false, message: "Invalid status" });
            }
            setting.status = status;
        }

        await setting.save();

        return res.status(200).json({
            success: true,
            message: "Setting updated successfully",
            data: setting,
        });
    } catch (error) {
        console.error(" Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to save assessment",
            error: error.message
        });
    }
};

module.exports = { createSetting, fetchSettings, updateSetting }

