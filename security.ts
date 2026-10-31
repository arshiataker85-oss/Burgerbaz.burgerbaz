import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import { HTTPException } from 'hono/http-exception'
export function fail(message: string, status: any = 400): never { throw new HTTPException(status,{message}) }
export const random = () => Array.from(crypto.getRandomValues(new Uint8Array(32)), b=>b.toString(16).padStart(2,'0')).join('')
export async function digest(value: string) { return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),b=>b.toString(16).padStart(2,'0')).join('') }
export async function hashPassword(password: string, salt = random()) {
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits'])
 const bytes=await crypto.subtle.deriveBits({name:'PBKDF2',salt:new TextEncoder().encode(salt),iterations:100000,hash:'SHA-256'},key,256)
 return `pbkdf2-sha256$100000$${salt}$${Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('')}`
}
export function equal(a: string,b: string) { let d=a.length^b.length; for(let i=0;i<Math.max(a.length,b.length);i++)d|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0); return d===0 }
export async function verify(password: string, hash: string) { return equal(await hashPassword(password,hash.split('$')[2]),hash) }
export async function session(c: any) {
 const token=getCookie(c,'bb_session'); if(!token || !/^[a-f0-9]{64}$/.test(token)) return null
 return c.env.DB.prepare('SELECT s.token_hash,s.csrf,s.expires_at,a.id,a.email FROM sessions s JOIN admins a ON a.id=s.admin_id WHERE token_hash=? AND expires_at>?').bind(await digest(token),Date.now()).first()
}
export async function newSession(c: any,id: string) {
 const token=random(),csrf=random(); await c.env.DB.prepare('DELETE FROM sessions WHERE expires_at<?').bind(Date.now()).run()
 await c.env.DB.prepare('INSERT INTO sessions(token_hash,admin_id,csrf,expires_at) VALUES(?,?,?,?)').bind(await digest(token),id,csrf,Date.now()+8*3600000).run()
 setCookie(c,'bb_session',token,{httpOnly:true,secure:true,sameSite:'Strict',path:'/',maxAge:8*3600})
 return csrf
}
export async function logout(c:any) { const token=getCookie(c,'bb_session'); if(token) await c.env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await digest(token)).run(); deleteCookie(c,'bb_session',{path:'/'}) }
export async function limited(c:any,scope:string,max=8) {
 const ip=c.req.header('cf-connecting-ip')||'local'; const key=await digest(scope+ip); const now=Date.now()
 const result=await c.env.DB.prepare('INSERT INTO rate_limits(key,attempts,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN expires_at<? THEN 1 ELSE attempts+1 END, expires_at=CASE WHEN expires_at<? THEN excluded.expires_at ELSE expires_at END RETURNING attempts').bind(key,now+900000,now,now).first()
 if(result.attempts>max) fail('تلاش‌های زیادی انجام شده است. ۱۵ دقیقه دیگر دوباره امتحان کنید.',429)
}
export function sameOrigin(c:any) {
 const origin=c.req.header('origin'); if(!origin || origin!==new URL(c.req.url).origin) fail('مبدأ درخواست معتبر نیست.',403)
}
export async function authorized(c:any,next:any) {
 const s=await session(c); if(!s) return c.json({error:'برای ادامه وارد حساب مدیریت شوید.'},401)
 c.set('admin',s)
 if(!['GET','HEAD','OPTIONS'].includes(c.req.method)) {
  sameOrigin(c)
  if(!equal(c.req.header('x-csrf-token')||'',s.csrf)) fail('نشست درخواست معتبر نیست. صفحه را تازه‌سازی کنید.',403)
 }
 await next()
}
