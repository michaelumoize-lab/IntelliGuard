# Better Auth Template

A modern, high-performance authentication template built with **Next.js**, **Better Auth**, **Prisma**, and **Tailwind CSS 4**. This template provides a robust foundation for building applications with advanced authentication needs, including admin management and multi-session support.

## 🚀 Features

- **Advanced Authentication**: Powered by [Better Auth](https://www.better-auth.com/).
  - Email & Password sign-up/sign-in.
  - Google OAuth integration.
  - Password reset & email verification.
  - Multi-session management (multiple accounts per user).
- **Admin Dashboard**: Built-in admin plugin for user management, banning, and impersonation.
- **Database**: [Prisma](https://www.prisma.io/) ORM with [Neon](https://neon.tech/) (PostgreSQL) adapter.
- **Modern UI**:
  - **Tailwind CSS 4**: The latest in utility-first CSS.
  - **Shadcn UI**: Beautiful, accessible components.
  - **Phosphor, Remix, and Lucide Icons**: Comprehensive icon sets.
  - **Next Themes**: Dark mode support.
- **Email Ready**: Integrated with **Resend** and **React Email** for beautiful transactional emails.
- **Type-Safe**: Full TypeScript support across the entire stack.

## 🛠️ Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) (App Router)
- **Auth**: [Better Auth](https://www.better-auth.com/)
- **ORM**: [Prisma](https://www.prisma.io/)
- **Database**: PostgreSQL (Neon)
- **Styling**: [Tailwind CSS 4](https://tailwindcss.com/)
- **Email**: [Resend](https://resend.com/) / [React Email](https://react.email/)

## 🏁 Getting Started

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd better-auth
```

### 2. Install dependencies

```bash
npm install
```

### 3. Environment Setup

Copy the `.env.example` file to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

Key variables required:

- `DATABASE_URL`: Your PostgreSQL connection string.
- `BETTER_AUTH_SECRET`: Generate a random secret (e.g., `openssl rand -base64 32`).
- `BETTER_AUTH_URL`: Your app's base URL (e.g., `http://localhost:3000`).
- `GOOGLE_CLIENT_ID` & `GOOGLE_CLIENT_SECRET`: From Google Cloud Console.
- `RESEND_API_KEY`: From Resend dashboard.

### 4. Database Setup

Initialize your database schema:

```bash
npx prisma db push

npx prisma generate
```

### 5. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see your app in action.

## 🗄️ Database Configuration

This template supports both **Prisma (PostgreSQL)** and **MongoDB**. By default, it is configured to use Prisma.

### Switching to MongoDB

If you prefer to use MongoDB:

1.  Open `lib/auth.ts`.
2.  Uncomment the MongoDB adapter and client imports:
    ```typescript
    import { mongodbAdapter } from "better-auth/adapters/mongodb";
    import { getClientPromise } from "./mongoose";
    ```
3.  Uncomment the database initialization:
    ```typescript
    const client = await getClientPromise();
    const db = client.db("better-auth");
    ```
4.  Switch the `database` configuration in the `betterAuth` object:
    ```typescript
    // database: prismaAdapter(prisma, { provider: "postgresql" }), // Comment this
    database: mongodbAdapter(db, { client }), // Uncomment this
    ```
5.  Set the `MONGODB_URI` in your `.env` file.

### 🧹 Cleanup

To keep your codebase clean, we recommend deleting the configuration and dependencies for the database you are **not** using:

- **If using MongoDB**: You can delete the `prisma/` directory, `lib/prisma.ts`, and remove `@prisma/client` and `prisma` dependencies from `package.json`.
- **If using Prisma**: You can delete `lib/mongoose.ts` and remove `mongodb` and `mongoose` dependencies from `package.json`.

## 📁 Project Structure

- `app/`: Next.js App Router routes.
  - `admin/`: Admin dashboard routes.
  - `auth/`: Authentication pages (sign-in, sign-up, error).
  - `dashboard/`: User-specific protected routes.
- `components/`: Reusable UI components.
  - `user/`: Auth-specific components like the `UserButton`.
- `lib/`: Shared utilities and configurations.
  - `auth.ts`: Better Auth server-side configuration.
  - `auth-client.ts`: Better Auth client-side configuration.
  - `prisma.ts`: Prisma client initialization.
  - `email.ts`: Email sending logic via Resend.
- `prisma/`: Database schema definition.
- `proxy.ts`: Middleware-like logic for role-based access control and session handling.

## 🛡️ Admin Access

By default, the template includes an admin dashboard. To grant a user admin privileges:

1. Sign up a new user.
2. Manually update the user's `role` to `"admin"` in the database.
3. Access the dashboard at `/admin`.

## 📄 License

This project is licensed under the MIT License.
