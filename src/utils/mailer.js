const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');

// 1. Configure the connection to your specific Gmail account
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'ap730077@gmail.com',
    pass: process.env.EMAIL_PASSWORD // Set via .env
  }
});

// 2. The function to build and send the email
const sendHunterEmail = async (hunterEmail, bounty) => {
  const mailOptions = {
    from: `"Bounty Chain Platform" <${process.env.EMAIL_USER || 'ap730077@gmail.com'}>`,
    to: hunterEmail,
    subject: `🎯 Bounty Secured: ${bounty.title}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
        <h2 style="color: #4F46E5;">Bounty Successfully Claimed! 🎉</h2>
        <p>You have officially locked in this bounty. ${bounty.attachmentPath ? 'The assignment file is attached to this email.' : ''}</p>
        
        <h3 style="border-bottom: 2px solid #f3f4f6; padding-bottom: 8px;">Task Details</h3>
        <ul>
          <li><strong>Title:</strong> ${bounty.title}</li>
          <li><strong>Description:</strong> ${bounty.description}</li>
          <li><strong>Payable Reward:</strong> ₹${bounty.bountyAmount - 50} (after ₹50 platform fee)</li>
        </ul>
        
        <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">
          <em>Note for security: The poster's contact information is kept anonymous at this stage. Please complete the ${bounty.attachmentPath ? 'attached ' : ''}assignment to proceed.</em>
        </p>
      </div>
    `
  };

  if (bounty.attachmentPath) {
    const fullPath = path.join(__dirname, '../../uploads', bounty.attachmentPath);
    if (fs.existsSync(fullPath)) {
      mailOptions.attachments = [
        {
          filename: bounty.attachmentPath,
          path: fullPath
        }
      ];
    } else {
      console.warn(`[Mailer Warning] Attachment file not found at path: ${fullPath}`);
    }
  }

  return transporter.sendMail(mailOptions);
};

module.exports = { sendHunterEmail };