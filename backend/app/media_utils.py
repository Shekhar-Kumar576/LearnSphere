"""Media and document processing utilities for LearnSphere.

Handles:
- MP4/WebM video duration inspection
- PDF slide/document text extraction via pypdf
- PPTX presentation slide text extraction via python-pptx
- Generic plain-text extraction
"""
import io
import struct
from pathlib import Path
from typing import Optional


def inspect_mp4_duration(file_path: str | Path) -> Optional[float]:
    """Parse movie header (mvhd) in MP4/MOV to extract exact duration in seconds."""
    try:
        with open(file_path, "rb") as f:
            while True:
                header = f.read(8)
                if len(header) < 8:
                    break
                size, name = struct.unpack(">I4s", header)
                if name == b"moov":
                    # Dive into moov atom
                    continue
                elif name == b"mvhd":
                    # mvhd atom found
                    version_flags = f.read(4)
                    version = version_flags[0]
                    if version == 1:
                        # 64-bit creation, modification, timescale (32-bit), duration (64-bit)
                        data = f.read(28)
                        if len(data) >= 28:
                            timescale = struct.unpack(">I", data[16:20])[0]
                            duration = struct.unpack(">Q", data[20:28])[0]
                            if timescale > 0:
                                return round(duration / timescale, 2)
                    else:
                        # 32-bit creation (4), modification (4), timescale (4), duration (4)
                        data = f.read(16)
                        if len(data) >= 16:
                            timescale, duration = struct.unpack(">II", data[8:16])
                            if timescale > 0:
                                return round(duration / timescale, 2)
                    break
                else:
                    if size == 1:
                        # 64-bit size
                        size_data = f.read(8)
                        if len(size_data) < 8:
                            break
                        size = struct.unpack(">Q", size_data)[0]
                        f.seek(size - 16, io.SEEK_CUR)
                    elif size > 8:
                        f.seek(size - 8, io.SEEK_CUR)
                    else:
                        break
    except Exception:
        pass
    return None


def format_duration(seconds: float) -> str:
    """Format seconds into MM:SS or HH:MM:SS string."""
    s = int(round(max(0, seconds)))
    hrs = s // 3600
    mins = (s % 3600) // 60
    secs = s % 60
    if hrs > 0:
        return f"{hrs:02d}:{mins:02d}:{secs:02d}"
    return f"{mins:02d}:{secs:02d}"


def extract_document_text(file_path: str | Path, file_type: str) -> str:
    """Extract readable text from PDF, PPTX, TXT, MD, CSV files."""
    path = Path(file_path)
    if not path.is_file():
        return ""

    ft = file_type.lower().replace(".", "")
    text_chunks: list[str] = []

    try:
        if ft == "pdf":
            from pypdf import PdfReader
            reader = PdfReader(str(path))
            for i, page in enumerate(reader.pages[:40]):  # up to 40 pages
                extracted = page.extract_text()
                if extracted:
                    text_chunks.append(f"[Page {i + 1}]\n{extracted.strip()}")

        elif ft in ("pptx", "ppt"):
            from pptx import Presentation
            prs = Presentation(str(path))
            for i, slide in enumerate(prs.slides[:40]):
                slide_lines: list[str] = []
                for shape in slide.shapes:
                    if hasattr(shape, "text") and shape.text.strip():
                        slide_lines.append(shape.text.strip())
                if slide_lines:
                    text_chunks.append(f"[Slide {i + 1}]\n" + "\n".join(slide_lines))

        elif ft in ("txt", "md", "csv", "notes"):
            content = path.read_text(encoding="utf-8", errors="ignore")
            text_chunks.append(content[:25000])

    except Exception as e:
        text_chunks.append(f"(Document text extraction preview error: {e})")

    return "\n\n".join(text_chunks)[:30000]
