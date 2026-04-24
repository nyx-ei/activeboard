import type { PwaAdoptionReport } from '@/lib/monitoring/pwa-adoption';

export function PwaAdoptionReportCard({
  report,
  labels,
}: {
  report: PwaAdoptionReport;
  labels: {
    title: string;
    description: string;
    loggingDisabled: string;
    promptShown: string;
    installAccepted: string;
    homeScreenLaunch: string;
    events: string;
    users: string;
    sessionDeviceSplit: string;
    emptyState: string;
    deviceLabels: Record<string, string>;
  };
}) {
  return (
    <section className="mt-6 border-t border-white/[0.06] pt-5">
      <div className="surface-mockup p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-extrabold text-white">{labels.title}</h2>
            <p className="mt-1 text-sm text-slate-400">{labels.description}</p>
          </div>
          <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.12em] text-slate-400">
            {report.windowDays}d
          </span>
        </div>

        {!report.loggingEnabled ? (
          <p className="mt-4 text-sm font-bold text-amber-300">{labels.loggingDisabled}</p>
        ) : (
          <>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {[
                [labels.promptShown, report.pwaFunnel.promptShownEvents, report.pwaFunnel.promptShownUsers],
                [labels.installAccepted, report.pwaFunnel.installAcceptedEvents, report.pwaFunnel.installAcceptedUsers],
                [labels.homeScreenLaunch, report.pwaFunnel.homeScreenLaunchEvents, report.pwaFunnel.homeScreenLaunchUsers],
              ].map(([label, events, users]) => (
                <div key={label} className="rounded-[12px] border border-white/[0.06] bg-[#0f1628] p-4">
                  <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-slate-500">{label}</p>
                  <div className="mt-3 flex items-end justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-bold text-slate-500">{labels.events}</p>
                      <p className="text-xl font-extrabold text-white">{events}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] font-bold text-slate-500">{labels.users}</p>
                      <p className="text-lg font-extrabold text-brand">{users}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-[12px] border border-white/[0.06] bg-[#0f1628] p-4">
              <h3 className="text-sm font-extrabold text-white">{labels.sessionDeviceSplit}</h3>
              <div className="mt-3 space-y-2">
                {report.sessionDeviceSplit.length > 0 ? (
                  report.sessionDeviceSplit.map((row) => (
                    <div key={row.deviceType} className="flex items-center justify-between gap-3 rounded-[10px] border border-white/[0.05] px-3 py-2">
                      <span className="text-sm font-bold text-slate-300">{labels.deviceLabels[row.deviceType] ?? row.deviceType}</span>
                      <div className="flex items-center gap-4 text-xs font-bold">
                        <span className="text-slate-500">{labels.events}: <span className="text-white">{row.eventCount}</span></span>
                        <span className="text-slate-500">{labels.users}: <span className="text-brand">{row.userCount}</span></span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm font-bold text-slate-500">{labels.emptyState}</p>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
