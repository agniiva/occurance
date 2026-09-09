# Agniva Mahata

Source for [www.agnivamahata.com](https://www.agnivamahata.com), Agniva's personal website.

Hugo renders Markdown into static pages. The site uses self-hosted fonts, a shared reading layout, and optional TV-style transitions between pages. The footer provides controls for motion and sound. Links work without JavaScript.

## Local development

Use Hugo Extended (tested with 0.154.0), Python 3, and Node.js for the optional social-image generator.

```sh
hugo server --bind 127.0.0.1
```

For a production-style local build:

```sh
hugo --minify
python3 -m http.server 8768 --bind 127.0.0.1 --directory public
```

## Checks

```sh
npm test
uv run --with playwright python tests/channel_navigation.py
uv run --with playwright python tests/channel_sound.py
uv run --with playwright python tests/site_browser_audit.py
```

Browser tests require the local production-style server above and Chrome. Set `PREVIEW_URL`, `PREVIEW_BUILD_DIR`, or `PREVIEW_ARTIFACTS` to override the default URL, build directory, or `.artifacts` output directory.

## Content and assets

- `content/`: homepage, About, Links, and essays.
- `layouts/partials/`: shared document head, navigation, footer, and social links.
- `assets/scss/home.scss`: shared site styling.
- `static/js/channel.js`: progressive navigation, motion preference, and sound controls.
- `static/fonts/`: locally hosted fonts and their licenses.
- `static/audio/channel-click.wav`: short original switch-click.
- `static/og/`: existing social-preview images.
- `static/admin/` and `api/`: existing Decap CMS and its GitHub OAuth endpoints.

Generate the click with `python3 scripts/generate-channel-sound.py`. To regenerate social images, install dependencies with `npm ci`, then run `npm run generate:og`.

## Editing without code

Open [www.agnivamahata.com/admin](https://www.agnivamahata.com/admin) and sign in with the GitHub account that has write access to `agniiva/occurance`.

- **Writing:** create or edit posts, add a title/date/description, upload a cover image, or insert images directly into the body with the editor's image button. Add descriptive alt text. Keep an existing post's URL slug unchanged unless you intend to move it.
- **Pages → Home:** edit the headline, subheading, introduction, optional cover image, and writing-section heading.
- **Pages → About / Links:** edit titles, body content, and optional cover images.
- **Site settings → Contact and social links:** edit the email, contact sentence, and social-profile URLs. An empty social URL hides that icon.
- **Media:** upload images to `static/uploads`; design assets are kept outside this library.

The editorial workflow lets you save drafts before publishing. A draft stays off the live site; the Publish action merges it into `main` and triggers Vercel. Allow the deployment to finish before checking the public page. No test post or image is published as part of editor verification.

New posts use their cover image for social previews. Without a cover or an existing generated social image, they use the site preview image, so publishing does not require running a script.

The layout and transition effects remain in code to prevent accidental design changes. The editor is not an inline page builder.

For an optional full editor smoke test, with the local built site served on port 8768:

```sh
uv run --with playwright --with pyyaml python tests/cms_editor_browser.py
```

This starts a pinned local proxy against an automatically created disposable copy, writes test content only there, builds the result, then deletes the copy. Production retains the GitHub backend and editorial workflow.

## Deployment

The existing Vercel GitHub integration deploys `main` from `agniiva/occurance`. Push through GitHub, wait for the Vercel deployment to succeed, and verify the custom domain. Do not deploy a prebuilt static directory separately: the site also has CMS API routes.

## Licensing

`LICENSE` covers the project. The retained `LICENSE.md` is the original theme's public-domain notice. Font licenses are distributed alongside their font files.
