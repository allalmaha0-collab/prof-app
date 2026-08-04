import { useState } from 'react'
import { useAuth } from './AuthContext'
import { supabase } from './supabaseClient'

export default function Auth() {
  const { signIn, signUp } = useAuth()
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    setMessage('')
    if (!email || !password) {
      setMessage('عمّر الإيميل وكلمة السر')
      return
    }
    if (password.length < 6) {
      setMessage('كلمة السر خاصها 6 حروف على الأقل')
      return
    }

    // عند التسجيل: نتحقق من كود الدعوة أولاً
    if (isSignUp) {
      if (!inviteCode.trim()) {
        setMessage('عمّر كود الدعوة')
        return
      }
      setLoading(true)
      const { data: codeRow, error: codeErr } = await supabase
        .from('invite_codes')
        .select('*')
        .eq('code', inviteCode.trim())
        .maybeSingle()

      if (codeErr || !codeRow) {
        setLoading(false)
        setMessage('كود الدعوة غير صحيح')
        return
      }
      if (codeRow.used) {
        setLoading(false)
        setMessage('هاد الكود مستعمل من قبل')
        return
      }

      const { error } = await signUp(email, password)
      if (error) {
        setLoading(false)
        setMessage(traduireErreur(error.message))
        return
      }

      await supabase
        .from('invite_codes')
        .update({ used: true, used_by: email, used_at: new Date().toISOString() })
        .eq('id', codeRow.id)

      setLoading(false)
      setMessage('تسجيل ناجح! دابا تقدر تدخل.')
      setIsSignUp(false)
      setInviteCode('')
      return
    }

   // عند الدخول: بلا كود
    setLoading(true)
    const { error } = await signIn(email, password)
    setLoading(false)
    if (error) {
      setMessage(traduireErreur(error.message))
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.title}>هوايات وأناقة وطرائف</h1>
        <p style={styles.subtitle}>
          {isSignUp ? 'صايب حساب جديد' : 'دخل لحسابك'}
        </p>

        <input
          style={styles.input}
          type="email"
          placeholder="الإيميل"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          dir="ltr"
        />
        <input
          style={styles.input}
          type="password"
          placeholder="كلمة السر"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          dir="ltr"
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
        />{isSignUp && (
          <input
            style={styles.input}
            type="text"
            placeholder="كود الدعوة"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            dir="ltr"
          />
        )}

        <button style={styles.button} onClick={handleSubmit} disabled={loading}>
          {loading ? '...' : isSignUp ? 'صايب الحساب' : 'دخل'}
        </button>

        {message && <p style={styles.message}>{message}</p>}

       <button
          style={styles.switch}
          onClick={() => { setIsSignUp(!isSignUp); setMessage('') }}
        >
          {isSignUp ? 'عندك حساب؟ دخل' : 'ماعندكش حساب؟ صايب واحد'}
        </button>

        <p style={styles.credit}>التطبيق من تصميم وإعداد الأستاذ عزيز</p>
      </div>
    </div>
  )
}

function traduireErreur(msg) {
  if (msg.includes('Invalid login')) return 'الإيميل أو كلمة السر غالطين'
  if (msg.includes('already registered')) return 'هاد الإيميل مسجّل من قبل'
  if (msg.includes('valid email')) return 'الإيميل ماشي صحيح'
  return msg
}

const styles = {
  page: {
    minHeight: '100vh', display: 'flex', alignItems: 'center',
    justifyContent: 'center', background: '#0f172a', direction: 'rtl',
    fontFamily: 'system-ui, sans-serif', padding: '20px',
  },
  card: {
    background: '#fff', borderRadius: '16px', padding: '32px',
    width: '100%', maxWidth: '380px', boxShadow: '0 10px 40px rgba(0,0,0,.3)',
  },
  title: { margin: '0 0 4px', fontSize: '24px', textAlign: 'center', color: '#0f172a' },
  subtitle: { margin: '0 0 24px', textAlign: 'center', color: '#64748b', fontSize: '14px' },
  input: {
    width: '100%', padding: '12px 14px', marginBottom: '12px',
    border: '1px solid #cbd5e1', borderRadius: '10px', fontSize: '15px',
    boxSizing: 'border-box',
  },
  button: {
    width: '100%', padding: '12px', background: '#0ea5e9', color: '#fff',
    border: 'none', borderRadius: '10px', fontSize: '16px', fontWeight: 600,
    cursor: 'pointer', marginTop: '4px',
  },
  message: {
    marginTop: '14px', padding: '10px', background: '#f1f5f9',
    borderRadius: '8px', textAlign: 'center', fontSize: '14px', color: '#334155',
  },
  switch: {
    width: '100%', marginTop: '16px', background: 'none', border: 'none',
    color: '#0ea5e9', cursor: 'pointer', fontSize: '14px',
  },
  credit: {
    marginTop: '20px', textAlign: 'center', color: '#94a3b8',
    fontSize: '12px', paddingTop: '16px', borderTop: '1px solid #e2e8f0',
  },
}