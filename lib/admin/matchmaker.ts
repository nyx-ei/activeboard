import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export type AdminMatchmakerUser = {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  questionsAnswered: number;
  createdAt: string;
};

export type AdminMatchmakerGroup = {
  id: string;
  name: string;
  maxMembers: number;
  difficultyLevel: 'low' | 'medium' | 'high';
  createdAt: string;
  createdBy: string | null;
  inviteCode: string;
  members: Array<{
    userId: string;
    isFounder: boolean;
    joinedAt: string;
  }>;
};

export type AdminMatchmakerData = {
  users: AdminMatchmakerUser[];
  groups: AdminMatchmakerGroup[];
};

function normalizeSearch(value: string | undefined) {
  return value?.trim().toLowerCase() ?? '';
}

function matchesUserSearch(user: AdminMatchmakerUser, search: string) {
  if (!search) {
    return true;
  }

  return (
    user.email.toLowerCase().includes(search) ||
    (user.displayName ?? '').toLowerCase().includes(search)
  );
}

export async function getAdminMatchmakerData(
  search?: string,
  selectedGroupId?: string,
): Promise<AdminMatchmakerData> {
  const admin = createSupabaseAdminClient();
  const normalizedSearch = normalizeSearch(search);

  const [usersResult, groupsResult, membersResult] = await Promise.all([
    admin
      .schema('public')
      .from('users')
      .select('id, email, display_name, avatar_url, questions_answered, created_at')
      .order('created_at', { ascending: false })
      .limit(500),
    admin
      .schema('public')
      .from('groups')
      .select('id, name, max_members, difficulty_level, created_at, created_by, invite_code')
      .order('created_at', { ascending: false })
      .limit(200),
    admin
      .schema('public')
      .from('group_members')
      .select('group_id, user_id, is_founder, joined_at'),
  ]);

  if (usersResult.error) {
    throw new Error(usersResult.error.message);
  }
  if (groupsResult.error) {
    throw new Error(groupsResult.error.message);
  }
  if (membersResult.error) {
    throw new Error(membersResult.error.message);
  }

  const selectedGroupUserIds = [
    ...new Set(
      (membersResult.data ?? [])
        .filter((membership) => membership.group_id === selectedGroupId)
        .map((membership) => membership.user_id),
    ),
  ];
  const loadedUserIds = new Set((usersResult.data ?? []).map((user) => user.id));
  const missingSelectedUserIds = selectedGroupUserIds.filter(
    (userId) => !loadedUserIds.has(userId),
  );

  const selectedUsersResult =
    missingSelectedUserIds.length > 0
      ? await admin
          .schema('public')
          .from('users')
          .select(
            'id, email, display_name, avatar_url, questions_answered, created_at',
          )
          .in('id', missingSelectedUserIds)
      : { data: [], error: null };

  if (selectedUsersResult.error) {
    throw new Error(selectedUsersResult.error.message);
  }

  const users = [
    ...(usersResult.data ?? []),
    ...(selectedUsersResult.data ?? []),
  ].map((user) => ({
    id: user.id,
    email: user.email,
    displayName: user.display_name,
    avatarUrl: user.avatar_url,
    questionsAnswered: user.questions_answered ?? 0,
    createdAt: user.created_at,
  }));

  const membershipsByGroup = new Map<
    string,
    AdminMatchmakerGroup['members']
  >();

  for (const membership of membersResult.data ?? []) {
    const current = membershipsByGroup.get(membership.group_id) ?? [];
    current.push({
      userId: membership.user_id,
      isFounder: Boolean(membership.is_founder),
      joinedAt: membership.joined_at,
    });
    membershipsByGroup.set(membership.group_id, current);
  }

  const groups = (groupsResult.data ?? []).map((group) => ({
    id: group.id,
    name: group.name,
    maxMembers: group.max_members,
    difficultyLevel: group.difficulty_level ?? 'medium',
    createdAt: group.created_at,
    createdBy: group.created_by,
    inviteCode: group.invite_code,
    members: membershipsByGroup.get(group.id) ?? [],
  }));

  return {
    users: users.filter(
      (user) =>
        selectedGroupUserIds.includes(user.id) ||
        matchesUserSearch(user, normalizedSearch),
    ),
    groups,
  };
}
