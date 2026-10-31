import { Hono } from 'hono'
import { serveStatic } from 'hono/cloudflare-workers'
import { HTTPException } from 'hono/http-exception'
import { bodyLimit } from 'hono/body-limit'
import { authorized,session,sameOrigin,limited,hashPassword,verify,digest,equal,newSession,logout,fail } from './security'
import { validate,text,adminRow,publicData,servingOptions } from './data'
import { menuPage,adminPage,loginPage } from './views'
const app=new Hono<any>()
app.use('*',async(c,next)=>{await next();c.header('X-Content-Type-Options','nosniff');c.header('Referrer-Policy','same-origin');c.header('X-Frame-Options','SAMEORIGIN');c.header('Permissions-Policy','camera=(), microphone=(), geolocation=()');c.header('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; frame-src 'self'; frame-ancestors 'self'; base-uri 'self'; form-action 'self'");if(c.req.path.startsWith('/api/')||c.req.path.startsWith('/admin'))c.header('Cache-Control','no-store')})
app.use('/api/*',bodyLimit({maxSize:6*1024*1024,onError:c=>c.json({error:'حجم فایل بیش از حد مجاز است.'},413)}))
app.use('/static/*',serveStatic({root:'./public'}))
app.onError((err,c)=>{if(err instanceof HTTPException)return c.json({error:err.message},err.status);if(err instanceof SyntaxError)return c.json({error:'ساختار درخواست معتبر نیست.'},400);if(String(err).includes('UNIQUE constraint'))return c.json({error:'این نامک یا ایمیل قبلاً استفاده شده است.'},409);console.error(err);return c.json({error:'خطای داخلی؛ دوباره تلاش کنید.'},500)})
const json=async(c:any)=>{if(!c.req.header('content-type')?.includes('application/json'))fail('درخواست JSON لازم است.',415);const b=await c.req.json();if(!b||typeof b!=='object')fail('داده معتبر نیست.');return b}
app.get('/api/menu',async c=>c.json(await publicData(c.env.DB)))
app.get('/api/items/:slug',async c=>{const d=await publicData(c.env.DB);const p=d.items.find((i:any)=>i.slug===c.req.param('slug'));return p?c.json(p):c.json({error:'یافت نشد'},404)})
app.get('/',async c=>c.html(menuPage(await publicData(c.env.DB))))
app.get('/menu',c=>c.redirect('/'))
app.get('/category/:slug',async c=>{const d=await publicData(c.env.DB);const cat=d.categories.find((x:any)=>x.slug===c.req.param('slug'));if(!cat)return c.notFound();return c.html(menuPage({...d,categories:[cat],items:d.items.filter((i:any)=>i.categoryId===cat.id)},false))})
app.get('/item/:slug',async c=>{const d=await publicData(c.env.DB);const item=d.items.find((p:any)=>p.slug===c.req.param('slug'));if(!item)return c.notFound();return c.html(menuPage(d,false,item))})
app.get('/admin/login',async c=>{if(await session(c))return c.redirect('/admin');const exists=await c.env.DB.prepare('SELECT id FROM admins LIMIT 1').first();return c.html(loginPage(!exists))})
app.get('/admin',async c=>{if(!await session(c))return c.redirect('/admin/login');return c.html(adminPage())})
app.get('/admin/preview',async c=>{if(!await session(c))return c.redirect('/admin/login');return c.html(menuPage(await publicData(c.env.DB,true),true))})
app.post('/api/auth/setup',async c=>{
 sameOrigin(c);await limited(c,'setup',5);const b=await json(c)
 if(!c.env.BOOTSTRAP_TOKEN||!equal(await digest(String(b.setupToken||'')),await digest(c.env.BOOTSTRAP_TOKEN)))fail('کلید راه‌اندازی معتبر نیست.',403)
 const email=text(b.email,254,true).toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))fail('ایمیل معتبر نیست.')
 const password=text(b.password,128,true);if(password.length<12)fail('رمز عبور حداقل ۱۲ نویسه داشته باشد.')
 const id=crypto.randomUUID();const result=await c.env.DB.prepare("INSERT INTO admins(id,email,password_hash) SELECT ?,?,? WHERE NOT EXISTS(SELECT 1 FROM admins)").bind(id,email,await hashPassword(password)).run()
 if(!result.meta.changes)fail('حساب مدیریت قبلاً ایجاد شده است.',409)
 return c.json({ok:true,csrf:await newSession(c,id)})
})
app.post('/api/auth/login',async c=>{
 sameOrigin(c);await limited(c,'login');const b=await json(c);const email=text(b.email,254,true).toLowerCase(),password=text(b.password,128,true)
 const a=await c.env.DB.prepare('SELECT * FROM admins WHERE email=?').bind(email).first()
 const hash=a?.password_hash||'pbkdf2-sha256$100000$0000000000000000000000000000000000000000000000000000000000000000$0000000000000000000000000000000000000000000000000000000000000000'
 if(!await verify(password,hash)||!a)fail('ایمیل یا رمز عبور نادرست است.',401)
 return c.json({ok:true,csrf:await newSession(c,a.id)})
})
app.use('/api/admin/*',authorized)
app.get('/api/admin/me',c=>c.json({email:c.get('admin').email,csrf:c.get('admin').csrf}))
app.post('/api/admin/logout',async c=>{await logout(c);return c.json({ok:true})})
app.post('/api/admin/password',async c=>{const b=await json(c);const a=await c.env.DB.prepare('SELECT password_hash FROM admins WHERE id=?').bind(c.get('admin').id).first();const old=text(b.currentPassword,128,true),pw=text(b.password,128,true);if(pw.length<12)fail('رمز عبور حداقل ۱۲ نویسه داشته باشد.');if(!await verify(old,a.password_hash))fail('رمز فعلی نادرست است.',403);await c.env.DB.batch([c.env.DB.prepare('UPDATE admins SET password_hash=? WHERE id=?').bind(await hashPassword(pw),c.get('admin').id),c.env.DB.prepare('DELETE FROM sessions WHERE admin_id=?').bind(c.get('admin').id)]);await logout(c);return c.json({ok:true})})
app.get('/api/admin/content',async c=>{
 const [categories,items,s,m]=await Promise.all([c.env.DB.prepare('SELECT * FROM categories').all(),c.env.DB.prepare('SELECT * FROM items').all(),c.env.DB.prepare('SELECT * FROM settings WHERE id=1').first(),c.env.DB.prepare('SELECT * FROM media ORDER BY created_at DESC').all()])
 return c.json({categories:categories.results.map(adminRow).sort((a:any,b:any)=>a.sortOrder-b.sortOrder),items:items.results.map(adminRow).sort((a:any,b:any)=>a.sortOrder-b.sortOrder),settings:adminRow(s),media:m.results.map((r:any)=>({...r,url:'/media/'+r.key}))})
})
app.get('/api/admin/export',async c=>{const [categories,items,settings,media]=await Promise.all(['categories','items','settings','media'].map(t=>c.env.DB.prepare(`SELECT * FROM ${t}`).all()));c.header('Content-Disposition','attachment; filename="burgerbaz-content.json"');return c.json({formatVersion:1,exportedAt:new Date().toISOString(),categories:categories.results,items:items.results,settings:settings.results,media:media.results})})
const kindOf=(c:any)=>{const kind=c.req.param('kind');if(!['items','categories','settings'].includes(kind))fail('بخش پیدا نشد.',404);return kind}
app.post('/api/admin/content/:kind',async c=>{
 const kind=kindOf(c);if(kind==='settings')fail('تنظیمات از قبل موجود است.');const b=await json(c),d:any=validate(kind,b.data);if(!['draft','publish'].includes(b.action))fail('عملیات معتبر نیست.')
 if(kind==='items'&&!await c.env.DB.prepare('SELECT id FROM categories WHERE id=?').bind(d.categoryId).first())fail('دسته‌بندی موجود نیست.')
 const id=crypto.randomUUID(),data=JSON.stringify(d),pub=b.action==='publish'?data:null
 if(kind==='items')await c.env.DB.prepare('INSERT INTO items(id,category_id,slug,draft,published) VALUES(?,?,?,?,?)').bind(id,d.categoryId,d.slug,data,pub).run()
 else await c.env.DB.prepare('INSERT INTO categories(id,slug,draft,published) VALUES(?,?,?,?)').bind(id,d.slug,data,pub).run()
 return c.json({ok:true,id},201)
})
app.put('/api/admin/content/:kind/:id',async c=>{
 const kind=kindOf(c),id=c.req.param('id'),b=await json(c),d:any=validate(kind,b.data)
 if(!Number.isInteger(b.version)||!['draft','publish','hide'].includes(b.action))fail('نسخه یا عملیات معتبر نیست.')
 if(kind==='settings'&&b.action==='hide')fail('تنظیمات قابل مخفی‌سازی نیست.')
 if(kind==='items'&&!await c.env.DB.prepare('SELECT id FROM categories WHERE id=?').bind(d.categoryId).first())fail('دسته‌بندی موجود نیست.')
 const current=await c.env.DB.prepare(`SELECT * FROM ${kind} WHERE id=?`).bind(id).first();if(!current)fail('مورد پیدا نشد.',404)
 if(kind==='items'&&b.data.servingOptions===undefined)d.servingOptions=servingOptions(JSON.parse(current.draft).servingOptions)
 const data=JSON.stringify(d),pub=b.action==='publish'?data:b.action==='hide'?null:current.published
 const extra=kind==='items'?',category_id=?,slug=?':kind==='categories'?',slug=?':''
 const values:any[]=[data,pub];if(kind==='items')values.push(d.categoryId,d.slug);if(kind==='categories')values.push(d.slug);values.push(id,b.version)
 const result=await c.env.DB.prepare(`UPDATE ${kind} SET draft=?,published=?,version=version+1,updated_at=CURRENT_TIMESTAMP${extra} WHERE id=? AND version=?`).bind(...values).run()
 if(!result.meta.changes)fail('محتوا در پنجره دیگری تغییر کرده است. صفحه را تازه‌سازی کنید.',409)
 return c.json({ok:true,version:b.version+1})
})
app.delete('/api/admin/content/:kind/:id',async c=>{
 const kind=kindOf(c),id=c.req.param('id');if(kind==='settings')fail('تنظیمات قابل حذف نیست.')
 const b=await json(c);if(!Number.isInteger(b.version))fail('نسخه معتبر نیست.')
 if(kind==='categories') {const used=await c.env.DB.prepare("SELECT id FROM items WHERE category_id=? OR json_extract(published,'$.categoryId')=? LIMIT 1").bind(id,id).first();if(used)fail('دسته‌بندی دارای آیتم است؛ ابتدا آیتم‌های پیش‌نویس و منتشرشده را منتقل یا حذف کنید.',409)}
 const result=await c.env.DB.prepare(`DELETE FROM ${kind} WHERE id=? AND version=?`).bind(id,b.version).run();if(!result.meta.changes)fail('محتوا تغییر کرده یا حذف شده است.',409)
 return c.json({ok:true})
})
app.post('/api/admin/reorder/:kind',async c=>{
 const kind=kindOf(c);if(kind==='settings')fail('عملیات معتبر نیست.');const b=await json(c)
 if(!Number.isInteger(b.version)||!Number.isInteger(b.targetVersion)||b.id===b.targetId)fail('درخواست جابه‌جایی معتبر نیست.')
 const rows=await c.env.DB.prepare(`SELECT id,draft,version FROM ${kind} WHERE id IN (?,?)`).bind(String(b.id),String(b.targetId)).all()
 if(rows.results.length!==2)fail('محتوا پیدا نشد.',404)
 const a=rows.results.find((r:any)=>r.id===b.id),t=rows.results.find((r:any)=>r.id===b.targetId),ad=JSON.parse(a.draft),td=JSON.parse(t.draft)
 if(kind==='items'&&ad.categoryId!==td.categoryId)fail('جابه‌جایی فقط در یک دسته مجاز است.')
 const result=await c.env.DB.prepare(`UPDATE ${kind} SET draft=json_set(draft,'$.sortOrder',CASE id WHEN ? THEN ? ELSE ? END),published=CASE WHEN published IS NULL THEN NULL ELSE json_set(published,'$.sortOrder',CASE id WHEN ? THEN ? ELSE ? END) END,version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id IN (?,?) AND (SELECT COUNT(*) FROM ${kind} WHERE (id=? AND version=?) OR (id=? AND version=?))=2`).bind(b.id,td.sortOrder,ad.sortOrder,b.id,td.sortOrder,ad.sortOrder,b.id,b.targetId,b.id,b.version,b.targetId,b.targetVersion).run()
 if(result.meta.changes!==2)fail('محتوا تغییر کرده است. صفحه را تازه‌سازی کنید.',409)
 return c.json({ok:true})
})
async function mediaUsed(db:any,key:string,publishedOnly=false) {
 if(publishedOnly){const d=await publicData(db);const url='/media/'+key;return d.settings.logoUrl===url||d.settings.heroImageUrl===url||d.categories.some((x:any)=>x.imageUrl===url)||d.items.some((x:any)=>x.imageUrl===url)}
 const needle='%/media/'+key+'%';const fields=publishedOnly?'published LIKE ?':'published LIKE ? OR draft LIKE ?';const args=publishedOnly?[needle]:[needle,needle]
 for(const t of ['items','categories','settings'])if(await db.prepare(`SELECT id FROM ${t} WHERE ${fields} LIMIT 1`).bind(...args).first())return true
 return false
}
app.get('/media/:key',async c=>{const key=c.req.param('key');if(!/^[a-f0-9-]+\.(webp|jpg|png)$/.test(key))return c.notFound();if(!await mediaUsed(c.env.DB,key,true)&&!await session(c))return c.notFound();const object=await c.env.MEDIA.get(key);if(!object)return c.notFound();return new Response(object.body,{headers:{'Content-Type':object.httpMetadata?.contentType||'application/octet-stream','Cache-Control':'private, max-age=0, must-revalidate','X-Content-Type-Options':'nosniff'}})})
app.post('/api/admin/media',async c=>{
 const b=await c.req.parseBody();const f=b.file;if(!(f instanceof File))fail('فایل تصویر لازم است.');if(f.size>5*1024*1024||f.size<12)fail('حداکثر اندازه تصویر ۵ مگابایت است.')
 const bytes=new Uint8Array(await f.arrayBuffer());let ext='',type='';
 if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255){ext='jpg';type='image/jpeg'}
 else if([137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v)){ext='png';type='image/png'}
 else if(new TextDecoder().decode(bytes.slice(0,4))==='RIFF'&&new TextDecoder().decode(bytes.slice(8,12))==='WEBP'){ext='webp';type='image/webp'}
 else fail('فقط تصاویر معتبر JPEG، PNG یا WebP پذیرفته می‌شوند.')
 if(f.type!==type)fail('محتوای فایل با نوع آن مطابقت ندارد.')
 const alt=text(b.alt||'',250),name=text(f.name,180,true),id=crypto.randomUUID(),key=id+'.'+ext
 await c.env.MEDIA.put(key,bytes,{httpMetadata:{contentType:type}})
 try {await c.env.DB.prepare('INSERT INTO media(id,key,name,type,size,alt) VALUES(?,?,?,?,?,?)').bind(id,key,name,type,f.size,alt).run()} catch(e){await c.env.MEDIA.delete(key);throw e}
 return c.json({id,key,url:'/media/'+key,alt},201)
})
app.put('/api/admin/media/:id',async c=>{const b=await json(c);const r=await c.env.DB.prepare('UPDATE media SET alt=? WHERE id=?').bind(text(b.alt,250),c.req.param('id')).run();if(!r.meta.changes)fail('تصویر یافت نشد.',404);return c.json({ok:true})})
app.delete('/api/admin/media/:id',async c=>{const r=await c.env.DB.prepare('SELECT * FROM media WHERE id=?').bind(c.req.param('id')).first();if(!r)fail('تصویر یافت نشد.',404);if(await mediaUsed(c.env.DB,r.key))fail('این تصویر در محتوا استفاده شده است. ابتدا آن را جایگزین کنید.',409);await c.env.MEDIA.delete(r.key);await c.env.DB.prepare('DELETE FROM media WHERE id=?').bind(r.id).run();return c.json({ok:true})})
app.notFound(c=>c.req.path.startsWith('/api/')?c.json({error:'یافت نشد'},404):c.html('<html lang="fa" dir="rtl"><meta charset="utf-8"><title>یافت نشد</title><h1>صفحه پیدا نشد</h1><a href="/">بازگشت به منو</a></html>',404))
export default app
