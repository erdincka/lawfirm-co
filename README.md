# Justitia & Associates — case management with the AI inside the firm

A law firm's case files are close to the worst thing you could paste into a public AI
service: privileged, personally identifying, and often under a court's control.
**Justitia & Associates** is a demo case management system built the other way round —
cases, documents and evidence in the firm's own database, and an assistant that reads
those actual files, running against a model endpoint the firm nominates. Ask it to
identify everyone involved in a case and it works through the uploaded documents and
returns a *dramatis personae* — who is the defendant, who is a witness, what the
evidence says about each — which you can then save back to the case as a PDF. It is a
reference for teams building document-heavy AI tools in regulated settings, where the
interesting constraint is never the model but where the documents are allowed to go.

> Everything here is fictional: the firm, the cases, the people and the documents are
> all synthetic test data.

![The case dashboard: active cases with status, type and lead defendant](docs/images/Dashboard.png)

<table>
<tr>
<td width="50%"><img src="docs/images/DramatisPersonaeTreeView.png" alt="An automatically generated cast list for a case, grouped by role"></td>
<td width="50%"><img src="docs/images/CaseChat.png" alt="The case assistant answering a question using the case's own documents"></td>
</tr>
<tr>
<td><em>Dramatis personae, extracted from the case's own documents and exportable as a PDF.</em></td>
<td><em>The assistant answers from the case file, and will show you the chunks it used.</em></td>
</tr>
</table>

More screenshots are in [docs/images](./docs/images).

## How it fits together

```mermaid
flowchart TB
    browser["Browser"]
    fe["<b>Frontend</b><br/>Next.js 15 · TypeScript · Tailwind"]
    be["<b>Backend</b><br/>FastAPI · Python 3.12"]
    db[("PostgreSQL<br/><i>cases · documents · evidence</i>")]
    model["Model endpoint<br/><i>OpenAI-compatible</i>"]

    browser --> fe --> be
    be <--> db
    be -->|"question + case context<br/>built from stored documents"| model

    classDef app fill:#eef2ff,stroke:#4f46e5,color:#1e1b4b;
    classDef ext fill:#f1f5f9,stroke:#475569,color:#0f172a;
    class fe,be app;
    class browser,db,model ext;
```

The backend assembles context itself: for a given case it pulls the record, the
readable documents attached to it, and the evidence log, and sends that with the
question. A debug panel shows exactly what was sent, which matters more than usual
when the answer is about someone's case.

## Features

**Case management** — create and track cases (defendant, type, status, lead attorney),
upload and view documents, log categorised evidence, download or print any document.

**The assistant** — chat scoped to a single case, with context built automatically
from that case's data; multi-model support over any OpenAI-compatible API; video Q&A;
automatic *dramatis personae* generation with table, tree and spider views; and a
debug panel showing the assembled prompt and retrieved chunks.

**Admin** — browse the database with pagination, inspect individual records, and
configure or auto-discover model endpoints.

## Running it

### Prerequisites

- A Kubernetes cluster with [Tilt](https://tilt.dev) for the development loop
- PostgreSQL (the dev environment brings its own)
- A model endpoint speaking the OpenAI chat API

### Development

```bash
git clone https://github.com/erdincka/lawfirm-co
cd lawfirm-co
tilt up
```

| Service | URL |
|---|---|
| Frontend | <http://localhost:3000> |
| Backend | <http://localhost:8000> |
| API docs | <http://localhost:8000/docs> |

To run the two halves directly instead:

```bash
# backend
cd backend && python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload

# frontend
cd frontend && npm install && npm run dev
```

### Configuration

| Where | Variable | Purpose |
|---|---|---|
| `backend/.env` | `DATABASE_URL` | `postgresql://user:password@postgres:5432/lawfirm` |
| `frontend/.env.local` | `BACKEND_URL` | `http://localhost:8000` |
| `frontend/.env.local` | `NEXT_PUBLIC_API_URL` | `http://localhost:8000` |

The model endpoint and key are set in the **Admin** page at runtime, not in the
environment — the Admin page can also discover endpoints exposed by the cluster.

### Deploying

A Helm chart is in `helm/lawfirm-co`. On
[HPE Private Cloud AI](https://www.hpe.com/us/en/hpe-private-cloud-ai.html) the
**Import Framework** wizard takes the packaged chart and
[`lawfirm-ai-logo.png`](./lawfirm-ai-logo.png); `helm/redeploy.sh` repackages and
reapplies in one step. Note that the platform's authentication proxy is **not**
wired up — the app does its own thing, so do not treat a deployment as access
controlled.

Production images:

```bash
docker build -f backend/Dockerfile.prod  -t lawfirm-backend:latest  ./backend
docker build -f frontend/Dockerfile.prod -t lawfirm-frontend:latest ./frontend
```

## API

Full interactive docs at `/docs` once the backend is running. The main routes:

| Method | Path | Purpose |
|---|---|---|
| `GET` / `POST` | `/cases` | List or create cases |
| `GET` | `/cases/{id}` | Case detail |
| `POST` | `/cases/{id}/documents` | Upload a document |
| `POST` | `/cases/{id}/evidence` | Add evidence |
| `POST` | `/chat/cases/{id}` | Ask about a case |
| `GET` | `/admin/tables` | Browse the database |
| `GET` | `/health` | Health check |

## Status

Demonstration software, not a product. There is no authentication, no tenancy and no
audit trail; the security work in it is limited to non-root containers, secrets kept
out of the image, API keys masked in the UI, input validation and CORS. Do not put
real case material in it.

### Roadmap

- [x] Advanced search and filtering
- [x] Video Q&A
- [ ] Retrieval across shared documents, not just the current case
