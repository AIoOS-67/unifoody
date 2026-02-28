import { Header } from '@/components/landing/Header';
import { Footer } from '@/components/landing/Footer';
import { Book, Github, FileText } from 'lucide-react';
import Link from 'next/link';

export default function DocsPage() {
  return (
    <div className="bg-black text-white">
      <Header />
      <main className="py-20 px-4">
        <section className="text-center max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-white to-gray-400">
            Documentation
          </h1>
          <p className="mt-6 text-lg md:text-xl text-gray-300">
            Explore our technical documentation, whitepaper, and source code to get a deeper understanding of the FoodyePay ecosystem.
          </p>
        </section>

        <section className="py-20 max-w-4xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8 text-center">
            
            {/* Whitepaper */}
            <Link href="/whitepaper" legacyBehavior>
              <a className="p-8 border border-gray-800 rounded-xl bg-gray-900 hover:bg-gray-800/50 transition-colors">
                <Book className="w-12 h-12 mx-auto text-purple-400 mb-4" />
                <h3 className="text-xl font-bold">Whitepaper</h3>
                <p className="mt-2 text-gray-400">Read our comprehensive whitepaper detailing the architecture and vision.</p>
              </a>
            </Link>

            {/* GitHub */}
            <Link href="https://github.com/FoodyePay/foodyepay-MVP" legacyBehavior>
              <a target="_blank" rel="noopener noreferrer" className="p-8 border border-gray-800 rounded-xl bg-gray-900 hover:bg-gray-800/50 transition-colors">
                <Github className="w-12 h-12 mx-auto text-blue-400 mb-4" />
                <h3 className="text-xl font-bold">GitHub</h3>
                <p className="mt-2 text-gray-400">Explore our source code, smart contracts, and contribute to the project.</p>
              </a>
            </Link>

            {/* Pitch Deck */}
            <Link href="https://foodyepay.s3.us-east-2.amazonaws.com/FoodyePay_Pitch_Deck.pdf" legacyBehavior>
              <a target="_blank" rel="noopener noreferrer" className="p-8 border border-gray-800 rounded-xl bg-gray-900 hover:bg-gray-800/50 transition-colors">
                <FileText className="w-12 h-12 mx-auto text-green-400 mb-4" />
                <h3 className="text-xl font-bold">Pitch Deck</h3>
                <p className="mt-2 text-gray-400">View our pitch deck for a high-level overview of our business and strategy.</p>
              </a>
            </Link>

          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
