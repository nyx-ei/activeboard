'use client';

import { useCallback, useDeferredValue, useMemo, useState } from 'react';
import { useFormStatus } from 'react-dom';
import {
  Check,
  Crown,
  Plus,
  Search,
  UserPlus,
  Users,
  X,
} from 'lucide-react';

import type {
  AdminMatchmakerData,
  AdminMatchmakerGroup,
  AdminMatchmakerUser,
} from '@/lib/admin/matchmaker';
import { getCandidateClassificationCopy } from '@/lib/matching/candidate-profile';

export type AdminMatchmakerCopy = {
  matchmakerEyebrow: string;
  matchmakerTitle: string;
  matchmakerDescription: string;
  newGroup: string;
  groupName: string;
  capacity: string;
  difficulty: string;
  difficultyLow: string;
  difficultyMedium: string;
  difficultyHigh: string;
  members: string;
  membersHint: string;
  usersShown: string;
  leader: string;
  unnamedUser: string;
  createGroup: string;
  updateGroup: string;
  saving: string;
  searchUsers: string;
  searchPlaceholder: string;
  currentGroups: string;
  notSet: string;
  selectedMembers: string;
  clearSearch: string;
  noUserMatch: string;
  noGroups: string;
  groupSummary: string;
};

type AdminMatchmakerPanelProps = {
  locale: 'en' | 'fr';
  data: AdminMatchmakerData;
  initialGroupId?: string;
  copy: AdminMatchmakerCopy;
  action: (formData: FormData) => void | Promise<void>;
};

const MAX_VISIBLE_USERS = 80;
const MAX_VISIBLE_GROUPS = 120;

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function getGroupLeaderId(group: AdminMatchmakerGroup | null) {
  return (
    group?.members.find((member) => member.isFounder)?.userId ??
    group?.createdBy ??
    ''
  );
}

function getUserLabel(user: AdminMatchmakerUser, unnamedUser: string) {
  return user.displayName?.trim() || user.email || unnamedUser;
}

function getUserMeta(user: AdminMatchmakerUser, locale: 'en' | 'fr') {
  const classification = getCandidateClassificationCopy(
    user.classification,
    locale,
  );
  return {
    label: classification.label,
    stats:
      locale === 'fr'
        ? `${user.questionsAnswered} Q · ${user.questionsReviewed} revues · ${user.positivePeerVotes}/${user.totalPeerVotes} oui`
        : `${user.questionsAnswered} Q · ${user.questionsReviewed} reviewed · ${user.positivePeerVotes}/${user.totalPeerVotes} yes`,
  };
}

function UserAvatar({
  user,
  unnamedUser,
  className = 'h-9 w-9',
}: {
  user: AdminMatchmakerUser;
  unnamedUser: string;
  className?: string;
}) {
  const label = getUserLabel(user, unnamedUser);
  const initials = label
    .split(/\s|@/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  if (user.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={user.avatarUrl}
        alt=""
        className={`${className} shrink-0 rounded-full border border-[#20D9A3]/25 object-cover`}
      />
    );
  }

  return (
    <span
      className={`${className} inline-flex shrink-0 items-center justify-center rounded-full border border-[#20D9A3]/25 bg-[#12483d] text-xs font-extrabold text-[#9FF0CE]`}
    >
      {initials || 'U'}
    </span>
  );
}

