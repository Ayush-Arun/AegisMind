# aegismind-ingestion

Ingestion pipeline, contextual chunking, and durable sync execution for AegisMind.

## Features
- **Section and Layout-Aware Chunking**: Preserves Markdown headings, tables, code blocks, and section hierarchies.
- **Contextual Retrieval**: Prepends synthesized document and section context prefixes to chunks.
- **Parsers**: Docling adapter, Markdown parser, and Plaintext parser.
- **Ingestion Pipeline**: End-to-end ingestion orchestrating parsing, chunking, embedding, and vector store indexing.
- **Durable Workflows & Scribe Worker**: Resilient, replayable sync execution with checkpointed cursor management.
