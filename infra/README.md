Check free ports first: `ss -tlnp`. Web binds 127.0.0.1:8080. Add a vhost from Caddyfile.example (or an nginx equivalent). Open nothing new in the OCI security list except 80/443 if not already open.
