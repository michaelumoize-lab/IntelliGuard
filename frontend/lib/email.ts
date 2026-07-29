import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

interface SendEmailValues {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

const fromEmail = process.env.EMAIL_FROM || "Better Auth <support@mail.studysync.website>";

export async function sendEmail({ to, subject, text, html }: SendEmailValues) {
  const { error } = await resend.emails.send({
    from: fromEmail,
    to,
    subject,
    text,
    html,
  });

  if (error) {
    console.error("Failed to send email:", error);
    throw new Error(`Failed to send email: ${error.message}`);
  }
}

// // lib/email.ts
// import { Resend } from 'resend';

// const resend = new Resend(process.env.RESEND_API_KEY);
// const fromEmail = process.env.EMAIL_FROM || 'onboarding@resend.dev';

// export async function sendEmail({
//   to,
//   subject,
//   html,
// }: {
//   to: string;
//   subject: string;
//   html: string;
// }) {
//   try {
//     await resend.emails.send({
//       from: fromEmail,
//       to,
//       subject,
//       html,
//     });
//   } catch (error) {
//     console.error('Failed to send email:', error);
//     throw error;
//   }
// }
