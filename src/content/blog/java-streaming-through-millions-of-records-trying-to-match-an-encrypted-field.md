---
title: "Streaming through millions of records trying to match an encrypted field : Java"
slug: "java-streaming-through-millions-of-records-trying-to-match-an-encrypted-field"
description: "A year ago I was working on a really tiny part of a large non-consumer facing product (idk what's the correct term). I can't divulge much, I have done a lot of illegal things like calling a politician an idiot on social media, so I don't want to add more to the list.

Imagine you ran an ice cream subscription service, and you had a lot of people on the payroll tasked with managing renewals for subscribers. Let's call them agents. You had an online portal for customers to manage/renew their subsc"
pubDate: "2021-07-15T20:48:12.000+00:00"
updatedDate: "2021-07-16T16:49:52.000+00:00"
featured: false
featureImage: "/images/java-streaming-through-millions-of-records-trying-to-match-an-encrypted-field/dawkifinal.jpg"
tags:
  - "tech"
  - "java"
  - "spring batch"
author: "Sreeraj Rajan"
readingTime: 3
---

A year ago I was working on a really tiny part of a large non-consumer facing product (idk what's the correct term). I can't divulge much, I have done a lot of illegal things like calling a politician an idiot on social media, so I don't want to add more to the list.

Imagine you ran an ice cream subscription service, and you had a lot of people on the payroll tasked with managing renewals for subscribers. Let's call them **agents.** You had an online portal for customers to manage/renew their subscriptions but a large percentage of renewals came through the **agents** receiving payments offline. The **agents** notified a team who maintained all renewals in an csv sheet. This team used to upload the sheet of all renewals to a service on which the service was supposed to mark the corresponding subscriptions as **renewed** in the database. The only catch was one of the fields in the csv which was used to match the record in the database was encrypted. The encryption used had some custom logic and I was the one tasked to figure this out. I couldn't encrypt the value in the csv and do a direct match in the database since most of the values were embedded with hyphens or slashes.

The following is an example of the encrypted field having two possible representations but are to be considered equal.

```
Value in file: 1212-1212/1121     Encrypted Value: 21asdasda121!sadasd
Value in database: 12121-2121121  Encrypted Value: fageerufa53221!masd
```

### approach #1

I went with a caveman approach, loading all the rows in the database to memory, iterating through all of them, decrypting the field, removing all non-essential characters and then doing a comparison. I don't think I need to elaborate what happened when I pushed this to production.

### approach #2

I modified the repository call to return a stream of IceCreams. This approach was far less strenuous  but it still took a fair while to iterate and match all possible subscriptions in the csv.

```java
Stream<IceCream> iceCreamStream = iceCreamRepository.findByEncryptedFieldNotNull();
  
iceCreamStream.forEach(iceCream -> {
    // do some processing
    entityManager.detach(iceCream);
});
```

### approach #3

I fetched all the rows from db in a paginated manner, set the **decrypted** field as a key to the hashmap which was stripped of all special characters, with the value being the id of that particular subscription. I then iterated through all the records of the csv, and used the encrypted field value (decrypted in the csv) to find a match in the hashmap. Added the value returned for every match to a list whose corresponding records in the database would be later updated in a bulk operation.

```
Pageable pageRequest = PageRequest.of(0, 20000);
Page<IceCream> iceCreamPage = iceCreamRepository.findByEncryptedFieldNotNull(localDateTime, pageRequest);

while (!iceCreamPage.isEmpty()) {
    pageRequest = pageRequest.next();

    List<IceCream> iceCreams = iceCreamPage.getContent();

    for (int i = 0; i < iceCreams.size() - 1; i++) {
        map.put(iceCreams.get(i).getEncryptedFieldName(), iceCreams.get(i).getIceCreamPublicId());
    }

    iceCreamPage = iceCreamRepository.findByEncryptedFieldNotNull(localDateTime, pageRequest);
}


for (int i = 0; i < agentIceCreamRenewals.size() - 1; i++) {
    var agentIceCreamRenewal = agentIceCreamRenewals.get(i);
    var decryptedField = agentIceCreamRenewal.getEncryptedField().replaceAll("[-\\/\\\\]", "");

    if (map.containsKey(decryptedField)) {
        // this is a match
    }
}
```

The first two approaches took around couple of hours for the job to finish [(the service was written using Spring Batch)](https://spring.io/projects/spring-batch?ref=sreeraj.dev). **The third approach was way faster taking less than a minute**. I think it was better having a hashmap with key and value both possessing String values than have a million entities in memory.

I am not sure if this was the most the efficient way I could solve this. But at the time, it was something that got the job done, so yeah.
