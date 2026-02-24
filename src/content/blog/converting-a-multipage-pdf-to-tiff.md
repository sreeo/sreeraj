---
title: "Converting a multipage pdf to tiff"
slug: "converting-a-multipage-pdf-to-tiff"
description: "Converting a multipage pdf to tiff"
pubDate: "2024-02-08T08:35:40.000+00:00"
updatedDate: "2024-02-08T08:35:40.000+00:00"
featured: false
featureImage: "/images/converting-a-multipage-pdf-to-tiff/IMG_4828.jpg"
tags:
  - "python"
  - "tech"
  - "pdf"
  - "tiff"
  - "convert"
  - "pdf to tiff conversion"
author: "Sreeraj Rajan"
readingTime: 2
---

Let's get to it, shall we?  
We were building out a product for a bank, tying with multiple services. We had a flow where the customer was redirected to complete a VKYC on a third party service, and the service used to send out a webhook with a bunch of images and a PDF. We had to then push that to a third party CRM integrated with the bank. The problem, the CRM accepted only `.tiff` files.

It was pretty simple easy to convert the images to tiff via pillow. Converting the pdf took a lot of effort in terms of going through the documentation and reading stackoverflow comments.  
  
The approach was simple, convert each of the PDF page to images (jpeg/png) and then merge them all together to form a multiple image TIFF.  
  

```python
import base64
from io import BytesIO
from pdf2image import convert_from_bytes


def _convert_pdf_to_tiff(base64str):
  image_base64_encoded = base64str.encode()
  content = base64.b64decode(image_base64_encoded)
  buffered = BytesIO()
  all_images = convert_from_bytes(content)
  all_images[0].save(buffered,
                     format="TIFF",
                     compression="jpeg",
                     save_all=True,
                     append_images=all_images[1:])
  return base64.b64encode(buffered.getvalue()).decode("utf-8")
```

The function takes in a base64 str value of the pdf. We convert the pdf to images using the `pdf2image` lib. It also has a `convert_from_path` function which takes in the path of the pdf file if you don't want to deal with raw bytes. The `convert_from_bytes` returns a List of Pillow Images, one image for every page in the pdf. You can also pass a `thread_count` parameter to the function, if you were running it on a multicore setup to speed up the conversion especially for larger files.

The pillow images then can be save to a different format (TIFF), and it also accepts a `append_images` parameter. The final output is a TIFF file with all the images inside it.
