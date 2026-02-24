---
title: "UUID vs Serials"
slug: "comparing-indexes-in-postgres-for-different-column-types"
description: "Benchmarking UUID and Serial Values in Postgres and Python."
pubDate: "2022-12-21T17:12:14.000+00:00"
updatedDate: "2023-05-22T18:12:50.000+00:00"
featured: false
featureImage: "/images/comparing-indexes-in-postgres-for-different-column-types/office---1.jpeg"
tags:
  - "postgres"
  - "python"
  - "uuid"
author: "Sreeraj Rajan"
readingTime: 2
---

```

CREATE TABLE test_uuid (
    id uuid DEFAULT uuid_generate_v4(),
    name VARCHAR,
    phone VARCHAR,
    created_at timestamp with time zone default now(),
    PRIMARY KEY (id)
);

CREATE TABLE foreign_uuid(
   id uuid DEFAULT uuid_generate_v4(),
   test_id uuid,
   name VARCHAR(255),
   PRIMARY KEY(id),
   CONSTRAINT fk_uuid
   FOREIGN KEY(test_id) 
   REFERENCES test_uuid(id)
);

CREATE TABLE foreign_serial(
   id serial,
   test_id int,
   name VARCHAR(255),
   PRIMARY KEY(id),
   CONSTRAINT fk_id_serial
   FOREIGN KEY(test_id) 
   REFERENCES test_serial(id)
);



CREATE TABLE test_serial (
    id serial,
    name VARCHAR,
    phone VARCHAR,
    created_at timestamp with time zone default now(),
    PRIMARY KEY (id)
);
```

I created two tables `test_uuid` and `test_serial` with uuid and serial columns as the primary keys respectively.  Both these tables have approximately a million rows.

There are two more tables `foreign_serial` and `foreign_uuid` which have foreign keys to `test_serial` and `test_uuid` . Both of these tables have 100,000 records.

The following are the benchmarks for different operations on the two columns. All of the queries have been run multiple times. The results posted denote the median duration for execution.

The benchmark was run on postgres 13 running on a linode machine with 1 CPU and 2 GB memory

## Order By

**1\. UUID**

![](/images/comparing-indexes-in-postgres-for-different-column-types/image-26.png)

Execution Time: **857.755** ms

**2\. Serial**

![](/images/comparing-indexes-in-postgres-for-different-column-types/image-27.png)

Execution Time: **264.139** ms

## Accessing a row

The difference is negligible for both UUID and Serial columns.

![](/images/comparing-indexes-in-postgres-for-different-column-types/image-13.png)

## Join

**Running a join on a large set of rows**  
**1.**  **UUID**

![](/images/comparing-indexes-in-postgres-for-different-column-types/image-15.png)

Execution Time: **958.832** ms

**2\. Serial**

![](/images/comparing-indexes-in-postgres-for-different-column-types/image-16.png)

Execution Time: **121.893** ms

**Running a join on a single row**  
**1\. UUID**

![](/images/comparing-indexes-in-postgres-for-different-column-types/image-19.png)

Execution Time: **12.991** ms

**2\. Serial**

![](/images/comparing-indexes-in-postgres-for-different-column-types/image-20.png)

Execution Time: **18.261** ms

##   
Group By

**1\. UUID**

![](/images/comparing-indexes-in-postgres-for-different-column-types/image-25.png)

Execution Time:  **1376.974** ms

**2\. Serial**

![](/images/comparing-indexes-in-postgres-for-different-column-types/image-24.png)

Execution Time: **771.580** ms

Summarising, UUIDs seem to perform worse than serial/int columns on operations involving **n** rows, sometimes by a magnitude of 3.

### Benchmarking UUID and Integer in Python

There aren't many resources that describe how **postgres** internally stores UUID values. So I created a binary tree with integer and UUID values (values converted to integer) with 1000 nodes and did a small benchmark.  

```python
>>> # generate a tree with 1000 integers
>>> int_tree = binary_tree_int(1000)
>>> int_timer = timeit.Timer(lambda: int_tree.find(947))
>>> int_timer.timeit(3)
0.0024061249999931533
```

**Binary Tree With Plain Integer Values**

```
>>> # generate a tree with 1000 uuid values
>>> uuid_tree = binary_tree_uuid(1000)
>>> uuid_timer = timeit.Timer(lambda: uuid_tree.find(145519741522210453075912730917727185547))
>>> uuid_timer.timeit(2)
7.775000017318234e-05
```

**Binary Tree With UUID Values (UUID converted to Integer)**

There's a stark difference with respect to performance when you compare UUID to integer values. Serial values have a storage size of 4 bytes and UUID values take 16 bytes of storage.
