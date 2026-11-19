'use strict';

require('dotenv').config();
const { sendTestEmail, isEmailEnabled } = require('../services/mailer');

(async () => {
  try {
    if (!isEmailEnabled()) {
      console.error('Error: Email alerts are disabled. Please set SMTP_HOST, SMTP_USER, SMTP_PASS, and OWNER_EMAIL in your .env file.');
      process.exit(1);
    }

    console.log('Sending test email to configured OWNER_EMAIL...');
    const info = await sendTestEmail();
    console.log('Success: Test email sent successfully.');
    if (info && info.messageId) {
      console.log('Message ID:', info.messageId);
    }
    process.exit(0);
  } catch (err) {
    console.error('Error: Failed to send test email.');
    console.error('Reason:', err && err.message ? err.message : 'Unknown error');
    process.exit(1);
  }
})();
