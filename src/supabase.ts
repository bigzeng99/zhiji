import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://joqppofbsptljxdhxcpe.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpvcXBwb2Zic3B0bGp4ZGh4Y3BlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIwNzk0NjgsImV4cCI6MjA5NzY1NTQ2OH0.8WWhLx-w-2q89xGYFmaTlvCyRaWOvwNUrk_KHJfVvi8'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
})
