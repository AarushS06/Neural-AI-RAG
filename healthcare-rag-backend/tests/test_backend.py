import io, time
from fastapi.testclient import TestClient
from app.main import app,store,index
client=TestClient(app)
def wait(did):
 for _ in range(80):
  r=client.get('/api/documents/'+did).json()
  if r['status'] in ('completed','failed'):return r
  time.sleep(.05)
def test_health_and_validation():
 assert client.get('/health').status_code==200
 assert client.post('/api/documents/upload',files={'file':('x.txt',b'no','text/plain')}).status_code==400
def test_upload_retrieve_chat_delete():
 pdf=b'%PDF-1.4\n1 Introduction\nAspirin reduces inflammation in this research study.\n2 Limitations\nThe sample was small.\n'
 r=client.post('/api/documents/upload',files={'file':('study.pdf',pdf,'application/pdf')}); assert r.status_code==200; did=r.json()['document']['id']; d=wait(did); assert d['status']=='completed'; assert d['metadata']['chunks']>=1
 s=client.post('/api/rag/retrieve',json={'query':'inflammation aspirin'}); assert s.status_code==200 and s.json()['results']
 c=client.post('/api/chat',json={'question':'What reduces inflammation?','mode':'rag'}); assert c.status_code==200 and c.json()['citations']
 cid=c.json()['conversation_id']; assert client.get('/api/chat/conversations/'+cid).status_code==200; assert client.delete('/api/chat/conversations/'+cid).status_code==200
 assert client.delete('/api/documents/'+did).status_code==200
