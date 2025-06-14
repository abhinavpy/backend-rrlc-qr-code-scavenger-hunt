const nodemailer = require('nodemailer');
const logger = require('../utils/logger'); // Assuming you have a logger utility

/**
 * Sends an email using nodemailer.
 * Configuration is read from environment variables.
 *
 * @param {object} options - Email options.
 * @param {string} options.to - Recipient's email address.
 * @param {string} options.subject - Subject of the email.
 * @param {string} [options.text] - Plain text body of the email.
 * @param {string} [options.html] - HTML body of the email.
 * @returns {Promise<object>} Nodemailer response object on success.
 * @throws {Error} If email sending fails.
 */
const sendEmail = async (options) => {
  // 1. Create a transporter
  // We'll use Gmail as per the .env file.
  // For Gmail, you might need to "allow less secure app access" in your Google account settings,
  // or preferably, set up an "App Password".
  const transporter = nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE, // e.g., 'gmail'
    auth: {
      user: process.env.EMAIL_USERNAME, // your_email@gmail.com
      pass: process.env.EMAIL_PASSWORD, // your_email_password or App Password
    },
    // For other services or direct SMTP:
    // host: process.env.EMAIL_HOST,
    // port: process.env.EMAIL_PORT,
    // secure: process.env.EMAIL_PORT == 465, // true for 465, false for other ports
  });

  // 2. Define the email options
  const mailOptions = {
    from: `"${process.env.EMAIL_FROM_NAME || 'QR Scavenger Hunt Admin'}" <${process.env.EMAIL_FROM_ADDRESS || process.env.EMAIL_USERNAME}>`, // sender address
    to: options.to, // list of receivers
    subject: options.subject, // Subject line
    text: options.text, // plain text body
    html: options.html, // html body
  };

  // 3. Actually send the email
  try {
    const info = await transporter.sendMail(mailOptions);
    logger.info(`Email sent: ${info.messageId} to ${options.to}`);
    return info;
  } catch (error) {
    logger.error(`Error sending email to ${options.to}: ${error.message}`);
    // Rethrow the error so the caller can handle it if needed
    throw new Error(`Failed to send email: ${error.message}`);
  }
};

module.exports = {
  sendEmail,
};