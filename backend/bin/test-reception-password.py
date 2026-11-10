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

# This server is isolated on 8094; all credentials below are disposable test accounts.
rec,rt,boot=login('testdesk','Altus-local-test-only!')
chetan,ct,_=login('testchetan','Altus-doctor-test-only!')
mounika,mt,_=login('testmounika','Altus-doctor-test-only!')
assert call(rec,'admin-reception-password',dict(current_password='Altus-local-test-only!',new_password='Altus10!xx'),rt)[0]==403
assert call(chetan,'admin-reception-password',dict(current_password='WrongPassword!',new_password='Altus10!xx'),ct)[0]==422
assert call(chetan,'admin-reception-password',dict(current_password='Altus-doctor-test-only!',new_password='Nine1234!'),ct)[0]==422
changed=False
try:
 code,result=call(chetan,'admin-reception-password',dict(current_password='Altus-doctor-test-only!',new_password='Altus10!xx'),ct)
 assert code==200,(code,result)
 changed=True
 assert call(rec,'admin-data&date='+boot['today'])[0]==401
 updated,ut,_=login('testdesk','Altus10!xx')
 assert call(updated,'admin-data&date='+boot['today'])[0]==200
 assert call(chetan,'admin-data&date='+boot['today'])[0]==200
finally:
 if changed:
  code,result=call(mounika,'admin-reception-password',dict(current_password='Altus-doctor-test-only!',new_password='Altus-local-test-only!'),mt)
  assert code==200,(code,result)
assert call(updated,'admin-data&date='+boot['today'])[0]==401
print('PASS: both doctors can reset reception, own password required, reception denied, length validated, reception sessions revoked, doctor session preserved. Test reception password restored.')
