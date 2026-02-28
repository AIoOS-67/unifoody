import React from 'react'

export const dynamic = 'force-dynamic'

export default function PrivacyPage() {
  return (
    <main
      className="prose prose-invert prose-lg leading-relaxed max-w-4xl mx-auto p-6 md:p-8
                 [&_p]:my-3 [&_li]:my-1.5 [&_h2]:mt-6"
    >
      <h1>FoodyePay - Privacy Policy</h1>
      <p>Last Updated: October 5, 2025</p>

      <h2>1. Introduction</h2>
      <p>Welcome to FoodyePay. This Privacy Policy explains how FoodyePay Technology, Inc. ("we," "us," or "our") collects, uses, shares, and protects information in relation to our mobile application, website, and any other services we provide (collectively, the "Service").</p>

      <h2>2. Information We Collect</h2>
      <h3>Information You Provide to Us:</h3>
      <ul>
        <li><strong>Account & Identity Information:</strong> Your wallet address, email address (for verification), and phone number (verified via Twilio).</li>
        <li><strong>Business Information:</strong> For our merchant accounts, we collect restaurant name, location information associated with Google Maps, and other details necessary for business verification (KYB).</li>
      </ul>
      <h3>Information We Collect Automatically:</h3>
      <ul>
        <li><strong>Usage and Log Data:</strong> We collect service-related, diagnostic, and performance information. This may include information about your activity, log files, and diagnostic, crash, and performance logs and reports.</li>
        <li><strong>Blockchain Data:</strong> We may collect publicly available data from the blockchain, including transaction data related to your public wallet address.</li>
      </ul>
      <h3>Information from Third Parties:</h3>
      <p>We may receive information from third-party services that you connect to our Service, such as metadata from Coinbase Onramp or location data from Google Maps.</p>

      <h2>3. How We Use Your Information</h2>
      <ul>
        <li><strong>To Provide and Maintain the Service:</strong> To complete restaurant verification, facilitate transactions, and distribute platform rewards and loyalty incentives.</li>
        <li><strong>For Security and Fraud Prevention:</strong> To protect the integrity of our platform, prevent fraud, and secure the Service.</li>
        <li><strong>To Improve Our Service:</strong> To understand how our users interact with the Service to improve user experience and develop new features.</li>
        <li><strong>For Legal and Compliance Purposes:</strong> To comply with applicable legal requirements, such as tax reporting or responding to lawful requests from law enforcement.</li>
      </ul>

      <h2>4. How We Share Your Information</h2>
      <p>We do not sell your personal data to advertisers or other third parties. We may share your information in the following limited circumstances:</p>
      <ul>
        <li><strong>With Third-Party Service Providers:</strong> We share information with essential third-party vendors and partners who provide us with services, such as data hosting (Supabase), payment processing (Coinbase Onramp), verification (Twilio), and mapping services (Google Maps). These providers are contractually obligated to protect your data.</li>
        <li><strong>For Legal Reasons:</strong> We may disclose your information if required to do so by law or in the good faith belief that such action is necessary to comply with a legal obligation or respond to a valid request from a law enforcement agency.</li>
      </ul>

      <h2>5. Data We Do NOT Collect</h2>
      <ul>
        <li>Full, plaintext payment card data (this is handled directly by Coinbase Onramp).</li>
        <li>Biometric data.</li>
        <li>Government-issued identification documents (this may be handled by our KYC partners, but not stored on our servers).</li>
      </ul>

      <h2>6. Your Rights and Choices</h2>
      <p>Depending on your jurisdiction, you may have the following rights regarding your personal information:</p>
      <ul>
        <li><strong>Right to Access:</strong> You can request a copy of the information you have provided to us.</li>
        <li><strong>Right to Rectification:</strong> You have the right to correct any inaccurate information we hold about you.</li>
        <li><strong>Right to Erasure ('Right to be Forgotten'):</strong> You may request the deletion of your personal information, subject to certain legal limitations (e.g., irreversible on-chain records).</li>
        <li><strong>Right to Restrict Processing:</strong> You have the right to request the restriction of certain data processing, such as opting out of marketing communications.</li>
      </ul>
      <p>To exercise these rights, please contact us at the email address provided in Section 12.</p>

      <h2>7. Data Security</h2>
      <p>We implement and maintain reasonable administrative, physical, and technical security safeguards to help protect your information from loss, theft, misuse, and unauthorized access. This includes measures such as Supabase Row Level Security (RLS) and storing sensitive keys in secure environment variables. However, no electronic transmission or storage is 100% secure.</p>

      <h2>8. Data Retention</h2>
      <p>We retain your personal data for as long as necessary to fulfill the purposes for which we collected it, including for the purposes of satisfying any legal, accounting, or reporting requirements. After this period, we will either delete or anonymize your information.</p>

      <h2>9. Children's Privacy</h2>
      <p>The Service is not directed to individuals under the age of 13, and we do not knowingly collect personal information from children under 13.</p>

      <h2>10. International Data Transfers</h2>
      <p>Your information may be stored and processed in any country where we have facilities or in which we engage service providers. By using the Service, you consent to the transfer of information to countries outside of your country of residence, which may have different data protection rules than those of your country.</p>

      <h2>11. Changes to This Privacy Policy</h2>
      <p>We may modify this Privacy Policy from time to time. We will post any changes on this page and update the "Last Updated" date at the top. We encourage you to review this Privacy Policy periodically.</p>

      <h2>12. Contact Us</h2>
      <p>If you have any questions or requests regarding your data protection, please contact us at: support@foodyepay.com.</p>
    </main>
  )
}
