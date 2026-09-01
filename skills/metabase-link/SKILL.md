---
name: metabase-link
description: Generate prefilled Metabase native-SQL question links. Use when the user asks for a Metabase link or wants SQL opened as a Metabase question.
---

# Metabase links

Call `create_metabase_link` directly. Do not use Python, bash, or another URL encoder, and do not pass the result to `create_short_link`. The tool handles optional shortening inside Pi.

Choose `shorten` based on what the user needs:

- Leave it out for a normal Metabase link request.
- Use `true` when the user asks for a short, compact, or readable link.
- Use `false` when the user asks for the raw URL or needs to open the link on another machine.

When the result has `localOnly: true`, tell the user that the URL works only on this machine while Pi's short-links server is running.

If configuration is missing, name both required variables: `PI_METABASE_BASE_URL` and `PI_METABASE_DATABASE_ID`. To find the database ID, send the user to `<PI_METABASE_BASE_URL>/admin/databases/`. After they choose a database, its numeric ID appears at the end of the URL, as in `/admin/databases/2`.

SQL in a Metabase URL is encoded, not encrypted. Do not describe the query as hidden or secret.
