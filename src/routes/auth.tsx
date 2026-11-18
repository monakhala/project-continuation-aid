import {createFileRoute,useNavigate,Link} from '@tanstack/react-router';
import {useState,useEffect} from 'react';
import {toast} from 'sonner';
import {supabase} from '@/integrations/supabase/client';
import {lovable} from '@/integrations/lovable';
import {useT,LangToggle} from '@/lib/inventra/i18n';
import {useInventra} from '@/components/inventra/provider';

export const Route=createFileRoute('/auth')({
  head:()=>({meta:[{title:'Sign in — Inventra'},{name:'description',content:'Sign in or create your Inventra account.'},{property:'og:title',content:'Sign in — Inventra'},{property:'og:description',content:'Sign in or create your Inventra account.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'}]}),
  component:Auth,
});

function Auth(){
  const {t}=useT(),{session,setDemo}=useInventra(),nav=useNavigate();
  const [mode,setMode]=useState<'in'|'up'>('in'),[email,setEmail]=useState(''),[pw,setPw]=useState(''),[busy,setBusy]=useState(false);
  useEffect(()=>{if(session){setDemo(false);void nav({to:'/app'});}},[session,setDemo,nav]);
  async function submit(e:React.FormEvent){e.preventDefault();setBusy(true);
    const r=mode==='in'?await supabase.auth.signInWithPassword({email,password:pw}):await supabase.auth.signUp({email,password:pw,options:{emailRedirectTo:window.location.origin+'/auth'}});
    setBusy(false);if(r.error)toast.error(r.error.message);else if(mode==='up'&&!r.data.session)toast.success(t('checkEmail'));}
  async function google(){const r=await lovable.auth.signInWithOAuth('google',{redirect_uri:window.location.origin+'/auth'});if(r.error)toast.error(r.error.message);}
  return <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
    <div className="absolute end-4 top-4"><LangToggle/></div>
    <div className="w-full max-w-sm rounded-2xl border border-border glass-strong float p-6">
      <div className="flex justify-center"><Link to="/" aria-label="Inventra"><img src="/logo.png" alt="Inventra" width={536} height={482} className="h-20 w-auto rounded-xl"/></Link></div><h1 className="mt-4 text-xl font-semibold">{t('signInTitle')}</h1>
      <form onSubmit={submit} className="mt-5 space-y-3">
        <input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder={t('email')} className="w-full rounded-md border border-input bg-background px-3 py-2 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"/>
        <input type="password" required minLength={6} value={pw} onChange={e=>setPw(e.target.value)} placeholder={t('password')} className="w-full rounded-md border border-input bg-background px-3 py-2 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"/>
        <button disabled={busy} className="w-full rounded-lg bg-primary py-2 font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60">{mode==='in'?t('signIn'):t('signUp')}</button>
      </form>
      <button onClick={google} className="mt-3 w-full rounded-lg border border-border py-2 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{t('google')}</button>
      <button onClick={()=>setMode(mode==='in'?'up':'in')} className="mt-4 w-full text-sm text-primary">{mode==='in'?t('noAccount'):t('haveAccount')}</button>
    </div>
  </div>;
}
