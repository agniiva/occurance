---
title: "Dev Log: Stateful Agents and the RAG Problem"
description: "My exploration with AI Agents / RAG"
date: "2025-01-02"
tags:
- ai
- ai agent
- RAG
---

I've been spending a lot of time thinking about the limitations of current Retrieval-Augmented Generation (RAG) systems, particularly when we try to build AI agents that feel truly useful. RAG's core concept is elegant: a retriever finds relevant documents from a knowledge base using Vector Search, and a generator an LLM embedding model, synthesizes that information into a coherent response. This is a solid way to ground LLMs in facts and minimize those hallucinations.

However, there's a fundamental issue that keeps nagging at me: RAG feels inherently *stateless*. Each interaction with the system is like a brand new conversation. We can try to work around this by feeding previous conversation turns into the context window, but that's just a textual bandage. It's not *real* state. The agent has the memory of a goldfish, forgetting everything once you open a new chat or the context window is full [when working with local LLMs], and perhaps even more critically, forgetting *why* it retrieved specific documents in the first place.

The core problem, as I see it, is that RAG treats all knowledge as either completely static â€“ the unchanging documents in the vector database â€“ or entirely ephemeral â€“ the current conversation history. This black-and-white view misses a crucial category of information, especially in enterprise settings: *bounded ephemeral knowledge*.

Consider active support tickets. A ticket might be open for hours or days, representing critical information for a support agent during that time, but eventually becoming irrelevant once resolved. Or maybe real-time system alerts. A sudden spike in server latency is incredibly important *right now*, but its significance diminishes as the system returns to normal. Consider, too, ongoing sales negotiations. The specifics of a current deal are vital for the sales team today, but those details become much less important once the deal is closed, whether won or lost. Even Slack or Teams discussions, particularly those tied to a specific project or product launch, fall into this category.

These diverse examples all have a common thread: the information is highly relevant for a *defined period*, and then it should gracefully disappear or be archived. Typical RAG implementations struggle with this. You could, in theory, constantly update and delete entries in your vector database, but that quickly becomes a data management nightmare. You also lose the crucial context of *why* a particular piece of information was relevant at a specific moment.

The solution I'm exploring is a concept I'm temporarily calling NEBULA: Neuro-Ephemeral Bounded Universe for Language-based Augmentation. The fundamental idea is to explicitly model and manage this bounded ephemeral knowledge, alongside the traditional "persistent" knowledge that enterprises already maintain.

The architecture I'm visualizing starts with an Ephemeral Ingest Layer. This acts as the entry point for all the real-time, streaming data â€“ everything from Slack messages and system logs to CRM updates and transaction events. It leverages lightweight Transformers, or perhaps even simpler embedding models, to vectorize these snippets of information as they arrive. Importantly, this layer also incorporates filters. These can be rule-based or learned, and their job is to determine which ephemeral signals are actually important enough to be passed on to the rest of the system. We don't need to index every single chat message or log line.

Next comes the Bounded Universe Index. This is a *separate* vector database, purpose-built for ephemeral knowledge. It has a few key characteristics. First, it supports Time-to-Live (TTL) or decay policies. Every entry has a built-in expiration date. This might be a strict TTL, like "delete after 24 hours," or a more nuanced decay function, where the relevance score gradually diminishes over time. Second, it's rich in metadata. Each entry includes information about its source, its time-sensitivity, an estimated "weight" indicating its importance, and potential links to entities in the enterprise's main knowledge graph.

[Ideally imagine it to be like Redis but for Vector Database]

The Enterprise Knowledge Graph and Persistent Vector DB remain, representing the traditional knowledge store. This holds the stable, long-term information about products, policies, historical data, and so on â€“ essentially what you'd find in a standard RAG system.

The real magic happens in the Neuro-Ephemeral Orchestrator. This is the "brain" that connects everything. When a query arrives, the orchestrator doesn't just retrieve information from the persistent database. It also identifies relevant *ephemeral* items from the Bounded Universe Index. It then creates composite embeddings. These merge the embeddings from the persistent and ephemeral sources into a *single* representation, capturing both long-term knowledge and the immediate context. This merging could involve weighted averaging, concatenation, or even a more advanced learned fusion technique. The orchestrator also dynamically weights the relative importance of ephemeral versus persistent information. During a major system outage, for instance, ephemeral alerts would be given significantly more weight.

An Adaptive Summarization and Memory Decay component acts as the system's housekeeper. It regularly scans the Bounded Universe Index, performing two crucial functions. It summarizes. If an ephemeral item has demonstrated lasting relevance â€“ for example, a support ticket that revealed a bug â€“ it's summarized and potentially archived into the persistent knowledge base. And it decays or prunes. Items that have expired or fallen below a relevance threshold are removed, keeping the Bounded Universe Index lean and performant.

Finally, the Generative/Reasoning Layer, where the LLM resides, receives these composite embeddings from the orchestrator. This allows the LLM to reason about both long-term knowledge and the current ephemeral context. This layer might consist of a single LLM or a collection of more specialized agents.

This approach, I believe, offers several significant advantages over standard RAG. Ephemeral knowledge is treated as a first-class citizen, not an afterthought or a clumsy workaround. The merging of ephemeral and persistent knowledge happens at the embedding level, rather than simply by concatenating text, leading to a more nuanced and powerful representation of context. The system is inherently bounded and incorporates decay, preventing data bloat and ensuring the LLM isn't misled by outdated information. And the orchestrator can dynamically adjust the context based on the situation, making the agent more responsive to real-time events.

My next steps involve tackling some significant, but exciting, challenges. I need to prototype the Bounded Universe Index, likely starting with Redis and its TTL capabilities, while experimenting with various decay functions and metadata schemas. Developing the orchestrator logic is the most complex task, requiring me to determine the optimal way to merge embeddings and dynamically adjust their weights, possibly starting with simple heuristics and progressing to learned approaches. I plan to test this with a real-world use case, probably a simulated IT operations scenario with streaming system logs and a knowledge base of past incidents. I also need to determine the best way to represent the Composite embeddings.

I anticipate encountering plenty of obstacles, but that's inherent in the process. The ultimate goal is to create agents that are not merely knowledgeable, but also genuinely *aware* of the present, and capable of gracefully forgetting information when it's no longer relevant. I believe this is a crucial step towards building truly useful AI systems for enterprise applications.
