import {createServerFn} from '@tanstack/react-start';
import {requireSupabaseAuth} from '@/integrations/supabase/auth-middleware';

export const askCopilot=createServerFn({method:'POST'})
  .middleware([requireSupabaseAuth])
  .inputValidator((i:{question:string;lang:'en'|'ar';summary:string})=>{
    if(typeof i?.question!=='string'||!i.question.trim()||i.question.length>1000||typeof i.summary!=='string'||i.summary.length>20000)throw new Error('Invalid request');
    return {question:i.question,lang:(i.lang==='ar'?'ar':'en') as 'en'|'ar',summary:i.summary};
  })
  .handler(async({data})=>{
    const key=process.env['LOVABLE_API_KEY'];if(!key)throw new Error('AI is not configured.');
    const ar=data.lang==='ar';
    const sys=`You are Inventra's inventory copilot. Answer ONLY from the inventory summary provided. Never invent demand, prices or accuracy figures; if data is missing, say so. Be concise, use short bullet points, plain text (no markdown tables). Reply in ${ar?'Modern Standard Arabic':'English'}.`;
    const res=await fetch('https://ai.gateway.lovable.dev/v1/responses',{method:'POST',headers:{'Lovable-API-Key':key,'Content-Type':'application/json','X-Lovable-AIG-SDK':'fetch'},body:JSON.stringify({model:'openai/gpt-6-astra',stream:true,store:false,reasoning:{effort:'low'},instructions:sys,input:`Inventory summary (JSON):\n${data.summary}\n\nQuestion: ${data.question}`})});
    if(res.status===429)throw new Error(ar?'طلبات كثيرة، حاول لاحقًا.':'Too many requests, try again shortly.');
    if(res.status===402)throw new Error(ar?'نفد رصيد الذكاء الاصطناعي.':'AI credits exhausted.');
    if(!res.ok||!res.body)throw new Error(ar?'تعذّر الحصول على إجابة.':'AI request failed.');
    const reader=res.body.getReader(),dec=new TextDecoder();let buf='',out='';
    for(;;){const {done,value}=await reader.read();if(done)break;buf+=dec.decode(value,{stream:true});let i;
      while((i=buf.indexOf('\n'))>=0){const line=buf.slice(0,i).trim();buf=buf.slice(i+1);if(!line.startsWith('data:'))continue;const p=line.slice(5).trim();if(p==='[DONE]')continue;
        try{const e=JSON.parse(p) as {type?:string;delta?:string};if(e.type==='response.output_text.delta'&&e.delta)out+=e.delta;}catch{/* partial */}}}
    return out||(ar?'لا توجد إجابة.':'No answer.');
  });
