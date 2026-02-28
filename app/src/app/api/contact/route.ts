import { type NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(req: NextRequest) {
  try {
    const { name, email, message } = await req.json();

    // --- Input Validation ---
    if (!name || !email || !message) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
    }

    // --- Nodemailer Transporter Setup ---
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USERNAME,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });

    // --- Email Content ---
    const mailOptions = {
      from: `"FoodyePay Contact Form" <${process.env.EMAIL_USERNAME}>`,
      to: 'info@foodyepay.com',
      subject: `New Contact Form Message from ${name}`,
      replyTo: email,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6;">
          <h2 style="color: #333;">New Message from Contact Form</h2>
          <p>You have received a new message from the website's contact form.</p>
          <hr>
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
          <p><strong>Message:</strong></p>
          <p style="padding: 10px; background-color: #f9f9f9; border: 1px solid #ddd; border-radius: 4px;">
            ${message}
          </p>
          <hr>
          <p style="font-size: 0.9em; color: #888;">This email was sent automatically from the FoodyePay website.</p>
        </div>
      `,
    };

    // --- Send Email ---
    await transporter.sendMail(mailOptions);

    return NextResponse.json({ message: 'Message sent successfully!' }, { status: 200 });

  } catch (error) {
    console.error('API Contact Error:', error);
    return NextResponse.json({ error: 'An internal server error occurred.' }, { status: 500 });
  }
}
