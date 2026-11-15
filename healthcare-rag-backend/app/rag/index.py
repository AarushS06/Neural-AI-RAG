import json, re, math, threading
from pathlib import Path
import numpy as np
class LocalIndex:
 def __init__(self,path,dim=384): self.path=Path(path); self.dim=dim; self.lock=threading.Lock(); self.items=[]; self.vectors=np.empty((0,dim),dtype=np.float32); self.load()
 def embed(self,text):
  v=np.zeros(self.dim,dtype=np.float32)
  for tok in re.findall(r'\w+',text.lower()): v[hash(tok)%self.dim]+=1
  n=np.linalg.norm(v); return v/n if n else v
 def load(self):
  if self.path.exists():
   try:
    z=np.load(self.path,allow_pickle=True); self.vectors=z['vectors'].astype(np.float32); self.items=z['items'].tolist()
   except Exception: pass
 def save(self): self.path.parent.mkdir(parents=True,exist_ok=True); np.savez_compressed(self.path,vectors=self.vectors,items=np.array(self.items,dtype=object))
 def add(self,chunks):
  with self.lock:
   self.items.extend(chunks); x=np.vstack([self.vectors]+[np.vstack([self.embed(c['content']) for c in chunks])]) if chunks else self.vectors; self.vectors=x; self.save()
 def remove_doc(self,d):
  with self.lock:
   keep=[i for i,c in enumerate(self.items) if c['document_id']!=d]; self.items=[self.items[i] for i in keep]; self.vectors=self.vectors[keep] if keep else np.empty((0,self.dim),dtype=np.float32); self.save()
 def search(self,q,k=8,doc_id=None):
  if not self.items:return []
  ids=[i for i,c in enumerate(self.items) if not doc_id or c['document_id']==doc_id]
  if not ids:return []
  qv=self.embed(q); dense=[(float(np.dot(qv,self.vectors[i])),i) for i in ids]
  terms=set(re.findall(r'\w+',q.lower())); sparse=[]
  for i in ids:
   toks=re.findall(r'\w+',self.items[i]['content'].lower()); sparse.append((sum(t in toks for t in terms)/(len(terms) or 1),i))
  dense.sort(reverse=True); sparse.sort(reverse=True); scores={}
  for rank,(_,i) in enumerate(dense):scores[i]=scores.get(i,0)+1/(60+rank+1)
  for rank,(_,i) in enumerate(sparse):scores[i]=scores.get(i,0)+1/(60+rank+1)
  return [dict(self.items[i],score=round(scores[i],6),dense_score=round(dict(dense).get(i,0),6)) for i in sorted(scores,key=scores.get,reverse=True)[:k]]
