'use client';

import { useSearchParams } from 'next/navigation';

type ActiveGroupNameProps = {
  groups: Array<{ id: string; name: string }>;
};

export function ActiveGroupName({ groups }: ActiveGroupNameProps) {
  const searchParams = useSearchParams();
  const selectedGroupId = searchParams.get('groupId');
  const activeGroup = groups.find((group) => group.id === selectedGroupId) ?? groups[0];

  if (!activeGroup) {
    return null;
  }

  return <span className="hidden max-w-[150px] truncate text-sm font-semibold text-slate-400 sm:inline">{activeGroup.name}</span>;
}
