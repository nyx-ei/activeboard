'use server';

import { createHash } from 'node:crypto';

import { createSupabaseAdminClient } from '@/lib/supabase/admin';

type SetupPasswordResult =
  | { ok: true }
  | {
      ok: false;
      reason:
        | 'missing_fields'
        | 'weak_password'
        | 'password_mismatch'
        | 'invalid_token'
        | 'unexpected_error';
    };

function hashPasswordSetupToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export async function setupLandingPasswordAction(
  formData: FormData,
): Promise<SetupPasswordResult> {
  const token = ((formData.get('token') as string | null) ?? '').trim();
  const password = ((formData.get('password') as string | null) ?? '').trim();
  const confirmPassword = (
    (formData.get('confirmPassword') as string | null) ?? ''
  ).trim();

  if (!token || !password || !confirmPassword) {
    return { ok: false, reason: 'missing_fields' };
  }

  if (password !== confirmPassword) {
    return { ok: false, reason: 'password_mismatch' };
  }

  if (password.length < 8) {
    return { ok: false, reason: 'weak_password' };
  }

  const admin = createSupabaseAdminClient();
  const tokenHash = hashPasswordSetupToken(token);
  const { data: setupToken, error: setupTokenError } = await admin
    .schema('public')
    .from('password_setup_tokens')
    .select('token_hash, user_id, expires_at, used_at')
    .eq('token_hash', tokenHash)
    .maybeSingle();

  if (
    setupTokenError ||
    !setupToken ||
    setupToken.used_at ||
    new Date(setupToken.expires_at).getTime() < Date.now()
  ) {
    return { ok: false, reason: 'invalid_token' };
  }

  const { error: updateError } = await admin.auth.admin.updateUserById(
    setupToken.user_id,
    {
      password,
    },
  );

  if (updateError) {
    return { ok: false, reason: 'unexpected_error' };
  }

  const { error: markUsedError } = await admin
    .schema('public')
    .from('password_setup_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('token_hash', tokenHash)
    .is('used_at', null);

  if (markUsedError) {
    return { ok: false, reason: 'unexpected_error' };
  }

  return { ok: true };
}
