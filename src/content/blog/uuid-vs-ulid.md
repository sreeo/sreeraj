---
title: "Benchmarking UUID v4 vs ULID"
slug: "uuid-vs-ulid"
description: "Benchmarking UUID against ULID."
pubDate: "2023-02-22T07:03:20.000+00:00"
updatedDate: "2023-03-28T05:49:19.000+00:00"
featured: false
featureImage: "/images/uuid-vs-ulid/IMG_2649.jpeg"
tags:
  - "postgres"
  - "uuid"
  - "ulid"
author: "Sreeraj Rajan"
readingTime: 1
---

## tl;dr

ULID offers better performance compared to UUIDs (v4) since ULIDs are monotonic. Another advantage is ULID values can be stored in the UUID column type that postgres offers.

**ULID Generation**

```
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION generate_ulid() RETURNS uuid
    AS $$
        SELECT (lpad(to_hex(floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint), 12, '0') || encode(gen_random_bytes(10), 'hex'))::uuid;
    $$ LANGUAGE SQL;

SELECT generate_ulid();
```

### Benchmarks

## UUID (mean = 0.4531, median = 0.48)

![](/images/uuid-vs-ulid/image.png)
![](/images/uuid-vs-ulid/image-2.png)
![](/images/uuid-vs-ulid/image-5.png)
![](/images/uuid-vs-ulid/image-7.png)
![](/images/uuid-vs-ulid/image-8.png)
![](/images/uuid-vs-ulid/image-10.png)
![](/images/uuid-vs-ulid/image-12.png)
![](/images/uuid-vs-ulid/image-14.png)
![](/images/uuid-vs-ulid/image-18.png)
![](/images/uuid-vs-ulid/image-21.png)

## ULID (mean = 0.0708, median = 0.037)

![](/images/uuid-vs-ulid/image-1.png)
![](/images/uuid-vs-ulid/image-3.png)
![](/images/uuid-vs-ulid/image-4.png)
![](/images/uuid-vs-ulid/image-6.png)
![](/images/uuid-vs-ulid/image-9.png)
![](/images/uuid-vs-ulid/image-11.png)
![](/images/uuid-vs-ulid/image-13.png)
![](/images/uuid-vs-ulid/image-15.png)
![](/images/uuid-vs-ulid/image-19.png)
![](/images/uuid-vs-ulid/image-20.png)
