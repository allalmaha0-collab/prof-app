import { useState, useEffect } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from './supabaseClient'
import { useAuth } from './AuthContext'

export default function Holidays() {
  const { user } = useAuth()
  const [holidays, setHolidays] = useState([])
  const [form, setForm] = useState({ name: '', start_date: '', end_date: '' })
  const [importing, setImporting] = useState(false)
  const [msg, setMsg] = useState('')

  const flash = (t) => { setMsg(t); setTimeout(() => setMsg(''), 3500) }

  const load = async () => {
    const { data } = await supabase
      .from('holidays')
      .select('*')
      .order('start_date')
    setHolidays(data || [])
  }

  useEffect(() => { load() }, [])

  const setF = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  // تحميل نموذج Excel فارغ (اسم · من · إلى)
  const downloadTemplate = () => {
    const rows = [
      ['اسم العطلة', 'من تاريخ', 'إلى تاريخ'],
      ['العطلة البينية الأولى', '2026-10-18', '2026-10-25'],
      ['عيد الاستقلال', '2026-11-18', '2026-11-18'],
    ]
    const ws = XLSX.utils.aoa_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'العطل')
    XLSX.writeFile(wb, 'نموذج-العطل.xlsx')
  }// استيراد العطل من ملف Excel
  const onFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    setMsg('')

    try {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array' })
      const sheet = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })

      // نلقاو صف العناوين (فيه "اسم" و "تاريخ")
      let headerIdx = rows.findIndex(r => {
        const j = r.map(c => String(c || '')).join(' ')
        return j.includes('اسم') && j.includes('تاريخ')
      })
      if (headerIdx === -1) headerIdx = 0  // إلا ماكاينش، نبداو من الأول

      const toAdd = []
      for (let i = headerIdx + 1; i < rows.length; i++) {
        const r = rows[i]
        const name = String(r[0] || '').trim()
        let start = String(r[1] || '').trim()
        let end = String(r[2] || '').trim()
        if (!name || !start) continue

        // تنسيق التاريخ (Excel أحياناً كيرجع رقم)
        start = normalizeDate(start)
        end = end ? normalizeDate(end) : start
        if (!start) continue

        toAdd.push({ name, start_date: start, end_date: end, is_official: true })
      }

      if (toAdd.length === 0) {
        flash('ماتلقاوش عطل — تأكد من النموذج (اسم · من · إلى)')
        setImporting(false)
        return
      }

      const { error } = await supabase.from('holidays').insert(toAdd)
      if (error) { flash('خطأ: ' + error.message); setImporting(false); return }
      flash(`تستوردو ${toAdd.length} عطلة ✓`)
      load()
    } catch (err) {
      flash('تعذّر قراءة الملف — تأكد أنه Excel صحيح')
    }
    setImporting(false)
    e.target.value = ''
  }

  // تحويل التاريخ لصيغة YYYY-MM-DD
  const normalizeDate = (val) => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val   // ديجا صحيح
    // Excel serial number (رقم)
    if (/^\d+$/.test(val)) {
      const d = new Date(Math.round((Number(val) - 25569) * 86400 * 1000))
      return d.toISOString().split('T')[0]
    }
    // محاولة تحليل عام
    const d = new Date(val)
    return isNaN(d) ? '' : d.toISOString().split('T')[0]
  }

  // إضافة عطلة يدوية
  const addHoliday = async () => {
    if (!form.name.trim()) { flash('عمّر اسم العطلة'); return }
    if (!form.start_date) { flash('عمّر تاريخ البداية'); return }
    const payload = {
      name: form.name.trim(),
      start_date: form.start_date,
      end_date: form.end_date || form.start_date,
      is_official: false,
    }
    const { error } = await supabase.from('holidays').insert(payload)
    if (error) { flash('خطأ: ' + error.message); return }
    setForm({ name: '', start_date: '', end_date: '' })
    flash('تزادت العطلة ✓')
    load()
  }

  // حذف عطلة
  const delHoliday = async (id) => {
    if (!confirm('متأكد باغي تمسح هاد العطلة؟')) return
    await supabase.from('holidays').delete().eq('id', id)
    load()
  }

  // حذف الكل
  const delAll = async () => {
    if (!confirm('متأكد باغي تمسح كل العطل؟')) return
    await supabase.from('holidays').delete().neq('id', 0)
    load()
    flash('تمسح الجميع ✓')
  }
  const daysBetween = (start, end) => {
    const d1 = new Date(start), d2 = new Date(end)
    return Math.round((d2 - d1) / (1000 * 60 * 60 * 24)) + 1
  }

  return (
    <div style={s.page}>
      <div style={s.container}>
        <h1 style={s.title}>العطل المدرسية</h1>
        {msg && <div style={s.flash}>{msg}</div>}

        {/* الاستيراد من Excel */}
        <div style={s.importBox}>
          <div style={s.importInfo}>
            <strong style={s.importTitle}>📥 استيراد العطل من Excel</strong>
            <span style={s.importHint}>حمّل النموذج الفارغ، عمّرو بعطل الموسم، ثم استوردو</span>
          </div>
          <div style={s.importBtns}>
            <button onClick={downloadTemplate} style={s.templateBtn}>تحميل نموذج فارغ</button>
            <label style={s.importBtn}>
              {importing ? 'كيستورد...' : 'استيراد الملف'}
              <input type="file" accept=".xlsx,.xls" onChange={onFile} style={{ display: 'none' }} disabled={importing} />
            </label>
          </div>
        </div>

        {/* إضافة يدوية */}
        <h3 style={s.section}>إضافة عطلة يدوياً</h3>
        <div style={s.addRow}>
          <div style={s.addName}>
            <label style={s.label}>اسم العطلة</label>
            <input value={form.name} onChange={setF('name')} style={s.input} placeholder="مثلا: عطلة استثنائية" />
          </div>
          <div>
            <label style={s.label}>من تاريخ</label>
            <input type="date" value={form.start_date} onChange={setF('start_date')} style={s.input} />
          </div>
          <div>
            <label style={s.label}>إلى (اختياري)</label>
            <input type="date" value={form.end_date} onChange={setF('end_date')} style={s.input} />
          </div>
          <button onClick={addHoliday} style={s.addBtn}>+ زيد</button>
        </div>

        {/* لائحة العطل */}
        <div style={s.listHeader}>
          <h3 style={{ ...s.section, margin: 0, border: 'none', padding: 0 }}>
            العطل المسجّلة ({holidays.length})
          </h3>
          {holidays.length > 0 && <button onClick={delAll} style={s.delAllBtn}>حذف الكل</button>}
        </div>

        {holidays.length === 0 ? (
          <p style={s.muted}>مازال حتى عطلة — حمّل النموذج، عمّرو، واستوردو.</p>
        ) : (
          <div style={s.list}>
            {holidays.map(h => (
              <div key={h.id} style={s.item}>
                <div style={s.itemInfo}>
                  <div style={s.itemName}>
                    {h.name}
                    {h.is_official && <span style={s.badge}>مستوردة</span>}
                  </div>
                  <div style={s.itemDates}>
                    {h.start_date} {h.end_date !== h.start_date ? `→ ${h.end_date}` : ''}
                    <span style={s.itemDays}>({daysBetween(h.start_date, h.end_date)} يوم)</span>
                  </div>
                </div>
                <button onClick={() => delHoliday(h.id)} style={s.delBtn}>✕</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}const s = {
  page: { background: '#f1f5f9', minHeight: '100vh', padding: '24px', direction: 'rtl', fontFamily: 'system-ui, sans-serif' },
  container: { maxWidth: '820px', margin: '0 auto', background: '#fff', borderRadius: '16px', padding: '24px', boxShadow: '0 4px 20px rgba(0,0,0,.08)' },
  title: { margin: '0 0 16px', color: '#0f172a', fontSize: '22px' },
  flash: { background: '#f0fdf4', color: '#059669', padding: '10px 14px', borderRadius: '10px', fontSize: '14px', fontWeight: 600, marginBottom: '16px' },

  importBox: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '14px', background: 'linear-gradient(135deg, #eff6ff, #f0f9ff)', border: '1px solid #bae6fd', borderRadius: '12px', padding: '16px', marginBottom: '8px', flexWrap: 'wrap' },
  importInfo: { display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, minWidth: '200px' },
  importTitle: { fontSize: '15px', color: '#0369a1' },
  importHint: { fontSize: '12px', color: '#64748b' },
  importBtns: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
  templateBtn: { padding: '10px 18px', background: '#fff', color: '#0ea5e9', border: '1px solid #0ea5e9', borderRadius: '10px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' },
  importBtn: { padding: '10px 20px', background: '#0ea5e9', color: '#fff', borderRadius: '10px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', border: 'none' },

  section: { margin: '24px 0 12px', color: '#0f172a', fontSize: '17px', borderTop: '1px solid #e2e8f0', paddingTop: '18px' },
  addRow: { display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' },
  addName: { flex: 1, minWidth: '180px' },
  label: { display: 'block', color: '#334155', fontSize: '13px', fontWeight: 600, marginBottom: '5px' },
  input: { width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '9px', fontSize: '14px', fontFamily: 'inherit', boxSizing: 'border-box' },
  addBtn: { padding: '10px 22px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' },

  listHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '24px 0 12px', borderTop: '1px solid #e2e8f0', paddingTop: '18px', flexWrap: 'wrap', gap: '10px' },
  delAllBtn: { padding: '7px 16px', background: '#fff', color: '#ef4444', border: '1px solid #fecaca', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' },
  muted: { color: '#94a3b8', fontSize: '14px', textAlign: 'center', padding: '30px' },

  list: { display: 'flex', flexDirection: 'column', gap: '8px' },
  item: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', border: '1px solid #e2e8f0', borderRadius: '10px', gap: '10px' },
  itemInfo: { flex: 1 },
  itemName: { fontSize: '15px', fontWeight: 600, color: '#0f172a', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' },
  badge: { background: '#dbeafe', color: '#1e40af', padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: 600 },
  itemDates: { fontSize: '13px', color: '#64748b' },
  itemDays: { marginInlineStart: '8px', color: '#94a3b8' },
  delBtn: { padding: '5px 10px', background: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca', borderRadius: '7px', fontSize: '13px', cursor: 'pointer' },
}