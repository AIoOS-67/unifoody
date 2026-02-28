// Placeholder API route for CDP JWT issuance
// Replace with secure implementation when ready.

import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST() {
	return NextResponse.json(
		{ ok: false, error: 'CDP JWT not implemented' },
		{ status: 501 }
	)
}

export async function GET() {
	return NextResponse.json(
		{ ok: false, error: 'Use POST to request CDP JWT (not implemented).' },
		{ status: 405 }
	)
}

