'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Check,
  Clock,
  Globe2,
  Mail,
  Phone,
  ShieldCheck,
  ShieldAlert,
  User,
} from 'lucide-react';

import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/routing';
import type { AvailabilityGrid } from '@/lib/schedule/availability';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import {
  completeTrialAvailabilityAction,
  completeTrialProfileAction,
} from '@/app/[locale]/onboarding/actions';

const MIN_AVAILABILITY_SLOTS = 5;
const STRONG_AVAILABILITY_SLOTS = 7;

const copy = {
  en: {
    accountTitle: 'Welcome to ActiveBoard',
    accountSubtitle: 'GMT{offset}',
    firstName: 'First name',
    firstNamePlaceholder: 'John',
    lastName: 'Last name',
    lastNamePlaceholder: 'Doe',
    email: 'Email',
    emailPlaceholder: 'johndoe@gmail.com',
    verifyEmail: 'Verify email',
    sending: 'Sending...',
    checkEmailTitle: 'Check your email',
    checkEmailBody:
      'Open the verification link to continue your trial setup.',
    accountError: 'Enter your first name, last name, and a valid email.',
    otpError: 'The verification email could not be sent. Please try again.',
    profileTitle: 'Complete your account',
    timezone: 'Timezone',
    whatsapp: 'WhatsApp phone number',
    whatsappPlaceholder: '+1 999 999 9999',
    exam: 'Exam',
    qbank: 'Qbank used',
    qbankPlaceholder: 'Optional',
    continue: 'Continue',
    saving: 'Saving...',
    missingProfile: 'WhatsApp number and exam are required.',
    availabilityTitle: 'What is your availability this week?',
    availabilitySubtitle: 'Choose at least 5 slots',
    morning: 'Morning',
    evening: 'Evening',
    morningHours: '06h to 12h',
    eveningHours: '18h to 00h',
    target: 'Target',
    targetAttend: 'Attend 3 test sessions',
    targetPunctual: 'Be punctual',
    targetReview: 'Review assigned questions',
    targetConduct: 'Respect code of conduct',
    understand: 'I understand',
    generate: 'Generate 3 test sessions',
    saveAvailability: 'Save availability',
    selected: '{count}/{target} slots selected',
    availabilityError: 'Choose at least 5 slots and accept the commitment.',
    days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    dayShort: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    exams: {
      mccqe1: 'MCCQE1',
      usmle: 'USMLE',
      plab: 'PLAB',
      other: 'Other',
    },
    qbanks: {
      uworld: 'UWorld',
      canadaqbank: 'CanadaQBank',
      amboss: 'Amboss',
      aceqbank: 'AceQbank',
      cmc: 'CMC prep material',
      other: 'Other',
    },
  },
  fr: {
    accountTitle: 'Bienvenue sur ActiveBoard',
    accountSubtitle: 'GMT{offset}',
    firstName: 'Prénom',
    firstNamePlaceholder: 'John',
    lastName: 'Nom',
    lastNamePlaceholder: 'Doe',
    email: 'Email',
    emailPlaceholder: 'johndoe@gmail.com',
    verifyEmail: 'Vérifier l’email',
    sending: 'Envoi...',
    checkEmailTitle: 'Vérifiez votre email',
    checkEmailBody:
      'Ouvrez le lien de vérification pour continuer la configuration.',
    accountError: 'Saisissez le prénom, le nom et un email valide.',
    otpError: 'L’email de vérification n’a pas pu être envoyé. Réessayez.',
    profileTitle: 'Compléter votre compte',
    timezone: 'Fuseau horaire',
    whatsapp: 'Numéro WhatsApp',
    whatsappPlaceholder: '+1 999 999 9999',
    exam: 'Examen',
    qbank: 'Qbank utilisée',
    qbankPlaceholder: 'Optionnel',
    continue: 'Continuer',
    saving: 'Sauvegarde...',
    missingProfile: 'Le numéro WhatsApp et l’examen sont requis.',
    availabilityTitle: 'Quelles sont vos disponibilités cette semaine ?',
    availabilitySubtitle: 'Choisissez au moins 5 créneaux',
    morning: 'Matin',
    evening: 'Soir',
    morningHours: '06h à 12h',
    eveningHours: '18h à 00h',
    target: 'Engagement',
    targetAttend: 'Participer à 3 sessions test',
    targetPunctual: 'Être ponctuel',
    targetReview: 'Réviser les questions assignées',
    targetConduct: 'Respecter le code de conduite',
    understand: 'Je comprends',
    saveAvailability: 'Enregistrer',
    generate: 'Générer 3 sessions test',
    selected: '{count}/{target} créneaux sélectionnés',
    availabilityError:
      'Choisissez au moins 5 créneaux et acceptez l’engagement.',
    days: ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'],
    dayShort: ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'],
    exams: {
      mccqe1: 'MCCQE1',
      usmle: 'USMLE',
      plab: 'PLAB',
      other: 'Autre',
    },
    qbanks: {
      uworld: 'UWorld',
      canadaqbank: 'CanadaQBank',
      amboss: 'Amboss',
      aceqbank: 'AceQbank',
      cmc: 'Matériel préparatoire CMC',
      other: 'Autre',
    },
  },
} as const;

