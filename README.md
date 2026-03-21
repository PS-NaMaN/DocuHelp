# 📄 DocuHelp: Privacy-First RAG Document Analyzer

**DocuHelp** is a high-performance, RAG-based document analyzer that operates **entirely within your browser**. Your documents never leave your computer, ensuring total privacy and security.

![Main Interface Placeholder](https://via.placeholder.com/800x400/0f172a/ffffff?text=DocuHelp+-+Local+AI+Document+Analysis)

---

## ✨ Key Features

- 🔒 **100% Local & Private**: No data is ever uploaded to a server. All parsing, embedding, and inference happen in your browser.
- ⚡ **WebGPU Accelerated**: Leverages **WebLLM** and **MLC runtime** to run small language models (SLMs)
- 🧠 **Modern RAG Pipeline**: Built-in document parsing, semantic chunking, and vector search.
- 📂 **Multi-Format Support**: Parse and analyze PDF, Markdown, and TXT files instantly.
- 💾 **Persistent Storage**: Uses **IndexedDB** to store your document chunks and vector embeddings securely across sessions.

---

## 🛠️ The Tech Stack

- **Frontend**: [React](https://reactjs.org/) + [Vite](https://vitejs.dev/) + [Tailwind CSS](https://tailwindcss.com/)
- **AI Inference**: [WebLLM](https://webllm.mlc.ai/) (LLM) & [Transformers.js](https://huggingface.co/docs/transformers.js/) (Embeddings)
- **Vector Search**: Custom Cosine Similarity search with **IndexedDB** persistence
- **Parsing**: [pdf.js](https://mozilla.github.io/pdf.js/) & [marked.js](https://marked.js.org/)

---

## 🔄 How It Works (The Pipeline)

### 1. Document Ingestion
- **Parse & Chunk**: Documents are split into ~400-token windows with a 50-token overlap to preserve context boundaries.
- **Embed**: Each chunk is run through the `all-MiniLM-L6-v2` model in-browser to generate 384-dimensional vectors.
- **Store**: Chunks and vectors are persisted to **IndexedDB** for fast future access without re-processing.

### 2. Intelligent Querying
- **Semantic Search**: Your query is embedded and compared against stored chunks using cosine similarity.
- **Context Injection**: The top-5 most relevant chunks are injected into a structured system prompt.
- **Streaming Inference**: The LLM (processed via WebGPU) generates and streams the answer directly to the chat interface with source citations.

---

## 🚀 Getting Started

### Prerequisites
- A modern browser with **WebGPU** support (Chrome, Edge, or latest Safari/Firefox).
- [Node.js](https://nodejs.org/) (v18+)

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/PS-NaMaN/DocuHelp.git
   cd DocuHelp
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```

---

## 📄 License

This project is licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0)** - see the [LICENSE](LICENSE) file for details.

---

Built with ❤️ by [NaMaN](https://github.com/PS-NaMaN)
