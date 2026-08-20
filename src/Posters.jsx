import { useState } from 'react'

// الملصقات — الصورة + العنوان. زيد الباقي منين تكون جاهزة.
const POSTERS = [
  { img: '/posters/الملف_التراكمي.jpg.jpg', title: 'الملف التراكمي' },
  { img: '/posters/الملف_الشخصي.jpg.jpg', title: 'الملف الشخصي' },
  { img: '/posters/مجموعة_الدعم.jpg.jpg', title: 'مجموعات الدعم' },
  { img: '/posters/نتائج_الموضعة.jpg.jpg', title: 'نتائج الموضعة' },
  { img: '/posters/نماذج_الخرائط_الذهنية.jpg.jpg', title: 'نماذج الخرائط الذهنية' },
  { img: '/posters/تقرير_الورشات_التحضيرية.jpg.jpg', title: 'تقرير الورشات التحضيرية' },
]

export default function Posters() {
  const [selected, setSelected] = useState(null)

  if (selected) {
    return (
      <div style={s.page}>
        <div style={s.viewerBar}>
          <button onClick={() => setSelected(null)} style={s.backBtn}>← رجوع للمعرض</button>
          <a href={selected.img} download style={s.dlBtn}>⬇ تحميل الصورة</a>
        </div>
        <img src={selected.img} alt={selected.title} style={s.fullImg} />
      </div>
    )
  }

  return (
    <div style={s.page}>
      <div style={s.container}>
        <h1 style={s.title}>الملصقات التربوية</h1>
        <p style={s.sub}>اختر ملصقاً لعرضه وتحميله. {POSTERS.length} ملصقاً متاحاً.</p>
        <div style={s.grid}>
          {POSTERS.map((p, i) => (
            <div key={i} style={s.card} onClick={() => { setSelected(p); window.scrollTo(0, 0) }}>
              <img src={p.img} alt={p.title} style={s.thumb} />
              <div style={s.cardTitle}>{p.title}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const s = {
  page: { background: '#f1f5f9', minHeight: '100vh', padding: '24px', direction: 'rtl', fontFamily: 'system-ui, sans-serif' },
  container: { maxWidth: '1000px', margin: '0 auto' },
  title: { margin: '0 0 6px', color: '#0f172a', fontSize: '24px' },
  sub: { margin: '0 0 24px', color: '#64748b', fontSize: '14px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '18px' },
  card: { background: '#fff', borderRadius: '14px', overflow: 'hidden', cursor: 'pointer', boxShadow: '0 4px 14px rgba(0,0,0,.1)' },
  thumb: { width: '100%', display: 'block', aspectRatio: '3/4', objectFit: 'cover' },
  cardTitle: { padding: '12px', fontSize: '15px', fontWeight: 600, color: '#0f172a', textAlign: 'center' },
  viewerBar: { maxWidth: '800px', margin: '0 auto 16px', display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' },
  backBtn: { padding: '10px 20px', background: '#fff', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '10px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' },
  dlBtn: { padding: '10px 24px', background: '#0ea5e9', color: '#fff', borderRadius: '10px', fontSize: '14px', fontWeight: 600, textDecoration: 'none' },
  fullImg: { maxWidth: '800px', width: '100%', margin: '0 auto', display: 'block', borderRadius: '12px', boxShadow: '0 8px 30px rgba(0,0,0,.15)' },
}