"""RAG (Retrieval Augmented Generation) module for LearnSphere AI.

This module provides:
1. Text chunking for documents
2. Simple TF-IDF based embedding (no external dependencies)
3. Cosine similarity search
4. SQLite-based document store with metadata
5. Incremental indexing with automatic re-indexing on changes
"""
import hashlib
import json
import math
import re
import sqlite3
from collections import Counter
from contextlib import contextmanager
from pathlib import Path
from typing import Dict, List, Optional, Tuple

# Configuration
CHUNK_SIZE = 300  # characters per chunk
CHUNK_OVERLAP = 50  # overlap between chunks
MIN_CHUNK_LENGTH = 50  # minimum characters to be considered a chunk
MAX_CHUNKS_PER_DOC = 50  # maximum chunks per document


def tokenize(text: str) -> List[str]:
    """Simple tokenizer: lowercase, remove punctuation, split on whitespace."""
    text = text.lower()
    text = re.sub(r'[^\w\s]', ' ', text)
    tokens = text.split()
    # Remove very short tokens and stopwords
    stopwords = {'the', 'a', 'an', 'is', 'are', 'was', 'were', 'in', 'on', 'at',
                 'to', 'for', 'of', 'and', 'or', 'but', 'it', 'this', 'that', 'with'}
    return [t for t in tokens if len(t) > 2 and t not in stopwords]


def compute_tfidf(documents: List[str]) -> Dict[str, Dict[str, float]]:
    """Compute TF-IDF vectors for a list of documents.

    Returns:
        Dict mapping document_id to dict of {term: tfidf_score}
    """
    # Tokenize all documents
    tokenized_docs = [tokenize(doc) for doc in documents]

    # Compute document frequency (how many docs contain each term)
    df: Dict[str, int] = Counter()
    for tokens in tokenized_docs:
        unique_tokens = set(tokens)
        for token in unique_tokens:
            df[token] += 1

    num_docs = len(documents)
    tfidf_vectors = {}

    for i, tokens in enumerate(tokenized_docs):
        # Compute TF (term frequency)
        tf: Dict[str, int] = Counter(tokens)
        total_terms = len(tokens)

        # Compute IDF (inverse document frequency)
        idf: Dict[str, float] = {}
        for term, count in tf.items():
            doc_freq = df.get(term, 1)
            idf[term] = math.log((num_docs + 1) / (doc_freq + 1)) + 1

        # Compute TF-IDF
        tfidf: Dict[str, float] = {}
        for term, count in tf.items():
            tfidf[term] = (count / total_terms) * idf.get(term, 0)

        tfidf_vectors[str(i)] = tfidf

    return tfidf_vectors


def cosine_similarity(vec1: Dict[str, float], vec2: Dict[str, float]) -> float:
    """Compute cosine similarity between two sparse vectors."""
    # Find common terms
    common_terms = set(vec1.keys()) & set(vec2.keys())
    if not common_terms:
        return 0.0

    # Compute dot product
    dot_product = sum(vec1[t] * vec2[t] for t in common_terms)

    # Compute magnitudes
    mag1 = math.sqrt(sum(v * v for v in vec1.values()))
    mag2 = math.sqrt(sum(v * v for v in vec2.values()))

    if mag1 == 0 or mag2 == 0:
        return 0.0

    return dot_product / (mag1 * mag2)


def query_to_vector(query: str) -> Dict[str, float]:
    """Convert a query string to a TF-IDF like vector."""
    tokens = tokenize(query)
    if not tokens:
        return {}

    # Simple term frequency for query
    tf = Counter(tokens)
    total = len(tokens)

    return {token: count / total for token, count in tf.items()}


