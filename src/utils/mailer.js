const nodemailer = require('nodemailer');
const path = require('path');

// 1. Configure the connection to your specific Gmail account
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'ap730077@gmail.com',
    pass: process.env.EMAIL_PASSWORD // We will set this up in Step 4!
  }
});

// 2. The function to build and send the email
const sendHunterEmail = async (hunterEmail, bounty) => {
  // Find exactly where the file is stored on your server
  const filePath = path.join(__dirname, '../../uploads', bounty.attachmentPath);

  const mailOptions = {
    from: '"Bounty Chain Platform" <ap730077@gmail.com>',
    to: hunterEmail,
    subject: `🎯 Bounty Secured: ${bounty.title}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
        <h2 style="color: #4F46E5;">Bounty Successfully Claimed! 🎉</h2>
        <p>You have officially locked in this bounty. The assignment file is attached to this email.</p>
        
        <h3 style="border-bottom: 2px solid #f3f4f6; padding-bottom: 8px;">Task Details</h3>
        <ul>
          <li><strong>Title:</strong> ${bounty.title}</li>
          <li><strong>Description:</strong> ${bounty.description}</li>
          <li><strong>Bounty Reward:</strong> ₹${bounty.bountyAmount}</li>
        </ul>
        
        <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">
          <em>Note for security: The poster's contact information is kept anonymous at this stage. Please complete the attached assignment to proceed.</em>
        </p>
      </div>
    `,
    attachments: [
      {
        filename: bounty.attachmentPath,
        path: filePath // This attaches the exact file from your uploads folder
      }
    ]
  };

  return transporter.sendMail(mailOptions);
};

module.exports = { sendHunterEmail };