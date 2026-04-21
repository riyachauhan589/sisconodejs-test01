const welcomeUserTemp = (name, email, password) => {
  return `
    <div style="max-width:600px;margin:20px auto;padding:30px;border-radius:12px;
                background:#ffffff;box-shadow:0 4px 20px rgba(0,0,0,0.1);
                font-family:Arial,sans-serif;color:#333;">
      
      <h2 style="text-align:center;color:#0d6efd;">
        🎉 Welcome to True Way Driving School
      </h2>

      <p style="font-size:16px;">Hello ${name || "User"},</p>

      <p style="font-size:15px;line-height:1.6;">
        We’re excited to have you onboard! Your account has been successfully
        created with <strong>True Way Driving School</strong>.
      </p>

      <p style="font-size:15px;line-height:1.6;">
        Your login credentials are:
        <ul>
          <li><strong>Email:</strong> ${email}</li>
          <li><strong>Password:</strong> ${password}</li>
        </ul>
        Please login and change your password after first login.
      </p>

      <p style="font-size:15px;line-height:1.6;">
        You can now:
        <ul>
          <li>View and manage your lessons</li>
          <li>Track bookings</li>
          <li>Stay updated with notifications</li>
        </ul>
      </p>

      <p style="font-size:15px;line-height:1.6;">
        If you have any questions, feel free to reach out to our support team.
      </p>

      <hr style="border:none;border-top:1px solid #ddd;margin:25px 0;" />

      <p style="font-size:13px;color:#666;text-align:center;">
        🚗 Drive safe & learn smart!<br/>
        ${process.env.MAIL_FROM_NAME || "Support Team"}
      </p>
    </div>
  `;
};

