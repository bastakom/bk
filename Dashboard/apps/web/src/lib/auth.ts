import "server-only";
import { db } from "@rp/db";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";

export const auth = betterAuth({
  appName: "Rapportplattform",
  database: prismaAdapter(db, { provider: "postgresql" }),
  account: { modelName: "authAccount" },
  emailAndPassword: { enabled: true, minPasswordLength: 10 },
  session: { expiresIn: 60 * 60 * 24 * 14, cookieCache: { enabled: true, maxAge: 300 } },
  plugins: [nextCookies()],
});
