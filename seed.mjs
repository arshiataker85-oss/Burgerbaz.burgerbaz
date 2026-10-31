import { writeFileSync } from 'node:fs';
const groups = [
 ['burgers','برگر','یک برگر، یک دنیای طعم',[
 ['برگر','۱۴۰ گرم گوشت گوساله','burger'],
 ['فایر برگر','۱۴۰ گرم گوشت گوساله + پپرونی ۹۰ درصد','fire'],
 ['رویال برگر','۱۴۰ گرم گوشت گوساله + ژامبون ۹۰ درصد','royal'],
 ['آنیون برگر','۱۴۰ گرم گوشت گوساله + پیاز کاراملی','onion'],
 ['دبل میکس','۱۴۰ گرم گوشت گوساله + فیله مرغ مزه‌دار شده','mix'],
 ['صحرایی برگر','۱۴۰ گرم گوشت گوساله + بیکن ۹۸ درصد + سس باربیکیو','desert'],
 ['بازار برگر','۱۴۰ گرم گوشت گوساله + سالاد کلم'],
 ['چوریتسو برگر','۱۴۰ گرم گوشت گوساله + چوریتسو'],
 ['والنات برگر','۱۴۰ گرم گوشت گوساله + گردو و دارچین + پیاز کاراملی'],
 ['دبل برگر','۲ عدد گوشت ۱۴۰ گرم گوساله'],
 ['رست برگر','۱۴۰ گرم گوشت گوساله + گوشت ریش شده'],
 ['کینگ برگر','۱۴۰ گرم گوشت گوساله + سینه مرغ سوخاری + ژامبون']]],
 ['chicken','چیکن برگر','روی دیگر دنیای برگر',[
 ['چیکن برگر','فیله مرغ مزه‌دار شده'],
 ['فایر چیکن','فیله مرغ مزه‌دار شده + پپرونی ۹۰ درصد'],
 ['رویال چیکن','فیله مرغ مزه‌دار شده + ژامبون ۹۰ درصد'],
 ['آنیون چیکن','فیله مرغ مزه‌دار شده + پیاز کاراملی'],
 ['چیکن صحرایی','فیله مرغ مزه‌دار شده + بیکن ۹۸ درصد + سس باربیکیو'],
 ['بازار چیکن','فیله مرغ مزه‌دار شده + سالاد کلم'],
 ['چیکن پستو','فیله مرغ مزه‌دار شده + پنیر پستو']]],
 ['sandwiches','ساندویچ','طعم‌ها، کنار هم',[
 ['هات داگ فرانکفورتر','هات داگ ۹۰ درصد'],['ژامبون','ژامبون گوشت و مرغ ۹۰ درصد'],
 ['بیف داگ','گوشت گوساله چرخ شده + هات داگ ۹۰ درصد'],['سالامی','سالامی گوشت ۹۰ درصد'],
 ['رست بیف','گوشت گوساله ریش شده + قارچ'],['چیلی داگ','پپرونی ۹۰ درصد + هات داگ ۹۰ درصد'],
 ['هندی','کوکتل + سس پیاز تند'],['کراکف پنیر','سوسیس کراکف'],['بیکن سرخ شده','بیکن ۹۸ درصد سرخ شده'],['بیکن بوقلمون','بیکن ۹۸ درصد بوقلمون']]],
 ['fries','سیب زمینی','کنار طعم مورد علاقه‌ات',[
 ['سیب ساده',''],['سیب رست بیف','سیب زمینی سرخ شده + گوشت ریش شده + قارچ + میکس پنیر + سس مخصوص'],
 ['سیب پپرونی','سیب زمینی سرخ شده + پپرونی + میکس پنیر + سس مخصوص'],
 ['سیب فیله','سیب زمینی سرخ شده + فیله مرغ + میکس پنیر + سس مخصوص']]],
 ['snacks','اسنک','یک انتخاب کوچک، یک لذت متفاوت',[
 ['اسنک مخصوص',''],['اسنک پپرونی',''],['اسنک مرغ و قارچ',''],['اسنک گوشت و قارچ',''],['اسنک رست بیف',''],['اسنک سلامی','']]],
 ['shakes','شیک','پایانی شیرین برای انتخاب تو',[
 ['شیک وانیل',''],['شیک نوتلا',''],['شیک لوتوس',''],['شیک نوتلا توت فرنگی',''],['شیک بادام زمینی','']]]
];
const quote = x => "'"+String(x).replaceAll("'","''")+"'";
const sql = ['-- Repeatable seed; existing content is never overwritten.'];
const categories=[],items=[];
for (const [index,[id,name,description,products]] of groups.entries()) {
 const c={name,slug:id,description,sortOrder:index,imageUrl:'',preparationLabels:id==='sandwiches'?['ساده','پنیر ترکیبی','سس قارچ']:[]}; categories.push({id,...c});
 sql.push(`INSERT OR IGNORE INTO categories(id,slug,draft,published) VALUES(${quote(id)},${quote(id)},${quote(JSON.stringify(c))},${quote(JSON.stringify(c))});`);
 products.forEach(([name,shortDescription,image],i)=>{
 const itemId=id+'-'+(i+1);
 const p={name,slug:itemId,categoryId:id,shortDescription,fullDescription:'',ingredients:shortDescription?shortDescription.split(' + '):[],price:null,servingOptions:[{id:'plain',name:'ساده',enabled:false,price:null},{id:'mixed-cheese',name:'میکس پنیر',enabled:false,price:null},{id:'mushroom-cheese',name:'قارچ و پنیر',enabled:false,price:null}],currency:'تومان',imageUrl:image?'/static/images/'+image+'.webp':'',imageAlt:image?'تصویر نمایشی '+name:'',representativeImage:!!image,badges:[],preparationLabels:[],isAvailable:true,sortOrder:i};
 items.push({id:itemId,...p});
 sql.push(`INSERT OR IGNORE INTO items(id,category_id,slug,draft,published) VALUES(${quote(itemId)},${quote(id)},${quote(itemId)},${quote(JSON.stringify(p))},${quote(JSON.stringify(p))});`);
 });
}
const settings={brandName:'برگر باز',logoUrl:'/static/images/logo.png',heroTitle:'طعم واقعی برگر',heroSubtitle:'انتخابی از طعم‌های خاص، با ترکیبی از مواد اولیه و مزه‌های متفاوت.',heroImageUrl:'/static/images/desert.webp',brandDescription:'برای آن‌هایی که برگر را جور دیگری دوست دارند.',phone:'',address:'',openingHours:'',socialLinks:[],footerContent:'تمام حقوق این وب‌سایت متعلق به برگر باز است.',themeSettings:{accent:'#C6532D',canvas:'#F7F0E5'},showPrices:true,showAvailability:true,showBadges:true,showContact:true};
sql.push(`INSERT OR IGNORE INTO settings(id,draft,published) VALUES(1,${quote(JSON.stringify(settings))},${quote(JSON.stringify(settings))});`);
writeFileSync('seed.sql',sql.join('\n'));
writeFileSync('tests/seed-fixture.json',JSON.stringify({categories,items,settings},null,2));
console.log(`Seed ready: ${categories.length} categories, ${items.length} items. No prices invented.`);
