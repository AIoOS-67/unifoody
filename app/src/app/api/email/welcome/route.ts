// app/api/email/welcome/route.ts
import { NextResponse } from 'next/server'
import nodemailer from 'nodemailer'

export async function POST(req: Request) {
  const { email, walletAddress } = await req.json()

  if (!email || !walletAddress) {
    return NextResponse.json({ error: 'Missing email or wallet address' }, { status: 400 })
  }

  try {
    const transporter = nodemailer.createTransport({
      service: 'Gmail',
      auth: {
        user: process.env.EMAIL_USERNAME,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    })

    await transporter.sendMail({
      from: `"FoodyePay" <noreply@foodyepay.com>`,
      to: email,
      subject: 'Welcome to FoodyePay!',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f8f8f8;">
          <h2 style="color: #4a90e2;">🎉 Welcome to FoodyePay!</h2>
          <p>Hi there,</p>
          <p>We're excited to have you on board. Your wallet address is:</p>
           <p style="font-weight: bold; color: #333; word-break: break-all;">${walletAddress}</p>
          <p>Now you can start using Foodye Coin for payments at participating restaurants.</p>
          <p style="margin-top: 30px;">🍽️ Bon Appétit!<br/>FoodyePay Team</p>
        </div>
      `,
    })

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error('Failed to send welcome email:', error)
    return NextResponse.json({ error: 'Failed to send welcome email' }, { status: 500 })
  }
}

