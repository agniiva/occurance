# Contributing

## Site direction

This is Agniva's founder-led personal website. Business, AI, art, culture, and human life can coexist here; do not impose a professional-versus-personal split between this site and his newsletter.

Use concrete experience, quiet confidence, and ordinary language. Avoid inflated authority, unsupported outcomes, generic service copy, decorative subtitles, and template slogans. Existing essays are authored content: do not rewrite or remove them as part of a visual cleanup.

The approved interface uses centered top navigation without a name/logo lockup, modest old-book headings, stable reading text, and footer social links. Keep CRT interference on the brief navigation overlay, not on duplicated or blurred lettering. Audio is a quiet, short click with a persistent mute control. Preserve reduced-motion preferences, ordinary modifier clicks, keyboard navigation, Back behavior, and browsing without JavaScript.

## Adding an essay

Create `content/writing/your-slug.md`:

```yaml
---
title: "Your title"
description: "A concise description of the essay."
date: YYYY-MM-DD
slug: "your-slug"
tags: []
---
```

Add the essay body below the frontmatter. Run `npm run generate:og` when adding or renaming an essay. Social-image filenames use the Markdown filename, not the optional URL slug.

## Verification and publishing

Follow the build and test commands in README.md. Check the generated feed, metadata, links, and mobile layout before publishing. Use a branch and PR for normal collaboration; publish only when Agniva authorizes it. The canonical repository is `agniiva/occurance`; deployment is handled by its existing Vercel GitHub integration.

Never commit credentials, local deployment bindings, generated output, or test artifacts. Keep required license notices with redistributed code and fonts.
