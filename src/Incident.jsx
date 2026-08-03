import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { useAuth } from './AuthContext'

const EMPTY = {
  student_name: '', student_class: '', incident_date: new Date().toISOString().split('T')[0],
  incident_time: '', place: '', raw_desc: '', injury: '', actions: '', witnesses: '',
}

export default function Incident() {
  const { user } = useAuth()
  const [form, setForm] = useState(EMPTY)
  const [photo, setPhoto] = useState(null)       // الصورة (base64، محلية فقط)
  const [settings, setSettings] = useState(null)
  const [output, setOutput] = useState('')       // الوصف الرسمي المولّد
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
  }, [user.id])

  const setF = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  // اختيار صورة → تحويلها base64 (محلية، بلا رفع)
  const onPhoto = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { flash('الصورة كبيرة (أقصى 5MB)'); return }
    const reader = new FileReader()
    reader.onload = () => setPhoto(reader.result)
    reader.readAsDataURL(file)
  }// توليد وصف رسمي للحادثة بالذكاء الاصطناعي
  const generate = async () => {
    if (!form.student_name.trim()) { flash('عمّر اسم التلميذ أولاً'); return }
    if (!form.raw_desc.trim()) { flash('عمّر وصفاً مختصراً للحادثة'); return }
    setAiBusy(true)
    setMsg('')
    setOutput('')

    const prompt =
      'أنت مدير/أستاذ خبير بتحرير الوثائق الإدارية المدرسية المغربية. ' +
      'حرّر وصفاً رسمياً موضوعياً لحادثة مدرسية بناءً على المعطيات التالية، ' +
      'بأسلوب إداري رصين ومحايد (بدون مبالغة أو تحميل مسؤولية):\n\n' +
      '- التلميذ(ة): ' + form.student_name + '\n' +
      '- القسم/المستوى: ' + (form.student_class || '—') + '\n' +
      '- تاريخ الحادثة: ' + form.incident_date + '\n' +
      '- وقت الحادثة: ' + (form.incident_time || '—') + '\n' +
      '- مكان الحادثة: ' + (form.place || '—') + '\n' +
      '- وصف مختصر مما وقع: ' + form.raw_desc + '\n' +
      '- نوع الإصابة: ' + (form.injury || '—') + '\n' +
      '- الإجراءات المتخذة: ' + (form.actions || '—') + '\n' +
      '- الشهود: ' + (form.witnesses || '—') + '\n\n' +
      'المطلوب: فقرة أو فقرتان تصفان الحادثة بدقة وموضوعية، ثم الإجراءات المتخذة. ' +
      'أرجع النص فقط بدون عنوان أو شرح أو علامات markdown.'

    try {
      const { data, error } = await supabase.functions.invoke('ai-assistant', {
        body: { prompt },
      })
      if (error) { flash('تعذر الاتصال بالمساعد: ' + error.message); setAiBusy(false); return }

      const txt = (data?.answer || '').trim()
      if (!txt) { flash('ماتولّد حتى نص، عاود المحاولة'); setAiBusy(false); return }
      setOutput(txt)
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
        <h1 style={s.title}>تقرير حادثة مدرسية</h1>
        {msg && <div style={s.flash}>{msg}</div>}

        {/* معلومات التلميذ */}
        <h3 style={s.section}>معلومات التلميذ والحادثة</h3>
        <div style={s.grid}>
          <div><label style={s.label}>اسم التلميذ(ة) *</label>
            <input value={form.student_name} onChange={setF('student_name')} style={s.input} placeholder="الاسم الكامل" /></div>
          <div><label style={s.label}>القسم / المستوى</label>
            <input value={form.student_class} onChange={setF('student_class')} style={s.input} placeholder="مثلا: الرابع أ" /></div>
          <div><label style={s.label}>تاريخ الحادثة</label>
            <input type="date" value={form.incident_date} onChange={setF('incident_date')} style={s.input} /></div>
          <div><label style={s.label}>وقت الحادثة</label>
            <input type="time" value={form.incident_time} onChange={setF('incident_time')} style={s.input} /></div>
          <div style={{ gridColumn: '1 / -1' }}><label style={s.label}>مكان الحادثة</label>
            <input value={form.place} onChange={setF('place')} style={s.input} placeholder="مثلا: ساحة المدرسة / القسم / قاعة الرياضة" /></div>
        </div>

        {/* الوصف والإجراءات */}
        <h3 style={s.section}>تفاصيل الحادثة</h3>
        <label style={s.label}>وصف مختصر مما وقع * (الـ AI غادي يصوغو رسمي)</label>
        <textarea value={form.raw_desc} onChange={setF('raw_desc')} style={s.textarea} placeholder="اكتب بإيجاز كيفاش وقعت الحادثة..." />
        <div style={s.grid}>
          <div><label style={s.label}>نوع الإصابة</label>
            <input value={form.injury} onChange={setF('injury')} style={s.input} placeholder="مثلا: جرح خفيف بالركبة" /></div>
          <div><label style={s.label}>الشهود</label>
            <input value={form.witnesses} onChange={setF('witnesses')} style={s.input} placeholder="اختياري" /></div>
          <div style={{ gridColumn: '1 / -1' }}><label style={s.label}>الإجراءات المتخذة</label>
            <input value={form.actions} onChange={setF('actions')} style={s.input} placeholder="مثلا: إسعاف أولي، اتصال بالأولياء، نقل للمستوصف" /></div>
        </div>

        {/* الصورة */}
        <h3 style={s.section}>صورة مكان الحادثة</h3>
        <input type="file" accept="image/*" onChange={onPhoto} style={s.fileInput} />
        {photo && (
          <div style={s.photoPreview}>
            <img src={photo} alt="مكان الحادثة" style={s.photoImg} />
            <button onClick={() => setPhoto(null)} style={s.removePhoto}>حذف الصورة</button>
          </div>
        )}

        {/* توليد */}
        <div style={s.aiBox}>
          <span style={s.aiHint}>🤖 الـ AI غادي يصوغ وصف الحادثة بأسلوب إداري رسمي ومحايد</span>
          <button onClick={generate} disabled={aiBusy} style={s.aiBtn}>
            {aiBusy ? 'كيحرّر...' : 'حرّر التقرير'}
          </button>
        </div>

        {/* المخرَج (فالشاشة فقط، مايطبعش) */}
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

      {/* ═══ ورقة الطباعة الرسمية (النص فقط، بلا جدول المعطيات) ═══ */}
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
            <div style={{ textAlign: 'left' }}><div>{today}</div></div>
          </div>

          <h2 style={s.pTitle}>تقرير حادثة مدرسية</h2>

          <div style={s.pBlock}><p style={s.pText}>{output}</p></div>

          {photo && (
            <div style={s.pPhotoBlock}>
              <strong>صورة مكان الحادثة:</strong>
              <img src={photo} alt="مكان الحادثة" style={s.pPhoto} />
            </div>
          )}

          <div style={s.pSign}>
            <div>الأستاذ(ة) المحرّر(ة)</div>
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
  label: { display: 'block', color: '#334155', fontSize: '14px', fontWeight: 600, margin: '10px 0 6px' },
  input: { width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '10px', fontSize: '15px', fontFamily: 'inherit', boxSizing: 'border-box' },
  textarea: { width: '100%', minHeight: '90px', padding: '12px', border: '1px solid #cbd5e1', borderRadius: '10px', fontSize: '15px', fontFamily: 'inherit', lineHeight: 1.8, resize: 'vertical', boxSizing: 'border-box', marginBottom: '12px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' },

  fileInput: { display: 'block', fontSize: '14px', fontFamily: 'inherit' },
  photoPreview: { marginTop: '12px' },
  photoImg: { maxWidth: '280px', width: '100%', borderRadius: '10px', border: '1px solid #cbd5e1', display: 'block' },
  removePhoto: { marginTop: '8px', padding: '6px 14px', background: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' },

  aiBox: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '14px', background: 'linear-gradient(135deg, #eff6ff, #f0f9ff)', border: '1px solid #bae6fd', borderRadius: '12px', padding: '16px', marginTop: '24px', flexWrap: 'wrap' },
  aiHint: { fontSize: '13px', color: '#0369a1', flex: 1, minWidth: '200px' },
  aiBtn: { padding: '10px 24px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' },

  outputArea: { width: '100%', minHeight: '200px', padding: '14px', border: '1px solid #cbd5e1', borderRadius: '12px', fontSize: '15px', fontFamily: 'inherit', lineHeight: 1.9, resize: 'vertical', boxSizing: 'border-box' },
  actions: { display: 'flex', gap: '12px', marginTop: '14px', flexWrap: 'wrap' },
  printBtn: { padding: '11px 24px', background: '#0ea5e9', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: 600, cursor: 'pointer' },

  // ورقة الطباعة
  printSheet: { display: 'none' },
  pHead: { display: 'flex', justifyContent: 'space-between', fontSize: '13px', lineHeight: 2, marginBottom: '24px' },
  pTitle: { textAlign: 'center', fontSize: '20px', margin: '16px 0', textDecoration: 'underline' },
  pTable: { width: '100%', borderCollapse: 'collapse', marginBottom: '20px' },
  pL: { border: '1px solid #333', padding: '7px 10px', background: '#f0f0f0', fontWeight: 700, fontSize: '13px', width: '18%' },
  pV: { border: '1px solid #333', padding: '7px 10px', fontSize: '13px' },
  pBlock: { margin: '16px 0', fontSize: '14px', lineHeight: 1.9 },
  pText: { whiteSpace: 'pre-wrap', textAlign: 'justify', marginTop: '6px' },
  pPhotoBlock: { margin: '20px 0' },
  pPhoto: { display: 'block', maxWidth: '400px', width: '100%', marginTop: '10px', border: '1px solid #333', borderRadius: '4px' },
  pSign: { textAlign: 'left', fontSize: '14px', fontWeight: 600, marginTop: '40px' },
}