const weekdays = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

type Weekday = (typeof weekdays)[number];
type Slot = 'morning' | 'evening';

function buildEmptyAvailabilitySlots() {
  return weekdays.reduce(
    (accumulator, weekday) => {
      accumulator[weekday] = [];
      return accumulator;
    },
    {} as Record<Weekday, Slot[]>,
  );
}

function getInitialAvailabilitySlots(
  grid: AvailabilityGrid | null | undefined,
) {
  const slots = buildEmptyAvailabilitySlots();

  if (!grid) {
    return slots;
  }

  for (const weekday of weekdays) {
    const hours = Array.isArray(grid[weekday]) ? grid[weekday] : [];
    if (hours.some((hour) => hour >= 6 && hour < 12)) {
      slots[weekday].push('morning');
    }
    if (hours.some((hour) => hour >= 18 && hour <= 22)) {
      slots[weekday].push('evening');
    }
  }

  return slots;
}

function getTimezoneOffsetLabel() {
  const offsetMinutes = -new Date().getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const absoluteMinutes = Math.abs(offsetMinutes);
  const hours = Math.floor(absoluteMinutes / 60);
  const minutes = absoluteMinutes % 60;
  return `${sign}${hours}${minutes ? `:${String(minutes).padStart(2, '0')}` : ''}`;
}

function OnboardingShell({
  children,
  locale,
  showBack = false,
  wide = false,
}: {
  children: React.ReactNode;
  locale: AppLocale;
  showBack?: boolean;
  wide?: boolean;
}) {
  return (
    <main className="min-h-screen bg-background px-4 py-8 text-white sm:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-6xl items-center justify-center">
        <section className={`w-full ${wide ? 'max-w-[680px]' : 'max-w-[410px]'}`}>
          <div className="mx-auto mb-8 flex h-[52px] w-[52px] items-center justify-center rounded-[8px] bg-brand text-xl font-extrabold text-white">
            AB
          </div>
          {showBack ? (
            <Link
              href="/"
              className="mb-6 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.035] text-slate-300 transition hover:border-brand/40 hover:text-brand"
              aria-label={locale === 'fr' ? 'Retour' : 'Back'}
            >
              <ArrowLeft className="h-5 w-5" aria-hidden />
            </Link>
          ) : null}
          {children}
        </section>
      </div>
    </main>
  );
}

function Field({
  label,
  children,
  icon,
}: {
  label: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <label className="grid gap-2 text-sm font-bold text-slate-200">
      <span>{label}</span>
      <span className="relative block">
        {icon ? (
          <span className="pointer-events-none absolute left-4 top-1/2 z-10 flex -translate-y-1/2 text-brand">
            {icon}
          </span>
        ) : null}
        {children}
      </span>
    </label>
  );
}

const inputWithIconClassName =
  'field h-14 rounded-[6px] px-12 text-base';

