import { InvitationLinkLanding } from '@/components/invite/invitation-link-landing';

type InvitationPageProps = {
  params: { id: string };
};

export default function InvitationPage({ params }: InvitationPageProps) {
  return <InvitationLinkLanding invitationId={params.id} />;
}
