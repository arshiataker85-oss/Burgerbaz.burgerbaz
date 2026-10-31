import { fail } from './security'
export const text=(v:any,max=500,required=false)=>{ if(typeof v!=='string'||v.length>max||(required&&!v.trim())) fail('متن واردشده معتبر نیست.'); return v.trim() }
const bool=(v:any)=>{if(typeof v!=='boolean')fail('مقدار گزینه معتبر نیست.');return v}
const list=(v:any)=>{if(!Array.isArray(v)||v.length>30)fail('فهرست معتبر نیست.'); return v.map(x=>text(x,200,true))}
export const imageUrl=(v:any)=>{v=text(v,700); if(v&&!/^\/(static\/images\/[a-zA-Z0-9._-]+|media\/[a-f0-9-]+\.(webp|jpg|png))$/.test(v))fail('تصویر را از کتابخانه رسانه انتخاب کنید.');return v}
const slug=(v:any)=>{v=text(v,120,true);if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v))fail('نامک باید شامل حروف کوچک لاتین، عدد و خط تیره باشد.');return v}
export const SERVING_TYPES=[{id:'plain',name:'ساده'},{id:'mixed-cheese',name:'میکس پنیر'},{id:'mushroom-cheese',name:'قارچ و پنیر'}] as const
export const defaultServingOptions=()=>SERVING_TYPES.map(t=>({...t,enabled:false,price:null}))
export function servingOptions(value:any){
 if(value===undefined)return defaultServingOptions()
 if(!Array.isArray(value)||value.length!==3)fail('هر آیتم باید سه روش سرو معتبر داشته باشد.')
 const ids=new Set(value.map((v:any)=>v?.id));if(ids.size!==3||SERVING_TYPES.some(t=>!ids.has(t.id)))fail('روش سرو ناشناخته یا تکراری است.')
 return SERVING_TYPES.map(t=>{const option=value.find((v:any)=>v.id===t.id);const enabled=bool(option.enabled);const price=option.price;if(price!==null&&(!Number.isSafeInteger(price)||price<0||price>1000000000))fail('قیمت هر روش سرو باید عدد صحیح غیرمنفی یا خالی باشد.');return {...t,enabled,price}})
}
const order=(v:any)=>{if(!Number.isInteger(v)||v<0||v>100000)fail('ترتیب معتبر نیست.');return v}
export function validate(kind:string,d:any) {
 if(!d||typeof d!=='object'||Array.isArray(d))fail('داده معتبر نیست.')
 if(kind==='settings') {
  const t=d.themeSettings; if(!t||!/^#[a-f0-9]{6}$/i.test(t.accent)||!/^#[a-f0-9]{6}$/i.test(t.canvas))fail('رنگ معتبر نیست.')
  if(!Array.isArray(d.socialLinks)||d.socialLinks.length>10)fail('پیوندها معتبر نیستند.')
  return {brandName:text(d.brandName,100,true),logoUrl:imageUrl(d.logoUrl),heroTitle:text(d.heroTitle,100,true),heroSubtitle:text(d.heroSubtitle,500),heroImageUrl:imageUrl(d.heroImageUrl),brandDescription:text(d.brandDescription,500),phone:text(d.phone,50),address:text(d.address,500),openingHours:text(d.openingHours,500),footerContent:text(d.footerContent,500),socialLinks:d.socialLinks.map((s:any)=>{let url=text(s.url,500,true);if(!/^https:\/\/[^\s]+$/.test(url))fail('آدرس شبکه اجتماعی باید HTTPS باشد.');return {label:text(s.label,50,true),url}}),themeSettings:{accent:t.accent,canvas:t.canvas},showPrices:bool(d.showPrices),showAvailability:bool(d.showAvailability),showBadges:bool(d.showBadges),showContact:bool(d.showContact)}
 }
 const shared={name:text(d.name,120,true),slug:slug(d.slug),sortOrder:order(d.sortOrder),imageUrl:imageUrl(d.imageUrl)}
 if(kind==='categories') return {...shared,description:text(d.description,500),preparationLabels:list(d.preparationLabels)}
 if(d.price!==null && (!Number.isSafeInteger(d.price)||d.price<0||d.price>1000000000))fail('قیمت باید عدد صحیح مثبت یا خالی باشد.')
 return {...shared,categoryId:text(d.categoryId,100,true),shortDescription:text(d.shortDescription,1000),fullDescription:text(d.fullDescription,5000),ingredients:list(d.ingredients),price:d.price,servingOptions:servingOptions(d.servingOptions),currency:'تومان',imageAlt:text(d.imageAlt,250),representativeImage:bool(d.representativeImage),badges:list(d.badges),preparationLabels:list(d.preparationLabels),isAvailable:bool(d.isAvailable)}
}
export const adminRow=(r:any)=>{const draft=JSON.parse(r.draft);return {id:r.id,...draft,...(r.category_id?{servingOptions:servingOptions(draft.servingOptions)}:{}),version:r.version,isPublished:r.published!==null,hasDraft:r.published!==r.draft,updatedAt:r.updated_at,published:r.published?JSON.parse(r.published):null}}
export async function publicData(db:any,draft=false) {
 const field=draft?'draft':'published'
 const [cats,products,settings]=await Promise.all([db.prepare(`SELECT id,${field} AS data FROM categories WHERE ${field} IS NOT NULL`).all(),db.prepare(`SELECT id,${field} AS data FROM items WHERE ${field} IS NOT NULL`).all(),db.prepare(`SELECT ${field} AS data FROM settings WHERE id=1`).first()])
 const categories=cats.results.map((r:any)=>({id:r.id,...JSON.parse(r.data)})).sort((a:any,b:any)=>a.sortOrder-b.sortOrder)
 const ids=new Set(categories.map((c:any)=>c.id))
 const items=products.results.map((r:any)=>({id:r.id,...JSON.parse(r.data)})).filter((p:any)=>ids.has(p.categoryId)).sort((a:any,b:any)=>a.sortOrder-b.sortOrder)
 const site=JSON.parse(settings.data)
 if(!site.showContact){site.phone='';site.address='';site.openingHours='';site.socialLinks=[]}
 return {categories,items:items.map((i:any)=>({...i,servingOptions:servingOptions(i.servingOptions).filter(o=>draft||o.enabled).map(o=>({...o,price:site.showPrices?o.price:null})),...(!site.showPrices?{price:null}:{}),...(!site.showBadges?{badges:[]}:{}),...(!site.showAvailability?{isAvailable:true}:{})})),settings:site}
}
