import { unstable_noStore as noStore } from 'next/cache';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/routing';
import { canAccessAdminConsole } from '@/lib/admin/access';
import { requireUser } from '@/lib/auth';
import { getAppPolicySettingsForAdmin } from '@/lib/policy/app-policy';

import { updateAdminPolicySettingsAction } from './actions';

type AdminPolicyPageProps = {
  params: { locale: string };
  searchParams: { saved?: string };
};

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AdminPolicyPage({
  params,
  searchParams,
}: AdminPolicyPageProps) {
  noStore();
  headers();

  const locale = params.locale as AppLocale;
  const user = await requireUser(locale);

  if (!canAccessAdminConsole(user.email)) {
    notFound();
  }

  const policy = await getAppPolicySettingsForAdmin();
  const copy = getCopy(locale);

  return (
    <main className="flex flex-1 flex-col bg-[#00100f]">
      <section className="mx-auto w-full max-w-[1280px] space-y-5 px-3 py-4 sm:px-4">
        <header className="flex flex-col gap-4 border-b border-white/[0.07] pb-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <Link
              href="/dashboard"
              className="text-sm font-semibold text-[#9fb8b2] transition hover:text-white"
            >
              {copy.back}
            </Link>
            <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              {copy.title}
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#9fb8b2]">
              {copy.description}
            </p>
          </div>
          <div className="rounded-[12px] border border-[#20D9A3]/25 bg-[#20D9A3]/10 px-4 py-3 text-sm font-bold text-[#9FF0CE]">
            {copy.secured}
          </div>
        </header>

        {searchParams.saved === '1' ? (
          <div className="rounded-[12px] border border-[#20D9A3]/25 bg-[#20D9A3]/10 px-4 py-3 text-sm font-bold text-[#9FF0CE]">
            {copy.saved}
          </div>
        ) : null}

        <form action={updateAdminPolicySettingsAction} className="space-y-5">
          <input type="hidden" name="locale" value={locale} />

          <section className="rounded-[18px] border border-white/[0.08] bg-[#08231f] p-4 shadow-[0_18px_60px_rgba(0,0,0,0.25)] sm:p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#20D9A3]">
                  {copy.policyMatrix}
                </p>
                <h2 className="mt-1 text-xl font-extrabold text-white">
                  {copy.accessRules}
                </h2>
              </div>
              <button
                type="submit"
                className="inline-flex h-11 items-center justify-center rounded-[10px] bg-[#20D9A3] px-5 text-sm font-extrabold text-[#062b22] transition hover:bg-[#2fe9b1]"
              >
                {copy.save}
              </button>
            </div>

            <div className="mt-5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="min-w-[860px] overflow-hidden rounded-[14px] border border-white/[0.08]">
                <div className="grid grid-cols-[1.1fr_1.1fr_1.5fr] bg-white/[0.045] text-xs font-extrabold uppercase tracking-[0.12em] text-[#9fb8b2]">
                  <div className="px-4 py-3">{copy.userStatus}</div>
                  <div className="px-4 py-3">{copy.sessionLimit}</div>
                  <div className="px-4 py-3">{copy.unlockCondition}</div>
                </div>
                <PolicyRow
                  status={copy.newTrialUser}
                  limit={
                    <div className="grid grid-cols-2 gap-2">
                      <NumberField
                        name="newTrialMinQuestions"
                        label="Min"
                        value={policy.newTrialMinQuestions}
                      />
                      <NumberField
                        name="newTrialMaxQuestions"
                        label="Max"
                        value={policy.newTrialMaxQuestions}
                      />
                    </div>
                  }
                  condition={
                    <NumberField
                      name="newTrialUnlockSessions"
                      label={copy.sessionsToComplete}
                      value={policy.newTrialUnlockSessions}
                    />
                  }
                />
                <PolicyRow
                  status={copy.consistentTrialUser}
                  limit={
                    <NumberField
                      name="consistentTrialQuestionLimit"
                      label={copy.questionLimit}
                      value={policy.consistentTrialQuestionLimit}
                    />
                  }
                  condition={
                    <div className="grid grid-cols-2 gap-2">
                      <TextField
                        name="consistentTrialUnlockConditionEn"
                        label="EN"
                        value={policy.consistentTrialUnlockConditionEn}
                      />
                      <TextField
                        name="consistentTrialUnlockConditionFr"
                        label="FR"
                        value={policy.consistentTrialUnlockConditionFr}
                      />
                    </div>
                  }
                />
                <PolicyRow
                  status={copy.paidUser}
                  limit={<div className="text-sm font-bold text-white">{copy.fullAccess}</div>}
                  condition={
                    <div className="grid grid-cols-2 gap-2">
                      <TextField
                        name="paidUnlockConditionEn"
                        label="EN"
                        value={policy.paidUnlockConditionEn}
                      />
                      <TextField
                        name="paidUnlockConditionFr"
                        label="FR"
                        value={policy.paidUnlockConditionFr}
                      />
                    </div>
                  }
                />
                <PolicyRow
                  status={copy.highRiskUser}
                  limit={
                    <div className="grid grid-cols-2 gap-2">
                      <TextField
                        name="highRiskSessionLimitEn"
                        label="EN"
                        value={policy.highRiskSessionLimitEn}
                      />
                      <TextField
                        name="highRiskSessionLimitFr"
                        label="FR"
                        value={policy.highRiskSessionLimitFr}
                      />
                    </div>
                  }
                  condition={
                    <div className="grid grid-cols-2 gap-2">
                      <TextField
                        name="highRiskConditionEn"
                        label="EN"
                        value={policy.highRiskConditionEn}
                      />
                      <TextField
                        name="highRiskConditionFr"
                        label="FR"
                        value={policy.highRiskConditionFr}
                      />
                    </div>
                  }
                />
              </div>
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-3">
            <SettingsCard title={copy.freeTrial}>
              <NumberField
                name="trialQuestionLimit"
                label={copy.freeQuestionLimit}
                value={policy.trialQuestionLimit}
              />
              <NumberField
                name="trialWarningThreshold"
                label={copy.warningThreshold}
                value={policy.trialWarningThreshold}
              />
            </SettingsCard>
            <SettingsCard title={copy.sessionDefaults}>
              <NumberField
                name="defaultQuestionGoal"
                label={copy.defaultQuestions}
                value={policy.defaultQuestionGoal}
              />
              <NumberField
                name="maxQuestionGoal"
                label={copy.maxQuestions}
                value={policy.maxQuestionGoal}
              />
              <NumberField
                name="minimumGroupMembersToStart"
                label={copy.minimumMembers}
                value={policy.minimumGroupMembersToStart}
              />
            </SettingsCard>
            <SettingsCard title={copy.timersAndCompletion}>
              <NumberField
                name="perQuestionTimerDefaultSeconds"
                label={copy.perQuestionTimer}
                value={policy.perQuestionTimerDefaultSeconds}
              />
              <NumberField
                name="globalTimerDefaultSeconds"
                label={copy.globalTimer}
                value={policy.globalTimerDefaultSeconds}
              />
              <NumberField
                name="maxTimerSeconds"
                label={copy.maxTimer}
                value={policy.maxTimerSeconds}
              />
              <div className="grid grid-cols-2 gap-2">
                <NumberField
                  name="completionMinMembers"
                  label={copy.completionMin}
                  value={policy.completionMinMembers}
                />
                <NumberField
                  name="completionMaxMembers"
                  label={copy.completionMax}
                  value={policy.completionMaxMembers}
                />
              </div>
            </SettingsCard>
          </section>
        </form>
      </section>
    </main>
  );
}

function SettingsCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3 rounded-[16px] border border-white/[0.08] bg-[#08231f] p-4">
      <h2 className="text-lg font-extrabold text-white">{title}</h2>
      {children}
    </section>
  );
}

function PolicyRow({
  status,
  limit,
  condition,
}: {
  status: string;
  limit: ReactNode;
  condition: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[1.1fr_1.1fr_1.5fr] border-t border-white/[0.08]">
      <div className="px-4 py-4 text-sm font-extrabold text-white">
        {status}
      </div>
      <div className="px-4 py-4">{limit}</div>
      <div className="px-4 py-4">{condition}</div>
    </div>
  );
}

function NumberField({
  name,
  label,
  value,
}: {
  name: string;
  label: string;
  value: number;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#8fa7a2]">
        {label}
      </span>
      <input
        name={name}
        type="number"
        min="0"
        defaultValue={value}
        className="mt-1 h-10 w-full rounded-[8px] border border-white/[0.08] bg-[#001b18] px-3 text-sm font-bold text-white outline-none transition focus:border-[#20D9A3]/70"
      />
    </label>
  );
}

function TextField({
  name,
  label,
  value,
}: {
  name: string;
  label: string;
  value: string;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#8fa7a2]">
        {label}
      </span>
      <input
        name={name}
        defaultValue={value}
        className="mt-1 h-10 w-full rounded-[8px] border border-white/[0.08] bg-[#001b18] px-3 text-sm font-bold text-white outline-none transition focus:border-[#20D9A3]/70"
      />
    </label>
  );
}