export function TrialAccountForm({ locale }: { locale: AppLocale }) {
  const t = copy[locale];
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [isPending, startTransition] = useTransition();

  const canSubmit =
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    /^\S+@\S+\.\S+$/.test(email.trim());

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    if (!canSubmit) {
      setError(t.accountError);
      return;
    }

    startTransition(async () => {
      const supabase = createSupabaseBrowserClient();
      const origin = window.location.origin;
      const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: {
          emailRedirectTo: `${origin}/${locale}/auth/callback?next=/${locale}/onboarding/profile`,
          data: {
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            full_name: fullName,
            locale,
            onboarding_flow: 'trial_3_sessions',
          },
        },
      });

      if (otpError) {
        setError(t.otpError);
        return;
      }

      setSent(true);
    });
  }

  if (sent) {
    return (
      <OnboardingShell locale={locale}>
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand/15 text-brand">
          <Mail className="h-6 w-6" aria-hidden />
        </div>
        <h1 className="mt-5 text-center text-2xl font-extrabold text-white">
          {t.checkEmailTitle}
        </h1>
        <p className="mt-2 text-center text-sm font-medium leading-6 text-slate-400">
          {t.checkEmailBody}
        </p>
      </OnboardingShell>
    );
  }

  return (
    <OnboardingShell locale={locale} showBack>
      <h1 className="text-2xl font-extrabold text-white">{t.accountTitle}</h1>
      <p className="mt-2 inline-flex items-center gap-2 text-xs font-semibold text-slate-400">
        <Globe2 className="h-4 w-4 text-brand" aria-hidden />
        <span>{t.accountSubtitle.replace('{offset}', getTimezoneOffsetLabel())}</span>
      </p>

      <form className="mt-7 grid gap-4" onSubmit={handleSubmit}>
        <Field label={t.firstName} icon={<User className="h-5 w-5" aria-hidden />}>
          <input
            className={inputWithIconClassName}
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            placeholder={t.firstNamePlaceholder}
            autoComplete="given-name"
          />
        </Field>
        <Field label={t.lastName} icon={<User className="h-5 w-5" aria-hidden />}>
          <input
            className={inputWithIconClassName}
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
            placeholder={t.lastNamePlaceholder}
            autoComplete="family-name"
          />
        </Field>
        <Field label={t.email} icon={<Mail className="h-5 w-5" aria-hidden />}>
          <input
            className={inputWithIconClassName}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder={t.emailPlaceholder}
            autoComplete="email"
            inputMode="email"
          />
        </Field>

        {error ? (
          <p className="text-sm font-bold text-rose-300">{error}</p>
        ) : null}

        <button
          type="submit"
          disabled={!canSubmit || isPending}
          className="button-primary mt-16 h-16 w-full rounded-[6px] text-base disabled:opacity-50"
        >
          {isPending ? t.sending : t.verifyEmail}
        </button>
      </form>
    </OnboardingShell>
  );
}

