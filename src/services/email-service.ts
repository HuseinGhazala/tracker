
/**
 * @fileOverview Service for sending emails using Nodemailer and Gmail.
 * IMPORTANT SECURITY NOTICE:
 * - DO NOT hardcode your Gmail password here. Use environment variables.
 * - You MUST generate an "App Password" for your Gmail account and use that,
 *   not your regular account password.
 * - Enable 2-Step Verification on your Google Account to use App Passwords.
 * - Using personal Gmail for bulk or application emails has limitations and risks.
 *   Consider dedicated email services (SendGrid, Mailgun, Resend) for production.
 * See: https://support.google.com/accounts/answer/185833
 */
import nodemailer from 'nodemailer';

interface EmailOptions {
  to: string;
  subject: string;
  text?: string; // Plain text body
  html?: string; // HTML body
  attachments?: { filename: string; content: Buffer | string; contentType?: string }[];
}

// Configure the transporter using environment variables
// Ensure GMAIL_USER and GMAIL_APP_PASSWORD are set in your .env file
const transporter = nodemailer.createTransport({
  service: 'gmail', // Use Gmail service
  host: 'smtp.gmail.com',
  port: 465, // Use port 465 for SSL
  secure: true, // Use SSL
  auth: {
    user: process.env.GMAIL_USER, // Your Gmail address from .env
    pass: process.env.GMAIL_APP_PASSWORD, // Your Gmail App Password from .env
  },
});

/**
 * Sends an email using Nodemailer with Gmail.
 * @param options - The email options.
 * @returns A promise that resolves when the email is sent or rejects on error.
 * @throws Error if required environment variables are missing or email sending fails.
 */
export async function sendEmail(options: EmailOptions): Promise<void> {
  const { GMAIL_USER, GMAIL_APP_PASSWORD } = process.env;

  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    console.error('ERROR: Missing GMAIL_USER or GMAIL_APP_PASSWORD environment variables.');
    console.warn('Email sending is disabled. Please configure .env file.');
    // Optionally throw an error or return gracefully depending on desired behavior
    throw new Error('Email service is not configured. Missing credentials.');
    // return; // Or simply return without sending if failure is acceptable
  }

  const mailOptions = {
    from: `"Your App Name" <${GMAIL_USER}>`, // Sender address (must be your Gmail address)
    to: options.to, // List of receivers
    subject: options.subject, // Subject line
    text: options.text, // Plain text body
    html: options.html, // HTML body
    attachments: options.attachments?.map(a => ({
      filename: a.filename,
      content: a.content, // Nodemailer accepts Buffer or string directly
      contentType: a.contentType,
    })),
  };

  try {
    console.log(`Attempting to send email via Gmail to: ${options.to}`);
    const info = await transporter.sendMail(mailOptions);
    console.log(`Email sent successfully: ${info.messageId}`);
    console.log(`Preview URL: ${nodemailer.getTestMessageUrl(info)}`); // Useful for ethereal testing if set up
  } catch (error) {
    console.error('Error sending email via Gmail:', error);
    // Rethrow the error so the calling function (e.g., the Genkit flow) knows about the failure
    throw new Error(`Failed to send email: ${error instanceof Error ? error.message : String(error)}`);
  }
}
