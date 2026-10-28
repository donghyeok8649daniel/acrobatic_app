const encoder=new TextEncoder();
const hex=(bytes:ArrayBuffer|Uint8Array)=>Array.from(new Uint8Array(bytes)).map(v=>v.toString(16).padStart(2,'0')).join('');
export const normalizeEmail=(value:unknown)=>typeof value==='string'?value.trim().toLowerCase():'';
export const isKaistEmail=(value:string)=>/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@(?:[a-z0-9-]+\.)?kaist\.ac\.kr$/.test(value)&&value.length<=254;
export function equalSecret(a:string,b:string){if(a.length!==b.length)return false;let different=0;for(let i=0;i<a.length;i++)different|=a.charCodeAt(i)^b.charCodeAt(i);return different===0;}
export async function passwordHash(password:string,pepper:string,salt=hex(crypto.getRandomValues(new Uint8Array(16)))){
 if(!pepper)throw Error('로그인 설정을 확인해주세요.');
 const secret=await crypto.subtle.importKey('raw',encoder.encode(pepper),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const prepared=await crypto.subtle.sign('HMAC',secret,encoder.encode(password));
 const key=await crypto.subtle.importKey('raw',prepared,'PBKDF2',false,['deriveBits']);
 const result=await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:encoder.encode(salt),iterations:100000},key,256);
 return `pbkdf2-sha256$100000$${salt}$${hex(result)}`;
}
export async function verifyPassword(password:string,stored:string,pepper:string){const parts=stored.split('$');if(parts.length!==4||parts[0]!=='pbkdf2-sha256'||parts[1]!=='100000')return false;return equalSecret(await passwordHash(password,pepper,parts[2]),stored);}
export function validateNewPassword(password:unknown){if(typeof password!=='string'||password.length<10||password.length>128||/^\d{8}$/.test(password))throw Error('새 비밀번호는 10~128자로 입력해주세요. 학번은 사용할 수 없습니다.');return password;}
