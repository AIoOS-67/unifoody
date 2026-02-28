// Placeholder API route for Apple Pay Onramp
// This ensures the file is a valid module for Next.js builds.
// Replace with real implementation when ready.

import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(_req: Request) {
	return NextResponse.json(
		{ ok: false, error: 'Apple Pay onramp is not implemented yet.' },
		{ status: 501 }
	)
}

export async function GET() {
	return NextResponse.json(
		{ ok: false, error: 'Use POST for Apple Pay onramp (not implemented).' },
		{ status: 405 }
	)
}

