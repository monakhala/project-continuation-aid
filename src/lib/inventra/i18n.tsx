import {createContext,useContext,useEffect,useState,type ReactNode} from 'react';

export type Lang='en'|'ar';
const en={
  tagline:'Inventory intelligence that shows its work',
  heroTitle:'Know what to reorder, when, and why.',
  heroSub:'Inventra forecasts demand from your own dated sales, measures its own accuracy, and turns it into restock recommendations you can trace line by line.',
  tryDemo:'Explore the demo',signIn:'Sign in',signUp:'Create account',signOut:'Sign out',openApp:'Open app',
  f1:'Honest forecasts',f1d:'Every forecast is backtested on the product’s own history. Too little data? It says so instead of guessing.',
  f2:'Traceable restocking',f2d:'Recommendations explain reorder points, lead time, pack sizes and shelf life in plain words.',
  f3:'Team roles',f3d:'Owners, managers, warehouse staff and suppliers each see and do only what their role allows.',
  f4:'AI copilot in English & Arabic',f4d:'Ask about stockout risk, restock budget or pricing — answers are grounded in your numbers.',
  demoBadge:'Demo data — sample products, not your business',
  dashboard:'Dashboard',inventory:'Inventory',restock:'Restock',orders:'Purchase orders',forecast:'Forecast',notifications:'Notifications',data:'Backup',team:'Team',copilot:'AI copilot',
  products:'Products',lowStock:'Low stock',outStock:'Out of stock',stockValue:'Stock value',openOrders:'Open orders',
  name:'Name',sku:'SKU',category:'Category',stock:'Stock',min:'Min',price:'Price',cost:'Cost',status:'Status',actions:'Actions',
  inStock:'In stock',addProduct:'Add product',recordSale:'Record sale',qty:'Quantity',save:'Save',cancel:'Cancel',
  recommended:'Recommended order',noAction:'No order needed',review:'Review manually',noForecast:'Not enough history',createPO:'Create purchase request',
  approve:'Approve',receive:'Mark received',supplier:'Supplier',date:'Date',
  method:'Method',accuracy:'Measured error (daily WAPE)',next14:'Expected demand, next 14 days',notMeasured:'Accuracy not yet measurable',
  markRead:'Mark all read',noNotifications:'Nothing new.',
  exportBackup:'Download backup',restoreBackup:'Restore from backup',restoreConfirm:'Replace current data with this backup?',
  invite:'Invite',email:'Email',role:'Role',inviteLink:'Share this invite link',
  head:'Owner',manager:'Manager',warehouse:'Warehouse',supplierRole:'Supplier',
  workspaceDemo:'Demo workspace',useReal:'Use my business',useDemo:'Switch to demo',createWs:'Create my business workspace',noWs:'You don’t have a business workspace yet.',
  signInTitle:'Welcome to Inventra',password:'Password',google:'Continue with Google',haveAccount:'Already have an account? Sign in',noAccount:'New here? Create an account',checkEmail:'Check your email to confirm your account.',
  askPlaceholder:'Ask about stock, restock budget, pricing…',ask:'Ask',thinking:'Thinking…',
  q1:'Which products risk running out in 14 days?',q2:'What restock budget do I need?',q3:'Any pricing issues?',
  readOnly:'Your role can view but not change this.',lang:'العربية',footer:'Forecasts are estimates from your own history, never guarantees.',
};
type Dict=typeof en;
const ar:Dict={
  tagline:'ذكاء المخزون الذي يوضّح طريقة عمله',
  heroTitle:'اعرف ماذا تعيد طلبه، ومتى، ولماذا.',
  heroSub:'يتنبأ Inventra بالطلب من مبيعاتك المؤرخة، ويقيس دقته بنفسه، ثم يحوّلها إلى توصيات إعادة تخزين يمكنك تتبعها سطرًا بسطر.',
  tryDemo:'جرّب النسخة التجريبية',signIn:'تسجيل الدخول',signUp:'إنشاء حساب',signOut:'تسجيل الخروج',openApp:'فتح التطبيق',
  f1:'توقعات صادقة',f1d:'كل توقع يُختبر على السجل الفعلي للمنتج. إن كانت البيانات قليلة يخبرك بذلك بدل التخمين.',
  f2:'إعادة تخزين قابلة للتتبع',f2d:'التوصيات تشرح نقطة إعادة الطلب ومدة التوريد وحجم العبوة ومدة الصلاحية بكلمات واضحة.',
  f3:'أدوار الفريق',f3d:'المالك والمدير وموظفو المستودع والموردون؛ كلٌّ يرى ويفعل ما يسمح به دوره فقط.',
  f4:'مساعد ذكي بالعربية والإنجليزية',f4d:'اسأل عن خطر النفاد أو ميزانية الشراء أو الأسعار؛ الإجابات مبنية على أرقامك.',
  demoBadge:'بيانات تجريبية — منتجات نموذجية وليست بيانات عملك',
  dashboard:'لوحة التحكم',inventory:'المخزون',restock:'إعادة التخزين',orders:'أوامر الشراء',forecast:'التوقعات',notifications:'الإشعارات',data:'النسخ الاحتياطي',team:'الفريق',copilot:'المساعد الذكي',
  products:'المنتجات',lowStock:'مخزون منخفض',outStock:'نفد المخزون',stockValue:'قيمة المخزون',openOrders:'أوامر مفتوحة',
  name:'الاسم',sku:'رمز المنتج',category:'الفئة',stock:'المخزون',min:'الحد الأدنى',price:'السعر',cost:'التكلفة',status:'الحالة',actions:'إجراءات',
  inStock:'متوفر',addProduct:'إضافة منتج',recordSale:'تسجيل بيع',qty:'الكمية',save:'حفظ',cancel:'إلغاء',
  recommended:'الطلب المقترح',noAction:'لا حاجة للطلب',review:'مراجعة يدوية',noForecast:'السجل غير كافٍ',createPO:'إنشاء طلب شراء',
  approve:'موافقة',receive:'تم الاستلام',supplier:'المورد',date:'التاريخ',
  method:'الطريقة',accuracy:'الخطأ المقاس (WAPE يومي)',next14:'الطلب المتوقع خلال 14 يومًا',notMeasured:'الدقة غير قابلة للقياس بعد',
  markRead:'تحديد الكل كمقروء',noNotifications:'لا جديد.',
  exportBackup:'تنزيل نسخة احتياطية',restoreBackup:'الاستعادة من نسخة احتياطية',restoreConfirm:'استبدال البيانات الحالية بهذه النسخة؟',
  invite:'دعوة',email:'البريد الإلكتروني',role:'الدور',inviteLink:'شارك رابط الدعوة هذا',
  head:'المالك',manager:'مدير',warehouse:'المستودع',supplierRole:'مورد',
  workspaceDemo:'مساحة تجريبية',useReal:'استخدم بيانات عملي',useDemo:'التبديل إلى التجربة',createWs:'إنشاء مساحة عملي',noWs:'ليس لديك مساحة عمل بعد.',
  signInTitle:'مرحبًا بك في Inventra',password:'كلمة المرور',google:'المتابعة باستخدام Google',haveAccount:'لديك حساب؟ سجّل الدخول',noAccount:'جديد هنا؟ أنشئ حسابًا',checkEmail:'تحقق من بريدك لتأكيد حسابك.',
  askPlaceholder:'اسأل عن المخزون أو ميزانية الشراء أو الأسعار…',ask:'اسأل',thinking:'جارٍ التفكير…',
  q1:'ما المنتجات المعرضة للنفاد خلال 14 يومًا؟',q2:'ما ميزانية إعادة التخزين المطلوبة؟',q3:'هل توجد مشكلات في التسعير؟',
  readOnly:'دورك يسمح بالعرض فقط.',lang:'English',footer:'التوقعات تقديرات من سجلك، وليست ضمانات.',
};
const dicts={en,ar};
const Ctx=createContext<{lang:Lang;setLang:(l:Lang)=>void;t:(k:keyof Dict)=>string}>({lang:'en',setLang:()=>{},t:k=>en[k]});
export function LangProvider({children}:{children:ReactNode}){
  const [lang,setLangState]=useState<Lang>('en');
  useEffect(()=>{const s=localStorage.getItem('inventra-lang');if(s==='ar'||s==='en')setLangState(s);},[]);
  useEffect(()=>{document.documentElement.lang=lang;document.documentElement.dir=lang==='ar'?'rtl':'ltr';},[lang]);
  const setLang=(l:Lang)=>{setLangState(l);localStorage.setItem('inventra-lang',l);};
  return <Ctx.Provider value={{lang,setLang,t:k=>dicts[lang][k]}}>{children}</Ctx.Provider>;
}
export const useT=()=>useContext(Ctx);
export function LangToggle(){const {lang,setLang,t}=useT();return <button type="button" onClick={()=>setLang(lang==='ar'?'en':'ar')} className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent">{t('lang')}</button>;}
