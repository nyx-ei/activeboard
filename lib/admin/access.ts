export function canAccessAdminConsole(email: string | undefined) {
  const allowlist =
    process.env.ADMIN_CONSOLE_ALLOWED_EMAILS ??
    process.env.OPS_DASHBOARD_ALLOWED_EMAILS;

  if (!allowlist) {
    return true;
  }

  const normalizedEmail = email?.trim().toLowerCase();
  if (!normalizedEmail) {
    return false;
  }

  return allowlist
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
    .includes(normalizedEmail);
}
