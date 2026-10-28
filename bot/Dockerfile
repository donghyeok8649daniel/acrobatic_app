FROM python:3.12-slim-bookworm
RUN useradd --uid 10001 --create-home bridge && mkdir /data && chown bridge:bridge /data
WORKDIR /app
COPY bridge.py /app/bridge.py
USER bridge
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
CMD ["python", "/app/bridge.py"]
