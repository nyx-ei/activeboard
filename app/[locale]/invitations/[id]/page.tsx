import { InvitationLinkLanding } from '@/components/invite/invitation-link-landing';
import type { AppLocale } from '@/i18n/routing';

type InvitationPageProps = {
  params: { id: string; locale: string };
};

export default function LocalizedInvitationPage({
  params,
}: InvitationPageProps) {
  const locale: AppLocale = params.locale === 'fr' ? 'fr' : 'en';

  return <InvitationLinkLanding invitationId={params.id} locale={locale} />;
}
