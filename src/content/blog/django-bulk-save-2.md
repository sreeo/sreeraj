---
title: "Django Bulk Save - 2 Fast 2 Big"
slug: "django-bulk-save-2"
description: "Continuing from Django Bulk Save, I wanted to test how would the copy_from function perform when I scale to over a million records.

The copy_from scales incredibly well, it took 4 seconds to write 1.6 million rows.

The rest of the article strays away from the actual topic.

I decided to play around with different CSV libraries and figure out what would be the most efficient library to use when you have a file this large. You'd probably never encounter a scenario where you'd have to parse a mil"
pubDate: "2021-07-15T20:48:33.000+00:00"
updatedDate: "2021-07-15T20:48:33.000+00:00"
featured: false
featureImage: "/images/django-bulk-save-2/baralachala.jpg"
tags:
  - "tech"
  - "django"
author: "Sreeraj Rajan"
readingTime: 2
---

Continuing from [Django Bulk Save](https://sreeraj.dev/django-bulk-save/), I wanted to test how would the **copy\_from** function perform when I scale to over a million records.

The **copy\_from** scales incredibly well, it took 4 seconds to write 1.6 million rows.

**The rest of the article strays away from the actual topic.**

I decided to play around with different CSV libraries and figure out what would be the most efficient library to use when you have a file this large. You'd probably never encounter a scenario where you'd have to parse a million rows, transform some of them and write them to the database, but it felt like a problem to solve.

I set up two custom APIs, one using [python's native csv library](https://docs.python.org/3/library/csv.html?ref=sreeraj.dev) and the other using [pandas](https://pandas.pydata.org/docs/reference/api/pandas.read_csv.html?ref=sreeraj.dev).

```python
    @action(methods=["POST"], detail=False)
    def bulk_upload_via_csv(self, request, *args, **kwargs):
        uploaded_file = request.FILES["file"]
        file_stream = io.StringIO(uploaded_file.read().decode('utf-8'))
        csv_data = csv.DictReader(file_stream)

        stream = io.StringIO()
        writer = csv.writer(stream, delimiter='\t')

        for row in csv_data:
            writer.writerow([str(uuid.uuid4()), row["name"]])
        stream.seek(0)

        with closing(connection.cursor()) as cursor:
            cursor.copy_from(
                file=stream,
                table=IceCream.objects.model._meta.db_table,
                sep='\t',
                columns=('id', 'name'),
            )

        return Response(data={}, status=status.HTTP_200_OK)
```

API which uses python's csv library

```python
    @action(methods=["POST"], detail=False)
    def bulk_upload_via_pandas(self, request, *args, **kwargs):
        uploaded_file = request.FILES["file"]
        file_stream = io.StringIO(uploaded_file.read().decode('utf-8'))
        csv_data = pandas.read_csv(file_stream, delimiter=',').to_dict('records')

        stream = io.StringIO()
        writer = csv.writer(stream, delimiter='\t')

        for row in csv_data:
            writer.writerow([str(uuid.uuid4()), row["name"]])
        stream.seek(0)

        with closing(connection.cursor()) as cursor:
            cursor.copy_from(
                file=stream,
                table=IceCream.objects.model._meta.db_table,
                sep='\t',
                columns=('id', 'name'),
            )
        return Response(data={}, status=status.HTTP_200_OK)
```

API which uses pandas

The API using pandas was pretty slow compared to the native csv library. I am probably going about this in the wrong way. The **copy\_from** function accepts a csv file anyway, I should have probably used pandas to modify whatever I needed in the csv itself, and pass it to postgres rather than converting it to dict and then recreating the csv. If you probably are dealing with something like this, its best to probably dump this as is to the database, and run a asynchronous job to process this and save it to a different table.

If you also messing around with csvs and pandas, you should definitely check out [dask](https://docs.dask.org/en/latest/dataframe.html?ref=sreeraj.dev). It performs incredibly well especially when you have low memory. It is incredibly fast when using large datasets and manipulating them compared to pandas, and it does this via parallelism.
