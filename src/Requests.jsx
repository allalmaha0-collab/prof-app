import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { useAuth } from './AuthContext'

// أنواع الطلبات + الحقول الخاصة بكل نوع
const REQUEST_TYPES = {
  work_cert: {
    label: 'طلب شهادة عمل',
    fields: [{ k: 'purpose', label: 'الغرض من الشهادة', ph: 'مثلا: لتقديمها لجهة معنية' }],
  },
  leave: {
    label: 'طلب رخصة',
    fields: [
      { k: 'leave_type', label: 'نوع الرخصة', ph: 'رخصة إدارية / رخصة استثنائية' },
      { k: 'days', label: 'عدد الأيام', ph: 'مثلا: 3' },
      { k: 'start_date', label: 'تاريخ البداية', ph: '' },
      { k: 'reason', label: 'السبب', ph: 'مثلا: ظروف عائلية' },
    ],
  },
  salary_cert: {
    label: 'طلب شهادة الأجرة',
    fields: [{ k: 'purpose', label: 'الغرض', ph: 'مثلا: لتقديمها للبنك / لطلب قرض' }],
  },
  authorization: {
    label: 'طلب ترخيص',
    fields: [
      { k: 'auth_for', label: 'الترخيص من أجل', ph: 'مثلا: المشاركة في مباراة / تكوين' },
      { k: 'auth_date', label: 'التاريخ / المدة', ph: 'مثلا: يوم 15 ماي 2026' },
      { k: 'auth_place', label: 'المكان', ph: 'مثلا: مدينة وجدة' },
    ],
  },
  assignment: {
    label: 'طلب تكليف',
    fields: [
      { k: 'task', label: 'المهمة / التكليف', ph: 'مثلا: تكليف بمهمة تربوية' },
      { k: 'task_details', label: 'تفاصيل إضافية', ph: 'اختياري' },
    ],
  },
}

