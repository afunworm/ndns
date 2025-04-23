# nDNS - Node DNS Service, inspired by [traefik.me](https://traefik.me)

### What is it?

Automatically resolve any subdomain to the IP encoded in that subdomain. Note that 127.0.0.1 can be replaced with your own domain if you expose the service to the public.

Examples:

```
dig test-127-0-0-1.yourdomain.com @127.0.0.1 +short
127.0.0.1

dig test-127-0-0-1-with-suffix.yourdomain.com @127.0.0.1 +short
127.0.0.1

dig www.crazy-long-mix.test.192.168.0.1.yourdomain.com @127.0.0.1 +short
192.168.0.1

dig -t AAAA 1a01-4f8-c17-b8f--2.yourdomain.com @127.0.0.1 +short
1a01:4f8:c17:b8f::2

dig -t TXT version.yourdomain.com @127.0.0.1 +short
Node DNS v1.0.0

dig -t TXT whoami.yourdomain.com @127.0.0.1 +short
Your IP is your_public_ip
```

### Run nDNS via Docker (recommended)

Create a file `docker-compose.yml`:

```YAML
services:
    ndns:
        image: afunworm/ndns:latest
        restart: unless-stopped
        ports:
            - '53:53/udp'
        environment:
            - ROOT_DOMAIN=yourdomain.com
            - PORT=53
            - HOST=0.0.0.0
            - TTL=60
        tty: true
        stdin_open: true
```

And run it with `docker compose up -d`.

### Buildf rom source:

Clone the git, then run:

```
npm install --production
```

And run it:

```
node index.mjs
```
