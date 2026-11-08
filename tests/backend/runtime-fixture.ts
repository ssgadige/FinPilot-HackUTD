import type { complete,Message } from '../../src/server/nemotron/index';
export function testInference(observe?:(messages:Message[])=>void):typeof complete {
  return async(_config,messages,tools)=>{
    observe?.(messages);
    if(tools?.length)return {message:{role:'assistant',content:null,tool_calls:tools.slice(0,3).map((t,index)=>({id:'call-'+messages.length+'-'+index,type:'function',function:{name:t.function.name,arguments:JSON.stringify({scope:'snapshot'})}}))},latencyMs:0};
    const system=messages.find(m=>m.role==='system')!.content!,role=/Your agent_id is ([\w-]+)/.exec(system)![1],version=Number(/snapshot_version is (\d+)/.exec(system)![1]);
    const outputs=messages.filter(m=>m.role==='tool').map(m=>JSON.parse(m.content!)),ids=[...new Set(outputs.flatMap(o=>o.evidence.map((e:{id:string})=>e.id)))];
    const missing=outputs.some(o=>o.needsInformation===true);
    const recommended=outputs.find(o=>o.data?.recommended)?.data.recommended??[];
    return {message:{role:'assistant',content:JSON.stringify({agent_id:role,status:missing?'needs_information':'completed',headline:'Deterministic test inference',findings:[],evidence_ids:ids,assumptions:[],missing_data:missing?['Additional user information required']:[],proposed_actions:[],snapshot_version:version,...(role==='coordinator'?{selected_specialists:recommended}:{})})},latencyMs:0};
  };
}
export const testConfig=()=>({apiKey:'local-test-provider-value',model:'nvidia/nemotron-test',baseUrl:'https://integrate.api.nvidia.com/v1',timeoutMs:1000});
