import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { useAuth } from './AuthContext'

const EMPTY = {
  full_name: '', school_name: '', academy: '', direction: '',
  main_subject: '', sections: '', school_year: '2025/2026',
  ppr: '', grade: '',
}

export default function Settings({ onDone }) {
  const { user } = useAuth()
  const [form, setForm] = useState(EMPTY)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('teacher_settings')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()
      if (data) {
        const { id, updated_at, ...rest } = data
        setForm({ ...EMPTY, ...rest })
      }
      setLoading(false)
    }
    load()
  }, [user.id])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const save = async () => {
    if (!form.full_name.trim()) { setMsg('عمّر الاسم الكامل على الأقل'); return }
    setSaving(true)
    setMsg('')
    const { error } = await supabase
      .from('teacher_settings')
      .upsert({ id: user.id, ...form, updated_at: new Date().toISOString() })
    setSaving(false)
    if (error) setMsg('خطأ: ' + error.message)
    else {
      setMsg('تحفظات ✓')
      if (onDone) setTimeout(onDone, 600)
    }
  }

  if (loading) return <div style={st.page}><p style={st.muted}>كنحمّل...</p></div>
  
  return (
    <div style={st.page}>
      <div style={st.card}>
        <h1 style={st.title}>إعدادات الأستاذ</h1>
        <p style={st.sub}>عمّر هاد المعلومات مرة وحدة — غادي تتعبّا أوتوماتيك فالمذكرة والطباعة.</p>

        <label style={st.label}>الاسم الكامل *</label>
        <input style={st.input} value={form.full_name} onChange={set('full_name')} placeholder="مثلا: عبد العزيز علال" />

        <label style={st.label}>اسم المؤسسة</label>
        <input style={st.input} value={form.school_name} onChange={set('school_name')} placeholder="مثلا: مجموعة مدارس..." />

        <div style={st.row}>
          <div style={st.col}>
            <label style={st.label}>الأكاديمية الجهوية</label>
            <input style={st.input} value={form.academy} onChange={set('academy')} placeholder="جهة الشرق" />
          </div>
          <div style={st.col}>
            <label style={st.label}>المديرية الإقليمية</label>
            <input style={st.input} value={form.direction} onChange={set('direction')} placeholder="فجيج" />
          </div>
        </div>

        <div style={st.row}>
          <div style={st.col}>
            <label style={st.label}>المادة الأساسية</label>
            <input style={st.input} value={form.main_subject} onChange={set('main_subject')} placeholder="اللغة العربية" />
          </div>
          <div style={st.col}>
            <label style={st.label}>السنة الدراسية</label>
            <input style={st.input} value={form.school_year} onChange={set('school_year')} placeholder="2025/2026" />
          </div>
        </div><div style={st.row}>
          <div style={st.col}>
            <label style={st.label}>رقم التأجير (PPR)</label>
            <input style={st.input} value={form.ppr} onChange={set('ppr')} placeholder="مثلا: 1549809" dir="ltr" />
          </div>
          <div style={st.col}>
            <label style={st.label}>الصفة / الدرجة</label>
            <input style={st.input} value={form.grade} onChange={set('grade')} placeholder="مثلا: أستاذ التعليم الابتدائي" />
          </div>
        </div>

        <label style={st.label}>الأقسام (مفصولة بفاصلة)</label>
        <input style={st.input} value={form.sections} onChange={set('sections')} placeholder="1APG1,2APG2,3APG1" dir="ltr" />
        <p style={st.hint}>كتب أقسامك مفصولين بفاصلة — غادي يبانو كلائحة اختيار فالمذكرة.</p>

        <div style={st.actions}>
          <button style={st.saveBtn} onClick={save} disabled={saving}>
            {saving ? '...' : 'حفظ الإعدادات'}
          </button>
          {onDone && <button style={st.backBtn} onClick={onDone}>رجوع</button>}
          {msg && <span style={st.msg}>{msg}</span>}
        </div>
      </div>
    </div>
  )
}

const st = {
  page: {
    minHeight: '100vh', background: '#f1f5f9', direction: 'rtl',
    fontFamily: 'system-ui, sans-serif', padding: '24px',
  },
  card: {
    maxWidth: '640px', margin: '0 auto', background: '#fff',
    borderRadius: '16px', padding: '28px',
    boxShadow: '0 4px 20px rgba(0,0,0,.08)',
  },
  title: { margin: '0 0 6px', color: '#0f172a', fontSize: '22px' },
  sub: { margin: '0 0 22px', color: '#64748b', fontSize: '14px' },
  label: { display: 'block', color: '#334155', fontSize: '14px', fontWeight: 600, margin: '12px 0 6px' },
  input: {
    width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1',
    borderRadius: '10px', fontSize: '15px', fontFamily: 'inherit',
    boxSizing: 'border-box',
  },
  hint: { margin: '6px 0 0', color: '#94a3b8', fontSize: '12px' },
  row: { display: 'flex', gap: '12px', flexWrap: 'wrap' },
  col: { flex: 1, minWidth: '180px' },
  actions: {
    display: 'flex', alignItems: 'center', gap: '12px',
    marginTop: '24px', flexWrap: 'wrap',
  },
  saveBtn: {
    padding: '11px 26px', background: '#0ea5e9', color: '#fff',
    border: 'none', borderRadius: '10px', fontSize: '15px',
    fontWeight: 600, cursor: 'pointer',
  },
  backBtn: {
    padding: '11px 22px', background: '#fff', color: '#475569',
    border: '1px solid #cbd5e1', borderRadius: '10px', fontSize: '15px',
    fontWeight: 600, cursor: 'pointer',
  },
  msg: { color: '#059669', fontSize: '14px', fontWeight: 600 },
  muted: { color: '#94a3b8', fontSize: '14px' },
}