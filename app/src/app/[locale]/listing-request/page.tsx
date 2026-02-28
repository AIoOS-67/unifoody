"use client";

import React, { useState } from 'react';

export default function ListingRequestPage() {
  const [formData, setFormData] = useState({
    fullName: '',
    title: '',
    email: '',
    assetName: '',
    assetTicker: '',
    websiteLink: '',
    whitepaperLink: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  return (
    <div className="min-h-screen bg-white flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8 text-gray-900">
      <div className="w-full max-w-3xl space-y-12">
        
        {/* Logo Placeholder */}
        <div className="flex justify-center">
          <h1 className="text-5xl font-bold text-[#0052FF] tracking-tight">coinbase</h1>
        </div>

        {/* Contact Info Section */}
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-700">Asset Issuer Contact / Info / Links</h2>
            <p className="mt-1 text-sm text-gray-500">Please enter your full name, title, email, asset name, and asset ticker</p>
          </div>

          <div className="space-y-4">
            <InputField 
              label="Full Name" 
              name="fullName" 
              value={formData.fullName} 
              onChange={handleChange} 
            />
            <InputField 
              label="Title" 
              name="title" 
              value={formData.title} 
              onChange={handleChange} 
            />
            <InputField 
              label="Email" 
              name="email" 
              value={formData.email} 
              onChange={handleChange} 
            />
            <InputField 
              label="Asset Name" 
              name="assetName" 
              value={formData.assetName} 
              onChange={handleChange} 
            />
            <InputField 
              label="Asset Ticker" 
              name="assetTicker" 
              value={formData.assetTicker} 
              onChange={handleChange} 
            />
            <InputField 
              label="Link to Website" 
              name="websiteLink" 
              value={formData.websiteLink} 
              onChange={handleChange} 
            />
            <InputField 
              label="Link to Whitepaper" 
              name="whitepaperLink" 
              value={formData.whitepaperLink} 
              onChange={handleChange} 
            />
          </div>
        </div>

        {/* Agreement Section */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-gray-700">Coinbase Listings Service Agreement</h2>
          <div className="text-sm text-gray-600 leading-relaxed">
            <p>
              By signing this agreement, you agree that the information you provide is truthful. You agree to abide by the terms of the agreement (including but not limited to the non-disclosure provision, the restrictions on market manipulation, and the obligation not to use any of the information you receive for or allow a third party to engage in market manipulation). Please read this <a href="#" className="text-blue-600 underline">document</a> over carefully.
            </p>
          </div>
          
          {/* Signature Box Placeholder (bottom part of image) */}
          <div className="mt-6 border border-gray-300 p-4 h-32 bg-gray-50">
             {/* Content would go here */}
          </div>
        </div>

      </div>
    </div>
  );
}

interface InputFieldProps {
  label: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

function InputField({ label, name, value, onChange }: InputFieldProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
      <label htmlFor={name} className="block text-base font-medium text-gray-600 sm:text-left">
        {label}
      </label>
      <div className="sm:col-span-2">
        <input
          type="text"
          name={name}
          id={name}
          value={value}
          onChange={onChange}
          className="block w-full border border-gray-400 px-3 py-2 focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
        />
      </div>
    </div>
  );
}
