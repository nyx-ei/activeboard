import type { AppLocale } from '@/i18n/routing';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export type LiveGroupItem = {
  id: string;
  name: string;
  inviteCode: string;
  memberCount: number;
  maxMembers: number;
  language: string;
  timezone: string;
  weeklyQuestions: number;
  minutesAgo: number;
  compatible: boolean;
  members: Array<{ id: string; initials: string }>;
};

function getInitials(value: string) {
  return (
    value
      .split(' ')
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'AB'
  );
}

async function getCurrentUserGroupIds(userId: string) {
  const supabase = createSupabaseServerClient();
  const { data: memberships } = await supabase
    .schema('public')
    .from('group_members')
    .select('group_id')
    .eq('user_id', userId);

  return [...new Set((memberships ?? []).map((membership) => membership.group_id))];
}

export async function getLiveGroupCountForUser(userId: string) {
  const currentGroupIds = await getCurrentUserGroupIds(userId);
  const supabaseAdmin = createSupabaseAdminClient();
  const { data: candidateGroups } = await supabaseAdmin
    .schema('public')
    .from('groups')
    .select('id, max_members')
    .order('created_at', { ascending: false })
    .limit(30);

  const candidateGroupIds = (candidateGroups ?? []).map((group) => group.id);
  const { data: candidateMemberships } =
    candidateGroupIds.length > 0
      ? await supabaseAdmin.schema('public').from('group_members').select('group_id').in('group_id', candidateGroupIds)
      : { data: [] };

  const candidateCounts = new Map<string, number>();
  for (const membership of candidateMemberships ?? []) {
    candidateCounts.set(membership.group_id, (candidateCounts.get(membership.group_id) ?? 0) + 1);
  }

  return (candidateGroups ?? []).filter(
    (group) => !currentGroupIds.includes(group.id) && (candidateCounts.get(group.id) ?? 0) < (group.max_members ?? 5),
  ).length;
}

export async function getLiveGroupsForUser(userId: string, locale: AppLocale): Promise<LiveGroupItem[]> {
  const currentGroupIds = new Set(await getCurrentUserGroupIds(userId));
  const supabaseAdmin = createSupabaseAdminClient();
  const { data: candidateGroups } = await supabaseAdmin
    .schema('public')
    .from('groups')
    .select('id, name, invite_code, max_members, created_at')
    .order('created_at', { ascending: false })
    .limit(20);

  const availableGroups = (candidateGroups ?? []).filter((group) => !currentGroupIds.has(group.id));
  const availableGroupIds = availableGroups.map((group) => group.id);

  if (availableGroupIds.length === 0) {
    return [];
  }

  const [{ data: memberships }, { data: schedules }] = await Promise.all([
    supabaseAdmin
      .schema('public')
      .from('group_members')
      .select('group_id, user_id')
      .in('group_id', availableGroupIds),
    supabaseAdmin
      .schema('public')
      .from('group_weekly_schedules')
      .select('group_id, question_goal')
      .in('group_id', availableGroupIds),
  ]);

  const ids = [...new Set((memberships ?? []).map((membership) => membership.user_id))];
  const { data: users } =
    ids.length > 0
      ? await supabaseAdmin.schema('public').from('users').select('id, display_name, email').in('id', ids)
      : { data: [] };
  const usersMap = new Map((users ?? []).map((profile) => [profile.id, profile]));

  const membersByGroup = new Map<string, Array<{ user_id: string }>>();
  for (const membership of memberships ?? []) {
    const current = membersByGroup.get(membership.group_id) ?? [];
    current.push({ user_id: membership.user_id });
    membersByGroup.set(membership.group_id, current);
  }

  const weeklyByGroup = new Map<string, number>();
  for (const schedule of schedules ?? []) {
    weeklyByGroup.set(schedule.group_id, (weeklyByGroup.get(schedule.group_id) ?? 0) + schedule.question_goal);
  }

  return availableGroups
    .map((group) => {
      const members = membersByGroup.get(group.id) ?? [];
      return {
        id: group.id,
        name: group.name,
        inviteCode: group.invite_code,
        memberCount: members.length,
        maxMembers: group.max_members,
        language: locale.toUpperCase(),
        timezone: '',
        weeklyQuestions: weeklyByGroup.get(group.id) ?? 0,
        minutesAgo: Math.max(1, Math.round((Date.now() - new Date(group.created_at).getTime()) / 60000)),
        compatible: true,
        members: members.slice(0, 5).map((member) => {
          const profile = usersMap.get(member.user_id);
          const label = profile?.display_name ?? profile?.email ?? 'AB';
          return { id: member.user_id, initials: getInitials(label) };
        }),
      } satisfies LiveGroupItem;
    })
    .filter((group) => group.memberCount < group.maxMembers);
}
