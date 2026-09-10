# Event Horizon visual identity

The Void Seraph's Mythic previously reused the tier-five mantle with a slightly larger scale, a plinth accent and a brighter core. It now has a dedicated model: one eclipsed crown, four swept wings, a tapered suspended figure and restrained violet accents. The crown turns slowly in its own plane; the figure and wings levitate continuously with a small amplitude. The existing heart attachment still supplies beam origins.

Captured the actual game at desktop and 844×390 landscape sizes, both firing and idle, plus four seconds of animation. The staged scene used 165 draw calls versus 158 before. The model uses the existing merged voxel meshes and shared materials, without transparent effects or new particles. JavaScript grows about 0.7 KiB gzip; the total budget moves from 296 to 297 KiB, with the initial app limit still 160 KiB.

Validation: build, lint, bundle checks, 52 existing Mythic/Seraph/recovery unit tests and four browser checks covering mobile sandbox, restored mastery purchasing, inspector controls and historical saves. This is a frontend visual change; combat definitions and the co-op ruleset are unchanged, and no server restart is needed.

- [Before](seraph/seraph6b-mythic-before.jpg)
- [Firing](seraph/seraph6b-mythic-after.jpg)
- [Idle](seraph/seraph6b-mythic-after-idle.jpg)
- [Mobile](seraph/seraph6b-mythic-after-mobile.jpg)
- [Motion](seraph/seraph6b-mythic-after-motion.webm)
