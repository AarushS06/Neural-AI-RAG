import time
from fastapi.testclient import TestClient
from app.main import app
client=TestClient(app)
def wait(did):
 for _ in range(40):
  d=client.get('/api/documents/'+did).json()
  if d.get('status') in ('completed','failed'): return d
  time.sleep(.05)
 raise AssertionError('ingestion timeout')
def test_templates_quality_and_featured_upload():
 assert client.get('/api/knowledge-bases/templates').status_code==200
 pdf=b'%PDF-1.4\nTitle: Guideline Study\nAuthors: Jane Doe\n2024\nDOI: 10.1234/example\nPMID: 12345678\nGuideline recommendations for patients. Email jane@example.org MRN: ABC12345.\n'
 r=client.post('/api/documents/upload',files={'file':('guideline.pdf',pdf,'application/pdf')},data={'template':'clinical_guidelines','version':'2','effective_date':'2024-01-01'}); assert r.status_code==200
 did=r.json()['document']['id']; d=wait(did); assert d['status']=='completed'; assert d['template']=='clinical_guidelines'; assert d['version']=='2'; assert d['phi_report']['flagged']; assert d['metadata']['metadata']['doi'].startswith('10.')
 assert client.get(f'/api/documents/{did}/versions').status_code==200
 p=client.get(f'/api/documents/{did}/preview').json(); assert p['redacted'] and 'jane@example.org' not in p['preview']
 q=client.get('/api/knowledge-bases/quality-report').json(); assert q['document_count']>=1 and 'template_distribution' in q
 c=client.post('/api/compare',json={'document_ids':[did]}).json(); assert 'heuristic_analysis' in c
 chat=client.post('/api/chat',json={'question':'What are the recommendations?','mode':'rag','template':'clinical_guidelines'}).json(); assert 'safety_notice' in chat and 'citations' in chat
 assert client.delete('/api/documents/'+did).status_code==200
