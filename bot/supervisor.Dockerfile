FROM python:3.12-slim-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends adb && rm -rf /var/lib/apt/lists/*
COPY supervisor.py /supervisor.py
CMD ["python", "/supervisor.py"]
