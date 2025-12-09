import React, {useState} from 'react'
import API from '../api'
import { useLocation, useNavigate } from 'react-router-dom'

export default function OtpVerify(){
  const loc = useLocation()
  const nav = useNavigate()
  const email = loc.state?.email || ''
  const [code,setCode] = useState('')
  const [loading,setLoading] = useState(false)

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

  return (
    <div className="card" style={{maxWidth:480,margin:'28px auto'}}>
      <h2>Enter OTP</h2>
      <p className="small">OTP sent to <strong>{email}</strong></p>
      <form onSubmit={submit}>
        <input className="input" value={code} onChange={e=>setCode(e.target.value)} placeholder="6-digit code" required/>
        <div style={{display:'flex',justifyContent:'flex-end',marginTop:12}}>
          <button className="btn" type="submit">{loading? 'Verifying...' : 'Verify'}</button>
        </div>
      </form>
    </div>
  )
}
