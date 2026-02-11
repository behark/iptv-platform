const nodemailer = require('nodemailer');

const parseBoolean = (value) => {
  if (typeof value !== 'string') return false;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase().trim());
};

const parseNumber = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const getTransportConfig = () => {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const port = parseNumber(process.env.SMTP_PORT, 587);
  const secure = parseBoolean(process.env.SMTP_SECURE);

  if (!host || !user || !pass) {
    return null;
  }

  return {
    host,
    port,
    secure,
    auth: { user, pass }
  };
};

const getFromAddress = () => process.env.SMTP_FROM || 'IPTV Platform <no-reply@localhost>';

const sendPasswordResetEmail = async ({ to, resetLink }) => {
  const transportConfig = getTransportConfig();
  if (!transportConfig) {
    return { sent: false, reason: 'SMTP_NOT_CONFIGURED' };
  }

  const transporter = nodemailer.createTransport(transportConfig);
  await transporter.sendMail({
    from: getFromAddress(),
    to,
    subject: 'Reset your IPTV Platform password',
    text: `We received a request to reset your password.\n\nReset link: ${resetLink}\n\nIf you did not request this, ignore this email.`,
    html: `
      <p>We received a request to reset your password.</p>
      <p><a href="${resetLink}">Reset password</a></p>
      <p>If you did not request this, you can safely ignore this email.</p>
    `
  });

  return { sent: true };
};

module.exports = {
  sendPasswordResetEmail
};
