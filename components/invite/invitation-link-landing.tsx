import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import { AuthForm } from '@/components/auth/auth-form';
import { InvitationAutoAccept } from '@/components/invite/invitation-auto-accept';
import { InvitationSignupFlow } from '@/components/invite/invitation-signup-flow';
import { SwitchAccountButton } from '@/components/invite/switch-account-button';
import type { AppLocale } from '@/i18n/routing';
import { getCurrentUser } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { normalizeEmail } from '@/lib/utils';

type InvitationLinkLandingProps = {
  invitationId: string;
  locale?: AppLocale;
};

type ResolvedInvitation = {
  id: string;
  groupInviteId: string;
  groupId: string;
  invitedBy: string;
  invitedEmail: string;
  invitedUserId: string | null;
  status: string;
  expiresAt: string;
};

function parseLocale(value: string | null | undefined): AppLocale {
  return value === 'fr' ? 'fr' : 'en';
}

function isExpired(expiresAt: string) {
  return (
    Number.isFinite(Date.parse(expiresAt)) && Date.parse(expiresAt) < Date.now()
  );
}

async function resolveInvitation(
  invitationId: string,
): Promise<ResolvedInvitation | null> {
  const admin = createSupabaseAdminClient();

  const { data: invitation } = await admin
    .schema('public')
    .from('invitations')
    .select(
      'id, group_invite_id, group_id, invited_by, invited_email, invited_user_id, status, expires_at',
    )
    .eq('id', invitationId)
    .maybeSingle();

  if (invitation) {
    return {
      id: invitation.id,
      groupInviteId: invitation.group_invite_id,
      groupId: invitation.group_id,
      invitedBy: invitation.invited_by,
      invitedEmail: invitation.invited_email,
      invitedUserId: invitation.invited_user_id,
      status: invitation.status,
      expiresAt: invitation.expires_at,
    };
  }

  const { data: legacyInvite } = await admin
    .schema('public')
    .from('group_invites')
    .select(
      'id, group_id, invited_by, invitee_email, invitee_user_id, status, created_at',
    )
    .eq('id', invitationId)
    .maybeSingle();

  if (!legacyInvite) {
    return null;
  }

  const { data: unifiedByLegacyId } = await admin
    .schema('public')
    .from('invitations')
    .select(
      'id, group_invite_id, group_id, invited_by, invited_email, invited_user_id, status, expires_at',
    )
    .eq('group_invite_id', legacyInvite.id)
    .maybeSingle();

  if (unifiedByLegacyId) {
    return {
      id: unifiedByLegacyId.id,
      groupInviteId: unifiedByLegacyId.group_invite_id,
      groupId: unifiedByLegacyId.group_id,
      invitedBy: unifiedByLegacyId.invited_by,
      invitedEmail: unifiedByLegacyId.invited_email,
      invitedUserId: unifiedByLegacyId.invited_user_id,
      status: unifiedByLegacyId.status,
      expiresAt: unifiedByLegacyId.expires_at,
    };
  }

  const createdAt = legacyInvite.created_at ?? new Date().toISOString();
  return {
    id: legacyInvite.id,
    groupInviteId: legacyInvite.id,
    groupId: legacyInvite.group_id,
    invitedBy: legacyInvite.invited_by,
    invitedEmail: legacyInvite.invitee_email,
    invitedUserId: legacyInvite.invitee_user_id,
    status: legacyInvite.status,
    expiresAt: new Date(
      Date.parse(createdAt) + 7 * 24 * 60 * 60 * 1000,
    ).toISOString(),
  };
}

