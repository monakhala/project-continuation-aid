import {createFileRoute,Link} from '@tanstack/react-router';
import {LineChart,ClipboardList,Users,Sparkles} from 'lucide-react';
import {Brand} from '@/components/inventra/brand';
import {useT,LangToggle} from '@/lib/inventra/i18n';
import {useInventra} from '@/components/inventra/provider';
import warehouse from '@/assets/warehouse.jpg';

export const Route=createFileRoute('/')({
  head:()=>({meta:[{title:'Inventra — Demand forecasts & restocking you can trust'},{name:'description',content:'Inventory app with backtested demand forecasts, traceable restock recommendations, team roles and an AI copilot in English and Arabic.'},{property:'og:title',content:'Inventra — Demand forecasts & restocking you can trust'},{property:'og:description',content:'Backtested forecasts, traceable restocking and an English/Arabic AI copilot.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary_large_image'}]}),
  component:Landing,
});

function Landing(){
  const {t}=useT(),{session,setDemo}=useInventra();
  const feats=[[LineChart,'f1','f1d'],[ClipboardList,'f2','f2d'],[Users,'f3','f3d'],[Sparkles,'f4','f4d']] as const;
  return <div className="min-h-screen bg-background text-foreground">
    <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
      <Brand/>
      <div className="flex items-center gap-2"><LangToggle/>{session?<Link to="/app" onClick={()=>setDemo(false)} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">{t('openApp')}</Link>:<Link to="/auth" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">{t('signIn')}</Link>}</div>
    </header>
    <section className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-12 md:grid-cols-2 md:py-20">
      <div>
        <p className="mb-4 text-sm font-semibold uppercase tracking-wider text-primary">{t('tagline')}</p>
        <h1 className="text-4xl font-bold leading-tight md:text-5xl">{t('heroTitle')}</h1>
        <p className="mt-5 text-lg text-muted-foreground">{t('heroSub')}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link to="/app" onClick={()=>setDemo(true)} className="rounded-md bg-primary px-5 py-3 font-medium text-primary-foreground hover:opacity-90">{t('tryDemo')}</Link>
          {!session&&<Link to="/auth" className="rounded-md border border-border px-5 py-3 font-medium hover:bg-accent">{t('signUp')}</Link>}
        </div>
      </div>
      <img src={warehouse} alt="Warehouse shelves" className="aspect-[4/3] w-full rounded-lg object-cover" width={1024} height={768}/>
    </section>
    <section className="border-t border-border bg-card">
      <div className="mx-auto grid max-w-6xl gap-6 px-5 py-16 sm:grid-cols-2 lg:grid-cols-4">
        {feats.map(([I,a,b])=><div key={a}><I className="mb-3 text-primary"/><h3 className="font-semibold">{t(a)}</h3><p className="mt-2 text-sm text-muted-foreground">{t(b)}</p></div>)}
      </div>
    </section>
    <footer className="mx-auto max-w-6xl px-5 py-8 text-sm text-muted-foreground">{t('footer')}</footer>
  </div>;
}
