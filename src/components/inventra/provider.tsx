import {createContext,useContext,useState,useEffect,useRef,type ReactNode} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {useRouter} from '@tanstack/react-router';
import {useServerFn} from '@tanstack/react-start';
import type {Session} from '@supabase/supabase-js';
import {supabase} from '@/integrations/supabase/client';
import {loadWorkspace,saveWorkspace,createWorkspace} from '@/lib/inventra/workspace.functions';
import {demoData,emptyData} from '@/lib/inventra/data';
import type {WorkspaceData,Role} from '@/lib/inventra/types';
import C from '@/lib/inventra/core';
import {toast} from 'sonner';

interface AppContextValue {session:Session|null; authReady:boolean; demo:boolean; setDemo:(v:boolean)=>void; data:WorkspaceData; role:Role; busy:boolean; loading:boolean; error:string|null; name:string; workspaceId:string|null; selectedId:string|null; selectWorkspace:(id:string)=>void; workspaces:{id:string;name:string}[]; recovery:WorkspaceData|null; commit:(fn:(d:WorkspaceData)=>void,recovery?:boolean)=>Promise<boolean>; initialize:()=>Promise<void>; refresh:()=>void}
const AppContext=createContext<AppContextValue|null>(null);
export const useInventra=()=>{const c=useContext(AppContext);if(!c)throw new Error('Inventra provider missing');return c;};
export function InventraProvider({children}:{children:ReactNode}){
  const [session,setSession]=useState<Session|null>(null),[authReady,setAuthReady]=useState(false),[demo,setDemo]=useState(true),[demoState,setDemoState]=useState<WorkspaceData>(emptyData),[busy,setBusy]=useState(false),[selectedId,selectWorkspace]=useState<string|null>(null);
  const queryClient=useQueryClient(),router=useRouter();
  useEffect(()=>{setDemoState(demoData());supabase.auth.getSession().then(({data})=>{setSession(data.session);setAuthReady(true);});const {data}=supabase.auth.onAuthStateChange((event,s)=>{setSession(s);setAuthReady(true);if(event==='SIGNED_OUT'){queryClient.clear();selectWorkspace(null);}if(['SIGNED_IN','SIGNED_OUT','USER_UPDATED'].includes(event)){void router.invalidate();if(event!=='SIGNED_OUT')void queryClient.invalidateQueries();}});return()=>data.subscription.unsubscribe();},[queryClient,router]);
  const fetch=useServerFn(loadWorkspace),save=useServerFn(saveWorkspace),create=useServerFn(createWorkspace);
  const q=useQuery({queryKey:['workspace',session?.user.id],queryFn:()=>fetch(),enabled:!!session&&!demo});
  const workspace=q.data?.workspaces.find(w=>w.id===selectedId)??q.data?.workspaces[0];
  const saved=workspace?.data as unknown as WorkspaceData|undefined;
  const data=demo?demoState:saved??emptyData();
  const lock=useRef(false);
  async function commit(fn:(d:WorkspaceData)=>void,recovery=false){if(lock.current)return false;lock.current=true;setBusy(true);try{const next=structuredClone(data);fn(next);const valid=C.validateData(next);if(valid.errors.length)throw new Error(valid.errors.join(' '));if(demo)setDemoState(next);else{if(!workspace)throw new Error('Create a business workspace first.');await save({data:{id:workspace.id,version:workspace.version,data:next,recovery}});await q.refetch();}return true;}catch(e){toast.error(e instanceof Error?e.message:'Could not save. Nothing was changed.');return false;}finally{lock.current=false;setBusy(false);}}
  async function initialize(){setBusy(true);try{await create();await q.refetch();}catch(e){toast.error(e instanceof Error?e.message:'Could not create workspace.');}finally{setBusy(false);}}
  return <AppContext.Provider value={{session,authReady,demo,setDemo,data,role:demo?'head':workspace?.role??'supplier',busy,loading:!demo&&!!session&&q.isPending,error:q.error?.message??null,name:demo?'Demo workspace':workspace?.name??'Business workspace',workspaceId:workspace?.id??null,selectedId,selectWorkspace,workspaces:q.data?.workspaces.map(w=>({id:w.id,name:w.name}))??[],recovery:(workspace?.recovery as unknown as WorkspaceData|null)??null,commit,initialize,refresh:()=>{void q.refetch();}}}>{children}</AppContext.Provider>;
}