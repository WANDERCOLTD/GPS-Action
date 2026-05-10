---
description: Load the N most recent screenshots from ~/Downloads/@Screens (defaults to 1) so they appear inline in the conversation for visual context.
---

Load the most recent screenshot(s) from `/Users/paulwander/Downloads/@Screens/` into this conversation.

**Argument:** `$ARGUMENTS` — number of screenshots to load. If empty, non-numeric, zero, or negative, default to 1.

**Steps:**

1. Resolve the count from `$ARGUMENTS`. Trim whitespace; if it parses as a positive integer, use it; otherwise use 1.
2. List the most recent matching files by mtime via Bash, using `find` (zsh's brace expansion errors on missing extensions, so `find` is the portable choice):
   ```
   find "/Users/paulwander/Downloads/@Screens" -maxdepth 1 -type f \( -iname '*.png' -o -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.heic' -o -iname '*.gif' -o -iname '*.webp' \) -print0 2>/dev/null | xargs -0 ls -t 2>/dev/null | head -n <count>
   ```
   Replace `<count>` with the resolved integer. The `@` in the path is a literal character — keep the path quoted.
3. Read each returned path with the **Read** tool, invoking them in **parallel** in a single message so all images load at once.
4. After loading, give a one-short-line description of each image in the order returned, so the user knows which is which. Then continue with whatever they were asking about.
5. If the `@Screens` directory does not exist, or `ls` returns no matches, report that to the user in one line and stop — do not invent files.

**Examples:**

- `/ss` — loads the single most recent screenshot.
- `/ss 1` — same as above.
- `/ss 3` — loads the three most recent screenshots.
