import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jkyqqzcvtxebhqwetrzy.supabase.co'
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable__QMnBmxQxLQzr_M_aEjQlQ_RteNz1Qm'

export const supabase = createClient(supabaseUrl, supabasePublishableKey)
