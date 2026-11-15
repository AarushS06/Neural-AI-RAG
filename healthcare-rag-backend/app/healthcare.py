import re
from datetime import datetime, timezone

TEMPLATES = {
    'research_papers': {'label':'Research papers','guidance':'Report study design, population, limitations, and avoid causal overclaiming.'},
    'clinical_guidelines': {'label':'Clinical guidelines','guidance':'Prefer recommendations, issuing body, scope, strength, and effective date; not a substitute for local policy.'},
    'drug_information': {'label':'Drug information','guidance':'Include indication, dose context, contraindications, interactions, and source date; never personalize prescribing.'},
    'patient_education': {'label':'Patient education','guidance':'Use plain language and advise clinician consultation for individualized decisions.'},
    'hospital_policy': {'label':'Hospital policy','guidance':'Treat as organization-specific operational guidance and surface effective dates and supersession.'},
}

def classify(text, filename=''):
    s=(filename+' '+text[:12000]).lower()
    scores={k:0 for k in TEMPLATES}
    terms={'research_papers':['randomized','cohort','observational','study','abstract','methods','participants','doi'], 'clinical_guidelines':['guideline','recommendation','consensus','practice standard','grade of evidence'], 'drug_information':['dosage','contraindication','drug interactions','pharmacology','adverse reactions','indication'], 'patient_education':['patient information','talk to your doctor','what to expect','health education'], 'hospital_policy':['hospital policy','protocol','procedure','effective date','staff must']}
    for k, words in terms.items(): scores[k]=sum(s.count(w) for w in words)
    return max(scores, key=scores.get) if max(scores.values()) else 'research_papers'

def first(pattern, text, flags=re.I|re.M):
    m=re.search(pattern,text,flags); return m.group(1).strip() if m else 'not available'

def extract_metadata(text, filename='', template=None):
    head='\n'.join(text.splitlines()[:80])
    title=first(r'^(?:title\s*[:\-]\s*)?(.{8,180})$', head)
    if title=='not available': title=filename.rsplit('/',1)[-1].rsplit('.',1)[0] or 'not available'
    authors=first(r'^(?:authors?|by)\s*[:\-]\s*(.{3,200})$',head)
    year=first(r'\b((?:19|20)\d{2})\b',head)
    doi=first(r'\b(10\.\d{4,9}/[-._;()/:A-Z0-9]+)',text,re.I)
    pmid=first(r'(?:PMID\s*[:#]?\s*)(\d{5,9})',text)
    journal=first(r'(?:journal\s*[:\-]\s*)(.{3,160})',head)
    study=first(r'(randomized controlled trial|systematic review|meta-analysis|cohort study|case[- ]control|cross-sectional|guideline|qualitative study)',text)
    def field(labels):
        return first(r'(?:'+labels+r')\s*[:\-]\s*(.{3,300})',text)
    return {'title':title,'authors':authors,'year':year,'doi':doi,'pmid':pmid,'journal':journal,'study_type':study,'population':field('population|participants|patients'),'intervention':field('intervention|exposure|treatment'),'comparator':field('comparator|control'),'outcomes':field('outcomes?|results'), 'template':template or classify(text,filename)}

def phi_report(text):
    patterns={'email':r'\b[\w.+-]+@[\w-]+\.[\w.-]+\b','phone':r'(?<!\d)(?:\+?\d[\d .()\-]{8,}\d)(?!\d)','date_of_birth':r'\b(?:DOB|date of birth|born)\s*[:#-]?\s*\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b','medical_record_id':r'\b(?:MRN|medical record(?: number)?|patient ID)\s*[:#-]?\s*[A-Z0-9-]{4,}\b','name_like':r'\b(?:Patient|Name)\s*[:#-]\s*[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3}\b'}
    findings=[]
    for kind,p in patterns.items(): findings += [{'type':kind,'match':m.group(0)} for m in re.finditer(p,text,re.I)]
    return {'flagged':bool(findings),'count':len(findings),'types':sorted(set(x['type'] for x in findings)),'findings':findings[:50],'warning':'Deterministic screening only; review manually. Originals are never silently redacted.'}

def evidence_quality(meta, created_at=None):
    st=(meta.get('study_type') or '').lower(); year=meta.get('year','not available'); current=datetime.now(timezone.utc).year
    review='high' if ('systematic review' in st or 'meta-analysis' in st) else ('moderate' if 'randomized' in st else 'not available')
    kind='guideline' if meta.get('template')=='clinical_guidelines' or 'guideline' in st else ('review' if 'review' in st else ('primary_study' if st!='not available' else 'not available'))
    recency='recent' if year.isdigit() and current-int(year)<=5 else ('stale' if year.isdigit() else 'not available')
    source='identified' if meta.get('doi')!='not available' or meta.get('pmid')!='not available' else 'unknown'
    return {'study_type':st or 'not available','review_label':review,'document_type':kind,'recency_label':recency,'source_quality':source}

def redact_preview(text):
    return re.sub(r'\b[\w.+-]+@[\w-]+\.[\w.-]+\b','[REDACTED EMAIL]',re.sub(r'(?i)(MRN|medical record(?: number)?|patient ID)\s*[:#-]?\s*[A-Z0-9-]{4,}',r'\1: [REDACTED ID]',text))
