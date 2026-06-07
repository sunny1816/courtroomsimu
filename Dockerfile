FROM python:3.10-slim

WORKDIR /app

# Install system dependencies (build-essential for compiling C extensions if needed)
RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source code and local data directories
COPY backend/ ./backend
COPY data/ ./data

# Expose the API port
EXPOSE 8000

# Set environment variables (Hugging Face runs on CPU)
ENV HF_HUB_ENABLE_HF_TRANSFER=0

# Start command running the Uvicorn ASGI server
CMD ["uvicorn", "main:app", "--app-dir", "backend", "--host", "0.0.0.0", "--port", "8000"]
