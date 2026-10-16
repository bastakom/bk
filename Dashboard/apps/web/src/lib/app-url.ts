/** Adress som servern når sig själv på (för Playwright och länkar i e-post). */
export const appUrl = () => process.env.APP_INTERNAL_URL ?? process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
