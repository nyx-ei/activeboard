'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
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
  'rounded-[10px] border border-[#24443a] bg-[#102820]/82 shadow-[inset_0_1px_0_rgba(255,255,255,.035)]';
const muted = 'text-[#9fb8b0]';
const mono = 'font-mono tracking-[0.02em]';
const MEMBER_PAGE_SIZE = 10;

const statusLabels: Record<OpsAdoptionStatus, string> = {
  active: 'Actif',
  follow_up: 'À relancer',
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

function PaymentPill({ member }: { member: OpsAdoptionMember }) {
  const overFreeLimitWithoutPayment =
    !member.hasPayment && member.totalQuestionsAnswered >= 100;
  const detail = [
    member.hasPayment ? 'Paiement: Y' : 'Paiement: N',
    `${member.totalQuestionsAnswered} Q au total`,
    `abonnement: ${member.subscriptionStatus}`,
    `tier: ${member.userTier}`,
  ].join(' · ');

  return (
    <span
      title={detail}
      className={`inline-flex min-w-12 justify-center rounded-full border px-2.5 py-1 text-xs font-black ${
        member.hasPayment
          ? 'bg-emerald-400/12 border-emerald-300/35 text-emerald-200'
          : overFreeLimitWithoutPayment
            ? 'bg-red-400/12 border-red-300/40 text-red-200'
            : 'border-[#34584f] bg-[#0b241f] text-[#b9d1cb]'
      }`}
    >
      {member.hasPayment ? 'Y' : 'N'}
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
  if (!value) return 'Aucune activité';

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
  if (!value) return 'aucune activité';
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
  const groupPickerRef = useRef<HTMLDivElement | null>(null);
  const [selectedRange, setSelectedRange] = useState<OpsRange>(
    data.defaultRange,
  );
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [memberPage, setMemberPage] = useState(1);
  const [isGroupPickerOpen, setIsGroupPickerOpen] = useState(false);
  const rangeData = data.ranges[selectedRange];
  const rangeEntries = Object.entries(data.ranges) as Array<
    [OpsRange, OpsDashboardData['ranges'][OpsRange]]
  >;
  const selectedGroupSet = useMemo(
    () => new Set(selectedGroupIds),
    [selectedGroupIds],
  );
  const hasGroupSelection = selectedGroupIds.length > 0;
  const scopedGroups = useMemo(
    () =>
      hasGroupSelection
        ? rangeData.groups.filter((group) => selectedGroupSet.has(group.id))
        : rangeData.groups,
    [hasGroupSelection, rangeData.groups, selectedGroupSet],
  );
  const scopedMembers = useMemo(
    () =>
      hasGroupSelection
        ? rangeData.members.filter((member) =>
            selectedGroupSet.has(member.groupId),
          )
        : rangeData.members,
    [hasGroupSelection, rangeData.members, selectedGroupSet],
  );
  const scopedSummary = useMemo(
    () => ({
      groupsCount: scopedGroups.length,
      membersCount: scopedMembers.length,
      activeMembersCount: scopedMembers.filter(
        (member) => member.status === 'active',
      ).length,
      followUpMembersCount: scopedMembers.filter(
        (member) => member.status === 'follow_up',
      ).length,
      inactiveMembersCount: scopedMembers.filter(
        (member) => member.status === 'inactive',
      ).length,
      questionsDone: scopedMembers.reduce(
        (sum, member) => sum + member.questionsDone,
        0,
      ),
      questionsReviewed: scopedMembers.reduce(
        (sum, member) => sum + member.questionsReviewed,
        0,
      ),
      scheduledSessions: scopedGroups.reduce(
        (sum, group) => sum + group.scheduledSessions,
        0,
      ),
    }),
    [scopedGroups, scopedMembers],
  );

  const filteredMembers = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return scopedMembers.filter((member) => {
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
  }, [scopedMembers, search, statusFilter]);

  const memberPageCount = Math.max(
    1,
    Math.ceil(filteredMembers.length / MEMBER_PAGE_SIZE),
  );
  const safeMemberPage = Math.min(memberPage, memberPageCount);
  const memberPageStart = (safeMemberPage - 1) * MEMBER_PAGE_SIZE;
  const paginatedMembers = filteredMembers.slice(
    memberPageStart,
    memberPageStart + MEMBER_PAGE_SIZE,
  );
  const visibleMemberStart =
    filteredMembers.length === 0 ? 0 : memberPageStart + 1;
  const visibleMemberEnd = Math.min(
    memberPageStart + MEMBER_PAGE_SIZE,
    filteredMembers.length,
  );

  useEffect(() => {
    setMemberPage(1);
  }, [search, selectedGroupIds, selectedRange, statusFilter]);

  useEffect(() => {
    setMemberPage((current) => Math.min(current, memberPageCount));
  }, [memberPageCount]);

  useEffect(() => {
    if (!isGroupPickerOpen) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;

      if (!groupPickerRef.current?.contains(target)) {
        setIsGroupPickerOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsGroupPickerOpen(false);
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isGroupPickerOpen]);

  const focusGroups = scopedGroups.slice(0, 6);
  const selectedGroupLabel = hasGroupSelection
    ? `${selectedGroupIds.length} groupe${selectedGroupIds.length > 1 ? 's' : ''} sélectionné${
        selectedGroupIds.length > 1 ? 's' : ''
      }`
    : 'Tous les groupes';

  function toggleGroup(groupId: string) {
    setSelectedGroupIds((current) =>
      current.includes(groupId)
        ? current.filter((id) => id !== groupId)
        : [...current, groupId],
    );
  }

  function clearGroupSelection() {
    setSelectedGroupIds([]);
    setIsGroupPickerOpen(false);
  }

  return (
    <main
      data-ops-dashboard
      className="min-h-screen bg-[#04110f] bg-[radial-gradient(900px_520px_at_85%_-10%,rgba(45,212,191,.08),transparent_66%),radial-gradient(720px_460px_at_10%_110%,rgba(42,98,86,.14),transparent_68%)] px-4 py-5 text-[#eaf7f3] sm:px-6"
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
        .ops-scrollbar-hidden {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .ops-scrollbar-hidden::-webkit-scrollbar {
          display: none;
        }
      `}</style>

      <div className="mx-auto max-w-[1320px]">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <Link
            href={backHref}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#234238] bg-[#0f2d26] px-3 text-sm font-bold text-[#b9d1cb] transition hover:border-[#27e0b4] hover:text-[#27e0b4]"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Retour au tableau de bord
          </Link>
          <span className={`${mono} text-xs text-[#7fa096]`}>
            Mis à jour {formatGeneratedAt(data.generatedAt)}
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
                  Tableau de pilotage
                </p>
                <h1 className="text-2xl font-black text-white sm:text-3xl">
                  Activité des groupes et membres
                </h1>
              </div>
            </div>
            <p className={`max-w-3xl text-sm leading-6 ${muted}`}>
              Suivi dynamique des groupes, membres, questions, révisions et
              sessions planifiées pour repérer rapidement les utilisateurs
              actifs et les membres à relancer.
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
            value={scopedSummary.groupsCount}
            detail={`${scopedSummary.membersCount} membres au total`}
            icon={<UsersRound className="h-5 w-5" aria-hidden="true" />}
          />
          <KpiCard
            label="Membres actifs"
            value={scopedSummary.activeMembersCount}
            detail={`${scopedSummary.followUpMembersCount} à relancer`}
            icon={<UserRoundCheck className="h-5 w-5" aria-hidden="true" />}
          />
          <KpiCard
            label="Questions faites"
            value={scopedSummary.questionsDone}
            detail={`${scopedSummary.questionsReviewed} questions révisées`}
            icon={<CheckCircle2 className="h-5 w-5" aria-hidden="true" />}
          />
          <KpiCard
            label="Sessions planifiées"
            value={scopedSummary.scheduledSessions}
            detail={`${scopedSummary.inactiveMembersCount} membres inactifs`}
            icon={<CalendarClock className="h-5 w-5" aria-hidden="true" />}
          />
        </section>

        <section className="mb-5 grid gap-4 xl:grid-cols-[360px_1fr]">
          <aside className={`${panel} p-4`}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-black text-white">
                Groupes prioritaires
              </h2>
              <span className={`${mono} text-xs text-[#7fa096]`}>
                {rangeData.label}
              </span>
            </div>
            <div className="ops-scrollbar-hidden grid max-h-[500px] gap-2 overflow-y-auto pr-1">
              {focusGroups.length > 0 ? (
                focusGroups.map((group) => (
                  <button
                    key={group.id}
                    type="button"
                    onClick={() => toggleGroup(group.id)}
                    className={`rounded-lg border px-3 py-2.5 text-left transition ${
                      selectedGroupSet.has(group.id)
                        ? 'border-[#27e0b4] bg-[#123a31]'
                        : 'border-[#234238] bg-[#0b241f] hover:border-[#2f6f5f]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-white">
                          {group.name}
                        </p>
                        <p className={`mt-1 truncate text-xs ${muted}`}>
                          Leader :{' '}
                          {group.leaderNames.join(', ') || 'non défini'}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        {selectedGroupSet.has(group.id) ? (
                          <span className="rounded-full border border-[#27e0b4]/30 bg-[#27e0b4]/10 px-2 py-0.5 text-[10px] font-black text-[#27e0b4]">
                            Inclus
                          </span>
                        ) : null}
                        {group.followUpCount > 0 ? (
                          <span className="bg-amber-300/12 rounded-full border border-amber-300/35 px-2 py-0.5 text-[11px] font-black text-amber-200">
                            {group.followUpCount}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div
                      className={`mt-2 grid grid-cols-3 gap-2 text-xs ${muted}`}
                    >
                      <span>{group.membersCount} membres</span>
                      <span>{group.questionsDone} Q</span>
                      <span>{groupActivityLabel(group.lastActivityAt)}</span>
                    </div>
                  </button>
                ))
              ) : (
                <p
                  className={`rounded-lg border border-dashed border-[#234238] p-4 text-sm ${muted}`}
                >
                  Aucun groupe avec membres pour cette période.
                </p>
              )}
            </div>
          </aside>

          <section className={`${panel} overflow-hidden`}>
            <div className="border-b border-[#234238] p-4">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-black text-white">
                    Activité par membre
                  </h2>
                  <p className={`text-sm ${muted}`}>
                    {filteredMembers.length} membre
                    {filteredMembers.length > 1 ? 's' : ''} affiché
                    {filteredMembers.length > 1 ? 's' : ''}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[
                    ['all', 'Tous'],
                    ['follow_up', 'À relancer'],
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

              <div className="grid gap-3 md:grid-cols-[minmax(240px,320px)_1fr]">
                <div ref={groupPickerRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setIsGroupPickerOpen((current) => !current)}
                    className="flex h-11 w-full items-center justify-between gap-3 rounded-lg border border-[#234238] bg-[#0b241f] px-3 text-left text-sm font-black text-white outline-none transition hover:border-[#27e0b4]"
                    aria-expanded={isGroupPickerOpen}
                  >
                    <span className="min-w-0 truncate">
                      {selectedGroupLabel}
                    </span>
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-[#7fa096] transition ${
                        isGroupPickerOpen ? 'rotate-180' : ''
                      }`}
                      aria-hidden="true"
                    />
                  </button>
                  {isGroupPickerOpen ? (
                    <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-30 rounded-lg border border-[#24443a] bg-[#08201b] p-2 shadow-[0_18px_45px_rgba(0,0,0,.35)]">
                      <div className="mb-2 flex items-center justify-between gap-3 px-1">
                        <span className="text-xs font-black uppercase tracking-[0.04em] text-[#7fa096]">
                          Équipes
                        </span>
                        {hasGroupSelection ? (
                          <button
                            type="button"
                            onClick={clearGroupSelection}
                            className="text-xs font-black text-[#27e0b4] transition hover:text-white"
                          >
                            Tout afficher
                          </button>
                        ) : null}
                      </div>
                      <div className="ops-scrollbar-hidden flex max-h-[260px] flex-col gap-1 overflow-y-auto pr-1">
                        {rangeData.groups.map((group) => {
                          const checked = selectedGroupSet.has(group.id);

                          return (
                            <label
                              key={group.id}
                              className={`flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-2 text-sm font-bold transition ${
                                checked
                                  ? 'border-[#27e0b4]/60 bg-[#123a31] text-white'
                                  : 'border-transparent text-[#b9d1cb] hover:border-[#24443a] hover:bg-[#102820]'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleGroup(group.id)}
                                className="h-4 w-4 accent-[#27e0b4]"
                              />
                              <span className="min-w-0 flex-1 truncate">
                                {group.name}
                              </span>
                              <span
                                className={`${mono} text-xs text-[#7fa096]`}
                              >
                                {group.membersCount}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </div>
                <label className="flex h-11 items-center gap-2 rounded-lg border border-[#234238] bg-[#0b241f] px-3 focus-within:border-[#27e0b4]">
                  <Search
                    className="h-4 w-4 text-[#7fa096]"
                    aria-hidden="true"
                  />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Rechercher un membre, e-mail ou groupe"
                    className="h-full min-w-0 flex-1 bg-transparent text-sm font-semibold text-white outline-none placeholder:text-[#66837a]"
                  />
                </label>
              </div>
            </div>

            <div className="ops-scrollbar-hidden hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[1040px] border-collapse text-left">
                <thead className="bg-[#0b241f] text-xs uppercase text-[#7fa096]">
                  <tr>
                    <th className="px-4 py-3 font-black">Groupe</th>
                    <th className="px-4 py-3 font-black">Nom du membre</th>
                    <th className="px-4 py-3 font-black">Dernière activité</th>
                    <th className="px-4 py-3 text-right font-black">
                      Questions faites
                    </th>
                    <th className="px-4 py-3 text-right font-black">
                      Questions révisées
                    </th>
                    <th className="px-4 py-3 text-right font-black">
                      Sessions planifiées
                    </th>
                    <th className="px-4 py-3 text-center font-black">
                      Paiement
                    </th>
                    <th className="px-4 py-3 font-black">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#234238]">
                  {paginatedMembers.map((member) => (
                    <tr
                      key={member.id}
                      className="transition hover:bg-[#123a31]/60"
                    >
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
                            <p className={`truncate text-xs ${muted}`}>
                              {member.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm font-semibold text-[#c9dbd6]">
                        {formatDate(member.lastActivityAt)}
                      </td>
                      <td
                        className={`${mono} px-4 py-4 text-right text-sm font-black text-white`}
                      >
                        {member.questionsDone}
                      </td>
                      <td
                        className={`${mono} px-4 py-4 text-right text-sm font-black text-white`}
                      >
                        {member.questionsReviewed}
                      </td>
                      <td
                        className={`${mono} px-4 py-4 text-right text-sm font-black text-white`}
                      >
                        {member.scheduledSessions}
                      </td>
                      <td className="px-4 py-4 text-center">
                        <PaymentPill member={member} />
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
              {paginatedMembers.map((member) => (
                <article
                  key={member.id}
                  className="rounded-lg border border-[#234238] bg-[#0b241f] p-3"
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <MemberAvatar member={member} />
                      <div className="min-w-0">
                        <p className="truncate text-base font-black text-white">
                          {member.memberName}
                        </p>
                        <p className={`truncate text-xs ${muted}`}>
                          {member.groupName}
                        </p>
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
                    <span>{member.questionsReviewed} Q révisées</span>
                    <span>{member.scheduledSessions} sessions planifiées</span>
                    <span className="flex items-center gap-2">
                      Paiement <PaymentPill member={member} />
                    </span>
                  </div>
                </article>
              ))}
            </div>

            {filteredMembers.length > 0 ? (
              <div className="flex flex-col gap-3 border-t border-[#234238] px-4 py-3 text-sm text-[#9fb8b0] sm:flex-row sm:items-center sm:justify-between">
                <span>
                  {visibleMemberStart}-{visibleMemberEnd} sur{' '}
                  {filteredMembers.length} membres
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setMemberPage((current) => Math.max(1, current - 1))
                    }
                    disabled={safeMemberPage <= 1}
                    className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#24443a] bg-[#0b241f] px-3 font-bold text-[#c9dbd6] transition hover:border-[#27e0b4] hover:text-[#27e0b4] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-[#24443a] disabled:hover:text-[#c9dbd6]"
                  >
                    <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                    Précédent
                  </button>
                  <span
                    className={`${mono} min-w-16 text-center text-xs text-[#7fa096]`}
                  >
                    {safeMemberPage}/{memberPageCount}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setMemberPage((current) =>
                        Math.min(memberPageCount, current + 1),
                      )
                    }
                    disabled={safeMemberPage >= memberPageCount}
                    className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#24443a] bg-[#0b241f] px-3 font-bold text-[#c9dbd6] transition hover:border-[#27e0b4] hover:text-[#27e0b4] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-[#24443a] disabled:hover:text-[#c9dbd6]"
                  >
                    Suivant
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            ) : null}

            {filteredMembers.length === 0 ? (
              <div
                className={`border-t border-[#234238] p-6 text-center text-sm ${muted}`}
              >
                Aucun membre ne correspond aux filtres actuels.
              </div>
            ) : null}
          </section>
        </section>
      </div>
    </main>
  );
}
