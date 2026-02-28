import React from 'react'

export const dynamic = 'force-dynamic'

export default function RiskDisclaimerPage() {
  return (
    <main
      className="prose prose-invert prose-lg leading-relaxed max-w-4xl mx-auto p-6 md:p-8
                 [&_p]:my-3 [&_li]:my-1.5 [&_h2]:mt-6"
    >
      <h1>Digital Asset Risk Disclaimer</h1>
      <p>Last Updated: October 5, 2025</p>

      <p>Please read this risk disclaimer carefully. By using any services provided by FoodyePay Technology, Inc. (the "Service") involving digital assets, you acknowledge, understand, and accept the following risks:</p>

      <h2>1. Not Investment Advice</h2>
      <p>Any information, token prices, or reward figures displayed on the Service are for informational and functional purposes only. Nothing on this platform constitutes or should be construed as investment advice, financial advice, a solicitation of securities, or a recommendation to buy, sell, or hold any digital asset.</p>

      <h2>2. Price Volatility</h2>
      <p>The value of digital assets can be extremely volatile and can change rapidly and unpredictably. You may suffer a partial or total loss of the value of your digital assets. You should carefully consider whether trading or holding digital assets is suitable for you in light of your financial condition.</p>

      <h2>3. Irreversibility of Transactions</h2>
      <p>Transactions conducted on a blockchain are irreversible. Once a transaction has been confirmed and recorded on the network, it cannot be reversed, canceled, or refunded by us or any other party. You are solely responsible for the accuracy of any transaction you initiate.</p>

      <h2>4. Regulatory Risk</h2>
      <p>The legal and regulatory landscape for digital assets is evolving and uncertain. Changes in laws and regulations in any jurisdiction may materially impact the utility, accessibility, legality, and value of your digital assets, including the FOODY token.</p>

      <h2>5. Technical & Security Risks</h2>
      <p>The Service relies on emerging technologies such as blockchain and smart contracts. These technologies are subject to risks including, but not limited to, software vulnerabilities, network congestion, node attacks, or forks, which could result in service disruptions or loss of assets. You are solely responsible for securing your private keys, seed phrases, and personal devices from unauthorized access, phishing, or malware. Loss of your private keys will result in the permanent loss of your digital assets.</p>

      <h2>6. Third-Party Dependencies</h2>
      <p>Certain features of the Service, such as fiat on-ramps (Coinbase Onramp), mapping services (Google Maps), and SMS verification (Twilio), rely on third-party providers. The availability and functionality of these features are subject to the terms, policies, and operational status of these third parties. We are not responsible for any loss or damage caused by the failure or actions of these third parties.</p>

      <h2>7. No Guarantee of Rewards</h2>
      <p>The Service may offer rewards in the form of FOODY tokens. The rules, amounts, and conditions of any rewards program are subject to change, suspension, or termination at any time at our sole discretion. Past rewards are not an indication or guarantee of future rewards.</p>

      <h2>8. NFT & RWA Specific Risks</h2>
      <p>The Service may involve Non-Fungible Tokens (NFTs) representing Real-World Assets (RWA). You understand that NFTs are a novel asset class. There is no guarantee of any secondary market for these assets, and they may be illiquid. Their value is not guaranteed and may be zero.</p>

      <h2>9. No Government Insurance (No FDIC/SIPC Protection)</h2>
      <p>The digital assets held in your personal wallet are not legal tender and are not insured by any government agency. Balances are not subject to Federal Deposit Insurance Corporation (FDIC) or Securities Investor Protection Corporation (SIPC) protections.</p>

      <h2>10. Taxation</h2>
      <p>You are solely responsible for determining what, if any, taxes apply to your transactions. It is your responsibility to report and remit the correct tax to the appropriate tax authority. We do not provide tax advice.</p>

      <h2>11. Acknowledgment and Assumption of Risk</h2>
      <p>By using the Service, you represent that you have read, understood, and agree to assume all of the risks described in this disclaimer. You release and discharge FoodyePay Technology, Inc. from any and all liability, claims, or damages arising out of or in any way related to such risks.</p>
    </main>
  )
}
