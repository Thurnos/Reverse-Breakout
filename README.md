# Reverse Breakout — Full Game Documentation

Reverse Breakout is a browser-based arcade survival roguelite.  
You control a small brick-like player and survive waves of bouncing balls. As time passes, the game moves through harder levels with new ball patterns and terrain. After each run, you earn gold and spend it in the rogue-lite shop to permanently upgrade your player.

---

## 1. How to Run the Game

### Quick start

1. Extract the game ZIP.
2. Open `index.html` in any modern browser.
3. Press **Start Run**.
4. Survive as long as possible.
5. After death, spend gold in the shop.
6. Start again stronger.

No server, database, or build tools are required.

### Included files

```text
index.html   Main game page
style.css    Visual styling and responsive layout
script.js    Full game logic
README.md    Documentation
```

---

## 2. Game Goal

The goal is simple:

```text
Survive as long as possible while avoiding balls.
```

The longer you survive, the more gold you earn. Gold is used after death to buy permanent upgrades. These upgrades make future runs easier, giving the game a rogue-lite progression loop.

---

## 3. Controls

### Keyboard movement

```text
W / Arrow Up       Move up
A / Arrow Left     Move left
S / Arrow Down     Move down
D / Arrow Right    Move right
```

### Mouse-follow movement

Click the canvas once to toggle mouse-follow mode.

When mouse-follow is enabled, the player follows your mouse cursor inside the arena.

Click again to disable mouse-follow.

### Stick weapon

Unlocked from **Level 3**.

```text
Space / E          Use stick weapon
```

The stick deletes nearby balls in a small radius around the player. It has a cooldown, so timing matters.

### Shop controls

After dying, the shop opens.

```text
1–6                Buy corresponding upgrade
Mouse click        Click BUY buttons
Enter / R          Start another run
```

---

## 4. Main Gameplay Loop

The game is built around a simple but addictive loop:

```text
Start run
    ↓
Survive ball waves
    ↓
Reach harder levels
    ↓
Die
    ↓
Earn gold
    ↓
Buy upgrades
    ↓
Start stronger next run
```

Progress is saved in the browser using `localStorage`.

---

## 5. Level System

The game has **7 levels**. Each level introduces different ball behavior and terrain.

Between each level, there is a short safe transition period. During this break:

```text
Old balls disappear
Old powerups disappear
The next level is announced
The player gets around 2.6 seconds to breathe
```

This prevents old level patterns and new level patterns from overlapping unfairly.

---

## 6. Levels

### Level 1 — Basic Survival

**Starts at:** 0 seconds  
**Main idea:** Basic random balls.

This is the intro level. Balls spawn from random edges and move into the arena.

Ball types:

```text
Normal balls
```

Terrain:

```text
No terrain obstacles
```

---

### Level 2 — Split Lines

**Starts at:** 30 seconds  
**Main idea:** Straight-line pressure.

This level introduces balls that move in clean vertical and horizontal lines.

Ball types:

```text
Vertical balls
Horizontal balls
```

Terrain:

```text
Two middle pillars
```

The pillars block and bounce balls, creating safer and more dangerous areas depending on position.

---

### Level 3 — Diagonal Blades

**Starts at:** 60 seconds  
**Main idea:** Diagonal movement and player weapon.

This level introduces diagonal balls coming from corners.

Ball types:

```text
Diagonal balls
```

New mechanic:

```text
Stick weapon unlocks
```

Press **Space** or **E** to delete nearby balls.

Terrain:

```text
Middle pillars remain
```

---

### Level 4 — Crossfire

**Starts at:** 90 seconds  
**Main idea:** Mixed attack patterns.

This level combines multiple ball types and adds extra obstacle blocks.

Ball types:

```text
Normal balls
Vertical balls
Horizontal balls
Diagonal balls
```

Terrain:

```text
Middle pillars
Extra side blocks
```

This level tests your ability to read multiple directions at once.

---

### Level 5 — Hunters

**Starts at:** 120 seconds  
**Main idea:** Balls aim at the player.

This level adds aimed balls. These balls choose the player's current position when they spawn and fly toward it.

Ball types:

```text
Aimed balls
Normal balls
Diagonal balls
```

Terrain:

```text
Horizontal barriers
Central small block
```

Aimed balls are dangerous if you stay still, but they can be dodged by changing direction after they spawn.

---

### Level 6 — Swarm

**Starts at:** 150 seconds  
**Main idea:** Small fast balls and unpredictable movement.

This level introduces tiny fast balls and zigzag balls.

Ball types:

```text
Tiny fast balls
Zigzag balls
Horizontal balls
Vertical balls
```

Terrain:

```text
Four square obstacle blocks
```

This level is chaotic, but the balls are smaller and more readable after the balancing changes.

---

### Level 7 — Final Chaos

**Starts at:** 180 seconds  
**Main idea:** Final survival test.

The final level combines the hardest ball types.

