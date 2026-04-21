const { Contact, Package } = require("../../models");
const sendEmail = require("../../../config/mailer");
const { contactFormTemp } = require("../../utils/mailTemplates");

const createContact = async (req, res) => {
  try {
    const { first_name, last_name, email, phone, suburb, package_id, message } = req.body;

    let packageName = null;
    if (package_id) {
      const pkg = await Package.findByPk(package_id);
      if (!pkg) return res.status(400).json({ success: false, message: 'Invalid package selected' });
      packageName = pkg.name;
    }

    const contact = await Contact.create({
      first_name,
      last_name,
      email,
      phone,
      suburb,
      package_id,
      message,
    });

    const emailData = {
      name: `${first_name} ${last_name}`,
      email,
      phone,
      suburb,
      package: packageName,
      message,
    };

    await sendEmail(
      process.env.CONTACT_RECEIVER_EMAIL || "yourgmail@gmail.com",
      "📩 New Contact Form Submission",
      contactFormTemp(emailData)
    );

    await sendEmail(
      email,
      "✅ We received your message",
      `<div style="font-family:sans-serif;line-height:1.6;">
        <h2>Hello ${first_name},</h2>
        <p>Thank you for contacting True Way Driving School. We have received your message and will get back to you within 24 hours.</p>
        <p><strong>Your Message:</strong></p>
        <p>${message}</p>
        <br/>
        <p>Drive safe & learn smart!<br/>True Way Driving School</p>
      </div>`
    );

    return res.status(201).json({ success: true, data: contact });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Failed to submit contact request' });
  }
};


// const getContacts = async (req, res) => {
//   try {
//     const contacts = await Contact.findAll({
//       include: [{ model: Package, as: 'package', attributes: ['id', 'name'] }],
//       order: [['created_at', 'DESC']],
//     });
//     return res.json({ success: true, data: contacts });
//   } catch (err) {
//     console.error(err);
//     return res.status(500).json({ success: false, message: 'Failed to fetch contacts' });
//   }
// };

module.exports = { createContact};