def chunk_text(text: str, source_id: str, source_type: str = "resource",
               source_title: str = "") -> List[Dict]:
    """Split text into overlapping chunks.

    Args:
        text: The text to chunk
        source_id: Unique identifier for the source document
        source_type: Type of source ('resource', 'video_transcript', etc.)
        source_title: Human-readable title of the source

    Returns:
        List of dicts with chunk info
    """
    chunks = []

    if len(text) <= CHUNK_SIZE:
        # Short text, use as single chunk
        chunk_id = hashlib.md5(f"{source_id}:{text[:100]}".encode()).hexdigest()[:12]
        chunks.append({
            "chunk_id": chunk_id,
            "source_id": source_id,
            "source_type": source_type,
            "source_title": source_title,
            "chunk_index": 0,
            "text": text.strip(),
            "start_pos": 0,
            "end_pos": len(text),
        })
        return chunks

    # Split into chunks with overlap
    start = 0
    chunk_index = 0

    while start < len(text):
        end = start + CHUNK_SIZE

        # Try to break at sentence boundary
        if end < len(text):
            # Look for sentence boundary within next 50 chars
            for break_point in range(end, min(end + 50, len(text))):
                if text[break_point] in '.!?':
                    end = break_point + 1
                    break

        chunk_text_raw = text[start:end].strip()

        # Skip if chunk is too short
        if len(chunk_text_raw) >= MIN_CHUNK_LENGTH:
            chunk_id = hashlib.md5(f"{source_id}:{start}".encode()).hexdigest()[:12]
            chunks.append({
                "chunk_id": chunk_id,
                "source_id": source_id,
                "source_type": source_type,
                "source_title": source_title,
                "chunk_index": chunk_index,
                "text": chunk_text_raw,
                "start_pos": start,
                "end_pos": end,
            })
            chunk_index += 1

            if chunk_index >= MAX_CHUNKS_PER_DOC:
                break

        # Move start position with overlap
        start = end - CHUNK_OVERLAP

    return chunks


def initialize_rag_db(db_path: str = "./data/rag.db") -> None:
    """Initialize the RAG database schema."""
    path = Path(db_path)
    path.parent.mkdir(parents=True, exist_ok=True)

    conn = sqlite3.connect(path)
    c = conn.cursor()

    # Create chunks table
    c.execute('''
        CREATE TABLE IF NOT EXISTS chunks (
            chunk_id TEXT PRIMARY KEY,
            source_id TEXT NOT NULL,
            source_type TEXT NOT NULL,
            source_title TEXT NOT NULL,
            chunk_index INTEGER NOT NULL,
            text TEXT NOT NULL,
            tokens TEXT NOT NULL,
            word_count INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # Create index for efficient source queries
    c.execute('CREATE INDEX IF NOT EXISTS idx_source_id ON chunks(source_id)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_source_type ON chunks(source_type)')

    # Create document metadata table
    c.execute('''
        CREATE TABLE IF NOT EXISTS documents (
            source_id TEXT PRIMARY KEY,
            source_type TEXT NOT NULL,
            source_title TEXT NOT NULL,
            original_text TEXT NOT NULL,
            text_hash TEXT NOT NULL,
            chunk_count INTEGER NOT NULL DEFAULT 0,
            last_indexed TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            status TEXT DEFAULT 'indexed'
        )
    ''')

    conn.commit()
    conn.close()


def get_db_connection(db_path: str = "./data/rag.db"):
    """Get a database connection."""
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn


def index_document(source_id: str, source_type: str, source_title: str,
                   original_text: str, db_path: str = "./data/rag.db") -> Dict:
    """Index a document into the RAG database.

    Args:
        source_id: Unique identifier (e.g., resource ID)
        source_type: Type of source
        source_title: Human-readable title
        original_text: Full text content
        db_path: Path to RAG database

    Returns:
        Dict with indexing results
    """
    conn = get_db_connection(db_path)
    c = conn.cursor()

    # Compute text hash for change detection
    text_hash = hashlib.md5(original_text.encode()).hexdigest()

    # Check if document exists and needs re-indexing
    existing = c.execute(
        "SELECT text_hash, status FROM documents WHERE source_id = ?",
        (source_id,)
    ).fetchone()

    if existing and existing["text_hash"] == text_hash and existing["status"] == "indexed":
        conn.close()
        return {"source_id": source_id, "chunks_added": 0, "skipped": True}

    # Delete existing chunks for this source
    c.execute("DELETE FROM chunks WHERE source_id = ?", (source_id,))
    c.execute("DELETE FROM documents WHERE source_id = ?", (source_id,))

    # Chunk the text
    chunks = chunk_text(original_text, source_id, source_type, source_title)

    # Insert chunks
    inserted = 0
    for chunk in chunks:
        tokens_str = " ".join(tokenize(chunk["text"]))
        c.execute('''
            INSERT INTO chunks (chunk_id, source_id, source_type, source_title,
                               chunk_index, text, tokens, word_count)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            chunk["chunk_id"],
            source_id,
            chunk["source_type"],
            chunk["source_title"],
            chunk["chunk_index"],
            chunk["text"],
            tokens_str,
            len(chunk["text"].split())
        ))
        inserted += 1

    # Insert document metadata
    c.execute('''
        INSERT INTO documents (source_id, source_type, source_title, original_text,
                              text_hash, chunk_count, status)
        VALUES (?, ?, ?, ?, ?, ?, 'indexed')
    ''', (
        source_id,
        source_type,
        source_title,
        original_text,
        text_hash,
        inserted
    ))

    conn.commit()
    conn.close()

    return {
        "source_id": source_id,
        "chunks_added": inserted,
        "skipped": False
    }


