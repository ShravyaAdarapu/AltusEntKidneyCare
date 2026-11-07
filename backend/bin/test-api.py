import urllib.request, urllib.error, http.cookiejar, json, uuid, datetime, concurrent.futures
BASE='http://127.0.0.1:8092/api/index.php?action='
def client():
 op=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
 return op
def call(op,action,body=None,csrf=''):
 req=urllib.request.Request(BASE+action,data=json.dumps(body).encode() if body is not None else None,headers={'Content-Type':'application/json','X-CSRF-Token':csrf})
 try:
  with op.open(req) as r:return r.status,json.load(r)
 except urllib.error.HTTPError as e:return e.code,json.load(e)
a=client();code,boot=call(a,'bootstrap');assert code==200,(code,boot)
token=boot['csrf'];date=(datetime.date.fromisoformat(boot['today'])+datetime.timedelta(days=1)).isoformat()
code,available=call(a,'availability&doctor=chetan&date='+date);assert len(available['slots'])==8,available
body=dict(name='Local Test',phone='9999999999',age=30,doctor='chetan',date=date,minute=1080,visit='First consultation',message='Backend verification',request_key=str(uuid.uuid4()))
code,saved=call(a,'book',body,token);assert code==201,(code,saved)
assert call(a,'book',body,token)[1]['reference']==saved['reference']
other=client();_,ob=call(other,'bootstrap');duplicate={**body,'request_key':str(uuid.uuid4())}
assert call(other,'book',duplicate,ob['csrf'])[0]==409
assert 1080 not in [s['minute'] for s in call(a,'availability&doctor=chetan&date='+date)[1]['slots']]
assert call(a,'book',{**body,'doctor':'mounika','request_key':str(uuid.uuid4())},token)[0]==201
assert call(a,'contact',dict(name='Test Enquiry',phone='9999999999',message='Test message',request_key=str(uuid.uuid4())),token)[0]==201
assert call(a,'admin-data')[0]==401
assert call(a,'book',body,'wrong')[0]==403
code,login=call(a,'login',dict(username='testdesk',password='Altus-local-test-only!'),token);assert code==200,(code,login)
token=login['csrf'];_,data=call(a,'admin-data&date='+date);assert len(data['appointments'])==2
appointment=next(x for x in data['appointments'] if x['reference']==saved['reference'])
assert call(a,'admin-status',dict(id=appointment['id'],status='confirmed'),token)[0]==200
assert call(a,'admin-status',dict(id=appointment['id'],status='cancelled'),token)[0]==200
assert 1080 in [s['minute'] for s in call(a,'availability&doctor=chetan&date='+date)[1]['slots']]
assert call(a,'admin-closure',dict(doctor='chetan',date=date,closed=True),token)[0]==200
assert call(a,'availability&doctor=chetan&date='+date)[1]['slots']==[]
assert call(a,'admin-closure',dict(doctor='chetan',date=date,closed=False),token)[0]==200
hours=[dict(open=True,start=660,end=720) for _ in range(7)]
assert call(a,'admin-hours',dict(doctor='chetan',hours=hours),token)[0]==200
assert len(call(a,'availability&doctor=chetan&date='+date)[1]['slots'])==2
assert call(a,'admin-logout',{},token)[0]==200
assert call(a,'admin-data')[0]==401
print('PASS: availability, persistence, idempotency, duplicate prevention, independent doctors, enquiries, authentication, CSRF, confirmation, cancellation/release, closures, weekly hours, logout.')
