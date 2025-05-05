
/**
 * @fileOverview Service for sending emails.
 * NOTE: This is a placeholder implementation and WILL NOT send real emails.
 */

// Placeholder for email sending logic.
// In a real application, you would:
// 1. Choose an email service provider (e.g., SendGrid, Mailgun, Resend).
// 2. Install their SDK (e.g., `@sendgrid/mail`, `nodemailer`).
// 3. Obtain API keys/credentials and store them securely (e.g., environment variables).
// 4. Replace the console logging below with actual email sending code using the SDK.

interface EmailOptions {
  to: string;
  subject: string;
  text?: string; // Plain text body
  html?: string; // HTML body
  attachments?: { filename: string; content: Buffer | string; contentType?: string }[];
}

/**
 * Sends an email (Simulated).
 * This function currently only logs the email details to the console.
 * @param options - The email options.
 * @returns A promise that resolves when the simulation is complete.
 */
export async function sendEmail(options: EmailOptions): Promise<void> {
  console.warn(`--- SIMULATING Email Sending (No real email will be sent) ---`);
  console.log(`To: ${options.to}`);
  console.log(`Subject: ${options.subject}`);
  if (options.text) {
    console.log(`Text Body: ${options.text.substring(0, 100)}...`);
  }
  if (options.html) {
    console.log(`HTML Body: [HTML Content Present]`);
  }
  if (options.attachments && options.attachments.length > 0) {
    console.log(`Attachments: ${options.attachments.map(a => a.filename).join(', ')}`);
    // To view attachment content (for debugging, might be large):
    // options.attachments.forEach(a => {
    //   console.log(`  - ${a.filename} (${a.contentType || 'N/A'}, ${typeof a.content === 'string' ? a.content.length + ' chars' : a.content.length + ' bytes'})`);
    // });
  }
  console.log(`--- End Email Simulation ---`);

  // Simulate email sending delay
  await new Promise(resolve => setTimeout(resolve, 500));

  // In a real implementation, replace the console logs above with actual email sending code.
  // Example using SendGrid:
  //
  // import sgMail from '@sendgrid/mail';
  // sgMail.setApiKey(process.env.SENDGRID_API_KEY || ''); // Use environment variable
  //
  // const msg = {
  //   to: options.to,
  //   from: 'your-verified-sender@example.com', // Change to your verified sender
  //   subject: options.subject,
  //   text: options.text,
  //   html: options.html,
  //   attachments: options.attachments?.map(a => ({
  //       content: typeof a.content === 'string' ? Buffer.from(a.content).toString('base64') : a.content.toString('base64'),
  //       filename: a.filename,
  //       type: a.contentType,
  //       disposition: 'attachment',
  //   })),
  // };
  //
  // try {
  //   await sgMail.send(msg);
  //   console.log('Email sent successfully via SendGrid.');
  // } catch (error) {
  //   console.error('Error sending email via SendGrid:', error);
  //   if (error.response) {
  //       console.error(error.response.body)
  //   }
  //   throw new Error('Failed to send email.'); // Re-throw or handle error appropriately
  // }

  // For now, we just resolve successfully as it's a simulation.
  return Promise.resolve();
}
