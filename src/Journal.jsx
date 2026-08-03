import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { useAuth } from './AuthContext'

const STAGES = ['طقس الافتتاح','تسجيل الحضور','النشاط الاعتيادي','التهيئة','مراجعة المكتسبات','التصريح بالهدف','النمذجة','الممارسة الموجهة','الممارسة المستقلة','التقويم','الدعم والمعالجة','طقس اختتام الحصة']
const SUBJECTS = ['اللغة العربية','اللغة الفرنسية','الرياضيات','النشاط العلمي','الاجتماعيات','التربية الإسلامية','اللغة الإنجليزية','التربية الفنية','التربية البدنية']
const WEEKDAYS = ['الإثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت']
const LEVELS = ['الأول','الثاني','الثالث','الرابع','الخامس','السادس']
const SESSIONS = ['1','2','3','4','5','6']
const UNITS = ['1','2','3','4','5','6']
const WEEKS = Array.from({ length: 35 }, (_, i) => String(i + 1))
const DAYNUMS = ['1','2','3','4','5','6']
const TRACKS = ['1','2','3']

const EMPTY_FORM = {
  note_date: new Date().toISOString().split('T')[0],
  weekday: '', level: '', section: '', track: '', session_number: '',
  subject: '', unit: '', component: '', lesson_title: '', week_number: '',
  day_number: '', group1_time: '', group2_time: '', objectives: '',
  group1_notes: '', group2_notes: '', completion_rate: 100, teacher_comment: '',
}

const EMPTY_ACTIVITY = {
  timing: '', duration: '', stage: STAGES[0], contents: '',
  teacher_activity: '', learner_activity: '', tools: '', evaluation: '',
}