function SubmitButton({
  disabled,
  label,
  savingLabel,
}: {
  disabled: boolean;
  label: string;
  savingLabel: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[10px] bg-[#20D9A3] px-5 text-sm font-extrabold text-[#062b22] shadow-[0_14px_32px_rgba(32,217,163,0.18)] transition hover:bg-[#2fe9b1] disabled:cursor-not-allowed disabled:bg-[#36534d] disabled:text-[#93aaa4] sm:w-auto"
    >
      <UserPlus className="h-4 w-4" aria-hidden="true" />
      {pending ? savingLabel : label}
    </button>
  );
}

export function AdminMatchmakerPanel({
  locale,
  data,
  initialGroupId,
  copy,
  action,
}: AdminMatchmakerPanelProps) {
  const initialGroup =
    data.groups.find((group) => group.id === initialGroupId) ?? null;
  const [selectedGroupId, setSelectedGroupId] = useState(initialGroup?.id ?? '');
  const [groupName, setGroupName] = useState(initialGroup?.name ?? '');
  const [maxMembers, setMaxMembers] = useState(initialGroup?.maxMembers ?? 5);
  const [difficultyLevel, setDifficultyLevel] = useState<
    'low' | 'medium' | 'high'
  >(initialGroup?.difficultyLevel ?? 'medium');
  const [memberIds, setMemberIds] = useState(
    () => new Set(initialGroup?.members.map((member) => member.userId) ?? []),
  );
  const [leaderUserId, setLeaderUserId] = useState(getGroupLeaderId(initialGroup));
  const [query, setQuery] = useState('');
  const [groupQuery, setGroupQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const deferredGroupQuery = useDeferredValue(groupQuery);

  const userById = useMemo(
    () => new Map(data.users.map((user) => [user.id, user])),
    [data.users],
  );

  const sortedUsers = useMemo(
    () =>
      [...data.users].sort((left, right) =>
        getUserLabel(left, copy.unnamedUser).localeCompare(
          getUserLabel(right, copy.unnamedUser),
        ),
      ),
    [copy.unnamedUser, data.users],
  );

  const selectedGroup = useMemo(
    () => data.groups.find((group) => group.id === selectedGroupId) ?? null,
    [data.groups, selectedGroupId],
  );

  const selectedUsers = useMemo(
    () =>
      [...memberIds]
        .map((userId) => userById.get(userId))
        .filter((user): user is AdminMatchmakerUser => Boolean(user)),
    [memberIds, userById],
  );

  const filteredUsers = useMemo(() => {
    const normalizedQuery = normalize(deferredQuery);
    const selectedIds = new Set(memberIds);
    const selectedMatches: AdminMatchmakerUser[] = [];
    const unselectedMatches: AdminMatchmakerUser[] = [];

    for (const user of sortedUsers) {
      if (!normalizedQuery) {
        if (selectedIds.has(user.id)) {
          selectedMatches.push(user);
        } else {
          unselectedMatches.push(user);
        }
        continue;
      }

      const matches =
        user.email.toLowerCase().includes(normalizedQuery) ||
        (user.displayName ?? '').toLowerCase().includes(normalizedQuery);

      if (selectedIds.has(user.id)) {
        selectedMatches.push(user);
      } else if (matches) {
        unselectedMatches.push(user);
      }
    }

    return [...selectedMatches, ...unselectedMatches];
  }, [deferredQuery, memberIds, sortedUsers]);

  const visibleUsers = useMemo(
    () => filteredUsers.slice(0, MAX_VISIBLE_USERS),
    [filteredUsers],
  );

  const filteredGroups = useMemo(() => {
    const normalizedQuery = normalize(deferredGroupQuery);
    if (!normalizedQuery) {
      return data.groups.slice(0, MAX_VISIBLE_GROUPS);
    }

    return data.groups
      .filter((group) => group.name.toLowerCase().includes(normalizedQuery))
      .slice(0, MAX_VISIBLE_GROUPS);
  }, [data.groups, deferredGroupQuery]);

  const startNewGroup = useCallback(() => {
    setSelectedGroupId('');
    setGroupName('');
    setMaxMembers(5);
    setDifficultyLevel('medium');
    setMemberIds(new Set());
    setLeaderUserId('');
    setQuery('');
  }, []);

  const selectGroup = useCallback((group: AdminMatchmakerGroup) => {
    setSelectedGroupId(group.id);
    setGroupName(group.name);
    setMaxMembers(group.maxMembers);
    setDifficultyLevel(group.difficultyLevel);
    setMemberIds(new Set(group.members.map((member) => member.userId)));
    setLeaderUserId(getGroupLeaderId(group));
    setQuery('');
  }, []);

  const toggleMember = useCallback((userId: string) => {
    setMemberIds((current) => {
      const next = new Set(current);
      if (next.has(userId)) {
        next.delete(userId);
        if (leaderUserId === userId) {
          setLeaderUserId('');
        }
      } else {
        next.add(userId);
        if (!leaderUserId) {
          setLeaderUserId(userId);
        }
      }
      return next;
    });
  }, [leaderUserId]);

  const assignLeader = useCallback((userId: string) => {
    setLeaderUserId(userId);
    setMemberIds((current) => {
      const next = new Set(current);
      next.add(userId);
      return next;
    });
  }, []);

  const leader = leaderUserId ? userById.get(leaderUserId) : null;
  const capacityWarning = memberIds.size > maxMembers;

  return (
    <section
      id="matchmaker"
      className="grid gap-4 rounded-[18px] border border-white/[0.08] bg-[#08231f] p-4 shadow-[0_18px_60px_rgba(0,0,0,0.25)] sm:p-5 lg:grid-cols-[minmax(0,1fr)_360px]"
    >
      <div className="min-w-0 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#20D9A3]">
              {copy.matchmakerEyebrow}
            </p>
            <h2 className="mt-1 text-xl font-extrabold text-white">
              {copy.matchmakerTitle}
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-[#9fb8b2]">
              {copy.matchmakerDescription}
            </p>
          </div>
          <button
            type="button"
            onClick={startNewGroup}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-[10px] border border-white/[0.08] px-4 text-sm font-extrabold text-[#b9d1cb] transition hover:border-[#20D9A3]/60 hover:text-[#20D9A3]"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            {copy.newGroup}
          </button>
        </div>

        <form
          action={action}
          className="space-y-4 rounded-[14px] border border-white/[0.08] bg-[#001b18] p-4"
        >
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="groupId" value={selectedGroupId} />
          {[...memberIds].map((memberId) => (
            <input
              key={memberId}
              type="hidden"
              name="memberUserIds"
              value={memberId}
            />
          ))}
          {leaderUserId ? (
            <input type="hidden" name="leaderUserId" value={leaderUserId} />
          ) : null}

          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_120px_150px]">
            <label className="block">
              <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#8fa7a2]">
                {copy.groupName}
              </span>
              <input
                name="groupName"
                value={groupName}
                onChange={(event) => setGroupName(event.target.value)}
                className="mt-1 h-10 w-full rounded-[8px] border border-white/[0.08] bg-[#001b18] px-3 text-sm font-bold text-white outline-none transition focus:border-[#20D9A3]/70"
              />
            </label>
            <label className="block">
              <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#8fa7a2]">
                {copy.capacity}
              </span>
              <input
                name="maxMembers"
                type="number"
                min="1"
                max="6"
                value={maxMembers}
                onChange={(event) => {
                  const nextValue = Number(event.target.value);
                  if (Number.isFinite(nextValue)) {
                    setMaxMembers(Math.min(Math.max(nextValue, 1), 6));
                  }
                }}
                className="mt-1 h-10 w-full rounded-[8px] border border-white/[0.08] bg-[#001b18] px-3 text-sm font-bold text-white outline-none transition focus:border-[#20D9A3]/70"
              />
            </label>
            <label className="block">
              <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#8fa7a2]">
                {copy.difficulty}
              </span>
              <select
                name="difficultyLevel"
                value={difficultyLevel}
                onChange={(event) =>
                  setDifficultyLevel(
                    event.target.value === 'low' || event.target.value === 'high'
                      ? event.target.value
                      : 'medium',
                  )
                }
                className="mt-1 h-10 w-full rounded-[8px] border border-white/[0.08] bg-[#001b18] px-3 text-sm font-bold text-white outline-none transition focus:border-[#20D9A3]/70"
              >
                <option value="low">{copy.difficultyLow}</option>
                <option value="medium">{copy.difficultyMedium}</option>
                <option value="high">{copy.difficultyHigh}</option>
              </select>
            </label>
          </div>

          <div className="grid gap-3 rounded-[12px] border border-white/[0.08] bg-white/[0.03] p-3 md:grid-cols-[1fr_1fr]">
            <div className="flex min-w-0 items-center gap-3">
              <Users className="h-5 w-5 shrink-0 text-[#20D9A3]" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-sm font-extrabold text-white">
                  {memberIds.size}/{maxMembers} {copy.members}
                </p>
                <p
                  className={`text-xs font-semibold ${
                    capacityWarning ? 'text-[#ffb1b1]' : 'text-[#8fa7a2]'
                  }`}
                >
                  {copy.membersHint}
                </p>
              </div>
            </div>
            <div className="flex min-w-0 items-center gap-3">
              <Crown className="h-5 w-5 shrink-0 text-[#f6c945]" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-sm font-extrabold text-white">
                  {copy.leader}
                </p>
                <p className="truncate text-xs font-semibold text-[#8fa7a2]">
                  {leader ? getUserLabel(leader, copy.unnamedUser) : copy.notSet}
                </p>
              </div>
            </div>
          </div>

          {selectedUsers.length > 0 ? (
            <div className="rounded-[12px] border border-white/[0.08] bg-[#08231f] p-3">
              <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-[#8fa7a2]">
                {copy.selectedMembers}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {selectedUsers.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => toggleMember(user.id)}
                    className="inline-flex max-w-full items-center gap-2 rounded-full border border-[#20D9A3]/30 bg-[#20D9A3]/10 py-1 pl-1 pr-3 text-xs font-extrabold text-[#9FF0CE]"
                  >
                    <UserAvatar
                      user={user}
                      unnamedUser={copy.unnamedUser}
                      className="h-6 w-6"
                    />
                    <span className="truncate">
                      {getUserLabel(user, copy.unnamedUser)}
                    </span>
                    <X className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8fa7a2]"
              aria-hidden="true"
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={copy.searchPlaceholder}
              className="h-11 w-full rounded-[10px] border border-white/[0.08] bg-[#08231f] pl-10 pr-10 text-sm font-bold text-white outline-none transition placeholder:text-[#6f8580] focus:border-[#20D9A3]/70"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-[#8fa7a2] transition hover:bg-white/[0.06] hover:text-white"
                aria-label={copy.clearSearch}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            ) : null}
          </div>

          <div className="flex items-center justify-between gap-3 text-xs font-bold text-[#8fa7a2]">
            <span>
              {filteredUsers.length} {copy.usersShown}
            </span>
            {filteredUsers.length > visibleUsers.length ? (
              <span>
                {visibleUsers.length}/{filteredUsers.length}
              </span>
            ) : null}
          </div>

          <div className="max-h-[430px] space-y-2 overflow-y-auto pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {visibleUsers.length > 0 ? (
              visibleUsers.map((user) => {
                const isSelected = memberIds.has(user.id);
                const isLeader = leaderUserId === user.id;

                return (
                  <div
                    key={user.id}
                    className={`grid gap-3 rounded-[12px] border p-3 text-sm transition sm:grid-cols-[minmax(0,1fr)_150px_116px] sm:items-center ${
                      isSelected
                        ? 'border-[#20D9A3]/55 bg-[#20D9A3]/10'
                        : 'border-white/[0.08] bg-[#08231f] hover:border-[#20D9A3]/45'
                    }`}
                    >
                      {(() => {
                        const meta = getUserMeta(user, locale);
                        return (
                          <>
                    <button
                      type="button"
                      onClick={() => toggleMember(user.id)}
                      className="flex min-w-0 items-center gap-3 text-left"
                    >
                      <span
                        className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] border ${
                          isSelected
                            ? 'border-[#20D9A3] bg-[#20D9A3] text-[#062b22]'
                            : 'border-white/[0.18] text-transparent'
                        }`}
                      >
                        <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      </span>
                      <UserAvatar user={user} unnamedUser={copy.unnamedUser} />
                      <span className="min-w-0">
                        <span className="block truncate font-extrabold text-white">
                          {getUserLabel(user, copy.unnamedUser)}
                        </span>
                        <span className="block truncate text-xs font-semibold text-[#8fa7a2]">
                          {user.email}
                        </span>
                        {user.phoneNumber ? (
                          <span className="block truncate text-xs font-semibold text-[#8fa7a2]">
                            {user.phoneNumber}
                          </span>
                        ) : null}
                      </span>
                    </button>
                    <span className="min-w-0">
                      <span className="inline-flex max-w-full rounded-full border border-[#20D9A3]/25 bg-[#20D9A3]/10 px-2 py-1 text-xs font-extrabold text-[#9FF0CE]">
                        <span className="truncate">{meta.label}</span>
                      </span>
                      <span className="mt-1 block truncate text-xs font-bold text-[#9fb8b2]">
                        {meta.stats}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => assignLeader(user.id)}
                      className={`inline-flex h-9 items-center justify-center gap-2 rounded-[9px] border px-3 text-xs font-extrabold transition ${
                        isLeader
                          ? 'border-[#f6c945]/60 bg-[#f6c945]/15 text-[#ffe48a]'
                          : 'border-white/[0.08] text-[#b9d1cb] hover:border-[#f6c945]/45 hover:text-[#ffe48a]'
                      }`}
                    >
                      <Crown className="h-3.5 w-3.5" aria-hidden="true" />
                      {copy.leader}
                    </button>
                          </>
                        );
                      })()}
                  </div>
                );
              })
            ) : (
              <div className="rounded-[12px] border border-white/[0.08] bg-[#08231f] p-4 text-sm font-bold text-[#9fb8b2]">
                {copy.noUserMatch}
              </div>
            )}
          </div>

          <SubmitButton
            disabled={!groupName.trim() || !leaderUserId || memberIds.size === 0}
            label={selectedGroup ? copy.updateGroup : copy.createGroup}
            savingLabel={copy.saving}
          />
        </form>
      </div>

      <aside className="min-w-0 space-y-3">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8fa7a2]"
            aria-hidden="true"
          />
          <input
            value={groupQuery}
            onChange={(event) => setGroupQuery(event.target.value)}
            placeholder={copy.currentGroups}
            className="h-11 w-full rounded-[10px] border border-white/[0.08] bg-[#001b18] pl-10 pr-3 text-sm font-bold text-white outline-none transition placeholder:text-[#6f8580] focus:border-[#20D9A3]/70"
          />
        </div>

        <div className="rounded-[14px] border border-white/[0.08] bg-[#001b18] p-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-extrabold text-white">
              {copy.currentGroups}
            </h3>
            <span className="rounded-full bg-white/[0.06] px-2 py-1 text-xs font-extrabold text-[#9fb8b2]">
              {filteredGroups.length}
            </span>
          </div>
          <div className="mt-3 max-h-[560px] space-y-2 overflow-y-auto pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {filteredGroups.length > 0 ? (
              filteredGroups.map((group) => {
                const groupLeader = userById.get(getGroupLeaderId(group));
                return (
                  <button
                    key={group.id}
                    type="button"
                    onClick={() => selectGroup(group)}
                    className={`block w-full rounded-[12px] border p-3 text-left transition ${
                      selectedGroupId === group.id
                        ? 'border-[#20D9A3]/80 bg-[#20D9A3]/10'
                        : 'border-white/[0.08] bg-[#08231f] hover:border-[#20D9A3]/45'
                    }`}
                  >
                    <span className="flex min-w-0 items-center justify-between gap-3">
                      <span className="truncate text-sm font-extrabold text-white">
                        {group.name}
                      </span>
                      <span className="shrink-0 rounded-full border border-white/[0.08] px-2 py-1 text-xs font-extrabold text-[#9fb8b2]">
                        {group.members.length}/{group.maxMembers}
                      </span>
                    </span>
                    <span className="mt-2 flex min-w-0 items-center gap-2 text-xs font-bold text-[#9fb8b2]">
                      <Crown className="h-3.5 w-3.5 shrink-0 text-[#f6c945]" />
                      <span className="truncate">
                        {groupLeader
                          ? getUserLabel(groupLeader, copy.unnamedUser)
                          : copy.notSet}
                      </span>
                    </span>
                  </button>
                );
              })
            ) : (
              <div className="rounded-[12px] border border-white/[0.08] bg-[#08231f] p-4 text-sm font-bold text-[#9fb8b2]">
                {copy.noGroups}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-[14px] border border-[#20D9A3]/20 bg-[#20D9A3]/10 p-3 text-xs font-bold leading-5 text-[#9FF0CE]">
          {copy.groupSummary}
        </div>
      </aside>
    </section>
  );
}
