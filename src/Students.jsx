import { useState, useEffect } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from './supabaseClient'
import { useAuth } from './AuthContext'



export default function Students() {
  const { user } = useAuth()
  const [students, setStudents] = useState([])
  const [filterClass, setFilterClass] = useState('')
  const [importing, setImporting] = useState(false)
  const [msg, setMsg] = useState('')

  const flash = (t) => { setMsg(t); setTimeout(() => setMsg(''), 4000) }

  const load = async () => {
    const { data } = await supabase
      .from('students')
      .select('*')
      .order('class_name')
      .order('last_name')
    setStudents(data || [])
  }

  useEffect(() => { load() }, [])

 // استيراد ملف Excel من مسار (يدعم عدة أوراق، كل ورقة قسم)
  const onFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    setMsg('')

    try {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array' })
      const allStudents = []

      // نمشيو على كل ورقة (كل ورقة = قسم)
      for (const sheetName of wb.SheetNames) {
        const sheet = wb.Sheets[sheetName]
        // نقراو الورقة كصفوف خام (مصفوفات)
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })

        // القسم = اسم الورقة
        const className = sheetName.trim()

        // نقلّبو على المستوى فالترويسة (صف فيه "المستوى")
        let level = ''
        for (const row of rows.slice(0, 10)) {
          const joined = row.map(c => String(c || '')).join(' ')
          if (joined.includes('المستوى')) {
            // ناخدو القيمة اللي بعد "المستوى"
            const idx = row.findIndex(c => String(c || '').includes('المستوى'))
            if (idx >= 0 && row[idx + 1]) level = String(row[idx + 1]).trim()
          }
        }

        // نلقاو صف العناوين (اللي فيه "الرمز" و "النسب")
        let headerIdx = -1
        for (let i = 0; i < rows.length; i++) {
          const joined = rows[i].map(c => String(c || '')).join(' ')
          if (joined.includes('الرمز') && joined.includes('النسب')) { headerIdx = i; break }
        }
        if (headerIdx === -1) continue  // ورقة بلا عناوين، نتجاهلوها

        const headers = rows[headerIdx].map(c => String(c || '').trim())
        // مواقع الأعمدة حسب العنوان
        const col = (name) => headers.findIndex(h => h.includes(name))
        const ci = {
          massar: col('الرمز'),
          last: col('النسب'),
          first: col('الإسم'),
          gender: col('النوع'),
          bdate: col('الإزدياد') >= 0 ? col('الإزدياد') : col('الازدياد'),
          bplace: headers.findIndex(h => h.includes('مكان')),
        }

        // التلاميذ (من بعد صف العناوين)
        for (let i = headerIdx + 1; i < rows.length; i++) {
          const r = rows[i]
          const massar = ci.massar >= 0 ? String(r[ci.massar] || '').trim() : ''
          const last = ci.last >= 0 ? String(r[ci.last] || '').trim() : ''
          const first = ci.first >= 0 ? String(r[ci.first] || '').trim() : ''
          if (!massar && !last && !first) continue  // صف فارغ

          allStudents.push({
            massar_number: massar,
            last_name: last,
            first_name: first,
            gender: ci.gender >= 0 ? String(r[ci.gender] || '').trim() : '',
            birth_date: ci.bdate >= 0 ? String(r[ci.bdate] || '').trim() : '',
            birth_place: ci.bplace >= 0 ? String(r[ci.bplace] || '').trim() : '',
            class_name: className,
            level: level,
          })
        }
      }

      if (allStudents.length === 0) {
        flash('ماتلقاوش تلاميذ — تأكد أنه ملف مسار صحيح')
        setImporting(false)
        return
      }

      const { error } = await supabase.from('students').insert(allStudents)
      if (error) { flash('خطأ فالاستيراد: ' + error.message); setImporting(false); return }

      flash(`تستوردو ${allStudents.length} تلميذ ✓`)
      load()
    } catch (err) {
      flash('تعذّر قراءة الملف — تأكد أنه ملف Excel من مسار')
    }
    setImporting(false)
    e.target.value = ''
  }

  // حذف تلميذ واحد
  const delStudent = async (id) => {
    if (!confirm('متأكد باغي تمسح هاد التلميذ؟')) return
    await supabase.from('students').delete().eq('id', id)
    load()
  }

  // حذف كل تلاميذ قسم معيّن
  const delClass = async (className) => {
    if (!confirm(`متأكد باغي تمسح كل تلاميذ القسم "${className}"؟`)) return
    await supabase.from('students').delete().eq('class_name', className)
    load()
    flash('تمسح القسم ✓')
  }

  // حذف كل التلاميذ (لإعادة استيراد نظيف)
  const delAll = async () => {
    if (!confirm('متأكد باغي تمسح كل التلاميذ؟ هاد العملية ماكاينش رجوع فيها.')) return
    await supabase.from('students').delete().neq('id', 0)
    load()
    flash('تمسح الجميع ✓')
  }

  // لائحة الأقسام الموجودة
  const classes = [...new Set(students.map(s => s.class_name).filter(Boolean))].sort()

  // التلاميذ بعد التصفية
  const filtered = filterClass
    ? students.filter(s => s.class_name === filterClass)
    : students

    return (
    <div style={s.page}>
      <div style={s.container} className="no-print">
        <h1 style={s.title}>التلاميذ</h1>
        {msg && <div style={s.flash}>{msg}</div>}

        {/* الاستيراد */}
        <div style={s.importBox}>
          <div style={s.importInfo}>
            <strong style={s.importTitle}>📥 استيراد من مسار</strong>
            <span style={s.importHint}>اختار ملف Excel المصدّر من مسار (الأعمدة: رقم مسار، النسب، الاسم، القسم...)</span>
          </div>
          <label style={s.importBtn}>
            {importing ? 'كيستورد...' : 'اختار ملف Excel'}
            <input type="file" accept=".xlsx,.xls" onChange={onFile} style={{ display: 'none' }} disabled={importing} />
          </label>
        </div>

        {/* الأدوات: تصفية + عدد + طباعة */}
        <div style={s.toolbar}>
          <div style={s.toolLeft}>
            <select value={filterClass} onChange={(e) => setFilterClass(e.target.value)} style={s.filterSelect}>
              <option value="">كل الأقسام ({students.length})</option>
              {classes.map(c => (
                <option key={c} value={c}>
                  {c} ({students.filter(st => st.class_name === c).length})
                </option>
              ))}
            </select>
          </div>
          <div style={s.toolRight}>
            {filtered.length > 0 && (
              <button onClick={() => window.print()} style={s.printBtn}>طباعة اللائحة</button>
            )}
            {filterClass && (
              <button onClick={() => delClass(filterClass)} style={s.delClassBtn}>حذف القسم</button>
            )}
            {students.length > 0 && (
              <button onClick={delAll} style={s.delAllBtn}>حذف الكل</button>
            )}
          </div>
        </div>

        {/* الجدول */}
        {filtered.length === 0 ? (
          <p style={s.muted}>مازال حتى تلميذ — استورد لائحة من مسار.</p>
        ) : (
          <div style={s.tableWrap}>
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>#</th>
                  <th style={s.th}>رقم مسار</th>
                  <th style={s.th}>النسب</th>
                  <th style={s.th}>الاسم</th>
                  <th style={s.th}>تاريخ الازدياد</th>
                  <th style={s.th}>الجنس</th>
                  <th style={s.th}>القسم</th>
                  <th style={s.th}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((st, i) => (
                  <tr key={st.id}>
                    <td style={s.td}>{i + 1}</td>
                    <td style={s.td} dir="ltr">{st.massar_number}</td>
                    <td style={s.td}>{st.last_name}</td>
                    <td style={s.td}>{st.first_name}</td>
                    <td style={s.td}>{st.birth_date}</td>
                    <td style={s.td}>{st.gender}</td>
                    <td style={s.td}>{st.class_name}</td>
                    <td style={s.td}>
                      <button onClick={() => delStudent(st.id)} style={s.delBtn}>✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ═══ ورقة الطباعة الرسمية ═══ */}
      {filtered.length > 0 && (
        <div className="print-sheet" style={s.printSheet}>
          <div style={s.pHead}>
            <div>المملكة المغربية — وزارة التربية الوطنية</div>
            <div>لائحة التلاميذ {filterClass ? `— القسم: ${filterClass}` : ''}</div>
          </div>
          <table style={s.pTable}>
            <thead>
              <tr>
                <th style={s.pth}>#</th><th style={s.pth}>رقم مسار</th><th style={s.pth}>النسب</th>
                <th style={s.pth}>الاسم</th><th style={s.pth}>تاريخ الازدياد</th><th style={s.pth}>الجنس</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((st, i) => (
                <tr key={st.id}>
                  <td style={s.ptd}>{i + 1}</td>
                  <td style={s.ptd} dir="ltr">{st.massar_number}</td>
                  <td style={s.ptd}>{st.last_name}</td>
                  <td style={s.ptd}>{st.first_name}</td>
                  <td style={s.ptd}>{st.birth_date}</td>
                  <td style={s.ptd}>{st.gender}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={s.pCount}>عدد التلاميذ: {filtered.length}</div>
        </div>
      )}
    </div>
  )
}

const s = {
  page: { background: '#f1f5f9', minHeight: '100vh', padding: '24px', direction: 'rtl', fontFamily: 'system-ui, sans-serif' },
  container: { maxWidth: '1000px', margin: '0 auto', background: '#fff', borderRadius: '16px', padding: '24px', boxShadow: '0 4px 20px rgba(0,0,0,.08)' },
  title: { margin: '0 0 16px', color: '#0f172a', fontSize: '22px' },
  flash: { background: '#f0fdf4', color: '#059669', padding: '10px 14px', borderRadius: '10px', fontSize: '14px', fontWeight: 600, marginBottom: '16px' },

  importBox: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '14px', background: 'linear-gradient(135deg, #eff6ff, #f0f9ff)', border: '1px solid #bae6fd', borderRadius: '12px', padding: '16px', marginBottom: '20px', flexWrap: 'wrap' },
  importInfo: { display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, minWidth: '220px' },
  importTitle: { fontSize: '15px', color: '#0369a1' },
  importHint: { fontSize: '12px', color: '#64748b' },
  importBtn: { padding: '10px 24px', background: '#0ea5e9', color: '#fff', borderRadius: '10px', fontSize: '15px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', border: 'none', display: 'inline-block' },

  toolbar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' },
  toolLeft: { display: 'flex', gap: '10px' },
  toolRight: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
  filterSelect: { padding: '9px 14px', border: '1px solid #cbd5e1', borderRadius: '9px', fontSize: '14px', fontFamily: 'inherit', fontWeight: 600 },
  printBtn: { padding: '9px 18px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '9px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' },
  delClassBtn: { padding: '9px 16px', background: '#fff', color: '#f59e0b', border: '1px solid #fcd34d', borderRadius: '9px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' },
  delAllBtn: { padding: '9px 16px', background: '#fff', color: '#ef4444', border: '1px solid #fecaca', borderRadius: '9px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' },

  muted: { color: '#94a3b8', fontSize: '14px', textAlign: 'center', padding: '30px' },
  tableWrap: { overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '10px' },
  table: { width: '100%', borderCollapse: 'collapse', minWidth: '700px' },
  th: { background: '#f8fafc', padding: '10px', fontSize: '13px', fontWeight: 700, color: '#475569', borderBottom: '2px solid #e2e8f0', whiteSpace: 'nowrap' },
  td: { padding: '9px 10px', borderBottom: '1px solid #e2e8f0', fontSize: '13px', color: '#334155' },
  delBtn: { padding: '4px 9px', background: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' },
  // ورقة الطباعة
  printSheet: { display: 'none' },
  pHead: { textAlign: 'center', fontSize: '14px', lineHeight: 1.8, marginBottom: '16px', fontWeight: 600 },
  pTable: { width: '100%', borderCollapse: 'collapse', fontSize: '12px' },
  pth: { border: '1px solid #333', padding: '6px', background: '#f0f0f0', fontWeight: 700 },
  ptd: { border: '1px solid #333', padding: '6px', textAlign: 'center' },
  pCount: { marginTop: '14px', fontSize: '13px', fontWeight: 600 },
}

