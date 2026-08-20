import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { useAuth } from './AuthContext'
import { checkAiLimit, recordAiUsage } from './aiLimit'

const EMPTY = {
  title: '', date: new Date().toISOString().split('T')[0], place: '',
  participants: '', objectives: '', axes: '', interventions: '', recommendations: '',
}

export default function Workshop() {
  const { user } = useAuth()
  const [form, setForm] = useState(EMPTY)
  const [settings, setSettings] = useState(null)
  const [output, setOutput] = useState('')
  const [aiBusy, setAiBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const flash = (t) => { setMsg(t); setTimeout(() => setMsg(''), 3000) }

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('teacher_settings').select('*').eq('id', user.id).maybeSingle()
      setSettings(data)
    }
    load()
  }, [user.id])

  const setF = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))
  
  const generate = async () => {
    if (!form.title.trim()) { flash('عمّر عنوان الورشة أولاً'); return }

    const limit = await checkAiLimit(user.id)
    if (!limit.allowed) { flash(limit.message); return }

    setAiBusy(true)
    setMsg('')
    setOutput('')

    const prompt =
      'أنت خبير تربوي متخصص في تحرير التقارير الرسمية المغربية. ' +
      'حرّر تقريراً رسمياً كاملاً عن ورشة تربوية بأسلوب إداري رصين، بناءً على المعطيات التالية:\n\n' +
      '- عنوان الورشة: ' + form.title + '\n' +
      '- التاريخ: ' + form.date + '\n' +
      '- المكان: ' + (form.place || '—') + '\n' +
      '- المشاركون: ' + (form.participants || '—') + '\n' +
      '- الأهداف: ' + (form.objectives || '—') + '\n' +
      '- المحاور: ' + (form.axes || '—') + '\n' +
      '- أبرز المداخلات: ' + (form.interventions || '—') + '\n' +
      '- التوصيات: ' + (form.recommendations || '—') + '\n\n' +
      'المطلوب: تقرير منظّم يتضمّن مقدمة، ثم عرض الأهداف والمحاور، ثم أبرز المداخلات والنقاشات، ' +
      'ثم التوصيات والنتائج المتوقعة، وخاتمة بالشكر والتقدير. ' +
      'أرجع النص فقط بدون عنوان رئيسي أو شرح أو علامات markdown.'

    try {
      const { data, error } = await supabase.functions.invoke('ai-assistant', {
        body: { prompt },
      })
      if (error) { flash('تعذر الاتصال بالمساعد: ' + error.message); setAiBusy(false); return }

      const txt = (data?.answer || '').trim()
      if (!txt) { flash('ماتولّد حتى نص، عاود المحاولة'); setAiBusy(false); return }
      setOutput(txt)
      await recordAiUsage(user.id)
      flash('تولّد التقرير — راجعو قبل الطباعة')
    } catch (e) {
      flash('وقع خطأ، عاود المحاولة')
    }
    setAiBusy(false)
  }

    const today = new Date().toLocaleDateString('ar-MA')

  return (
    <div style={s.page}>
      <div style={s.container} className="no-print">
        <h1 style={s.title}>تقرير الورشات التربوية</h1>
        {msg && <div style={s.flash}>{msg}</div>}

        <h3 style={s.section}>معطيات الورشة</h3>
        <div style={s.grid}>
          <div style={{ gridColumn: '1 / -1' }}><label style={s.label}>عنوان الورشة *</label>
            <input value={form.title} onChange={setF('title')} style={s.input} placeholder="مثلا: ورشة التخطيط التربوي" /></div>
          <div><label style={s.label}>التاريخ</label>
            <input type="date" value={form.date} onChange={setF('date')} style={s.input} /></div>
          <div><label style={s.label}>المكان</label>
            <input value={form.place} onChange={setF('place')} style={s.input} placeholder="قاعة الاجتماعات" /></div>
          <div style={{ gridColumn: '1 / -1' }}><label style={s.label}>المشاركون</label>
            <input value={form.participants} onChange={setF('participants')} style={s.input} placeholder="الأساتذة، الإدارة..." /></div>
        </div>

        <label style={s.label}>الأهداف</label>
        <textarea value={form.objectives} onChange={setF('objectives')} style={s.textarea} placeholder="أهداف الورشة..." />
        <label style={s.label}>المحاور</label>
        <textarea value={form.axes} onChange={setF('axes')} style={s.textarea} placeholder="محاور الورشة..." />
        <label style={s.label}>أبرز المداخلات</label>
        <textarea value={form.interventions} onChange={setF('interventions')} style={s.textarea} placeholder="أبرز المداخلات والنقاشات..." />
        <label style={s.label}>التوصيات</label>
        <textarea value={form.recommendations} onChange={setF('recommendations')} style={s.textarea} placeholder="التوصيات..." />

        <div style={s.aiBox}>
          <span style={s.aiHint}>🤖 الـ AI غادي يصوغ تقريراً رسمياً منظّماً من هاد المعطيات</span>
          <button onClick={generate} disabled={aiBusy} style={s.aiBtn}>
            {aiBusy ? 'كيحرّر...' : 'حرّر التقرير'}
          </button>
        </div>

        {output && (
          <div className="no-print">
            <h3 style={s.section}>نص التقرير (قابل للتعديل)</h3>
            <textarea value={output} onChange={(e) => setOutput(e.target.value)} style={s.outputArea} />
            <div style={s.actions}>
              <button onClick={() => window.print()} style={s.printBtn}>طباعة / PDF</button>
            </div>
          </div>
        )}
      </div>

      {/* ═══ ورقة الطباعة ═══ */}
      {output && (
        <div className="print-sheet" style={s.printSheet}>
          <div style={s.pHead}>
            <div>المملكة المغربية — وزارة التربية الوطنية والتعليم الأولي والرياضة</div>
            {settings?.academy && <div>الأكاديمية الجهوية: {settings.academy}</div>}
            {settings?.direction && <div>المديرية الإقليمية: {settings.direction}</div>}
            {settings?.school_name && <div>المؤسسة: {settings.school_name}</div>}
            <div style={{ marginTop: '8px' }}>{today}</div>
          </div>

          <h2 style={s.pTitle}>تقرير ورشة: {form.title}</h2>
          <div style={s.pMeta}>
            التاريخ: {form.date} {form.place ? `· المكان: ${form.place}` : ''}
          </div>

          <div style={s.pBody}>{output}</div>

          <div style={s.pSign}>
            <div>المحرّر(ة)</div>
            <div style={{ marginTop: '6px' }}>{settings?.full_name}</div>
          </div>
        </div>
      )}
    </div>
  )
}
const s = {
  page: { background: '#f1f5f9', minHeight: '100vh', padding: '24px', direction: 'rtl', fontFamily: 'system-ui, sans-serif' },
  container: { maxWidth: '760px', margin: '0 auto', background: '#fff', borderRadius: '16px', padding: '28px', boxShadow: '0 4px 20px rgba(0,0,0,.08)' },
  title: { margin: '0 0 16px', color: '#0f172a', fontSize: '22px' },
  flash: { background: '#f0fdf4', color: '#059669', padding: '10px 14px', borderRadius: '10px', fontSize: '14px', fontWeight: 600, marginBottom: '16px' },

  section: { margin: '24px 0 12px', color: '#0f172a', fontSize: '17px', borderTop: '1px solid #e2e8f0', paddingTop: '18px' },
  label: { display: 'block', color: '#334155', fontSize: '14px', fontWeight: 600, margin: '12px 0 6px' },
  input: { width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '10px', fontSize: '15px', fontFamily: 'inherit', boxSizing: 'border-box' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' },
  textarea: { width: '100%', minHeight: '80px', padding: '12px', border: '1px solid #cbd5e1', borderRadius: '10px', fontSize: '14px', fontFamily: 'inherit', lineHeight: 1.8, resize: 'vertical', boxSizing: 'border-box' },

  aiBox: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '14px', background: 'linear-gradient(135deg, #eff6ff, #f0f9ff)', border: '1px solid #bae6fd', borderRadius: '12px', padding: '16px', marginTop: '24px', flexWrap: 'wrap' },
  aiHint: { fontSize: '13px', color: '#0369a1', flex: 1, minWidth: '200px' },
  aiBtn: { padding: '10px 24px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' },

  outputArea: { width: '100%', minHeight: '260px', padding: '14px', border: '1px solid #cbd5e1', borderRadius: '12px', fontSize: '15px', fontFamily: 'inherit', lineHeight: 1.9, resize: 'vertical', boxSizing: 'border-box' },
  actions: { display: 'flex', gap: '12px', marginTop: '14px', flexWrap: 'wrap' },
  printBtn: { padding: '11px 24px', background: '#0ea5e9', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: 600, cursor: 'pointer' },

  // ورقة الطباعة
  printSheet: { display: 'none' },
  pHead: { textAlign: 'center', fontSize: '12px', lineHeight: 1.8, marginBottom: '16px' },
  pTitle: { textAlign: 'center', fontSize: '19px', margin: '16px 0 8px', textDecoration: 'underline' },
  pMeta: { textAlign: 'center', fontSize: '13px', color: '#333', marginBottom: '20px' },
  pBody: { fontSize: '14px', lineHeight: 2.1, textAlign: 'justify', whiteSpace: 'pre-wrap', marginBottom: '50px' },
  pSign: { textAlign: 'left', fontSize: '14px', fontWeight: 600, marginTop: '40px' },
}

