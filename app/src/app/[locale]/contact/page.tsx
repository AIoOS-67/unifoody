'use client';

import { useState, FormEvent } from 'react';
import { Header } from '@/components/landing/Header';
import { Footer } from '@/components/landing/Footer';

export default function ContactPage() {
  const [status, setStatus] = useState('');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus('Sending...');
    const formData = new FormData(event.currentTarget);

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        body: JSON.stringify(Object.fromEntries(formData)),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        setStatus('Message sent successfully!');
        (event.target as HTMLFormElement).reset();
      } else {
        const errorData = await response.json();
        setStatus(`Error: ${errorData.error}`);
      }
    } catch (error) {
      console.error('Form submission error:', error);
      setStatus('Error: Could not send message.');
    }
  };

  return (
    <div className="bg-black text-white">
      <Header />
      <main className="py-32 px-4">
        <section className="max-w-2xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-white to-gray-400">
              Contact Us
            </h1>
            <p className="mt-4 text-lg text-gray-400">
              Have a question or feedback? Fill out the form below, and our team will get back to you as soon as possible.
            </p>
          </div>

          <div className="p-8 border border-gray-800 rounded-xl bg-gray-900/50">
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-2">Name</label>
                  <input
                    type="text"
                    name="name"
                    id="name"
                    required
                    placeholder="Your Name"
                    className="w-full bg-gray-800 border-gray-700 text-white rounded-lg p-3 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">Email</label>
                  <input
                    type="email"
                    name="email"
                    id="email"
                    required
                    placeholder="you@example.com"
                    className="w-full bg-gray-800 border-gray-700 text-white rounded-lg p-3 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              <div className="mt-6">
                <label htmlFor="message" className="block text-sm font-medium text-gray-300 mb-2">Message</label>
                <textarea
                  name="message"
                  id="message"
                  required
                  rows={5}
                  placeholder="How can we help?"
                  className="w-full bg-gray-800 border-gray-700 text-white rounded-lg p-3 focus:ring-blue-500 focus:border-blue-500"
                ></textarea>
              </div>
              <div className="mt-8 text-right">
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition disabled:opacity-50"
                  disabled={status === 'Sending...'}
                >
                  Send Message
                </button>
              </div>
              {status && <p className="mt-4 text-center text-gray-400">{status}</p>}
            </form>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