export default function Journal() {
  const { user } = useAuth()
  const [tab, setTab] = useState('new')          // 'new' | 'archive'
  const [notes, setNotes] = useState([])
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [activities, setActivities] = useState([])
  const [settings, setSettings] = useState(null)
  const [programLessons, setProgramLessons] = useState([])
  const [selProgram, setSelProgram] = useState('')
  const [msg, setMsg] = useState('')
  const [saving, setSaving] = useState(false)
  const [aiBusy, setAiBusy] = useState(false)

  // لائحة الأقسام من الإعدادات (إلا عمّرها الأستاذ)
  const sectionOptions = settings?.sections
    ? settings.sections.split(',').map(s => s.trim()).filter(Boolean)
    : []

  const flash = (t) => { setMsg(t); setTimeout(() => setMsg(''), 3000) }
  
  // جلب المذكرات + الإعدادات + دروس البرمجة غير المنجزة
  const loadAll = async () => {
    const { data: notesData } = await supabase
      .from('daily_notes')
      .select('*')
      .order('note_date', { ascending: false })
    setNotes(notesData || [])

    const { data: settingsData } = await supabase
      .from('teacher_settings')
      .select('*')
      .eq('id', user.id)
      .maybeSingle()
    setSettings(settingsData)

    const { data: progData } = await supabase
      .from('annual_programs')
      .select('*')
      .neq('status', 'منجز')
      .order('week_number')
    setProgramLessons(progData || [])
  }

  useEffect(() => { loadAll() }, [])

  // تعمير حقل واحد فالنموذج
  const setF = (k) => (e) => {
    const v = e.target.value
    setForm(f => ({ ...f, [k]: v }))
  }

  // ═══ إدارة مراحل الحصة ═══
  const addActivity = () => setActivities(a => [...a, { ...EMPTY_ACTIVITY }])

  const updateActivity = (i, k, v) =>
    setActivities(a => a.map((row, idx) => idx === i ? { ...row, [k]: v } : row))

  const delActivity = (i) =>
    setActivities(a => a.filter((_, idx) => idx !== i))

  const moveActivity = (i, dir) => {
    setActivities(a => {
      const arr = [...a]
      const j = i + dir
      if (j < 0 || j >= arr.length) return arr
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
      return arr
    })
  }

  // ═══ اختيار درس من البرمجة السنوية → تعمير النموذج ═══
  const pickProgram = (val) => {
    setSelProgram(val)
    if (!val) return
    const lesson = programLessons.find(l => String(l.id) === val)
    if (!lesson) return
    setForm(f => ({
      ...f,
      level: lesson.level || f.level,
      subject: lesson.subject || f.subject,
      unit: lesson.unit || f.unit,
      component: lesson.component || f.component,
      lesson_title: lesson.lesson_title || f.lesson_title,
      week_number: lesson.week_number || f.week_number,
    }))
  }
  
  // ═══ حفظ المذكرة (إدراج أو تحديث) + المراحل + تحديث البرمجة ═══
  const saveNote = async () => {
    if (!form.lesson_title.trim()) { flash('أدخل عنوان الدرس'); return }
    setSaving(true)
    setMsg('')

    let noteId = editId

    if (editId) {
      // تحديث المذكرة
      const { error } = await supabase
        .from('daily_notes')
        .update({ ...form })
        .eq('id', editId)
      if (error) { flash('خطأ فالتحديث: ' + error.message); setSaving(false); return }
    } else {
      // إدراج مذكرة جديدة (teacher_id كيتعبّا أوتوماتيك من auth.uid())
      const { data, error } = await supabase
        .from('daily_notes')
        .insert({ ...form })
        .select('id')
        .single()
      if (error) { flash('خطأ فالحفظ: ' + error.message); setSaving(false); return }
      noteId = data.id
    }

    // نمسحو المراحل القديمة ونعيدو إدراجها
    await supabase.from('daily_note_activities').delete().eq('note_id', noteId)
    if (activities.length > 0) {
      const rows = activities.map((a, i) => ({ ...a, note_id: noteId, ord: i }))
      const { error: actErr } = await supabase.from('daily_note_activities').insert(rows)
      if (actErr) { flash('خطأ فحفظ المراحل: ' + actErr.message); setSaving(false); return }
    }

    // إلا كان درس مختار من البرمجة → نخليوه "منجز"
    if (selProgram) {
      await supabase.from('annual_programs').update({ status: 'منجز' }).eq('id', selProgram)
    }

    setSaving(false)
    flash('تحفظات ✓')
    newNote()
    loadAll()
    setTab('archive')
  }

  // ═══ فتح مذكرة للتعديل ═══
  const editNote = async (n) => {
    setEditId(n.id)
    const { id, teacher_id, created_at, ...rest } = n
    setForm({ ...EMPTY_FORM, ...rest })
    const { data: acts } = await supabase
      .from('daily_note_activities')
      .select('*')
      .eq('note_id', n.id)
      .order('ord')
    setActivities((acts || []).map(({ id, note_id, ord, ...a }) => a))
    setSelProgram('')
    setTab('new')
    window.scrollTo(0, 0)
  }

  // ═══ نسخ مذكرة (للمواسم القادمة: انسخ ثم غيّر التاريخ) ═══
  const copyNote = async (n) => {
    const { id, teacher_id, created_at, status, ...rest } = n
    setEditId(null)
    setForm({ ...EMPTY_FORM, ...rest, note_date: new Date().toISOString().split('T')[0] })
    const { data: acts } = await supabase
      .from('daily_note_activities')
      .select('*')
      .eq('note_id', n.id)
      .order('ord')
    setActivities((acts || []).map(({ id, note_id, ord, ...a }) => a))
    setSelProgram('')
    setTab('new')
    flash('تنسخات — بدّل التاريخ واحفظ')
    window.scrollTo(0, 0)
  }

  // ═══ حذف مذكرة ═══
  const delNote = async (id) => {
    if (!confirm('متأكد باغي تمسح هاد المذكرة؟')) return
    await supabase.from('daily_notes').delete().eq('id', id)
    loadAll()
    flash('تمسحات ✓')
  }

  // ═══ نموذج جديد فارغ ═══
  const newNote = () => {
    setEditId(null)
    setForm(EMPTY_FORM)
    setActivities([])
    setSelProgram('')
  }

  // ═══ توليد المذكرة بالذكاء الاصطناعي (Gemini) ═══
  const generateAI = async () => {
    if (!form.lesson_title.trim()) { flash('أدخل عنوان الدرس أولاً'); return }
    setAiBusy(true)
    setMsg('')

    const prompt =
      'أنت أستاذ خبير بالتعليم الابتدائي المغربي (مدارس الريادة). أعدّ مذكرة يومية للحصة التالية:\n' +
      '- المستوى: ' + (form.level || '—') + '\n- المادة: ' + (form.subject || '—') + '\n- الوحدة: ' + (form.unit || '—') +
      '\n- المكوّن: ' + (form.component || '—') + '\n- عنوان الدرس: ' + form.lesson_title + '\n\n' +
      'أرجع الجواب بصيغة JSON فقط (بدون أي نص إضافي أو علامات markdown) بهذا الشكل بالضبط:\n' +
      '{"objectives":"الأهداف والتعلمات المستهدفة","activities":[{"stage":"اسم المرحلة","duration":"5د","contents":"مضامين النشاط","teacher_activity":"نشاط الأستاذ","learner_activity":"نشاط المتعلم","tools":"الوسائل","evaluation":"التقويم"}]}\n' +
      'اجعل المراحل منطقية (تهيئة، بناء، تقويم، دعم...) وبمحتوى تربوي رسمي مناسب للمستوى.'

    try {
      const { data, error } = await supabase.functions.invoke('ai-assistant', {
        body: { prompt },
      })

      if (error) { flash('تعذر الاتصال بالمساعد: ' + error.message); setAiBusy(false); return }

      let txt = (data?.answer || '').trim().replace(/```json/g, '').replace(/```/g, '').trim()
      const parsed = JSON.parse(txt)

      if (parsed.objectives) setForm(f => ({ ...f, objectives: parsed.objectives }))
      if (Array.isArray(parsed.activities)) {
        setActivities(parsed.activities.map(a => ({
          timing: '', duration: a.duration || '', stage: a.stage || STAGES[0],
          contents: a.contents || '', teacher_activity: a.teacher_activity || '',
          learner_activity: a.learner_activity || '', tools: a.tools || '', evaluation: a.evaluation || '',
        })))
      }
      flash('تولّدات المذكرة — راجعها وعدّلها قبل الحفظ')
    } catch (e) {
      flash('تعذّر تحليل نتيجة الذكاء الاصطناعي، حاول مرة أخرى')
    }
    setAiBusy(false)
  }
  
  // اختصار لعنصر select
  const Select = ({ k, options, placeholder }) => (
    <select value={form[k]} onChange={setF(k)} style={st.input}>
      <option value="">{placeholder || '—'}</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  )

  return (
    <div style={st.page}>
      <div style={st.container}>
        {/* التبويبات */}
        <div style={st.tabs}>
          <button
            onClick={() => setTab('new')}
            style={{ ...st.tab, ...(tab === 'new' ? st.tabActive : {}) }}
          >
            {editId ? 'تعديل المذكرة' : 'مذكرة جديدة'}
          </button>
          <button
            onClick={() => setTab('archive')}
            style={{ ...st.tab, ...(tab === 'archive' ? st.tabActive : {}) }}
          >
            الأرشيف ({notes.length})
          </button>
          {msg && <span style={st.flash}>{msg}</span>}
        </div>

        {tab === 'new' && (
          <div>
            {/* اختيار درس من البرمجة */}
            {!editId && programLessons.length > 0 && (
              <div style={st.progBox}>
                <label style={st.label}>اختر درساً من برمجتك السنوية:</label>
                <select value={selProgram} onChange={(e) => pickProgram(e.target.value)} style={st.input}>
                  <option value="">— اختيار حر (بلا ربط) —</option>
                  {programLessons.map(l => (
                    <option key={l.id} value={l.id}>
                      {l.subject} — {l.lesson_title} {l.week_number ? `(أسبوع ${l.week_number})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* المعلومات العامة */}
            <h3 style={st.section}>المعلومات العامة</h3>
            <div style={st.grid}>
              <div><label style={st.label}>التاريخ</label>
                <input type="date" value={form.note_date} onChange={setF('note_date')} style={st.input} /></div>
              <div><label style={st.label}>اليوم</label><Select k="weekday" options={WEEKDAYS} /></div>
              <div><label style={st.label}>المستوى</label><Select k="level" options={LEVELS} /></div>
              <div><label style={st.label}>القسم</label>
                {sectionOptions.length > 0
                  ? <Select k="section" options={sectionOptions} />
                  : <input value={form.section} onChange={setF('section')} style={st.input} placeholder="القسم" />}
              </div>
              <div><label style={st.label}>المسار</label><Select k="track" options={TRACKS} /></div>
              <div><label style={st.label}>رقم الحصة</label><Select k="session_number" options={SESSIONS} /></div>
              <div><label style={st.label}>المادة</label><Select k="subject" options={SUBJECTS} /></div>
              <div><label style={st.label}>الوحدة</label><Select k="unit" options={UNITS} /></div>
              <div><label style={st.label}>المكوّن</label>
                <input value={form.component} onChange={setF('component')} style={st.input} placeholder="المكوّن" /></div>
              <div><label style={st.label}>الأسبوع</label><Select k="week_number" options={WEEKS} /></div>
              <div><label style={st.label}>اليوم رقم</label><Select k="day_number" options={DAYNUMS} /></div>
              <div style={{ gridColumn: '1 / -1' }}><label style={st.label}>عنوان الدرس *</label>
                <input value={form.lesson_title} onChange={setF('lesson_title')} style={st.input} placeholder="عنوان الدرس" /></div>
            </div>

            {/* توليد بالذكاء الاصطناعي */}
            <div style={st.aiBox}>
              <div style={st.aiInfo}>
                <strong style={st.aiTitle}>🤖 توليد بالذكاء الاصطناعي</strong>
                <span style={st.aiHint}>عمّر عنوان الدرس (والمستوى/المادة إن أمكن) ثم ولّد الأهداف والمراحل أوتوماتيك</span>
              </div>
              <button onClick={generateAI} disabled={aiBusy} style={st.aiBtn}>
                {aiBusy ? 'كيولّد...' : 'ولّد المذكرة'}
              </button>
            </div>

            {/* الأهداف */}
            <h3 style={st.section}>الأهداف والتعلمات المستهدفة</h3>
            <textarea value={form.objectives} onChange={setF('objectives')} style={st.textarea} placeholder="الأهداف..." />
            {/* جدول مراحل الحصة */}
            <div style={st.stageHeader}>
              <h3 style={{ ...st.section, margin: 0, border: 'none', padding: 0 }}>مراحل الحصة</h3>
              <button onClick={addActivity} style={st.addBtn}>+ زيد مرحلة</button>
            </div>
            <div style={st.tableWrap}>
              <table style={st.table}>
                <thead>
                  <tr>
                    <th style={st.th}>التوقيت</th><th style={st.th}>المدة</th><th style={st.th}>المرحلة</th>
                    <th style={st.th}>المضامين</th><th style={st.th}>نشاط الأستاذ</th><th style={st.th}>نشاط المتعلم</th>
                    <th style={st.th}>الوسائل</th><th style={st.th}>التقويم</th><th style={st.th}></th>
                  </tr>
                </thead>
                <tbody>
                  {activities.length === 0 ? (
                    <tr><td colSpan={9} style={st.emptyCell}>مازال حتى مرحلة — زيد وحدة أو ولّدها بالذكاء الاصطناعي</td></tr>
                  ) : activities.map((a, i) => (
                    <tr key={i}>
                      <td style={st.td}><input value={a.timing} onChange={e => updateActivity(i, 'timing', e.target.value)} style={st.cellInput} /></td>
                      <td style={st.td}><input value={a.duration} onChange={e => updateActivity(i, 'duration', e.target.value)} style={st.cellInput} /></td>
                      <td style={st.td}>
                        <select value={a.stage} onChange={e => updateActivity(i, 'stage', e.target.value)} style={st.cellInput}>
                          {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                      <td style={st.td}><textarea value={a.contents} onChange={e => updateActivity(i, 'contents', e.target.value)} style={st.cellArea} /></td>
                      <td style={st.td}><textarea value={a.teacher_activity} onChange={e => updateActivity(i, 'teacher_activity', e.target.value)} style={st.cellArea} /></td>
                      <td style={st.td}><textarea value={a.learner_activity} onChange={e => updateActivity(i, 'learner_activity', e.target.value)} style={st.cellArea} /></td>
                      <td style={st.td}><input value={a.tools} onChange={e => updateActivity(i, 'tools', e.target.value)} style={st.cellInput} /></td>
                      <td style={st.td}><input value={a.evaluation} onChange={e => updateActivity(i, 'evaluation', e.target.value)} style={st.cellInput} /></td>
                      <td style={st.td}>
                        <div style={st.rowBtns}>
                          <button onClick={() => moveActivity(i, -1)} style={st.miniBtn} title="فوق">▲</button>
                          <button onClick={() => moveActivity(i, 1)} style={st.miniBtn} title="تحت">▼</button>
                          <button onClick={() => delActivity(i)} style={st.miniDel} title="حذف">✕</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* الملاحظات ونسبة الإنجاز */}
            <h3 style={st.section}>الملاحظات ونسبة الإنجاز</h3>
            <div style={st.grid}>
              <div><label style={st.label}>ملاحظات الفوج 1</label>
                <input value={form.group1_notes} onChange={setF('group1_notes')} style={st.input} /></div>
              <div><label style={st.label}>ملاحظات الفوج 2</label>
                <input value={form.group2_notes} onChange={setF('group2_notes')} style={st.input} /></div>
            </div>
            <label style={st.label}>نسبة الإنجاز: {form.completion_rate}%</label>
            <input type="range" min="0" max="100" value={form.completion_rate}
              onChange={setF('completion_rate')} style={{ width: '100%' }} />
            <label style={st.label}>ملاحظات الأستاذ</label>
            <textarea value={form.teacher_comment} onChange={setF('teacher_comment')} style={st.textarea} />

            {/* الأزرار */}
            <div style={st.actions}>
              <button onClick={saveNote} disabled={saving} style={st.saveBtn}>
                {saving ? '...' : editId ? 'تحديث المذكرة' : 'حفظ المذكرة'}
              </button>
              <button onClick={() => window.print()} style={st.printBtn}>طباعة / PDF</button>
              {editId && <button onClick={newNote} style={st.cancelBtn}>إلغاء التعديل</button>}
            </div>
          </div>
        )}{
            
            tab === 'archive' && (
          <div>
            <h3 style={st.section}>المذكرات المحفوظة</h3>
            {notes.length === 0 ? (
              <p style={st.muted}>مازال حتى مذكرة محفوظة.</p>
            ) : (
              <div style={st.archiveList}>
                {notes.map(n => (
                  <div key={n.id} style={st.archiveItem}>
                    <div style={st.archiveInfo}>
                      <div style={st.archiveTitle}>{n.lesson_title || '(بلا عنوان)'}</div>
                      <div style={st.archiveMeta}>
                        {n.note_date} · {n.level || '—'} · {n.section || '—'} · {n.subject || '—'} · الإنجاز {n.completion_rate}%
                      </div>
                    </div>
                    <div style={st.archiveBtns}>
                      <button onClick={() => editNote(n)} style={st.openBtn}>فتح</button>
                      <button onClick={() => copyNote(n)} style={st.copyBtn}>نسخ</button>
                      <button onClick={() => delNote(n.id)} style={st.delBtn}>حذف</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ═══ ورقة الطباعة الرسمية (تبان فقط عند الطباعة) ═══ */}
      {tab === 'new' && (
        <div className="print-sheet" style={st.printSheet}>
          <div style={st.printHeader}>
            <div style={st.printHeaderCol}>
              <div>المملكة المغربية</div>
              <div>وزارة التربية الوطنية والتعليم الأولي والرياضة</div>
              {settings?.academy && <div>الأكاديمية الجهوية: {settings.academy}</div>}
              {settings?.direction && <div>المديرية الإقليمية: {settings.direction}</div>}
              {settings?.school_name && <div>المؤسسة: {settings.school_name}</div>}
            </div>
            <div style={st.printHeaderCol}>
              <div>السنة الدراسية: {settings?.school_year || form.school_year || '2025/2026'}</div>
              {settings?.full_name && <div>الأستاذ(ة): {settings.full_name}</div>}
            </div>
          </div>

          <h2 style={st.printTitle}>المذكرة اليومية</h2>

          <table style={st.printInfoTable}>
            <tbody>
              <tr><td style={st.pLabel}>التاريخ</td><td style={st.pVal}>{form.note_date}</td>
                  <td style={st.pLabel}>اليوم</td><td style={st.pVal}>{form.weekday}</td></tr>
              <tr><td style={st.pLabel}>المستوى</td><td style={st.pVal}>{form.level}</td>
                  <td style={st.pLabel}>القسم</td><td style={st.pVal}>{form.section}</td></tr>
              <tr><td style={st.pLabel}>المادة</td><td style={st.pVal}>{form.subject}</td>
                  <td style={st.pLabel}>الوحدة</td><td style={st.pVal}>{form.unit}</td></tr>
              <tr><td style={st.pLabel}>المكوّن</td><td style={st.pVal}>{form.component}</td>
                  <td style={st.pLabel}>الأسبوع</td><td style={st.pVal}>{form.week_number}</td></tr>
              <tr><td style={st.pLabel}>عنوان الدرس</td><td style={st.pVal} colSpan={3}>{form.lesson_title}</td></tr>
            </tbody>
          </table>

          <div style={st.printBlock}><strong>الأهداف:</strong><p>{form.objectives}</p></div>

          <table style={st.printStageTable}>
            <thead>
              <tr>
                <th style={st.pth}>المدة</th><th style={st.pth}>المرحلة</th><th style={st.pth}>المضامين</th>
                <th style={st.pth}>نشاط الأستاذ</th><th style={st.pth}>نشاط المتعلم</th>
                <th style={st.pth}>الوسائل</th><th style={st.pth}>التقويم</th>
              </tr>
            </thead>
            <tbody>
              {activities.map((a, i) => (
                <tr key={i}>
                  <td style={st.ptd}>{a.duration}</td><td style={st.ptd}>{a.stage}</td><td style={st.ptd}>{a.contents}</td>
                  <td style={st.ptd}>{a.teacher_activity}</td><td style={st.ptd}>{a.learner_activity}</td>
                  <td style={st.ptd}>{a.tools}</td><td style={st.ptd}>{a.evaluation}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {form.teacher_comment && (
            <div style={st.printBlock}><strong>ملاحظات الأستاذ:</strong><p>{form.teacher_comment}</p></div>
          )}

          <div style={st.signRow}>
            <div style={st.signBox}>توقيع الأستاذ(ة)</div>
            <div style={st.signBox}>توقيع المدير(ة)</div>
            <div style={st.signBox}>توقيع المفتش / المواكب</div>
          </div>
        </div>
      )}
    </div>
  )
}

const st = {
  page: { background: '#f1f5f9', minHeight: '100vh', padding: '24px', direction: 'rtl', fontFamily: 'system-ui, sans-serif' },
  container: { maxWidth: '1100px', margin: '0 auto', background: '#fff', borderRadius: '16px', padding: '24px', boxShadow: '0 4px 20px rgba(0,0,0,.08)' },

  tabs: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', flexWrap: 'wrap', borderBottom: '2px solid #e2e8f0', paddingBottom: '12px' },
  tab: { padding: '8px 20px', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: 600, cursor: 'pointer' },
  tabActive: { background: '#0ea5e9', color: '#fff' },
  flash: { marginRight: 'auto', color: '#059669', fontSize: '14px', fontWeight: 600 },

  progBox: { background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '12px', padding: '14px', marginBottom: '20px' },
  aiBox: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '14px', background: 'linear-gradient(135deg, #eff6ff, #f0f9ff)', border: '1px solid #bae6fd', borderRadius: '12px', padding: '16px', marginTop: '20px', flexWrap: 'wrap' },
  aiInfo: { display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, minWidth: '220px' },
  aiTitle: { fontSize: '15px', color: '#0369a1' },
  aiHint: { fontSize: '12px', color: '#64748b' },
  aiBtn: { padding: '10px 24px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' },
  section: { margin: '24px 0 12px', color: '#0f172a', fontSize: '17px', borderTop: '1px solid #e2e8f0', paddingTop: '18px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' },
  label: { display: 'block', color: '#334155', fontSize: '13px', fontWeight: 600, marginBottom: '5px' },
  input: { width: '100%', padding: '9px 11px', border: '1px solid #cbd5e1', borderRadius: '9px', fontSize: '14px', fontFamily: 'inherit', boxSizing: 'border-box' },
  textarea: { width: '100%', minHeight: '90px', padding: '11px', border: '1px solid #cbd5e1', borderRadius: '10px', fontSize: '14px', fontFamily: 'inherit', lineHeight: 1.7, resize: 'vertical', boxSizing: 'border-box' },

  stageHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '24px 0 12px', borderTop: '1px solid #e2e8f0', paddingTop: '18px', flexWrap: 'wrap', gap: '10px' },
  addBtn: { padding: '7px 16px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '9px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' },
  tableWrap: { overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '10px' },
  table: { width: '100%', borderCollapse: 'collapse', minWidth: '900px' },
  th: { background: '#f8fafc', padding: '8px', fontSize: '12px', fontWeight: 700, color: '#475569', borderBottom: '2px solid #e2e8f0', whiteSpace: 'nowrap' },
  td: { padding: '4px', borderBottom: '1px solid #f1f5f9', verticalAlign: 'top' },
  cellInput: { width: '100%', minWidth: '70px', padding: '6px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '13px', fontFamily: 'inherit', boxSizing: 'border-box' },
  cellArea: { width: '100%', minWidth: '120px', minHeight: '52px', padding: '6px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '13px', fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' },
  emptyCell: { padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' },
  rowBtns: { display: 'flex', flexDirection: 'column', gap: '3px' },
  miniBtn: { padding: '3px 7px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '5px', fontSize: '11px', cursor: 'pointer' },
  miniDel: { padding: '3px 7px', background: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca', borderRadius: '5px', fontSize: '11px', cursor: 'pointer' },

  actions: { display: 'flex', gap: '12px', marginTop: '24px', flexWrap: 'wrap' },
  saveBtn: { padding: '11px 28px', background: '#0ea5e9', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: 600, cursor: 'pointer' },
  printBtn: { padding: '11px 24px', background: '#fff', color: '#0ea5e9', border: '1px solid #0ea5e9', borderRadius: '10px', fontSize: '15px', fontWeight: 600, cursor: 'pointer' },
  cancelBtn: { padding: '11px 22px', background: '#fff', color: '#64748b', border: '1px solid #cbd5e1', borderRadius: '10px', fontSize: '15px', fontWeight: 600, cursor: 'pointer' },

  muted: { color: '#94a3b8', fontSize: '14px' },
  archiveList: { display: 'flex', flexDirection: 'column', gap: '10px' },
  archiveItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', border: '1px solid #e2e8f0', borderRadius: '12px', flexWrap: 'wrap', gap: '10px' },
  archiveInfo: { flex: 1, minWidth: '200px' },
  archiveTitle: { fontSize: '15px', fontWeight: 700, color: '#0f172a', marginBottom: '4px' },
  archiveMeta: { fontSize: '13px', color: '#64748b' },
  archiveBtns: { display: 'flex', gap: '8px' },
  openBtn: { padding: '7px 16px', background: '#0ea5e9', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' },
  copyBtn: { padding: '7px 16px', background: '#fff', color: '#0ea5e9', border: '1px solid #0ea5e9', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' },
  delBtn: { padding: '7px 16px', background: '#fff', color: '#ef4444', border: '1px solid #ef4444', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' },

  // ورقة الطباعة (مخفية على الشاشة، تبان فقط عند الطباعة)
  printSheet: { display: 'none' },
  printHeader: { display: 'flex', justifyContent: 'space-between', fontSize: '13px', lineHeight: 1.9, marginBottom: '16px' },
  printHeaderCol: {},
  printTitle: { textAlign: 'center', fontSize: '20px', margin: '10px 0 18px', textDecoration: 'underline' },
  printInfoTable: { width: '100%', borderCollapse: 'collapse', marginBottom: '16px' },
  pLabel: { border: '1px solid #333', padding: '6px 10px', background: '#f0f0f0', fontWeight: 700, fontSize: '13px', width: '15%' },
  pVal: { border: '1px solid #333', padding: '6px 10px', fontSize: '13px' },
  printBlock: { margin: '14px 0', fontSize: '13px', lineHeight: 1.8 },
  printStageTable: { width: '100%', borderCollapse: 'collapse', margin: '14px 0', fontSize: '12px' },
  pth: { border: '1px solid #333', padding: '6px', background: '#f0f0f0', fontWeight: 700 },
  ptd: { border: '1px solid #333', padding: '6px', verticalAlign: 'top' },
  signRow: { display: 'flex', justifyContent: 'space-between', marginTop: '40px', gap: '20px' },
  signBox: { flex: 1, textAlign: 'center', fontSize: '13px', fontWeight: 600, borderTop: '1px solid #333', paddingTop: '8px' },
}