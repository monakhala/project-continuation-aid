import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import C from './core';
import type { Json } from '@/integrations/supabase/types';
import type { WorkspaceData, Role } from './types';

export const loadWorkspace=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).handler(async({context})=>{
  const {data:roles,error}=await context.supabase.from('user_roles').select('workspace_id,role');if(error)throw new Error(error.message);
  const ids=roles?.map(r=>r.workspace_id)??[];
  if(!ids.length)return {workspaces:[],profile:(await context.supabase.from('profiles').select('display_name').eq('id',context.userId).maybeSingle()).data};
  const {data:workspaces,error:e}=await context.supabase.from('inventra_workspaces').select('*').in('id',ids);if(e)throw new Error(e.message);
  return {workspaces:(workspaces??[]).map(w=>({...w,role:roles?.find(r=>r.workspace_id===w.id)?.role??'supplier'})),profile:(await context.supabase.from('profiles').select('display_name').eq('id',context.userId).maybeSingle()).data};
});
export const createWorkspace=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).handler(async({context})=>{const {data,error}=await context.supabase.rpc('inventra_create_workspace');if(error)throw new Error(error.message);return data;});
export const saveWorkspace=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((input:{id:string;version:number;data:WorkspaceData;recovery:boolean})=>input).handler(async({data,context})=>{
  const v=C.validateData(data.data);if(v.errors.length)throw new Error(v.errors.join(' '));
  const clean=C.restoreData(data.data); // whitelist product fields and settings; keep audited import undo data separately
  clean.imports=data.data.imports;
  const {data:version,error}=await context.supabase.rpc('inventra_save_workspace',{w:data.id,expected_version:data.version,next_data:clean as Json,keep_recovery:data.recovery});if(error)throw new Error(error.message);return version;
});
export const inviteMember=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((input:{id:string;email:string;role:Role})=>input).handler(async({data,context})=>{const {data:token,error}=await context.supabase.rpc('inventra_invite',{w:data.id,invite_email:data.email,invite_role:data.role});if(error)throw new Error(error.message);return token;});
export const acceptInvite=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((input:{token:string})=>input).handler(async({data,context})=>{const {data:id,error}=await context.supabase.rpc('inventra_accept_invite',{invite_token:data.token});if(error)throw new Error(error.message);return id;});