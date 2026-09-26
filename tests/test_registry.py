from __future__ import annotations

import pytest

from aegismind_core.registry import (
    clear_registry_overrides,
    list_adapters,
    register_adapter,
    resolve_adapter,
)


def test_list_and_resolve_entry_point_adapters() -> None:
    vector_adapters = list_adapters("vector_store")
    assert "memory" in vector_adapters
    assert "sqlite" in vector_adapters

    embed_adapters = list_adapters("embedder")
    assert "mock" in embed_adapters

    adapter_cls = resolve_adapter("vector_store", "sqlite")
    assert adapter_cls.__name__ == "SqliteVectorStoreAdapter"


def test_runtime_adapter_override() -> None:
    class CustomVectorStoreAdapter:
        pass

    try:
        register_adapter("vector_store", "custom", CustomVectorStoreAdapter)
        assert "custom" in list_adapters("vector_store")

        resolved = resolve_adapter("vector_store", "custom")
        assert resolved is CustomVectorStoreAdapter
    finally:
        clear_registry_overrides()


def test_resolve_unknown_adapter_raises() -> None:
    with pytest.raises(KeyError) as exc_info:
        resolve_adapter("vector_store", "nonexistent_adapter_xyz")
    assert "nonexistent_adapter_xyz" in str(exc_info.value)
