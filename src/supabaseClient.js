import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://tjcaehqvymrneuwosvoc.supabase.co'
const supabaseKey = 'sb_publishable_NtXPgQYMQdtb7g6rHvtOzQ_xWiwmVB-'

export const supabase = createClient(supabaseUrl, supabaseKey)