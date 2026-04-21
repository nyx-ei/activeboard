import DashboardPage from '../../dashboard/page';

export default async function GroupRoutePage({
  params,
  searchParams,
}: {
  params: { locale: string; groupId: string };
  searchParams: { feedbackMessage?: string; feedbackTone?: string; live?: string };
}) {
  return (
    <DashboardPage
      params={{ locale: params.locale }}
      searchParams={{
        view: 'group',
        groupId: params.groupId,
        feedbackMessage: searchParams.feedbackMessage,
        feedbackTone: searchParams.feedbackTone,
        live: searchParams.live,
      }}
    />
  );
}
