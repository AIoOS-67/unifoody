'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { ComponentProps } from 'react';

export function LocaleLink({ href, ...props }: ComponentProps<typeof Link>) {
  const params = useParams();
  const locale = (params?.locale as string) || 'en';

  const localizedHref =
    typeof href === 'string' &&
    !href.startsWith('/api') &&
    !href.startsWith('http') &&
    !href.startsWith('#')
      ? `/${locale}${href.startsWith('/') ? href : `/${href}`}`
      : href;

  return <Link href={localizedHref} {...props} />;
}
