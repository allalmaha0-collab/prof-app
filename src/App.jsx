import { Routes, Route, Navigate, NavLink } from 'react-router-dom'
import { useAuth } from './AuthContext'
import Auth from './Auth'
import Settings from './Settings'
import Journal from './Journal'
import Program from './Program'
import Requests from './Requests'
import Incident from './Incident'
import Students from './Students'
import Absences from './Absences'
import Holidays from './Holidays'

function App() {
  const { user, loading, signOut } = useAuth()

  if (loading) {
    return <div style={s.loader}>كنحمّل...</div>
  }

  if (!user) {
    return <Auth />
  }

  return (
    <div style={{ direction: 'rtl', fontFamily: 'system-ui, sans-serif' }}>
      <nav style={s.nav}>
        <div style={s.navLinks}>
          <NavLink to="/" style={navStyle} end>المذكرة اليومية</NavLink>
          <NavLink to="/program" style={navStyle}>البرمجة السنوية</NavLink>
          <NavLink to="/students" style={navStyle}>التلاميذ</NavLink>
          <NavLink to="/absences" style={navStyle}>سجل الغياب</NavLink>
          <NavLink to="/holidays" style={navStyle}>العطل</NavLink>
          <NavLink to="/requests" style={navStyle}>الطلبات الإدارية</NavLink>
          <NavLink to="/incident" style={navStyle}>تقرير حادثة</NavLink>
          <NavLink to="/settings" style={navStyle}>الإعدادات</NavLink>
        </div>
        <div style={s.navRight}>
          <span dir="ltr" style={s.email}>{user.email}</span>
          <button onClick={signOut} style={s.logout}>خروج</button>
        </div>
      </nav>

      <Routes>
        <Route path="/" element={<Journal />} />
        <Route path="/program" element={<Program />} />
        <Route path="/students" element={<Students />} />
        <Route path="/absences" element={<Absences />} />
        <Route path="/holidays" element={<Holidays />} />
        <Route path="/requests" element={<Requests />} />
        <Route path="/incident" element={<Incident />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}

const navStyle = ({ isActive }) => ({
  padding: '8px 16px', borderRadius: '8px', textDecoration: 'none',
  fontSize: '15px', fontWeight: 600,
  color: isActive ? '#fff' : '#cbd5e1',
  background: isActive ? '#0ea5e9' : 'transparent',
})

const s = {
  loader: {
    minHeight: '100vh', display: 'flex', alignItems: 'center',
    justifyContent: 'center', background: '#0f172a', color: '#fff',
    fontFamily: 'system-ui, sans-serif',
  },
  nav: {
    background: '#0f172a', padding: '12px 24px', display: 'flex',
    justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px',
  },
  navLinks: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
  navRight: { display: 'flex', alignItems: 'center', gap: '12px' },
  email: { color: '#94a3b8', fontSize: '13px' },
  logout: {
    padding: '6px 16px', background: '#ef4444', color: '#fff',
    border: 'none', borderRadius: '8px', fontSize: '14px',
    fontWeight: 600, cursor: 'pointer',
  },
}

export default App