export async function InvitationLinkLanding({
  invitationId,
  locale: explicitLocale,
}: InvitationLinkLandingProps) {
  const admin = createSupabaseAdminClient();
  const invitation = await resolveInvitation(invitationId);
  const user = await getCurrentUser();

  const [{ data: group }, { data: existingInvitee }, { data: inviter }] =
    invitation
      ? await Promise.all([
          admin
            .schema('public')
            .from('groups')
            .select('id, name, invite_code')
            .eq('id', invitation.groupId)
            .maybeSingle(),
          admin
            .schema('public')
            .from('users')
            .select('id, email, display_name, locale')
            .eq('email', normalizeEmail(invitation.invitedEmail))
            .maybeSingle(),
          admin
            .schema('public')
            .from('users')
            .select('id, email, display_name, locale')
            .eq('id', invitation.invitedBy)
            .maybeSingle(),
        ])
      : [{ data: null }, { data: null }, { data: null }];

  const locale = parseLocale(
    explicitLocale ?? existingInvitee?.locale ?? inviter?.locale ?? null,
  );
  const t = await getTranslations({ locale, namespace: 'InviteFlow' });

  if (
    !invitation ||
    !group ||
    invitation.status !== 'pending' ||
    isExpired(invitation.expiresAt)
  ) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-[680px] items-center justify-center px-4 py-10">
        <section className="surface-mockup w-full max-w-[480px] p-6 text-center">
          <h1 className="text-2xl font-semibold text-white">
            {t('notFoundTitle')}
          </h1>
          <p className="mt-3 text-sm text-slate-400">
            {t('notFoundDescription')}
          </p>
          <Link
            href={`/${locale}`}
            className="button-primary mt-6 inline-flex h-12 items-center justify-center rounded-[8px] px-5 text-sm"
          >
            {t('backHome')}
          </Link>
        </section>
      </main>
    );
  }

  const invitationPath = `/${locale}/invitations/${invitation.id}`;
  const normalizedInviteEmail = normalizeEmail(invitation.invitedEmail);
  const normalizedUserEmail = normalizeEmail(user?.email ?? '');
  const inviterName = inviter?.display_name ?? inviter?.email ?? 'ActiveBoard';

  if (user && normalizedInviteEmail === normalizedUserEmail) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-[680px] items-center justify-center px-4 py-10">
        <InvitationAutoAccept
          invitationId={invitation.id}
          locale={locale}
          labels={{
            title: t('autoAcceptTitle'),
            description: t('autoAcceptDescription'),
            error: t('autoAcceptError'),
            retry: t('autoAcceptRetry'),
          }}
        />
      </main>
    );
  }

  if (user && normalizedInviteEmail !== normalizedUserEmail) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-[680px] items-center justify-center px-4 py-10">
        <section className="surface-mockup w-full max-w-[520px] p-6">
          <h1 className="text-2xl font-semibold text-white">
            {t('emailMismatchTitle')}
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            {t('emailMismatchDescription', { email: invitation.invitedEmail })}
          </p>
          <SwitchAccountButton
            nextPath={`/${locale}/auth/login?next=${encodeURIComponent(invitationPath)}`}
            label={t('useMatchingAccount')}
          />
        </section>
      </main>
    );
  }

  const inviteSummary = (
    <section className="surface-mockup p-6 lg:p-8">
      <span className="border-brand/25 bg-brand/10 inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-brand">
        {t('joinTitle')}
      </span>
      <h1 className="mt-4 text-3xl font-semibold text-white">{group.name}</h1>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-400">
        {t('linkLandingDescription', {
          groupName: group.name,
          inviterName,
        })}
      </p>
      <div className="mt-6 rounded-[18px] border border-white/[0.06] bg-white/[0.03] p-5">
        <p className="text-sm font-semibold text-white">
          {t('lockedEmailPreview', { email: invitation.invitedEmail })}
        </p>
        <p className="mt-2 text-sm text-slate-400">{t('expiresInSevenDays')}</p>
      </div>
    </section>
  );

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[1120px] items-center justify-center px-4 py-10">
      <div className="grid w-full max-w-5xl gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
        {inviteSummary}
        {existingInvitee?.id ? (
          <section className="surface-mockup p-6">
            <div className="border-brand/20 bg-brand/10 mb-5 rounded-[14px] border p-4">
              <h2 className="text-lg font-semibold text-white">
                {t('existingInviteeTitle')}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                {t('existingInviteeDescription')}
              </p>
            </div>
            <AuthForm
              initialMode="sign-in"
              initialEmail={invitation.invitedEmail}
              redirectToOverride={invitationPath}
              lockedEmail={invitation.invitedEmail}
              variant="modal"
            />
          </section>
        ) : (
          <InvitationSignupFlow
            groupInviteId={invitation.groupInviteId}
            invitationPath={invitationPath}
            lockedEmail={invitation.invitedEmail}
            locale={locale}
            groupName={group.name}
            labels={{
              title: t('newInviteeTitle'),
              description: t('newInviteeDescription'),
              lockedEmail: t('lockedEmail'),
              displayName: t('displayName'),
              displayNamePlaceholder: t('displayNamePlaceholder'),
              password: t('password'),
              confirmPassword: t('confirmPassword'),
              passwordHint: t('passwordHint'),
              createAccount: t('createAccount'),
              creatingAccount: t('creatingAccount'),
              signInTitle: t('newInviteeSignInTitle'),
              signInDescription: t('newInviteeSignInDescription'),
              missingFields: t('signupMissingFields'),
              passwordMismatch: t('passwordMismatch'),
              accountExists: t('signupAccountExists'),
              genericError: t('signupGenericError'),
            }}
          />
        )}
      </div>
    </main>
  );
}
