// lib/auth.ts

import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@/lib/prisma";
import { admin, multiSession } from "better-auth/plugins";
import { sendEmail } from "@/lib/email";
import { nextCookies } from "better-auth/next-js";
import { waitUntil } from "@vercel/functions";

import { render } from "@react-email/render";
import { EmailVerificationEmail, ResetPasswordEmail } from "@/components/email";

// import { mongodbAdapter } from "better-auth/adapters/mongodb";
// import { getClientPromise } from "./mongoose";

// const client = await getClientPromise();
// const db = client.db("better-auth");

const BETTER_AUTH_SECRET = process.env.BETTER_AUTH_SECRET;
if (!BETTER_AUTH_SECRET) {
  throw new Error("BETTER_AUTH_SECRET environment variable is required");
}

export const auth = betterAuth({
  // database: mongodbAdapter(db, { client }),
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  secret: BETTER_AUTH_SECRET,
  plugins: [nextCookies(), admin(), multiSession()],
  trustedOrigins: [
    "http://localhost:3000",
    "https://better-auth-dun.vercel.app",
  ],
  emailAndPassword: {
    enabled: true,
    sendResetPassword: async ({ user, url }) => {
      const html = await render(
        ResetPasswordEmail({
          url,
          email: user.email,
          appName: "Better Auth",
          expirationMinutes: 60,
          poweredBy: false,
        })
      );

      const emailPromise = sendEmail({
        to: user.email,
        subject: "Reset your password",
        text: `Reset your password: ${url}`,
        html,
      });

      if (process.env.NODE_ENV === "production") {
        waitUntil(emailPromise);
      } else {
        await emailPromise;
      }
    },
  },
  emailVerification: {
    enabled: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }: { user: { email: string }; url: string }) => {
      const html = await render(
        EmailVerificationEmail({
          url,
          email: user.email,
          appName: "Better Auth",
          expirationMinutes: 60,
          poweredBy: false,
        })
      );

      const emailPromise = sendEmail({
        to: user.email,
        subject: "Verify your email address",
        text: `Verify your email: ${url}`,
        html,
      });

      if (process.env.NODE_ENV === "production") {
        waitUntil(emailPromise);
      } else {
        await emailPromise;
      }
    },
  },
  user: {
    deleteUser: {
      enabled: true,
      sendDeleteAccountVerification: async ({ user, url }) => {
        const emailPromise = sendEmail({
          to: user.email,
          subject: "Confirm account deletion",
          text: `Click the link to confirm deleting your account: ${url}`,
        });

        if (process.env.NODE_ENV === "production") {
          waitUntil(emailPromise);
        } else {
          await emailPromise;
        }
      },
    },
    changeEmail: {
      enabled: true,
      sendChangeEmailVerification: async ({
        newEmail,
        url,
      }: {
        newEmail: string;
        url: string;
      }) => {
        const emailPromise = sendEmail({
          to: newEmail,
          subject: "Verify your new email address",
          text: `Click the link to verify your new email: ${url}`,
        });

        if (process.env.NODE_ENV === "production") {
          waitUntil(emailPromise);
        } else {
          await emailPromise;
        }
      },
    },
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    },
  },
  advanced: {
    disableErrorPage: true,
    defaultCookieAttributes: {
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
    },
    onAPIError: {
      disableErrorPage: true,
    },
  },
});

export type Auth = typeof auth;
