"use client";

import { useState } from 'react';
import Image from 'next/image';
import { useTranslation } from 'react-i18next';
import { LocaleLink } from '@/components/LocaleLink';
import { LanguageSelector } from '@/components/LanguageSelector';

export const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { t } = useTranslation('common');

  return (
    <header className="absolute top-0 left-0 right-0 z-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          <div className="flex-shrink-0">
            <LocaleLink href="/" className="flex items-center gap-2" onClick={() => setIsMenuOpen(false)}>
              <Image src="/FoodyePayLogo.png" alt="FoodyePay" width={40} height={40} />
              <span className="text-xl font-bold text-white">FoodyePay</span>
            </LocaleLink>
          </div>

          <nav className="hidden md:flex gap-8 items-center">
            <LocaleLink href="/#for-restaurants-section" className="text-gray-300 hover:text-white transition">{t('nav.forRestaurants')}</LocaleLink>
            <LocaleLink href="/#for-diners-section" className="text-gray-300 hover:text-white transition">{t('nav.forDiners')}</LocaleLink>
            <LocaleLink href="/about" className="text-gray-300 hover:text-white transition">{t('nav.ourStory')}</LocaleLink>
            <LocaleLink href="/book-a-demo" className="text-gray-300 hover:text-white transition">{t('nav.app')}</LocaleLink>
          </nav>

          <div className="hidden md:flex items-center gap-4">
            <LanguageSelector />
          </div>

          <div className="md:hidden flex items-center gap-2">
            <LanguageSelector />
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-300 hover:text-white hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
              aria-expanded={isMenuOpen}
            >
              <span className="sr-only">{t('nav.openMenu')}</span>
              {isMenuOpen ? (
                <svg className="block h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="block h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {isMenuOpen && (
        <div className="md:hidden" id="mobile-menu">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 bg-gray-900 bg-opacity-95">
            <LocaleLink href="/#for-restaurants-section" onClick={() => setIsMenuOpen(false)} className="text-gray-300 hover:bg-gray-700 hover:text-white block px-3 py-2 rounded-md text-base font-medium">{t('nav.forRestaurants')}</LocaleLink>
            <LocaleLink href="/#for-diners-section" onClick={() => setIsMenuOpen(false)} className="text-gray-300 hover:bg-gray-700 hover:text-white block px-3 py-2 rounded-md text-base font-medium">{t('nav.forDiners')}</LocaleLink>
            <LocaleLink href="/about" onClick={() => setIsMenuOpen(false)} className="text-gray-300 hover:bg-gray-700 hover:text-white block px-3 py-2 rounded-md text-base font-medium">{t('nav.ourStory')}</LocaleLink>
            <LocaleLink href="/book-a-demo" onClick={() => setIsMenuOpen(false)} className="text-gray-300 hover:bg-gray-700 hover:text-white block px-3 py-2 rounded-md text-base font-medium">{t('nav.app')}</LocaleLink>
          </div>
        </div>
      )}
    </header>
  );
};
