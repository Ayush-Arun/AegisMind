.PHONY: help setup start stop seed test lint run-demo

help: ## Show this help message
	@echo "AegisMind - Available commands:"
	@echo ""
	@echo "  make setup    - Install all dependencies and seed the graph"
	@echo "  make start    - Start backend (port 8000) and frontend (port 3000)"
	@echo "  make stop     - Stop all running services"
	@echo "  make seed     - Seed the knowledge graph (9 nodes, 9 edges)"
	@echo "  make test     - Run all unit tests"
	@echo "  make lint     - Run ruff linting and mypy type checking"
	@echo "  make demo     - Run the sovereign brain demo script"
	@echo ""

setup: ## One-command setup for new developers
	ollama serve || true
	ollama pull llama3.2:latest || true
	ollama pull nomic-embed-text:latest || true
	ollama pull qwen2.5:7b || true
	uv sync --all-groups
	uv pip install -e packages/aegismind-graph
	uv pip install -e packages/aegismind-approval
	uv pip install -e packages/aegismind-core
	make seed

seed: ## Seed the knowledge graph
	python scripts/seed_graph.py

start: ## Start all services
	uv run uvicorn aegismind_core.app:app --reload --port 8000 &
	pnpm --filter lens dev &
	@echo "Backend: http://localhost:8000"
	@echo "Frontend: http://localhost:3000"

stop: ## Stop all services
	@echo "Stopping services..."
	taskkill /F /IM uvicorn.exe 2>nul || true
	taskkill /F /IM node.exe 2>nul || true
	taskkill /F /IM pnpm.exe 2>nul || true
	@echo "All services stopped."

test: ## Run all tests
	uv run pytest -v

lint: ## Run linting and type checking
	uv run ruff check .
	uv run ruff format --check .
	uv run mypy packages/aegismind-core packages/aegismind-graph packages/aegismind-approval

demo: ## Run the sovereign brain demo
	python scripts/demo_sovereign_brain.py
