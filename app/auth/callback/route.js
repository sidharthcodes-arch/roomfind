import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error && data?.user) {
      // Fetch user role from database
      const { data: dbUser } = await supabase
        .from('users')
        .select('role')
        .eq('id', data.user.id)
        .single()

      // If user has not chosen a role yet, redirect to /auth to select role
      if (!dbUser?.role) {
        return NextResponse.redirect(`${origin}/auth`)
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/auth?error=oauth_callback_failed`)
}
