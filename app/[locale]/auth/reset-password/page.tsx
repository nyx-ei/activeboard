import { getTranslations } from 'next-intl/server';

import { ResetPasswordForm } from '@/components/auth/reset-password-form';

export default async function ResetPasswordPage() {
  const t = await getTranslations('Auth');

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 items-center justify-center px-4 py-10">
      <div className="flex w-full items-center justify-center">
        <div className="w-full max-w-[410px] text-center sr-only">
          <h1 className="mt-1 text-3xl font-extrabold text-white">{t('resetPasswordTitle')}</h1>
        </div>
        <ResetPasswordForm />
      </div>
    </main>
  );
}
