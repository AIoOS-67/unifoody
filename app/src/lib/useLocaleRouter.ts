'use client';

import { useRouter, useParams } from 'next/navigation';
import { useCallback } from 'react';

export function useLocaleRouter() {
  const router = useRouter();
  const params = useParams();
  const locale = (params?.locale as string) || 'en';

  const push = useCallback(
    (path: string) => {
      const localePath = path.startsWith(`/${locale}`)
        ? path
        : `/${locale}${path.startsWith('/') ? path : `/${path}`}`;
      router.push(localePath);
    },
    [router, locale]
  );

  const replace = useCallback(
    (path: string) => {
      const localePath = path.startsWith(`/${locale}`)
        ? path
        : `/${locale}${path.startsWith('/') ? path : `/${path}`}`;
      router.replace(localePath);
    },
    [router, locale]
  );

  return { push, replace, locale };
}
