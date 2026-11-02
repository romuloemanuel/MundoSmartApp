from collections import Counter
from datetime import datetime
from pymongo import MongoClient

c = MongoClient(
    "mongodb://root:MongoDB2019!@localhost:27017/MundoSmart?authSource=admin",
    serverSelectionTimeoutMS=4000,
)
col = c["MundoSmart"]["os_local_data"]
print("total", col.estimated_document_count())
sits = Counter()
for d in col.find({}, {"situacao": 1}):
    sits[repr(d.get("situacao"))] += 1
print("situacoes:")
for k, v in sits.most_common(30):
    print(v, k)

import re
rx = re.compile(r"^conclu[ií]d[oa]$", re.I)
n = 0
print("--- concluidas sample ---")
for d in col.find({}, {"situacao": 1, "dataConclusao": 1, "osNumero": 1, "excluidoEm": 1}):
    s = d.get("situacao") or ""
    if isinstance(s, str) and rx.match(s.strip()):
        n += 1
        if n <= 10:
            print(d.get("osNumero"), repr(d.get("situacao")), d.get("dataConclusao"), "excl", d.get("excluidoEm"))
print("match regex python", n)

ini = datetime(2026, 9, 1)
fim = datetime(2026, 9, 14, 23, 59, 59)
print("dataConclusao in range", col.count_documents({"dataConclusao": {"$gte": ini, "$lte": fim}}))
print(
    "concluidas in range",
    col.count_documents(
        {
            "situacao": {"$regex": r"^conclu[ií]d[oa]$", "$options": "i"},
            "dataConclusao": {"$gte": ini, "$lte": fim},
        }
    ),
)
print("situacao contains conclu", col.count_documents({"situacao": {"$regex": "conclu", "$options": "i"}}))
print("any dataConclusao not null", col.count_documents({"dataConclusao": {"$ne": None}}))
