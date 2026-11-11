# Changelog

## [0.2.0](https://github.com/Shir0o/package-builder/compare/v0.1.0...v0.2.0) (2026-11-11)


### Features

* Add document-wide base font size setting and settings panel ([ddc8abb](https://github.com/Shir0o/package-builder/commit/ddc8abb1b4d4f5db508c61add03f948e9864bf56))
* Add document-wide base font size settings and panel ([8c3949c](https://github.com/Shir0o/package-builder/commit/8c3949ccc84b679f797f7cecc545c89e88c8ad2d))
* **collab:** configure production deployment settings for hosting and signaling server ([2882e3d](https://github.com/Shir0o/package-builder/commit/2882e3d51e5cf5e0c2159a5e0f7e271ee1f489f6))
* implement bulk verse editing and importing ([456052b](https://github.com/Shir0o/package-builder/commit/456052bb1b84ee74df05f7f6118190b362f4cacc))
* implement bulk verse editing and importing ([f84019c](https://github.com/Shir0o/package-builder/commit/f84019c8acf379980c5d4a6c949e857827e1ae52))
* move document settings to topbar settings button ([#31](https://github.com/Shir0o/package-builder/issues/31)) ([8d17a94](https://github.com/Shir0o/package-builder/commit/8d17a94cc4b1962d44a1a6373799f8d10e627cae))


### Bug Fixes

* address PR review feedback on font size settings scaling and UI ([6547e30](https://github.com/Shir0o/package-builder/commit/6547e303a409249667efe841288c427233bfbe56))
* **ci:** set explicit read permissions on workflow (alert [#2](https://github.com/Shir0o/package-builder/issues/2)) ([#60](https://github.com/Shir0o/package-builder/issues/60)) ([99a6889](https://github.com/Shir0o/package-builder/commit/99a68897f4e2d8ac52a2a04d970caa2423955877))
* **deps:** bump vitest and override ws (alerts [#14](https://github.com/Shir0o/package-builder/issues/14), [#32](https://github.com/Shir0o/package-builder/issues/32), [#33](https://github.com/Shir0o/package-builder/issues/33)) ([#63](https://github.com/Shir0o/package-builder/issues/63)) ([f356b98](https://github.com/Shir0o/package-builder/commit/f356b98e63a2066a800f8479a37c9101dedfade8))
* fix PDF export pagination, default notes line count, and add prefill prediction ([a1d616a](https://github.com/Shir0o/package-builder/commit/a1d616ae0b8dff724560e44338739fb9d8d7d8ef))
* fix pdf export pagination, default notes line count, and add prefill prediction for blocks ([7e9e80d](https://github.com/Shir0o/package-builder/commit/7e9e80d5aa6c356067f50c84a63c9bf077479562))
* height-aware pagination so PDF export no longer clips content ([5313d64](https://github.com/Shir0o/package-builder/commit/5313d6401c272d9586e7ec095be90240e8bd4064))
* pin print .paper height to 11in so pg-number stays anchored ([67f471a](https://github.com/Shir0o/package-builder/commit/67f471a2e60584a8ad63d66c1c9f461f7ede08ce))
* prevent cover dateline orphan and stray pg-numbers in print ([b6be103](https://github.com/Shir0o/package-builder/commit/b6be103e2b243e521568604d2e01a70c1f10ceed))
* prevent cover dateline orphan and stray pg-numbers in print ([d2fe83f](https://github.com/Shir0o/package-builder/commit/d2fe83febd5f9c3ba253b23257d5db74eb3714cd))
* prevent top bar name and actions from overlapping ([#32](https://github.com/Shir0o/package-builder/issues/32)) ([9165358](https://github.com/Shir0o/package-builder/commit/91653587f8953d7262c1b8709f9ad4bc7227c288))
* side panel navigation scroll into view and drag-and-drop index offset ([81dea59](https://github.com/Shir0o/package-builder/commit/81dea5935e9c12a5a8ef310c72c9c231dba40c24))
* side panel navigation scroll into view and drag-and-drop index offset ([2ba969c](https://github.com/Shir0o/package-builder/commit/2ba969c5111163acd2cd26390549abf7fb3835b6))
* **ui:** prevent settings menu and zoom bar clipping on mobile viewports ([#66](https://github.com/Shir0o/package-builder/issues/66)) ([27ad352](https://github.com/Shir0o/package-builder/commit/27ad35248dfff5697df68ea7750f8e02148b541c))


### Refactoring

* address review feedback on pagination ([0b5964b](https://github.com/Shir0o/package-builder/commit/0b5964be3c933abaa814d4db4ba62427ddcb2965))
* apply PR code review suggestions ([5648350](https://github.com/Shir0o/package-builder/commit/5648350937ee5b61311a39eb3f9fccd82e16e864))
* optimize syncing with useRef and improve refRegex for cross-chapter references ([1882916](https://github.com/Shir0o/package-builder/commit/1882916518b8266912cc7572d1ec4f4e788f30a4))