export default function Requests() {
  const { user } = useAuth()
  const [type, setType] = useState('work_cert')
  const [fields, setFields] = useState({})
  const [recipient, setRecipient] = useState('السيد المدير الإقليمي')
  const [settings, setSettings] = useState(null)
  const [output, setOutput] = useState('')
  const [aiBusy, setAiBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const flash = (t) => { setMsg(t); setTimeout(() => setMsg(''), 3000) }

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('teacher_settings')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()
      setSettings(data)
    }
    load()
  }, [user.id])// تبديل نوع الطلب → نمسحو الحقول
  const changeType = (t) => {
    setType(t)
    setFields({})
    setOutput('')
  }

  const setField = (k, v) => setFields(f => ({ ...f, [k]: v }))

  // توليد الطلب بالذكاء الاصطناعي
  const generate = async () => {
    if (!settings?.full_name) {
      flash('عمّر الإعدادات أولاً (الاسم، المؤسسة، رقم التأجير)')
      return
    }
    setAiBusy(true)
    setMsg('')
    setOutput('')

    const typeInfo = REQUEST_TYPES[type]
    const fieldsText = typeInfo.fields
      .map(f => `${f.label}: ${fields[f.k] || '—'}`)
      .join('\n')

    const prompt =
      'أنت كاتب إداري خبير بالصيغ الرسمية المغربية (وزارة التربية الوطنية). ' +
      'حرّر طلباً إدارياً رسمياً باللغة العربية الفصحى بصيغة مهنية سليمة.\n\n' +
      'نوع الطلب: ' + typeInfo.label + '\n' +
      'موجّه إلى: ' + recipient + '\n\n' +
      'معلومات مقدّم الطلب:\n' +
      '- الاسم الكامل: ' + settings.full_name + '\n' +
      '- الصفة: ' + (settings.grade || 'أستاذ(ة)') + '\n' +
      '- رقم التأجير: ' + (settings.ppr || '—') + '\n' +
      '- المؤسسة: ' + (settings.school_name || '—') + '\n' +
      '- المديرية الإقليمية: ' + (settings.direction || '—') + '\n' +
      '- الأكاديمية الجهوية: ' + (settings.academy || '—') + '\n\n' +
      'تفاصيل الطلب:\n' + fieldsText + '\n\n' +
      'المطلوب: حرّر نص الطلب كاملاً بصيغة رسمية (بدون ترويسة المملكة، سأضيفها أنا). ' +
      'ابدأ بعبارة "وبعد،" أو ما يناسب، ثم صلب الطلب بصيغة مهذبة ومباشرة، ' +
      'واختم بعبارة ختامية رسمية مناسبة. أرجع النص فقط بدون أي شرح أو علامات markdown.'

    try {
      const { data, error } = await supabase.functions.invoke('ai-assistant', {
        body: { prompt },
      })
      if (error) { flash('تعذر الاتصال بالمساعد: ' + error.message); setAiBusy(false); return }

      const txt = (data?.answer || '').trim()
      if (!txt) { flash('ماتولّد حتى نص، عاود المحاولة'); setAiBusy(false); return }
      setOutput(txt)
      flash('تولّد الطلب — راجعو قبل الطباعة')
    } catch (e) {
      flash('وقع خطأ، عاود المحاولة')
    }
    setAiBusy(false)
  }
  
  const typeInfo = REQUEST_TYPES[type]
  const today = new Date().toLocaleDateString('ar-MA')

  return (
    <div style={s.page}>
      <div style={s.container} className="no-print">
        <h1 style={s.title}>الطلبات الإدارية</h1>
        {msg && <div style={s.flash}>{msg}</div>}

        {/* نوع الطلب */}
        <label style={s.label}>نوع الطلب</label>
        <select value={type} onChange={(e) => changeType(e.target.value)} style={s.input}>
          {Object.entries(REQUEST_TYPES).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>

        {/* الجهة المرسل إليها */}
        <label style={s.label}>موجّه إلى</label>
        <input value={recipient} onChange={(e) => setRecipient(e.target.value)} style={s.input}
          placeholder="السيد المدير الإقليمي" />

        {/* الحقول الخاصة بالنوع */}
        <h3 style={s.section}>تفاصيل الطلب</h3>
        <div style={s.grid}>
          {typeInfo.fields.map(f => (
            <div key={f.k}>
              <label style={s.label}>{f.label}</label>
              <input value={fields[f.k] || ''} onChange={(e) => setField(f.k, e.target.value)}
                style={s.input} placeholder={f.ph} />
            </div>
          ))}
        </div>

        {/* زر التوليد */}
        <div style={s.aiBox}>
          <span style={s.aiHint}>🤖 الـ AI غادي يصوغ الطلب بصيغة رسمية من معلومات إعداداتك</span>
          <button onClick={generate} disabled={aiBusy} style={s.aiBtn}>
            {aiBusy ? 'كيحرّر...' : 'حرّر الطلب'}
          </button>
        </div>

        {/* المخرَج القابل للتعديل */}
        {output && (
          <>
            <h3 style={s.section}>نص الطلب (قابل للتعديل)</h3>
            <textarea value={output} onChange={(e) => setOutput(e.target.value)} style={s.outputArea} />
            <div style={s.actions}>
              <button onClick={() => window.print()} style={s.printBtn}>طباعة / PDF</button>
              <button onClick={() => { navigator.clipboard.writeText(output); flash('تنسخ ✓') }} style={s.copyBtn}>
                نسخ النص
              </button>
            </div>
          </>
        )}
      </div>

      {/* ═══ ورقة الطباعة الرسمية ═══ */}
      {output && (
        <div className="print-sheet" style={s.printSheet}>
          <div style={s.pHead}>
            <div>
              <div>المملكة المغربية</div>
              <div>وزارة التربية الوطنية والتعليم الأولي والرياضة</div>
              {settings?.academy && <div>الأكاديمية الجهوية: {settings.academy}</div>}
              {settings?.direction && <div>المديرية الإقليمية: {settings.direction}</div>}
              {settings?.school_name && <div>المؤسسة: {settings.school_name}</div>}
            </div>
            <div style={{ textAlign: 'left' }}>
              <div>{settings?.school_name ? '' : ''}</div>
              <div>{today}</div>
            </div>
          </div>

          <h2 style={s.pTitle}>{typeInfo.label}</h2>

          <div style={s.pMeta}>
            <div><strong>من:</strong> {settings?.full_name} — {settings?.grade || 'أستاذ(ة)'}</div>
            {settings?.ppr && <div><strong>رقم التأجير:</strong> {settings.ppr}</div>}
            <div><strong>إلى:</strong> {recipient}</div>
          </div>

          <div style={s.pBody}>{output}</div>

          <div style={s.pSign}>
            <div>الإمضاء</div>
            <div style={{ marginTop: '6px' }}>{settings?.full_name}</div>
          </div>
        </div>
      )}
    </div>
  )
}const s = {
  page: { background: '#f1f5f9', minHeight: '100vh', padding: '24px', direction: 'rtl', fontFamily: 'system-ui, sans-serif' },
  container: { maxWidth: '760px', margin: '0 auto', background: '#fff', borderRadius: '16px', padding: '28px', boxShadow: '0 4px 20px rgba(0,0,0,.08)' },
  title: { margin: '0 0 16px', color: '#0f172a', fontSize: '22px' },
  flash: { background: '#f0fdf4', color: '#059669', padding: '10px 14px', borderRadius: '10px', fontSize: '14px', fontWeight: 600, marginBottom: '16px' },

  label: { display: 'block', color: '#334155', fontSize: '14px', fontWeight: 600, margin: '14px 0 6px' },
  input: { width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '10px', fontSize: '15px', fontFamily: 'inherit', boxSizing: 'border-box' },
  section: { margin: '24px 0 12px', color: '#0f172a', fontSize: '17px', borderTop: '1px solid #e2e8f0', paddingTop: '18px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' },

  aiBox: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '14px', background: 'linear-gradient(135deg, #eff6ff, #f0f9ff)', border: '1px solid #bae6fd', borderRadius: '12px', padding: '16px', marginTop: '24px', flexWrap: 'wrap' },
  aiHint: { fontSize: '13px', color: '#0369a1', flex: 1, minWidth: '200px' },
  aiBtn: { padding: '10px 24px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' },

  outputArea: { width: '100%', minHeight: '220px', padding: '14px', border: '1px solid #cbd5e1', borderRadius: '12px', fontSize: '15px', fontFamily: 'inherit', lineHeight: 1.9, resize: 'vertical', boxSizing: 'border-box' },
  actions: { display: 'flex', gap: '12px', marginTop: '14px', flexWrap: 'wrap' },
  printBtn: { padding: '11px 24px', background: '#0ea5e9', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: 600, cursor: 'pointer' },
  copyBtn: { padding: '11px 22px', background: '#fff', color: '#0ea5e9', border: '1px solid #0ea5e9', borderRadius: '10px', fontSize: '15px', fontWeight: 600, cursor: 'pointer' },

  // ورقة الطباعة
  printSheet: { display: 'none' },
  pHead: { display: 'flex', justifyContent: 'space-between', fontSize: '13px', lineHeight: 2, marginBottom: '30px' },
  pTitle: { textAlign: 'center', fontSize: '20px', margin: '20px 0', textDecoration: 'underline' },
  pMeta: { fontSize: '14px', lineHeight: 2, marginBottom: '24px' },
  pBody: { fontSize: '15px', lineHeight: 2.2, textAlign: 'justify', whiteSpace: 'pre-wrap', marginBottom: '50px' },
  pSign: { textAlign: 'left', fontSize: '14px', fontWeight: 600, marginTop: '40px' },
}