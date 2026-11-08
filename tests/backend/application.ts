import { Auth } from '../../src/server/auth';
import { Simulator } from '../../src/server/simulator';
import { Finance } from '../../src/server/finance';
import { Planning } from '../../src/server/planning';
import { createApi, type Services } from '../../src/server/api';
import { fixture } from './fixtures';
export async function application(extra:Partial<Services>={}) {
  const f=fixture(),store=f.store,simulator=new Simulator(store),finance=new Finance(store),planning=new Planning(store);
  let code='';const auth=new Auth(store,{secret:'isolated-test-secret-'.repeat(3),appUrl:'http://localhost:3000',allowLocalHttp:true},{async send(_email,value){code=value;}});
  const sessions:ReturnType<Auth['verify']>[]=[];
  for(const credential of f.credentials.slice(0,2)) {
    const challenge=await auth.login(credential.email,credential.app_password,'test');sessions.push(auth.verify(challenge.challenge_id,code,challenge.pending));
  }
  const services:Services={store,simulator,finance,planning,auth,...extra},api=createApi(services);
  return {...f,auth,simulator,finance,planning,services,sessions,
    link(index=0) {
      return f.credentials[index].institutions.map((c:{institution_id:string;username:string;password:string})=>{
        const p=simulator.preview(`demo-0${index+1}`,c.institution_id,c.username,c.password);
        return simulator.connect(`demo-0${index+1}`,{preview_token:p.preview_token,account_ids:p.accounts.map(a=>a.id),consent_version:'v1',idempotency_key:'test-'+c.institution_id});
      });
    },
    async request(path:string,method='GET',body?:unknown,index=0,headers:Record<string,string>={}) {
      const session=sessions[index];const response=await api(new Request('http://localhost:3000/api/v1/'+path,{method,headers:{origin:'http://localhost:3000','content-type':'application/json',cookie:'fp_session='+session.session+'; fp_csrf='+session.csrf,'x-csrf-token':session.csrf,...headers},body:body===undefined?undefined:JSON.stringify(body)}));
      return {status:response.status,headers:response.headers,data:response.status===204?null:await response.json()};
    },
  };
}
