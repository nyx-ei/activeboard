'use client';

import { useMemo, useState } from 'react';
import { ArrowLeft, Check } from 'lucide-react';

import { Link } from '@/i18n/navigation';
import type {
  OpsDashboardData,
  OpsDashboardRangeData,
  OpsRange,
} from '@/lib/ops/dashboard';

type OpsDashboardViewProps = {
  backHref: string;
  data: OpsDashboardData;
};

const panel = 'rounded-[10px] border border-[#27313c] bg-gradient-to-b from-[#141a21] to-[#11161c]';
const mono = 'font-mono tracking-[0.04em]';

function Dot({ tone }: { tone: 'ok' | 'warn' | 'crit' | 'info' }) {
  const className =
    tone === 'ok'
      ? 'bg-[#2dd4bf] shadow-[0_0_8px_#2dd4bf]'
      : tone === 'warn'
        ? 'bg-[#f4b942] shadow-[0_0_8px_#f4b942]'
        : tone === 'crit'
          ? 'bg-[#f06560] shadow-[0_0_8px_#f06560]'
          : 'bg-[#6aa9f0]';

  return <span className={`inline-flex h-2 w-2 rounded-full ${className}`} />;
}

function Spark({ values, tone }: { values: number[]; tone: 'ok' | 'warn' | 'crit' }) {
  const max = Math.max(...values, 1);
  const points = values
    .map((value, index) => {
      const x = values.length === 1 ? 0 : (index / (values.length - 1)) * 120;
      const y = 22 - (value / max) * 18;
      return `${x},${y}`;
    })
    .join(' ');
  const stroke = tone === 'crit' ? '#f06560' : tone === 'warn' ? '#f4b942' : '#2dd4bf';

  return (
    <svg className="mt-3 block h-[26px] w-full" viewBox="0 0 120 26" preserveAspectRatio="none">
      <polyline fill="none" stroke={stroke} strokeWidth="1.6" points={points} />
    </svg>
  );
}

function KpiCard({ item }: { item: OpsDashboardRangeData['kpis'][number] }) {
  return (
    <article className={`${panel} px-[15px] py-3.5`}>
      <div className="mb-2 flex items-center gap-1.5 text-[11px] uppercase tracking-[0.06em] text-[#8a98a8]">
        <Dot tone={item.tone} />
        {item.label}
      </div>
      <div className="font-mono text-[26px] font-semibold leading-none text-[#dde6ee]">
        {item.value}
        {item.unit ? <small className="ml-1 text-[13px] font-normal text-[#5d6b7a]">{item.unit}</small> : null}
      </div>
      <div
        className={`mt-2 text-[11px] ${mono} ${
          item.tone === 'crit' ? 'text-[#f06560]' : item.tone === 'warn' ? 'text-[#f4b942]' : 'text-[#2dd4bf]'
        }`}
      >
        {item.delta}
      </div>
      <Spark values={item.spark} tone={item.tone} />
    </article>
  );
}

function PanelHeader({ title, src }: { title: string; src?: string }) {
  return (
    <div className="mb-3.5 flex items-center justify-between gap-4">
      <h2 className="text-[12px] font-semibold uppercase tracking-[0.09em] text-[#8a98a8]">{title}</h2>
      {src ? <span className={`${mono} text-[10px] text-[#5d6b7a]`}>{src}</span> : null}
    </div>
  );
}

