from __future__ import annotations

import asyncio
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from aegismind_core.agent.activity import (
    LocalToolActivityRecorder,
    infer_tool_category,
    sanitize_parameters,
    sanitize_value,
)
from aegismind_core.agent.loop import SovereignAgentLoop
from aegismind_core.agent.ports import (
    LocalKnowledgeSearchPort,
    NoteCreatorPort,
    SandboxedCommandRunnerPort,
    SystemFileReaderPort,
)
from aegismind_core.agent.tools import (
    SandboxedCommandRunnerAdapter,
)
from aegismind_core.app import create_app
from aegismind_core.routes import CoreState


class MockSearchPort(LocalKnowledgeSearchPort):
    async def search(self, query: str, top_k: int = 5) -> str:
        return f"Found local knowledge for {query} with top_k={top_k}"


class MockFileReaderPort(SystemFileReaderPort):
    async def read_file(self, path: str) -> str:
        if ".." in path or "forbidden" in path:
            return f"ACCESS_DENIED: Path {path} is rejected."
        return f"Content of {path}"


class MockNotePort(NoteCreatorPort):
    async def create_note(
        self,
        title: str,
        content: str,
        tags: list[str],
        source_query: str | None = None,
    ) -> str:
        return f"NOTE_CREATED: Saved note {title}"


class MockCommandPort(SandboxedCommandRunnerPort):
    async def run_command(self, cmd: str) -> str:
        if ";" in cmd or "rm" in cmd:
            return f"COMMAND_REJECTED: Command '{cmd}' not allowed."
        return f"Diagnostic output for {cmd}"


def test_sensitive_parameter_sanitization() -> None:
    # 1. Key-based redaction
    params = {
        "password": "supersecretpassword123",
        "api_key": "sk-1234567890abcdef1234567890",
        "token": "ghp_123456789012345678901234567890",
        "auth_secret": "my-secret-key",
        "normal_path": "/var/log/syslog",
        "count": 5,
        "nested": {
            "bearer_token": "Bearer xyz12345678",
            "safe_title": "Daily Report",
        },
    }

    sanitized = sanitize_parameters(params)

    assert sanitized["password"] == "[REDACTED]"
    assert sanitized["api_key"] == "[REDACTED]"
    assert sanitized["token"] == "[REDACTED]"
    assert sanitized["auth_secret"] == "[REDACTED]"
    assert sanitized["normal_path"] == "/var/log/syslog"
    assert sanitized["count"] == 5
    assert sanitized["nested"]["bearer_token"] == "[REDACTED]"
    assert sanitized["nested"]["safe_title"] == "Daily Report"

    # 2. String pattern matching in non-sensitive key
    cmd_text = "curl -H 'Authorization: Bearer mysecrettoken12345' http://local"
    sanitized_cmd = sanitize_value(cmd_text, key_name="command")
    assert "[REDACTED]" in sanitized_cmd
    assert "mysecrettoken12345" not in sanitized_cmd

    # 3. Payload length truncation for large inputs
    large_payload = "A" * 600
    truncated = sanitize_value(large_payload, key_name="content")
    assert len(truncated) < 400
    assert "[TRUNCATED]" in truncated


def test_category_inference() -> None:
    assert infer_tool_category("search_local_knowledge") == "knowledge"
    assert infer_tool_category("read_system_file") == "filesystem"
    assert infer_tool_category("run_local_command") == "sandbox"
    assert infer_tool_category("create_note") == "notes"
    assert infer_tool_category("custom_diagnostic_tool") == "system"


def test_tool_event_persistence_and_retrieval(tmp_path: Path) -> None:
    storage_file = tmp_path / "activity" / "tool_events.json"
    recorder = LocalToolActivityRecorder(storage_path=storage_file, max_events=10)

    # Initially empty
    assert len(recorder.get_events()) == 0

    # Record two events
    ev1 = recorder.record_start(
        tool_name="search_local_knowledge",
        parameters={"query": "sovereign architecture", "api_key": "secret123"},
        agent_id="test_agent",
        approval_required=False,
    )
    assert ev1.status == "running"
    assert ev1.category == "knowledge"
    assert ev1.parameters["api_key"] == "[REDACTED]"

    recorder.record_complete(
        event_id=ev1.event_id,
        status="success",
        duration_ms=15.4,
        result_summary="Found 3 chunks",
    )

    ev2 = recorder.record_event(
        tool_name="read_system_file",
        parameters={"path": "/etc/hosts"},
        status="success",
        duration_ms=2.1,
        agent_id="test_agent",
        category="filesystem",
        result_summary="127.0.0.1 localhost",
    )

    # Verify retrieval
    events = recorder.get_events()
    assert len(events) == 2
    assert events[0].event_id == ev2.event_id  # reverse chronological
    assert events[1].event_id == ev1.event_id
    assert events[1].status == "success"
    assert events[1].duration_ms == 15.4

    # Verify category filtering
    kb_events = recorder.get_events(category="knowledge")
    assert len(kb_events) == 1
    assert kb_events[0].tool_name == "search_local_knowledge"

    fs_events = recorder.get_events(category="filesystem")
    assert len(fs_events) == 1
    assert fs_events[0].tool_name == "read_system_file"

    # Reload from persistent storage in a new instance
    new_recorder = LocalToolActivityRecorder(storage_path=storage_file, max_events=10)
    reloaded_events = new_recorder.get_events()
    assert len(reloaded_events) == 2
    assert reloaded_events[0].event_id == ev2.event_id
    assert reloaded_events[1].event_id == ev1.event_id

    # Test clear
    new_recorder.clear()
    assert len(new_recorder.get_events()) == 0


