# Summon Helper for Foundry VTT (Pathfinder 2e)

This module streamlines the process of summoning creatures in Foundry VTT for Pathfinder 2e. When you cast a spell with the summon trait, a user-friendly window appears, allowing you to quickly select and place a creature from your character's Summons folder.

## Features

- **Automatic Detection:** When you cast a spell with the summon trait, the module automatically opens the summon selection window.
- **Summons Folder:** The module looks for a folder named `<Character Name> Summons` in your Actors directory. Place all summonable creatures for each character in their respective folder.
- **Creature Selection:**
  - Filter creatures by level (multi-select supported).
  - Filter by one or more traits (checkboxes).
  - Both lists are scrollable if there are many options.
  - Creatures are sorted from highest to lowest level by default.
- **Summon Placement:**
  - Select a creature and click **Summon this!** to place its token on the canvas, adjacent to your character's token.
- **Template Placement:**
  - Optionally place a range template (circle) for 10 seconds by checking the "Place template for 10s?" box before summoning.
- **Reset Buttons:**
  - **Reset Level**: Clears level selection (shows all levels).
  - **Reset Traits**: Unchecks all trait filters.
- **Responsive UI:**
  - Level and trait lists are scrollable and visually matched.
  - The window auto-sizes to content and prevents overflow.
  - "Choose a creature" and "Place template" labels are aligned for clarity.

## How to Use

1. **Setup Summons Folder:**
   - For each character (PC or NPC), create a folder named `<Character Name> Summons` in the Actors tab.
   - For NPCs, you can also use folders like `NPC Summons` or `Monster Summons` as alternatives.
   - Add all summonable creatures (as Actor entries) to this folder.
2. **Cast a Summon Spell:**
   - When you cast a spell with the summon trait, the Summon Helper window will appear.
   - The module works for both Player Characters and NPCs.
3. **Select Creature and Options:**
   - Use the level and trait filters to find your desired creature.
   - (Optional) Check "Place template for 10s?" to show a range template.
   - Click **Summon this!** to place the token (and template, if selected).
4. **Reset Filters:**
   - Use **Reset Level** or **Reset Traits** to quickly clear your filters.

## Notes
- The module only works for Pathfinder 2e and Foundry VTT v12+.
- **NPC Support**: The module now works for both Player Characters and NPCs with improved folder detection.
- **Smart Folder Detection**: The module will try multiple strategies to find your summons folder:
  - Exact match: `<Character Name> Summons`
  - Partial match: Any folder containing the character name and "summons"
  - NPC-specific: Folders like "NPC Summons" or "Monster Summons" for NPCs
  - Fallback: Any folder containing "summons" with creatures
- If no Summons folder is found, you'll see helpful error messages listing available folders.
- The module does not add or manage summonable creatures; you must add them to the correct folder yourself.

## Support
For questions or issues, open an issue on the module's repository or ask in the Foundry VTT community.
