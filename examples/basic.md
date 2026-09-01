# Create your first Metabase link

Set the URL of your Metabase instance and the ID of the database you want to query:

```bash
export PI_METABASE_BASE_URL=https://metabase.example.com
export PI_METABASE_DATABASE_ID=2
```

If you do not know the database ID, open `https://metabase.example.com/admin/databases/` and choose the database. The last part of the URL is the ID. In `/admin/databases/2`, the ID is `2`.

Run Pi with your local checkout:

```bash
pi -e ~/pi-metabase-links
```

Now ask Pi:

```text
Create a Metabase link for: select 1;
```

Pi will call the tool with:

```json
{
  "sql": "select 1;"
}
```

Without `pi-short-links`, the result is a raw Metabase URL. When `pi-short-links` is loaded, the same request returns a shorter local URL and keeps the encoded target out of the model's output.

Set `"shorten": false` if the link needs to work on another machine that can access your Metabase instance.
