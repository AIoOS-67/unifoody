// components/BusinessVerification.tsx
// Google Places business search — Zip Code + Cuisine
// If not found: (A) Register on Google, or (B) Verify via EIN/Tax ID
'use client';

import { useState } from 'react';
import InfoTooltip from './InfoTooltip';

interface Business {
  place_id: string;
  name: string;
  formatted_address: string;
  rating: number;
  user_ratings_total: number;
  business_status?: string;
  price_level?: number;
  formatted_phone_number?: string | null;
  international_phone_number?: string | null;
}

interface BusinessVerificationProps {
  onVerificationComplete: (business: Business) => void;
  isVerified: boolean;
  verifiedBusiness?: Business | null;
}

export function BusinessVerification({
  onVerificationComplete,
  isVerified,
  verifiedBusiness,
}: BusinessVerificationProps) {
  const [zipCode, setZipCode] = useState('');
  const [cuisine, setCuisine] = useState('all');
  const [searchResults, setSearchResults] = useState<Business[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);

  // "Can't find" fallback states
  const [showNotFound, setShowNotFound] = useState(false);
  const [manualMode, setManualMode] = useState<'none' | 'ein'>('none');
  const [manualName, setManualName] = useState('');
  const [manualPhone, setManualPhone] = useState('');
  const [manualAddress, setManualAddress] = useState('');
  const [einSearching, setEinSearching] = useState(false);
  const [einError, setEinError] = useState('');

  const handleSearch = async () => {
    const zip = zipCode.trim();
    if (!zip) {
      setSearchError('Please enter your Zip Code');
      return;
    }

    setSearching(true);
    setSearchError('');
    setSearchResults([]);
    setHasSearched(false);
    setShowNotFound(false);
    setManualMode('none');

    try {
      const response = await fetch('/api/search-business', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          zipCode: zip,
          cuisine: cuisine !== 'all' ? cuisine : undefined,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSearchResults(data.places || []);
        setHasSearched(true);
        if ((data.places || []).length === 0) {
          setSearchError(
            'No restaurants found in this zip code area. Please double-check your zip code.',
          );
        }
      } else {
        setSearchError(data.message || 'Search failed, please try again later');
      }
    } catch (error) {
      console.error('Business search error:', error);
      setSearchError(
        'Connection error. Please check your internet connection and try again.',
      );
    } finally {
      setSearching(false);
    }
  };

  const handleSelectBusiness = (business: Business) => {
    const status = business.business_status;
    if (status && status !== 'OPERATIONAL') {
      setSearchError(
        `This restaurant is listed as "${status}" on Google Maps. Only OPERATIONAL restaurants can register.`,
      );
      return;
    }
    onVerificationComplete(business);
  };

  // EIN / manual verification path
  const handleEINVerify = async () => {
    if (!manualName.trim()) {
      setEinError('Please enter your restaurant name');
      return;
    }
    if (!manualPhone.trim()) {
      setEinError('Please enter your restaurant phone number');
      return;
    }
    if (!manualAddress.trim()) {
      setEinError('Please enter your restaurant address');
      return;
    }

    setEinSearching(true);
    setEinError('');

    try {
      const res = await fetch('/api/verify-ein', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurantName: manualName.trim() }),
      });
      const data = await res.json();

      if (data.valid) {
        // EIN verified — create a "manual" business object
        const manualBusiness: Business = {
          place_id: `manual_${Date.now()}`,
          name: manualName.trim(),
          formatted_address: manualAddress.trim(),
          rating: 0,
          user_ratings_total: 0,
          business_status: 'OPERATIONAL',
          formatted_phone_number: manualPhone.trim(),
        };
        onVerificationComplete(manualBusiness);
      } else {
        setEinError(
          'Business not found in public records (SEC EDGAR / OpenCorporates). Please check the exact legal name of your business, or register on Google first.',
        );
      }
    } catch {
      setEinError('Verification service unavailable. Please try again later.');
    } finally {
      setEinSearching(false);
    }
  };

  // --- Already verified view ---
  if (isVerified && verifiedBusiness) {
    const isOperational =
      !verifiedBusiness.business_status ||
      verifiedBusiness.business_status === 'OPERATIONAL';

    return (
      <div className="space-y-4">
        <div
          className={`p-4 rounded-lg border ${
            isOperational
              ? 'bg-green-900 border-green-500'
              : 'bg-yellow-900 border-yellow-500'
          }`}
        >
          <h4
            className={`font-medium mb-2 ${
              isOperational ? 'text-green-300' : 'text-yellow-300'
            }`}
          >
            {isOperational ? '\u2713' : '!'} Restaurant Verified
          </h4>
          <div
            className={`text-sm space-y-1 ${
              isOperational ? 'text-green-200' : 'text-yellow-200'
            }`}
          >
            <p>
              <strong>Name:</strong> {verifiedBusiness.name}
            </p>
            <p>
              <strong>Address:</strong> {verifiedBusiness.formatted_address}
            </p>
            {verifiedBusiness.rating > 0 && (
              <p>
                <strong>Rating:</strong> {verifiedBusiness.rating}/5.0 (
                {verifiedBusiness.user_ratings_total} reviews)
              </p>
            )}
            <p>
              <strong>Status:</strong>{' '}
              {verifiedBusiness.business_status || 'OPERATIONAL'}
            </p>
            {verifiedBusiness.formatted_phone_number && (
              <p>
                <strong>Phone:</strong>{' '}
                {verifiedBusiness.formatted_phone_number}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // --- Search + fallback view ---
  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-gray-400 flex items-center">
          Step 1: Find Your Restaurant &amp; Verify{' '}
          <InfoTooltip text="Enter your restaurant's zip code to see all restaurants in the area. Then select yours from the list." />
        </h4>

        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Zip Code *"
            value={zipCode}
            onChange={(e) => {
              const v = e.target.value.replace(/[^\d-]/g, '');
              if (v.length <= 10) setZipCode(v);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSearch();
            }}
            className="input-base w-28"
            disabled={searching}
            maxLength={10}
          />
          <select
            value={cuisine}
            onChange={(e) => setCuisine(e.target.value)}
            className="input-base flex-1 text-sm"
            disabled={searching}
          >
            <option value="all">All Restaurants</option>
            <option value="chinese">Chinese</option>
            <option value="japanese">Japanese</option>
            <option value="korean">Korean</option>
            <option value="thai">Thai</option>
            <option value="vietnamese">Vietnamese</option>
            <option value="indian">Indian</option>
            <option value="mexican">Mexican</option>
            <option value="italian">Italian</option>
            <option value="american">American</option>
            <option value="pizza">Pizza</option>
          </select>
          <button
            onClick={handleSearch}
            disabled={searching || !zipCode.trim()}
            className={`py-2 px-6 rounded-lg font-medium transition-colors ${
              searching || !zipCode.trim()
                ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {searching ? 'Searching...' : 'Search'}
          </button>
        </div>

        {searchError && (
          <div className="p-3 bg-red-900 border border-red-500 rounded-lg">
            <p className="text-red-300 text-sm">{searchError}</p>
          </div>
        )}
      </div>

      {/* Search results list */}
      {searchResults.length > 0 && (
        <div className="space-y-3">
          <h5 className="text-sm font-medium text-gray-400">
            Restaurants near {zipCode} ({searchResults.length} found) — select yours:
          </h5>
          <div className="max-h-72 overflow-y-auto space-y-2">
            {searchResults.map((business) => {
              const isOperational =
                !business.business_status ||
                business.business_status === 'OPERATIONAL';

              return (
                <div
                  key={business.place_id}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                    isOperational
                      ? 'bg-zinc-800 border-zinc-700 hover:border-blue-500'
                      : 'bg-zinc-800/50 border-zinc-700/50 opacity-60'
                  }`}
                  onClick={() => handleSelectBusiness(business)}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h6 className="font-medium text-white">
                        {business.name}
                      </h6>
                      <p className="text-xs text-gray-400 mt-1">
                        {business.formatted_address}
                      </p>
                      {business.rating > 0 && (
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-sm text-gray-300">
                            {business.rating}/5.0
                          </span>
                          <span className="text-xs text-gray-500">
                            ({business.user_ratings_total} reviews)
                          </span>
                        </div>
                      )}
                      {business.formatted_phone_number && (
                        <p className="text-xs text-gray-500 mt-1">
                          Phone: {business.formatted_phone_number}
                        </p>
                      )}
                      <span
                        className={`inline-block mt-1 px-2 py-0.5 text-[10px] rounded ${
                          isOperational
                            ? 'bg-green-900/60 text-green-400 border border-green-700/50'
                            : 'bg-orange-900 text-orange-300 border border-orange-700/50'
                        }`}
                      >
                        {business.business_status || 'OPERATIONAL'}
                      </span>
                    </div>
                    <button
                      className={`px-3 py-1 text-sm rounded-lg transition-colors flex-shrink-0 ${
                        isOperational
                          ? 'bg-blue-600 hover:bg-blue-700 text-white'
                          : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                      }`}
                      disabled={!isOperational}
                    >
                      {isOperational ? 'This is mine' : 'Unavailable'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* "Can't find your restaurant?" — shown after search completes */}
      {hasSearched && !showNotFound && (
        <button
          onClick={() => setShowNotFound(true)}
          className="w-full text-sm text-blue-400 hover:text-blue-300 transition-colors py-2 border border-dashed border-zinc-600 rounded-lg hover:border-blue-500"
        >
          Can&apos;t find your restaurant?
        </button>
      )}

      {/* Not-found options */}
      {showNotFound && manualMode === 'none' && (
        <div className="p-4 bg-zinc-800/80 border border-zinc-700 rounded-lg space-y-3">
          <h5 className="text-sm font-medium text-gray-300">
            Your restaurant is not on Google Maps?
          </h5>
          <p className="text-xs text-gray-500">
            Choose one of the following options:
          </p>

          {/* Option A: Register on Google */}
          <a
            href="https://business.google.com/create"
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full p-3 bg-blue-900/30 border border-blue-700/50 rounded-lg hover:border-blue-500 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                </svg>
              </div>
              <div>
                <p className="text-blue-300 font-medium text-sm">
                  Option A: Register on Google Business Profile
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Free! Takes 5-10 minutes. After approval, come back to register here.
                </p>
              </div>
              <svg className="w-5 h-5 text-gray-500 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5.22 14.78a.75.75 0 001.06 0l7.22-7.22v5.69a.75.75 0 001.5 0v-7.5a.75.75 0 00-.75-.75h-7.5a.75.75 0 000 1.5h5.69l-7.22 7.22a.75.75 0 000 1.06z" clipRule="evenodd" />
              </svg>
            </div>
          </a>

          {/* Option B: Verify via EIN */}
          <button
            onClick={() => setManualMode('ein')}
            className="block w-full p-3 bg-orange-900/20 border border-orange-700/40 rounded-lg hover:border-orange-500 transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
                </svg>
              </div>
              <div>
                <p className="text-orange-300 font-medium text-sm">
                  Option B: Verify via Business Registration (EIN)
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  We&apos;ll search SEC EDGAR &amp; OpenCorporates for your business
                </p>
              </div>
            </div>
          </button>
        </div>
      )}

      {/* EIN Manual Entry Form */}
      {manualMode === 'ein' && (
        <div className="p-4 bg-zinc-800/80 border border-orange-700/40 rounded-lg space-y-3">
          <div className="flex items-center justify-between">
            <h5 className="text-sm font-medium text-orange-300">
              Verify via Business Registration
            </h5>
            <button
              onClick={() => { setManualMode('none'); setEinError(''); }}
              className="text-xs text-gray-500 hover:text-gray-300"
            >
              Back
            </button>
          </div>
          <p className="text-xs text-gray-500">
            Enter your restaurant&apos;s legal business name exactly as registered.
          </p>

          <input
            type="text"
            placeholder="Restaurant Legal Name *"
            value={manualName}
            onChange={(e) => setManualName(e.target.value)}
            className="input-base w-full"
            disabled={einSearching}
          />
          <input
            type="tel"
            placeholder="Restaurant Phone * (e.g. 718-833-1688)"
            value={manualPhone}
            onChange={(e) => setManualPhone(e.target.value)}
            className="input-base w-full"
            disabled={einSearching}
          />
          <input
            type="text"
            placeholder="Restaurant Address *"
            value={manualAddress}
            onChange={(e) => setManualAddress(e.target.value)}
            className="input-base w-full"
            disabled={einSearching}
          />

          {einError && (
            <div className="p-2 bg-red-900/40 border border-red-700/50 rounded-lg">
              <p className="text-red-300 text-xs">{einError}</p>
            </div>
          )}

          <button
            onClick={handleEINVerify}
            disabled={einSearching || !manualName.trim()}
            className={`w-full py-2.5 px-4 rounded-lg font-medium transition-colors ${
              einSearching || !manualName.trim()
                ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                : 'bg-orange-600 hover:bg-orange-700 text-white'
            }`}
          >
            {einSearching ? 'Searching public records...' : 'Verify Business'}
          </button>
        </div>
      )}

      {hasSearched && searchResults.length === 0 && !searchError && !showNotFound && (
        <div className="p-3 bg-zinc-800 border border-zinc-700 rounded-lg">
          <p className="text-gray-400 text-sm">
            No restaurants found in zip code {zipCode}. Please check your zip code and try again.
          </p>
        </div>
      )}
    </div>
  );
}
