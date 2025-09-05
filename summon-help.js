// Summon Helper for Foundry VTT v12 Pathfinder 2e
Hooks.on('ready', async () => {
  // Listen for spell casting with summon trait
  Hooks.on('createChatMessage', async (message, options, userId) => {
    const origin = message.flags?.pf2e?.origin;
    if (origin?.type === 'spell' && origin?.rollOptions?.includes('origin:item:trait:summon')) {
      // Get actor from origin.actor (UUID)
      const actorId = origin.actor?.replace('Actor.', '');
      const actor = game.actors.get(actorId);
      // Try to get the spell item from the UUID
      let spellItem = null;
      if (origin?.uuid) {
        spellItem = await fromUuid(origin.uuid);
      }
      let range = null;
      if (spellItem && spellItem.system?.range?.value) {
        range = spellItem.system.range.value;
      }
      // Draw a measurement circle template on the caster's token with the spell's range
      if (range && actor) {
        // Try to extract a number from the range string (e.g., "30 feet" -> 30)
        let distance = null;
        if (typeof range === 'number') {
          distance = range;
        } else if (typeof range === 'string') {
          const match = range.match(/(\d+)/);
          if (match) distance = parseInt(match[1], 10);
        }
        if (Number.isFinite(distance)) {
          // Find the caster's token on the canvas
          const casterToken = canvas.tokens.placeables.find(t => t.actor?.id === actor.id);
          if (casterToken) {
            // Create a circle template
            const templateData = {
              t: "circle",
              user: game.user.id,
              x: casterToken.center.x,
              y: casterToken.center.y,
              distance: distance,
              direction: 0,
              fillColor: game.user.color
            };
            await canvas.scene.createEmbeddedDocuments("MeasuredTemplate", [templateData]);
          }
        }
      }
      showSummonWindow({name: 'Summon Spell', range}, actor);
    }
  });
});