Ball types:

```text
Heavy balls
Aimed balls
Zigzag balls
Diagonal balls
Tiny fast balls
```

Terrain:

```text
Vertical barriers
Horizontal barriers
```

There is no next level after this. The goal is to survive as long as possible.

---

## 7. Ball Types

### Normal Ball

The standard ball.

Behavior:

```text
Spawns from a random edge
Moves inward with slight angle variation
Bounces off walls and obstacles
```

Color:

```text
Pink/red
```

---

### Vertical Ball

Moves only vertically.

Behavior:

```text
Spawns from top or bottom
Moves straight up or down
```

Color:

```text
Blue
```

Best counter:

```text
Move horizontally
Use pillars as cover
```

---

### Horizontal Ball

Moves only horizontally.

Behavior:

```text
Spawns from left or right
Moves straight across the arena
```

Color:

```text
Orange
```

Best counter:

```text
Move vertically
Watch the full width of the arena
```

---

### Diagonal Ball

Moves diagonally from corners.

Behavior:

```text
Spawns from one of the four corners
Moves diagonally across the arena
Uses balanced diagonal speed
```

Color:

```text
Purple
```

Best counter:

```text
Avoid corner-to-corner lines
Use the stick from Level 3 onward
```

---

### Aimed Ball

Targets the player’s position when it spawns.

Behavior:

```text
Spawns from an edge
Calculates the player position once
Moves toward that position
Does not continuously track after spawning
```

Color:

```text
Green
```

Best counter:

```text
Do not stand still
Change direction after it spawns
```

---

### Tiny Fast Ball

Small and quick.

Behavior:

```text
Small radius
Higher movement speed
Harder to see but deals less damage than heavy balls
```

Color:

```text
Yellow
```

Best counter:

```text
Stay calm and avoid overcorrecting movement
```

---

### Zigzag Ball

Moves with a side-to-side wave.

Behavior:

```text
Moves forward
Adds a sinusoidal sideways movement
Harder to predict than straight balls
```

Color:

```text
Pink/magenta
```

Best counter:

```text
Keep extra distance
Do not dodge too late
```

---

### Heavy Ball

Large and slower.

Behavior:

```text
Large radius
Moves slower
More dangerous on contact
```

Color:

```text
Red
```

Best counter:

```text
Avoid getting trapped by obstacles
Use stick or reflect shield if necessary
```

---

## 8. Terrain and Obstacles

Terrain changes between levels.

Obstacles:

```text
Block balls
Bounce balls away
Create safe pockets
Can also trap the player if positioned badly
```

Obstacle levels:

```text
Level 1: No obstacles
Level 2: Two middle pillars
Level 3: Same middle pillars
Level 4: Pillars plus side blocks
Level 5: Horizontal barriers and central block
Level 6: Four square blocks
Level 7: Final barrier layout
```

The terrain system makes each level feel different without changing the core controls.

---

## 9. Player Health

The player has HP.

Taking damage:

```text
Balls that hit the player reduce HP
Larger balls generally deal more damage
Shield can block damage
Reflect shield can bounce balls away before impact
```

If HP reaches 0, the run ends and the shop opens.

Permanent upgrades can increase maximum HP.

---

## 10. Powerups

Powerups fall from the top of the screen. Collect them by touching them with the player.

Powerups are shown as small glowing squares with letters/symbols.

---

### Heal Powerup

Symbol:

```text
+
```

Effect:

```text
Restores HP
```

The amount healed can be increased with the **Recovery Core** upgrade.

Best use:

```text
Useful at any time, especially in later levels.
```

---

### Shield Powerup

Symbol:

```text
S
```

Effect:

```text
Creates a protective shield
Blocks the next ball hit
Removes the ball that hits the shield
```

Important detail:

```text
This shield blocks damage once, then disappears.
```

Best use:

```text
Great when the arena becomes crowded.
```

---

### Slow Powerup

Symbol:

```text
T
```

Effect:

```text
Slows all current balls temporarily
After the effect ends, balls return close to normal speed
```

Best use:

```text
Strong during swarm or final chaos levels.
```

---

### Auto-Dodge Powerup

Symbol:

```text
A
```

Effect:

```text
Temporarily helps the player dodge nearby balls
Automatically nudges the player away from danger
```

Important detail:

```text
The player can still move normally while auto-dodge is active.
```

Best use:

```text
Helpful when overwhelmed, but not a complete autopilot.
```

---

### Reflect Shield Powerup

Symbol:

```text
R
```

Effect:

```text
Creates a circular reflect shield around the player
Balls that touch the circle are bounced away
Does not delete balls
Lasts for a limited time
```

Difference from normal shield:

```text
Normal Shield = blocks one hit
Reflect Shield = bounces multiple balls for a duration
```

Best use:

```text
Very strong when surrounded by multiple balls.
```

---

### Shrink Powerup

Symbol:

