'use client';

import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Search,
  UserRoundCheck,
  UsersRound,
} from 'lucide-react';

import { Link } from '@/i18n/navigation';
import type {
  OpsAdoptionMember,
  OpsAdoptionStatus,
  OpsDashboardData,
  OpsRange,
} from '@/lib/ops/dashboard';

type OpsDashboardViewProps = {
  backHref: string;
  data: OpsDashboardData;
};

type StatusFilter = 'all' | OpsAdoptionStatus | 'leader';

const panel =
  'rounded-[10px] border border-[#234238] bg-[#0f2d26]/88 shadow-[inset_0_1px_0_rgba(255,255,255,.04)]';
const muted = 'text-[#9fb8b0]';
const mono = 'font-mono tracking-[0.02em]';

const statusLabels: Record<OpsAdoptionStatus, string> = {
  active: 'Actif',
  follow_up: 'A relancer',
  inactive: 'Inactif',
  new: 'Nouveau',
};

const statusClasses: Record<OpsAdoptionStatus, string> = {
  active: 'border-emerald-300/30 bg-emerald-400/12 text-emerald-200',
  follow_up: 'border-amber-300/35 bg-amber-300/12 text-amber-200',
  inactive: 'border-red-300/35 bg-red-400/12 text-red-200',
  new: 'border-sky-300/35 bg-sky-300/12 text-sky-200',
};