def search_chunks(query: str, source_id: Optional[str] = None,
                  source_type: Optional[str] = None,
                  top_k: int = 5,
                  min_score: float = 0.02,
                  db_path: str = "./data/rag.db") -> List[Dict]:
    """Search for relevant chunks using TF-IDF cosine similarity.

    Args:
        query: Search query text
        source_id: Optional filter by source
        source_type: Optional filter by source type
        top_k: Number of results to return
        min_score: Minimum relevance score threshold
        db_path: Path to RAG database

    Returns:
        List of dicts with chunk info and relevance scores
    """
    conn = get_db_connection(db_path)
    c = conn.cursor()

    # Get query vector
    query_vec = query_to_vector(query)
    if not query_vec:
        conn.close()
        return []

    # Build WHERE clause
    where_clauses = []
    params = []

    if source_id:
        where_clauses.append("source_id = ?")
        params.append(source_id)

    if source_type:
        where_clauses.append("source_type = ?")
        params.append(source_type)

    where_sql = " AND ".join(where_clauses) if where_clauses else "1=1"

    # Get all chunks (for small datasets) or sample
    c.execute(f"SELECT * FROM chunks WHERE {where_sql} ORDER BY source_id, chunk_index")
    rows = c.fetchall()

    if not rows:
        conn.close()
        return []

    # Compute similarity for each chunk
    results = []
    for row in rows:
        # Parse stored tokens
        try:
            stored_tokens = row["tokens"].split()
        except:
            continue

        # Create vector from stored tokens
        chunk_vec = Counter(stored_tokens)
        total = len(stored_tokens)
        if total > 0:
            chunk_vec = {t: c / total for t, c in chunk_vec.items()}
        else:
            continue

        # Compute cosine similarity
        score = cosine_similarity(query_vec, chunk_vec)

        if score >= min_score:
            results.append({
                "chunk_id": row["chunk_id"],
                "source_id": row["source_id"],
                "source_type": row["source_type"],
                "source_title": row["source_title"],
                "chunk_index": row["chunk_index"],
                "text": row["text"],
                "relevance_score": round(score, 4),
                "word_count": row["word_count"],
            })

    conn.close()

    # Sort by relevance and return top_k
    results.sort(key=lambda x: x["relevance_score"], reverse=True)
    return results[:top_k]


