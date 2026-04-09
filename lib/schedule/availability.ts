export const AVAILABILITY_WEEKDAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

export type AvailabilityWeekday = (typeof AVAILABILITY_WEEKDAYS)[number];

export type AvailabilityGrid = Record<AvailabilityWeekday, number[]>;

export const AVAILABILITY_HOURS = Array.from({ length: 17 }, (_, index) => index + 6);

export const DEFAULT_AVAILABILITY_GRID: AvailabilityGrid = {
  monday: [],
  tuesday: [],
  wednesday: [],
  thursday: [],
  friday: [],
  saturday: [],
  sunday: [],
};

export function normalizeAvailabilityGrid(value: unknown): AvailabilityGrid {
  const normalized: AvailabilityGrid = { ...DEFAULT_AVAILABILITY_GRID };

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return normalized;
  }

  for (const weekday of AVAILABILITY_WEEKDAYS) {
    const rawHours = (value as Record<string, unknown>)[weekday];
    if (!Array.isArray(rawHours)) {
      continue;
    }

    normalized[weekday] = [...new Set(rawHours)]
      .map((hour) => Number(hour))
      .filter((hour) => Number.isInteger(hour) && AVAILABILITY_HOURS.includes(hour))
      .sort((left, right) => left - right);
  }

  return normalized;
}

export function parseAvailabilityGrid(raw: string): AvailabilityGrid {
  try {
    return normalizeAvailabilityGrid(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_AVAILABILITY_GRID };
  }
}

export function getAvailabilitySlotCount(grid: AvailabilityGrid) {
  return AVAILABILITY_WEEKDAYS.reduce((sum, weekday) => sum + grid[weekday].length, 0);
}