async function showSummonWindow(item, actor) {
  // Search for any folder named '<character_name> Summons' anywhere, regardless of parent
  let folder = null;
  if (actor && actor.name) {
    const allFolders = game.folders.contents;
    const subfolderName = `${actor.name} Summons`;
    folder = allFolders.find(f => f.name === subfolderName);
    if (!folder) {
      ui.notifications.info(`No folder found named: ${subfolderName}`);
    }
  }
  if (!folder) {
    ui.notifications.warn(`Summons folder for this character not found! (Summons/<character_name> Summons)`);
    return;
  }
  // Get all actors in the folder
  const actors = folder.contents.filter(a => a.documentName === 'Actor');
  if (!actors.length) {
    ui.notifications.warn('No creatures found in this character\'s Summons folder!');
    return;
  }
  // Gather levels and build dropdowns


  // Prepare actors with level and traits info, sort by level ascending
  let actorsWithLevel = actors.map(a => {
    let level = a.system?.details?.level?.value ?? a.system?.level ?? '';
    let traits = a.system?.traits?.value || [];
    return { id: a.id, name: a.name, level: Number(level) || 0, traits };
  });
  actorsWithLevel.sort((a, b) => a.level - b.level);

  let actorLevels = actorsWithLevel.map(a => a.level).filter(lvl => lvl !== '').map(Number);
  let uniqueLevels = [...new Set(actorLevels)].sort((a, b) => a - b);
  let levelOptions = uniqueLevels.map(lvl => `<option value='${lvl}'>${lvl}</option>`).join('');

  // Gather all unique traits for all creatures (for initial render)
  let allTraits = Array.from(new Set(actorsWithLevel.flatMap(a => a.traits))).sort();
  let traitCheckboxes = allTraits.map(trait => `
    <label style="margin-right:8px;"><input type="checkbox" class="trait-filter" value="${trait}"> ${trait}</label>
  `).join('');

  // By default, show all creatures sorted by level
  let creatureOptions = actorsWithLevel.map(a => {
    return `<div class="summon-creature-option" data-id="${a.id}" data-level="${a.level}" data-traits="${a.traits.join(',')}">${a.level ? `LVL${a.level} ` : ''}${a.name}</div>`;
  }).join('');

  let html = `<form>
    <div style="display:flex;align-items:center;gap:16px;">
      <div>
        <label for='level-select'>Filter by level:</label>
        <select id='level-select'>
          <option value=''>All</option>
          ${levelOptions}
        </select>
      </div>
      <div id='trait-filters'>
        ${traitCheckboxes}
      </div>
    </div>
    <br>
    <label>Choose a creature:</label>
    <div id='summon-list' style='max-height: 240px; overflow-y: auto; border: 1px solid #ccc; border-radius: 4px; padding: 4px;'>
      ${creatureOptions}
    </div>
    <br>
    <button type='button' id='summon-btn'>Summon this!</button>
  </form>`;
  let d = new Dialog({
    title: 'Summon Creature',
    content: html,
    buttons: {},
    render: html => {
      // Store all creature options for reliable re-filtering
      const allCreatureOptions = html.find('.summon-creature-option').map(function() {
        return $(this).clone();
      }).get();

      // Filtering function
      function filterCreatures() {
        const selectedLevel = Number(html.find('#level-select').val());
        const selectedTraits = html.find('.trait-filter:checked').map(function() { return this.value; }).get();
        let filtered = allCreatureOptions.filter(function(opt) {
          const creatureLevel = Number($(opt).data('level'));
          const creatureTraits = ($(opt).data('traits') || '').split(',').filter(Boolean);
          // Level filter
          if (selectedLevel && creatureLevel > selectedLevel) return false;
          // Trait filter: must have all selected traits
          if (selectedTraits.length && !selectedTraits.every(trait => creatureTraits.includes(trait))) return false;
          return true;
        });
        filtered = filtered.sort(function(a, b) {
          return Number($(a).data('level')) - Number($(b).data('level'));
        });
        html.find('#summon-list').empty().append(filtered);
        // Select the first visible creature
        html.find('.summon-creature-option').removeClass('selected');
        const firstVisible = html.find('.summon-creature-option').first();
        if (firstVisible.length) {
          firstVisible.addClass('selected');
        }
      }

      html.find('#level-select').on('change', filterCreatures);
      html.find('.trait-filter').on('change', filterCreatures);

      // Selection logic for the list
      html.on('click', '.summon-creature-option', function() {
        html.find('.summon-creature-option').removeClass('selected');
        $(this).addClass('selected');
      });

      // Initial selection
      html.find('.summon-creature-option').first().addClass('selected');

      html.find('#summon-btn').click(async () => {
        const selectedDiv = html.find('.summon-creature-option.selected');
        if (!selectedDiv.length) return ui.notifications.warn('No creature selected!');
        const summonActorId = selectedDiv.data('id');
        const summonActor = game.actors.get(summonActorId);
        if (!summonActor) return ui.notifications.warn('Actor not found!');
        // Place token adjacent to caster's token if available
        let pos;
        const casterToken = canvas.tokens.controlled[0];
        if (casterToken) {
          // Place to the right (east) of caster
          const gridSize = canvas.scene.grid.size;
          pos = {
            x: casterToken.x + gridSize,
            y: casterToken.y
          };
        } else {
          // Default to center of scene
          pos = {x: canvas.scene.width/2, y: canvas.scene.height/2};
        }
        // Prepare token data from actor prototype
        const tokenData = foundry.utils.duplicate(summonActor.prototypeToken);
        tokenData.x = pos.x;
        tokenData.y = pos.y;
        tokenData.actorId = summonActor.id;
        await canvas.scene.createEmbeddedDocuments("Token", [tokenData]);
        d.close();
      });
      // Add some basic styling for selected creature
      const style = `<style>
        .summon-creature-option { cursor: pointer; padding: 2px 6px; border-radius: 3px; }
        .summon-creature-option.selected { background: #4caf50; color: white; }
        .summon-creature-option:hover { background: #e0e0e0; }
      </style>`;
      html.closest('.app').append(style);
    }
  });
  d.render(true);
}
