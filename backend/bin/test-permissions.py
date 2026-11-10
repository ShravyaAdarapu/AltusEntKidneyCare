import urllib.request,urllib.error,http.cookiejar,json,uuid,datetime
BASE='http://127.0.0.1:8094/api/index.php?action='
def client():return urllib.request.build_opener(urllib.request.ProxyHandler({}),urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
def call(op,action,body=None,token=''):
 req=urllib.request.Request(BASE+action,data=json.dumps(body).encode() if body is not None else None,headers={'Content-Type':'application/json','X-CSRF-Token':token})
 try:
  with op.open(req,timeout=20) as r:return r.status,json.load(r)
 except urllib.error.HTTPError as e:return e.code,json.load(e)
def login(user,password):
 op=client();code,b=call(op,'bootstrap');assert code==200,(code,b)
 code,a=call(op,'login',{'username':user,'password':password},b['csrf']);assert code==200,(code,a)
 return op,a['csrf'],b
# Doctor-route sign-in must match that doctor's account, even with valid credentials.
for user,workspace,expected in [('testchetan','mounika',403),('testmounika','chetan',403),('testdesk','chetan',403),('testchetan','chetan',200),('testmounika','mounika',200)]:
 op=client();code,b=call(op,'bootstrap');assert code==200
 password='Altus-local-test-only!' if user=='testdesk' else 'Altus-doctor-test-only!'
 code,result=call(op,'login',dict(username=user,password=password,workspace=workspace),b['csrf'])
 assert code==expected,(user,workspace,code)
 if code==200:call(op,'admin-logout',{},result['csrf'])

rec,token,boot=login('testdesk','Altus-local-test-only!')
assert call(rec,'admin-password',dict(current_password='Altus-local-test-only!',new_password='Reception-must-not-change!'),token)[0]==403
chetan,ct,_=login('testchetan','Altus-doctor-test-only!');mounika,mt,_=login('testmounika','Altus-doctor-test-only!')
start=datetime.date.fromisoformat(boot['today'])+datetime.timedelta(days=30)
while start.weekday()==6:start+=datetime.timedelta(days=1)
date=start.isoformat();tag='RoleTest-'+uuid.uuid4().hex[:8]
refs={}
for doctor in ['chetan','mounika']:
 code,av=call(rec,'availability&doctor='+doctor+'&date='+date);assert code==200 and av['slots'],av
 body=dict(name=tag,phone='9999999999',age=40,doctor=doctor,date=date,minute=av['slots'][0]['minute'],visit='First consultation',message='<img src=x onerror=alert(1)>',request_key=str(uuid.uuid4()))
 code,result=call(rec,'admin-create',body,token);assert code==201,(code,result);refs[doctor]=result['reference']
f={'from':date,'to':date,'doctor':'','status':'','search':tag,'page':1}
assert call(rec,'admin-list',f,token)[1]['total']==2
own=call(chetan,'admin-list',f,ct)[1];assert own['total']==1 and own['appointments'][0]['doctor_slug']=='chetan',own
shared=call(chetan,'admin-list',{**f,'shared':True},ct)[1];assert shared['total']==2,shared
assert call(chetan,'admin-list',{**f,'doctor':'mounika'},ct)[0]==403
assert call(chetan,'admin-list',{**f,'doctor':'mounika','shared':True},ct)[1]['total']==1
other=next(a for a in shared['appointments'] if a['doctor_slug']=='mounika');mine=own['appointments'][0]
assert call(chetan,'admin-status',dict(id=int(other['id']),status='cancelled'),ct)[0]==403
assert call(chetan,'admin-reschedule',dict(id=int(other['id']),date=date,minute=1290,expected_date=date,expected_minute=int(other['start_minute'])),ct)[0]==403
assert call(chetan,'admin-create',dict(name='Blocked Test',phone='9999999999',doctor='mounika'),ct)[0]==403
hours=[dict(open=i!=0,start=1080,end=1320) for i in range(7)]
assert call(chetan,'admin-hours',dict(doctor='mounika',hours=hours),ct)[0]==403
assert call(chetan,'admin-hours',dict(doctor='chetan',hours=hours),ct)[0]==200
assert call(chetan,'admin-closure',dict(doctor='mounika',date=date,closed=True),ct)[0]==403
assert call(chetan,'admin-enquiry',dict(id=1,resolved=True),ct)[0]==403
assert call(chetan,'admin-data')[1]['enquiries']==[]
assert len(call(chetan,'admin-history',dict(name=tag,phone='9999999999'),ct)[1]['visits'])==1
assert len(call(chetan,'admin-history',dict(name=tag,phone='9999999999',shared=True),ct)[1]['visits'])==2
for op,tok,expected in [(chetan,ct,1),(mounika,mt,1),(rec,token,2)]:
 code,a=call(op,'admin-analytics',{'from':date,'to':date,'doctor':'','shared':False},tok)
 assert code==200,(code,a)
 # Dates may contain earlier test runs, but doctor's analytics cannot expose another doctor.
 assert len(a['doctors'])==expected,a
assert len(call(chetan,'admin-analytics',{'from':date,'to':date,'doctor':'','shared':True},ct)[1]['doctors'])==2
assert call(chetan,'admin-status',dict(id=int(mine['id']),status='confirmed'),ct)[0]==200
assert call(chetan,'admin-status',dict(id=str(mine['id']),status='confirmed'),ct)[0]==422
assert call(rec,'admin-create',{},token)[0]==422
assert call(rec,'admin-analytics',{'from':'2020-01-01','to':date,'doctor':''},token)[0]==422
assert call(rec,'admin-list',f,'bad-token')[0]==403
# A public booking still works without staff authentication.
public=client();_,pboot=call(public,'bootstrap');av=call(public,'availability&doctor=chetan&date='+date)[1]
b=dict(name=tag+' Public',phone='9999999999',age=None,doctor='chetan',date=date,minute=av['slots'][0]['minute'],visit='First consultation',message='',request_key=str(uuid.uuid4()))
assert call(public,'book',b,pboot['csrf'])[0]==201
assert call(public,'admin-list',f,pboot['csrf'])[0]==401
# Password change revokes old sessions; restore only the disposable test password.
oldsession,oldtoken,_=login('testmounika','Altus-doctor-test-only!')
code,changed=call(mounika,'admin-password',dict(current_password='Altus-doctor-test-only!',new_password='Altus-test-changed-only!'),mt);assert code==200,(code,changed)
assert call(oldsession,'admin-list',f,oldtoken)[0]==401
assert call(mounika,'admin-password',dict(current_password='Altus-test-changed-only!',new_password='Altus-doctor-test-only!'),changed['csrf'])[0]==200
print('PASS: doctor isolation, shared read-only access, cross-doctor edit/create/reschedule/schedule denial, own schedule permissions, scoped histories/analytics, receptionist access, validated IDs, CSRF, anonymous booking, and password/session revocation. Isolated database only.')
