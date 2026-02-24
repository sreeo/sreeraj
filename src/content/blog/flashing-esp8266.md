---
title: "Flashing an ESP8266-01"
slug: "flashing-esp8266"
description: "Flashing a ESP8266? Follow this guide written by a beginner for beginners."
pubDate: "2023-08-04T09:20:24.000+00:00"
updatedDate: "2023-08-05T11:36:47.000+00:00"
featured: true
featureImage: "/images/flashing-esp8266/IMG_3319.jpg"
tags:
  - "arduino"
  - "esp8266"
  - "usb"
  - "usb ttl"
  - "ttl"
  - "tech"
  - "circuit"
  - "electronics"
  - "bootloader"
  - "flashing"
author: "Sreeraj Rajan"
readingTime: 2
---

I've been working on integrating a Nova PM sensor with an ESP8266-01 controller to send some AQI data to an API hosted on the internet. I have very little experience working with circuit boards, so it took me some time to figure out the nitty-gritties and nuances of working with these devices. There are multiple variations of ESP8266 boards available, this tutorial focuses on the ESP8266-01 board which looks like this.

![ESP8266-01](/images/flashing-esp8266/image-2.png)
*ESP8266-01*

  
  
  
 Here's a list of things you'd need to flash a ESP8266-01

1.  ESP8266-01
2.  USB TTL Serial Converter
3.  Breadboard
4.  Jumper cables (In this case, Female to Male \[ESP8266/USB TTL to breadboard\] and Male to Male)
5.  Push Button (makes life easier to switch to flash or normal mode)

The USB TTL device comes labelled with appropriate pins.

![USB TTL device](/images/flashing-esp8266/image-4.png)
*USB TTL device*

A breadboard is used here since the ESP8266 has multiple pins would require to be connected to the 3v and the Ground. A breadboard is divided into multiple rows and columns. [Read this if you want to understand in detail about breadboards (solderless)](https://learn.sparkfun.com/tutorials/how-to-use-a-breadboard/all?ref=sreeraj.dev)

Use the following diagram as a reference while connecting the cables.

![ESP8266-E01 diagram](/images/flashing-esp8266/Untitled--1-.png)
*ESP8266-E01 diagram*

**Wiring instructions**

1.  USB TTL R(x) --> ESP8266 T(x)
2.  USB TTL T(x) --> ESP8266 R(x)
3.  USB TTL 3.3v --> ESP8266 3.3v
4.  USB TTL GND --> ESP8266 GND
5.  USB TTL 3.3v --> ESP8266 CH\_PD/EN
6.  USB TTL GND --> ESP8266 GPIO0

  

**ESP8266 circuit diagram**

![USB TTL ESP8266 breadboard circuit](/images/flashing-esp8266/esp-flash-circuit--1-.png)
*USB TTL ESP8266 breadboard circuit*

Legend:

1.  Green - RX
2.  Orange - TX
3.  Red - 3.3v
4.  Blue - GND
5.  Black - RST
6.  Grey Square with black circle - Push button

To enable bootloader/flash mode on the ESP8266, the RST pin needs to be low when all the above wires have been configured. There are two ways you can achieve this.  

**Method 1**

1.  Place a push button on the breadboard and draw a cable from the GND to one corner of the button.
2.  Connect the RST pin of the ESP8266 to the other corner of the button such that a line between the corners of the button should be a diagonal.
3.  Connect the USB TTL to a computer, ensure you have the correct device and port selected on your IDE (I was using Arduino IDE), push the reset button and  flash away!  
    

If this doesn't work, you might have to start flashing from your IDE and then push the reset button for the upload to work.

**Method 2**

1.  After connecting all cables, connect the RST pin to the GND row on your breadboard and then connect the USB TTL device to your computer.
2.  Start flashing on your IDE and immediately remove the RST pin from the breadboard.

  
  
If everything's in your favour, you'd see something like this on your IDE console.

![](/images/flashing-esp8266/image-8.png)