```text
↓
```

Effect:

```text
Shrinks the player temporarily
Keeps the same brick shape and proportions
Makes dodging easier
```

Important detail:

```text
The player does not become a square.
The width and height are scaled together.
```

Best use:

```text
Excellent during dense ball patterns.
```

---

## 11. Stick Weapon

The stick unlocks at **Level 3**.

Controls:

```text
Space / E
```

Effect:

```text
Deletes nearby balls in a small radius
Does not push balls away
Has a 2 second cooldown
```

The stick is displayed visually on the player once unlocked.

Upgrade interaction:

```text
Longer Stick increases the stick radius.
```

Best use:

```text
Use it when balls are close, not when they are far away.
```

---

## 12. Rogue-lite Gold System

At the end of each run, the player earns gold.

Gold is based on:

```text
Survival time
Level reached
Gold multiplier upgrades
```

Gold is stored in browser `localStorage`, so it remains after refreshing the page.

Gold is spent in the shop after death.

---

## 13. Shop System

The shop opens automatically after the player dies.

You can buy upgrades by:

```text
Clicking BUY buttons
Pressing number keys 1–6
```

The shop includes:

```text
Gold display
Last run gold reward
Upgrade name
Upgrade description
Current upgrade level
Maximum upgrade level
Progress bar
Upgrade radar chart
Cost button
```

---

## 14. Upgrade Radar

The upgrade radar visually shows overall upgrade progression.

Each point on the radar represents one upgrade category.

The farther the filled shape reaches toward a point, the more upgraded that category is.

This gives a quick visual overview of your build progress.

---

## 15. Permanent Upgrades

### 1. Vitality

Effect:

```text
Increases maximum HP by +20 per level
```

Good for:

```text
Surviving more hits
Longer runs
Learning later levels
```

Max level:

```text
10
```

---

### 2. Agility

Effect:

```text
Increases movement speed by +0.45 per level
```

Good for:

```text
Dodging fast balls
Escaping aimed balls
Repositioning during level transitions
```

Max level:

```text
10
```

---

### 3. Compact Frame

Effect:

```text
Reduces base player size by 4% per level
Keeps the same brick proportions
```

Good for:

```text
Making dodging easier
Reducing hitbox size
Surviving dense waves
```

Max level:

```text
6
```

Important:

```text
This is a permanent version of the shrink idea.
It does not distort the player into a square.
```

---

### 4. Longer Stick

Effect:

```text
Increases stick radius by +10 per level
```

Good for:

```text
Clearing nearby balls
Emergency survival in Level 3+
```

Max level:

```text
8
```

---

### 5. Gold Sense

Effect:

```text
Increases gold earned by +15% per level
```

Good for:

```text
Faster long-term progression
Buying other upgrades sooner
```

Max level:

```text
8
```

---

### 6. Recovery Core

Effect:

```text
Increases healing from Heal powerups by +4 per level
```

Good for:

```text
Sustain
Long runs
Recovering from mistakes
```

Max level:

```text
8
```

---

## 16. Saving and Resetting Progress

The game saves:

```text
Best survival time
Gold
Upgrade levels
```

Storage method:

```text
Browser localStorage
```

The **Reset Progress** button clears:

```text
Gold
Upgrades
Best time
```

Use it if you want to test progression from zero again.

---

## 17. Balancing Notes

The latest version includes balance changes:

```text
Larger screen: 1280x720
Slower ball speeds
Reduced late-level spawn pressure
More readable ball movement
Less impossible difficulty curve
```

The game should still become intense, but it should feel more fair and learnable.

---

## 18. Recommended Future Features

Possible features to add later:

```text
Boss level every 3 levels
Different player classes
Unlockable skins
Daily challenge mode
Leaderboard screen
Soundtrack
Pause menu
Settings menu
More powerups
More upgrade branches
Achievements
Save export/import
```

---

## 19. Developer Notes

Main systems are inside `script.js`.

Important sections:

```text
LEVELS              Level definitions
UPGRADE_DEFS        Upgrade definitions
spawnBall()         Ball pattern creation
spawnPowerup()      Powerup creation
applyPower()        Powerup behavior
update()            Main gameplay update loop
render()            Main drawing function
drawShop()          Shop UI
drawUpgradeRadar()  Radar chart
```

The game is intentionally self-contained and does not require any external libraries.

---

## 20. Quick Feature Summary

```text
Genre: Arcade survival roguelite
Platform: Browser
Main file: index.html
Progress saving: localStorage
Levels: 7
Powerups: 6
Permanent upgrades: 6
Shop: Yes
Upgrade radar: Yes
Level transitions: Yes
External dependencies: None
```

---

## 21. Credits / Project Identity

Project name:

```text
Reverse Breakout
```

Concept:

```text
A reverse-style breakout survival game where the player is the brick and the balls are the threat.
```

Current design direction:

```text
Arcade survival + roguelite progression
```
