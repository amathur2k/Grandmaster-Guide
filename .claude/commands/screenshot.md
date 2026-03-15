# Screenshot

Take a screenshot of a website using Playwright (headless Chromium).

## Usage
`/screenshot <url> [output-path] [--full-page] [--width=N] [--height=N]`

## Instructions

When this skill is invoked:

1. Parse the arguments from `$ARGUMENTS`:
   - First positional arg = URL (required)
   - Second positional arg = output path (optional, defaults to `screenshots/<hostname>_<timestamp>.png`)
   - `--full-page` flag = capture the entire scrollable page
   - `--width=N` = viewport width (default 1280)
   - `--height=N` = viewport height (default 800)

2. Run the screenshot script using the Bash tool:
   ```
   node scripts/screenshot.mjs <url> [output-path] [flags]
   ```

3. After the script succeeds, read the saved image file using the Read tool and display it to the user so they can see the screenshot inline.

4. Tell the user the file path where the screenshot was saved.

## Examples

- `/screenshot https://example.com` → saves to `screenshots/example.com_<timestamp>.png`
- `/screenshot https://example.com screenshots/home.png` → saves to specified path
- `/screenshot https://example.com --full-page` → full page capture
- `/screenshot https://example.com screenshots/wide.png --width=1920 --height=1080`
