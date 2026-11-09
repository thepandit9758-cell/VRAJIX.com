const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_USER || 'vrajix11@gmail.com',
    pass: process.env.SMTP_PASS || ''
  }
});

async function sendEnquiryNotification(enquiry) {
  if (!process.env.SMTP_PASS) return;
  return transporter.sendMail({
    from: `"VRAJIX Alerts" <${process.env.SMTP_USER}>`,
    to: 'vrajix11@gmail.com',
    subject: `[New Lead - ${enquiry.refId}] ${enquiry.service} from ${enquiry.name}`,
    text: `Client Name: ${enquiry.name}\nEmail: ${enquiry.email}\nPhone: ${enquiry.phone}\nService: ${enquiry.service}\nDetails: ${enquiry.details}`
  });
}

module.exports = { sendEnquiryNotification };
