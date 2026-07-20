function isEmailInAllowlist(
  email: string | undefined,
  allowlist: string | undefined,
) {
  const normalizedEmail = email?.trim().toLowerCase();
  if (!normalizedEmail) {
    return false;
  }

  if (!allowlist) {
    return true;
  }

  return allowlist
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
    .includes(normalizedEmail);
}

export function canAccessAdminConsole(email: string | undefined) {
  return isEmailInAllowlist(
    email,
    process.env.ADMIN_CONSOLE_ALLOWED_EMAILS ??
      process.env.OPS_DASHBOARD_ALLOWED_EMAILS,
  );
}

export function canAccessOpsDashboard(email: string | undefined) {
  return isEmailInAllowlist(email, process.env.OPS_DASHBOARD_ALLOWED_EMAILS);
}
