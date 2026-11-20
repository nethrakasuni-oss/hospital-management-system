import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Activity, Ambulance, BedDouble, Bell, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, ClipboardList, CreditCard, FlaskConical, HeartPulse, LayoutDashboard, LogOut, Menu, Pill, Scissors, Search, Settings, ShieldCheck, Stethoscope, Truck, Users, UserRoundCog, X } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

const groups = [
  { title: 'OVERVIEW', items: [{ label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard }] },
  { title: 'PATIENT CARE', items: [
    { label: 'Patient Queue', path: '/patient-queue', icon: Stethoscope },
    { label: 'Patients', path: '/patients', icon: Users }, { label: 'Medical Records', path: '/medical-records', icon: ClipboardList }, { label: 'Appointments', path: '/appointments', icon: CalendarDays },
    { label: 'Doctors', path: '/doctors', icon: Stethoscope }, { label: 'Departments', path: '/departments', icon: ClipboardList },
    { label: 'Admissions & Beds', path: '/admissions', icon: BedDouble }, { label: 'Nursing', path: '/nursing', icon: HeartPulse },
    { label: 'Emergency', path: '/emergency', icon: Ambulance }, { label: 'Surgery & Theatre', path: '/surgeries', icon: Scissors },
    { label: 'Patient Transfers', path: '/transfers', icon: Truck }, { label: 'Discharges', path: '/discharges', icon: ClipboardList },
  ]},
  { title: 'HOSPITAL SERVICES', items: [
    { label: 'Laboratory', path: '/laboratory', icon: FlaskConical }, { label: 'Pharmacy', path: '/pharmacy', icon: Pill },
    { label: 'Insurance', path: '/insurance', icon: ShieldCheck }, { label: 'Billing & Payments', path: '/billing', icon: CreditCard },
  ]},
  { title: 'MANAGEMENT', items: [
    { label: 'Staff & Attendance', path: '/employees', icon: UserRoundCog }, { label: 'Procurement', path: '/procurement', icon: Truck },
    { label: 'Administration', path: '/administration', icon: Settings }, { label: 'Notifications', path: '/notifications', icon: Bell },
  ]},
]


const receptionistPaths = [
  '/dashboard',
  '/patients',
  '/appointments',
  '/emergency',
  '/billing',
  '/notifications',
]

function Sidebar({
  collapsed,
  setCollapsed,
  close,
}: {
  collapsed: boolean
  setCollapsed?: (v: boolean) => void
  close?: () => void
}) {
  // Hooks must be inside the React component
  const { user } = useAuth()

  const role = user?.role?.trim().toUpperCase()

  const visibleGroups = groups
    .map(group => ({
      ...group,
      items: group.items.filter(item => {
        if (role === 'ADMIN') return true

        if (role === 'RECEPTIONIST') {
          return receptionistPaths.includes(item.path)
        }

        if (role === 'DOCTOR') {
          return item.path === '/dashboard' || item.path === '/patient-queue'
        }

        if (role === 'NURSE') {
          return item.path === '/dashboard' || item.path === '/nursing'
        }

        if (role === 'PHARMACIST') {
          return item.path === '/dashboard' || item.path === '/pharmacy' || item.path === '/procurement'
        }

        if (role === 'ACCOUNTANT') {
          return item.path === '/dashboard' || item.path === '/billing' || item.path === '/procurement'
        }

        if (['LAB_TECHNICIAN','LAB_MANAGER','PATHOLOGIST'].includes(role ?? '')) {
          return item.path === '/dashboard' || item.path === '/laboratory'
        }

        return item.path === '/dashboard'
      }),
    }))
    .filter(group => group.items.length > 0)

  return (
    <aside className={`mc-sidebar ${collapsed ? 'mc-sidebar--collapsed' : ''}`}>
      <div className="mc-brand">
        <div className="mc-brand-mark">
          <HeartPulse size={22} />
        </div>

        {!collapsed && (
          <div className="mc-brand-copy">
            <strong>MediCore</strong>
            <span>HOSPITAL SYSTEM</span>
          </div>
        )}

        <button
          className="mc-icon-button mc-sidebar-close"
          onClick={close}
          aria-label="Close menu"
        >
          <X size={18} />
        </button>
      </div>

      <nav className="mc-nav">
        {visibleGroups.map(g => (
          <section className="mc-nav-group" key={g.title}>
            {!collapsed && (
              <p className="mc-nav-heading">{g.title}</p>
            )}

            {g.items.map(item => (
              <NavLink
                key={item.path}
                to={item.path}
                title={collapsed ? item.label : undefined}
                onClick={close}
                className={({ isActive }) =>
                  `mc-nav-link ${isActive ? 'active' : ''}`
                }
              >
                <item.icon size={19} />

                {!collapsed && <span>{item.label}</span>}

                {collapsed && (
                  <span className="mc-tooltip">{item.label}</span>
                )}
              </NavLink>
            ))}
          </section>
        ))}
      </nav>

      <div className="mc-sidebar-bottom">
        <div className="mc-support-card">
          <div className="mc-support-icon">
            <Activity size={17} />
          </div>

          {!collapsed && (
            <div>
              <strong>Hospital operations</strong>
              <span>Manage daily workflow</span>
            </div>
          )}
        </div>

        {setCollapsed && (
          <button
            className="mc-collapse-button"
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? (
              <ChevronRight size={18} />
            ) : (
              <>
                <ChevronLeft size={18} />
                <span>Collapse sidebar</span>
              </>
            )}
          </button>
        )}
      </div>
    </aside>
  )
}




export default function MainLayout() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const title = groups.flatMap(g => g.items).find(i => i.path === location.pathname)?.label ?? 'MediCore'
  return <div className={`mc-app-shell ${collapsed ? 'mc-shell-collapsed' : ''}`}>
    <div className="mc-desktop-sidebar"><Sidebar collapsed={collapsed} setCollapsed={setCollapsed}/></div>
    {mobileOpen && <div className="mc-mobile-backdrop" onClick={() => setMobileOpen(false)}/>}
    <div className={`mc-mobile-sidebar ${mobileOpen ? 'open' : ''}`}><Sidebar collapsed={false} close={() => setMobileOpen(false)}/></div>
    <div className="mc-main-column">
      <header className="mc-topbar"><div className="mc-topbar-left"><button className="mc-icon-button mc-mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Open menu"><Menu size={21}/></button><div><div className="mc-breadcrumb">Workspace <span>/</span> <strong>{title}</strong></div><h1>{title}</h1></div></div>
        <div className="mc-topbar-actions"><label className="mc-global-search"><Search size={17}/><input placeholder="Search patients, records..." aria-label="Search"/></label><button className="mc-icon-button mc-notification" aria-label="Notifications"><Bell size={19}/><i/></button><div className="mc-user-chip"><div className="mc-avatar">{user?.firstName?.[0] ?? 'M'}{user?.lastName?.[0] ?? 'C'}</div><div className="mc-user-copy"><strong>{user?.firstName} {user?.lastName}</strong><span>{user?.role?.replaceAll('_',' ')}</span></div><ChevronDown size={15}/></div><button className="mc-icon-button mc-logout" onClick={logout} title="Sign out" aria-label="Sign out"><LogOut size={18}/></button></div>
      </header>
      <main className="mc-page-content"><Outlet/></main>
      <footer className="mc-footer"><span>© {new Date().getFullYear()} MediCore Hospital Management System</span><span>Clinical operations workspace</span></footer>
    </div>
  </div>
}
