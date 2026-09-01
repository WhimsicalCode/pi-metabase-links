# pi-metabase-links

Turn SQL into a prefilled Metabase question link without leaving Pi. The package creates raw Metabase URLs on its own. If [`pi-short-links`](https://github.com/WhimsicalCode/pi-short-links) is also loaded, it can return a shorter local URL instead.

## Install

```bash
pi install git:github.com/WhimsicalCode/pi-metabase-links
```

## Set up Metabase

Set these environment variables before you start Pi:

```bash
export PI_METABASE_BASE_URL=https://metabase.example.com
export PI_METABASE_DATABASE_ID=2
```

The base URL may include a path, such as `https://analytics.example.com/metabase`.

To find the database ID, open `<PI_METABASE_BASE_URL>/admin/databases/` and choose your database. Its URL will end with the ID. For example, the database ID in `https://metabase.example.com/admin/databases/2` is `2`.

The extension checks this configuration when you create a link, not when Pi starts. You can keep the package installed in projects that do not use Metabase.

## Create a link

Ask Pi to create a Metabase link, or call `create_metabase_link` directly:

```json
{
  "sql": "select 1;"
}
```

The tool accepts three fields:

```ts
{
  sql: string;
  title?: string;
  shorten?: boolean;
}
```

`sql` is required. `title` names the link when `pi-short-links` is available.

Use `shorten` to choose the kind of URL you want:

- Leave it out for the usual behavior. Pi uses `pi-short-links` when available and returns the raw Metabase URL otherwise.
- Set it to `true` when you specifically want a short URL. If `pi-short-links` is not loaded, the tool returns the raw URL with installation instructions.
- Set it to `false` when you need the raw URL, including links intended for someone on another machine that can access your Metabase instance.

## Optional short links

Install `pi-short-links` if you want compact local URLs:

```bash
pi install git:github.com/WhimsicalCode/pi-short-links
```

The packages communicate inside Pi, so the long encoded URL does not pass through the model. `pi-metabase-links` does not depend on `pi-short-links` and continues to work when the short-link package is absent.

A short URL works only on the machine running Pi and only while Pi's short-links server is running. Use a raw URL when another machine needs to open the link.

## What the raw URL contains

A raw link looks like this:

```text
https://metabase.example.com/question#<url-safe-base64-payload>
```

The fragment is a minified Metabase native-query payload encoded as UTF-8 and URL-safe Base64. Creating the link does not run the SQL or make a request to Metabase.

The SQL is encoded, not encrypted. Anyone with the raw URL can decode it. If you create a local short link, `pi-short-links` stores the full target URL in its local store.

## Development

You need Node.js 22.19 or newer.

```bash
npm install
npm run check
```

The test suite does not contact a live Metabase instance.

## License

MIT
