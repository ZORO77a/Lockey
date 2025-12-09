import React, {useState, useEffect} from 'react'
import API from '../api'
import { useLocation, useNavigate } from 'react-router-dom'

export default function OtpVerify(){
  const loc = useLocation()
  const nav = useNavigate()
  const email = loc.state?.email || ''
  const [code,setCode] = useState('')
  const [loading,setLoading] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(5 * 60) // 5 minutes
  const [resending,setResending] = useState(false)

  async function submit(e){
    e.preventDefault()
    setLoading(true)
    try{
      const form = new URLSearchParams({email, code})
      const res = await API.post('/auth/verify-otp', form)
      localStorage.setItem('token', res.data.access_token)
      localStorage.setItem('role', res.data.role)
      // Role-based redirect improvements: go to originally requested path (if present)
      if (res.data.role === 'admin') nav('/admin')
      else nav('/employee')
    }catch(err){
      alert(err?.response?.data?.detail || err?.message)
    }finally{ setLoading(false) }
  }

  useEffect(() => {
    // reset timer when email changes (e.g. coming back to this page)
    setSecondsLeft(5 * 60)
  }, [email])

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft(s => (s > 0 ? s - 1 : 0))
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  function formatTime(sec){
    const m = Math.floor(sec/60).toString().padStart(2,'0')
    const s = (sec%60).toString().padStart(2,'0')
    return `${m}:${s}`
  }

  async function handleResend(){
    if (!email) return alert('Missing email')
    setResending(true)
    try{
      const form = new URLSearchParams({email})
      await API.post('/auth/resend-otp', form)
      setSecondsLeft(5 * 60)
      alert('OTP resent')
    }catch(err){
      alert(err?.response?.data?.detail || err?.message)
    }finally{ setResending(false) }
  }

  return (
    <div className="card" style={{maxWidth:480,margin:'28px auto'}}>
      <h2>Enter OTP</h2>
      <p className="small">OTP sent to <strong>{email}</strong></p>
      <p className="small muted">OTP will expire in <strong>{formatTime(secondsLeft)}</strong></p>
      <form onSubmit={submit}>
        <input className="input" value={code} onChange={e=>setCode(e.target.value)} placeholder="6-digit code" required/>
        <div style={{display:'flex',justifyContent:'flex-end',marginTop:12}}>
          <button className="btn" type="submit">{loading? 'Verifying...' : 'Verify'}</button>
        </div>
      </form>

      <div style={{display:'flex',justifyContent:'space-between',marginTop:12}}>
        <button className="btn" onClick={handleResend} disabled={resending}>{resending? 'Resending...' : 'Resend OTP'}</button>
        <div style={{alignSelf:'center'}}>
          <small className="small">{secondsLeft<=0 ? 'OTP expired' : ''}</small>
        </div>
      </div>
    </div>
  )
}