const forgotPassTemp = (name, resetLink) => {
  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.6;">
      <h2>Hello ${name || "User"},</h2>
      <p>You requested to reset your password.</p>
      <p>Click the link below to set a new password:</p>
      <a href="${resetLink}" 
         style="background-color:#4CAF50;color:#fff;padding:10px 15px;text-decoration:none;border-radius:5px;">
        Reset Password
      </a>
      <p>If you didn’t request this, please ignore this email.</p>
      <br />
      <p>Thanks,<br/>${process.env.MAIL_FROM_NAME || "Support Team"}</p>
    </div>
  `;
};

const contactFormTemp = (data) => {
  return `
<div style="font-family: Arial, sans-serif; line-height: 1.6;">
          <h2 style="color: #333;">New Contact Form Submission</h2>
          <p><strong>Name:</strong> ${data.name}</p>
          <p><strong>Email:</strong> ${data.email}</p>
          <p><strong>Phone:</strong> ${data.phone || "N/A"}</p>
          <p><strong>Message:</strong></p>
          <p>${data.message}</p>
          <hr/>
          <p style="font-size: 12px; color: #888;">This message was sent from the website contact form.</p>
        </div>
  `;
};

const sendForgotOtpTemp = (otp) => {
  return `        <div style="max-width:600px;margin:20px auto;padding:30px;border-radius:12px;background:linear-gradient(135deg,#f0f0f0,#ffffff);box-shadow:0 4px 20px rgba(0,0,0,0.1);font-family:sans-serif;color:#333;">
          <h2 style="text-align:center;color:#0d6efd;margin-bottom:15px;">🚀 Password Reset Request</h2>
          <p style="font-size:16px;line-height:1.5;">Hello,</p>
          <p style="font-size:16px;line-height:1.5;">Someone (hopefully you) has requested to reset your password. Use the OTP below to proceed:</p>
          <div style="text-align:center;margin:30px 0;">
            <span style="display:inline-block;background:#0d6efd;color:#fff;font-size:32px;font-weight:bold;padding:15px 30px;border-radius:8px;letter-spacing:3px;">${otp}</span>
          </div>
          <p style="font-size:15px;line-height:1.5;">⚡️ <b>Validity:</b> This OTP is valid for <b>10 minutes</b>. Please do not share it with anyone for security reasons.</p>
          <p style="font-size:15px;line-height:1.5;">If you didn’t request this, you can safely ignore this email. Your password will remain unchanged.</p>
          <hr style="border:none;border-top:1px solid #ddd;margin:30px 0;">
          <p style="font-size:13px;color:#666;text-align:center;">🔒 Stay secure!<br>${process.env.MAIL_FROM_NAME}</p>
        </div>
  `;
};

const empCredentialTemp = (data) => {
  return `           <h2>Welcome ${data.name},</h2>
          <p>Your ${data.role} account has been created successfully.</p>
          <p><b>Login Details:</b></p>
          <p>Email: ${data.email}</p>
          <p>Password: ${data.password}</p>
          <p>Please change your password after logging in.</p>
          <br/>
          <p>Regards,<br/>Admin Team</p>
  `;
};

const bookingConfirmationTemplate = (booking) => {
  const slotsHtml = (booking.slots || [])
    .map(
      (slot) => `
        <tr>
          <td style="padding:8px 0;">${slot.booking_date}</td>
          <td style="padding:8px 0;">${slot.start_time} - ${slot.end_time}</td>
          <td style="padding:8px 0;">${slot.address || "-"}</td>
        </tr>
      `
    )
    .join("");

  return `
    <div style="max-width:650px;margin:20px auto;padding:30px;border-radius:12px;
                background:#ffffff;box-shadow:0 4px 20px rgba(0,0,0,0.08);
                font-family:Arial,sans-serif;color:#333;">
      
      <h2 style="text-align:center;color:#198754;">
        ✅ Booking Confirmed
      </h2>

      <p style="font-size:16px;">Hello ${booking.user?.name || booking.user?.first_name || "User"},</p>

      <p style="font-size:15px;line-height:1.6;">
        Your booking with <strong>True Way Driving School</strong> has been successfully confirmed.
      </p>

      <div style="margin:20px 0;padding:15px;background:#f8f9fa;border-radius:8px;">
        <p style="margin:5px 0;"><strong>Booking ID:</strong> ${booking.uid}</p>
        <p style="margin:5px 0;"><strong>Package:</strong> ${booking.package?.name}</p>
        <p style="margin:5px 0;"><strong>Total Hours:</strong> ${booking.total_hours}</p>
        <p style="margin:5px 0;"><strong>Total Slots:</strong> ${(booking.slots || []).length}</p>
        <p style="margin:5px 0;"><strong>Amount Paid:</strong> $${booking.user_booking_amount}</p>
      </div>

      <h3 style="margin-top:25px;color:#0d6efd;">📅 Scheduled Lessons</h3>

      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px;">
        <thead>
          <tr style="text-align:left;border-bottom:1px solid #ddd;">
            <th style="padding:8px 0;">Date</th>
            <th style="padding:8px 0;">Time</th>
            <th style="padding:8px 0;">Pickup Address</th>
          </tr>
        </thead>
        <tbody>
          ${slotsHtml}
        </tbody>
      </table>

      <p style="margin-top:25px;font-size:14px;line-height:1.6;">
        Please arrive 5–10 minutes before your scheduled lesson time.
      </p>

      <hr style="border:none;border-top:1px solid #ddd;margin:25px 0;" />

      <p style="font-size:13px;color:#666;text-align:center;">
        🚗 Drive safe & learn smart!<br/>
        ${process.env.MAIL_FROM_NAME || "Support Team"}
      </p>
    </div>
  `;
};

const registrationSuccessTemplate = (user) => {
  return `
    <div style="max-width:650px;margin:20px auto;padding:30px;border-radius:12px;
                background:#ffffff;box-shadow:0 4px 20px rgba(0,0,0,0.08);
                font-family:Arial,sans-serif;color:#333;">

      <h2 style="text-align:center;color:#0d6efd;">
        🎉 Welcome to True Way Driving School!
      </h2>

      <p style="font-size:16px;">
        Hello ${user.first_name || "Student"},
      </p>

      <p style="font-size:15px;line-height:1.7;">
        We’re excited to welcome you to <strong>True Way Driving School</strong>.
        Your account has been successfully created, and you’re now ready to begin your driving journey with us.
      </p>

      <div style="margin:20px 0;padding:18px;background:#f8f9fa;border-radius:8px;">
        <p style="margin:6px 0;"><strong>Name:</strong> ${user.first_name} ${user.last_name || ""}</p>
        <p style="margin:6px 0;"><strong>Email:</strong> ${user.email}</p>
        <p style="margin:6px 0;"><strong>Registered On:</strong> ${new Date().toLocaleDateString()}</p>
      </div>

      <p style="font-size:15px;line-height:1.7;">
        You can now:
      </p>

      <ul style="font-size:14px;line-height:1.8;">
        <li>Book your driving lessons</li>
        <li>Select convenient time slots</li>
        <li>Track your bookings and payments</li>
        <li>Manage your learning progress</li>
      </ul>

      <p style="font-size:15px;line-height:1.7;">
        If you have any questions or need assistance, our support team is always here to help.
      </p>

      <hr style="border:none;border-top:1px solid #ddd;margin:25px 0;" />

      <p style="font-size:13px;color:#666;text-align:center;">
        🚗 Drive safe & learn smart!<br/>
        ${process.env.MAIL_FROM_NAME || "True Way Driving School Team"}
      </p>
    </div>
  `;
};

const lessonReminder24hTemplate = (slot) => {
  const userName = slot.booking.user.name || "Student";

  return `
  <div style="font-family: Arial, Helvetica, sans-serif; background-color:#f4f6f8; padding:30px;">
    
    <div style="max-width:600px; margin:auto; background:#ffffff; padding:30px; border-radius:8px; box-shadow:0 2px 8px rgba(0,0,0,0.05);">
      
      <h2 style="color:#1f2937; margin-bottom:10px;">
        🚗 Lesson Reminder – 24 Hours to Go
      </h2>

      <p style="color:#374151; font-size:15px;">
        Dear ${userName},
      </p>

      <p style="color:#374151; font-size:15px; line-height:1.6;">
        This is a reminder that your driving lesson is scheduled for tomorrow. 
        Please find the lesson details below:
      </p>

      <table style="width:100%; margin-top:20px; border-collapse:collapse;">
        <tr>
          <td style="padding:8px 0; font-weight:bold; color:#111827;">Date:</td>
          <td style="padding:8px 0; color:#374151;">${slot.booking_date}</td>
        </tr>
        <tr>
          <td style="padding:8px 0; font-weight:bold; color:#111827;">Time:</td>
          <td style="padding:8px 0; color:#374151;">
            ${slot.start_time} – ${slot.end_time}
          </td>
        </tr>
        <tr>
          <td style="padding:8px 0; font-weight:bold; color:#111827;">Car Type:</td>
          <td style="padding:8px 0; color:#374151;">${slot.car_type}</td>
        </tr>
        <tr>
          <td style="padding:8px 0; font-weight:bold; color:#111827;">Location:</td>
          <td style="padding:8px 0; color:#374151;">${slot.address || "-"}</td>
        </tr>
      </table>

      <p style="margin-top:25px; font-size:15px; color:#374151;">
        Kindly ensure you arrive on time. If you need assistance, please contact our support team.
      </p>

      <p style="margin-top:30px; font-size:14px; color:#6b7280;">
        Best regards,<br/>
        <strong>Your Driving School Team</strong>
      </p>

    </div>
  </div>
  `;
};

const adminLessonReminder24hTemplate = (slot) => {
  const user = slot.booking.user;

  return `
  <div style="font-family: Arial, Helvetica, sans-serif; background-color:#f4f6f8; padding:30px;">
    
    <div style="max-width:600px; margin:auto; background:#ffffff; padding:30px; border-radius:8px; box-shadow:0 2px 8px rgba(0,0,0,0.05);">
      
      <h2 style="color:#1f2937; margin-bottom:10px;">
        📢 Upcoming Lesson – 24 Hour Notice
      </h2>

      <p style="color:#374151; font-size:15px;">
        The following lesson is scheduled for tomorrow:
      </p>

      <table style="width:100%; margin-top:20px; border-collapse:collapse;">
        <tr>
          <td style="padding:8px 0; font-weight:bold; color:#111827;">User Name:</td>
          <td style="padding:8px 0; color:#374151;">${user.name}</td>
        </tr>
        <tr>
          <td style="padding:8px 0; font-weight:bold; color:#111827;">Email:</td>
          <td style="padding:8px 0; color:#374151;">${user.email}</td>
        </tr>
        <tr>
          <td style="padding:8px 0; font-weight:bold; color:#111827;">Date:</td>
          <td style="padding:8px 0; color:#374151;">${slot.booking_date}</td>
        </tr>
        <tr>
          <td style="padding:8px 0; font-weight:bold; color:#111827;">Time:</td>
          <td style="padding:8px 0; color:#374151;">
            ${slot.start_time} – ${slot.end_time}
          </td>
        </tr>
        <tr>
          <td style="padding:8px 0; font-weight:bold; color:#111827;">Car Type:</td>
          <td style="padding:8px 0; color:#374151;">${slot.car_type}</td>
        </tr>
      </table>

      <p style="margin-top:25px; font-size:14px; color:#6b7280;">
        This is an automated 24-hour reminder notification.
      </p>

    </div>
  </div>
  `;
};

const refundProcessedTemplate = (data) => {
  return `
    <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
      <h2 style="color:#2c3e50;">Refund Confirmation</h2>

      <p>Dear ${data.learner_name},</p>

      <p>
        Your refund request has been successfully processed.
      </p>

      <hr style="margin:20px 0;" />

      <h3>Refund Details</h3>
      <p><strong>Refund ID:</strong> ${data.refund_uid}</p>
      <p><strong>Amount Refunded:</strong> ${data.amount} ${data.currency}</p>
      <p><strong>Reason:</strong> ${data.reason}</p>
      <p><strong>Processed On:</strong> ${data.refunded_at}</p>
      <p><strong>Payment Method:</strong> ${data.gateway}</p>

      <hr style="margin:20px 0;" />

      <p>
        The amount will reflect in your account within 5–7 business days
        depending on your bank or payment provider.
      </p>

      <p>
        If you have any questions, please feel free to contact our support team.
      </p>

      <br/>

      <p>Best regards,</p>
      <p><strong>Your Company Team</strong></p>
    </div>
  `;
};

const otpEmailTemplate = (otp) => {
  return `
    <div style="font-family: Arial, sans-serif; background:#f4f6f8; padding:20px;">
      <div style="max-width:600px; margin:auto; background:#ffffff; padding:30px; border-radius:8px;">
        
        <h2 style="color:#333;">Email Verification Code</h2>
        
        <p>Your One-Time Password (OTP) is:</p>

        <div style="text-align:center; margin:30px 0;">
          <span style="
            font-size:30px;
            font-weight:bold;
            letter-spacing:5px;
            color:#2c3e50;
          ">
            ${otp}
          </span>
        </div>

        <p>This OTP is valid for <strong>10 minutes</strong>.</p>
        <p>Please do not share this code with anyone.</p>

        <hr style="margin:30px 0;" />
        <p style="font-size:12px; color:#888;">
          This is an automated email. Please do not reply.
        </p>

      </div>
    </div>
  `;
};


module.exports = {
  forgotPassTemp,
  contactFormTemp,
  sendForgotOtpTemp,
  empCredentialTemp,
  welcomeUserTemp,
  bookingConfirmationTemplate,
  registrationSuccessTemplate ,
  lessonReminder24hTemplate,
  adminLessonReminder24hTemplate,
  refundProcessedTemplate,
  otpEmailTemplate
};
