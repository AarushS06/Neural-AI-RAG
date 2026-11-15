import re
import logging
import asyncio
from typing import List, Dict, Any, Optional, Tuple
import httpx

logger = logging.getLogger(__name__)

def normalize_title(title: str) -> str:
    """Normalizes title for deduplication."""
    return re.sub(r'[^a-z0-9]', '', (title or '').lower())

class WebSearchClient:
    def __init__(self, settings):
        self.settings = settings
        self.timeout = settings.request_timeout or 15.0
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 (Healthcare-Research-RAG/2.0)"
        }

    async def search_google(self, query: str, limit: int = 5) -> List[Dict[str, Any]]:
        """Google Programmable Search Engine."""
        if not self.settings.google_api_key or not self.settings.google_cse_id:
            return []
        url = "https://www.googleapis.com/customsearch/v1"
        params = {
            "key": self.settings.google_api_key,
            "cx": self.settings.google_cse_id,
            "q": query,
            "num": min(limit, 10),
        }
        try:
            async with httpx.AsyncClient(timeout=self.timeout, headers=self.headers) as client:
                res = await client.get(url, params=params)
                if res.status_code != 200:
                    return []
                data = res.json()
                results = []
                for i, item in enumerate(data.get("items", [])):
                    link = item.get("link", "")
                    is_pdf = link.lower().endswith(".pdf")
                    results.append({
                        "id": f"google-{i}-{hash(link)%100000}",
                        "title": item.get("title", ""),
                        "authors": "Web Source",
                        "year": "",
                        "venue": item.get("displayLink", ""),
                        "abstract": item.get("snippet", ""),
                        "url": link,
                        "doi": "",
                        "open_access_pdf_url": link if is_pdf else None,
                        "source": "google_search",
                        "relevance_score": round(1.0 - (i * 0.05), 2),
                    })
                return results
        except Exception as e:
            logger.warning(f"Google search error: {e}")
            return []

    async def search_europe_pmc(self, query: str, limit: int = 6) -> List[Dict[str, Any]]:
        """Europe PMC Search API (Free, no key)."""
        url = "https://europepmc.org/RestAPI/v1/search"
        params = {
            "query": query,
            "format": "json",
            "pageSize": min(limit, 25),
            "resultType": "core",
        }
        try:
            async with httpx.AsyncClient(timeout=self.timeout, headers=self.headers) as client:
                res = await client.get(url, params=params)
                if res.status_code != 200:
                    return []
                data = res.json()
                results = []
                for i, doc in enumerate(data.get("resultList", {}).get("result", [])):
                    doi = doc.get("doi", "")
                    title = doc.get("title", "").rstrip(".")
                    abstract = doc.get("abstractText", "") or f"Paper published in {doc.get('journalTitle', '')}"
                    pmid = doc.get("pmid", "")
                    pdf_url = None
                    # Check open access links
                    if doc.get("isOpenAccess") == "Y":
                        pdf_url = f"https://europepmc.org/backend/ptpmcrender.fcgi?accid={doc.get('pmcid')}&blobtype=pdf" if doc.get('pmcid') else None

                    results.append({
                        "id": f"epmc-{doc.get('id', i)}",
                        "title": title,
                        "authors": doc.get("authorString", "Unknown authors"),
                        "year": str(doc.get("pubYear", "")),
                        "venue": doc.get("journalTitle", ""),
                        "abstract": abstract,
                        "url": f"https://europepmc.org/article/MED/{pmid}" if pmid else (f"https://doi.org/{doi}" if doi else ""),
                        "doi": doi,
                        "open_access_pdf_url": pdf_url,
                        "source": "europe_pmc",
                        "relevance_score": round(0.95 - (i * 0.04), 2),
                    })
                return results
        except Exception as e:
            logger.warning(f"Europe PMC search error: {e}")
            return []

    async def search_semantic_scholar(self, query: str, limit: int = 6) -> List[Dict[str, Any]]:
        """Semantic Scholar Academic Graph API (Free, no key)."""
        url = "https://api.semanticscholar.org/graph/v1/paper/search"
        params = {
            "query": query,
            "limit": min(limit, 15),
            "fields": "title,authors,year,venue,abstract,url,openAccessPdf,externalIds",
        }
        try:
            async with httpx.AsyncClient(timeout=self.timeout, headers=self.headers) as client:
                res = await client.get(url, params=params)
                if res.status_code != 200:
                    return []
                data = res.json()
                results = []
                for i, doc in enumerate(data.get("data", [])):
                    authors = ", ".join(a.get("name", "") for a in doc.get("authors", []))
                    ext_ids = doc.get("externalIds") or {}
                    doi = ext_ids.get("DOI", "")
                    oa = doc.get("openAccessPdf") or {}
                    pdf_url = oa.get("url")

                    results.append({
                        "id": f"s2-{doc.get('paperId', i)[:12]}",
                        "title": doc.get("title", ""),
                        "authors": authors or "Unknown",
                        "year": str(doc.get("year") or ""),
                        "venue": doc.get("venue", ""),
                        "abstract": doc.get("abstract") or "Abstract not provided.",
                        "url": doc.get("url") or (f"https://doi.org/{doi}" if doi else ""),
                        "doi": doi,
                        "open_access_pdf_url": pdf_url,
                        "source": "semantic_scholar",
                        "relevance_score": round(0.92 - (i * 0.04), 2),
                    })
                return results
        except Exception as e:
            logger.warning(f"Semantic Scholar search error: {e}")
            return []

    async def search_pubmed(self, query: str, limit: int = 5) -> List[Dict[str, Any]]:
        """PubMed NCBI E-Utilities (Free, no key)."""
        search_url = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi"
        summary_url = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi"
        try:
            async with httpx.AsyncClient(timeout=self.timeout, headers=self.headers) as client:
                s_res = await client.get(search_url, params={"db": "pubmed", "term": query, "retmode": "json", "retmax": limit})
                if s_res.status_code != 200:
                    return []
                id_list = s_res.json().get("esearchresult", {}).get("idlist", [])
                if not id_list:
                    return []

                sum_res = await client.get(summary_url, params={"db": "pubmed", "id": ",".join(id_list), "retmode": "json"})
                if sum_res.status_code != 200:
                    return []
                res_dict = sum_res.json().get("result", {})

                results = []
                for i, pmid in enumerate(id_list):
                    doc = res_dict.get(pmid, {})
                    doi = ""
                    for article_id in doc.get("articleids", []):
                        if article_id.get("idtype") == "doi":
                            doi = article_id.get("value", "")
                            break

                    authors = ", ".join(a.get("name", "") for a in doc.get("authors", []))
                    results.append({
                        "id": f"pubmed-{pmid}",
                        "title": doc.get("title", "").rstrip("."),
                        "authors": authors or "Unknown",
                        "year": str(doc.get("pubdate", "")[:4]),
                        "venue": doc.get("source", ""),
                        "abstract": f"PubMed indexed literature from {doc.get('source', '')}",
                        "url": f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/",
                        "doi": doi,
                        "open_access_pdf_url": None,
                        "source": "pubmed",
                        "relevance_score": round(0.90 - (i * 0.04), 2),
                    })
                return results
        except Exception as e:
            logger.warning(f"PubMed search error: {e}")
            return []

    async def search_all(self, query: str, top_k: int = 10) -> Tuple[List[Dict[str, Any]], List[str]]:
        """
        Runs searches across Google, Europe PMC, Semantic Scholar, and PubMed.
        Deduplicates by DOI and title, and returns top_k results.
        """
        warnings = []
        tasks = []

        # 1. Google (if configured)
        if self.settings.google_api_key and self.settings.google_cse_id:
            tasks.append(self.search_google(query, limit=top_k))

        # 2. Free academic engines (Europe PMC, Semantic Scholar, PubMed)
        tasks.append(self.search_europe_pmc(query, limit=top_k))
        tasks.append(self.search_semantic_scholar(query, limit=top_k))
        tasks.append(self.search_pubmed(query, limit=top_k))

        results_lists = await asyncio.gather(*tasks, return_exceptions=True)

        merged: List[Dict[str, Any]] = []
        seen_dois = set()
        seen_titles = set()

        for res in results_lists:
            if isinstance(res, Exception):
                warnings.append(str(res))
                continue
            for item in res:
                doi = (item.get("doi") or "").lower().strip()
                norm_t = normalize_title(item.get("title", ""))

                if doi and doi in seen_dois:
                    continue
                if norm_t and norm_t in seen_titles:
                    continue

                if doi:
                    seen_dois.add(doi)
                if norm_t:
                    seen_titles.add(norm_t)

                merged.append(item)

        # Sort by relevance score
        merged.sort(key=lambda x: x.get("relevance_score", 0), reverse=True)
        return merged[:top_k], warnings
