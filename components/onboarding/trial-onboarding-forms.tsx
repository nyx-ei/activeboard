'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { ArrowLeft, Check, Clock, Mail, ShieldCheck } from 'lucide-react';

import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/routing';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import {
  completeTrialAvailabilityAction,
  completeTrialProfileAction,
} from '@/app/[locale]/onboarding/actions';

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
    availabilitySubtitle: 'Choose 5 slots',
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
    selected: '{count}/5 slots selected',
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
    availabilitySubtitle: 'Choisissez 5 créneaux',
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
    generate: 'Générer 3 sessions test',
    selected: '{count}/5 créneaux sélectionnés',
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
}: {
  children: React.ReactNode;
  locale: AppLocale;
  showBack?: boolean;
}) {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_right,rgba(31,230,166,0.13),transparent_38%),#01080d] px-4 py-6 text-white sm:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-[980px] items-center justify-center">
        <section className="relative w-full max-w-[430px] rounded-[24px] border border-white/[0.08] bg-[#111827]/95 p-5 shadow-[0_28px_90px_rgba(0,0,0,0.42)] sm:p-7">
          {showBack ? (
            <Link
              href="/"
              className="mb-5 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.03] text-slate-300 transition hover:border-brand/40 hover:text-brand"
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
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-2 text-sm font-bold text-slate-200">
      <span>{label}</span>
      {children}
    </label>
  );
}

const inputClassName =
  'h-12 w-full rounded-[8px] border border-white/[0.1] bg-white/[0.07] px-4 text-base font-semibold text-white outline-none transition placeholder:text-slate-500 focus:border-brand/70 focus:bg-white/[0.09]';

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
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand/15 text-brand">
          <Mail className="h-6 w-6" aria-hidden />
        </div>
        <h1 className="mt-5 text-2xl font-extrabold text-white">
          {t.checkEmailTitle}
        </h1>
        <p className="mt-2 text-sm font-semibold leading-6 text-slate-300">
          {t.checkEmailBody}
        </p>
      </OnboardingShell>
    );
  }

  return (
    <OnboardingShell locale={locale} showBack>
      <h1 className="text-2xl font-extrabold text-white">{t.accountTitle}</h1>
      <p className="mt-1 text-xs font-semibold text-slate-400">
        {t.accountSubtitle.replace('{offset}', getTimezoneOffsetLabel())}
      </p>

      <form className="mt-7 grid gap-4" onSubmit={handleSubmit}>
        <Field label={t.firstName}>
          <input
            className={inputClassName}
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            placeholder={t.firstNamePlaceholder}
            autoComplete="given-name"
          />
        </Field>
        <Field label={t.lastName}>
          <input
            className={inputClassName}
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
            placeholder={t.lastNamePlaceholder}
            autoComplete="family-name"
          />
        </Field>
        <Field label={t.email}>
          <input
            className={inputClassName}
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
          className="mt-24 inline-flex h-12 items-center justify-center rounded-[8px] bg-brand text-sm font-extrabold text-[#04120e] transition hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-50"
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
      <h1 className="text-xl font-extrabold text-white">{t.profileTitle}</h1>
      <p className="mt-5 text-sm font-semibold text-slate-400">
        {t.timezone} : {timezone}
      </p>

      <form action={completeTrialProfileAction} className="mt-5 grid gap-4">
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="timezone" value={timezone} />
        <Field label={t.whatsapp}>
          <input
            className={inputClassName}
            name="phoneNumber"
            defaultValue={initialPhoneNumber ?? ''}
            placeholder={t.whatsappPlaceholder}
            autoComplete="tel"
          />
        </Field>
        <Field label={t.exam}>
          <select
            className={inputClassName}
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
        <Field label={t.qbank}>
          <select
            className={inputClassName}
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
          className="mt-24 inline-flex h-12 items-center justify-center rounded-[8px] bg-brand text-sm font-extrabold text-[#04120e] transition hover:bg-brand-strong"
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
}: {
  locale: AppLocale;
  initialTimezone?: string | null;
}) {
  const t = copy[locale];
  const [timezone, setTimezone] = useState(initialTimezone || 'UTC');
  const [understood, setUnderstood] = useState(false);
  const [slots, setSlots] = useState<Record<Weekday, Slot[]>>(() =>
    weekdays.reduce(
      (accumulator, weekday) => {
        accumulator[weekday] = [];
        return accumulator;
      },
      {} as Record<Weekday, Slot[]>,
    ),
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
  const canSubmit = selectedCount >= 5 && understood;

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
    <OnboardingShell locale={locale} showBack>
      <h1 className="text-lg font-extrabold text-white">
        {t.availabilityTitle}
      </h1>
      <p className="text-xs font-semibold text-slate-400">
        {t.availabilitySubtitle}
      </p>

      <form action={completeTrialAvailabilityAction} className="mt-7">
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="timezone" value={timezone} />
        <input
          type="hidden"
          name="availabilitySlots"
          value={JSON.stringify(slots)}
        />

        <div className="grid grid-cols-[1fr_76px_76px] items-center gap-x-3 gap-y-3 text-sm">
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
                    className={`mx-auto flex h-7 w-7 items-center justify-center rounded-[6px] border transition ${
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
            <span className="rounded-full bg-brand/10 px-3 py-1 text-xs font-extrabold text-brand">
              {t.selected.replace('{count}', String(selectedCount))}
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
          className="mt-7 inline-flex h-12 w-full items-center justify-center gap-2 rounded-[8px] bg-brand text-sm font-extrabold text-[#04120e] transition hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Clock className="h-4 w-4" aria-hidden />
          {t.generate}
        </button>
      </form>
    </OnboardingShell>
  );
}
