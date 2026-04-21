const { Transaction } = require("../../models");

const createTransaction = async (req, res) => {
  try {
    const {
      payment_id,
      gateway_name,
      gateway_order_id,
      amount,
    } = req.body;

    const transaction = await Transaction.create({
      payment_id,
      gateway_name,
      gateway_order_id,
      amount,
      status: "initiated",
    });

    return res.status(201).json({
      success: true,
      data: transaction,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = { createTransaction };