def get_context_for_query(query: str, video_id: Optional[int] = None,
                         course_id: Optional[int] = None,
                         max_tokens: int = 2000,
                         db_path: str = "./data/rag.db") -> Tuple[str, List[Dict]]:
    """Get relevant context for a query, optionally filtered by video/course.

    Args:
        query: User's question
        video_id: Optional video ID to filter
        course_id: Optional course ID to filter
        max_tokens: Maximum tokens in returned context
        db_path: Path to RAG database

    Returns:
        Tuple of (context_text, chunks_used)
    """
    # Start with any provided context
    context_parts = []

    # Search RAG database
    chunks = search_chunks(query, top_k=8, db_path=db_path)

    # If video_id provided, try to get video-specific chunks first
    if video_id:
        video_chunks = search_chunks(
            query,
            source_id=str(video_id),
            source_type="video_transcript",
            top_k=3,
            db_path=db_path
        )
        # Merge, avoiding duplicates
        seen_ids = {c["chunk_id"] for c in chunks[:3]}
        for vc in video_chunks:
            if vc["chunk_id"] not in seen_ids:
                chunks.insert(0, vc)
                seen_ids.add(vc["chunk_id"])

    # Build context text
    total_chars = 0
    for chunk in chunks[:6]:  # Limit to 6 chunks
        if total_chars >= max_tokens * 4:  # Rough token estimate
            break

        source_info = f"[{chunk['source_title']}]"
        context_parts.append(f"{source_info}\n{chunk['text']}")
        total_chars += len(chunk['text'])

    context_text = "\n\n---\n\n".join(context_parts)

    return context_text, chunks


def reindex_all_resources(db_path: str = "./data/rag.db",
                          resource_db_path: str = "./data/app.db") -> Dict:
    """Re-index all resources from the main database.

    Args:
        db_path: Path to RAG database
        resource_db_path: Path to main application database

    Returns:
        Dict with indexing statistics
    """
    import db as main_db

    stats = {
        "total_documents": 0,
        "total_chunks": 0,
        "errors": 0,
        "indexed": []
    }

    # Initialize RAG DB
    initialize_rag_db(db_path)

    # Connect to main DB
    main_conn = sqlite3.connect(resource_db_path)
    main_conn.row_factory = sqlite3.Row
    c = main_conn.cursor()

    # Get all resources with extracted text
    c.execute("SELECT id, title, file_type, extracted_text FROM resources WHERE extracted_text != ''")
    resources = c.fetchall()

    for row in resources:
        try:
            result = index_document(
                source_id=str(row["id"]),
                source_type="resource",
                source_title=row["title"],
                original_text=row["extracted_text"],
                db_path=db_path
            )
            stats["total_documents"] += 1
            stats["total_chunks"] += result["chunks_added"]
            stats["indexed"].append({
                "id": row["id"],
                "title": row["title"],
                "chunks": result["chunks_added"]
            })
        except Exception as e:
            stats["errors"] += 1
            print(f"Error indexing resource {row['id']}: {e}")

    # Also index video transcripts
    c.execute("SELECT id, title, transcript_text FROM videos WHERE transcript_text != ''")
    videos = c.fetchall()

    for row in videos:
        try:
            result = index_document(
                source_id=str(row["id"]),
                source_type="video_transcript",
                source_title=row["title"],
                original_text=row["transcript_text"],
                db_path=db_path
            )
            stats["total_documents"] += 1
            stats["total_chunks"] += result["chunks_added"]
            stats["indexed"].append({
                "id": row["id"],
                "title": row["title"],
                "type": "video",
                "chunks": result["chunks_added"]
            })
        except Exception as e:
            stats["errors"] += 1
            print(f"Error indexing video {row['id']}: {e}")

    main_conn.close()

    return stats


def get_index_stats(db_path: str = "./data/rag.db") -> Dict:
    """Get statistics about the current index.

    Returns:
        Dict with index statistics
    """
    conn = get_db_connection(db_path)
    c = conn.cursor()

    c.execute("SELECT COUNT(*) as count FROM documents")
    doc_count = c.fetchone()["count"]

    c.execute("SELECT COUNT(*) as count FROM chunks")
    chunk_count = c.fetchone()["count"]

    c.execute("SELECT source_type, COUNT(*) as count FROM chunks GROUP BY source_type")
    type_counts = {row["source_type"]: row["count"] for row in c.fetchall()}

    conn.close()

    return {
        "total_documents": doc_count,
        "total_chunks": chunk_count,
        "by_type": type_counts
    }


def clear_index(db_path: str = "./data/rag.db") -> bool:
    """Clear all indexed data."""
    conn = get_db_connection(db_path)
    c = conn.cursor()

    c.execute("DELETE FROM chunks")
    c.execute("DELETE FROM documents")

    conn.commit()
    conn.close()

    return True
