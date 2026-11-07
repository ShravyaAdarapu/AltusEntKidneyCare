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
  let boot = api('bootstrap').then(data => {csrf=data.csrf; return data;});
  // Handle unavailable hosting without an unhandled rejection before submit.
  boot.catch(() => {});
  function keyFor() { let previous='', key=''; return body => {const next=JSON.stringify(body); if(next!==previous){previous=next;key=crypto.randomUUID();} return key;}; }
  if (contact) {
    const note=status(contact), key=keyFor();
    contact.addEventListener('submit',async event => {
      event.preventDefault(); if(!contact.reportValidity()) return;
      const button=contact.querySelector('[type=submit]'); button.disabled=true;
      try {await boot; const body=Object.fromEntries(new FormData(contact)); body.request_key=key(body); const result=await api('contact',body); note.textContent='Thank you. Your enquiry has been saved. Reference: '+result.reference+'. Our front desk will get in touch.'; contact.reset();}
      catch(error){note.textContent=error.message;} finally{button.disabled=false;}
    });
  }
  if(!form) return;
  const calendar=document.querySelector('#bookingCalendar'), note=document.querySelector('#bookingSlotStatus');
  const dateInput=form.elements.date, doctor=form.elements.doctor, timeInput=form.elements.slot, submit=form.querySelector('[type=submit]');
  const slug=()=>doctor.selectedIndex===1?'mounika':'chetan';
  const key=keyFor(); let today='',max='',selected='',visible,slots=[],minute=null,sequence=0,loading=true;
  const dateKey=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
  function render() {
    const y=visible.getFullYear(),m=visible.getMonth(),first=dateKey(visible).slice(0,7);
    calendar.innerHTML=`<div class="booking-calendar-panel"><div class="booking-month"><strong>${visible.toLocaleDateString('en-IN',{month:'long',year:'numeric'})}</strong><div><button type="button" data-month="-1" aria-label="Previous month" ${first<=today.slice(0,7)?'disabled':''}>‹</button><button type="button" data-month="1" aria-label="Next month" ${first>=max.slice(0,7)?'disabled':''}>›</button></div></div><div class="booking-days">${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=>'<span>'+d+'</span>').join('')}${'<span></span>'.repeat(visible.getDay())}${Array.from({length:new Date(y,m+1,0).getDate()},(_,i)=>{const d=dateKey(new Date(y,m,i+1));return `<button type="button" data-date="${d}" aria-label="${d}" aria-pressed="${d===selected}" ${d<today||d>max?'disabled':''}>${i+1}</button>`;}).join('')}</div></div><strong class="booking-time-label">Available times · India time</strong><div class="booking-times"></div>`;
    const times=calendar.querySelector('.booking-times');
    slots.forEach(slot=>{const b=document.createElement('button');b.type='button';b.textContent=slot.label;b.dataset.time=slot.minute;b.setAttribute('aria-pressed',String(slot.minute===minute));b.disabled=loading;times.append(b);});
    if(!slots.length) times.textContent=loading?'Checking availability…':'No available times. Please choose another date.';
    dateInput.value=selected; submit.disabled=loading||minute===null;
  }
  async function load() {
    const seq=++sequence; loading=true; slots=[]; minute=null; render(); note.textContent='';
    try { const data=await api('availability&doctor='+encodeURIComponent(slug())+'&date='+selected); if(seq!==sequence)return; today=data.today; slots=data.slots; }
    catch(error){if(seq!==sequence)return;note.textContent=error.message;}
    loading=false;render();
  }
  calendar.addEventListener('click',event=>{
    const b=event.target.closest('button');if(!b||b.disabled)return;
    if(b.dataset.month){visible=new Date(visible.getFullYear(),visible.getMonth()+Number(b.dataset.month),1);render();}
    if(b.dataset.date){selected=b.dataset.date;load();}
    if(b.dataset.time){minute=Number(b.dataset.time);timeInput.value=slots.find(s=>s.minute===minute).label;render();calendar.querySelector('[data-time="'+minute+'"]').focus();}
  });
  form.querySelectorAll('[name=specialty]').forEach(r=>r.addEventListener('change',()=>{doctor.selectedIndex=r.id==='spec-ent'?1:0;if(today)load();}));
  doctor.addEventListener('change',()=>{document.querySelector(slug()==='mounika'?'#spec-ent':'#spec-kidney').checked=true;if(today)load();});
  if(new URLSearchParams(location.search).get('s')==='ent'){doctor.selectedIndex=1;document.querySelector('#spec-ent').checked=true;}
  submit.disabled=true;
  boot.then(data=>{
    today=data.today;max=data.max_date;selected=today;visible=new Date(today+'T12:00:00');visible.setDate(1);
    dateInput.required=false;document.querySelector('#bookingDateFallback').hidden=true;document.querySelector('#bookingTimeFallback').hidden=true;
    calendar.hidden=false;load();
  }).catch(error=>{note.textContent=error.message;});
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(!form.reportValidity()||loading||minute===null)return;
    submit.disabled=true; const success=document.querySelector('#formSuccess');success.classList.remove('show');
    const fields=new FormData(form),body={name:fields.get('name'),phone:fields.get('phone'),age:fields.get('age')===''?null:Number(fields.get('age')),doctor:slug(),date:selected,minute,visit:fields.get('visit'),message:fields.get('message'),website:fields.get('website')};body.request_key=key(body);
    try {const result=await api('book',body);success.textContent='Your appointment request has been saved. Reference: '+result.reference+'. Our front desk will confirm your visit. Please call 99668 81811 if you need help.';success.classList.add('show');form.elements.message.value='';await load();}
    catch(error){await load();note.textContent=error.message;}finally{submit.disabled=loading||minute===null;}
  });
})();
