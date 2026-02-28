import { NextRequest, NextResponse } from 'next/server';

const baseManifest = {
  short_name: 'FoodyePay',
  display: 'standalone' as const,
  background_color: '#000000',
  theme_color: '#1e40af',
  orientation: 'portrait' as const,
  scope: '/',
  categories: ['food', 'finance', 'lifestyle'],
  icons: [
    { src: '/icons/icon-72x72.png', sizes: '72x72', type: 'image/png' },
    { src: '/icons/icon-96x96.png', sizes: '96x96', type: 'image/png' },
    { src: '/icons/icon-128x128.png', sizes: '128x128', type: 'image/png' },
    { src: '/icons/icon-144x144.png', sizes: '144x144', type: 'image/png' },
    { src: '/icons/icon-152x152.png', sizes: '152x152', type: 'image/png' },
    {
      src: '/icons/icon-192x192.png',
      sizes: '192x192',
      type: 'image/png',
      purpose: 'any maskable',
    },
    { src: '/icons/icon-384x384.png', sizes: '384x384', type: 'image/png' },
    {
      src: '/icons/icon-512x512.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'any maskable',
    },
  ],
  screenshots: [
    {
      src: '/FoodyBot.png',
      sizes: '512x512',
      type: 'image/png',
      form_factor: 'wide',
    },
  ],
};

const localeData: Record<
  string,
  { name: string; description: string; lang: string }
> = {
  en: {
    name: 'FoodyePay - Web3 Restaurant Payments',
    description: 'Web3 restaurant payment platform with FOODY token rewards',
    lang: 'en',
  },
  zh: {
    name: 'FoodyePay - Web3 餐饮支付',
    description: 'Web3 + Smart Wallet + QR 支付的餐饮支付 DApp',
    lang: 'zh-CN',
  },
  es: {
    name: 'FoodyePay - Pagos Web3 para Restaurantes',
    description:
      'Plataforma de pago Web3 para restaurantes con recompensas FOODY',
    lang: 'es',
  },
};

export async function GET(request: NextRequest) {
  const cookieLocale = request.cookies.get('NEXT_LOCALE')?.value || 'en';
  const locale = ['en', 'zh', 'es'].includes(cookieLocale)
    ? cookieLocale
    : 'en';
  const data = localeData[locale];

  const manifest = {
    ...baseManifest,
    name: data.name,
    description: data.description,
    lang: data.lang,
    start_url: `/${locale}`,
  };

  return NextResponse.json(manifest, {
    headers: { 'Content-Type': 'application/manifest+json' },
  });
}
