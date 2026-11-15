FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /srv
COPY api/requirements.txt /srv/api/requirements.txt
RUN pip install --no-cache-dir -r /srv/api/requirements.txt
COPY api /srv/api
COPY knowledge /srv/knowledge
COPY contracts /srv/contracts
RUN mkdir -p /srv/data /srv/packs
WORKDIR /srv/api
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
