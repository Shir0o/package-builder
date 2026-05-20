import type { Package } from "./types";

export const SEED_PACKAGE: Package = {
  title: "Summer School of Truth 2025 — God's Full Salvation",
  pageNumbers: true,
  blocks: [
    {
      id: "b_cover",
      type: "cover",
      data: {
        eyebrow: "Church in Santa Ana",
        title: "Summer School of Truth 2025",
        subtitle: "God's Full Salvation",
        dateline: "June 13 – 22, 2025",
      },
    },
    {
      id: "b_sched_h",
      type: "heading",
      data: { level: 2, text: "Schedule", align: "left" },
    },
    {
      id: "b_sched",
      type: "schedule",
      data: {
        rows: [
          {
            num: "1",
            topic: "God's Creation of Man as a Three-part Vessel\nThe Tree of Life and the River",
            when: "Friday 6/13  ·  8:00 PM",
          },
          {
            num: "2",
            topic: "The Fall of Man\nMan's Need of Salvation",
            when: "Saturday 6/14  ·  10:30 AM",
          },
          {
            num: "3",
            topic:
              "The Source of Salvation — God's Love\nThe Basis of Salvation — God's Righteousness",
            when: "Saturday 6/14  ·  7:00 PM",
          },
          {
            num: "4",
            topic: "Redemption\nForgiveness and Cleansing of Sins",
            when: "Monday 6/16  ·  7:30 PM",
          },
          {
            num: "5",
            topic: "Justification\nReconciliation",
            when: "Tuesday 6/17  ·  7:30 PM",
          },
        ],
      },
    },
    { id: "b_pb1", type: "pagebreak", data: {} },
    {
      id: "b_msg_h",
      type: "heading",
      data: { level: 2, text: "Message One", align: "left" },
    },
    {
      id: "b_msg_sub",
      type: "heading",
      data: {
        level: 3,
        text: "Verse Sheet — God's Creation of Man as a Three-part Vessel",
        align: "left",
      },
    },
    {
      id: "b_v1",
      type: "verses",
      data: {
        title: "Lesson 4",
        groups: [
          {
            ref: "Genesis 1:26",
            text: "26 And God said, Let Us make man in Our image, according to Our likeness; and let them have dominion over the fish of the sea and over the birds of heaven and over the cattle and over all the earth and over every creeping thing that creeps upon the earth.",
          },
          {
            ref: "1 Thessalonians 5:23",
            text: "And the God of peace Himself sanctify you wholly, and may your spirit and soul and body be preserved complete, without blame, at the coming of our Lord Jesus Christ.",
          },
          {
            ref: "Genesis 2:7",
            text: "Jehovah God formed man from the dust of the ground and breathed into his nostrils the breath of life, and man became a living soul.",
          },
          {
            ref: "John 3:6",
            text: "That which is born of the flesh is flesh, and that which is born of the Spirit is spirit.",
          },
        ],
      },
    },
    {
      id: "b_notes",
      type: "notes",
      data: { title: "Message One — Notes", lines: 12 },
    },
    { id: "b_pb2", type: "pagebreak", data: {} },
    {
      id: "b_songs_h",
      type: "heading",
      data: { level: 2, text: "Songs", align: "left" },
    },
    {
      id: "b_song1",
      type: "song",
      data: {
        title: "Calling on His Name",
        stanzas: [
          {
            type: "verse",
            text: "Life's too short\nTo waste a single day.\nThe kingdom life\nIs closer every day.",
          },
          {
            type: "chorus",
            text: "In the midst of time,\nThe kingdom's mine\nJust by calling on His name each day.",
          },
          {
            type: "verse",
            text: "The sweetest taste\nOf life is deep within.\nIts flowing out\nIs primed by calling Him.",
          },
          {
            type: "chorus",
            text: "In the midst of time,\nThe kingdom's mine\nJust by calling on His name each day.",
          },
          {
            type: "verse",
            text: "Time is quickly\nRunning out each day;\nThe Lord will come\nAnd swiftly end this age.",
          },
          {
            type: "chorus",
            text: "At the end of time,\nThe goal we see.\nThe millennium is our entry.",
          },
          {
            type: "chorus",
            text: "At the end of time,\nThe goal we see.\nThe New Jerusalem we'll be.",
          },
        ],
      },
    },
  ],
};
