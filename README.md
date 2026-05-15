# Bokio+ Invoice Helper

PDF & link as default invoice method.

This is a small WebExtension that runs only on Bokio invoice edit pages:

```text
https://app.bokio.se/*/invoicing/invoices/edit/*
```

When Bokio has already rendered the email delivery options, the extension selects the code-defined `LinkAndPdf` invoice delivery type. It does not select the outer "email to customer" delivery method.

## Disclaimer

Bokio, including the Bokio name and logo, is owned by and trademarked by Bokio AB. This project is not affiliated with, endorsed by, or sponsored by Bokio AB.

## Install in Chrome or Opera

1. Open `chrome://extensions` or `opera://extensions`.
2. Enable developer mode.
3. Choose "Load unpacked".
4. Select this project folder.

## Firefox Notes

The runtime code avoids Chrome-specific extension APIs. A Firefox version should be able to reuse `src/content.js`; if Firefox needs store-specific manifest metadata, keep that as a separate manifest variant while sharing the same source and icons.

## Development

Install the dev dependencies:

```sh
npm install
```

Run the tests:

```sh
npm test
```

The tests use Playwright. If your local Playwright install does not already have a browser available and you do not have Chrome/Chromium/Edge installed, run:

```sh
npx playwright install chromium
```

Regenerate icons after updating `icons/source/favicon-32x32.png`:

```sh
npm run generate-icons
```

The selectors intentionally avoid visible text so Bokio can be used in Swedish or English.
