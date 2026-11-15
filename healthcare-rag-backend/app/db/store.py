import sqlite3, json, uuid
from datetime import datetime, timezone
from pathlib import Path
class Store:
 def __init__(self,path): self.path=str(path); self.init()
 def conn(self): c=sqlite3.connect(self.path); c.row_factory=sqlite3.Row; return c
 def init(self):
  with self.conn() as c:
   c.executescript('''CREATE TABLE IF NOT EXISTS documents(id TEXT PRIMARY KEY,filename TEXT,stored_path TEXT,file_hash TEXT UNIQUE,title TEXT,status TEXT,error TEXT,created_at TEXT,updated_at TEXT,metadata TEXT,extracted TEXT); CREATE TABLE IF NOT EXISTS conversations(id TEXT PRIMARY KEY,title TEXT,created_at TEXT,updated_at TEXT); CREATE TABLE IF NOT EXISTS messages(id TEXT PRIMARY KEY,conversation_id TEXT,role TEXT,content TEXT,mode TEXT,citations TEXT,created_at TEXT);''')
   cols={r[1] for r in c.execute('PRAGMA table_info(documents)')}
   for name,typ in [('template','TEXT'),('version','TEXT'),('effective_date','TEXT'),('supersedes_document_id','TEXT'),('phi_report','TEXT'),('quality','TEXT')]:
    if name not in cols: c.execute(f'ALTER TABLE documents ADD COLUMN {name} {typ}')
 def now(self): return datetime.now(timezone.utc).isoformat()
 def add_doc(self,filename,path,h,meta=None,template='research_papers',version='1',effective_date=None,supersedes_document_id=None):
  did=str(uuid.uuid4()); now=self.now(); meta=meta or {}
  with self.conn() as c: c.execute('INSERT INTO documents(id,filename,stored_path,file_hash,title,status,error,created_at,updated_at,metadata,extracted,template,version,effective_date,supersedes_document_id,phi_report,quality) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',(did,filename,str(path),h,Path(filename).stem,'received','',now,now,json.dumps(meta),'[]',template,version,effective_date,supersedes_document_id,'{}','{}'))
  return did
 def find_hash(self,h):
  with self.conn() as c:return c.execute('SELECT * FROM documents WHERE file_hash=?',(h,)).fetchone()
 def get_doc(self,d):
  with self.conn() as c:return c.execute('SELECT * FROM documents WHERE id=?',(d,)).fetchone()
 def list_docs(self):
  with self.conn() as c:return c.execute('SELECT * FROM documents ORDER BY created_at DESC').fetchall()
 def versions(self,d):
  with self.conn() as c:
   row=c.execute('SELECT * FROM documents WHERE id=?',(d,)).fetchone()
   if not row:return []
   return c.execute('SELECT * FROM documents WHERE id=? OR supersedes_document_id=? ORDER BY version,created_at',(d,d)).fetchall()
 def update_doc(self,d,**kw):
  kw['updated_at']=self.now(); sets=','.join(k+'=?' for k in kw); vals=list(kw.values())+[d]
  with self.conn() as c:c.execute('UPDATE documents SET '+sets+' WHERE id=?',vals)
 def delete_doc(self,d):
  with self.conn() as c:c.execute('DELETE FROM documents WHERE id=?',(d,))
 def create_conv(self,title='New conversation'):
  i=str(uuid.uuid4()); n=self.now()
  with self.conn() as c:c.execute('INSERT INTO conversations VALUES(?,?,?,?)',(i,title,n,n))
  return i
 def conversations(self):
  with self.conn() as c:return c.execute('SELECT * FROM conversations ORDER BY updated_at DESC').fetchall()
 def conv(self,i):
  with self.conn() as c:
   x=c.execute('SELECT * FROM conversations WHERE id=?',(i,)).fetchone(); m=c.execute('SELECT * FROM messages WHERE conversation_id=? ORDER BY created_at',(i,)).fetchall(); return x,m
 def add_msg(self,cid,role,content,mode='',citations=None):
  with self.conn() as c:c.execute('INSERT INTO messages VALUES(?,?,?,?,?,?,?)',(str(uuid.uuid4()),cid,role,content,mode,json.dumps(citations or []),self.now())); c.execute('UPDATE conversations SET updated_at=? WHERE id=?',(self.now(),cid))
 def delete_conv(self,i):
  with self.conn() as c:c.execute('DELETE FROM messages WHERE conversation_id=?',(i,)); c.execute('DELETE FROM conversations WHERE id=?',(i,))
