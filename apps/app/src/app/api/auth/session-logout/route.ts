import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    cookies().set('session', '', { maxAge: 0 });
    return NextResponse.json({ status: 'success' });
  } catch (error) {
    console.error('Error clearing session cookie:', error);
    return NextResponse.json({ error: 'Failed to clear session' }, { status: 500 });
  }
}
