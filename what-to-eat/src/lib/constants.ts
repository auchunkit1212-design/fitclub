export const SUPER_ADMIN_EMAIL = "auchunkit1212@gmail.com";

export const FREE_MONTHLY_GENERATE_LIMIT = 1;
export const FREE_REGENERATE_PER_PLAN = 3;

export const BRAND_NAME_ZH = "食咩好";
export const BRAND_NAME_EN = "What to Eat";
export const BRAND_TAGLINE_ZH = "Nutrition Coach · 大猩猩教練";

export function getMainAppUrl(): string {
  return (
    process.env.MAIN_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_MAIN_APP_URL?.trim() ||
    "http://localhost:3000"
  );
}

export function getMainAppBillingUrl(): string {
  return (
    process.env.MAIN_APP_BILLING_URL?.trim() ||
    `${getMainAppUrl().replace(/\/$/, "")}/billing`
  );
}

export function getMainAppRegisterUrl(): string {
  return (
    process.env.MAIN_APP_REGISTER_URL?.trim() ||
    `${getMainAppUrl().replace(/\/$/, "")}/register`
  );
}
