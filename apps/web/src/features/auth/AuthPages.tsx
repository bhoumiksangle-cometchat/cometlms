import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from './useAuth';

export function LoginPage() {
  const { login, isAuthenticated } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  if (isAuthenticated) return <Navigate to='/' replace />;

  return (
    <div className='min-h-screen flex items-center justify-center'>
      <form onSubmit={async (e) => { e.preventDefault(); await login(email, password); }}>
        <h1>Login</h1>
        <input value={email} onChange={(e)=>setEmail(e.target.value)} placeholder='Email' />
        <input type='password' value={password} onChange={(e)=>setPassword(e.target.value)} placeholder='Password' />
        <button type='submit'>Login</button>
        <Link to='/register'>Register</Link>
      </form>
    </div>
  );
}

export function RegisterPage() {
  const { register, isAuthenticated } = useAuth();
  const [name,setName]=useState('');
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');

  if (isAuthenticated) return <Navigate to='/' replace />;

  return (
    <div className='min-h-screen flex items-center justify-center'>
      <form onSubmit={async (e)=>{e.preventDefault(); await register(email,password,name);}}>
        <h1>Register</h1>
        <input value={name} onChange={(e)=>setName(e.target.value)} placeholder='Name' />
        <input value={email} onChange={(e)=>setEmail(e.target.value)} placeholder='Email' />
        <input type='password' value={password} onChange={(e)=>setPassword(e.target.value)} placeholder='Password' />
        <button type='submit'>Register</button>
        <Link to='/login'>Login</Link>
      </form>
    </div>
  );
}
