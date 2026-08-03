import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

const SUBJECTS = ['اللغة العربية','اللغة الفرنسية','الرياضيات','النشاط العلمي','الاجتماعيات','التربية الإسلامية','اللغة الإنجليزية','التربية الفنية','التربية البدنية']
const LEVELS = ['الأول','الثاني','الثالث','الرابع','الخامس','السادس']
const UNITS = ['1','2','3','4','5','6']
const WEEKS = Array.from({ length: 35 }, (_, i) => String(i + 1))
const STATUSES = ['لم يبدأ', 'منجز', 'مؤجل']

const STATUS_COLORS = {
  'لم يبدأ': { bg: '#f1f5f9', color: '#64748b' },
  'منجز': { bg: '#dcfce7', color: '#16a34a' },
  'مؤجل': { bg: '#fef9c3', color: '#ca8a04' },
}

const EMPTY = {
  level: '', subject: '', unit: '', component: '',
  lesson_title: '', week_number: '', planned_date: '',
}

export default function Program() {
  const [tab, setTab] = useState('list')       // 'list' | 'stats'
  const [lessons, setLessons] = useState([])
  const [form, setForm] = useState(EMPTY)
  const [filterSubject, setFilterSubject] = useState('')
  const [msg, setMsg] = useState('')
  const [saving, setSaving] = useState(false)

  const flash = (t) => { setMsg(t); setTimeout(() => setMsg(''), 3000) }

  const load = async () => {
    const { data } = await supabase
      .from('annual_programs')
      .select('*')
      .order('subject')
      .order('week_number')
    setLessons(data || [])
  }

  useEffect(() => { load() }, [])

  const setF = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))
  
  // ═══ إضافة درس جديد ═══
  const addLesson = async () => {
    if (!form.lesson_title.trim()) { flash('أدخل عنوان الدرس'); return }
    setSaving(true)
    const payload = { ...form, planned_date: form.planned_date || null }
    const { error } = await supabase.from('annual_programs').insert(payload)
    setSaving(false)
    if (error) { flash('خطأ: ' + error.message); return }
    setForm(EMPTY)
    flash('تزاد الدرس ✓')
    load()
  }

  // ═══ تغيير حالة الدرس ═══
  const changeStatus = async (id, status) => {
    let postpone_reason = null
    if (status === 'مؤجل') {
      postpone_reason = prompt('سبب التأجيل:') || ''
    }
    await supabase.from('annual_programs')
      .update({ status, postpone_reason })
      .eq('id', id)
    load()
  }

  // ═══ حذف درس ═══
  const delLesson = async (id) => {
    if (!confirm('متأكد باغي تمسح هاد الدرس؟')) return
    await supabase.from('annual_programs').delete().eq('id', id)
    load()
    flash('تمسح ✓')
  }

  // ═══ الدروس بعد التصفية ═══
  const filtered = filterSubject
    ? lessons.filter(l => l.subject === filterSubject)
    : lessons

  // ═══ حساب نسب الإنجاز لكل مادة ═══
  const stats = SUBJECTS.map(subject => {
    const subLessons = lessons.filter(l => l.subject === subject)
    const total = subLessons.length
    const done = subLessons.filter(l => l.status === 'منجز').length
    const pct = total ? Math.round((done / total) * 100) : 0
    return { subject, total, done, pct }
  }).filter(s => s.total > 0)
  
  return (
    <div style={s.page}>
      <div style={s.container}>
        {/* التبويبات */}
        <div style={s.tabs}>
          <button onClick={() => setTab('list')} style={{ ...s.tab, ...(tab === 'list' ? s.tabActive : {}) }}>
            البرمجة والتتبع
          </button>
          <button onClick={() => setTab('stats')} style={{ ...s.tab, ...(tab === 'stats' ? s.tabActive : {}) }}>
            نسب الإنجاز
          </button>
          {msg && <span style={s.flash}>{msg}</span>}
        </div>

        {tab === 'list' && (
          <div>
            {/* نموذج إضافة درس */}
            <h3 style={s.section}>إضافة درس</h3>
            <div style={s.grid}>
              <div><label style={s.label}>المستوى</label>
                <select value={form.level} onChange={setF('level')} style={s.input}>
                  <option value="">—</option>{LEVELS.map(o => <option key={o}>{o}</option>)}
                </select></div>
              <div><label style={s.label}>المادة</label>
                <select value={form.subject} onChange={setF('subject')} style={s.input}>
                  <option value="">—</option>{SUBJECTS.map(o => <option key={o}>{o}</option>)}
                </select></div>
              <div><label style={s.label}>الوحدة</label>
                <select value={form.unit} onChange={setF('unit')} style={s.input}>
                  <option value="">—</option>{UNITS.map(o => <option key={o}>{o}</option>)}
                </select></div>
              <div><label style={s.label}>المكوّن</label>
                <input value={form.component} onChange={setF('component')} style={s.input} placeholder="المكوّن" /></div>
              <div><label style={s.label}>الأسبوع</label>
                <select value={form.week_number} onChange={setF('week_number')} style={s.input}>
                  <option value="">—</option>{WEEKS.map(o => <option key={o}>{o}</option>)}
                </select></div>
              <div><label style={s.label}>التاريخ المتوقّع</label>
                <input type="date" value={form.planned_date} onChange={setF('planned_date')} style={s.input} /></div>
              <div style={{ gridColumn: '1 / -1' }}><label style={s.label}>عنوان الدرس *</label>
                <input value={form.lesson_title} onChange={setF('lesson_title')} style={s.input} placeholder="عنوان الدرس" /></div>
            </div>
            <button onClick={addLesson} disabled={saving} style={s.addBtn}>
              {saving ? '...' : '+ زيد الدرس'}
            </button>

            {/* تصفية + جدول الدروس */}
            <div style={s.filterRow}>
              <h3 style={{ ...s.section, margin: 0, border: 'none', padding: 0 }}>
                الدروس ({filtered.length})
              </h3>
              <select value={filterSubject} onChange={(e) => setFilterSubject(e.target.value)} style={s.filterSelect}>
                <option value="">كل المواد</option>
                {SUBJECTS.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>

            {filtered.length === 0 ? (
              <p style={s.muted}>مازال حتى درس.</p>
            ) : (
              <div style={s.tableWrap}>
                <table style={s.table}>
                  <thead>
                    <tr>
                      <th style={s.th}>الأسبوع</th><th style={s.th}>المستوى</th><th style={s.th}>المادة</th>
                      <th style={s.th}>الدرس</th><th style={s.th}>التاريخ</th><th style={s.th}>الحالة</th><th style={s.th}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(l => {
                      const c = STATUS_COLORS[l.status] || STATUS_COLORS['لم يبدأ']
                      return (
                        <tr key={l.id} style={{ background: c.bg }}>
                          <td style={s.td}>{l.week_number || '—'}</td>
                          <td style={s.td}>{l.level || '—'}</td>
                          <td style={s.td}>{l.subject || '—'}</td>
                          <td style={s.td}>
                            {l.lesson_title}
                            {l.status === 'مؤجل' && l.postpone_reason &&
                              <div style={s.reason}>سبب: {l.postpone_reason}</div>}
                          </td>
                          <td style={s.td}>{l.planned_date || '—'}</td>
                          <td style={s.td}>
                            <select value={l.status} onChange={(e) => changeStatus(l.id, e.target.value)}
                              style={{ ...s.statusSelect, color: c.color }}>
                              {STATUSES.map(st => <option key={st} value={st}>{st}</option>)}
                            </select>
                          </td>
                          <td style={s.td}>
                            <button onClick={() => delLesson(l.id)} style={s.delBtn}>✕</button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {tab === 'stats' && (
          <div>
            <h3 style={s.section}>نسب الإنجاز حسب المادة</h3>
            {stats.length === 0 ? (
              <p style={s.muted}>مازال حتى درس مسجّل.</p>
            ) : (
              <div style={s.statsList}>
                {stats.map(st => (
                  <div key={st.subject} style={s.statItem}>
                    <div style={s.statHead}>
                      <span style={s.statSubject}>{st.subject}</span>
                      <span style={s.statNums}>{st.done}/{st.total} · {st.pct}%</span>
                    </div>
                    <div style={s.barBg}>
                      <div style={{ ...s.barFill, width: `${st.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

const s = {
  page: { background: '#f1f5f9', minHeight: '100vh', padding: '24px', direction: 'rtl', fontFamily: 'system-ui, sans-serif' },
  container: { maxWidth: '1100px', margin: '0 auto', background: '#fff', borderRadius: '16px', padding: '24px', boxShadow: '0 4px 20px rgba(0,0,0,.08)' },

  tabs: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', flexWrap: 'wrap', borderBottom: '2px solid #e2e8f0', paddingBottom: '12px' },
  tab: { padding: '8px 20px', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: 600, cursor: 'pointer' },
  tabActive: { background: '#0ea5e9', color: '#fff' },
  flash: { marginRight: 'auto', color: '#059669', fontSize: '14px', fontWeight: 600 },

  section: { margin: '24px 0 12px', color: '#0f172a', fontSize: '17px', borderTop: '1px solid #e2e8f0', paddingTop: '18px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px', marginBottom: '14px' },
  label: { display: 'block', color: '#334155', fontSize: '13px', fontWeight: 600, marginBottom: '5px' },
  input: { width: '100%', padding: '9px 11px', border: '1px solid #cbd5e1', borderRadius: '9px', fontSize: '14px', fontFamily: 'inherit', boxSizing: 'border-box' },
  addBtn: { padding: '10px 24px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: 600, cursor: 'pointer' },

  filterRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '24px 0 12px', borderTop: '1px solid #e2e8f0', paddingTop: '18px', flexWrap: 'wrap', gap: '10px' },
  filterSelect: { padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '9px', fontSize: '14px', fontFamily: 'inherit' },

  muted: { color: '#94a3b8', fontSize: '14px' },
  tableWrap: { overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '10px' },
  table: { width: '100%', borderCollapse: 'collapse', minWidth: '700px' },
  th: { background: '#f8fafc', padding: '10px', fontSize: '13px', fontWeight: 700, color: '#475569', borderBottom: '2px solid #e2e8f0', whiteSpace: 'nowrap' },
  td: { padding: '10px', borderBottom: '1px solid #e2e8f0', fontSize: '13px', color: '#334155' },
  reason: { fontSize: '11px', color: '#ca8a04', marginTop: '3px' },
  statusSelect: { padding: '5px 8px', border: '1px solid #cbd5e1', borderRadius: '7px', fontSize: '12px', fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', background: '#fff' },
  delBtn: { padding: '5px 10px', background: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca', borderRadius: '7px', fontSize: '13px', cursor: 'pointer' },

  statsList: { display: 'flex', flexDirection: 'column', gap: '16px' },
  statItem: {},
  statHead: { display: 'flex', justifyContent: 'space-between', marginBottom: '6px' },
  statSubject: { fontSize: '14px', fontWeight: 600, color: '#0f172a' },
  statNums: { fontSize: '13px', color: '#64748b', fontWeight: 600 },
  barBg: { height: '12px', background: '#f1f5f9', borderRadius: '20px', overflow: 'hidden' },
  barFill: { height: '100%', background: '#0ea5e9', borderRadius: '20px', transition: 'width .3s' },
}