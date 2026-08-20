import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { useAuth } from './AuthContext'

// فئات العناصر المتعددة
const CATEGORIES = [
  { key: 'experience', label: 'الخبرات المهنية', icon: '💼' },
  { key: 'skill', label: 'المهارات والكفايات', icon: '⭐' },
  { key: 'achievement', label: 'الإنجازات والأنشطة', icon: '🏆' },
  { key: 'training', label: 'التطوير المهني (تكوينات)', icon: '📚' },
]

const EMPTY_TEXTS = { vision: '', mission: '', qualifications: '', reflection: '' }
const EMPTY_ITEM = { category: 'experience', title: '', detail: '', item_date: '' }

export default function Profile() {
  const { user } = useAuth()
  const [texts, setTexts] = useState(EMPTY_TEXTS)
  const [items, setItems] = useState([])
  const [settings, setSettings] = useState(null)
  const [newItem, setNewItem] = useState(EMPTY_ITEM)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const flash = (t) => { setMsg(t); setTimeout(() => setMsg(''), 3000) }

  const load = async () => {
    // النصوص الثابتة
    const { data: t } = await supabase
      .from('profile_texts').select('*').eq('id', user.id).maybeSingle()
    if (t) {
      const { id, updated_at, ...rest } = t
      setTexts({ ...EMPTY_TEXTS, ...rest })
    }
    // العناصر المتعددة
    const { data: it } = await supabase
      .from('profile_items').select('*').order('created_at', { ascending: false })
    setItems(it || [])
    // الإعدادات (للبيانات الشخصية والترويسة)
    const { data: s } = await supabase
      .from('teacher_settings').select('*').eq('id', user.id).maybeSingle()
    setSettings(s)
  }

  useEffect(() => { load() }, [])
  
  const setText = (k) => (e) => setTexts(t => ({ ...t, [k]: e.target.value }))

  // حفظ النصوص الثابتة (upsert)
  const saveTexts = async () => {
    setSaving(true)
    setMsg('')
    const { error } = await supabase
      .from('profile_texts')
      .upsert({ id: user.id, ...texts, updated_at: new Date().toISOString() })
    setSaving(false)
    if (error) flash('خطأ: ' + error.message)
    else flash('تحفظات النصوص ✓')
  }

  const setNI = (k) => (e) => setNewItem(n => ({ ...n, [k]: e.target.value }))

  // إضافة عنصر جديد
  const addItem = async () => {
    if (!newItem.title.trim()) { flash('عمّر العنوان'); return }
    const { error } = await supabase.from('profile_items').insert({
      category: newItem.category,
      title: newItem.title.trim(),
      detail: newItem.detail.trim(),
      item_date: newItem.item_date.trim(),
    })
    if (error) { flash('خطأ: ' + error.message); return }
    setNewItem({ ...EMPTY_ITEM, category: newItem.category })  // نبقى على نفس الفئة
    flash('تزاد العنصر ✓')
    load()
  }

  // حذف عنصر
  const delItem = async (id) => {
    if (!confirm('متأكد باغي تمسح هاد العنصر؟')) return
    await supabase.from('profile_items').delete().eq('id', id)
    load()
  }

  // عناصر فئة معيّنة
  const itemsOf = (cat) => items.filter(i => i.category === cat)
  
  return (
    <div style={s.page}>
      <div style={s.container} className="no-print">
        <h1 style={s.title}>الملف المهني</h1>
        {msg && <div style={s.flash}>{msg}</div>}

        {/* البيانات الشخصية من الإعدادات */}
        {settings?.full_name ? (
          <div style={s.identityBox}>
            <div style={s.identityName}>{settings.full_name}</div>
            <div style={s.identityMeta}>
              {settings.grade || 'أستاذ(ة)'} {settings.main_subject ? `· ${settings.main_subject}` : ''}
              {settings.school_name ? ` · ${settings.school_name}` : ''}
            </div>
          </div>
        ) : (
          <div style={s.warnBox}>عمّر بياناتك فالإعدادات باش تبان فالملف المهني.</div>
        )}

        {/* النصوص الثابتة */}
        <h3 style={s.section}>الرؤية والرسالة</h3>
        <label style={s.label}>الرؤية المهنية</label>
        <textarea value={texts.vision} onChange={setText('vision')} style={s.textarea}
          placeholder="رؤيتي المهنية وتطلعاتي المستقبلية..." />
        <label style={s.label}>الرسالة</label>
        <textarea value={texts.mission} onChange={setText('mission')} style={s.textarea}
          placeholder="رسالتي كأستاذ(ة)..." />

        <h3 style={s.section}>المؤهلات العلمية</h3>
        <textarea value={texts.qualifications} onChange={setText('qualifications')} style={s.textarea}
          placeholder="الشهادات والمؤهلات العلمية..." />

        <h3 style={s.section}>التأمل الذاتي</h3>
        <textarea value={texts.reflection} onChange={setText('reflection')} style={s.textarea}
          placeholder="تحليل تجربتي، نقاط القوة، وآفاق التحسين..." />

        <button onClick={saveTexts} disabled={saving} style={s.saveBtn}>
          {saving ? '...' : 'حفظ النصوص'}
        </button>        {/* إضافة عنصر */}
        <h3 style={s.section}>إضافة عنصر (خبرة / مهارة / إنجاز / تكوين)</h3>
        <div style={s.addBox}>
          <div style={s.addRow}>
            <select value={newItem.category} onChange={setNI('category')} style={s.input}>
              {CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.icon} {c.label}</option>)}
            </select>
            <input value={newItem.item_date} onChange={setNI('item_date')} style={s.inputSmall}
              placeholder="السنة (اختياري)" />
          </div>
          <input value={newItem.title} onChange={setNI('title')} style={s.input}
            placeholder="العنوان (مثلا: تكوين في التعليم الرقمي)" />
          <textarea value={newItem.detail} onChange={setNI('detail')} style={s.textareaSmall}
            placeholder="تفاصيل إضافية (اختياري)" />
          <button onClick={addItem} style={s.addBtn}>+ زيد العنصر</button>
        </div>

        {/* عرض العناصر حسب الفئة */}
        {CATEGORIES.map(cat => {
          const list = itemsOf(cat.key)
          if (list.length === 0) return null
          return (
            <div key={cat.key}>
              <h3 style={s.section}>{cat.icon} {cat.label} ({list.length})</h3>
              <div style={s.itemList}>
                {list.map(it => (
                  <div key={it.id} style={s.item}>
                    <div style={s.itemInfo}>
                      <div style={s.itemTitle}>
                        {it.title}
                        {it.item_date && <span style={s.itemDate}>{it.item_date}</span>}
                      </div>
                      {it.detail && <div style={s.itemDetail}>{it.detail}</div>}
                    </div>
                    <button onClick={() => delItem(it.id)} style={s.delBtn}>✕</button>
                  </div>
                ))}
              </div>
            </div>
          )
        })}

        {/* زر الطباعة */}
        <div style={s.actions}>
          <button onClick={() => window.print()} style={s.printBtn}>طباعة الملف المهني / PDF</button>
        </div>
      </div>      {/* ═══ ورقة الطباعة الرسمية ═══ */}
      <div className="print-sheet" style={s.printSheet}>
        <div style={s.pHead}>
          <div>المملكة المغربية — وزارة التربية الوطنية والتعليم الأولي والرياضة</div>
          {settings?.academy && <div>الأكاديمية الجهوية: {settings.academy}</div>}
          {settings?.direction && <div>المديرية الإقليمية: {settings.direction}</div>}
          {settings?.school_name && <div>المؤسسة: {settings.school_name}</div>}
        </div>

        <h2 style={s.pTitle}>الملف المهني</h2>

        {settings?.full_name && (
          <div style={s.pIdentity}>
            <strong>{settings.full_name}</strong> — {settings.grade || 'أستاذ(ة)'}
            {settings.main_subject ? ` · ${settings.main_subject}` : ''}
            {settings.ppr ? ` · رقم التأجير: ${settings.ppr}` : ''}
          </div>
        )}

        {texts.vision && <div style={s.pBlock}><strong>الرؤية المهنية:</strong><p>{texts.vision}</p></div>}
        {texts.mission && <div style={s.pBlock}><strong>الرسالة:</strong><p>{texts.mission}</p></div>}
        {texts.qualifications && <div style={s.pBlock}><strong>المؤهلات العلمية:</strong><p>{texts.qualifications}</p></div>}

        {CATEGORIES.map(cat => {
          const list = itemsOf(cat.key)
          if (list.length === 0) return null
          return (
            <div key={cat.key} style={s.pBlock}>
              <strong>{cat.label}:</strong>
              <ul style={s.pList}>
                {list.map(it => (
                  <li key={it.id}>
                    {it.title}{it.item_date ? ` (${it.item_date})` : ''}
                    {it.detail ? ` — ${it.detail}` : ''}
                  </li>
                ))}
              </ul>
            </div>
          )
        })}

        {texts.reflection && <div style={s.pBlock}><strong>التأمل الذاتي:</strong><p>{texts.reflection}</p></div>}

        <div style={s.pSign}>
          <div>الإمضاء</div>
          <div style={{ marginTop: '6px' }}>{settings?.full_name}</div>
        </div>
      </div>
    </div>
  )
}
const s = {
  page: { background: '#f1f5f9', minHeight: '100vh', padding: '24px', direction: 'rtl', fontFamily: 'system-ui, sans-serif' },
  container: { maxWidth: '820px', margin: '0 auto', background: '#fff', borderRadius: '16px', padding: '24px', boxShadow: '0 4px 20px rgba(0,0,0,.08)' },
  title: { margin: '0 0 16px', color: '#0f172a', fontSize: '22px' },
  flash: { background: '#f0fdf4', color: '#059669', padding: '10px 14px', borderRadius: '10px', fontSize: '14px', fontWeight: 600, marginBottom: '16px' },

  identityBox: { background: 'linear-gradient(135deg, #ecfdf5, #f0fdfa)', border: '1px solid #a7f3d0', borderRadius: '12px', padding: '16px', marginBottom: '8px' },
  identityName: { fontSize: '18px', fontWeight: 700, color: '#065f46' },
  identityMeta: { fontSize: '14px', color: '#047857', marginTop: '4px' },
  warnBox: { background: '#fef9e7', border: '1px solid #fcd34d', borderRadius: '10px', padding: '12px 14px', fontSize: '14px', color: '#92702a', marginBottom: '8px' },

  section: { margin: '24px 0 12px', color: '#0f172a', fontSize: '17px', borderTop: '1px solid #e2e8f0', paddingTop: '18px' },
  label: { display: 'block', color: '#334155', fontSize: '13px', fontWeight: 600, margin: '10px 0 5px' },
  textarea: { width: '100%', minHeight: '80px', padding: '12px', border: '1px solid #cbd5e1', borderRadius: '10px', fontSize: '14px', fontFamily: 'inherit', lineHeight: 1.8, resize: 'vertical', boxSizing: 'border-box', marginBottom: '4px' },
  textareaSmall: { width: '100%', minHeight: '56px', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '10px', fontSize: '14px', fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box', marginTop: '8px' },
  saveBtn: { padding: '11px 26px', background: '#0ea5e9', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: 600, cursor: 'pointer', marginTop: '10px' },

  addBox: { background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px' },
  addRow: { display: 'flex', gap: '10px', marginBottom: '10px', flexWrap: 'wrap' },
  input: { width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '9px', fontSize: '14px', fontFamily: 'inherit', boxSizing: 'border-box' },
  inputSmall: { padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '9px', fontSize: '14px', fontFamily: 'inherit', width: '160px', boxSizing: 'border-box' },
  addBtn: { padding: '10px 22px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: 600, cursor: 'pointer', marginTop: '10px' },

  itemList: { display: 'flex', flexDirection: 'column', gap: '8px' },
  item: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '12px 14px', border: '1px solid #e2e8f0', borderRadius: '10px', gap: '10px' },
  itemInfo: { flex: 1 },
  itemTitle: { fontSize: '15px', fontWeight: 600, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' },
  itemDate: { background: '#e0f2fe', color: '#0369a1', padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: 600 },
  itemDetail: { fontSize: '13px', color: '#64748b', marginTop: '4px' },
  delBtn: { padding: '5px 10px', background: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca', borderRadius: '7px', fontSize: '13px', cursor: 'pointer' },

  actions: { marginTop: '24px' },
  printBtn: { padding: '11px 24px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: 600, cursor: 'pointer' },

  // ورقة الطباعة
  printSheet: { display: 'none' },
  pHead: { textAlign: 'center', fontSize: '12px', lineHeight: 1.8, marginBottom: '16px' },
  pTitle: { textAlign: 'center', fontSize: '20px', margin: '16px 0', textDecoration: 'underline' },
  pIdentity: { fontSize: '14px', marginBottom: '20px', textAlign: 'center' },
  pBlock: { margin: '14px 0', fontSize: '13px', lineHeight: 1.9 },
  pList: { margin: '6px 0', paddingInlineStart: '20px' },
  pSign: { textAlign: 'left', fontSize: '14px', fontWeight: 600, marginTop: '40px' },
}

