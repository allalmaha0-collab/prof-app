import { supabase } from './supabaseClient'

const DAILY_LIMIT = 20   // الحد اليومي لكل أستاذ

// كتحقق واش الأستاذ وصل الحد. كترجع { allowed, remaining, message }
export async function checkAiLimit(userId) {
  const today = new Date().toISOString().split('T')[0]

  const { count, error } = await supabase
    .from('ai_usage')
    .select('id', { count: 'exact', head: true })
    .eq('teacher_id', userId)
    .eq('used_date', today)

  if (error) {
    // فحالة خطأ، نسمحو (باش ماتوقفش الخدمة بسبب مشكل تقني)
    return { allowed: true, remaining: DAILY_LIMIT, message: '' }
  }

  const used = count || 0
  if (used >= DAILY_LIMIT) {
    return {
      allowed: false,
      remaining: 0,
      message: `وصلتي الحد اليومي (${DAILY_LIMIT} توليد). عاود غدا.`,
    }
  }
  return { allowed: true, remaining: DAILY_LIMIT - used, message: '' }
}

// كتسجّل استعمال واحد (بعد التوليد الناجح)
export async function recordAiUsage(userId) {
  await supabase.from('ai_usage').insert({ teacher_id: userId })
}