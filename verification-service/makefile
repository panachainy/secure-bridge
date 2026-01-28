.PHONY: dev install test clean docker-up docker-down docker-logs

dev:
	poetry run uvicorn app.main:app --reload

install:
	poetry install

test:
	poetry run pytest tests/ -v

clean:
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete

docker-up:
	docker compose up -d --build

docker-down:
	docker compose down

docker-logs:
	docker compose logs -f verification-service
