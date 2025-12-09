import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

export default function Nav(){
  const nav = useNavigate()
  const [role,setRole] = useState(localStorage.getItem('role'))
  const [theme,setTheme] = useState(localStorage.getItem('theme') || 'dark')

  useEffect(()=> {
    document.documentElement.setAttribute('data-theme', theme === 'light' ? 'light' : '')
    localStorage.setItem('theme', theme)
  },[theme])

  function logout(){
    localStorage.removeItem('token'); localStorage.removeItem('role'); nav('/')
  }

  function toggleTheme(){ setTheme(t => t === 'dark' ? 'light' : 'dark') }

  useEffect(()=> {
    const onStorage = () => setRole(localStorage.getItem('role'))
    window.addEventListener('storage', onStorage)
    return ()=> window.removeEventListener('storage', onStorage)
  },[])

  return (
    <div className="card header" style={{alignItems:'center'}}>
      <div className="brand">Geocrypt</div>
      <div className="controls">
        <Link to="/" className="small" style={{color:'var(--txt)',textDecoration:'none'}}>Home</Link>
        {role === 'admin' && <Link to="/admin" style={{color:'var(--txt)',textDecoration:'none'}}>Admin</Link>}
        {role === 'employee' && <Link to="/employee" style={{color:'var(--txt)',textDecoration:'none'}}>Employee</Link>}
        <button onClick={toggleTheme} className="btn ghost">Toggle Theme</button>
        <button onClick={logout} className="btn">Logout</button>
      </div>
    </div>
  )
}
