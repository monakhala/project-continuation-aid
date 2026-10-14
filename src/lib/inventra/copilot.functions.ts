import {createServerFn} from '@tanstack/react-start';

// Public on purpose: the copilot only sees the summary the browser sends (demo or the user's own numbers) and returns text.
export const askCopilot=createServerFn({method:'POST'})
  .inputValidator((i:{question:string;lang:'en'|'ar';summary:string})=>{
    if(typeof i?.question!=='string'||i.question.length>1000||typeof i.summary!=='string'||i.summary.length>20000)throw new Error('Invalid request');
    return {question:i.question,lang:i.lang==='ar'?'ar':'en' as const,summary:i.summary};
  })
  .handler(async({data})=>{
    const key=process.env.LOVABLE_API_KEY;if(!key)throw new Error('AI is not configured.');
    const sys=`You are Inventra's inventory copilot. Answer ONLY from the inventory summary provided. Never invent demand, prices or accuracy figures; if data is missing, say so. Be concise, use short bullet points. Reply in ${data.lang==='ar'?'Modern Standard Arabic':'English'}.`;
    const res=await fetch('https://ai.gateway.lovable.dev/v1/chat/completions',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({model:'google/gemini-3-flash-preview',messages:[{role:'system',content:sys},{role:'user',content:`Inventory summary (JSON):\n${data.summary}\n\nQuestion: ${data.question}`}]})});
    if(res.status===429)throw new Error(data.lang==='ar'?'طلبات كثيرة، حاول لاحقًا.':'Too many requests, try again shortly.');
    if(res.status===402)throw new Error(data.lang==='ar'?'نفد رصيد الذكاء الاصطناعي.':'AI credits exhausted.');
    if(!res.ok)throw new Error('AI request failed');
    const j=await res.json() as {choices?:{message?:{content?:string}}[]};
    return j.choices?.[0]?.message?.content??'';
  });
