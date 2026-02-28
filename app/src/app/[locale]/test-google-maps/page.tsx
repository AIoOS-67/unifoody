// app/test-google-maps/page.tsx
'use client';

import { useState } from 'react';
import { BusinessVerification } from '@/components/BusinessVerification';
import { PhoneVerification } from '@/components/PhoneVerification';

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

export default function TestGoogleMapsPage() {
  // Google Maps API Test States
  const [businessName, setBusinessName] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [searchResults, setSearchResults] = useState<Business[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [apiResponse, setApiResponse] = useState<any>(null);

  // Restaurant Registration States
  const [restaurantEmail, setRestaurantEmail] = useState('');
  const [businessVerified, setBusinessVerified] = useState(false);
  const [verifiedBusiness, setVerifiedBusiness] = useState<Business | null>(null);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [verifiedPhone, setVerifiedPhone] = useState('');
  const [showRegistrationForm, setShowRegistrationForm] = useState(false);

  const handleSearch = async () => {
    if (!businessName.trim() || !zipCode.trim()) {
      setSearchError('Please enter both restaurant name and zip code');
      return;
    }

    setSearching(true);
    setSearchError('');
    setSearchResults([]);
    setApiResponse(null);

    try {
      console.log('🔍 Searching for:', businessName, 'in', zipCode);
      
      const response = await fetch('/api/search-business', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName: businessName.trim(),
          city: zipCode.trim()
        })
      });

      const data = await response.json();
      setApiResponse(data);

      if (data.success) {
        setSearchResults(data.places || []);
        if (data.places.length === 0) {
          setSearchError('No matching restaurants found. Please check the name and zip code spelling');
        } else {
          console.log(`✅ Found ${data.places.length} restaurants via Google Maps API`);
        }
      } else {
        setSearchError(data.message || 'Search failed, please try again later');
      }
    } catch (error) {
      console.error('Business search error:', error);
      setSearchError('Connection error. Please check your internet connection and try again.');
    } finally {
      setSearching(false);
    }
  };

  // Handle business verification completion
  const handleBusinessVerificationComplete = (business: Business) => {
    setVerifiedBusiness(business);
    setBusinessVerified(true);
  };

  // Handle phone verification completion
  const handlePhoneVerificationComplete = (phoneNumber: string) => {
    setVerifiedPhone(phoneNumber);
    setPhoneVerified(true);
  };

  const handleCompleteRegistration = () => {
    if (!restaurantEmail || !businessVerified || !phoneVerified) {
      const missingItems: string[] = [];
      if (!restaurantEmail) missingItems.push('Restaurant Email');
      if (!businessVerified) missingItems.push('Business Verification');
      if (!phoneVerified) missingItems.push('Phone Verification');
      
      alert(`❌ Please complete the following verification steps:\n\n${missingItems.join('\n')}`);
      return;
    }

    // Show success message with all collected data
    const registrationData = {
      restaurantEmail: `${restaurantEmail}@gmail.com`,
      verifiedBusiness,
      verifiedPhone,
      businessVerified,
      phoneVerified
    };

    alert(`🎉 Registration Test Complete!\n\n` +
          `📧 Email: ${registrationData.restaurantEmail}\n` +
          `🏪 Restaurant: ${verifiedBusiness?.name}\n` +
          `📍 Address: ${verifiedBusiness?.formatted_address}\n` +
          `📞 Phone: ${verifiedPhone}\n` +
          `⭐ Rating: ${verifiedBusiness?.rating}/5.0\n\n` +
          `✅ All verification steps completed successfully!`);
  };

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-4">
      <div className="w-full max-w-4xl bg-zinc-900 p-6 rounded-xl shadow space-y-6">
        <h1 className="text-2xl font-bold text-center">🗺️ Google Maps API & Restaurant Registration Test</h1>
        
        {/* Toggle Button */}
        <div className="flex justify-center space-x-4">
          <button
            onClick={() => setShowRegistrationForm(false)}
            className={`px-6 py-2 rounded-lg font-medium transition-all duration-200 ${
              !showRegistrationForm 
                ? 'bg-blue-600 text-white' 
                : 'bg-zinc-700 text-gray-300 hover:bg-zinc-600'
            }`}
          >
            🔍 API Search Test
          </button>
          <button
            onClick={() => setShowRegistrationForm(true)}
            className={`px-6 py-2 rounded-lg font-medium transition-all duration-200 ${
              showRegistrationForm 
                ? 'bg-green-600 text-white' 
                : 'bg-zinc-700 text-gray-300 hover:bg-zinc-600'
            }`}
          >
            🏪 Complete Registration Test
          </button>
        </div>

        {!showRegistrationForm ? (
          /* API Search Test Section */
          <>
            {/* Search Form */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  🏪 Restaurant Name
                </label>
                <input
                  type="text"
                  placeholder="e.g., Bian Liang Restaurant"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  📍 Zip Code
                </label>
                <input
                  type="text"
                  placeholder="e.g., 11355"
                  value={zipCode}
                  onChange={(e) => setZipCode(e.target.value)}
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <button
                onClick={handleSearch}
                disabled={searching}
                className={`w-full py-3 px-4 rounded-lg font-semibold transition-all duration-200 ${
                  searching
                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                {searching ? '🔍 Searching...' : '🔍 Search Restaurant'}
              </button>
            </div>

            {/* Error Message */}
            {searchError && (
              <div className="bg-red-900 border border-red-500 rounded-lg p-4">
                <p className="text-red-300">❌ {searchError}</p>
                {apiResponse?.debug_info && (
                  <div className="mt-3 text-xs text-red-200">
                    <p><strong>Debug Info:</strong></p>
                    <p>• API Key Configured: {apiResponse.debug_info.api_key_configured ? 'Yes' : 'No'}</p>
                    <p>• API Key Length: {apiResponse.debug_info.api_key_length}</p>
                    <p>• Search Query: {apiResponse.debug_info.search_query}</p>
                    {apiResponse.error_details && (
                      <p>• Error Details: {apiResponse.error_details}</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-green-400">
                  ✅ Found {searchResults.length} restaurant(s):
                </h2>
                
                {searchResults.map((business, index) => (
                  <div key={business.place_id} className="bg-zinc-800 border border-zinc-700 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-semibold text-white">{business.name}</h3>
                      <div className="flex items-center space-x-1">
                        <span className="text-yellow-400">⭐</span>
                        <span className="text-sm text-gray-300">
                          {business.rating}/5.0 ({business.user_ratings_total} reviews)
                        </span>
                      </div>
                    </div>
                    
                    <p className="text-gray-400 text-sm mb-2">{business.formatted_address}</p>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500">Place ID: {business.place_id}</span>
                      <span className="text-xs text-green-400">
                        Status: {business.business_status || 'OPERATIONAL'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Raw API Response (Debug) */}
            {apiResponse && (
              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-gray-400">🛠️ API Response (Debug):</h3>
                <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-4 overflow-auto max-h-96">
                  <pre className="text-xs text-gray-300">
                    {JSON.stringify(apiResponse, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </>
        ) : (
          /* Complete Registration Test Section */
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-center text-green-400">
              🏪 Complete Restaurant Registration Test
            </h2>
            
            {/* Business Verification */}
            <div className="bg-zinc-800 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-blue-400 mb-4">1. Business Verification</h3>
              <BusinessVerification 
                onVerificationComplete={handleBusinessVerificationComplete}
                isVerified={businessVerified}
                verifiedBusiness={verifiedBusiness}
              />
            </div>
            
            {/* Phone Verification */}
            <div className="bg-zinc-800 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-purple-400 mb-4">2. Phone Verification</h3>
              <PhoneVerification 
                onVerificationComplete={handlePhoneVerificationComplete}
                isVerified={phoneVerified}
                verifiedPhone={verifiedPhone}
                autoFilledPhone={verifiedBusiness?.formatted_phone_number || verifiedBusiness?.international_phone_number || undefined}
              />
            </div>

            {/* Restaurant Email */}
            <div className="bg-zinc-800 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-yellow-400 mb-4">3. Restaurant Contact Email</h3>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-400">Restaurant Contact Email *</label>
                <div className="flex w-full">
                  <input 
                    placeholder="restaurant (no @)" 
                    value={restaurantEmail} 
                    onChange={e => setRestaurantEmail(e.target.value)} 
                    className="flex-1 px-4 py-3 bg-zinc-700 border border-zinc-600 rounded-l-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-500" 
                  />
                  <span className="px-4 py-3 bg-zinc-600 border border-zinc-600 rounded-r-lg flex items-center justify-center text-gray-300">
                    @gmail.com
                  </span>
                </div>
              </div>
            </div>

            {/* Verification Status */}
            <div className="bg-zinc-800 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-green-400 mb-4">� Verification Status</h3>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <span className={businessVerified ? 'text-green-400' : 'text-red-400'}>
                    {businessVerified ? '✅' : '❌'}
                  </span>
                  <span>Business Verification</span>
                  {businessVerified && verifiedBusiness && (
                    <span className="text-sm text-gray-400">({verifiedBusiness.name})</span>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  <span className={phoneVerified ? 'text-green-400' : 'text-red-400'}>
                    {phoneVerified ? '✅' : '❌'}
                  </span>
                  <span>Phone Verification</span>
                  {phoneVerified && verifiedPhone && (
                    <span className="text-sm text-gray-400">({verifiedPhone})</span>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  <span className={restaurantEmail ? 'text-green-400' : 'text-red-400'}>
                    {restaurantEmail ? '✅' : '❌'}
                  </span>
                  <span>Restaurant Email</span>
                  {restaurantEmail && (
                    <span className="text-sm text-gray-400">({restaurantEmail}@gmail.com)</span>
                  )}
                </div>
              </div>
            </div>

            {/* Complete Registration Button */}
            <button 
              onClick={handleCompleteRegistration}
              className={`w-full py-4 px-6 rounded-lg font-semibold text-lg transition-all duration-200 ${
                businessVerified && phoneVerified && restaurantEmail
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-gray-600 text-gray-400 cursor-not-allowed'
              }`}
              disabled={!businessVerified || !phoneVerified || !restaurantEmail}
            >
              {businessVerified && phoneVerified && restaurantEmail 
                ? '🎉 Complete Registration Test' 
                : '⚠️ Complete All Verification Steps First'}
            </button>
          </div>
        )}

        {/* Test Examples */}
        <div className="bg-blue-900 border border-blue-500 rounded-lg p-4">
          <h3 className="font-semibold text-blue-300 mb-2">📋 Test Examples:</h3>
          <div className="space-y-2 text-sm text-blue-200">
            <div className="flex justify-between">
              <span>• Bian Liang Restaurant</span>
              <span>11355</span>
            </div>
            <div className="flex justify-between">
              <span>• Fan Szechuan Restaurant & Bar</span>
              <span>10002</span>
            </div>
            <div className="flex justify-between">
              <span>• Mountain House Flushing</span>
              <span>11354</span>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="text-center">
          <a 
            href="/register" 
            className="text-blue-400 hover:text-blue-300 underline"
          >
            ← Back to Registration Page
          </a>
        </div>
      </div>
    </div>
  );
}
