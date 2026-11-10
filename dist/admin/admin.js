(() => {
'use strict';
const $=s=>document.querySelector(s),notice=$('#notice');
const routeDoctor=location.pathname.includes('dr.chetan')?'chetan':location.pathname.includes('dr.mounika')?'mounika':null;
let viewer=null;
const sharedView=()=>!routeDoctor||viewer?.role==='doctor'&&routeDoctor!==viewer.doctor;
const canManage=slug=>viewer?.role==='reception'||viewer?.doctor===slug;
let csrf='',doctors=[],today='',maxDate='',page=1,total=0,listSequence=0,currentRows=[],enquiries=[],view='appointments',saving=false,rescheduling=null,selectedMinute=null,slotSequence=0;
function el(tag,text,parent){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(parent)parent.append(e);return e;}
function tell(text){$('#noticeText').textContent=text;notice.hidden=!text;}
$('#dismissNotice').addEventListener('click',()=>tell(''));
function iconNode(name){const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg'),use=document.createElementNS(ns,'use');svg.classList.add('ui-icon');svg.setAttribute('aria-hidden','true');use.setAttribute('href','/admin/icons.svg#'+name);svg.append(use);return svg;}
async function api(action,body){let r;try{r=await fetch('/api/index.php?action='+action,{cache:'no-store',credentials:'same-origin',...(body!==undefined?{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify(body)}:{})});}catch{throw Error('Connection failed. Please retry.');}let d;try{d=await r.json();}catch{throw Error('The server did not respond correctly. Please retry.');}if(!r.ok){if(r.status===401)show(false);throw Error(d.error||'Please retry.');}return d;}
let pendingOperations=0;
async function run(fn){pendingOperations++;document.body.classList.add('is-working');try{await fn();}catch(e){tell(e.message);}finally{pendingOperations--;if(!pendingOperations)document.body.classList.remove('is-working');}}
function show(on){$('#desk').hidden=!on;$('#login').hidden=on;if(!on){currentRows=[];enquiries=[];for(const s of ['#appointments','#enquiries','#history','#summary','#analyticsStats','#dailyChart','#doctorAnalytics','#visitAnalytics','#statusAnalytics'])$(s).replaceChildren();document.querySelectorAll('dialog[open]').forEach(d=>d.close());}}
function time(n){return new Date(2000,0,1,Math.floor(n/60),n%60).toLocaleTimeString('en-IN',{hour:'numeric',minute:'2-digit'});}
function key(d){return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');}
function selectView(next){
 view=next;
 for(const v of ['appointments','availability','enquiries','analytics'])$('#'+v+'View').hidden=v!==next;
 $('#summary').hidden=next!=='appointments';
 $('#updated').textContent=next==='enquiries'?'Contact form messages · Managed by reception · Times in IST':next==='availability'?'Manage weekly consultation hours and leave dates.':'All times shown in India time.';
 $('#pageTitle').textContent={appointments:'Appointments',availability:'Doctors & availability',enquiries:'Patient enquiries',analytics:'Analytics'}[next];
 document.querySelectorAll('nav button').forEach(b=>{const status=$('#statusFilter').value;const active=next==='appointments'?(status?b.dataset.status===status:b.dataset.view==='appointments'):b.dataset.view===next;b.setAttribute('aria-current',active?'page':'false');});
}
function action(parent,label,fn){const b=el('button',label,parent);b.type='button';const icons={'Visit history':'history','Confirm':'check','Complete':'check','Reschedule':'calendar','Cancel':'close','Mark resolved':'check','Reopen':'refresh'};if(icons[label])b.prepend(iconNode(icons[label]));b.addEventListener('click',()=>run(async()=>{b.disabled=true;try{await fn();}finally{b.disabled=false;}}));return b;}
function phone(parent,value){const a=el('a',value,parent);a.href='tel:'+value.replace(/[^+0-9]/g,'');}
const statusLabel={requested:'Pending',confirmed:'Confirmed',completed:'Completed',cancelled:'Cancelled'};
function filters(){return {from:$('#from').value,to:$('#to').value,doctor:$('#doctorFilter').value,status:$('#statusFilter').value,search:$('#search').value.trim(),page,shared:sharedView()};}
async function loadList(){if(!$('#filters').reportValidity())return;syncDoctorChips();const seq=++listSequence;const d=await api('admin-list',filters());if(seq!==listSequence)return;currentRows=d.appointments;total=d.total;const body=$('#appointments');body.replaceChildren();$('#empty').hidden=!!currentRows.length;
for(const a of currentRows){const tr=el('tr',undefined,body);const date=el('td',undefined,tr);el('strong',time(Number(a.start_minute)),date);el('small',a.visit_date,date);const patient=el('td',undefined,tr);patient.className='patient-cell';el('strong',a.patient_name,patient);el('br',undefined,patient);phone(patient,a.phone);el('small',a.reference+(a.age!==null?' · Age '+a.age:''),patient);el('td',a.doctor,tr);const concern=el('td',a.visit_type,tr);concern.className='concern-cell';el('p',a.concern||'—',concern);const state=el('td',undefined,tr);el('span',statusLabel[a.status],state).className='status '+a.status;const controls=el('td',undefined,tr);controls.className='row-actions';
 action(controls,'Visit history',()=>history(a));if(canManage(a.doctor_slug)&&a.status==='requested')action(controls,'Confirm',()=>change(a,'confirmed'));if(canManage(a.doctor_slug)&&a.status==='confirmed')action(controls,'Complete',()=>change(a,'completed'));if(canManage(a.doctor_slug)&&['requested','confirmed'].includes(a.status)){action(controls,'Reschedule',()=>openBooking(a));action(controls,'Cancel',()=>{$('#cancelText').textContent=a.patient_name+' · '+a.doctor+' · '+a.visit_date+' '+time(Number(a.start_minute));$('#cancelDialog').dataset.id=a.id;$('#cancelDialog').showModal();});}}
const counts=Object.fromEntries(d.summary.map(x=>[x.status,Number(x.total)]));const summary=$('#summary');summary.replaceChildren();for(const [status,label] of Object.entries(statusLabel)){const card=el('div',undefined,summary);card.className='stat';el('span',label,card);el('strong',String(counts[status]||0),card);}$('#pendingBadge').textContent=counts.requested?'('+counts.requested+')':'';$('#listCaption').textContent=`${$('#from').value} to ${$('#to').value} · ${$('#doctorFilter').selectedOptions[0].textContent}`;$('#pageInfo').textContent=`${total?((page-1)*25+1):0}–${Math.min(page*25,total)} of ${total}`;$('#prev').disabled=page<=1;$('#next').disabled=page*25>=total;if(view==='appointments')$('#updated').textContent='Updated '+new Date().toLocaleTimeString('en-IN',{timeZone:'Asia/Kolkata',hour:'numeric',minute:'2-digit'})+' IST · Totals cover all saved bookings in the selected date range.';}
async function change(a,status){await api('admin-status',{id:Number(a.id),status});await loadList();tell('Appointment '+status+'.');}
async function history(a){$('#historyTitle').textContent=a.patient_name+' · Visit history';$('#history').textContent='Loading…';$('#historyDialog').showModal();const d=await api('admin-history',{name:a.patient_name,phone:a.phone,shared:sharedView()});$('#history').replaceChildren();if(!d.visits.length)el('p','No recorded visits.',$('#history'));for(const v of d.visits){const c=el('article',undefined,$('#history'));el('h3',v.visit_date+' · '+time(Number(v.start_minute))+' · '+statusLabel[v.status],c);el('p',v.doctor+' · '+v.visit_type+' · '+v.reference,c);el('p',v.concern||'No concern recorded.',c);}}
function renderEnquiries(){
 const root=$('#enquiries');root.replaceChildren();
 const unresolved=enquiries.filter(e=>!Number(e.is_resolved)).length;
 $('#enquiryCounts').textContent=`${unresolved} unresolved · ${enquiries.length-unresolved} resolved · ${enquiries.length} loaded`;
 const rows=enquiries.filter(e=>!$('#unresolved').checked||!Number(e.is_resolved));
 if(view==='enquiries')$('#updated').textContent='Contact form messages · Managed by reception · Times in IST';
 if(!rows.length){const empty=el('p','No enquiries to show with this filter.',root);empty.className='enquiry-empty';}
 for(const e of rows){
  const resolved=Boolean(Number(e.is_resolved)),c=el('article',undefined,root);c.className='enquiry-card';
  const head=el('div',undefined,c);head.className='enquiry-heading';
  const person=el('div',undefined,head);el('h3',e.patient_name,person);el('small',e.reference,person);
  el('span',resolved?'Resolved':'Needs response',head).className='enquiry-status'+(resolved?' resolved':'');
  const details=el('div',undefined,c);details.className='enquiry-details';
  const contact=el('div',undefined,details);el('span','PHONE',contact);phone(contact,e.phone);
  const received=el('div',undefined,details);el('span','RECEIVED · IST',received);el('strong',e.created_at,received);
  const message=el('div',undefined,c);message.className='enquiry-message';el('span','PATIENT MESSAGE',message);el('p',e.message,message);
  const controls=el('div',undefined,c);controls.className='enquiry-actions';
  action(controls,'Create appointment',()=>openBooking(null,e));
  const resolve=action(controls,resolved?'Reopen':'Mark resolved',async()=>{await api('admin-enquiry',{id:Number(e.id),resolved:!resolved});await loadOffice();tell('Enquiry updated.');});resolve.classList.add('secondary');
 }
}
function minuteValue(value){const [h,m]=value.split(':').map(Number);return h*60+m;}
function inputTime(value){return String(Math.floor(value/60)).padStart(2,'0')+':'+String(value%60).padStart(2,'0');}
function renderDoctorOverview(){
 const root=$('#doctorOverview');root.replaceChildren();
 for(const d of doctors.filter(d=>viewer?.role==='reception'||d.slug===viewer?.doctor)){const card=el('article',undefined,root);const img=el('img',undefined,card);img.src=d.slug==='chetan'?'https://drchetanveeramaneni.com/wp-content/uploads/2024/09/Dr.-Chetan-Veeramaneni.jpg':'../assets/img/dr-mounika.jpg';img.alt=d.name;el('h3',d.name,card);el('p',d.specialty+' · NMR '+(d.slug==='chetan'?'93478':'89681'),card);el('p','Consultation ₹800 · One free follow-up within 10 days',card);}
}
async function loadOffice(){renderDoctorOverview();const d=await api('admin-data&date='+today);enquiries=d.enquiries;$('#enquiryBadge').textContent=enquiries.filter(e=>!Number(e.is_resolved)).length||'';renderEnquiries();$('#hours').replaceChildren();for(const doctor of doctors.filter(d=>viewer?.role==='reception'||d.slug===viewer?.doctor)){const f=el('form',undefined,$('#hours'));f.className='week';el('h3',doctor.name,f);const fields=[];for(const h of d.hours.filter(h=>h.slug===doctor.slug)){const row=el('div',undefined,f);row.className='day';const label=el('label',['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][h.weekday],row);const open=el('input',undefined,label);open.type='checkbox';open.checked=Boolean(Number(h.is_open));const startLabel=el('label','From',row),start=el('input',undefined,startLabel),endLabel=el('label','To',row),end=el('input',undefined,endLabel);for(const input of [start,end]){input.type='time';input.step=1800;input.required=true;}start.value=inputTime(Number(h.start_minute));end.value=inputTime(Number(h.end_minute));fields.push({open,start,end});}const b=el('button','Save weekly hours',f);f.addEventListener('submit',e=>{e.preventDefault();run(async()=>{b.disabled=true;try{await api('admin-hours',{doctor:doctor.slug,hours:fields.map(x=>({open:x.open.checked,start:minuteValue(x.start.value),end:minuteValue(x.end.value)}))});tell('Weekly hours saved. Existing appointments unchanged.');}finally{b.disabled=false;}});});}$('#closures').replaceChildren();d.closures.forEach(c=>el('p',(doctors.find(d=>d.slug===c.slug)?.name||c.slug)+' · Closed '+c.closed_date,$('#closures')));}
async function refresh(){if(view==='appointments')await loadList();else if(view==='analytics')await loadAnalytics();else await loadOffice();}
const booking=$('#bookingForm');let requestKey='',requestPayload='',bookingEnquiry=null;
async function openBooking(appointment,enquiry){rescheduling=appointment||null;bookingEnquiry=enquiry||null;booking.reset();if(enquiry){booking.elements.name.value=enquiry.patient_name;booking.elements.phone.value=enquiry.phone;booking.elements.message.value=enquiry.message;}requestKey='';requestPayload='';$('#patientFields').hidden=!!rescheduling;$('#patientFields').querySelectorAll('[name=name],[name=phone],[name=doctor]').forEach(e=>e.required=!rescheduling);$('#bookingTitle').textContent=rescheduling?'Reschedule '+appointment.patient_name:'Add appointment';$('#saveBooking').textContent=rescheduling?'Save new time':'Save appointment request';booking.elements.date.min=today;booking.elements.date.max=maxDate;booking.elements.date.value=rescheduling&&appointment.visit_date>=today?appointment.visit_date:today;booking.elements.doctor.value=rescheduling?appointment.doctor_slug:(viewer.role==='doctor'?viewer.doctor:($('#doctorFilter').value||doctors[0].slug));$('#bookingDialog').showModal();await loadSlots();}
async function loadSlots(){const seq=++slotSequence;selectedMinute=null;$('#saveBooking').disabled=true;$('#slotChoices').replaceChildren();$('#bookingNote').textContent='Checking availability…';try{const d=await api('availability&doctor='+booking.elements.doctor.value+'&date='+booking.elements.date.value);if(seq!==slotSequence)return;$('#bookingNote').textContent=d.slots.length?'Choose an available half-hour slot.':'No available times. Choose another date.';for(const slot of d.slots){const b=action($('#slotChoices'),slot.label,async()=>{selectedMinute=slot.minute;$('#slotChoices').querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));$('#saveBooking').disabled=false;});b.setAttribute('aria-pressed','false');}}catch(e){if(seq===slotSequence)$('#bookingNote').textContent=e.message;}}
booking.elements.date.addEventListener('change',()=>run(loadSlots));booking.elements.doctor.addEventListener('change',()=>run(loadSlots));
booking.addEventListener('submit',e=>{e.preventDefault();if(saving||selectedMinute===null||!booking.reportValidity())return;run(async()=>{saving=true;$('#saveBooking').disabled=true;try{if(rescheduling){await api('admin-reschedule',{id:Number(rescheduling.id),date:booking.elements.date.value,minute:selectedMinute,expected_date:rescheduling.visit_date,expected_minute:Number(rescheduling.start_minute)});}else{const f=new FormData(booking),body={name:f.get('name'),phone:f.get('phone'),age:f.get('age')===''?null:Number(f.get('age')),doctor:f.get('doctor'),visit:f.get('visit'),date:f.get('date'),minute:selectedMinute,message:f.get('message')};const payload=JSON.stringify(body);if(payload!==requestPayload){requestKey=crypto.randomUUID();requestPayload=payload;}body.request_key=requestKey;await api('admin-create',body);}$('#bookingDialog').close();$('#from').value=booking.elements.date.value;$('#to').value=booking.elements.date.value;$('#search').value='';$('#statusFilter').value='';if(!$('#doctorFilter').disabled)$('#doctorFilter').value=booking.elements.doctor.value;page=1;selectView('appointments');await loadList();tell(rescheduling?'Appointment rescheduled. Contact the patient to inform them.':(bookingEnquiry?'Appointment added as pending. The enquiry stays open until reception marks it resolved.':'Appointment added as pending. Use Confirm after checking the details.'));}catch(error){$('#bookingNote').textContent=error.message;await loadSlots();throw error;}finally{saving=false;$('#saveBooking').disabled=selectedMinute===null;}});});
$('#cancelForm').addEventListener('submit',e=>{e.preventDefault();run(async()=>{const b=$('#confirmCancel');b.disabled=true;try{await api('admin-status',{id:Number($('#cancelDialog').dataset.id),status:'cancelled'});$('#cancelDialog').close();await loadList();tell('Appointment cancelled; slot released.');}finally{b.disabled=false;}});});
document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>$('#'+b.dataset.close).close()));
document.querySelectorAll('nav button').forEach(b=>b.addEventListener('click',()=>run(async()=>{if(b.dataset.status!==undefined){$('#statusFilter').value=b.dataset.status;page=1;selectView('appointments');await loadList();}else{if(b.dataset.view==='appointments'){$('#statusFilter').value='';page=1;}selectView(b.dataset.view);await refresh();}})));
$('#filters').addEventListener('submit',e=>{e.preventDefault();page=1;run(loadList);});$('#doctorFilter').addEventListener('change',()=>{page=1;run(loadList);});$('#statusFilter').addEventListener('change',()=>{page=1;selectView('appointments');run(loadList);});$('#prev').addEventListener('click',()=>{page--;run(loadList);});$('#next').addEventListener('click',()=>{page++;run(loadList);});
$('#today').addEventListener('click',()=>{$('#from').value=today;$('#to').value=today;page=1;run(loadList);});$('#week').addEventListener('click',()=>{const d=new Date(today+'T12:00:00');d.setDate(d.getDate()+6);$('#from').value=today;$('#to').value=key(d);page=1;run(loadList);});$('#refresh').addEventListener('click',()=>run(refresh));$('#newBooking').addEventListener('click',()=>run(()=>openBooking()));$('#print').addEventListener('click',()=>window.print());$('#unresolved').addEventListener('change',renderEnquiries);
$('#closure').addEventListener('submit',e=>{e.preventDefault();run(async()=>{const d=Object.fromEntries(new FormData(e.target));d.closed=d.closed==='true';await api('admin-closure',d);await loadOffice();tell('Date availability updated. Existing appointments unchanged.');});});
function applyAccount(){
 const personal=routeDoctor;
 $('#passwordButton').hidden=viewer.role!=='doctor';
 $('#signedInName').textContent=viewer.name;
 $('#accountRole').textContent=viewer.role==='doctor'?'Doctor account':'Reception account';
 const note=$('#accessNote');note.hidden=viewer.role!=='doctor'||!sharedView();note.textContent='Shared reception view: you can view both doctors, but manage only your own appointments and schedule.';
 document.title=(personal?(personal==='chetan'?'Dr. Chetan':'Dr. Mounika'):'Reception')+' | Altus Clinic Desk';
 $('#workspaceLabel').textContent=personal?(personal==='chetan'?'Dr. Chetan':'Dr. Mounika'):'Reception desk';
 const links=$('#workspaceLinks');links.replaceChildren();
 for(const [slug,label] of [['reception','Reception'],['dr.chetan','Dr. Chetan'],['dr.mounika','Dr. Mounika']]){
  if(viewer.role==='doctor'&&slug!=='reception'&&slug!=='dr.'+viewer.doctor)continue;
  const a=el('a',undefined,links);a.append(iconNode(slug==='reception'?'users':slug==='dr.chetan'?'kidney':'ear'));el('span',label,a);a.href='/admin/'+slug;a.addEventListener('click',event=>{if(event.ctrlKey||event.metaKey||event.shiftKey||event.altKey||event.button!==0||a.getAttribute('aria-current')==='page')return;if(!document.startViewTransition||matchMedia('(prefers-reduced-motion: reduce)').matches)return;event.preventDefault();document.body.classList.add('workspace-leaving');document.querySelector('main').setAttribute('aria-busy','true');setTimeout(()=>location.assign(a.href),140);});if(location.pathname==='/admin/'+slug)a.setAttribute('aria-current','page');
 }
 for(const select of [$('#doctorFilter'),$('#analyticsDoctor')]){
  select.replaceChildren(new Option('Both doctors',''));for(const d of doctors)select.append(new Option(d.name,d.slug));
  select.value=personal||'';select.disabled=!!personal;
 }
 booking.elements.doctor.replaceChildren();$('#closure select').replaceChildren();
 for(const d of doctors.filter(d=>canManage(d.slug))){booking.elements.doctor.append(new Option(d.name,d.slug));$('#closure select').append(new Option(d.name,d.slug));}
 document.querySelector('nav [data-view=enquiries]').hidden=viewer.role!=='reception';
 const initialFrom=new Date(today+'T12:00:00');initialFrom.setDate(initialFrom.getDate()-6);$('#analyticsFrom').value=key(initialFrom);$('#analyticsTo').value=today;syncDoctorChips();
}
async function signedIn(){
 if(!viewer)throw Error('Please sign in.');
 if(location.pathname==='/admin/'||location.pathname==='/admin/index.html'){
  location.replace('/admin/'+(viewer.role==='doctor'?'dr.'+viewer.doctor:'reception'));return;
 }
 applyAccount();show(true);selectView(routeDoctor?'analytics':'appointments');await loadList();await loadOffice();if(view==='analytics')await loadAnalytics();tell('');
}
async function loadAnalytics(){
 const from=$('#analyticsFrom').value,to=$('#analyticsTo').value;if(!from||!to){tell('Choose a date range.');return;}
 const d=await api('admin-analytics',{from,to,doctor:$('#analyticsDoctor').value,shared:sharedView()});
 const counts=Object.fromEntries(d.status.map(s=>[s.status,Number(s.total)]));const total=Object.values(counts).reduce((a,b)=>a+b,0);
 const root=$('#analyticsStats');root.replaceChildren();for(const [label,value] of [['Saved bookings (incl. cancelled)',total],['Pending',counts.requested||0],['Completed',counts.completed||0],['Patients with non-cancelled bookings',d.patients]]){const c=el('div',undefined,root);c.className='stat';el('span',label,c);el('strong',String(value),c);}
 const daily=$('#dailyChart');daily.replaceChildren();if(!d.daily.length)el('p','No appointment activity in this date range.',daily);
 const peak=Math.max(1,...d.daily.map(x=>Number(x.total)));
 for(const day of d.daily){const row=el('div',undefined,daily);row.className='chart-row';el('span',day.visit_date,row);const meter=el('meter',undefined,row);meter.min=0;meter.max=peak;meter.value=Number(day.total);meter.setAttribute('aria-label',day.visit_date+' appointments: '+day.total);el('strong',String(day.total),row);}
 for(const [selector,rows,labelKey] of [['#doctorAnalytics',d.doctors,'name'],['#visitAnalytics',d.visit_types,'visit_type'],['#statusAnalytics',d.status,'status']]){const node=$(selector);node.replaceChildren();if(!rows.length)el('p','No appointments recorded.',node);for(const row of rows){const line=el('p',undefined,node);line.className='breakdown';el('span',labelKey==='status'?statusLabel[row.status]:row[labelKey],line);el('strong',String(row.total),line);}}
 if(view==='analytics')$('#updated').textContent='Analytics: '+from+' to '+to+' · '+$('#analyticsDoctor').selectedOptions[0].textContent+' · India time';
}
function syncDoctorChips(){
 const root=$('#doctorChips');root.replaceChildren();
 for(const option of [...$('#doctorFilter').options]){
  if(routeDoctor&&option.value!==routeDoctor)continue;
  const b=el('button',option.textContent,root);b.type='button';b.setAttribute('aria-pressed',String(option.value===$('#doctorFilter').value));
  b.addEventListener('click',()=>{if($('#doctorFilter').disabled)return;$('#doctorFilter').value=option.value;page=1;run(loadList);});
 }
}
let searchTimer;
$('#search').addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>{page=1;run(loadList);},350);});
$('#resetFilters').addEventListener('click',()=>{clearTimeout(searchTimer);$('#from').value=today;$('#to').value=today;$('#search').value='';$('#statusFilter').value='';$('#doctorFilter').value=routeDoctor||'';page=1;selectView('appointments');run(loadList);});
for(const [id,delta] of [['previousDay',-1],['nextDay',1]])$('#'+id).addEventListener('click',()=>{const d=new Date($('#from').value+'T12:00:00');if(Number.isNaN(+d))return;d.setDate(d.getDate()+delta);$('#from').value=key(d);$('#to').value=key(d);page=1;run(loadList);});
document.querySelectorAll('[data-days]').forEach(b=>b.addEventListener('click',()=>{const from=new Date(today+'T12:00:00');from.setDate(from.getDate()-Number(b.dataset.days)+1);$('#analyticsFrom').value=key(from);$('#analyticsTo').value=today;run(loadAnalytics);}));
$('#loadAnalytics').addEventListener('click',()=>run(loadAnalytics));
$('#passwordButton').addEventListener('click',()=>{if(viewer?.role!=='doctor')return;$('#passwordForm').reset();$('#passwordDialog').showModal();});
$('#passwordForm').addEventListener('submit',e=>{e.preventDefault();const f=new FormData(e.target);if(f.get('new_password')!==f.get('confirm_password')){tell('New passwords do not match.');return;}run(async()=>{const r=await api('admin-password',{current_password:f.get('current_password'),new_password:f.get('new_password')});csrf=r.csrf;e.target.reset();$('#passwordDialog').close();tell('Password changed. Other sessions have been signed out.');});});
$('#loginForm').addEventListener('submit',e=>{e.preventDefault();run(async()=>{const b=e.target.querySelector('button');b.disabled=true;try{const r=await api('login',Object.fromEntries(new FormData(e.target)));csrf=r.csrf;viewer=r.user;e.target.reset();await signedIn();}finally{b.disabled=false;}});});$('#logout').addEventListener('click',()=>run(async()=>{await api('admin-logout',{});show(false);const b=await api('bootstrap');csrf=b.csrf;tell('Signed out.');}));
setInterval(()=>{if(!$('#desk').hidden&&view==='appointments'&&!document.querySelector('dialog[open]')&&!$('#filters').contains(document.activeElement))run(loadList);},60000);
if(routeDoctor){$('#login h1').textContent=routeDoctor==='chetan'?'Dr. Chetan · Sign in':'Dr. Mounika · Sign in';}
run(async()=>{const b=await api('bootstrap');csrf=b.csrf;doctors=b.doctors;viewer=b.user;today=b.today;maxDate=b.max_date;$('#from').value=today;$('#to').value=today;$('#closure [name=date]').min=today;for(const d of doctors){$('#doctorFilter').append(new Option(d.name,d.slug));booking.elements.doctor.append(new Option(d.name,d.slug));$('#closure select').append(new Option(d.name,d.slug));}try{await signedIn();}catch(e){show(false);if(e.message!=='Please sign in.')throw e;tell('Sign in to manage the clinic.');}});
})();
