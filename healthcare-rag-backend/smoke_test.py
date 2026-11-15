import sys
from fastapi.testclient import TestClient
from app.main import app, store

client = TestClient(app)

def run_smoke_tests():
    print("==================================================")
    print(" Healthcare Research RAG - API Smoke Test Suite   ")
    print("==================================================")

    passed = 0
    failed = 0

    endpoints = [
        ("Health check", "GET", "/health", None),
        ("LLM health check", "GET", "/api/llm/health", None),
        ("System status", "GET", "/api/system/status", None),
        ("Knowledge base templates", "GET", "/api/knowledge-bases/templates", None),
        ("Quality report", "GET", "/api/knowledge-bases/quality-report", None),
        ("RAG configuration", "GET", "/api/rag/config", None),
        ("Dashboard consolidated view", "GET", "/api/dashboard", None),
        ("Documents listing", "GET", "/api/documents", None),
        ("Chat conversations list", "GET", "/api/chat/conversations", None),
        ("Search (local + web)", "POST", "/api/search", {"query": "clinical trials", "top_k": 3, "scope": "both"}),
        ("Chat answering (knowledge mode)", "POST", "/api/chat", {"question": "What is hypertension?", "mode": "knowledge"}),
        ("Chat answering (RAG mode)", "POST", "/api/chat", {"question": "What is hypertension?", "mode": "rag"}),
        ("Chat answering (combined mode)", "POST", "/api/chat", {"question": "What is hypertension?", "mode": "combined"}),
        ("Chat streaming", "POST", "/api/chat/stream", {"question": "Summary test", "mode": "knowledge"}),
    ]

    for name, method, path, payload in endpoints:
        try:
            if method == "GET":
                res = client.get(path)
            elif method == "POST":
                res = client.post(path, json=payload)
            else:
                res = None

            if res and res.status_code == 200:
                print(f"[PASS] {name} ({method} {path}) -> HTTP {res.status_code}")
                passed += 1
            else:
                status = res.status_code if res else "No response"
                print(f"[FAIL] {name} ({method} {path}) -> HTTP {status}")
                failed += 1
        except Exception as e:
            print(f"[FAIL] {name} ({method} {path}) -> Exception: {e}")
            failed += 1

    # Test Compare with 2 dummy documents
    try:
        did1 = store.add_doc("paper_a.pdf", "/tmp/a.pdf", "hash_smoke_a")
        did2 = store.add_doc("paper_b.pdf", "/tmp/b.pdf", "hash_smoke_b")
        res_comp = client.post("/api/compare", json={"document_ids": [did1, did2]})
        if res_comp.status_code == 200 and "heuristic_analysis" in res_comp.json():
            print(f"[PASS] Document comparison (POST /api/compare) -> HTTP {res_comp.status_code}")
            passed += 1
        else:
            print(f"[FAIL] Document comparison (POST /api/compare) -> HTTP {res_comp.status_code}")
            failed += 1
        store.delete_doc(did1)
        store.delete_doc(did2)
    except Exception as e:
        print(f"[FAIL] Document comparison -> Exception: {e}")
        failed += 1

    print("--------------------------------------------------")
    print(f"Total: {passed + failed} | Passed: {passed} | Failed: {failed}")
    print("==================================================")
    return 0 if failed == 0 else 1

if __name__ == "__main__":
    sys.exit(run_smoke_tests())
