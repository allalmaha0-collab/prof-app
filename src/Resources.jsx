import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

const CATEGORIES = [
  { key: 'legal', label: 'نصوص تنظيمية وقانونية', icon: '⚖️' },
  { key: 'templates', label: 'نماذج ووثائق', icon: '📄' },
  { key: 'activities', label: 'أنشطة تربوية', icon: '💡' },
  { key: 'links', label: 'روابط مفيدة', icon: '🔗' },
  { key: 'other', label: 'مختلفات', icon: '📌' },
]

const EMPTY = { category: 'legal', title: '', content: '', link: '' }

export default function Resources() {
  const [resources, setResources] = useState([])
  const [form, setForm] = useState(EMPTY)
  const [editId, setEditId] = useState(null)
  const [filterCat, setFilterCat] = useState('')
  const [search, setSearch] = useState('')
  const [msg, setMsg] = useState('')

  const flash = (t) => { setMsg(t); setTimeout(() => setMsg(''), 3000) }

  const load = async () => {
    const { data } = await supabase
      .from('resources').select('*').order('created_at', { ascending: false })
    setResources(data || [])
  }

  useEffect(() => { load() }, [])

  const setF = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  const catInfo = (key) => CATEGORIES.find(c => c.key === key) || CATEGORIES[4]

    // حفظ (إضافة أو تعديل)
  const save = async () => {
    if (!form.title.trim()) { flash('عمّر العنوان'); return }
    const payload = {
      category: form.category,
      title: form.title.trim(),
      content: form.content.trim(),
      link: form.link.trim(),
    }
    if (editId) {
      const { error } = await supabase.from('resources').update(payload).eq('id', editId)
      if (error) { flash('خطأ: ' + error.message); return }
      flash('تعدّل ✓')
    } else {
      const { error } = await supabase.from('resources').insert(payload)
      if (error) { flash('خطأ: ' + error.message); return }
      flash('تزاد المورد ✓')
    }
    setForm({ ...EMPTY, category: form.category })
    setEditId(null)
    load()
  }

  // فتح مورد للتعديل
  const editResource = (r) => {
    setEditId(r.id)
    setForm({ category: r.category, title: r.title, content: r.content || '', link: r.link || '' })
    window.scrollTo(0, 0)
  }

  // إلغاء التعديل
  const cancelEdit = () => {
    setEditId(null)
    setForm(EMPTY)
  }

  // حذف
  const delResource = async (id) => {
    if (!confirm('متأكد باغي تمسح هاد المورد؟')) return
    await supabase.from('resources').delete().eq('id', id)
    load()
  }

  // الموارد بعد التصفية والبحث
  const filtered = resources.filter(r => {
    const matchCat = filterCat ? r.category === filterCat : true
    const q = search.trim().toLowerCase()
    const matchSearch = q
      ? (r.title + ' ' + (r.content || '')).toLowerCase().includes(q)
      : true
    return matchCat && matchSearch
  })

    return (
    <div style={s.page}>
      <div style={s.container}>
        <h1 style={s.title}>مكتبة الموارد</h1>
        {msg && <div style={s.flash}>{msg}</div>}

        {/* نموذج الإضافة/التعديل */}
        <h3 style={s.section}>{editId ? 'تعديل مورد' : 'إضافة مورد'}</h3>
        <div style={s.addBox}>
          <div style={s.addRow}>
            <select value={form.category} onChange={setF('category')} style={s.input}>
              {CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.icon} {c.label}</option>)}
            </select>
          </div>
          <input value={form.title} onChange={setF('title')} style={s.input} placeholder="العنوان" />
          <textarea value={form.content} onChange={setF('content')} style={s.textarea} placeholder="المحتوى أو ملاحظة (اختياري)" />
          <input value={form.link} onChange={setF('link')} style={s.input} placeholder="رابط (اختياري) — https://..." dir="ltr" />
          <div style={s.formBtns}>
            <button onClick={save} style={s.saveBtn}>{editId ? 'حفظ التعديل' : '+ زيد المورد'}</button>
            {editId && <button onClick={cancelEdit} style={s.cancelBtn}>إلغاء</button>}
          </div>
        </div>

        {/* التصفية والبحث */}
        <div style={s.filterRow}>
          <select value={filterCat} onChange={(e) => setFilterCat(e.target.value)} style={s.filterSelect}>
            <option value="">كل الفئات ({resources.length})</option>
            {CATEGORIES.map(c => (
              <option key={c.key} value={c.key}>
                {c.icon} {c.label} ({resources.filter(r => r.category === c.key).length})
              </option>
            ))}
          </select>
          <input value={search} onChange={(e) => setSearch(e.target.value)} style={s.searchInput} placeholder="🔍 بحث..." />
        </div>

        {/* اللائحة */}
        {filtered.length === 0 ? (
          <p style={s.muted}>{resources.length === 0 ? 'مازال حتى مورد — زيد وحدة.' : 'ماكاينش نتائج.'}</p>
        ) : (
          <div style={s.list}>
            {filtered.map(r => {
              const c = catInfo(r.category)
              return (
                <div key={r.id} style={s.item}>
                  <div style={s.itemInfo}>
                    <div style={s.itemTitle}>
                      <span style={s.catBadge}>{c.icon} {c.label}</span>
                      {r.title}
                    </div>
                    {r.content && <div style={s.itemContent}>{r.content}</div>}
                    {r.link && (
                      <a href={r.link} target="_blank" rel="noopener noreferrer" style={s.itemLink} dir="ltr">
                        🔗 {r.link}
                      </a>
                    )}
                  </div>
                  <div style={s.itemBtns}>
                    <button onClick={() => editResource(r)} style={s.editBtn}>تعديل</button>
                    <button onClick={() => delResource(r.id)} style={s.delBtn}>✕</button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
const s = {
  page: { background: '#f1f5f9', minHeight: '100vh', padding: '24px', direction: 'rtl', fontFamily: 'system-ui, sans-serif' },
  container: { maxWidth: '820px', margin: '0 auto', background: '#fff', borderRadius: '16px', padding: '24px', boxShadow: '0 4px 20px rgba(0,0,0,.08)' },
  title: { margin: '0 0 16px', color: '#0f172a', fontSize: '22px' },
  flash: { background: '#f0fdf4', color: '#059669', padding: '10px 14px', borderRadius: '10px', fontSize: '14px', fontWeight: 600, marginBottom: '16px' },

  section: { margin: '20px 0 12px', color: '#0f172a', fontSize: '17px' },
  addBox: { background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' },
  addRow: { display: 'flex', gap: '10px', flexWrap: 'wrap' },
  input: { width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '9px', fontSize: '14px', fontFamily: 'inherit', boxSizing: 'border-box' },
  textarea: { width: '100%', minHeight: '70px', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '9px', fontSize: '14px', fontFamily: 'inherit', lineHeight: 1.7, resize: 'vertical', boxSizing: 'border-box' },
  formBtns: { display: 'flex', gap: '10px' },
  saveBtn: { padding: '10px 22px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: 600, cursor: 'pointer' },
  cancelBtn: { padding: '10px 20px', background: '#fff', color: '#64748b', border: '1px solid #cbd5e1', borderRadius: '10px', fontSize: '15px', fontWeight: 600, cursor: 'pointer' },

  filterRow: { display: 'flex', gap: '12px', margin: '24px 0 16px', flexWrap: 'wrap', borderTop: '1px solid #e2e8f0', paddingTop: '20px' },
  filterSelect: { padding: '9px 14px', border: '1px solid #cbd5e1', borderRadius: '9px', fontSize: '14px', fontFamily: 'inherit', fontWeight: 600 },
  searchInput: { flex: 1, minWidth: '160px', padding: '9px 14px', border: '1px solid #cbd5e1', borderRadius: '9px', fontSize: '14px', fontFamily: 'inherit' },

  muted: { color: '#94a3b8', fontSize: '14px', textAlign: 'center', padding: '30px' },
  list: { display: 'flex', flexDirection: 'column', gap: '10px' },
  item: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '14px 16px', border: '1px solid #e2e8f0', borderRadius: '12px', gap: '12px' },
  itemInfo: { flex: 1, minWidth: 0 },
  itemTitle: { fontSize: '15px', fontWeight: 600, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '6px' },
  catBadge: { background: '#e0f2fe', color: '#0369a1', padding: '2px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, whiteSpace: 'nowrap' },
  itemContent: { fontSize: '13px', color: '#475569', lineHeight: 1.7, whiteSpace: 'pre-wrap', marginBottom: '6px' },
  itemLink: { fontSize: '12px', color: '#0ea5e9', textDecoration: 'none', wordBreak: 'break-all' },
  itemBtns: { display: 'flex', gap: '8px', flexShrink: 0 },
  editBtn: { padding: '5px 14px', background: '#fff', color: '#0ea5e9', border: '1px solid #0ea5e9', borderRadius: '7px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' },
  delBtn: { padding: '5px 10px', background: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca', borderRadius: '7px', fontSize: '13px', cursor: 'pointer' },
}