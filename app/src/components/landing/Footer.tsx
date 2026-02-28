"use client";

import { useTranslation } from 'react-i18next';
import { LocaleLink } from '@/components/LocaleLink';

export const Footer = () => {
  const { t } = useTranslation('common');

  return (
    <footer className="bg-gray-900/50 border-t border-gray-800">
      <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-gray-400 tracking-wider uppercase">{t('footer.solutions')}</h4>
            <ul className="space-y-2">
              <li><LocaleLink href="/#restaurants" className="text-gray-300 hover:text-white">{t('nav.forRestaurants')}</LocaleLink></li>
              <li><LocaleLink href="/#diners" className="text-gray-300 hover:text-white">{t('nav.forDiners')}</LocaleLink></li>
            </ul>
          </div>
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-gray-400 tracking-wider uppercase">{t('footer.company')}</h4>
            <ul className="space-y-2">
              <li><LocaleLink href="/about" className="text-gray-300 hover:text-white">{t('nav.aboutUs')}</LocaleLink></li>
              <li><LocaleLink href="/contact" className="text-gray-300 hover:text-white">{t('nav.contactUs')}</LocaleLink></li>
            </ul>
          </div>
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-gray-400 tracking-wider uppercase">{t('footer.resources')}</h4>
            <ul className="space-y-2">
              <li><LocaleLink href="/technology" className="text-gray-300 hover:text-white">{t('nav.technology')}</LocaleLink></li>
            </ul>
          </div>
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-gray-400 tracking-wider uppercase">{t('footer.legal')}</h4>
            <ul className="space-y-2">
              <li><LocaleLink href="/legal/terms" className="text-gray-300 hover:text-white">{t('footer.terms')}</LocaleLink></li>
              <li><LocaleLink href="/legal/privacy" className="text-gray-300 hover:text-white">{t('footer.privacy')}</LocaleLink></li>
              <li><LocaleLink href="/legal/risk-disclaimer" className="text-gray-300 hover:text-white">{t('footer.risk')}</LocaleLink></li>
            </ul>
          </div>
        </div>
        <div className="mt-8 border-t border-gray-800 pt-8 md:flex md:items-center md:justify-between">
          <div className="flex justify-center space-x-6 md:order-1">
            <a href="https://x.com/FoodyePayHQ" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white">
              <span className="sr-only">X</span>
              <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" />
              </svg>
            </a>
          </div>
          <p className="mt-8 text-base text-gray-400 md:mt-0 md:order-2 text-center">
            {t('footer.copyright', { year: new Date().getFullYear() })}
          </p>
        </div>
      </div>
    </footer>
  );
};