function VolumeChart({
  rows,
}: {
  rows: OpsDashboardRangeData['volumeSeries'];
}) {
  const maxStack = Math.max(...rows.map((row) => row.founderSignups + row.inviteeSignups), 1);
  const maxLine = Math.max(...rows.map((row) => row.signins), 1);
  const linePoints = rows
    .map((row, index) => {
      const x = 38 + index * (540 / Math.max(rows.length - 1, 1));
      const y = 175 - (row.signins / maxLine) * 140;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg className="h-[210px] w-full" viewBox="0 0 620 210" preserveAspectRatio="none">
      {[0, 1, 2, 3].map((line) => {
        const y = 20 + line * 48;
        return <line key={line} x1="30" y1={y} x2="612" y2={y} stroke="#1f272f" strokeWidth="1" />;
      })}
      {rows.map((row, index) => {
        const slot = 540 / Math.max(rows.length, 1);
        const x = 48 + index * slot;
        const founderHeight = (row.founderSignups / maxStack) * 140;
        const inviteeHeight = (row.inviteeSignups / maxStack) * 140;
        return (
          <g key={row.label}>
            <rect x={x} y={176 - founderHeight} width="22" height={founderHeight} fill="#2dd4bf" opacity="0.85" rx="1" />
            <rect x={x} y={176 - founderHeight - inviteeHeight} width="22" height={inviteeHeight} fill="#6aa9f0" opacity="0.85" rx="1" />
            <text x={x + 11} y="202" fill="#5d6b7a" fontSize="9" fontFamily="monospace" textAnchor="middle">
              {row.label}
            </text>
          </g>
        );
      })}
      <polyline fill="none" stroke="#8a98a8" strokeWidth="1.8" strokeDasharray="2 3" points={linePoints} />
      {rows.map((row, index) => {
        const x = 38 + index * (540 / Math.max(rows.length - 1, 1));
        const y = 175 - (row.signins / maxLine) * 140;
        return <circle key={`${row.label}-signin`} cx={x} cy={y} r="2.2" fill="#dde6ee" />;
      })}
    </svg>
  );
}

function IncidentLog({
  incidents,
}: {
  incidents: OpsDashboardRangeData['incidents'];
}) {
  return (
    <div className="flex flex-col">
      {incidents.map((incident) => (
        <article key={incident.id} className="grid grid-cols-[14px_1fr_auto] gap-3 border-b border-[#1f272f] py-3 last:border-b-0">
          <div className="pt-1">
            <Dot tone={incident.severity === 'crit' ? 'crit' : incident.severity === 'warn' ? 'warn' : 'info'} />
          </div>
          <div className="min-w-0">
            <div className="mb-1 text-[13px] font-medium text-[#dde6ee]">{incident.title}</div>
            <div className="text-[11px] leading-5 text-[#8a98a8]">{incident.message}</div>
          </div>
          <div className={`${mono} whitespace-nowrap text-right text-[10px] text-[#5d6b7a]`}>
            {incident.meta}
            <br />
            <span
              className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[9px] uppercase ${
                incident.status === 'monitoring'
                  ? 'border-[#6b561d] bg-[#f4b942]/10 text-[#f4b942]'
                  : 'border-[#155e57] bg-[#2dd4bf]/10 text-[#2dd4bf]'
              }`}
            >
              {incident.status}
            </span>
          </div>
        </article>
      ))}
    </div>
  );
}

function SessionFunnel({
  rows,
}: {
  rows: OpsDashboardRangeData['sessionFunnel'];
}) {
  const max = Math.max(...rows.map((row) => row.count), 1);

  return (
    <div>
      <div className={`${mono} grid grid-cols-[170px_1fr_70px_92px] items-center gap-3 border-b border-[#1f272f] pb-1.5 text-[10px] text-[#5d6b7a] max-md:grid-cols-[1fr_56px] max-md:[&>*:nth-child(2)]:hidden max-md:[&>*:nth-child(4)]:hidden`}>
        <div>STEP</div>
        <div>VOLUME</div>
        <div className="text-right">CONV.</div>
        <div className="text-right">INCIDENTS</div>
      </div>
      {rows.map((row) => {
        const width = Math.max(5, Math.round((row.count / max) * 100));
        const incidentTone = row.incidents > 0 ? (row.incidents > 1 ? 'crit' : 'warn') : 'info';
        return (
          <div key={`${row.tag}-${row.label}`} className="grid grid-cols-[170px_1fr_70px_92px] items-center gap-3 py-2 max-md:grid-cols-1">
            <div className="flex items-center gap-2 text-[13px] text-[#dde6ee]">
              <span className={`${mono} rounded border border-[#27313c] px-1 py-0.5 text-[9px] text-[#5d6b7a]`}>{row.tag}</span>
              {row.label}
            </div>
            <div className="h-[22px] overflow-hidden rounded-[5px] border border-[#1f272f] bg-[#1a222b]">
              <div
                className="flex h-full items-center justify-end rounded-l-[5px] bg-gradient-to-r from-[#155e57] to-[#2dd4bf] pr-2"
                style={{ width: `${width}%` }}
              >
                <span className={`${mono} text-[11px] font-semibold text-[#06201d]`}>{row.count}</span>
              </div>
            </div>
            <div className={`${mono} text-right text-[12px] text-[#8a98a8] max-md:text-left`}>
              {row.conversion === null ? '-' : `${row.conversion}%`}
            </div>
            <div className={`${mono} flex items-center justify-end gap-1.5 text-[11px] text-[#8a98a8] max-md:justify-start`}>
              <Dot tone={incidentTone} />
              {row.incidents}
            </div>
          </div>
        );
      })}
      <div className={`${mono} mt-3 flex flex-wrap gap-4 border-t border-[#1f272f] pt-3 text-[10px] text-[#5d6b7a]`}>
        <span className="flex items-center gap-1.5"><Dot tone="info" /> no incidents</span>
        <span className="flex items-center gap-1.5"><Dot tone="warn" /> degraded / partial</span>
        <span className="flex items-center gap-1.5"><Dot tone="crit" /> outage at this step</span>
      </div>
    </div>
  );
}

function MiniFunnel({
  rows,
  tone = 'ok',
}: {
  rows: Array<{ label: string; count: number; tone?: 'warn' | 'ok' | 'crit' }>;
  tone?: 'warn' | 'ok';
}) {
  const max = Math.max(...rows.map((row) => row.count), 1);
  return (
    <div className="flex flex-col gap-2.5">
      {rows.map((row) => {
        const color =
          row.tone === 'crit'
            ? 'from-[#5a2b2a] to-[#f06560]'
            : row.tone === 'warn' || tone === 'warn'
              ? 'from-[#6b561d] to-[#f4b942]'
              : 'from-[#1a8f82] to-[#2dd4bf]';
        return (
          <div key={row.label} className="grid grid-cols-[120px_1fr_52px] items-center gap-2.5">
            <div className="truncate text-[12px] text-[#8a98a8]">{row.label}</div>
            <div className="h-[18px] overflow-hidden rounded-[5px] border border-[#1f272f] bg-[#1a222b]">
              <div className={`h-full rounded-[5px] bg-gradient-to-r ${color}`} style={{ width: `${Math.max(3, pct(row.count, max))}%` }} />
            </div>
            <div className={`${mono} text-right text-[12px] text-[#dde6ee]`}>{row.count}</div>
          </div>
        );
      })}
    </div>
  );
}

function pct(value: number, max: number) {
  return max <= 0 ? 0 : Math.round((value / max) * 100);
}

function PipeItem({
  control,
}: {
  control: OpsDashboardRangeData['privacyControls'][number];
}) {
  const isOk = control.status === 'ok';
  const isCrit = control.status === 'crit';

  return (
    <div className="grid grid-cols-[auto_1fr_auto] items-start gap-3 border-b border-[#1f272f] py-2.5 last:border-b-0">
      <div
        className={`${mono} grid h-[22px] w-[22px] place-items-center rounded-md border text-[11px] font-semibold ${
          isCrit
            ? 'border-[#5a2b2a] bg-[#f06560]/10 text-[#f06560]'
            : isOk
              ? 'border-[#155e57] bg-[#2dd4bf]/10 text-[#2dd4bf]'
              : 'border-[#6b561d] bg-[#f4b942]/10 text-[#f4b942]'
        }`}
      >
        {isOk ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : isCrit ? '!' : '?'}
      </div>
      <div>
        <div className="text-[12.5px] font-medium text-[#dde6ee]">{control.title}</div>
        <div className="mt-0.5 text-[11px] leading-5 text-[#8a98a8]">{control.detail}</div>
      </div>
      <div className={`${mono} mt-0.5 whitespace-nowrap rounded border border-[#27313c] px-1.5 py-0.5 text-[9px] text-[#5d6b7a]`}>{control.tag}</div>
    </div>
  );
}

export function OpsDashboardView({ backHref, data }: OpsDashboardViewProps) {
  const [selectedRange, setSelectedRange] = useState<OpsRange>(
    data.defaultRange,
  );
  const [incidentMode, setIncidentMode] = useState<'all' | 'status'>('all');
  const rangeData = data.ranges[selectedRange];
  const rangeEntries = useMemo(
    () =>
      (Object.entries(data.ranges) as Array<
        [OpsRange, OpsDashboardData['ranges'][OpsRange]]
      >),
    [data.ranges],
  );
  const displayedIncidents =
    incidentMode === 'status'
      ? rangeData.status.tone === 'ok'
        ? rangeData.incidents.slice(0, 1)
        : rangeData.incidents.filter(
            (incident) => incident.status === 'monitoring',
          )
      : rangeData.incidents;

  return (
    <main data-ops-dashboard className="min-h-screen bg-[#0c1014] bg-[radial-gradient(1200px_600px_at_80%_-10%,rgba(45,212,191,.06),transparent_60%),radial-gradient(900px_500px_at_0%_110%,rgba(106,169,240,.05),transparent_60%)] px-[22px] py-[22px] text-[#dde6ee]">
      <style jsx global>{`
        body:has([data-ops-dashboard]) > div > div > header {
          display: none;
        }
        body:has([data-ops-dashboard]) > div,
        body:has([data-ops-dashboard]) > div > div {
          max-width: none;
          padding: 0;
          gap: 0;
        }
      `}</style>
      <div className="mx-auto max-w-[1240px]">
        <div className="mb-4">
          <Link href={backHref} className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#27313c] bg-[#141a21] px-3 text-[12px] font-medium text-[#8a98a8] transition hover:border-[#155e57] hover:text-[#2dd4bf]">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to dashboard
          </Link>
        </div>

        <header className="mb-5 flex flex-wrap items-end justify-between gap-5 border-b border-[#27313c] pb-4">
          <div className="flex items-center gap-3.5">
            <div className="grid h-[38px] w-[38px] place-items-center rounded-[9px] bg-gradient-to-br from-[#2dd4bf] to-[#1a8f82] font-mono text-[18px] font-semibold text-[#06201d] shadow-[0_0_0_1px_rgba(45,212,191,.3),0_6px_18px_-8px_rgba(45,212,191,.5)]">
              AB
            </div>
            <div>
              <h1 className="text-[17px] font-bold tracking-[0.01em]">ActiveBoard</h1>
              <div className={`${mono} text-[11px] uppercase text-[#5d6b7a]`}>Ops & Privacy Dashboard - internal</div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <span className={`${mono} inline-flex items-center gap-2 rounded-full border border-[#155e57] bg-[#141a21] px-3 py-1.5 text-[11px] text-[#2dd4bf]`}>
              <Dot tone="ok" /> PIPEDA - aggregate-only
            </span>
            <button
              type="button"
              onClick={() =>
                setIncidentMode((current) =>
                  current === 'status' ? 'all' : 'status',
                )
              }
              className={`${mono} inline-flex items-center gap-2 rounded-full border border-[#27313c] bg-[#141a21] px-3 py-1.5 text-[11px] text-[#8a98a8] transition hover:border-[#155e57] hover:text-[#2dd4bf]`}
              title={rangeData.status.summary}
            >
              <Dot tone={rangeData.status.tone} />
              {rangeData.status.label}
            </button>
            <div className="inline-flex overflow-hidden rounded-lg border border-[#27313c]">
              {rangeEntries.map(([range, item]) => (
                <button
                  key={range}
                  type="button"
                  onClick={() => setSelectedRange(range)}
                  className={`${mono} border-r border-[#27313c] px-3 py-1.5 text-[11px] transition last:border-r-0 ${
                    range === selectedRange
                      ? 'bg-[#1a222b] text-[#2dd4bf]'
                      : 'text-[#8a98a8] hover:bg-[#1a222b]/60 hover:text-[#dde6ee]'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </header>

        <section className="mb-3.5 grid gap-3.5 lg:grid-cols-5 md:grid-cols-2">
          {rangeData.kpis.map((item) => <KpiCard key={item.label} item={item} />)}
        </section>

        <section className="mb-3.5 grid gap-3.5 lg:grid-cols-[1.55fr_1fr]">
          <article className={`${panel} p-4`}>
            <div className="mb-3.5 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-[12px] font-semibold uppercase tracking-[0.09em] text-[#8a98a8]">Sign-up & Sign-in volume</h2>
              <div className={`${mono} flex flex-wrap gap-3 text-[11px] text-[#8a98a8]`}>
                <span><i className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm bg-[#2dd4bf]" />Sign-ups - founder</span>
                <span><i className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm bg-[#6aa9f0]" />Sign-ups - invitee</span>
                <span><i className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm bg-[#5d6b7a]" />Sign-ins</span>
              </div>
            </div>
            <VolumeChart rows={rangeData.volumeSeries} />
            <p className={`${mono} mt-2.5 text-[10px] leading-5 text-[#5d6b7a]`}>
              Sign-ups split by onboarding path. Sign-ins from auth callback events. Counts only; no identifiers leave the auth layer.
            </p>
          </article>

          <article className={`${panel} p-4`}>
            <PanelHeader title="Outages & incidents" src="app_logs" />
            <IncidentLog incidents={displayedIncidents} />
          </article>
        </section>

        <section className={`${panel} mb-3.5 p-4`}>
          <PanelHeader title="User flow - session funnel & where outages land" src={`app events x app_logs - ${rangeData.label} cohort`} />
          <SessionFunnel rows={rangeData.sessionFunnel} />
        </section>

        <section className="mb-3.5 grid gap-3.5 lg:grid-cols-3">
          <article className={`${panel} p-4`}>
            <PanelHeader title="Activation funnel" src={`auth + sessions - ${rangeData.label}`} />
            <MiniFunnel rows={rangeData.activationFunnel} />
            <p className={`${mono} mt-2.5 text-[10px] leading-5 text-[#5d6b7a]`}>
              Founder and invitee paths merge at Group ready. All rows are aggregate counts from application events.
            </p>
          </article>

          <article className={`${panel} p-4`}>
            <PanelHeader title="85 -> 100 -> subscribe" src="questions_answered" />
            <MiniFunnel rows={rangeData.subscriptionFunnel} tone="warn" />
            <p className={`${mono} mt-2.5 text-[10px] leading-5 text-[#5d6b7a]`}>
              Trial to Active conversion is computed only from aggregate user tier and question counters.
            </p>
          </article>

          <article className={`${panel} p-4`}>
            <PanelHeader title="PIPEDA posture" src="privacy-by-design" />
            {rangeData.privacyControls.map((control) => (
              <PipeItem key={control.id} control={control} />
            ))}
          </article>
        </section>

        <footer className={`${mono} mt-5 flex flex-wrap justify-between gap-2 border-t border-[#27313c] pt-3.5 text-[10px] text-[#5d6b7a]`}>
          <span>ActiveBoard - internal observability - aggregate production data</span>
          <span>generated {new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(data.generatedAt))}</span>
        </footer>
      </div>
    </main>
  );
}