@pytest.mark.asyncio
async def test_successful_tool_execution_in_loop(tmp_path: Path) -> None:
    storage_file = tmp_path / "activity" / "tool_events.json"
    recorder = LocalToolActivityRecorder(storage_path=storage_file)

    loop = SovereignAgentLoop(
        search_tool=MockSearchPort(),
        file_reader_tool=MockFileReaderPort(),
        note_tool=MockNotePort(),
        command_tool=MockCommandPort(),
        activity_recorder=recorder,
    )

    result = await loop._execute_tool(
        name="search_local_knowledge",
        args={"query": "test query"},
        query="test query",
    )

    assert result.success is True
    assert "Found local knowledge" in result.result

    events = recorder.get_events()
    assert len(events) == 1
    event = events[0]
    assert event.tool_name == "search_local_knowledge"
    assert event.category == "knowledge"
    assert event.status == "success"
    assert event.duration_ms >= 0.0
    assert event.error is None
    assert "Found local knowledge" in (event.result_summary or "")


@pytest.mark.asyncio
async def test_failed_tool_execution_in_loop(tmp_path: Path) -> None:
    storage_file = tmp_path / "activity" / "tool_events.json"
    recorder = LocalToolActivityRecorder(storage_path=storage_file)

    loop = SovereignAgentLoop(
        search_tool=MockSearchPort(),
        file_reader_tool=MockFileReaderPort(),
        note_tool=MockNotePort(),
        command_tool=MockCommandPort(),
        activity_recorder=recorder,
    )

    result = await loop._execute_tool(
        name="read_system_file",
        args={"path": "../forbidden/file.txt"},
        query="read file",
    )

    assert result.success is False
    assert "ACCESS_DENIED" in result.result

    events = recorder.get_events()
    assert len(events) == 1
    event = events[0]
    assert event.tool_name == "read_system_file"
    assert event.category == "filesystem"
    assert event.status == "failed"
    assert "ACCESS_DENIED" in (event.error or "")


@pytest.mark.asyncio
async def test_sandboxed_command_rejected_event(tmp_path: Path) -> None:
    storage_file = tmp_path / "activity" / "tool_events.json"
    recorder = LocalToolActivityRecorder(storage_path=storage_file)

    adapter = SandboxedCommandRunnerAdapter(
        activity_recorder=recorder,
        working_dir=tmp_path,
    )

    # 1. Metacharacter rejection
    res = await adapter.run_command("git status; rm -rf /")
    assert "COMMAND_REJECTED" in res
    assert "forbidden shell metacharacter" in res

    events = recorder.get_events()
    assert len(events) == 1
    assert events[0].status == "failed"
    assert events[0].category == "sandbox"
    assert events[0].error == "forbidden_metacharacter"

    # 2. Allowlist rejection
    res2 = await adapter.run_command("cat /etc/passwd")
    assert "COMMAND_REJECTED" in res2
    assert "diagnostic allowlist" in res2

    events2 = recorder.get_events()
    assert len(events2) == 2
    assert events2[0].error == "not_allowlisted"


@pytest.mark.asyncio
async def test_sse_event_delivery(tmp_path: Path) -> None:
    storage_file = tmp_path / "activity" / "tool_events.json"
    recorder = LocalToolActivityRecorder(storage_path=storage_file)

    queue = recorder.subscribe()
    try:
        # Trigger start
        ev = recorder.record_start(
            tool_name="create_note",
            parameters={"title": "Test Note", "tags": ["test"]},
            agent_id="test_agent",
            approval_required=False,
        )

        item1 = await asyncio.wait_for(queue.get(), timeout=2.0)
        assert item1.event_id == ev.event_id
        assert item1.status == "running"

        # Trigger complete
        recorder.record_complete(
            event_id=ev.event_id,
            status="success",
            duration_ms=45.2,
            result_summary="Note created successfully",
        )

        item2 = await asyncio.wait_for(queue.get(), timeout=2.0)
        assert item2.event_id == ev.event_id
        assert item2.status == "success"
        assert item2.duration_ms == 45.2
    finally:
        recorder.unsubscribe(queue)


def test_api_endpoints_activity_and_sse(tmp_path: Path) -> None:
    storage_file = tmp_path / "activity" / "tool_events.json"
    state = CoreState()
    state.activity_recorder = LocalToolActivityRecorder(storage_path=storage_file)

    # Seed an event
    state.activity_recorder.record_event(
        tool_name="search_local_knowledge",
        parameters={"query": "test query"},
        status="success",
        duration_ms=12.5,
        category="knowledge",
        result_summary="Sample search result",
    )

    app = create_app(state=state)
    client = TestClient(app)

    # 1. GET /api/local-tools/activity (direct alias)
    res_direct = client.get("/api/local-tools/activity")
    assert res_direct.status_code == 200
    data_direct = res_direct.json()
    assert len(data_direct) == 1
    assert data_direct[0]["tool_name"] == "search_local_knowledge"
    assert data_direct[0]["category"] == "knowledge"

    # 2. GET /api/v1/local-tools/activity (versioned route)
    res_v1 = client.get("/api/v1/local-tools/activity")
    assert res_v1.status_code == 200
    data_v1 = res_v1.json()
    assert len(data_v1) == 1

    # 3. GET /api/v1/agent/tools (legacy compatibility)
    res_legacy = client.get("/api/v1/agent/tools")
    assert res_legacy.status_code == 200
    data_legacy = res_legacy.json()
    assert len(data_legacy) == 1

    # 4. DELETE /api/local-tools/activity
    del_res = client.delete("/api/local-tools/activity")
    assert del_res.status_code == 200
    assert del_res.json()["status"] == "cleared"

    res_empty = client.get("/api/local-tools/activity")
    assert res_empty.status_code == 200
    assert len(res_empty.json()) == 0