function StatusPill({ status }: { status: OpsAdoptionStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClasses[status]}`}
    >
      {statusLabels[status]}
    </span>
  );
}

function KpiCard({
  label,
  value,
  detail,
  icon,
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: React.ReactNode;
}) {
  return (
    <article className={`${panel} p-4`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-[#c9dbd6]">{label}</p>
        <div className="grid h-9 w-9 place-items-center rounded-lg border border-[#27594b] bg-[#123a31] text-[#27e0b4]">
          {icon}
        </div>
      </div>
      <div className="text-3xl font-black leading-none text-white">{value}</div>
      <p className={`mt-2 text-sm ${muted}`}>{detail}</p>
    </article>
  );
}

function formatDate(value: string | null) {
  if (!value) return 'Aucune activite';

  return new Intl.DateTimeFormat('fr', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function formatGeneratedAt(value: string) {
  return new Intl.DateTimeFormat('fr', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function groupActivityLabel(value: string | null) {
  if (!value) return 'aucune activite';
  const date = new Date(value);
  const deltaDays = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (deltaDays <= 0) return "aujourd'hui";
  if (deltaDays === 1) return 'hier';
  return `il y a ${deltaDays} j`;
}

function MemberAvatar({ member }: { member: OpsAdoptionMember }) {
  return (
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[#2b6857] bg-[#155545] text-sm font-black text-[#bff7e7]">
      {member.initials}
    </span>
  );
}

export function OpsDashboardView({ backHref, data }: OpsDashboardViewProps) {
  const [selectedRange, setSelectedRange] = useState<OpsRange>(data.defaultRange);
  const [selectedGroupId, setSelectedGroupId] = useState('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const rangeData = data.ranges[selectedRange];
  const rangeEntries = Object.entries(data.ranges) as Array<
    [OpsRange, OpsDashboardData['ranges'][OpsRange]]
  >;

  const filteredMembers = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return rangeData.members.filter((member) => {
      if (selectedGroupId !== 'all' && member.groupId !== selectedGroupId) {
        return false;
      }
      if (statusFilter === 'leader' && !member.isLeader) return false;
      if (
        statusFilter !== 'all' &&
        statusFilter !== 'leader' &&
        member.status !== statusFilter
      ) {
        return false;
      }
      if (!normalizedSearch) return true;
      return (
        member.memberName.toLowerCase().includes(normalizedSearch) ||
        member.email.toLowerCase().includes(normalizedSearch) ||
        member.groupName.toLowerCase().includes(normalizedSearch)
      );
    });
  }, [rangeData.members, search, selectedGroupId, statusFilter]);

  const focusGroups = rangeData.groups.slice(0, 6);

  return (
    <main
      data-ops-dashboard
      className="min-h-screen bg-[#03110f] bg-[radial-gradient(900px_520px_at_85%_-10%,rgba(39,224,180,.12),transparent_65%),radial-gradient(720px_460px_at_10%_110%,rgba(48,112,96,.22),transparent_65%)] px-4 py-5 text-[#eaf7f3] sm:px-6"
    >
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

      <div className="mx-auto max-w-[1320px]">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <Link
            href={backHref}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#234238] bg-[#0f2d26] px-3 text-sm font-bold text-[#b9d1cb] transition hover:border-[#27e0b4] hover:text-[#27e0b4]"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Retour dashboard
          </Link>
          <span className={`${mono} text-xs text-[#7fa096]`}>
            mis a jour {formatGeneratedAt(data.generatedAt)}
          </span>
        </div>

        <header className="mb-5 grid gap-4 border-b border-[#234238] pb-5 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <div className="mb-3 flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-[10px] bg-[#27e0b4] text-lg font-black text-[#03201a]">
                AB
              </div>
              <div>
                <p className={`${mono} text-xs uppercase text-[#7fa096]`}>
                  adoption interne
                </p>
                <h1 className="text-2xl font-black text-white sm:text-3xl">
                  Pilotage adoption par groupe
                </h1>
              </div>
            </div>
            <p className={`max-w-3xl text-sm leading-6 ${muted}`}>
              Vue dynamique des groupes, membres, questions, revisions et sessions
              planifiees pour identifier rapidement qui est actif et qui doit etre
              relance.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {rangeEntries.map(([range, item]) => (
              <button
                key={range}
                type="button"
                onClick={() => setSelectedRange(range)}
                className={`${mono} h-10 rounded-lg border px-4 text-sm font-bold transition ${
                  selectedRange === range
                    ? 'border-[#27e0b4] bg-[#27e0b4] text-[#03201a]'
                    : 'border-[#234238] bg-[#0f2d26] text-[#b9d1cb] hover:border-[#27e0b4] hover:text-[#27e0b4]'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </header>

        <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="Groupes suivis"
            value={rangeData.summary.groupsCount}
            detail={`${rangeData.summary.membersCount} membres au total`}
            icon={<UsersRound className="h-5 w-5" aria-hidden="true" />}
          />
          <KpiCard
            label="Membres actifs"
            value={rangeData.summary.activeMembersCount}
            detail={`${rangeData.summary.followUpMembersCount} a relancer`}
            icon={<UserRoundCheck className="h-5 w-5" aria-hidden="true" />}
          />
          <KpiCard
            label="Questions faites"
            value={rangeData.summary.questionsDone}
            detail={`${rangeData.summary.questionsReviewed} questions revisees`}
            icon={<CheckCircle2 className="h-5 w-5" aria-hidden="true" />}
          />
          <KpiCard
            label="Sessions planifiees"
            value={rangeData.summary.scheduledSessions}
            detail={`${rangeData.summary.inactiveMembersCount} membres inactifs`}
            icon={<CalendarClock className="h-5 w-5" aria-hidden="true" />}
          />
        </section>

        <section className="mb-5 grid gap-4 xl:grid-cols-[360px_1fr]">
          <aside className={`${panel} p-4`}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-black text-white">Groupes prioritaires</h2>
              <span className={`${mono} text-xs text-[#7fa096]`}>{rangeData.label}</span>
            </div>
            <div className="grid gap-3">
              {focusGroups.length > 0 ? (
                focusGroups.map((group) => (
                  <button
                    key={group.id}
                    type="button"
                    onClick={() => setSelectedGroupId(group.id)}
                    className={`rounded-lg border p-3 text-left transition ${
                      selectedGroupId === group.id
                        ? 'border-[#27e0b4] bg-[#123a31]'
                        : 'border-[#234238] bg-[#0b241f] hover:border-[#2f6f5f]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-base font-black text-white">
                          {group.name}
                        </p>
                        <p className={`mt-1 truncate text-xs ${muted}`}>
                          Leader: {group.leaderNames.join(', ') || 'non defini'}
                        </p>
                      </div>
                      {group.followUpCount > 0 ? (
                        <span className="rounded-full border border-amber-300/35 bg-amber-300/12 px-2 py-1 text-xs font-black text-amber-200">
                          {group.followUpCount}
                        </span>
                      ) : null}
                    </div>
                    <div className={`mt-3 grid grid-cols-3 gap-2 text-xs ${muted}`}>
                      <span>{group.membersCount} membres</span>
                      <span>{group.questionsDone} Q</span>
                      <span>{groupActivityLabel(group.lastActivityAt)}</span>
                    </div>
                  </button>
                ))
              ) : (
                <p className={`rounded-lg border border-dashed border-[#234238] p-4 text-sm ${muted}`}>
                  Aucun groupe avec membres pour cette periode.
                </p>
              )}
            </div>
          </aside>

          <section className={`${panel} overflow-hidden`}>
            <div className="border-b border-[#234238] p-4">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-black text-white">Activite par membre</h2>
                  <p className={`text-sm ${muted}`}>
                    {filteredMembers.length} membre{filteredMembers.length > 1 ? 's' : ''} affiche
                    {filteredMembers.length > 1 ? 's' : ''}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[
                    ['all', 'Tous'],
                    ['follow_up', 'A relancer'],
                    ['inactive', 'Inactifs'],
                    ['active', 'Actifs'],
                    ['leader', 'Leaders'],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setStatusFilter(value as StatusFilter)}
                      className={`h-9 rounded-full border px-3 text-sm font-bold transition ${
                        statusFilter === value
                          ? 'border-[#27e0b4] bg-[#27e0b4] text-[#03201a]'
                          : 'border-[#234238] bg-[#0b241f] text-[#b9d1cb] hover:border-[#27e0b4]'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-[220px_1fr]">
                <select
                  value={selectedGroupId}
                  onChange={(event) => setSelectedGroupId(event.target.value)}
                  className="h-11 rounded-lg border border-[#234238] bg-[#0b241f] px-3 text-sm font-bold text-white outline-none transition focus:border-[#27e0b4]"
                >
                  <option value="all">Tous les groupes</option>
                  {rangeData.groups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>
                <label className="flex h-11 items-center gap-2 rounded-lg border border-[#234238] bg-[#0b241f] px-3 focus-within:border-[#27e0b4]">
                  <Search className="h-4 w-4 text-[#7fa096]" aria-hidden="true" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Rechercher un membre, email ou groupe"
                    className="h-full min-w-0 flex-1 bg-transparent text-sm font-semibold text-white outline-none placeholder:text-[#66837a]"
                  />
                </label>
              </div>
            </div>

            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[920px] border-collapse text-left">
                <thead className="bg-[#0b241f] text-xs uppercase text-[#7fa096]">
                  <tr>
                    <th className="px-4 py-3 font-black">Groupe</th>
                    <th className="px-4 py-3 font-black">Nom du membre</th>
                    <th className="px-4 py-3 font-black">Derniere activite</th>
                    <th className="px-4 py-3 text-right font-black">Questions faites</th>
                    <th className="px-4 py-3 text-right font-black">Questions revisees</th>
                    <th className="px-4 py-3 text-right font-black">Sessions planifiees</th>
                    <th className="px-4 py-3 font-black">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#234238]">
                  {filteredMembers.map((member) => (
                    <tr key={member.id} className="transition hover:bg-[#123a31]/60">
                      <td className="max-w-[180px] truncate px-4 py-4 text-sm font-bold text-white">
                        {member.groupName}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <MemberAvatar member={member} />
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="truncate text-sm font-black text-white">
                                {member.memberName}
                              </p>
                              {member.isLeader ? (
                                <span className="rounded-full border border-[#27e0b4]/30 bg-[#27e0b4]/10 px-2 py-0.5 text-[11px] font-black text-[#27e0b4]">
                                  Leader
                                </span>
                              ) : null}
                            </div>
                            <p className={`truncate text-xs ${muted}`}>{member.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm font-semibold text-[#c9dbd6]">
                        {formatDate(member.lastActivityAt)}
                      </td>
                      <td className={`${mono} px-4 py-4 text-right text-sm font-black text-white`}>
                        {member.questionsDone}
                      </td>
                      <td className={`${mono} px-4 py-4 text-right text-sm font-black text-white`}>
                        {member.questionsReviewed}
                      </td>
                      <td className={`${mono} px-4 py-4 text-right text-sm font-black text-white`}>
                        {member.scheduledSessions}
                      </td>
                      <td className="px-4 py-4">
                        <StatusPill status={member.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid gap-3 p-4 lg:hidden">
              {filteredMembers.map((member) => (
                <article key={member.id} className="rounded-lg border border-[#234238] bg-[#0b241f] p-3">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <MemberAvatar member={member} />
                      <div className="min-w-0">
                        <p className="truncate text-base font-black text-white">
                          {member.memberName}
                        </p>
                        <p className={`truncate text-xs ${muted}`}>{member.groupName}</p>
                      </div>
                    </div>
                    <StatusPill status={member.status} />
                  </div>
                  <div className={`grid grid-cols-2 gap-2 text-sm ${muted}`}>
                    <span className="flex items-center gap-2">
                      <Clock3 className="h-4 w-4" aria-hidden="true" />
                      {formatDate(member.lastActivityAt)}
                    </span>
                    <span>{member.isLeader ? 'Leader' : 'Membre'}</span>
                    <span>{member.questionsDone} Q faites</span>
                    <span>{member.questionsReviewed} Q revisees</span>
                    <span>{member.scheduledSessions} sessions planifiees</span>
                  </div>
                </article>
              ))}
            </div>

            {filteredMembers.length === 0 ? (
              <div className={`border-t border-[#234238] p-6 text-center text-sm ${muted}`}>
                Aucun membre ne correspond aux filtres actuels.
              </div>
            ) : null}
          </section>
        </section>
      </div>
    </main>
  );
}
