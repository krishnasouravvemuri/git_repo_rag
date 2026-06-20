# Repo RAG

Ask questions about any Git repository in natural language — by text or voice. Paste a repo URL, the app clones it, embeds the code into a vector store, and answers your questions grounded in that code using an LLM. Supports one-shot questions and multi-turn voice **conversations** (with spoken replies).

## How it works

- **Ingest** — clone repo (shallow) → load text files → chunk → embed with `all-MiniLM-L6-v2` → store vectors in ChromaDB (`data/`), scoped per repo.
- **Ask** — embed the query → retrieve top matching chunks (filtered to the repo) → feed as context to Groq `llama-3.1-8b-instant` → return a grounded answer.
- **Conversation** — multi-turn, voice-driven. Speech-to-text via Groq Whisper, answers read aloud via Groq TTS (with a browser Speech-Synthesis fallback).

## Tech stack

| Layer       | Tech                                                          |
|-------------|--------------------------------------------------------------|
| Backend     | Django + Django REST Framework, JWT auth                     |
| Frontend    | React + Vite                                                 |
| Vector DB   | ChromaDB (persistent, on-disk in `data/`)                    |
| Embeddings  | `sentence-transformers` — `all-MiniLM-L6-v2`                 |
| LLM         | Groq `llama-3.1-8b-instant` (via `langchain-groq`)           |
| Voice       | Groq Whisper (STT) + Groq Orpheus TTS / browser fallback     |

## Prerequisites

- **Python 3.12+**
- **Node.js 18+** and npm
- **git** on PATH (used to clone target repos)
- A **Groq API key** — https://console.groq.com

## Setup

### 1. Clone and enter the project

```bash
git clone <this-repo-url>
cd git_repo_rag
```

### 2. Backend — Python environment

```bash
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### 3. Environment variables

Create a `.env` file in the project root:

```env
GROQ_API_KEY=your_groq_api_key_here
```

### 4. Database migrations

```bash
python manage.py migrate
```

### 5. Frontend — install dependencies

```bash
cd frontend
npm install
cd ..
```

## Running the app

You need **two terminals** — one for the backend, one for the frontend.

### Terminal 1 — backend (port 8000)

```bash
source .venv/bin/activate
python manage.py runserver
```

### Terminal 2 — frontend dev server (port 5173)

```bash
cd frontend
npm run dev
```

Open **http://localhost:5173** in Chrome or Edge (voice features use the Web Speech API).

> The frontend calls the backend at `/api/v2/core/...`. CORS is pre-configured for `localhost:5173`. If you change the frontend port, update `CORS_ALLOWED_ORIGINS` in `git_repo_rag/settings.py`.

## Using it

1. **Register / Log in** with an email and password.
2. **Add Repo** — paste a public Git URL (optionally a branch + title) and ingest it. First ingest downloads the embedding model (~80 MB) and can take a while for large repos.
3. Open the repo, then:
   - **Ask** — type or dictate a single question. Tap the mic and choose **Question** to dictate.
   - **Conversation** — tap the mic and choose **Conversation** (or the Conversation tab). Press-to-talk each turn; the answer is shown and read aloud. Press **End conversation** to stop.
   - **History** — two sections: **Questions** and **Conversations**, each persisted with its own DB id. Open a conversation to see its transcript and **Continue** it; delete questions or conversations.

## Voice / TTS notes

- **Speech-to-text** uses Groq Whisper — works out of the box with your `GROQ_API_KEY`.
- **Text-to-speech** uses Groq `canopylabs/orpheus-v1-english`, which requires a one-time **terms acceptance** by the org admin: https://console.groq.com/playground?model=canopylabs%2Forpheus-v1-english
- If the Groq TTS model is unavailable, the app automatically falls back to the **browser's built-in speech synthesis**, so the model still speaks back.

## Production build (optional)

```bash
cd frontend
npm run build      # outputs to frontend/dist
npm run preview    # serve the built bundle locally
```

## Project layout

```
git_repo_rag/
├── manage.py
├── requirements.txt
├── .env                       # GROQ_API_KEY (not committed)
├── data/                      # ChromaDB persistent vector store
├── git_repo_rag/
│   ├── settings.py, urls.py   # Django config + root routes
│   ├── utils/response.py      # uniform API response envelope
│   └── core/
│       ├── data_loader.py     # clone + load repo files
│       ├── embedding.py       # chunk + embed
│       ├── vector_db.py       # ChromaDB wrapper
│       ├── repo_ingest.py     # ingest pipeline
│       ├── rag_search.py      # retrieval + LLM answer/chat
│       ├── transcribe.py      # Whisper STT + Orpheus TTS
│       ├── models.py          # Repo, Question, Conversation models
│       ├── views.py, urls.py  # REST API
│       └── migrations/
└── frontend/
    └── src/                   # React app (Ask, Conversation, History, ...)
```

## API endpoints (`/api/v2/core/`)

| Method | Path                          | Purpose                          |
|--------|-------------------------------|----------------------------------|
| POST   | `register`                    | Create account, returns JWT      |
| POST   | `login`                       | Log in, returns JWT              |
| POST   | `ingest`                      | Ingest a repo                    |
| GET    | `repos`                       | List your repos                  |
| POST   | `ask`                         | One-shot question                |
| GET    | `questions`                   | List your questions              |
| DELETE | `questions/<id>`              | Delete a question                |
| GET/POST | `conversations`             | List / start conversations       |
| GET/DELETE | `conversations/<id>`      | Get transcript / delete          |
| POST   | `conversations/<id>/turn`     | Add a turn, get answer           |
| POST   | `transcribe`                  | Audio → text (Whisper)           |
| POST   | `speak`                       | Text → audio (TTS)               |

## Troubleshooting

- **`GROQ_API_KEY is not set`** — create `.env` in the project root (step 3) and restart the backend.
- **Voice/mic not working** — use Chrome or Edge; allow microphone access.
- **TTS returns an error** — accept the Orpheus terms (see Voice notes); otherwise the browser fallback handles it.
- **Ingest fails** — make sure `git` is installed and the repo URL is public/cloneable.
- **CORS errors** — confirm the frontend runs on `localhost:5173` or update `CORS_ALLOWED_ORIGINS`.
