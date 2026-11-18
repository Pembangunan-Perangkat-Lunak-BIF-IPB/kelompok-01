import { useEffect, useState } from 'react';
import { getJob, getJobs, type JobItem } from '../services/api';
import { useAuth } from '../context/auth';

/** Existing M10 polling contract, shared without changing endpoints or scheduling. */
export function useJobPolling(jobId?:string){
 const {token}=useAuth();const [refresh,setRefresh]=useState(0);
 const [state,setState]=useState<{key:string;jobs:JobItem[];error:string;updated:string}>({key:'',jobs:[],error:'',updated:''});
 const key=(jobId??'all')+':'+refresh;
 const valid=!jobId||(/^[1-9]\d*$/.test(jobId)&&Number(jobId)<=2**31-1);
 useEffect(()=>{
  if(!token||!valid)return;
  const controller=new AbortController();let timer:ReturnType<typeof setTimeout>;
  const poll=async()=>{
   try{
    const jobs=jobId?[await getJob(jobId,token,controller.signal)]:await getJobs(token,controller.signal);
    if(!controller.signal.aborted)setState({key,jobs,error:'',updated:new Date().toLocaleTimeString('id-ID')});
   }catch(error){if(!controller.signal.aborted)setState(previous=>({key,jobs:previous.key===key?previous.jobs:[],updated:previous.key===key?previous.updated:'',error:error instanceof Error?error.message:'Status Job tidak dapat dimuat.'}));}
   finally{if(!controller.signal.aborted)timer=setTimeout(poll,4000);}
  };
  void poll();return()=>{controller.abort();clearTimeout(timer);};
 },[token,jobId,valid,key]);
 const loading=state.key!==key;
 return {jobs:loading?[]:state.jobs,error:loading?'':state.error,updated:state.updated,loading,valid,reload:()=>setRefresh(value=>value+1)};
}
