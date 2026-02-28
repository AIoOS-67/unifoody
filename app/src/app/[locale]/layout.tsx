'use client';

import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import i18n from '@/lib/i18n';

const supportedLocales = ['en', 'zh', 'es'];

export default function LocaleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const locale = (params?.locale as string) || 'en';

  useEffect(() => {
    if (supportedLocales.includes(locale) && i18n.language !== locale) {
      i18n.changeLanguage(locale);
    }
    // Update <html lang="">
    document.documentElement.lang = locale;
  }, [locale]);

  return <>{children}</>;
}
