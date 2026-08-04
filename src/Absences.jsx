import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { useAuth } from './AuthContext'

const MONTHS = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'ماي', 'يونيو',
  'يوليوز', 'غشت', 'شتنبر', 'أكتوبر', 'نونبر', 'دجنبر',
]

export default function Absences() {
  const { user } = useAuth()
  const [tab, setTab] = useState('daily')          // 'daily' | 'monthly'
  const [students, setStudents] = useState([])
  const [absences, setAbsences] = useState([])
  const [holidays, setHolidays] = useState([])

  // الإدخال اليومي
  const [selClass, setSelClass] = useState('')
  const [selDate, setSelDate] = useState(new Date().toISOString().split('T')[0])
  const [selSession, setSelSession] = useState('am')

  // العرض الشهري
  const now = new Date()
  const [selMonth, setSelMonth] = useState(now.getMonth())
  const [selYear, setSelYear] = useState(now.getFullYear())
  const [monthClass, setMonthClass] = useState('')

  const [msg, setMsg] = useState('')
  const flash = (t) => { setMsg(t); setTimeout(() => setMsg(''), 3000) }

 const load = async () => {
    const { data: st } = await supabase
      .from('students').select('*')
      .order('class_name').order('last_name')
    setStudents(st || [])

    const { data: ab } = await supabase
      .from('absences').select('*')
    setAbsences(ab || [])

    const { data: hol } = await supabase
      .from('holidays').select('*')
    setHolidays(hol || [])
  }

  useEffect(() => { load() }, [])

  // لائحة الأقسام
  const classes = [...new Set(students.map(s => s.class_name).filter(Boolean))].sort()

  // تلاميذ القسم المختار (للإدخال اليومي)
  const classStudents = selClass
    ? students.filter(s => s.class_name === selClass)
    : []// واش التلميذ غايب فهاد التاريخ+الحصة؟
  const isAbsent = (studentId) =>
    absences.find(a => a.student_id === studentId && a.absence_date === selDate && a.session === selSession)

  // تبديل حالة الغياب (تشيك / ديشيك)
  const toggleAbsence = async (studentId) => {
    const existing = isAbsent(studentId)
    if (existing) {
      // كان غايب → نمسحو الغياب
      await supabase.from('absences').delete().eq('id', existing.id)
    } else {
      // ماكانش → نزيدو غياب (غير مبرَّر افتراضياً)
      await supabase.from('absences').insert({
        student_id: studentId,
        absence_date: selDate,
        session: selSession,
        justified: false,
      })
    }
    load()
  }

  // تبديل مبرَّر / غير مبرَّر
  const toggleJustified = async (studentId) => {
    const existing = isAbsent(studentId)
    if (!existing) return
    await supabase.from('absences')
      .update({ justified: !existing.justified })
      .eq('id', existing.id)
    load()
  }

  // تحديث ملاحظة الغياب
  const updateNote = async (studentId, note) => {
    const existing = isAbsent(studentId)
    if (!existing) return
    await supabase.from('absences').update({ note }).eq('id', existing.id)
    // نحدّثو محلياً بلا load كامل (باش ماتقطعش الكتابة)
    setAbsences(prev => prev.map(a => a.id === existing.id ? { ...a, note } : a))
  }
  // ═══ بناء بيانات الشبكة الشهرية ═══
  const daysInMonth = new Date(selYear, selMonth + 1, 0).getDate()
  const monthDays = Array.from({ length: daysInMonth }, (_, i) => i + 1)

  const monthStudents = monthClass
    ? students.filter(s => s.class_name === monthClass)
    : []

  // غياب تلميذ فيوم معيّن (كيرجع {am, pm})
  const dayAbsence = (studentId, day) => {
    const dateStr = `${selYear}-${String(selMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const am = absences.find(a => a.student_id === studentId && a.absence_date === dateStr && a.session === 'am')
    const pm = absences.find(a => a.student_id === studentId && a.absence_date === dateStr && a.session === 'pm')
   return { am, pm }
  }// واش هاد اليوم عطلة؟ (عطلة مسجّلة أو الأحد)
  const isHoliday = (day) => {
    const date = new Date(selYear, selMonth, day)
    if (date.getDay() === 0) return { name: 'الأحد', isSunday: true }
    const dateStr = `${selYear}-${String(selMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const hol = holidays.find(h => dateStr >= h.start_date && dateStr <= h.end_date)
    return hol ? { name: hol.name, isSunday: false } : null
  }

  // عدد أيام العطل (المسجّلة + الآحاد) فالشهر
  const holidayDaysInMonth = () => {
    let count = 0
    for (const day of monthDays) {
      if (isHoliday(day)) count++
    }
    return count
  }

  // إحصاء غياب تلميذ فالشهر (عدد الحصص)
  const monthStats = (studentId) => {
    const prefix = `${selYear}-${String(selMonth + 1).padStart(2, '0')}`
    const list = absences.filter(a => a.student_id === studentId && a.absence_date.startsWith(prefix))
    const total = list.length
    const justified = list.filter(a => a.justified).length
    return { total, justified, unjustified: total - justified }
  }

  // ═══ حساب النسبة المئوية للغياب فالشهر ═══
  // أنصاف أيام الدراسة = عدد أيام الشهر × 2 (صباح + مساء)
  // النسبة = مجموع أنصاف أيام غياب كل التلاميذ / (عدد التلاميذ × أنصاف أيام الدراسة) × 100
  const monthlyPercent = () => {
    if (monthStudents.length === 0) return 0
    const prefix = `${selYear}-${String(selMonth + 1).padStart(2, '0')}`
    const totalAbsences = absences.filter(
      a => a.absence_date.startsWith(prefix) &&
        monthStudents.some(st => st.id === a.student_id)
    ).length
    // أيام الدراسة الفعلية = أيام الشهر − أيام العطل (والآحاد)
    const studyDays = daysInMonth - holidayDaysInMonth()
    const studyHalfDays = monthStudents.length * studyDays * 2
    if (studyHalfDays <= 0) return 0
    return ((totalAbsences / studyHalfDays) * 100).toFixed(2)
  }

  return (
    <div style={s.page}>
      <div style={s.container} className="no-print">
        <h1 style={s.title}>سجل الغياب</h1>
        {msg && <div style={s.flash}>{msg}</div>}

        {/* التبويبات */}
        <div style={s.tabs}>
          <button onClick={() => setTab('daily')} style={{ ...s.tab, ...(tab === 'daily' ? s.tabActive : {}) }}>
            التسجيل اليومي
          </button>
          <button onClick={() => setTab('monthly')} style={{ ...s.tab, ...(tab === 'monthly' ? s.tabActive : {}) }}>
            الشبكة الشهرية
          </button>
        </div>

        {tab === 'daily' && (
          <div>
            {/* اختيار القسم + التاريخ + الحصة */}
            <div style={s.controls}>
              <div>
                <label style={s.label}>القسم</label>
                <select value={selClass} onChange={(e) => setSelClass(e.target.value)} style={s.input}>
                  <option value="">اختار القسم</option>
                  {classes.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={s.label}>التاريخ</label>
                <input type="date" value={selDate} onChange={(e) => setSelDate(e.target.value)} style={s.input} />
              </div>
              <div>
                <label style={s.label}>الحصة</label>
                <select value={selSession} onChange={(e) => setSelSession(e.target.value)} style={s.input}>
                  <option value="am">صباح</option>
                  <option value="pm">مساء</option>
                </select>
              </div>
            </div>

            {/* لائحة التلاميذ */}
            {!selClass ? (
              <p style={s.muted}>اختار القسم باش تبان لائحة التلاميذ.</p>
            ) : classStudents.length === 0 ? (
              <p style={s.muted}>ماكاينش تلاميذ فهاد القسم.</p>
            ) : (
              <div style={s.tableWrap}>
                <table style={s.table}>
                  <thead>
                    <tr>
                      <th style={s.th}>#</th><th style={s.th}>الاسم الكامل</th>
                      <th style={s.th}>غائب؟</th><th style={s.th}>مبرَّر؟</th><th style={s.th}>ملاحظة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {classStudents.map((st, i) => {
                      const abs = isAbsent(st.id)
                      return (
                        <tr key={st.id} style={abs ? { background: '#fef2f2' } : {}}>
                          <td style={s.td}>{i + 1}</td>
                          <td style={s.td}>{st.last_name} {st.first_name}</td>
                          <td style={s.td}>
                            <input type="checkbox" checked={!!abs} onChange={() => toggleAbsence(st.id)} style={s.check} />
                          </td>
                          <td style={s.td}>
                            {abs && (
                              <button onClick={() => toggleJustified(st.id)}
                                style={abs.justified ? s.justBtn : s.unjustBtn}>
                                {abs.justified ? 'مبرَّر' : 'غير مبرَّر'}
                              </button>
                            )}
                          </td>
                          <td style={s.td}>
                            {abs && (
                              <input value={abs.note || ''} onChange={(e) => updateNote(st.id, e.target.value)}
                                style={s.noteInput} placeholder="ملاحظة" />
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}{tab === 'monthly' && (
          <div>
            {/* اختيار القسم + الشهر + السنة */}
            <div style={s.controls}>
              <div>
                <label style={s.label}>القسم</label>
                <select value={monthClass} onChange={(e) => setMonthClass(e.target.value)} style={s.input}>
                  <option value="">اختار القسم</option>
                  {classes.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={s.label}>الشهر</label>
                <select value={selMonth} onChange={(e) => setSelMonth(Number(e.target.value))} style={s.input}>
                  {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
                </select>
              </div>
              <div>
                <label style={s.label}>السنة</label>
                <input type="number" value={selYear} onChange={(e) => setSelYear(Number(e.target.value))} style={s.input} />
              </div>
            </div>

            {!monthClass ? (
              <p style={s.muted}>اختار القسم باش تبان الشبكة الشهرية.</p>
            ) : monthStudents.length === 0 ? (
              <p style={s.muted}>ماكاينش تلاميذ فهاد القسم.</p>
            ) : (
              <>
                <button onClick={() => window.print()} style={s.printBtn}>طباعة الشبكة</button>
                <div style={s.gridWrap}>
                  <table style={s.gridTable}>
                    <thead>
                      <tr>
                        <th style={s.gHead}>#</th>
                        <th style={s.gHeadName}>الاسم</th>
                        {monthDays.map(d => (
                          <th key={d} style={s.gDay} colSpan={2}>{d}</th>
                        ))}
                        <th style={s.gHead}>المجموع</th>
                      </tr>
                      <tr>
                        <th style={s.gSub}></th><th style={s.gSub}></th>
                        {monthDays.map(d => (
                          <>
                            <th key={`${d}-am`} style={s.gSubCell}>ص</th>
                            <th key={`${d}-pm`} style={s.gSubCell}>م</th>
                          </>
                        ))}
                        <th style={s.gSub}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthStudents.map((st, i) => {
                        const stats = monthStats(st.id)
                        return (
                          <tr key={st.id}>
                            <td style={s.gCell}>{i + 1}</td>
                            <td style={s.gName}>{st.last_name} {st.first_name}</td>
                           {monthDays.map(d => {
                              const hol = isHoliday(d)
                              const { am, pm } = dayAbsence(st.id, d)
                              if (hol) {
                                return (
                                  <>
                                    <td key={`${d}-am`} style={{ ...s.gMark, ...s.markHoliday }}></td>
                                    <td key={`${d}-pm`} style={{ ...s.gMark, ...s.markHoliday }}></td>
                                  </>
                                )
                              }
                              return (
                                <>
                                  <td key={`${d}-am`} style={{ ...s.gMark, ...(am ? (am.justified ? s.markJust : s.markUnjust) : {}) }}>
                                    {am ? (am.justified ? 'م' : '✕') : ''}
                                  </td>
                                  <td key={`${d}-pm`} style={{ ...s.gMark, ...(pm ? (pm.justified ? s.markJust : s.markUnjust) : {}) }}>
                                    {pm ? (pm.justified ? 'م' : '✕') : ''}
                                  </td>
                                </>
                              )
                            })}
                            <td style={s.gTotal}>{stats.total}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                <div style={s.percentBox}>
                  النسبة المئوية للغياب فالشهر: <strong>{monthlyPercent()}%</strong>
                </div>
                <p style={s.legend}>✕ = غير مبرَّر · م = مبرَّر · ص = صباح · م = مساء</p>
              </>
            )}
          </div>
        )}
      </div>{/* ═══ ورقة الطباعة الرسمية (الشبكة الشهرية) ═══ */}
      {tab === 'monthly' && monthClass && monthStudents.length > 0 && (
        <div className="print-sheet" style={s.printSheet}>
          <div style={s.pHead}>
            <div>المملكة المغربية — وزارة التربية الوطنية والتعليم الأولي والرياضة</div>
            <div style={s.pTitle}>بيان الغيابات لشهر {MONTHS[selMonth]} {selYear} — القسم: {monthClass}</div>
          </div>
          <table style={s.pGrid}>
            <thead>
              <tr>
                <th style={s.pgHead}>#</th>
                <th style={s.pgName}>اسم المتعلم(ة)</th>
                {monthDays.map(d => <th key={d} style={s.pgDay} colSpan={2}>{d}</th>)}
                <th style={s.pgHead}>المجموع</th>
              </tr>
              <tr>
                <th style={s.pgSub}></th><th style={s.pgSub}></th>
                {monthDays.map(d => (
                  <>
                    <th key={`${d}-am`} style={s.pgSub}>ص</th>
                    <th key={`${d}-pm`} style={s.pgSub}>م</th>
                  </>
                ))}
                <th style={s.pgSub}></th>
              </tr>
            </thead>
            <tbody>
              {monthStudents.map((st, i) => {
                const stats = monthStats(st.id)
                return (
                  <tr key={st.id}>
                    <td style={s.pgCell}>{i + 1}</td>
                    <td style={s.pgNameCell}>{st.last_name} {st.first_name}</td>
                   {monthDays.map(d => {
                      const hol = isHoliday(d)
                      const { am, pm } = dayAbsence(st.id, d)
                      if (hol) {
                        return (
                          <>
                            <td key={`${d}-am`} style={{ ...s.pgMark, ...s.pgHoliday }}></td>
                            <td key={`${d}-pm`} style={{ ...s.pgMark, ...s.pgHoliday }}></td>
                          </>
                        )
                      }
                      return (
                        <>
                          <td key={`${d}-am`} style={s.pgMark}>{am ? (am.justified ? 'م' : '✕') : ''}</td>
                          <td key={`${d}-pm`} style={s.pgMark}>{pm ? (pm.justified ? 'م' : '✕') : ''}</td>
                        </>
                      )
                    })}
                    <td style={s.pgTotal}>{stats.total}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div style={s.pPercent}>النسبة المئوية للغياب: {monthlyPercent()}%</div>
          <div style={s.pLegend}>✕ = غير مبرَّر · م = مبرَّر · ص = صباح · م = مساء</div>
        </div>
      )}
    </div>
  )
}const s = {
  page: { background: '#f1f5f9', minHeight: '100vh', padding: '24px', direction: 'rtl', fontFamily: 'system-ui, sans-serif' },
  container: { maxWidth: '1100px', margin: '0 auto', background: '#fff', borderRadius: '16px', padding: '24px', boxShadow: '0 4px 20px rgba(0,0,0,.08)' },
  title: { margin: '0 0 16px', color: '#0f172a', fontSize: '22px' },
  flash: { background: '#f0fdf4', color: '#059669', padding: '10px 14px', borderRadius: '10px', fontSize: '14px', fontWeight: 600, marginBottom: '16px' },

  tabs: { display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap', borderBottom: '2px solid #e2e8f0', paddingBottom: '12px' },
  tab: { padding: '8px 20px', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: 600, cursor: 'pointer' },
  tabActive: { background: '#0ea5e9', color: '#fff' },

  controls: { display: 'flex', gap: '14px', marginBottom: '20px', flexWrap: 'wrap' },
  label: { display: 'block', color: '#334155', fontSize: '13px', fontWeight: 600, marginBottom: '5px' },
  input: { padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '9px', fontSize: '14px', fontFamily: 'inherit', minWidth: '150px' },

  muted: { color: '#94a3b8', fontSize: '14px', textAlign: 'center', padding: '30px' },
  tableWrap: { overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '10px' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { background: '#f8fafc', padding: '10px', fontSize: '13px', fontWeight: 700, color: '#475569', borderBottom: '2px solid #e2e8f0', whiteSpace: 'nowrap' },
  td: { padding: '9px 10px', borderBottom: '1px solid #e2e8f0', fontSize: '14px', color: '#334155' },
  check: { width: '20px', height: '20px', cursor: 'pointer' },
  justBtn: { padding: '4px 12px', background: '#dcfce7', color: '#16a34a', border: '1px solid #86efac', borderRadius: '7px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' },
  unjustBtn: { padding: '4px 12px', background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: '7px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' },
  noteInput: { padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: '7px', fontSize: '13px', fontFamily: 'inherit', width: '140px' },

  printBtn: { padding: '9px 20px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '9px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', marginBottom: '14px' },

  gridWrap: { overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '10px' },
  gridTable: { borderCollapse: 'collapse', fontSize: '11px' },
  gHead: { background: '#f8fafc', padding: '6px 4px', border: '1px solid #e2e8f0', fontWeight: 700, color: '#475569', whiteSpace: 'nowrap' },
  gHeadName: { background: '#f8fafc', padding: '6px 10px', border: '1px solid #e2e8f0', fontWeight: 700, color: '#475569', whiteSpace: 'nowrap', position: 'sticky', right: 0 },
  gDay: { background: '#f0f9ff', padding: '4px 2px', border: '1px solid #e2e8f0', fontWeight: 700, color: '#0369a1', fontSize: '11px' },
  gSub: { background: '#f8fafc', border: '1px solid #e2e8f0', padding: '2px' },
  gSubCell: { background: '#f0f9ff', border: '1px solid #e2e8f0', padding: '2px 4px', fontSize: '10px', color: '#64748b' },
  gCell: { border: '1px solid #e2e8f0', padding: '4px', textAlign: 'center', color: '#64748b' },
  gName: { border: '1px solid #e2e8f0', padding: '4px 10px', whiteSpace: 'nowrap', color: '#0f172a', fontWeight: 600, position: 'sticky', right: 0, background: '#fff' },
  gMark: { border: '1px solid #e2e8f0', padding: '2px', textAlign: 'center', minWidth: '16px', fontWeight: 700, fontSize: '10px' },
  markUnjust: { background: '#fee2e2', color: '#dc2626' },
  markJust: { background: '#dcfce7', color: '#16a34a' },
  markHoliday: { background: '#e2e8f0' },
  gTotal: { border: '1px solid #e2e8f0', padding: '4px', textAlign: 'center', fontWeight: 700, color: '#0f172a', background: '#f8fafc' },
  legend: { marginTop: '12px', fontSize: '13px', color: '#64748b' },percentBox: { marginTop: '14px', padding: '12px 16px', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '10px', fontSize: '15px', color: '#0369a1', display: 'inline-block' },

  // ورقة الطباعة
  printSheet: { display: 'none' },
  pHead: { textAlign: 'center', fontSize: '13px', marginBottom: '12px', fontWeight: 600, lineHeight: 1.8 },
  pTitle: { fontSize: '15px', marginTop: '6px' },
  pGrid: { borderCollapse: 'collapse', fontSize: '9px', width: '100%', margin: '0 auto' },
  pgHead: { border: '1px solid #333', padding: '3px', background: '#f0f0f0', fontWeight: 700 },
  pgName: { border: '1px solid #333', padding: '3px 6px', background: '#f0f0f0', fontWeight: 700, whiteSpace: 'nowrap' },
  pgDay: { border: '1px solid #333', padding: '2px', background: '#f0f0f0', fontWeight: 700, fontSize: '9px' },
  pgSub: { border: '1px solid #333', padding: '1px', fontSize: '8px' },
  pgCell: { border: '1px solid #333', padding: '2px', textAlign: 'center' },
  pgNameCell: { border: '1px solid #333', padding: '2px 5px', whiteSpace: 'nowrap', fontSize: '9px' },
  pgMark: { border: '1px solid #333', padding: '1px', textAlign: 'center', minWidth: '10px', fontWeight: 700 },
  pgHoliday: { background: '#d0d0d0' },
  pgTotal: { border: '1px solid #333', padding: '2px', textAlign: 'center', fontWeight: 700, background: '#f0f0f0' },
  pPercent: { marginTop: '14px', fontSize: '13px', fontWeight: 700, textAlign: 'center' },
  pLegend: { marginTop: '10px', fontSize: '11px', textAlign: 'center' },
}







