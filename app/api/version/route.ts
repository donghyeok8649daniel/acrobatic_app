import {APP_VERSION,APP_BUILD} from '../../../lib/app-version';
export const dynamic='force-dynamic';
export function GET(){return Response.json({version:APP_VERSION,build:APP_BUILD},{headers:{'Cache-Control':'no-store'}});}