export function TrialProfileForm({
  locale,
  initialPhoneNumber = '',
  initialExamType = 'mccqe1',
  initialQbank = '',
  initialTimezone = 'UTC',
}: {
  locale: AppLocale;
  initialPhoneNumber?: string | null;
  initialExamType?: string | null;
  initialQbank?: string | null;
  initialTimezone?: string | null;
}) {
  const t = copy[locale];
  const [timezone, setTimezone] = useState(initialTimezone || 'UTC');

  useEffect(() => {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (detected) {
      setTimezone(detected);
    }
  }, []);

  return (
    <OnboardingShell locale={locale} showBack>
      <h1 className="text-2xl font-extrabold text-white">{t.profileTitle}</h1>
      <p className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-slate-400">
        <Globe2 className="h-4 w-4 text-brand" aria-hidden />
        <span>{t.timezone} : {timezone}</span>
      </p>

      <form action={completeTrialProfileAction} className="mt-7 grid gap-4">
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="timezone" value={timezone} />
        <Field label={t.whatsapp} icon={<Phone className="h-5 w-5" aria-hidden />}>
          <input
            className={inputWithIconClassName}
            name="phoneNumber"
            defaultValue={initialPhoneNumber ?? ''}
            placeholder={t.whatsappPlaceholder}
            autoComplete="tel"
          />
        </Field>
        <Field label={t.exam} icon={<BookOpen className="h-5 w-5" aria-hidden />}>
          <select
            className={inputWithIconClassName}
            name="examType"
            defaultValue={initialExamType || 'mccqe1'}
          >
            {Object.entries(t.exams).map(([value, label]) => (
              <option key={value} value={value} className="bg-[#111827]">
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t.qbank} icon={<BookOpen className="h-5 w-5" aria-hidden />}>
          <select
            className={inputWithIconClassName}
            name="qbank"
            defaultValue={initialQbank ?? ''}
          >
            <option value="" className="bg-[#111827]">
              {t.qbankPlaceholder}
            </option>
            {Object.entries(t.qbanks).map(([value, label]) => (
              <option key={value} value={value} className="bg-[#111827]">
                {label}
              </option>
            ))}
          </select>
        </Field>
        <button
          type="submit"
          className="button-primary mt-16 h-16 w-full rounded-[6px] text-base"
        >
          {t.continue}
        </button>
      </form>
    </OnboardingShell>
  );
}

export function TrialAvailabilityForm({
  locale,
  initialTimezone = 'UTC',
  initialAvailabilityGrid = null,
  mode,
}: {
  locale: AppLocale;
  initialTimezone?: string | null;
  initialAvailabilityGrid?: AvailabilityGrid | null;
  mode?: 'edit';
}) {
  const t = copy[locale];
  const [timezone, setTimezone] = useState(initialTimezone || 'UTC');
  const [understood, setUnderstood] = useState(mode === 'edit');
  const [slots, setSlots] = useState<Record<Weekday, Slot[]>>(() =>
    getInitialAvailabilitySlots(initialAvailabilityGrid),
  );

  useEffect(() => {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (detected) {
      setTimezone(detected);
    }
  }, []);

  const selectedCount = useMemo(
    () =>
      weekdays.reduce((count, weekday) => count + slots[weekday].length, 0),
    [slots],
  );
  const hasMinimumSlots = selectedCount >= MIN_AVAILABILITY_SLOTS;
  const hasStrongAvailability = selectedCount >= STRONG_AVAILABILITY_SLOTS;
  const canSubmit = hasMinimumSlots && understood;
  const selectedBadgeTone = hasStrongAvailability
    ? 'border-brand/25 bg-brand/10 text-brand'
    : hasMinimumSlots
      ? 'border-amber-400/25 bg-amber-400/10 text-amber-300'
      : 'border-white/10 bg-white/[0.04] text-slate-400';

  function toggleSlot(weekday: Weekday, slot: Slot) {
    setSlots((current) => {
      const currentSlots = current[weekday];
      const nextSlots = currentSlots.includes(slot)
        ? currentSlots.filter((value) => value !== slot)
        : [...currentSlots, slot];

      return {
        ...current,
        [weekday]: nextSlots,
      };
    });
  }

  return (
    <OnboardingShell locale={locale} showBack wide>
      <h1 className="text-2xl font-extrabold text-white">
        {t.availabilityTitle}
      </h1>
      <p className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-slate-400">
        <Clock className="h-4 w-4 text-brand" aria-hidden />
        {t.availabilitySubtitle}
      </p>

      <form action={completeTrialAvailabilityAction} className="mt-7">
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="timezone" value={timezone} />
        {mode ? <input type="hidden" name="mode" value={mode} /> : null}
        <input
          type="hidden"
          name="availabilitySlots"
          value={JSON.stringify(slots)}
        />

        <div className="grid grid-cols-[minmax(58px,1fr)_76px_76px] items-center gap-x-3 gap-y-3 text-sm sm:grid-cols-[minmax(120px,1fr)_88px_88px]">
          <div />
          <div className="text-center text-xs font-bold text-slate-300">
            <p>{t.morning}</p>
            <p className="text-[10px] text-slate-500">{t.morningHours}</p>
          </div>
          <div className="text-center text-xs font-bold text-slate-300">
            <p>{t.evening}</p>
            <p className="text-[10px] text-slate-500">{t.eveningHours}</p>
          </div>
          {weekdays.map((weekday, index) => (
            <div key={weekday} className="contents">
              <p className="text-sm font-semibold text-slate-200">
                <span className="sm:hidden">{t.dayShort[index] ?? ''}</span>
                <span className="hidden sm:inline">{t.days[index] ?? ''}</span>
              </p>
              {(['morning', 'evening'] as const).map((slot) => {
                const checked = slots[weekday].includes(slot);
                return (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => toggleSlot(weekday, slot)}
                    aria-pressed={checked}
                    className={`mx-auto flex h-8 w-8 items-center justify-center rounded-[6px] border transition ${
                      checked
                        ? 'border-brand bg-brand text-[#04120e]'
                        : 'border-white/15 bg-white/[0.04] text-transparent hover:border-brand/50'
                    }`}
                  >
                    <Check className="h-4 w-4" aria-hidden />
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <div className="mt-7 rounded-[8px] border border-white/[0.08] bg-white/[0.035] p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-extrabold text-white">{t.target}</p>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-extrabold ${selectedBadgeTone}`}
            >
              {hasStrongAvailability ? (
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
              ) : (
                <ShieldAlert className="h-3.5 w-3.5" aria-hidden />
              )}
              {t.selected
                .replace('{count}', String(selectedCount))
                .replace('{target}', String(STRONG_AVAILABILITY_SLOTS))}
            </span>
          </div>
          <ul className="mt-3 grid gap-2 text-xs font-semibold leading-5 text-slate-300">
            {[t.targetAttend, t.targetPunctual, t.targetReview, t.targetConduct].map(
              (item) => (
                <li key={item} className="flex gap-2">
                  <ShieldCheck
                    className="mt-0.5 h-4 w-4 shrink-0 text-brand"
                    aria-hidden
                  />
                  <span>{item}</span>
                </li>
              ),
            )}
          </ul>
        </div>

        <label className="mt-4 flex items-center gap-3 text-sm font-bold text-slate-200">
          <input
            type="checkbox"
            name="understood"
            checked={understood}
            onChange={(event) => setUnderstood(event.target.checked)}
            className="h-5 w-5 rounded border-white/20 bg-white/[0.04] accent-brand"
          />
          {t.understand}
        </label>

        <button
          type="submit"
          disabled={!canSubmit}
          className="button-primary mt-7 h-16 w-full rounded-[6px] text-base disabled:opacity-50"
        >
          <Clock className="h-4 w-4" aria-hidden />
          {mode === 'edit' ? t.saveAvailability : t.generate}
        </button>
      </form>
    </OnboardingShell>
  );
}
