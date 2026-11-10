(() => {
  const form = document.querySelector('#bookingForm');
  const contact = document.querySelector('#contactForm');
  if (!form && !contact) return;
  let csrf;
  async function api(action, body) {
    let response;
    try { response = await fetch('api/index.php?action=' + action, {credentials:'same-origin', cache:'no-store', ...(body ? {method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify(body)} : {})}); }
    catch { throw Error('Unable to connect. Please retry or call 99668 81811.'); }
    let data;
    try { data = await response.json(); } catch { throw Error('Online booking is being connected. Please call 99668 81811.'); }
    if (!response.ok) throw Error(data.error || 'Please try again.');
    return data;
  }
  function status(parent) { const p=document.createElement('p'); p.setAttribute('role','status'); p.className='form-note full'; parent.append(p); return p; }
  async function bootstrap(){const data=await api('bootstrap');csrf=data.csrf;return data;}
  let boot = bootstrap();
  // Handle unavailable hosting without an unhandled rejection before submit.
  boot.catch(() => {});
  function keyFor() { let previous='', key=''; return body => {const next=JSON.stringify(body); if(next!==previous){previous=next;key=crypto.randomUUID();} return key;}; }
  if (contact) {
    const note=status(contact);let key=keyFor(),sending=false;
    contact.addEventListener('submit',async event => {
      event.preventDefault(); if(sending||!contact.reportValidity()) return;
      const button=contact.querySelector('[type=submit]');sending=true;button.disabled=true;note.textContent='Sending your enquiry…';
      try {await bootstrap(); const body=Object.fromEntries(new FormData(contact)); body.request_key=key(body); const result=await api('contact',body); note.textContent='Thank you. Your enquiry has been saved. Reference: '+result.reference+'. Our front desk will get in touch.'; contact.reset();key=keyFor();}
      catch(error){note.textContent=error.message;} finally{sending=false;button.disabled=false;}
    });
  }
  if(!form) return;
  const calendar=document.querySelector('#bookingCalendar'), note=document.querySelector('#bookingSlotStatus');
  const dateInput=form.elements.date, doctor=form.elements.doctor, timeInput=form.elements.slot, submit=form.querySelector('[type=submit]');
  const slug=()=>doctor.selectedIndex===1?'mounika':'chetan';
  const doctorDetails={
    chetan:{name:'Dr. Chetan Veeramaneni',specialty:'Nephrologist & Renal Transplant Physician',registration:'93478',photo:'assets/img/dr-chetan-profile-960-fd3035f6a8.webp'},
    mounika:{name:'Dr. T. Mounika Rao',specialty:'ENT, Head & Neck Surgeon',registration:'89681',photo:'assets/img/dr-mounika.jpg'}
  };
  function updateDoctor(){
    const detail=doctorDetails[slug()];
    document.querySelector('#bookingDoctorName').textContent=detail.name;
    document.querySelector('#bookingDoctorSpecialty').textContent=detail.specialty;
    document.querySelector('#bookingDoctorRegistration').textContent='NMR registration no. '+detail.registration;
    const photo=document.querySelector('#bookingDoctorPhoto');photo.src=detail.photo;photo.alt=detail.name;
  }
  const key=keyFor(); let today='',max='',selected='',visible,slots=[],minute=null,sequence=0,loading=true,ready=false;
  const dateKey=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
  function render() {
    updateDoctor();
    const selectedSlot=slots.find(s=>s.minute===minute);
    document.querySelector('#bookingSelection').textContent=selectedSlot?'Selected: '+selected+' at '+selectedSlot.label+' · '+doctorDetails[slug()].name:'Choose a date and time for your visit.';
    calendar.innerHTML='<strong class="booking-time-label">Preferred time · India time</strong><div class="booking-times"></div>';
    dateInput.min=today;dateInput.max=max;
    const times=calendar.querySelector('.booking-times');
    slots.forEach(slot=>{const b=document.createElement('button');b.type='button';b.textContent=slot.label;b.dataset.time=slot.minute;b.setAttribute('aria-pressed',String(slot.minute===minute));b.disabled=loading||!ready;times.append(b);});
    if(!slots.length) times.textContent=loading?'Checking availability…':'No available times. Please choose another date.';
    dateInput.value=selected; submit.disabled=loading||!ready||minute===null;
  }
  async function load() {
    const seq=++sequence; loading=true; slots=[]; minute=null; render(); note.textContent='';
    try { if(!ready){const setup=await api('bootstrap');if(seq!==sequence)return;csrf=setup.csrf;today=setup.today;max=setup.max_date;ready=true;if(selected<today)selected=today;} const data=await api('availability&doctor='+encodeURIComponent(slug())+'&date='+selected); if(seq!==sequence)return; today=data.today; slots=data.slots; }
    catch(error){if(seq!==sequence)return;ready=false;slots=previewTimes();note.textContent=error.message;}
    loading=false;render();
  }
  dateInput.addEventListener('change',()=>{
    if(!dateInput.value||!dateInput.checkValidity())return;
    selected=dateInput.value;load();
  });
  calendar.addEventListener('click',event=>{
    const button=event.target.closest('[data-time]');if(!button||button.disabled)return;
    minute=Number(button.dataset.time);timeInput.value=slots.find(s=>s.minute===minute).label;
    render();calendar.querySelector('[data-time="'+minute+'"]').focus();
  });
  form.querySelectorAll('[name=specialty]').forEach(r=>r.addEventListener('change',()=>{doctor.selectedIndex=r.id==='spec-ent'?1:0;if(today)load();}));
  doctor.addEventListener('change',()=>{document.querySelector(slug()==='mounika'?'#spec-ent':'#spec-kidney').checked=true;if(today)load();});
  if(new URLSearchParams(location.search).get('s')==='ent'){doctor.selectedIndex=1;document.querySelector('#spec-ent').checked=true;}
  function previewTimes() {
    return Array.from({length:8},(_,i)=>({minute:1080+i*30,label:(6+Math.floor(i/2))+':'+(i%2?'30':'00')+' PM'}));
  }
  // Present the picker immediately, even while the booking service is offline.
  const indiaDate=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'});
  const parts=Object.fromEntries(indiaDate.formatToParts(new Date()).map(p=>[p.type,p.value]));
  today=parts.year+'-'+parts.month+'-'+parts.day;selected=today;
  visible=new Date(today+'T12:00:00');visible.setDate(1);
  const limit=new Date(today+'T12:00:00');limit.setDate(limit.getDate()+90);max=dateKey(limit);
  dateInput.required=true;document.querySelector('#bookingDateFallback').hidden=false;
  document.querySelector('#bookingTimeFallback').hidden=true;calendar.hidden=false;slots=previewTimes();render();
  boot.then(data=>{
    ready=true;today=data.today;max=data.max_date;selected=today;visible=new Date(today+'T12:00:00');visible.setDate(1);load();
  }).catch(error=>{loading=false;ready=false;slots=previewTimes();render();note.textContent=error.message;});
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(!form.reportValidity()||loading||minute===null)return;
    submit.disabled=true; const success=document.querySelector('#formSuccess');success.classList.remove('show');
    const fields=new FormData(form),body={name:fields.get('name'),phone:fields.get('phone'),age:fields.get('age')===''?null:Number(fields.get('age')),doctor:slug(),date:selected,minute,visit:fields.get('visit'),message:fields.get('message'),website:fields.get('website')};body.request_key=key(body);
    try {const result=await api('book',body);success.textContent='Your appointment request has been saved. Reference: '+result.reference+'. Please call 99668 81811 if you need help.';success.classList.add('show');form.elements.message.value='';await load();}
    catch(error){await load();note.textContent=error.message;}finally{submit.disabled=loading||!ready||minute===null;}
  });
})();
