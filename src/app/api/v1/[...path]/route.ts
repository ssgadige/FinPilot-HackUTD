import { createApi } from '../../../../server/api';
import { getServices } from '../../../../server/services';
export const runtime='nodejs';
export const dynamic='force-dynamic';
let handler:ReturnType<typeof createApi>|undefined;
async function handle(request:Request) {
  try {handler??=createApi(getServices());return await handler(request);}
  catch {return Response.json({error:{code:'service_unavailable',message:'Backend configuration or database is unavailable',request_id:crypto.randomUUID()}},{status:503,headers:{'cache-control':'no-store'}});}
}
export {handle as GET,handle as POST,handle as PATCH,handle as DELETE};