function getCopy(locale: AppLocale) {
  if (locale === 'fr') {
    return {
      back: 'Retour au dashboard',
      title: 'Console administration',
      description:
        'Modifie les regles produit qui pilotent les quotas, les limites de session et les conditions d acces.',
      secured: 'Acces admin',
      saved: 'Parametres enregistres.',
      save: 'Enregistrer',
      policyMatrix: 'Matrice produit',
      accessRules: 'Regles d acces',
      userStatus: 'Statut utilisateur',
      sessionLimit: 'Limite session',
      unlockCondition: 'Condition de deblocage',
      newTrialUser: 'Nouvel utilisateur trial',
      consistentTrialUser: 'Utilisateur trial regulier',
      paidUser: 'Utilisateur payant',
      highRiskUser: 'Utilisateur a risque',
      sessionsToComplete: 'Sessions a completer',
      questionLimit: 'Limite questions',
      fullAccess: 'Acces complet',
      freeTrial: 'Essai gratuit',
      freeQuestionLimit: 'Questions gratuites',
      warningThreshold: 'Seuil avertissement',
      sessionDefaults: 'Creation de session',
      defaultQuestions: 'Questions par defaut',
      maxQuestions: 'Questions max',
      minimumMembers: 'Membres minimum',
      timersAndCompletion: 'Timers et completion',
      perQuestionTimer: 'Timer par question',
      globalTimer: 'Timer global',
      maxTimer: 'Timer max',
      completionMin: 'Min completion',
      completionMax: 'Max completion',
    };
  }

  return {
    back: 'Back to dashboard',
    title: 'Administration console',
    description:
      'Edit product rules that drive quotas, session limits, and access conditions.',
    secured: 'Admin access',
    saved: 'Settings saved.',
    save: 'Save settings',
    policyMatrix: 'Product matrix',
    accessRules: 'Access rules',
    userStatus: 'User status',
    sessionLimit: 'Session limit',
    unlockCondition: 'Unlock condition',
    newTrialUser: 'New trial user',
    consistentTrialUser: 'Consistent trial user',
    paidUser: 'Paid user',
    highRiskUser: 'High-risk user',
    sessionsToComplete: 'Sessions to complete',
    questionLimit: 'Question limit',
    fullAccess: 'Full access',
    freeTrial: 'Free trial',
    freeQuestionLimit: 'Free questions',
    warningThreshold: 'Warning threshold',
    sessionDefaults: 'Session creation',
    defaultQuestions: 'Default questions',
    maxQuestions: 'Max questions',
    minimumMembers: 'Minimum members',
    timersAndCompletion: 'Timers and completion',
    perQuestionTimer: 'Per-question timer',
    globalTimer: 'Global timer',
    maxTimer: 'Max timer',
    completionMin: 'Completion min',
    completionMax: 'Completion max',
  };
}
